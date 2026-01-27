/**
 * Worker Threads 配置使用示例
 * 
 * 演示如何使用配置管理功能
 */

import {
    getWorkerThreadsConfig,
    getConfigSummary,
    shouldUseParallelProcessing,
    getRecommendedWorkerCount,
    workerThreadsConfig,
} from './worker-threads.config';

/**
 * 示例 1: 获取配置
 */
function exampleGetConfig() {
    console.log('=== 示例 1: 获取配置 ===\n');

    // 方式 1: 调用函数获取配置（每次都会重新读取环境变量）
    const config1 = getWorkerThreadsConfig();
    console.log('方式 1 - 调用函数:');
    console.log(`  并行处理: ${config1.enableParallelProcessing}`);
    console.log(`  工作线程数: ${config1.workerCount}`);
    console.log(`  批处理大小: ${config1.parallelBatchSize}`);
    console.log();

    // 方式 2: 使用导出的实例（在模块加载时初始化一次）
    console.log('方式 2 - 使用导出实例:');
    console.log(`  并行处理: ${workerThreadsConfig.enableParallelProcessing}`);
    console.log(`  工作线程数: ${workerThreadsConfig.workerCount}`);
    console.log(`  批处理大小: ${workerThreadsConfig.parallelBatchSize}`);
    console.log();

    console.log('推荐: 在大多数情况下使用导出的实例 workerThreadsConfig\n');
}

/**
 * 示例 2: 打印配置摘要
 */
function exampleConfigSummary() {
    console.log('=== 示例 2: 配置摘要 ===\n');

    const config = workerThreadsConfig;
    const summary = getConfigSummary(config);

    console.log('使用 getConfigSummary() 打印配置:');
    console.log(summary);
    console.log();

    console.log('用途: 在应用启动时记录配置信息\n');
}

/**
 * 示例 3: 决定是否使用并行处理
 */
function exampleShouldUseParallel() {
    console.log('=== 示例 3: 决定是否使用并行处理 ===\n');

    const config = workerThreadsConfig;

    // 测试不同的记录数
    const testCases = [
        { records: 100, description: '小文件' },
        { records: 500, description: '中小文件' },
        { records: 1000, description: '达到阈值' },
        { records: 10000, description: '中等文件' },
        { records: 100000, description: '大文件' },
        { records: 1000000, description: '超大文件' },
    ];

    console.log('根据记录数决定处理方式:');
    testCases.forEach(({ records, description }) => {
        const useParallel = shouldUseParallelProcessing(config, records);
        const method = useParallel ? '并行处理' : '顺序处理';
        console.log(`  ${records.toLocaleString()} 行 (${description}): ${method}`);
    });
    console.log();

    console.log('示例代码:');
    console.log('  const recordCount = await countRecords(filePath);');
    console.log('  if (shouldUseParallelProcessing(config, recordCount)) {');
    console.log('    // 使用并行处理');
    console.log('    await parallelProcessingManager.processFile(...);');
    console.log('  } else {');
    console.log('    // 使用顺序处理');
    console.log('    await sequentialProcessor.processFile(...);');
    console.log('  }');
    console.log();
}

/**
 * 示例 4: 获取推荐的工作线程数
 */
function exampleRecommendedWorkerCount() {
    console.log('=== 示例 4: 获取推荐的工作线程数 ===\n');

    const config = workerThreadsConfig;

    // 测试不同的记录数
    const testCases = [
        { records: 5000, description: '小文件' },
        { records: 50000, description: '中等文件' },
        { records: 500000, description: '大文件' },
        { records: 5000000, description: '超大文件' },
    ];

    console.log('根据记录数推荐工作线程数:');
    testCases.forEach(({ records, description }) => {
        const workerCount = getRecommendedWorkerCount(config, records);
        console.log(`  ${records.toLocaleString()} 行 (${description}): ${workerCount} 个工作线程`);
    });
    console.log();

    console.log('说明:');
    console.log('  - < 10,000 行: 使用 2 个工作线程（减少开销）');
    console.log('  - < 100,000 行: 使用 4 个工作线程');
    console.log('  - >= 100,000 行: 使用配置的工作线程数');
    console.log();

    console.log('示例代码:');
    console.log('  const recordCount = await countRecords(filePath);');
    console.log('  const workerCount = getRecommendedWorkerCount(config, recordCount);');
    console.log('  await parallelProcessingManager.processFile(filePath, {');
    console.log('    workerCount,');
    console.log('    batchSize: config.parallelBatchSize,');
    console.log('    // ... 其他配置');
    console.log('  });');
    console.log();
}

