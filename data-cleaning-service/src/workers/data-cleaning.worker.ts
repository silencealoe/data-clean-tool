/**
 * Data Cleaning Worker Thread
 * 
 * 在独立线程中执行数据清洗任务
 * 
 * 功能：
 * - 读取分配的 CSV 行范围
 * - 应用数据验证规则
 * - 批量插入清洗数据到数据库
 * - 记录错误到错误日志
 * - 报告进度和性能指标
 */

import { parentPort, workerData } from 'worker_threads';
import * as fs from 'fs';
import * as readline from 'readline';
import { DataSource } from 'typeorm';
import {
  WorkerTask,
  WorkerResult,
  WorkerToMainMessage,
  MainToWorkerMessage,
  WorkerMetrics,
} from '../services/parallel/types';

// 工作线程状态
let isTerminating = false;
let processedRows = 0;
let successCount = 0;
let errorCount = 0;
let startTime: number;

// 性能监控
let baselineCpuUsage: NodeJS.CpuUsage;
let performanceInterval: NodeJS.Timeout | null = null;

/**
 * 主入口函数
 */
async function main() {
  if (!parentPort) {
    throw new Error('此脚本必须作为 Worker Thread 运行');
  }

  // 监听主线程消息
  parentPort.on('message', async (message: MainToWorkerMessage) => {
    try {
      if (message.type === 'START') {
        await handleStartMessage(message.payload);
      } else if (message.type === 'TERMINATE') {
        await handleTerminateMessage();
      }
    } catch (error) {
      sendErrorMessage(error);
    }
  });

  // 监听未捕获的错误
  process.on('uncaughtException', (error) => {
    console.error('Worker 未捕获的异常:', error);
    sendErrorMessage(error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Worker 未处理的 Promise 拒绝:', reason);
    sendErrorMessage(new Error(String(reason)));
    process.exit(1);
  });
}

/**
 * 处理 START 消息
 */
async function handleStartMessage(task: WorkerTask): Promise<void> {
  console.log(`Worker ${task.workerId} 开始处理任务: 行 ${task.startRow}-${task.startRow + task.rowCount - 1}`);
  
  startTime = Date.now();
  baselineCpuUsage = process.cpuUsage();
  processedRows = 0;
  successCount = 0;
  errorCount = 0;

  // 启动性能监控
  startPerformanceMonitoring(task.workerId);

  try {
    // 连接数据库
    const dataSource = await connectDatabase(task);

    // 处理数据
    await processChunk(task, dataSource);

    // 断开数据库连接
    await dataSource.destroy();

    // 停止性能监控
    stopPerformanceMonitoring();

    // 发送完成消息
    const processingTimeMs = Date.now() - startTime;
    const result: WorkerResult = {
      workerId: task.workerId,
      successCount,
      errorCount,
      processingTimeMs,
    };

    sendCompleteMessage(result);
    console.log(`Worker ${task.workerId} 完成任务: 成功 ${successCount}, 错误 ${errorCount}, 耗时 ${processingTimeMs}ms`);
  } catch (error) {
    stopPerformanceMonitoring();
    console.error(`Worker ${task.workerId} 处理失败:`, error);
    sendErrorMessage(error);
  }
}

/**
 * 处理 TERMINATE 消息
 */
async function handleTerminateMessage(): Promise<void> {
  console.log('Worker 收到终止信号');
  isTerminating = true;
  stopPerformanceMonitoring();
  process.exit(0);
}

/**
 * 连接数据库
 */
async function connectDatabase(task: WorkerTask): Promise<DataSource> {
  // 使用环境变量或任务中的数据库配置
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'data_cleaning',
    entities: [],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log(`Worker ${task.workerId} 数据库连接成功`);
  
  return dataSource;
}

/**
 * 处理数据块
 */
async function processChunk(task: WorkerTask, dataSource: DataSource): Promise<void> {
  const { filePath, startRow, rowCount, batchSize, jobId, workerId } = task;

  let cleanBatch: any[] = [];
  let errorBatch: any[] = [];
  let currentRow = 0;
  let rowsInRange = 0;

  // 创建文件流
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  try {
    for await (const line of rl) {
      // 检查是否需要终止
      if (isTerminating) {
        console.log(`Worker ${workerId} 正在终止...`);
        break;
      }

      // 跳过标题行
      if (currentRow === 0) {
        currentRow++;
        continue;
      }

      // 计算实际行号（从 1 开始，不包括标题）
      const actualRowNumber = currentRow - 1;

      // 检查是否在分配的范围内
      if (actualRowNumber >= startRow && actualRowNumber < startRow + rowCount) {
        // 解析 CSV 行
        const rowData = parseCsvLine(line);
        
        // 清洗数据
        const cleanedRow = cleanRow(rowData, actualRowNumber, jobId);

        if (cleanedRow.isValid) {
          cleanBatch.push(cleanedRow.data);
          successCount++;
        } else {
          errorBatch.push(cleanedRow.error);
          errorCount++;
        }

        rowsInRange++;
        processedRows++;

        // 批量插入
        if (cleanBatch.length >= batchSize) {
          await batchInsertCleanData(dataSource, cleanBatch);
          cleanBatch = [];
        }

        if (errorBatch.length >= batchSize) {
          await batchInsertErrorLogs(dataSource, errorBatch);
          errorBatch = [];
        }

        // 发送进度更新（每 1000 行）
        if (processedRows % 1000 === 0) {
          sendProgressMessage(workerId, processedRows, rowCount);
        }
      }

      // 如果已经处理完所有分配的行，提前退出
      if (actualRowNumber >= startRow + rowCount) {
        break;
      }

      currentRow++;
    }

    // 插入剩余的批次
    if (cleanBatch.length > 0) {
      await batchInsertCleanData(dataSource, cleanBatch);
    }

    if (errorBatch.length > 0) {
      await batchInsertErrorLogs(dataSource, errorBatch);
    }

    console.log(`Worker ${workerId} 处理了 ${rowsInRange} 行数据`);
  } finally {
    rl.close();
    fileStream.destroy();
  }
}

/**
 * 解析 CSV 行
 */
function parseCsvLine(line: string): Record<string, any> {
  // 简单的 CSV 解析（处理逗号分隔）
  // 注意：这是简化版本，实际应该使用专业的 CSV 解析库
  const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
  
  // 假设列顺序：姓名,手机号,日期,地址
  return {
    name: values[0] || '',
    phone: values[1] || '',
    date: values[2] || '',
    address: values[3] || '',
  };
}

/**
 * 清洗单行数据
 */
function cleanRow(
  rowData: Record<string, any>,
  rowNumber: number,
  jobId: string,
): { isValid: boolean; data?: any; error?: any } {
  const errors: string[] = [];
  const cleanedData: Record<string, any> = {};

  // 验证姓名
  if (rowData.name && rowData.name.length > 0) {
    cleanedData.name = rowData.name;
  } else {
    errors.push('姓名不能为空');
  }

  // 验证手机号
  if (rowData.phone) {
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (phoneRegex.test(rowData.phone)) {
      cleanedData.phone = rowData.phone;
    } else {
      errors.push('手机号格式不正确');
    }
  } else {
    errors.push('手机号不能为空');
  }

  // 验证日期
  if (rowData.date) {
    cleanedData.date = rowData.date; // 简化处理
  }

  // 验证地址
  if (rowData.address) {
    cleanedData.address = rowData.address;
  }

  if (errors.length === 0) {
    return {
      isValid: true,
      data: {
        jobId,
        rowNumber,
        ...cleanedData,
      },
    };
  } else {
    return {
      isValid: false,
      error: {
        jobId,
        rowNumber,
        originalData: JSON.stringify(rowData),
        errors: errors.join('; '),
        errorSummary: errors.join('; '),
      },
    };
  }
}

/**
 * 批量插入清洗数据
 */
async function batchInsertCleanData(
  dataSource: DataSource,
  records: any[],
): Promise<void> {
  if (records.length === 0) return;

  const values = records.map(r => 
    `('${r.jobId}', ${r.rowNumber}, ${dataSource.driver.escape(r.name)}, ` +
    `${dataSource.driver.escape(r.phone)}, ${dataSource.driver.escape(r.date || '')}, ` +
    `${dataSource.driver.escape(r.address || '')})`
  ).join(',');

  const query = `
    INSERT INTO clean_data (jobId, rowNumber, name, phone, date, addressDetail)
    VALUES ${values}
  `;

  await dataSource.query(query);
}

/**
 * 批量插入错误日志
 */
async function batchInsertErrorLogs(
  dataSource: DataSource,
  records: any[],
): Promise<void> {
  if (records.length === 0) return;

  const values = records.map(r =>
    `('${r.jobId}', ${r.rowNumber}, ${dataSource.driver.escape(r.originalData)}, ` +
    `${dataSource.driver.escape(r.errors)}, ${dataSource.driver.escape(r.errorSummary)})`
  ).join(',');

  const query = `
    INSERT INTO error_log (jobId, rowNumber, originalData, errors, errorSummary)
    VALUES ${values}
  `;

  await dataSource.query(query);
}

/**
 * 启动性能监控
 */
function startPerformanceMonitoring(workerId: number): void {
  performanceInterval = setInterval(() => {
    const metrics = collectPerformanceMetrics(workerId);
    sendMetricsMessage(metrics);
  }, 1000); // 每秒采样一次
}

/**
 * 停止性能监控
 */
function stopPerformanceMonitoring(): void {
  if (performanceInterval) {
    clearInterval(performanceInterval);
    performanceInterval = null;
  }
}

/**
 * 收集性能指标
 */
function collectPerformanceMetrics(workerId: number): WorkerMetrics {
  const cpuUsage = process.cpuUsage(baselineCpuUsage);
  const memUsage = process.memoryUsage();
  const elapsedTime = Date.now() - startTime;

  // 计算 CPU 使用率
  const totalCpuTime = cpuUsage.user + cpuUsage.system;
  const cpuPercentage = (totalCpuTime / (elapsedTime * 1000)) * 100;

  // 计算吞吐量
  const throughput = elapsedTime > 0 ? (processedRows / (elapsedTime / 1000)) : 0;

  return {
    workerId,
    cpuUsage: Math.min(100, cpuPercentage),
    memoryUsage: memUsage.heapUsed / 1024 / 1024, // MB
    processedRows,
    throughput,
    status: 'running',
    timestamp: Date.now(),
  };
}

/**
 * 发送进度消息
 */
function sendProgressMessage(workerId: number, processed: number, total: number): void {
  if (!parentPort) return;

  const message: WorkerToMainMessage = {
    type: 'PROGRESS',
    payload: {
      workerId,
      processedRows: processed,
      totalRows: total,
      percentage: (processed / total) * 100,
    },
  };

  parentPort.postMessage(message);
}

/**
 * 发送完成消息
 */
function sendCompleteMessage(result: WorkerResult): void {
  if (!parentPort) return;

  const message: WorkerToMainMessage = {
    type: 'COMPLETE',
    payload: result,
  };

  parentPort.postMessage(message);
}

/**
 * 发送错误消息
 */
function sendErrorMessage(error: any): void {
  if (!parentPort) return;

  const message: WorkerToMainMessage = {
    type: 'ERROR',
    payload: {
      workerId: workerData?.workerId || -1,
      error: error.message || String(error),
      stack: error.stack,
    },
  };

  parentPort.postMessage(message);
}

/**
 * 发送性能指标消息
 */
function sendMetricsMessage(metrics: WorkerMetrics): void {
  if (!parentPort) return;

  const message: WorkerToMainMessage = {
    type: 'METRICS',
    payload: metrics,
  };

  parentPort.postMessage(message);
}

// 启动 Worker
main().catch((error) => {
  console.error('Worker 启动失败:', error);
  process.exit(1);
});
