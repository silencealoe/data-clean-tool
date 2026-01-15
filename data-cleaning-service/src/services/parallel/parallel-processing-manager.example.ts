/**
 * ParallelProcessingManager 使用示例
 * 
 * 演示如何使用 ParallelProcessingManagerService 进行并行数据处理
 */

import { ParallelProcessingManagerService } from './parallel-processing-manager.service';
import { ProcessingConfig } from './types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 创建测试 CSV 文件
 */
function createTestCsvFile(filePath: string, rowCount: number): void {
  const header = '姓名,手机号,日期,地址\n';
  let content = header;
  
  for (let i = 0; i < rowCount; i++) {
    const name = `用户${i + 1}`;
    const phone = `138${String(i).padStart(8, '0')}`;
    const date = '2024-01-15';
    const address = `北京市朝阳区测试路${i + 1}号`;
    
    content += `${name},${phone},${date},${address}\n`;
  }
  
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`创建测试文件: ${filePath} (${rowCount} 行)`);
}

async function exampleBasicUsage() {
  console.log('=== 基本使用示例 ===\n');
  
  // 创建测试文件
  const testFile = path.join(__dirname, 'test-data-1000.csv');
  createTestCsvFile(testFile, 1000);
  
  // 创建管理器实例
  const manager = new ParallelProcessingManagerService();
  
  // 配置
  const config: ProcessingConfig = {
    workerCount: 4,
    batchSize: 100,
    timeoutMs: 60000, // 60 秒
    enableProgressTracking: true,
    enablePerformanceMonitoring: true,
    performanceSampleInterval: 1000,
  };
  
  try {
    console.log('开始并行处理...\n');
    
    // 处理文件
    const result = await manager.processFile(testFile, 'job-001', config);
    
    console.log('\n处理结果:');
    console.log(`  总记录数: ${result.totalRecords}`);
    console.log(`  成功数: ${result.successCount}`);
    console.log(`  错误数: ${result.errorCount}`);
    console.log(`  处理时间: ${result.processingTimeMs}ms`);
    
    if (result.performanceSummary) {
      console.log('\n性能摘要:');
      console.log(`  平均 CPU: ${result.performanceSummary.avgCpuUsage.toFixed(1)}%`);
      console.log(`  峰值 CPU: ${result.performanceSummary.peakCpuUsage.toFixed(1)}%`);
      console.log(`  平均内存: ${result.performanceSummary.avgMemoryUsage.toFixed(1)} MB`);
      console.log(`  峰值内存: ${result.performanceSummary.peakMemoryUsage.toFixed(1)} MB`);
      console.log(`  平均吞吐量: ${result.performanceSummary.avgThroughput.toFixed(0)} 行/秒`);
      console.log(`  峰值吞吐量: ${result.performanceSummary.peakThroughput.toFixed(0)} 行/秒`);
    }
    
    console.log('\n各工作线程结果:');
    result.workerResults.forEach(wr => {
      console.log(
        `  Worker ${wr.workerId}: 成功=${wr.successCount}, 错误=${wr.errorCount}, 耗时=${wr.processingTimeMs}ms`,
      );
    });
    
  } catch (error) {
    console.error('处理失败:', error.message);
  } finally {
    // 清理
    await manager.shutdown();
    fs.unlinkSync(testFile);
  }
}

async function exampleProgressMonitoring() {
  console.log('\n=== 进度监控示例 ===\n');
  
  // 创建较大的测试文件
  const testFile = path.join(__dirname, 'test-data-10000.csv');
  createTestCsvFile(testFile, 10000);
  
  const manager = new ParallelProcessingManagerService();
  
  const config: ProcessingConfig = {
    workerCount: 4,
    batchSize: 500,
    timeoutMs: 120000,
    enableProgressTracking: true,
    enablePerformanceMonitoring: true,
  };
  
  try {
    // 启动处理（不等待完成）
    const processingPromise = manager.processFile(testFile, 'job-002', config);
    
    // 定期查询进度
    const progressInterval = setInterval(() => {
      const progress = manager.getProgress();
      const stats = manager.getProgressStats();
      const metrics = manager.getPerformanceMetrics();
      
      console.log(`\n进度: ${progress.toFixed(1)}%`);
      
      if (stats) {
        console.log(`  已处理: ${stats.totalProcessed}/${stats.totalRows}`);
        console.log(`  完成的工作线程: ${stats.completedWorkers}/${stats.totalWorkers}`);
        console.log(`  达成的里程碑: ${stats.reachedMilestones.join(', ')}%`);
      }
      
      if (metrics) {
        console.log(`  当前 CPU: ${metrics.cpuUsage.overall.toFixed(1)}%`);
        console.log(`  当前内存: ${metrics.memoryUsage.rssMB.toFixed(1)} MB`);
        console.log(`  当前吞吐量: ${metrics.throughput.toFixed(0)} 行/秒`);
      }
    }, 2000);
    
    // 等待处理完成
    const result = await processingPromise;
    
    clearInterval(progressInterval);
    
    console.log('\n处理完成!');
    console.log(`  总记录数: ${result.totalRecords}`);
    console.log(`  成功数: ${result.successCount}`);
    console.log(`  错误数: ${result.errorCount}`);
    
  } catch (error) {
    console.error('处理失败:', error.message);
  } finally {
    await manager.shutdown();
    fs.unlinkSync(testFile);
  }
}

