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

<<<<<<< HEAD
// 数据库插入批量大小（固定值，独立于任务配置）
const DB_BATCH_SIZE = 10000;  // 增加到10000，减少事务次数

=======
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
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
<<<<<<< HEAD

=======
  
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
  startTime = Date.now();
  baselineCpuUsage = process.cpuUsage();
  processedRows = 0;
  successCount = 0;
  errorCount = 0;

  // 启动性能监控
  startPerformanceMonitoring(task.workerId);

  try {
    // 连接数据库
<<<<<<< HEAD
    console.log(`Worker ${task.workerId} 开始连接数据库`);
    const dbConnectStart = Date.now();
    const dataSource = await connectDatabase(task);
    console.log(`Worker ${task.workerId} 数据库连接完成，耗时: ${Date.now() - dbConnectStart}ms`);

    // 处理数据（包括批量插入，性能监控会在processChunk内部停止）
    await processChunk(task, dataSource);

    // 断开数据库连接
    console.log(`Worker ${task.workerId} 开始断开数据库连接`);
    const disconnectStart = Date.now();
    await dataSource.destroy();
    console.log(`Worker ${task.workerId} 数据库断开完成，耗时: ${Date.now() - disconnectStart}ms`);
=======
    const dataSource = await connectDatabase(task);

    // 处理数据
    await processChunk(task, dataSource);

    // 断开数据库连接
    await dataSource.destroy();

    // 停止性能监控
    stopPerformanceMonitoring();
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a

    // 发送完成消息
    const processingTimeMs = Date.now() - startTime;
    const result: WorkerResult = {
      workerId: task.workerId,
      successCount,
      errorCount,
      processingTimeMs,
    };

    sendCompleteMessage(result);
<<<<<<< HEAD
    console.log(`Worker ${task.workerId} 完成任务: 成功 ${successCount}, 错误 ${errorCount}, 总耗时 ${processingTimeMs}ms`);
=======
    console.log(`Worker ${task.workerId} 完成任务: 成功 ${successCount}, 错误 ${errorCount}, 耗时 ${processingTimeMs}ms`);
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
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
<<<<<<< HEAD

=======
  
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
  return dataSource;
}

/**
 * 处理数据块
 */
