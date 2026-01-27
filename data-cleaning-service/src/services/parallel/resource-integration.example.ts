/**
 * ResourceMonitor 与 ParallelProcessingManager 集成示例
 * 
 * 演示资源监控如何在并行处理过程中工作
 */

import { ParallelProcessingManagerService } from './parallel-processing-manager.service';
import { ProcessingConfig } from './types';

async function exampleResourceMonitoringDuringProcessing() {
    console.log('=== 并行处理中的资源监控示例 ===\n');

    const manager = new ParallelProcessingManagerService();

    // 模拟处理配置
    const config: ProcessingConfig = {
        workerCount: 4,
        batchSize: 10000,
        timeoutMs: 300000,
        enableProgressTracking: true,
        enablePerformanceMonitoring: true,
        performanceSampleInterval: 1000,
    };

    console.log('配置:');
    console.log(`  工作线程数: ${config.workerCount}`);
    console.log(`  批处理大小: ${config.batchSize}`);
    console.log(`  超时时间: ${config.timeoutMs}ms`);
    console.log();

    // 注意：这只是演示集成，实际处理需要真实的 CSV 文件
    console.log('在实际处理中，ResourceMonitor 会：\n');

    console.log('1. 初始化阶段:');
    console.log('   - 配置资源限制（最大内存 1800MB，警告阈值 1500MB）');
    console.log('   - 启动资源监控（每秒检查一次）');
    console.log();

    console.log('2. 工作线程创建阶段:');
    console.log('   - 在创建每个工作线程前检查资源使用');
    console.log('   - 如果内存超过 1800MB（连续 3 次）：');
    console.log('     * 暂停工作线程创建');
    console.log('     * 等待内存释放（最多 30 秒）');
    console.log('     * 如果内存释放成功，继续创建');
    console.log('     * 如果超时，抛出错误');
    console.log('   - 记录每个工作线程创建前的资源状态');
    console.log();

    console.log('3. 处理过程中:');
    console.log('   - 持续监控内存和 CPU 使用');
    console.log('   - 记录资源使用警告');
    console.log('   - 可通过 getResourceUsage() 查询实时资源状态');
    console.log();

    console.log('4. 完成或失败时:');
    console.log('   - 自动停止资源监控');
    console.log('   - 清理所有资源');
    console.log();

    // 获取当前状态（演示）
    const status = manager.getStatus();
    console.log('当前管理器状态:');
    console.log(`  正在处理: ${status.isProcessing ? '是' : '否'}`);
    console.log(`  资源监控状态: ${status.resourceMonitorStatus.isMonitoring ? '运行中' : '未运行'}`);
    console.log(`  应暂停工作线程创建: ${status.resourceMonitorStatus.shouldPauseWorkerCreation ? '是' : '否'}`);
    console.log();

    await manager.shutdown();
}