async function exampleStatusQuery() {
  console.log('\n=== 状态查询示例 ===\n');
  
  const testFile = path.join(__dirname, 'test-data-5000.csv');
  createTestCsvFile(testFile, 5000);
  
  const manager = new ParallelProcessingManagerService();
  
  const config: ProcessingConfig = {
    workerCount: 4,
    batchSize: 250,
    timeoutMs: 60000,
    enableProgressTracking: true,
    enablePerformanceMonitoring: true,
  };
  
  try {
    // 启动处理
    const processingPromise = manager.processFile(testFile, 'job-003', config);
    
    // 等待一段时间后查询状态
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const status = manager.getStatus();
    
    console.log('管理器状态:');
    console.log(`  正在处理: ${status.isProcessing}`);
    console.log(`  当前任务 ID: ${status.currentJobId}`);
    console.log(`  进度: ${status.progress.toFixed(1)}%`);
    
    console.log('\n工作线程池状态:');
    console.log(`  总工作线程数: ${status.workerPoolStatus.totalWorkers}`);
    console.log(`  活跃工作线程数: ${status.workerPoolStatus.activeWorkers}`);
    console.log(`  空闲工作线程数: ${status.workerPoolStatus.idleWorkers}`);
    
    console.log('\n结果收集器状态:');
    console.log(`  预期工作线程数: ${status.resultCollectorStatus.expectedWorkerCount}`);
    console.log(`  已完成数: ${status.resultCollectorStatus.completedCount}`);
    console.log(`  是否完成: ${status.resultCollectorStatus.isComplete}`);
    
    console.log('\n进度跟踪器状态:');
    console.log(`  总行数: ${status.progressTrackerStatus.totalRows}`);
    console.log(`  总体进度: ${status.progressTrackerStatus.overallProgress.toFixed(1)}%`);
    console.log(`  工作线程数: ${status.progressTrackerStatus.workerCount}`);
    
    console.log('\n性能监控器状态:');
    console.log(`  正在监控: ${status.performanceMonitorStatus.isMonitoring}`);
    console.log(`  任务 ID: ${status.performanceMonitorStatus.jobId}`);
    console.log(`  持续时间: ${(status.performanceMonitorStatus.duration / 1000).toFixed(2)}s`);
    console.log(`  样本数: ${status.performanceMonitorStatus.sampleCount}`);
    
    // 等待处理完成
    await processingPromise;
    
    console.log('\n处理完成!');
    
  } catch (error) {
    console.error('处理失败:', error.message);
  } finally {
    await manager.shutdown();
    fs.unlinkSync(testFile);
  }
}

async function exampleErrorHandling() {
  console.log('\n=== 错误处理示例 ===\n');
  
  // 创建一个不存在的文件路径
  const testFile = path.join(__dirname, 'non-existent-file.csv');
  
  const manager = new ParallelProcessingManagerService();
  
  const config: ProcessingConfig = {
    workerCount: 4,
    batchSize: 100,
    timeoutMs: 30000,
    enableProgressTracking: true,
    enablePerformanceMonitoring: true,
  };
  
  try {
    console.log('尝试处理不存在的文件...\n');
    
    await manager.processFile(testFile, 'job-004', config);
    
  } catch (error) {
    console.log('捕获到错误（预期行为）:');
    console.log(`  错误消息: ${error.message}`);
    console.log('\n错误处理机制正常工作 ✓');
  } finally {
    await manager.shutdown();
  }
}

async function exampleMultipleConfigurations() {
  console.log('\n=== 多种配置示例 ===\n');
  
  const testFile = path.join(__dirname, 'test-data-2000.csv');
  createTestCsvFile(testFile, 2000);
  
  const configurations = [
    { name: '2 个工作线程', workerCount: 2, batchSize: 200 },
    { name: '4 个工作线程', workerCount: 4, batchSize: 200 },
    { name: '8 个工作线程', workerCount: 8, batchSize: 200 },
  ];
  
  for (const cfg of configurations) {
    console.log(`\n测试配置: ${cfg.name}`);
    
    const manager = new ParallelProcessingManagerService();
    
    const config: ProcessingConfig = {
      workerCount: cfg.workerCount,
      batchSize: cfg.batchSize,
      timeoutMs: 60000,
      enableProgressTracking: true,
      enablePerformanceMonitoring: true,
    };
    
    try {
      const result = await manager.processFile(testFile, `job-${cfg.workerCount}`, config);
      
      console.log(`  处理时间: ${result.processingTimeMs}ms`);
      console.log(`  成功数: ${result.successCount}`);
      
      if (result.performanceSummary) {
        console.log(`  平均 CPU: ${result.performanceSummary.avgCpuUsage.toFixed(1)}%`);
        console.log(`  平均吞吐量: ${result.performanceSummary.avgThroughput.toFixed(0)} 行/秒`);
      }
      
    } catch (error) {
      console.error(`  失败: ${error.message}`);
    } finally {
      await manager.shutdown();
    }
    
    // 等待一段时间再进行下一个测试
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  fs.unlinkSync(testFile);
}

// 运行所有示例
if (require.main === module) {
  (async () => {
    await exampleBasicUsage();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await exampleProgressMonitoring();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await exampleStatusQuery();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await exampleErrorHandling();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await exampleMultipleConfigurations();
  })().catch(console.error);
}
