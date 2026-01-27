/**
 * ProgressTracker 使用示例
 * 
 * 演示如何使用 ProgressTrackerService 跟踪并行处理进度
 */

import { ProgressTrackerService } from './progress-tracker.service';

async function exampleBasicUsage() {
  console.log('=== 基本使用示例 ===\n');
  
  // 创建 ProgressTracker 实例
  const progressTracker = new ProgressTrackerService();
  
  // 初始化跟踪器
  const totalRows = 1000000;
  const workerCount = 4;
  progressTracker.initialize(totalRows, workerCount);
  
  console.log('ProgressTracker 已初始化');
  console.log(`总行数: ${totalRows}`);
  console.log(`工作线程数: ${workerCount}`);
  console.log('---\n');
  
  // 模拟工作线程进度更新
  const workerRowCounts = [250000, 250000, 250000, 250000];
  
  // 模拟处理过程
  for (let step = 0; step <= 10; step++) {
    const progress = step / 10;
    
    // 更新每个工作线程的进度
    for (let workerId = 0; workerId < workerCount; workerId++) {
      const processed = Math.floor(workerRowCounts[workerId] * progress);
      progressTracker.updateProgress(workerId, processed, workerRowCounts[workerId]);
    }
    
    // 获取总体进度
    const overallProgress = progressTracker.getOverallProgress();
    console.log(`步骤 ${step}: 总体进度 ${overallProgress.toFixed(1)}%`);
    
    // 获取各工作线程进度
    if (step === 5 || step === 10) {
      console.log('  各工作线程进度:');
      const workerProgress = progressTracker.getWorkerProgress();
      for (const [workerId, percentage] of workerProgress.entries()) {
        console.log(`    Worker ${workerId}: ${percentage.toFixed(1)}%`);
      }
      console.log();
    }
    
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // 获取进度统计
  const stats = progressTracker.getProgressStats();
  console.log('\n进度统计:');
  console.log(`  总体进度: ${stats.overallProgress.toFixed(1)}%`);
  console.log(`  已处理: ${stats.totalProcessed}/${stats.totalRows}`);
  console.log(`  完成的工作线程: ${stats.completedWorkers}/${stats.totalWorkers}`);
  console.log(`  达成的里程碑: ${stats.reachedMilestones.join(', ')}%`);
  console.log(`  进度单调递增: ${stats.isMonotonic ? '✓' : '✗'}`);
}

async function exampleMilestones() {
  console.log('\n=== 里程碑示例 ===\n');
  
  const progressTracker = new ProgressTrackerService();
  
  // 初始化
  const totalRows = 100000;
  const workerCount = 4;
  progressTracker.initialize(totalRows, workerCount);
  
  const workerRowCounts = [25000, 25000, 25000, 25000];
  
  // 模拟快速进度更新以触发里程碑
  const progressSteps = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1.0];
  
  for (const progress of progressSteps) {
    for (let workerId = 0; workerId < workerCount; workerId++) {
      const processed = Math.floor(workerRowCounts[workerId] * progress);
      progressTracker.updateProgress(workerId, processed, workerRowCounts[workerId]);
    }
    
    const overallProgress = progressTracker.getOverallProgress();
    console.log(`进度: ${overallProgress.toFixed(1)}%`);
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log('\n达成的里程碑:', progressTracker.getReachedMilestones().join(', ') + '%');
}

async function exampleUnbalancedProgress() {
  console.log('\n=== 不均衡进度示例 ===\n');
  
  const progressTracker = new ProgressTrackerService();
  
  // 初始化
  const totalRows = 1000000;
  const workerCount = 4;
  progressTracker.initialize(totalRows, workerCount);
  
  // 不同工作线程处理不同数量的行
  const workerRowCounts = [200000, 250000, 300000, 250000];
  
  // 模拟不同速度的工作线程
  const workerSpeeds = [1.0, 0.8, 0.6, 0.9];
  
  for (let step = 0; step <= 10; step++) {
    for (let workerId = 0; workerId < workerCount; workerId++) {
      const progress = Math.min(1.0, (step / 10) * workerSpeeds[workerId]);
      const processed = Math.floor(workerRowCounts[workerId] * progress);
      progressTracker.updateProgress(workerId, processed, workerRowCounts[workerId]);
    }
    
    const overallProgress = progressTracker.getOverallProgress();
    console.log(`步骤 ${step}: 总体进度 ${overallProgress.toFixed(1)}%`);
    
    // 显示各工作线程进度
    const workerProgress = progressTracker.getWorkerProgress();
    const progressStr = Array.from(workerProgress.entries())
      .map(([id, pct]) => `W${id}:${pct.toFixed(0)}%`)
      .join(', ');
    console.log(`  [${progressStr}]`);
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // 检查是否所有工作线程都完成
  console.log('\n所有工作线程完成:', progressTracker.isAllWorkersComplete() ? '✓' : '✗');
}

async function exampleProgressMonitoring() {
  console.log('\n=== 进度监控示例 ===\n');
  
  const progressTracker = new ProgressTrackerService();
  
  // 初始化
  const totalRows = 500000;
  const workerCount = 4;
  progressTracker.initialize(totalRows, workerCount);
  
  const workerRowCounts = [125000, 125000, 125000, 125000];
  
  // 模拟实时进度监控
  console.log('开始处理...\n');
  
  for (let step = 0; step <= 20; step++) {
    const progress = step / 20;
    
    // 更新进度
    for (let workerId = 0; workerId < workerCount; workerId++) {
      const processed = Math.floor(workerRowCounts[workerId] * progress);
      progressTracker.updateProgress(workerId, processed, workerRowCounts[workerId]);
    }
    
    // 每 5 步显示详细信息
    if (step % 5 === 0) {
      const stats = progressTracker.getProgressStats();
      const status = progressTracker.getStatus();
      
      console.log(`\n--- 进度报告 (步骤 ${step}) ---`);
      console.log(`总体进度: ${stats.overallProgress.toFixed(1)}%`);
      console.log(`已处理: ${stats.totalProcessed.toLocaleString()}/${stats.totalRows.toLocaleString()} 行`);
      console.log(`完成的工作线程: ${stats.completedWorkers}/${stats.totalWorkers}`);
      console.log(`达成的里程碑: ${stats.reachedMilestones.join(', ')}%`);
      
      // 显示各工作线程详细进度
      const workerDetails = progressTracker.getWorkerProgressDetails();
      console.log('工作线程详情:');
      for (const detail of workerDetails) {
        console.log(
          `  Worker ${detail.workerId}: ${detail.processedRows.toLocaleString()}/${detail.totalRows.toLocaleString()} (${detail.percentage.toFixed(1)}%)`,
        );
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log('\n处理完成! ✓');
}

async function exampleGetSpecificWorkerProgress() {
  console.log('\n=== 查询特定工作线程进度示例 ===\n');
  
  const progressTracker = new ProgressTrackerService();
  
  // 初始化
  const totalRows = 400000;
  const workerCount = 4;
  progressTracker.initialize(totalRows, workerCount);
  
  const workerRowCounts = [100000, 100000, 100000, 100000];
  
  // 更新部分工作线程的进度
  progressTracker.updateProgress(0, 50000, workerRowCounts[0]);
  progressTracker.updateProgress(1, 75000, workerRowCounts[1]);
  progressTracker.updateProgress(2, 30000, workerRowCounts[2]);
  progressTracker.updateProgress(3, 90000, workerRowCounts[3]);
  
  // 查询特定工作线程的进度
  for (let workerId = 0; workerId < workerCount; workerId++) {
    const progress = progressTracker.getWorkerProgressById(workerId);
    console.log(`Worker ${workerId} 进度: ${progress.toFixed(1)}%`);
  }
  
  // 查询不存在的工作线程
  const invalidProgress = progressTracker.getWorkerProgressById(99);
  console.log(`Worker 99 进度: ${invalidProgress}% (不存在)`);
}

// 运行所有示例
if (require.main === module) {
  (async () => {
    await exampleBasicUsage();
    await exampleMilestones();
    await exampleUnbalancedProgress();
    await exampleProgressMonitoring();
    await exampleGetSpecificWorkerProgress();
  })().catch(console.error);
}