/**
 * 示例 5: 环境变量配置
 */
function exampleEnvironmentVariables() {
    console.log('=== 示例 5: 环境变量配置 ===\n');

    console.log('支持的环境变量:');
    console.log();

    console.log('1. ENABLE_PARALLEL_PROCESSING (布尔值)');
    console.log('   - 默认: true');
    console.log('   - 说明: 是否启用并行处理');
    console.log('   - 示例: ENABLE_PARALLEL_PROCESSING=false');
    console.log();

    console.log('2. WORKER_COUNT (数字)');
    console.log('   - 默认: 4');
    console.log('   - 范围: 1-32');
    console.log('   - 说明: 工作线程数量');
    console.log('   - 示例: WORKER_COUNT=8');
    console.log();

    console.log('3. PARALLEL_BATCH_SIZE (数字)');
    console.log('   - 默认: 10000');
    console.log('   - 范围: 100-100000');
    console.log('   - 说明: 每批处理的记录数');
    console.log('   - 示例: PARALLEL_BATCH_SIZE=5000');
    console.log();

    console.log('4. MAX_MEMORY_MB (数字)');
    console.log('   - 默认: 1800');
    console.log('   - 范围: 512-8192');
    console.log('   - 说明: 最大内存使用（MB）');
    console.log('   - 示例: MAX_MEMORY_MB=2048');
    console.log();

    console.log('5. WORKER_TIMEOUT_MS (数字)');
    console.log('   - 默认: 300000 (5分钟)');
    console.log('   - 范围: 10000-3600000');
    console.log('   - 说明: 工作线程超时时间（毫秒）');
    console.log('   - 示例: WORKER_TIMEOUT_MS=600000');
    console.log();

    console.log('6. MIN_RECORDS_FOR_PARALLEL (数字)');
    console.log('   - 默认: 1000');
    console.log('   - 范围: >= 100');
    console.log('   - 说明: 使用并行处理的最小记录数');
    console.log('   - 示例: MIN_RECORDS_FOR_PARALLEL=2000');
    console.log();

    console.log('7. ENABLE_PROGRESS_TRACKING (布尔值)');
    console.log('   - 默认: true');
    console.log('   - 说明: 是否启用进度跟踪');
    console.log('   - 示例: ENABLE_PROGRESS_TRACKING=false');
    console.log();

    console.log('8. ENABLE_PERFORMANCE_MONITORING (布尔值)');
    console.log('   - 默认: true');
    console.log('   - 说明: 是否启用性能监控');
    console.log('   - 示例: ENABLE_PERFORMANCE_MONITORING=false');
    console.log();

    console.log('9. PROGRESS_UPDATE_INTERVAL_MS (数字)');
    console.log('   - 默认: 1000');
    console.log('   - 范围: >= 100');
    console.log('   - 说明: 进度更新间隔（毫秒）');
    console.log('   - 示例: PROGRESS_UPDATE_INTERVAL_MS=2000');
    console.log();

    console.log('10. PERFORMANCE_SAMPLE_INTERVAL_MS (数字)');
    console.log('   - 默认: 1000');
    console.log('   - 范围: >= 100');
    console.log('   - 说明: 性能采样间隔（毫秒）');
    console.log('   - 示例: PERFORMANCE_SAMPLE_INTERVAL_MS=500');
    console.log();
}

/**
 * 示例 6: 配置验证
 */
