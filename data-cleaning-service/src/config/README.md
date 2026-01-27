# 配置管理

本目录包含应用程序的配置管理模块。

## 文件说明

### worker-threads.config.ts

Worker Threads 并行处理的配置管理模块。

**功能：**
- 从环境变量读取配置
- 提供合理的默认值
- 验证配置有效性
- 提供辅助函数用于配置决策

**主要导出：**

```typescript
// 获取配置（每次调用都会重新读取环境变量）
export function getWorkerThreadsConfig(): WorkerThreadsConfig

// 获取配置摘要（用于日志）
export function getConfigSummary(config: WorkerThreadsConfig): string

// 判断是否应该使用并行处理
export function shouldUseParallelProcessing(
  config: WorkerThreadsConfig,
  recordCount: number
): boolean

// 获取推荐的工作线程数
export function getRecommendedWorkerCount(
  config: WorkerThreadsConfig,
  recordCount: number
): number

// 导出的配置实例（在模块加载时初始化）
export const workerThreadsConfig: WorkerThreadsConfig
```

## 环境变量

### 并行处理设置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `ENABLE_PARALLEL_PROCESSING` | boolean | `true` | 是否启用并行处理 |
| `WORKER_COUNT` | number | `4` | 工作线程数量（1-32） |
| `PARALLEL_BATCH_SIZE` | number | `10000` | 每批处理的记录数（100-100000） |

### 资源限制

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `MAX_MEMORY_MB` | number | `1800` | 最大内存使用（512-8192 MB） |
| `WORKER_TIMEOUT_MS` | number | `300000` | 工作线程超时时间（10000-3600000 ms） |

### 性能调优

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `MIN_RECORDS_FOR_PARALLEL` | number | `1000` | 使用并行处理的最小记录数（>= 100） |
| `CHUNK_OVERLAP_ROWS` | number | `0` | 数据块重叠行数 |

### 监控设置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `ENABLE_PROGRESS_TRACKING` | boolean | `true` | 是否启用进度跟踪 |
| `PROGRESS_UPDATE_INTERVAL_MS` | number | `1000` | 进度更新间隔（>= 100 ms） |
| `ENABLE_PERFORMANCE_MONITORING` | boolean | `true` | 是否启用性能监控 |
| `PERFORMANCE_SAMPLE_INTERVAL_MS` | number | `1000` | 性能采样间隔（>= 100 ms） |

## 使用示例

### 基本使用

```typescript
import { workerThreadsConfig } from './config/worker-threads.config';

// 使用配置
console.log(`工作线程数: ${workerThreadsConfig.workerCount}`);
console.log(`批处理大小: ${workerThreadsConfig.parallelBatchSize}`);
```

### 判断是否使用并行处理

```typescript
import { 
  workerThreadsConfig, 
  shouldUseParallelProcessing 
} from './config/worker-threads.config';

async function processFile(filePath: string) {
  const recordCount = await countRecords(filePath);
  
  if (shouldUseParallelProcessing(workerThreadsConfig, recordCount)) {
    // 使用并行处理
    return await parallelProcessor.process(filePath);
  } else {
    // 使用顺序处理
    return await sequentialProcessor.process(filePath);
  }
}
```

### 动态调整工作线程数

```typescript
import { 
  workerThreadsConfig, 
  getRecommendedWorkerCount 
} from './config/worker-threads.config';

async function processLargeFile(filePath: string, recordCount: number) {
  // 根据文件大小获取推荐的工作线程数
  const workerCount = getRecommendedWorkerCount(
    workerThreadsConfig, 
    recordCount
  );
  
  await parallelProcessor.process(filePath, { workerCount });
}
```

### 打印配置摘要

```typescript
import { 
  workerThreadsConfig, 
  getConfigSummary 
} from './config/worker-threads.config';

// 在应用启动时记录配置
console.log(getConfigSummary(workerThreadsConfig));
```

## 配置验证

配置会在加载时自动验证。如果配置无效，会抛出详细的错误信息：

```typescript
try {
  const config = getWorkerThreadsConfig();
} catch (error) {
  console.error('配置验证失败:', error.message);
  // 错误消息示例:
  // Worker Threads 配置验证失败:
  //   - WORKER_COUNT 必须 >= 1
  //   - PARALLEL_BATCH_SIZE 必须 >= 100
}
```

## 配置建议

### 开发环境

```bash
# .env.development
ENABLE_PARALLEL_PROCESSING=true
WORKER_COUNT=2
PARALLEL_BATCH_SIZE=5000
MAX_MEMORY_MB=1024
ENABLE_PERFORMANCE_MONITORING=true
```

### 生产环境

```bash
# .env.production
ENABLE_PARALLEL_PROCESSING=true
WORKER_COUNT=4
PARALLEL_BATCH_SIZE=10000
MAX_MEMORY_MB=1800
WORKER_TIMEOUT_MS=300000
MIN_RECORDS_FOR_PARALLEL=1000
ENABLE_PROGRESS_TRACKING=true
ENABLE_PERFORMANCE_MONITORING=true
```

### 高性能环境（8核+）

```bash
# .env.production.high-performance
ENABLE_PARALLEL_PROCESSING=true
WORKER_COUNT=8
PARALLEL_BATCH_SIZE=20000
MAX_MEMORY_MB=4096
WORKER_TIMEOUT_MS=600000
```

### 低内存环境

```bash
# .env.production.low-memory
ENABLE_PARALLEL_PROCESSING=true
WORKER_COUNT=2
PARALLEL_BATCH_SIZE=5000
MAX_MEMORY_MB=1024
```

## 性能调优指南

### 工作线程数量

- **CPU 密集型任务**：设置为 CPU 核心数
- **I/O 密集型任务**：可以设置为 CPU 核心数的 1.5-2 倍
- **推荐范围**：2-8 个工作线程

### 批处理大小

- **小文件（< 10万行）**：5000-10000
- **中等文件（10-100万行）**：10000-20000
- **大文件（> 100万行）**：20000-50000

### 内存限制

- 根据可用内存设置
- 建议留出 20-30% 的内存余量
- 监控实际使用情况并调整

## 故障排除

### 问题：并行处理未启用

**检查：**
1. `ENABLE_PARALLEL_PROCESSING` 是否为 `true`
2. 文件记录数是否 >= `MIN_RECORDS_FOR_PARALLEL`

### 问题：内存使用过高

**解决方案：**
1. 降低 `WORKER_COUNT`
2. 降低 `PARALLEL_BATCH_SIZE`
3. 降低 `MAX_MEMORY_MB` 触发更早的资源控制

### 问题：处理速度慢

**解决方案：**
1. 增加 `WORKER_COUNT`（不超过 CPU 核心数）
2. 增加 `PARALLEL_BATCH_SIZE`
3. 检查数据库连接池大小

## 参考文档

- 需求文档: `.kiro/specs/worker-threads-optimization/requirements.md`
- 设计文档: `.kiro/specs/worker-threads-optimization/design.md`
- 使用示例: `worker-threads.config.example.ts`
