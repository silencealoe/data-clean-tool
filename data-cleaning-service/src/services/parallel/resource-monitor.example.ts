/**
 * ResourceMonitor 使用示例
 * 
 * 演示如何使用 ResourceMonitorService 监控系统资源使用情况
 */

import { ResourceMonitorService } from './resource-monitor.service';

async function exampleBasicUsage() {
    console.log('=== 基本使用示例 ===\n');

    const resourceMonitor = new ResourceMonitorService();

    // 1. 配置资源限制
    resourceMonitor.configureLimits({
        maxMemoryMB: 1800,
        maxCpuUsage: 95,
        memoryWarningThresholdMB: 1500,
    });

    // 2. 开始监控
    resourceMonitor.startMonitoring(1000); // 每秒检查一次

    // 3. 模拟一些工作
    console.log('开始模拟工作负载...\n');

    for (let i = 0; i < 5; i++) {
        // 检查资源使用情况
        const usage = resourceMonitor.checkResources();

        console.log(`检查 ${i + 1}:`);
        console.log(`  内存使用: ${usage.memoryUsageMB.toFixed(1)} MB (${usage.memoryUsagePercentage.toFixed(1)}%)`);
        console.log(`  CPU 使用: ${usage.cpuUsage.toFixed(1)}%`);
        console.log(`  内存超限: ${usage.isMemoryExceeded ? '是' : '否'}`);
        console.log(`  CPU 超限: ${usage.isCpuExceeded ? '是' : '否'}`);
        console.log();

        // 检查是否应该暂停工作线程创建
        if (resourceMonitor.shouldPauseWorkerCreation()) {
            console.log('⚠️  警告: 资源使用过高，应暂停工作线程创建\n');
        }

        // 等待 1 秒
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 4. 获取监控状态
    const status = resourceMonitor.getStatus();
    console.log('监控状态:');
    console.log(`  正在监控: ${status.isMonitoring ? '是' : '否'}`);
    console.log(`  应暂停工作线程创建: ${status.shouldPauseWorkerCreation ? '是' : '否'}`);
    console.log(`  警告数量: ${status.warnings.length}`);

    if (status.warnings.length > 0) {
        console.log('\n警告列表:');
        status.warnings.forEach((warning, index) => {
            console.log(`  ${index + 1}. ${warning}`);
        });
    }

    // 5. 停止监控
    resourceMonitor.stopMonitoring();

    console.log('\n监控已停止');
}

async function exampleWithMemoryPressure() {
    console.log('\n=== 内存压力测试示例 ===\n');

    const resourceMonitor = new ResourceMonitorService();

    // 配置较低的内存限制以便测试
    resourceMonitor.configureLimits({
        maxMemoryMB: 500, // 设置较低的限制
        memoryWarningThresholdMB: 400,
    });

    resourceMonitor.startMonitoring(500);

    // 创建一些内存压力
    const arrays: number[][] = [];

    console.log('创建内存压力...\n');

    for (let i = 0; i < 10; i++) {
        // 分配一些内存
        arrays.push(new Array(1000000).fill(Math.random()));

        const usage = resourceMonitor.checkResources();

        console.log(`迭代 ${i + 1}:`);
        console.log(`  内存使用: ${usage.memoryUsageMB.toFixed(1)} MB`);
        console.log(`  应暂停工作线程: ${resourceMonitor.shouldPauseWorkerCreation() ? '是' : '否'}`);

        if (resourceMonitor.shouldPauseWorkerCreation()) {
            console.log('  ⚠️  内存使用过高，停止分配\n');
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 清理内存
    arrays.length = 0;

    console.log('\n等待内存释放...');
    const released = await resourceMonitor.waitForMemoryRelease(10000);

    if (released) {
        console.log('✓ 内存已成功释放');
    } else {
        console.log('✗ 内存释放超时');
    }

    resourceMonitor.stopMonitoring();
}

async function exampleSystemInfo() {
    console.log('\n=== 系统信息示例 ===\n');

    const resourceMonitor = new ResourceMonitorService();

    const systemInfo = resourceMonitor.getSystemInfo();

    console.log('系统信息:');
    console.log(`  总内存: ${systemInfo.totalMemoryMB.toFixed(0)} MB`);
    console.log(`  可用内存: ${systemInfo.freeMemoryMB.toFixed(0)} MB`);
    console.log(`  CPU 核心数: ${systemInfo.cpuCount}`);
    console.log(`  平台: ${systemInfo.platform}`);
    console.log(`  Node.js 版本: ${systemInfo.nodeVersion}`);
}

async function exampleIntegrationWithWorkerPool() {
    console.log('\n=== 与 WorkerPool 集成示例 ===\n');

    const resourceMonitor = new ResourceMonitorService();

    // 配置资源限制
    resourceMonitor.configureLimits({
        maxMemoryMB: 1800,
        memoryWarningThresholdMB: 1500,
    });

    // 开始监控
    resourceMonitor.startMonitoring(1000);

    // 模拟工作线程创建流程
    const workerCount = 4;
    const createdWorkers: number[] = [];

    console.log(`尝试创建 ${workerCount} 个工作线程...\n`);

    for (let i = 0; i < workerCount; i++) {
        // 在创建工作线程前检查资源
        if (resourceMonitor.shouldPauseWorkerCreation()) {
            console.log(`⚠️  工作线程 ${i + 1}: 资源使用过高，暂停创建`);
            console.log('等待内存释放...\n');

            const released = await resourceMonitor.waitForMemoryRelease(30000);

            if (!released) {
                console.log('✗ 内存释放超时，停止创建工作线程\n');
                break;
            }

            console.log('✓ 内存已释放，继续创建\n');
        }

        // 创建工作线程（模拟）
        console.log(`✓ 工作线程 ${i + 1}: 已创建`);
        createdWorkers.push(i + 1);

        const usage = resourceMonitor.checkResources();
        console.log(`  当前内存使用: ${usage.memoryUsageMB.toFixed(1)} MB`);
        console.log();

        // 模拟工作线程初始化时间
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`总共创建了 ${createdWorkers.length} 个工作线程`);

    // 获取最终状态
    const status = resourceMonitor.getStatus();
    console.log('\n最终状态:');
    console.log(`  内存使用: ${status.currentUsage.memoryUsageMB.toFixed(1)} MB`);
    console.log(`  CPU 使用: ${status.currentUsage.cpuUsage.toFixed(1)}%`);
    console.log(`  警告数量: ${status.warnings.length}`);

    resourceMonitor.stopMonitoring();
}

// 运行示例
async function runExamples() {
    try {
        await exampleBasicUsage();
        await exampleSystemInfo();
        await exampleWithMemoryPressure();
        await exampleIntegrationWithWorkerPool();

        console.log('\n所有示例运行完成！');
    } catch (error) {
        console.error('示例运行出错:', error);
    }
}

// 如果直接运行此文件，执行示例
if (require.main === module) {
    runExamples();
}

export {
    exampleBasicUsage,
    exampleWithMemoryPressure,
    exampleSystemInfo,
    exampleIntegrationWithWorkerPool,
};