function exampleConfigValidation() {
    console.log('=== 示例 6: 配置验证 ===\n');

    console.log('配置会自动验证，无效配置会抛出错误:');
    console.log();

    console.log('验证规则:');
    console.log('  1. WORKER_COUNT: 1 <= 值 <= 32');
    console.log('  2. PARALLEL_BATCH_SIZE: 100 <= 值 <= 100000');
    console.log('  3. MAX_MEMORY_MB: 512 <= 值 <= 8192');
    console.log('  4. WORKER_TIMEOUT_MS: 10000 <= 值 <= 3600000');
    console.log('  5. MIN_RECORDS_FOR_PARALLEL: 值 >= 100');
    console.log('  6. PROGRESS_UPDATE_INTERVAL_MS: 值 >= 100');
    console.log('  7. PERFORMANCE_SAMPLE_INTERVAL_MS: 值 >= 100');
    console.log();

    console.log('错误示例:');
    console.log('  WORKER_COUNT=0  → 错误: WORKER_COUNT 必须 >= 1');
    console.log('  PARALLEL_BATCH_SIZE=50  → 错误: PARALLEL_BATCH_SIZE 必须 >= 100');
    console.log('  MAX_MEMORY_MB=256  → 错误: MAX_MEMORY_MB 必须 >= 512');
    console.log();

    console.log('处理验证错误:');
    console.log('  try {');
    console.log('    const config = getWorkerThreadsConfig();');
    console.log('  } catch (error) {');
    console.log('    console.error("配置无效:", error.message);');
    console.log('    // 使用默认配置或退出');
    console.log('  }');
    console.log();
}

/**
 * 示例 7: 实际使用场景
 */
function exampleRealWorldUsage() {
    console.log('=== 示例 7: 实际使用场景 ===\n');

    console.log('场景 1: 在服务启动时记录配置');
    console.log('  // main.ts');
    console.log('  import { workerThreadsConfig, getConfigSummary } from "./config/worker-threads.config";');
    console.log('  ');
    console.log('  async function bootstrap() {');
    console.log('    const app = await NestFactory.create(AppModule);');
    console.log('    ');
    console.log('    // 记录配置');
    console.log('    console.log(getConfigSummary(workerThreadsConfig));');
    console.log('    ');
    console.log('    await app.listen(3000);');
    console.log('  }');
    console.log();

    console.log('场景 2: 在数据清洗服务中使用');
    console.log('  // data-cleaner.service.ts');
    console.log('  import { workerThreadsConfig, shouldUseParallelProcessing } from "../config/worker-threads.config";');
    console.log('  ');
    console.log('  async processFile(filePath: string) {');
    console.log('    const recordCount = await this.countRecords(filePath);');
    console.log('    ');
    console.log('    if (shouldUseParallelProcessing(workerThreadsConfig, recordCount)) {');
    console.log('      return this.parallelProcessingManager.processFile(filePath, {');
    console.log('        workerCount: workerThreadsConfig.workerCount,');
    console.log('        batchSize: workerThreadsConfig.parallelBatchSize,');
    console.log('        timeoutMs: workerThreadsConfig.workerTimeoutMs,');
    console.log('        enableProgressTracking: workerThreadsConfig.enableProgressTracking,');
    console.log('        enablePerformanceMonitoring: workerThreadsConfig.enablePerformanceMonitoring,');
    console.log('      });');
    console.log('    } else {');
    console.log('      return this.sequentialProcessor.processFile(filePath);');
    console.log('    }');
    console.log('  }');
    console.log();

    console.log('场景 3: 动态调整工作线程数');
    console.log('  // parallel-processing-manager.service.ts');
    console.log('  import { workerThreadsConfig, getRecommendedWorkerCount } from "../config/worker-threads.config";');
    console.log('  ');
    console.log('  async processFile(filePath: string, recordCount: number) {');
    console.log('    // 根据文件大小动态调整工作线程数');
    console.log('    const workerCount = getRecommendedWorkerCount(workerThreadsConfig, recordCount);');
    console.log('    ');
    console.log('    await this.workerPool.initialize(workerCount);');
    console.log('    // ... 继续处理');
    console.log('  }');
    console.log();
}

// 运行所有示例
function runAllExamples() {
    console.log('Worker Threads 配置管理使用示例\n');
    console.log('='.repeat(60));
    console.log();

    exampleGetConfig();
    exampleConfigSummary();
    exampleShouldUseParallel();
    exampleRecommendedWorkerCount();
    exampleEnvironmentVariables();
    exampleConfigValidation();
    exampleRealWorldUsage();

    console.log('='.repeat(60));
    console.log('\n所有示例演示完成！');
}

// 如果直接运行此文件，执行示例
if (require.main === module) {
    runAllExamples();
}

export {
    exampleGetConfig,
    exampleConfigSummary,
    exampleShouldUseParallel,
    exampleRecommendedWorkerCount,
    exampleEnvironmentVariables,
    exampleConfigValidation,
    exampleRealWorldUsage,
};
