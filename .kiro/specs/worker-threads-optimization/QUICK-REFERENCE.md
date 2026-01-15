# Worker Threads 优化快速参考

## 核心概念

**目标：** 100 万行数据处理时间从 150-240 秒降低到 45-60 秒

**方法：** 使用 4 个 Worker Threads 并行处理数据

**架构：** 主线程协调 + 4 个工作线程独立处理 25 万行

## 关键组件

| 组件 | 职责 | 文件位置 |
|-----|------|---------|
| ParallelProcessingManager | 主协调器 | `src/services/parallel/parallel-processing-manager.service.ts` |
| WorkerPool | 工作线程池管理 | `src/services/parallel/worker-pool.service.ts` |
| ChunkSplitter | 数据分块 | `src/services/parallel/chunk-splitter.service.ts` |
| DataCleaningWorker | 工作线程脚本 | `src/workers/data-cleaning.worker.ts` |
| ResultCollector | 结果聚合 | `src/services/parallel/result-collector.service.ts` |
| ProgressTracker | 进度跟踪 | `src/services/parallel/progress-tracker.service.ts` |
| PerformanceMonitor | 性能监控 | `src/services/parallel/performance-monitor.service.ts` |

## 配置参数

```bash
# 必需配置
ENABLE_PARALLEL_PROCESSING=true    # 启用并行处理
WORKER_COUNT=4                     # 工作线程数
PARALLEL_BATCH_SIZE=10000          # 批次大小

# 可选配置
MAX_MEMORY_MB=1800                 # 最大内存限制
WORKER_TIMEOUT_MS=300000           # 工作线程超时（5分钟）
MIN_RECORDS_FOR_PARALLEL=1000      # 启用并行的最小行数
DB_CONNECTION_LIMIT=20             # 数据库连接池大小

# 性能监控配置
ENABLE_PERFORMANCE_MONITORING=true # 启用性能监控
PERFORMANCE_SAMPLE_INTERVAL_MS=1000 # 性能采样间隔（1秒）
```

## 数据流

```
CSV 文件 (100万行)
    ↓
主线程：计算总行数并分块
    ↓
┌─────────┬─────────┬─────────┬─────────┐
│Worker 1 │Worker 2 │Worker 3 │Worker 4 │
│ 0-250k  │250k-500k│500k-750k│750k-1M  │
└────┬────┴────┬────┴────┬────┴────┬────┘
     │         │         │         │
     └─────────┴─────────┴─────────┘
                  ↓
          结果聚合 + 验证
                  ↓
          返回最终结果 (45-60秒)
```

## 关键优化点

### 1. 数据块分割
```typescript
// 均衡分配，确保差异 ≤ 1 行
const chunkSize = Math.floor(totalRows / workerCount);
const remainder = totalRows % workerCount;
// 将余数分配给前几个工作线程
```

### 2. 批量插入
```typescript
// 使用大批次 + 原生 SQL
const BATCH_SIZE = 10000;
await queryRunner.query(
  `INSERT INTO clean_data (...) VALUES ${values}`
);
```

### 3. 流式读取
```typescript
// 避免内存溢出
fs.createReadStream(filePath)
  .pipe(csv())
  .on('data', processRow);
```

### 4. 预编译正则
```typescript
// 在 Worker 初始化时预编译
private readonly phoneRegex = /^1[3-9]\d{9}$/;
```

## 性能指标

| 指标 | 目标值 | 验证方法 |
|-----|-------|---------|
| 处理时间 | < 60 秒 | 性能测试 |
| CPU 利用率 | > 80% | `top` 命令 / 性能监控 API |
| 内存使用 | < 2GB | `process.memoryUsage()` / 性能监控 API |
| 加速比 | > 2x | 对比顺序处理 |
| 数据完整性 | 100% | 属性测试 |
| 吞吐量 | > 16k 行/秒 | 性能监控 API |

## 性能监控 API

