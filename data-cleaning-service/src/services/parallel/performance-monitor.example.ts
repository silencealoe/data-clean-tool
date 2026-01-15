/**
 * PerformanceMonitor 使用示例
 * 
 * 演示如何使用 PerformanceMonitorService 监控性能指标
 */

import { PerformanceMonitorService } from './performance-monitor.service';
import { WorkerMetrics } from './types';

/**
 * 模拟 CPU 密集型工作
 */
function simulateCpuWork(durationMs: number): void {
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    // CPU 密集型计算
    Math.sqrt(Math.random() * 1000000);
  }
}

/**
 * 模拟内存分配
 */
function simulateMemoryAllocation(sizeMB: number): any[] {
  const arrays: any[] = [];
  const itemsPerMB = 1024 * 256; // 每 MB 约 256k 个数字
  
  for (let i = 0; i < sizeMB; i++) {
    arrays.push(new Array(itemsPerMB).fill(Math.random()));
  }
  
  return arrays;
}

async function exampleBasicMonitoring() {
  console.log('=== 基本监控示例 ===\n');
  
  const monitor = new PerformanceMonitorService();
  
  // 开始监控
  monitor.startMonitoring('job-001', 500); // 每 500ms 采样一次
  
  console.log('性能监控已启动...\n');
  
  // 模拟工作负载
  for (let i = 0; i < 5; i++) {
    console.log(`执行工作负载 ${i + 1}/5...`);
    
    // 模拟 CPU 工作
    simulateCpuWork(200);
    
    // 获取当前指标
    const metrics = monitor.getCurrentMetrics();
    console.log(`  CPU: ${metrics.cpuUsage.overall.toFixed(1)}%`);
    console.log(`  内存: ${metrics.memoryUsage.rssMB.toFixed(1)} MB`);
    console.log(`  吞吐量: ${metrics.throughput.toFixed(0)} 行/秒\n`);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 停止监控并获取报告
  const report = monitor.stopMonitoring();
  
  console.log('性能报告:');
  console.log(`  任务 ID: ${report.jobId}`);
  console.log(`  持续时间: ${(report.duration / 1000).toFixed(2)} 秒`);
  console.log(`  平均 CPU: ${report.avgCpuUsage.toFixed(1)}%`);
  console.log(`  峰值 CPU: ${report.peakCpuUsage.toFixed(1)}%`);
  console.log(`  平均内存: ${report.avgMemoryUsage.toFixed(1)} MB`);
  console.log(`  峰值内存: ${report.peakMemoryUsage.toFixed(1)} MB`);
  console.log(`  样本数: ${report.timeline.length}`);
}

async function exampleWorkerMetrics() {
  console.log('\n=== 工作线程指标示例 ===\n');
  
  const monitor = new PerformanceMonitorService();
  
  // 开始监控
  monitor.startMonitoring('job-002', 1000);
  
  console.log('模拟 4 个工作线程...\n');
  
  // 模拟 4 个工作线程报告指标
  const workerCount = 4;
  const totalRows = 1000000;
  const rowsPerWorker = totalRows / workerCount;
  
  for (let step = 0; step <= 10; step++) {
    const progress = step / 10;
    
    // 每个工作线程报告指标
    for (let workerId = 0; workerId < workerCount; workerId++) {
      const processedRows = Math.floor(rowsPerWorker * progress);
      const elapsedSeconds = (step + 1);
      const throughput = processedRows / elapsedSeconds;
      
      const workerMetrics: WorkerMetrics = {
        workerId,
        cpuUsage: 20 + Math.random() * 30, // 20-50%
        memoryUsage: 100 + Math.random() * 50, // 100-150 MB
        processedRows,
        throughput,
        status: progress < 1 ? 'running' : 'completed',
      };
      
      monitor.recordWorkerMetrics(workerMetrics);
    }
    
    if (step % 3 === 0) {
      const status = monitor.getStatus();
      console.log(`步骤 ${step}:`);
      console.log(`  已处理: ${status.totalProcessedRows.toLocaleString()} 行`);
      console.log(`  当前 CPU: ${status.currentCpuUsage.toFixed(1)}%`);
      console.log(`  当前内存: ${status.currentMemoryUsage.toFixed(1)} MB`);
      console.log(`  当前吞吐量: ${status.currentThroughput.toFixed(0)} 行/秒\n`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 停止监控并获取报告
  const report = monitor.stopMonitoring();
  
  console.log('工作线程报告:');
  for (const workerReport of report.workerReports) {
    console.log(`\n  Worker ${workerReport.workerId}:`);
    console.log(`    已处理: ${workerReport.processedRows.toLocaleString()} 行`);
    console.log(`    平均 CPU: ${workerReport.avgCpuUsage.toFixed(1)}%`);
    console.log(`    峰值 CPU: ${workerReport.peakCpuUsage.toFixed(1)}%`);
    console.log(`    平均内存: ${workerReport.avgMemoryUsage.toFixed(1)} MB`);
    console.log(`    平均吞吐量: ${workerReport.avgThroughput.toFixed(0)} 行/秒`);
    console.log(`    持续时间: ${(workerReport.duration / 1000).toFixed(2)} 秒`);
  }
  
  console.log(`\n总体统计:`);
  console.log(`  总行数: ${report.totalRows.toLocaleString()}`);
  console.log(`  平均吞吐量: ${report.avgThroughput.toFixed(0)} 行/秒`);
  console.log(`  峰值吞吐量: ${report.peakThroughput.toFixed(0)} 行/秒`);
}

async function exampleCpuMemoryMonitoring() {
  console.log('\n=== CPU 和内存监控示例 ===\n');
  
  const monitor = new PerformanceMonitorService();
  
  // 开始监控
  monitor.startMonitoring('job-003', 500);
  
  console.log('执行 CPU 和内存密集型任务...\n');
  
  let memoryArrays: any[] = [];
  
  for (let i = 0; i < 6; i++) {
    console.log(`阶段 ${i + 1}/6:`);
    
    // 阶段 1-3: 增加内存使用
    if (i < 3) {
      console.log('  分配内存...');
      memoryArrays.push(...simulateMemoryAllocation(20));
    }
    
    // 阶段 4-6: CPU 密集型工作
    if (i >= 3) {
      console.log('  执行 CPU 密集型计算...');
      simulateCpuWork(500);
    }
    
    // 获取当前指标
    const metrics = monitor.getCurrentMetrics();
    console.log(`  CPU 使用率:`);
    console.log(`    总体: ${metrics.cpuUsage.overall.toFixed(1)}%`);
    console.log(`    用户态: ${metrics.cpuUsage.user.toFixed(1)}%`);
    console.log(`    系统态: ${metrics.cpuUsage.system.toFixed(1)}%`);
    console.log(`  内存使用:`);
    console.log(`    堆内存: ${metrics.memoryUsage.heapUsedMB.toFixed(1)} MB`);
    console.log(`    RSS: ${metrics.memoryUsage.rssMB.toFixed(1)} MB`);
    console.log(`    使用率: ${metrics.memoryUsage.usagePercentage.toFixed(2)}%\n`);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 清理内存
  memoryArrays = [];
  if (global.gc) {
    global.gc();
  }
  
  // 停止监控
  const report = monitor.stopMonitoring();
  
  console.log('性能摘要:');
  console.log(`  平均 CPU: ${report.avgCpuUsage.toFixed(1)}%`);
  console.log(`  峰值 CPU: ${report.peakCpuUsage.toFixed(1)}%`);
  console.log(`  CPU 利用率: ${report.cpuUtilization.toFixed(1)}%`);
  console.log(`  平均内存: ${report.avgMemoryUsage.toFixed(1)} MB`);
  console.log(`  峰值内存: ${report.peakMemoryUsage.toFixed(1)} MB`);
  console.log(`  内存利用率: ${report.memoryUtilization.toFixed(2)}%`);
}

async function exampleTimelineData() {
  console.log('\n=== 时间线数据示例 ===\n');
  
  const monitor = new PerformanceMonitorService();
  
  // 开始监控（快速采样）
  monitor.startMonitoring('job-004', 200);
  
  console.log('收集时间线数据...\n');
  
  // 模拟变化的工作负载
  for (let i = 0; i < 10; i++) {
    // 变化的 CPU 负载
    const cpuWorkDuration = 50 + Math.random() * 100;
    simulateCpuWork(cpuWorkDuration);
    
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  // 停止监控
  const report = monitor.stopMonitoring();
  
  console.log(`收集了 ${report.timeline.length} 个时间线样本\n`);
  
  // 显示前 10 个样本
  console.log('前 10 个样本:');
  for (let i = 0; i < Math.min(10, report.timeline.length); i++) {
    const snapshot = report.timeline[i];
    const relativeTime = ((snapshot.timestamp - report.timeline[0].timestamp) / 1000).toFixed(2);
    console.log(
      `  ${relativeTime}s: CPU=${snapshot.cpuUsage.toFixed(1)}%, ` +
      `内存=${snapshot.memoryUsage.toFixed(1)}MB, ` +
      `吞吐量=${snapshot.throughput.toFixed(0)} 行/秒`,
    );
  }
  
  // 时间线数据可用于生成图表
  console.log('\n时间线数据可用于:');
  console.log('  - 生成性能趋势图表');
  console.log('  - 识别性能瓶颈');
  console.log('  - 分析资源使用模式');
}

async function exampleRealTimeMonitoring() {
  console.log('\n=== 实时监控示例 ===\n');
  
  const monitor = new PerformanceMonitorService();
  
  // 开始监控
  monitor.startMonitoring('job-005', 1000);
  
  console.log('实时监控 10 秒...\n');
  
  // 实时显示监控数据
  const displayInterval = setInterval(() => {
    const status = monitor.getStatus();
    
    console.clear();
    console.log('=== 实时性能监控 ===\n');
    console.log(`任务 ID: ${status.jobId}`);
    console.log(`运行时间: ${(status.duration / 1000).toFixed(1)} 秒`);
    console.log(`样本数: ${status.sampleCount}`);
    console.log(`\n当前指标:`);
    console.log(`  CPU: ${status.currentCpuUsage.toFixed(1)}%`);
    console.log(`  内存: ${status.currentMemoryUsage.toFixed(1)} MB`);
    console.log(`  吞吐量: ${status.currentThroughput.toFixed(0)} 行/秒`);
    console.log(`  已处理: ${status.totalProcessedRows.toLocaleString()} 行`);
    
    // 模拟工作负载
    simulateCpuWork(100);
  }, 1000);
  
  // 运行 10 秒
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  clearInterval(displayInterval);
  
  // 停止监控
  const report = monitor.stopMonitoring();
  
  console.clear();
  console.log('=== 监控完成 ===\n');
  console.log(`持续时间: ${(report.duration / 1000).toFixed(2)} 秒`);
  console.log(`平均 CPU: ${report.avgCpuUsage.toFixed(1)}%`);
  console.log(`平均内存: ${report.avgMemoryUsage.toFixed(1)} MB`);
}

// 运行所有示例
if (require.main === module) {
  (async () => {
    await exampleBasicMonitoring();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await exampleWorkerMetrics();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await exampleCpuMemoryMonitoring();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await exampleTimelineData();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await exampleRealTimeMonitoring();
  })().catch(console.error);
}