async function processChunk(task: WorkerTask, dataSource: DataSource): Promise<void> {
<<<<<<< HEAD
  const { filePath, startRow, rowCount, jobId, workerId } = task;
=======
  const { filePath, startRow, rowCount, batchSize, jobId, workerId } = task;
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a

  let cleanBatch: any[] = [];
  let errorBatch: any[] = [];
  let currentRow = 0;
  let rowsInRange = 0;

  // 创建文件流
  const fileStream = fs.createReadStream(filePath);
<<<<<<< HEAD

=======
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
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
<<<<<<< HEAD

=======
        
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
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

<<<<<<< HEAD
        // 批量插入（使用固定的DB_BATCH_SIZE，更频繁的插入）
        if (cleanBatch.length >= DB_BATCH_SIZE) {
=======
        // 批量插入
        if (cleanBatch.length >= batchSize) {
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
          await batchInsertCleanData(dataSource, cleanBatch);
          cleanBatch = [];
        }

<<<<<<< HEAD
        if (errorBatch.length >= DB_BATCH_SIZE) {
=======
        if (errorBatch.length >= batchSize) {
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
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
<<<<<<< HEAD

  // 停止性能监控（在批量插入前停止，避免显示误导性的指标）
  console.log(`Worker ${workerId} 停止性能监控`);
  stopPerformanceMonitoring();

  // 插入剩余的批次
  console.log(`Worker ${workerId} 开始插入剩余数据: clean=${cleanBatch.length}, error=${errorBatch.length}`);
  const insertStart = Date.now();

  if (cleanBatch.length > 0) {
    await batchInsertCleanData(dataSource, cleanBatch);
    console.log(`Worker ${workerId} 清洁数据插入完成: ${cleanBatch.length} 行`);
  }

  if (errorBatch.length > 0) {
    await batchInsertErrorLogs(dataSource, errorBatch);
    console.log(`Worker ${workerId} 错误数据插入完成: ${errorBatch.length} 行`);
  }

  const insertTime = Date.now() - insertStart;
  console.log(`Worker ${workerId} 所有数据插入完成，耗时: ${insertTime}ms`);
=======
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
}

/**
 * 解析 CSV 行
 */
function parseCsvLine(line: string): Record<string, any> {
  // 简单的 CSV 解析（处理逗号分隔）
  // 注意：这是简化版本，实际应该使用专业的 CSV 解析库
  const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
<<<<<<< HEAD

  // CSV 列顺序：姓名,手机号码,地址,入职日期
  return {
    name: values[0] || '',
    phone: values[1] || '',
    address: values[2] || '',
    hireDate: values[3] || '',
=======
  
  // 假设列顺序：姓名,手机号,日期,地址
  return {
    name: values[0] || '',
    phone: values[1] || '',
    date: values[2] || '',
    address: values[3] || '',
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
  };
}

/**
<<<<<<< HEAD
 * 清洗日期
 * 支持多种日期格式，统一转换为标准格式
 */
function cleanHireDate(date: any): string | null {
  // 处理空值
  if (date === null || date === undefined || date === '') {
    return null;
  }

  // 转换为字符串并去除首尾空格
  const dateStr = String(date).trim();
  if (dateStr === '') {
    return null;
  }

  // 尝试解析各种日期格式
  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;

  // 格式1: 2023/01/15 或 2023-01-15 或 2023.01.15
  const format1 = dateStr.match(/^(\d{4})[-/.年](\d{1,2})[-/.月]?(\d{1,2})日?$/);
  if (format1) {
    year = parseInt(format1[1]);
    month = parseInt(format1[2]);
    day = parseInt(format1[3]);
  }

  // 格式2: 23/08/15 或 23-08-15 (短年份)
  if (!year) {
    const format2 = dateStr.match(/^(\d{2})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (format2) {
      const shortYear = parseInt(format2[1]);
      year = shortYear >= 0 && shortYear <= 50 ? 2000 + shortYear : 1900 + shortYear;
      month = parseInt(format2[2]);
      day = parseInt(format2[3]);
    }
  }

  // 格式3: 2023年12月03日
  if (!year) {
    const format3 = dateStr.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
    if (format3) {
      year = parseInt(format3[1]);
      month = parseInt(format3[2]);
      day = parseInt(format3[3]);
    }
  }

  // 验证日期有效性
  if (year && month && day) {
    // 验证月份范围
    if (month < 1 || month > 12) {
      return null;
    }

    // 验证日期范围
    if (day < 1 || day > 31) {
      return null;
    }

    // 简单验证：2月不超过29天，4/6/9/11月不超过30天
    if (month === 2 && day > 29) {
      return null;
    }
    if ([4, 6, 9, 11].includes(month) && day > 30) {
      return null;
    }

    // 验证年份范围（1900-2100）
    if (year < 1900 || year > 2100) {
      return null;
    }

    // 返回标准格式 YYYY-MM-DD
    const paddedMonth = month.toString().padStart(2, '0');
    const paddedDay = day.toString().padStart(2, '0');
    return `${year}-${paddedMonth}-${paddedDay}`;
  }

  return null;
}

/**
 * 清洗手机号码
 * 移除空格、横杠等非数字字符，验证格式
 */
function cleanPhoneNumber(phone: any): string | null {
  // 处理空值
  if (phone === null || phone === undefined || phone === '') {
    return null;
  }

  // 转换为字符串并去除首尾空格
  const phoneStr = String(phone).trim();
  if (phoneStr === '') {
    return null;
  }

  // 检查原始格式的有效性
  const validFormatPatterns = [
    /^\d{11}$/,  // 11位连续数字
    /^\d{3}-\d{4}-\d{4}$/,  // 139-1234-5678格式
    /^\d{3}\s\d{4}\s\d{4}$/, // 139 1234 5678格式
    /^\+86\d{11}$/,  // +8613912345678格式
    /^\+86-\d{11}$/, // +86-13912345678格式
    /^\+86\s\d{11}$/, // +86 13912345678格式
    /^0\d{2,3}-\d{7,8}$/ // 010-12345678格式（固定电话）
  ];

  const hasValidFormat = validFormatPatterns.some(pattern => pattern.test(phoneStr));
  if (!hasValidFormat) {
    return null;
  }

  // 移除所有非数字字符（保留开头的+）
  let cleaned = phoneStr;
  const hasCountryCode = cleaned.startsWith('+');
  if (hasCountryCode) {
    cleaned = '+' + cleaned.substring(1).replace(/\D/g, '');
  } else {
    cleaned = cleaned.replace(/\D/g, '');
  }

  // 处理国家代码
  if (cleaned.startsWith('+86')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('86') && cleaned.length === 13) {
    cleaned = cleaned.substring(2);
  }

  // 验证中国手机号：11位，以1开头，第二位3-9
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const secondDigit = parseInt(cleaned.charAt(1));
    if (secondDigit >= 3 && secondDigit <= 9) {
      return cleaned;
    }
  }

  // 验证中国固定电话：10-12位，以0开头
  if (cleaned.length >= 10 && cleaned.length <= 12 && cleaned.startsWith('0')) {
    // 避免将错误的手机号误识别为固定电话
    if (!/^0?1\d{9,11}$/.test(cleaned)) {
      return cleaned;
    }
  }

  return null;
}

/**
 * 解析地址，提取省市区信息
 */
function parseAddress(address: string): {
  province: string;
  city: string;
  district: string;
  detail: string;
} {
  if (!address || address.trim() === '') {
    return { province: '', city: '', district: '', detail: '' };
  }

  const provinces = [
    '北京市', '上海市', '天津市', '重庆市',
    '河北省', '山西省', '辽宁省', '吉林省', '黑龙江省', '江苏省', '浙江省', '安徽省',
    '福建省', '江西省', '山东省', '河南省', '湖北省', '湖南省', '广东省', '海南省',
    '四川省', '贵州省', '云南省', '陕西省', '甘肃省', '青海省', '台湾省',
    '内蒙古自治区', '广西壮族自治区', '西藏自治区', '宁夏回族自治区', '新疆维吾尔自治区',
    '香港特别行政区', '澳门特别行政区'
  ];

  const municipalities = ['北京市', '上海市', '天津市', '重庆市', '香港特别行政区', '澳门特别行政区'];

  let remaining = address;
  let province = '';
  let city = '';
  let district = '';
  let detail = '';

  // 匹配省份
  for (const prov of provinces) {
    if (remaining.startsWith(prov)) {
      province = prov;
      remaining = remaining.substring(prov.length);
      break;
    }
  }

  // 如果没有匹配到完整省份名，尝试匹配省份简称
  if (!province) {
    for (const prov of provinces) {
      const shortName = prov.replace(/(省|市|自治区|特别行政区)$/, '');
      if (remaining.startsWith(shortName)) {
        province = prov;
        remaining = remaining.substring(shortName.length);
        break;
      }
    }
  }

  // 如果是直辖市
  if (province && municipalities.includes(province)) {
    city = province;

    // 匹配区
    const districtMatch = remaining.match(/^([\u4e00-\u9fff]{2,6}区)/);
    if (districtMatch) {
      district = districtMatch[1];
      remaining = remaining.substring(district.length);
    }
  } else if (province) {
    // 匹配市
    const cityMatch = remaining.match(/^([\u4e00-\u9fff]{2,8}市)/);
    if (cityMatch) {
      city = cityMatch[1];
      remaining = remaining.substring(city.length);

      // 匹配区/县
      const districtMatch = remaining.match(/^([\u4e00-\u9fff]{2,6}(区|县))/);
      if (districtMatch) {
        district = districtMatch[1];
        remaining = remaining.substring(district.length);
      }
    }
  }

  detail = remaining.trim();

  return { province, city, district, detail };
}

/**
=======
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
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

<<<<<<< HEAD
  // 验证和清洗手机号
  if (rowData.phone) {
    const cleanedPhone = cleanPhoneNumber(rowData.phone);
    if (cleanedPhone) {
      cleanedData.phone = cleanedPhone;
=======
  // 验证手机号
  if (rowData.phone) {
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (phoneRegex.test(rowData.phone)) {
      cleanedData.phone = rowData.phone;
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
    } else {
      errors.push('手机号格式不正确');
    }
  } else {
    errors.push('手机号不能为空');
  }

<<<<<<< HEAD
  // 验证和清洗入职日期
  if (rowData.hireDate) {
    const cleanedDate = cleanHireDate(rowData.hireDate);
    if (cleanedDate) {
      cleanedData.hireDate = cleanedDate;
    }
    // 注意：日期清洗失败不算错误，只是不存储日期
  }

  // 解析地址
  if (rowData.address) {
    const addressParts = parseAddress(rowData.address);
    cleanedData.province = addressParts.province;
    cleanedData.city = addressParts.city;
    cleanedData.district = addressParts.district;
    cleanedData.addressDetail = addressParts.detail;
=======
  // 验证日期
  if (rowData.date) {
    cleanedData.date = rowData.date; // 简化处理
  }

  // 验证地址
  if (rowData.address) {
    cleanedData.address = rowData.address;
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
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
<<<<<<< HEAD
        // 只存储关键字段，不存储完整的 originalData
        originalData: {
          phone: rowData.phone || '',
          name: rowData.name || '',
        },
=======
        originalData: JSON.stringify(rowData),
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
        errors: errors.join('; '),
        errorSummary: errors.join('; '),
      },
    };
  }
}

/**
 * 批量插入清洗数据
<<<<<<< HEAD
 * 使用事务和分批插入优化性能
=======
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
 */
async function batchInsertCleanData(
  dataSource: DataSource,
  records: any[],
): Promise<void> {
  if (records.length === 0) return;

<<<<<<< HEAD
  // 手动转义字符串中的单引号和反斜杠
  const escapeString = (str: string): string => {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  };

  // 生成 UUID v4
  const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  // 使用事务和分批插入（每次最多10000条，优化性能）
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const chunkSize = 10000;  // 增加到10000以提升性能
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);

      const values = chunk.map(r => {
        // 处理入职日期字段 - 如果是 Date 对象，转换为 YYYY-MM-DD 格式
        let hireDateValue = '';
        if (r.hireDate) {
          if (r.hireDate instanceof Date) {
            hireDateValue = r.hireDate.toISOString().split('T')[0];
          } else {
            hireDateValue = r.hireDate;
          }
        }

        // 生成 UUID
        const id = generateUUID();

        // 转义所有字符串字段
        const escapedId = escapeString(id);
        const escapedJobId = escapeString(r.jobId);
        const escapedName = escapeString(r.name || '');
        const escapedPhone = escapeString(r.phone || '');
        const escapedHireDate = escapeString(hireDateValue);
        const escapedProvince = escapeString(r.province || '');
        const escapedCity = escapeString(r.city || '');
        const escapedDistrict = escapeString(r.district || '');
        const escapedAddressDetail = escapeString(r.addressDetail || '');

        return `('${escapedId}', '${escapedJobId}', ${r.rowNumber}, '${escapedName}', ` +
          `'${escapedPhone}', '${escapedHireDate}', '${escapedProvince}', '${escapedCity}', ` +
          `'${escapedDistrict}', '${escapedAddressDetail}')`;
      }).join(',');

      const query = `
        INSERT INTO clean_data (id, jobId, rowNumber, name, phone, hireDate, province, city, district, addressDetail)
        VALUES ${values}
      `;

      await queryRunner.query(query);
    }

    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
=======
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
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
}

/**
 * 批量插入错误日志
<<<<<<< HEAD
 * 使用事务和分批插入优化性能
=======
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
 */
async function batchInsertErrorLogs(
  dataSource: DataSource,
  records: any[],
): Promise<void> {
  if (records.length === 0) return;

<<<<<<< HEAD
  // 手动转义字符串中的单引号和反斜杠
  const escapeString = (str: string): string => {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  };

  // 生成 UUID v4
  const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  // 使用事务和分批插入（每次最多10000条，优化性能）
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const chunkSize = 10000;  // 增加到10000以提升性能
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);

      const values = chunk.map(r => {
        // 序列化 originalData（对象 -> JSON 字符串）
        const originalDataJson = JSON.stringify(r.originalData);

        // 生成 UUID
        const id = generateUUID();

        // 转义所有字符串字段
        const escapedId = escapeString(id);
        const escapedJobId = escapeString(r.jobId);
        const escapedOriginalData = escapeString(originalDataJson);
        const escapedErrors = escapeString(r.errors || '');
        const escapedErrorSummary = escapeString(r.errorSummary || '');

        return `('${escapedId}', '${escapedJobId}', ${r.rowNumber}, '${escapedOriginalData}', ` +
          `'${escapedErrors}', '${escapedErrorSummary}')`;
      }).join(',');

      const query = `
        INSERT INTO error_logs (id, jobId, rowNumber, originalData, errors, errorSummary)
        VALUES ${values}
      `;

      await queryRunner.query(query);
    }

    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
=======
  const values = records.map(r =>
    `('${r.jobId}', ${r.rowNumber}, ${dataSource.driver.escape(r.originalData)}, ` +
    `${dataSource.driver.escape(r.errors)}, ${dataSource.driver.escape(r.errorSummary)})`
  ).join(',');

  const query = `
    INSERT INTO error_log (jobId, rowNumber, originalData, errors, errorSummary)
    VALUES ${values}
  `;

  await dataSource.query(query);
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
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