async function exampleResourceLimitScenario() {
    console.log('\n=== 资源限制场景示例 ===\n');

    console.log('场景 1: 正常处理（内存充足）');
    console.log('  1. 开始处理 1M 行数据');
    console.log('  2. 创建 Worker 0: 内存 500MB < 1800MB ✓');
    console.log('  3. 创建 Worker 1: 内存 700MB < 1800MB ✓');
    console.log('  4. 创建 Worker 2: 内存 900MB < 1800MB ✓');
    console.log('  5. 创建 Worker 3: 内存 1100MB < 1800MB ✓');
    console.log('  6. 所有工作线程正常运行');
    console.log();

    console.log('场景 2: 内存接近限制（触发警告）');
    console.log('  1. 开始处理 1M 行数据');
    console.log('  2. 创建 Worker 0: 内存 1200MB < 1800MB ✓');
    console.log('  3. 创建 Worker 1: 内存 1550MB > 1500MB ⚠️ 警告');
    console.log('     → 记录警告：内存使用接近限制');
    console.log('  4. 创建 Worker 2: 内存 1650MB > 1500MB ⚠️ 警告');
    console.log('  5. 创建 Worker 3: 内存 1750MB < 1800MB ✓');
    console.log('  6. 所有工作线程正常运行（有警告）');
    console.log();

    console.log('场景 3: 内存超限（暂停创建）');
    console.log('  1. 开始处理 1M 行数据');
    console.log('  2. 创建 Worker 0: 内存 1400MB < 1800MB ✓');
    console.log('  3. 创建 Worker 1: 内存 1850MB > 1800MB ❌ 超限 (1/3)');
    console.log('  4. 等待 1 秒...');
    console.log('  5. 检查: 内存 1870MB > 1800MB ❌ 超限 (2/3)');
    console.log('  6. 等待 1 秒...');
    console.log('  7. 检查: 内存 1890MB > 1800MB ❌ 超限 (3/3)');
    console.log('  8. 触发暂停机制：');
    console.log('     → 记录错误：内存使用超限');
    console.log('     → 暂停创建 Worker 1');
    console.log('     → 等待内存释放（最多 30 秒）');
    console.log('  9. 等待中... 内存 1750MB < 1800MB ✓');
    console.log('  10. 内存已释放，继续创建 Worker 1');
    console.log('  11. 创建 Worker 2: 内存 1600MB < 1800MB ✓');
    console.log('  12. 创建 Worker 3: 内存 1700MB < 1800MB ✓');
    console.log('  13. 所有工作线程正常运行');
    console.log();

    console.log('场景 4: 内存持续超限（处理失败）');
    console.log('  1. 开始处理 1M 行数据');
    console.log('  2. 创建 Worker 0: 内存 1500MB < 1800MB ✓');
    console.log('  3. 创建 Worker 1: 内存 1900MB > 1800MB ❌ 超限');
    console.log('  4. 触发暂停机制，等待内存释放...');
    console.log('  5. 30 秒后: 内存仍然 1900MB > 1800MB ❌');
    console.log('  6. 等待超时，抛出错误：');
    console.log('     → "资源不足：内存使用持续超限，无法继续创建工作线程"');
    console.log('  7. 处理失败，清理已创建的工作线程');
    console.log();
}

async function exampleMonitoringAPI() {
    console.log('\n=== 资源监控 API 示例 ===\n');

    const manager = new ParallelProcessingManagerService();

    console.log('1. 获取完整状态（包含资源监控）:');
    console.log('   const status = manager.getStatus();');
    console.log('   console.log(status.resourceMonitorStatus);');
    console.log();

    console.log('2. 获取资源使用情况:');
    console.log('   const usage = manager.getResourceUsage();');
    console.log('   if (usage) {');
    console.log('     console.log(`内存: ${usage.memoryUsageMB}MB`);');
    console.log('     console.log(`CPU: ${usage.cpuUsage}%`);');
    console.log('     console.log(`超限: ${usage.isMemoryExceeded}`);');
    console.log('   }');
    console.log();

    console.log('3. 状态对象结构:');
    console.log('   {');
    console.log('     isProcessing: boolean,');
    console.log('     currentJobId: string,');
    console.log('     progress: number,');
    console.log('     workerPoolStatus: {...},');
    console.log('     resultCollectorStatus: {...},');
    console.log('     progressTrackerStatus: {...},');
    console.log('     performanceMonitorStatus: {...},');
    console.log('     resourceMonitorStatus: {');
    console.log('       isMonitoring: boolean,');
    console.log('       currentUsage: {');
    console.log('         memoryUsageMB: number,');
    console.log('         memoryUsagePercentage: number,');
    console.log('         cpuUsage: number,');
    console.log('         isMemoryExceeded: boolean,');
    console.log('         isCpuExceeded: boolean,');
    console.log('         timestamp: number');
    console.log('       },');
    console.log('       limits: {');
    console.log('         maxMemoryMB: number,');
    console.log('         maxCpuUsage: number,');
    console.log('         memoryWarningThresholdMB: number');
    console.log('       },');
    console.log('       shouldPauseWorkerCreation: boolean,');
    console.log('       warnings: string[]');
    console.log('     }');
    console.log('   }');
    console.log();

    await manager.shutdown();
}

// 运行示例
async function runExamples() {
    try {
        await exampleResourceMonitoringDuringProcessing();
        await exampleResourceLimitScenario();
        await exampleMonitoringAPI();

        console.log('所有示例演示完成！');
    } catch (error) {
        console.error('示例运行出错:', error);
    }
}

// 如果直接运行此文件，执行示例
if (require.main === module) {
    runExamples();
}

export {
    exampleResourceMonitoringDuringProcessing,
    exampleResourceLimitScenario,
    exampleMonitoringAPI,
};