```bash
# 获取实时性能指标
GET /api/data-cleaning/metrics/:jobId

# 响应示例
{
  "jobId": "xxx",
  "timestamp": "2025-01-15T10:30:00Z",
  "metrics": {
    "cpu": {
      "overall": "92.5%",
      "perCore": ["95%", "90%", "93%", "92%"],
      "user": "85%",
      "system": "7.5%"
    },
    "memory": {
      "heapUsed": "1520.50 MB",
      "heapTotal": "1800.00 MB",
      "rss": "1650.25 MB",
      "usage": "84.5%"
    },
    "throughput": "19230 rows/sec",
    "workers": [
      {
        "id": 1,
        "cpu": "23%",
        "memory": "380 MB",
        "processed": 248500,
        "throughput": "4800 rows/sec",
        "status": "running"
      },
      // ... 其他工作线程
    ]
  }
}

# 获取性能报告
GET /api/data-cleaning/report/:jobId

# 响应示例
{
  "jobId": "xxx",
  "summary": {
    "duration": "52.5s",
    "totalRows": "1,000,000",
    "avgThroughput": "19048 rows/sec",
    "peakThroughput": "21500 rows/sec"
  },
  "cpu": {
    "average": "89.5%",
    "peak": "95.2%",
    "utilization": "89.5%"
  },
  "memory": {
    "average": "1450.25 MB",
    "peak": "1620.80 MB",
    "utilization": "84.2%"
  },
  "workers": [
    {
      "id": 1,
      "processed": "248,500",
      "avgCpu": "22.5%",
      "peakCpu": "28.3%",
      "avgMemory": "362.5 MB",
      "peakMemory": "405.2 MB",
      "avgThroughput": "4733 rows/sec",
      "duration": "52.5s"
    },
    // ... 其他工作线程
  ],
  "timeline": [
    {
      "timestamp": 1705315800000,
      "cpuUsage": 85.2,
      "memoryUsage": 1420.5,
      "processedRows": 50000,
      "throughput": 18500
    },
    // ... 更多时间点数据
  ]
}

# 获取进度
GET /api/data-cleaning/progress/:jobId

# 响应示例
{
  "jobId": "xxx",
  "progress": 65.5,
  "processedRows": 655000,
  "totalRows": 1000000,
  "estimatedTimeRemaining": "18s"
}
```

## 测试命令

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行属性测试
npm run test:property

# 运行性能测试
npm run test:performance
```

## 故障排除速查

| 问题 | 可能原因 | 解决方案 |
|-----|---------|---------|
| 性能未达标 | 数据库连接池小 | 增加到 20+ |
| 内存溢出 | 批次太大 | 减少批次大小 |
| 工作线程超时 | 数据库慢 | 优化数据库配置 |
| 数据不一致 | 行范围重叠 | 检查分块逻辑 |
| 连接耗尽 | 工作线程太多 | 减少工作线程数 |

## 部署检查清单

- [ ] 所有测试通过
- [ ] 性能测试达标（< 60 秒）
- [ ] 环境变量已配置
- [ ] 数据库连接池已增加
- [ ] 回滚计划已准备
- [ ] 监控已配置

## 监控指标

关键监控点：
- 处理时间趋势
- CPU 使用率（总体和每核心）
- 内存使用趋势（堆内存、RSS）
- 工作线程失败率
- 数据库连接数
- 错误率
- 吞吐量（实时和平均）
- 每个工作线程的资源使用

### 实时监控命令

```bash
# 查看实时性能指标
curl http://localhost:3000/api/data-cleaning/metrics/:jobId | jq

# 查看进度
curl http://localhost:3000/api/data-cleaning/progress/:jobId | jq

# 查看系统资源
top -p $(pgrep -f "node.*data-cleaning")

# 查看内存使用
ps aux | grep node | grep data-cleaning

# 查看数据库连接
mysql -e "SHOW PROCESSLIST;"
```

## 快速启用/禁用

```bash
# 启用并行处理
export ENABLE_PARALLEL_PROCESSING=true

# 禁用并行处理（回滚）
export ENABLE_PARALLEL_PROCESSING=false
```

## 联系和支持

- 需求文档：`.kiro/specs/worker-threads-optimization/requirements.md`
- 设计文档：`.kiro/specs/worker-threads-optimization/design.md`
- 任务列表：`.kiro/specs/worker-threads-optimization/tasks.md`
- 实施指南：`.kiro/specs/worker-threads-optimization/IMPLEMENTATION-GUIDE.md`
