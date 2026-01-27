/**
 * ResultCollector 使用示例
 * 
 * 演示如何使用 ResultCollectorService 收集和聚合工作线程结果
 */

import { ResultCollectorService } from './result-collector.service';
import { WorkerResult } from './types';

async function exampleUsage() {
  // 创建 ResultCollector 实例
  const resultCollector = new ResultCollectorService();
  
  // 初始化收集器
  const workerCount = 4;
  const totalRows = 1000000;
  resultCollector.initialize(workerCount, totalRows);
  
  console.log('ResultCollector 已初始化');
  console.log(`预期工作线程数: ${workerCount}`);
  console.log(`总行数: ${totalRows}`);
  console.log('---');
  
  // 模拟工作线程完成并报告结果
  const workerResults: WorkerResult[] = [
    {
      workerId: 0,
      successCount: 240000,
      errorCount: 10000,
      processingTimeMs: 12000,
    },
    {
      workerId: 1,
      successCount: 245000,
      errorCount: 5000,
      processingTimeMs: 11500,
    },
    {
      workerId: 2,
      successCount: 248000,
      errorCount: 2000,
      processingTimeMs: 11000,
    },
    {
      workerId: 3,
      successCount: 247000,
      errorCount: 3000,
      processingTimeMs: 11200,
    },
  ];
  
  // 添加工作线程结果
  for (const result of workerResults) {
    resultCollector.addResult(result);
    
    console.log(`工作线程 ${result.workerId} 完成:`);
    console.log(`  成功: ${result.successCount}`);
    console.log(`  错误: ${result.errorCount}`);
    console.log(`  耗时: ${result.processingTimeMs}ms`);
    console.log(`  已完成: ${resultCollector.getCompletedCount()}/${workerCount}`);
    console.log('---');
  }
  
  // 检查是否所有工作线程都已完成
  if (resultCollector.isComplete()) {
    console.log('✓ 所有工作线程已完成');
    
    // 获取最终结果
    const finalResult = resultCollector.getFinalResult();
    
    console.log('\n最终结果:');
    console.log(`  总记录数: ${finalResult.totalRecords}`);
    console.log(`  成功数: ${finalResult.successCount}`);
    console.log(`  错误数: ${finalResult.errorCount}`);
    console.log(`  总处理时间: ${finalResult.processingTimeMs}ms`);
    console.log(`  平均吞吐量: ${Math.round(finalResult.totalRecords / (finalResult.processingTimeMs / 1000))} 行/秒`);
    
    // 验证数据完整性
    const totalProcessed = finalResult.successCount + finalResult.errorCount;
    if (totalProcessed === finalResult.totalRecords) {
      console.log('\n✓ 数据完整性验证通过');
    } else {
      console.log('\n✗ 数据完整性验证失败');
      console.log(`  预期: ${finalResult.totalRecords}`);
      console.log(`  实际: ${totalProcessed}`);
      console.log(`  差异: ${Math.abs(totalProcessed - finalResult.totalRecords)}`);
    }
  } else {
    console.log('✗ 还有工作线程未完成');
    console.log(`  已完成: ${resultCollector.getCompletedCount()}/${workerCount}`);
    
    // 获取缺失的工作线程 ID
    const missingIds = resultCollector.getMissingWorkerIds();
    console.log(`  缺失的工作线程: ${missingIds.join(', ')}`);
  }
  
  // 获取状态
  console.log('\n当前状态:');
  const status = resultCollector.getStatus();
  console.log(JSON.stringify(status, null, 2));
  
  // 重置收集器
  resultCollector.reset();
  console.log('\nResultCollector 已重置');
}

async function examplePartialResult() {
  console.log('\n=== 部分结果示例 ===\n');
  
  const resultCollector = new ResultCollectorService();
  
  // 初始化收集器
  const workerCount = 4;
  const totalRows = 1000000;
  resultCollector.initialize(workerCount, totalRows);
  
  // 只有 2 个工作线程完成
  resultCollector.addResult({
    workerId: 0,
    successCount: 240000,
    errorCount: 10000,
    processingTimeMs: 12000,
  });
  
  resultCollector.addResult({
    workerId: 1,
    successCount: 245000,
    errorCount: 5000,
    processingTimeMs: 11500,
  });
  
  console.log(`已完成: ${resultCollector.getCompletedCount()}/${workerCount}`);
  console.log(`是否完成: ${resultCollector.isComplete()}`);
  
  // 获取部分结果（用于错误恢复）
  const partialResult = resultCollector.getPartialResult();
  
  console.log('\n部分结果:');
  console.log(`  总记录数: ${partialResult.totalRecords}`);
  console.log(`  成功数: ${partialResult.successCount}`);
  console.log(`  错误数: ${partialResult.errorCount}`);
  console.log(`  已处理: ${partialResult.successCount + partialResult.errorCount}`);
  console.log(`  完成度: ${((partialResult.successCount + partialResult.errorCount) / partialResult.totalRecords * 100).toFixed(2)}%`);
  
  // 获取缺失的工作线程
  const missingIds = resultCollector.getMissingWorkerIds();
  console.log(`\n缺失的工作线程: ${missingIds.join(', ')}`);
}

// 运行示例
if (require.main === module) {
  exampleUsage()
    .then(() => examplePartialResult())
    .catch(console.error);
}
