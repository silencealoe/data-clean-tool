# Worker Threads 配置指南

本文档详细说明了 Worker Threads 并行处理的所有配置选项。

## 配置概览

Worker Threads 并行处理通过环境变量进行配置。所有配置项都有合理的默认值，可以根据实际需求进行调整。

## 环境变量列表

### 1. ENABLE_PARALLEL_PROCESSING

**说明：** 是否启用并行处理

**类型：** Boolean (true/false)

**默认值：** `true`

**推荐值：**
- 生产环境：`true`
- 开发环境：`true`
- 测试环境：`false`（便于调试）

**示例：**
```bash
ENABLE_PARALLEL_PROCESSING=true
```

**注意事项：**
- 设置为 `false` 时，系统将使用传统的顺序处理方式
- 顺序处理更容易调试，但性能较低

---

### 2. WORKER_COUNT

**说明：** 工作线程数量

**类型：** Number

**默认值：** `4`

**推荐值：**
- 4 核 CPU：`4`
- 8 核 CPU：`6-8`
- 16 核 CPU：`8-12`

**有效范围：** 1-32（建议 2-8）

**示例：**
```bash
WORKER_COUNT=4
```

**注意事项：**
- 工作线程数应该接近 CPU 核心数
- 过多的工作线程会导致上下文切换开销
- 过少的工作线程无法充分利用 CPU

---

### 3. PARALLEL_BATCH_SIZE

**说明：** 每个工作线程一次性插入数据库的记录数

**类型：** Number

**默认值：** `10000`

**推荐值：**
- 小文件（< 10万行）：`5000`
- 中等文件（10-50万行）：`10000`
- 大文件（> 50万行）：`15000-20000`

**有效范围：** 100-100000

**示例：**
```bash
PARALLEL_BATCH_SIZE=10000
```

**注意事项：**
- 较大的批次可以提高数据库插入性能
- 但会增加内存使用和事务时间
- 需要根据数据库性能和内存大小调整

---

### 4. MAX_MEMORY_MB

**说明：** 系统总内存使用上限（MB）

**类型：** Number

**默认值：** `1800`

**推荐值：**
- 4GB 系统：`1200`
- 8GB 系统：`1800`
- 16GB 系统：`3600`
- 32GB 系统：`6400`

**有效范围：** 512-8192

**示例：**
```bash
MAX_MEMORY_MB=1800
```

**注意事项：**
- 建议设置为可用内存的 70-80%
- 超过此值时，系统会暂停创建新的工作线程
- 设置过低会影响性能，设置过高可能导致系统不稳定

---

### 5. WORKER_TIMEOUT_MS

**说明：** 单个工作线程的最大执行时间（毫秒）

**类型：** Number

**默认值：** `300000`（5 分钟）

**推荐值：**
- 小文件：`60000`（1 分钟）
- 中等文件：`180000`（3 分钟）
- 大文件：`300000`（5 分钟）
- 超大文件：`600000`（10 分钟）

**有效范围：** 10000-3600000（10秒-1小时）

**示例：**
```bash
WORKER_TIMEOUT_MS=300000
```

**注意事项：**
- 超时后工作线程将被强制终止
- 设置过短可能导致大文件处理失败
- 设置过长可能导致死锁无法及时发现

---

### 6. MIN_RECORDS_FOR_PARALLEL

**说明：** 最小并行处理记录数

**类型：** Number

**默认值：** `1000`

**推荐值：**
- 高性能服务器：`500`
- 普通服务器：`1000`
- 低配置服务器：`2000`

**有效范围：** >= 100

**示例：**
```bash
MIN_RECORDS_FOR_PARALLEL=1000
```

**注意事项：**
- 文件记录数小于此值时，系统会自动使用顺序处理
- 小文件使用并行处理反而会降低性能（线程创建开销）
- 根据服务器性能和文件特征调整

---

### 7. ENABLE_PROGRESS_TRACKING

**说明：** 是否启用进度跟踪

**类型：** Boolean (true/false)

**默认值：** `true`

**推荐值：**
- 生产环境：`true`
- 开发环境：`true`
- 性能测试：`false`（减少开销）

**示例：**
```bash
ENABLE_PROGRESS_TRACKING=true
```

**注意事项：**
- 启用后可以实时查询处理进度
- 会增加少量通信开销（< 1%）

---

### 8. PROGRESS_UPDATE_INTERVAL_MS

**说明：** 工作线程向主线程报告进度的频率（毫秒）

**类型：** Number

**默认值：** `1000`（1 秒）

**推荐值：**
- 实时监控：`500`
- 正常使用：`1000`
- 减少开销：`2000-5000`

**有效范围：** >= 100

**示例：**
```bash
PROGRESS_UPDATE_INTERVAL_MS=1000
```

**注意事项：**
- 较小的值提供更实时的进度，但会增加通信开销
- 较大的值减少开销，但进度更新不够及时

---

### 9. ENABLE_PERFORMANCE_MONITORING

**说明：** 是否启用性能监控

**类型：** Boolean (true/false)

**默认值：** `true`

**推荐值：**
- 生产环境：`true`
- 开发环境：`true`
- 性能测试：`true`

**示例：**
```bash
ENABLE_PERFORMANCE_MONITORING=true
```

**注意事项：**
- 启用后会收集 CPU、内存、吞吐量等性能指标
- 会增加少量性能开销（< 2%）
- 对于性能调优和问题诊断非常有用

---

### 10. PERFORMANCE_SAMPLE_INTERVAL_MS

**说明：** 性能指标采样频率（毫秒）

**类型：** Number

**默认值：** `1000`（1 秒）

**推荐值：**
- 详细监控：`500`
- 正常使用：`1000`
- 减少开销：`2000-5000`

**有效范围：** >= 100

**示例：**
```bash
PERFORMANCE_SAMPLE_INTERVAL_MS=1000
```

**注意事项：**
- 较小的值提供更精细的性能数据，但会增加开销
- 较大的值减少开销，但可能错过性能峰值

---

## 配置示例

### 开发环境配置

```bash
# 开发环境 - 平衡性能和调试便利性
ENABLE_PARALLEL_PROCESSING=true
WORKER_COUNT=2
PARALLEL_BATCH_SIZE=5000
MAX_MEMORY_MB=1200
WORKER_TIMEOUT_MS=180000
MIN_RECORDS_FOR_PARALLEL=1000
ENABLE_PROGRESS_TRACKING=true
PROGRESS_UPDATE_INTERVAL_MS=1000
ENABLE_PERFORMANCE_MONITORING=true
PERFORMANCE_SAMPLE_INTERVAL_MS=1000
```

### 生产环境配置（8GB 服务器）

```bash
# 生产环境 - 高性能配置
ENABLE_PARALLEL_PROCESSING=true
WORKER_COUNT=4
PARALLEL_BATCH_SIZE=10000
MAX_MEMORY_MB=1800
WORKER_TIMEOUT_MS=300000
MIN_RECORDS_FOR_PARALLEL=1000
ENABLE_PROGRESS_TRACKING=true
PROGRESS_UPDATE_INTERVAL_MS=2000
ENABLE_PERFORMANCE_MONITORING=true
PERFORMANCE_SAMPLE_INTERVAL_MS=2000
```

### 高性能服务器配置（16GB+）

```bash
# 高性能服务器 - 最大性能配置
ENABLE_PARALLEL_PROCESSING=true
WORKER_COUNT=8
PARALLEL_BATCH_SIZE=15000
MAX_MEMORY_MB=3600
WORKER_TIMEOUT_MS=300000
MIN_RECORDS_FOR_PARALLEL=500
ENABLE_PROGRESS_TRACKING=true
PROGRESS_UPDATE_INTERVAL_MS=2000
ENABLE_PERFORMANCE_MONITORING=true
PERFORMANCE_SAMPLE_INTERVAL_MS=2000
```

### 测试环境配置

```bash
# 测试环境 - 便于调试
ENABLE_PARALLEL_PROCESSING=false
WORKER_COUNT=2
PARALLEL_BATCH_SIZE=1000
MAX_MEMORY_MB=1200
WORKER_TIMEOUT_MS=60000
MIN_RECORDS_FOR_PARALLEL=1000
ENABLE_PROGRESS_TRACKING=true
PROGRESS_UPDATE_INTERVAL_MS=500
ENABLE_PERFORMANCE_MONITORING=true
PERFORMANCE_SAMPLE_INTERVAL_MS=500
```

---

## 性能调优建议

### 1. CPU 利用率低（< 50%）

**可能原因：**
- 工作线程数太少
- 批处理大小太小
- 数据库成为瓶颈

**解决方案：**
- 增加 `WORKER_COUNT`
- 增加 `PARALLEL_BATCH_SIZE`
- 优化数据库连接池大小

### 2. 内存使用过高

**可能原因：**
- 批处理大小太大
- 工作线程数太多
- 内存泄漏

**解决方案：**
- 减少 `PARALLEL_BATCH_SIZE`
- 减少 `WORKER_COUNT`
- 降低 `MAX_MEMORY_MB` 触发保护机制

### 3. 处理速度慢

**可能原因：**
- 工作线程数不足
- 批处理大小不合适
- 数据库性能瓶颈

**解决方案：**
- 调整 `WORKER_COUNT` 接近 CPU 核心数
- 调整 `PARALLEL_BATCH_SIZE` 到最优值（通常 10000-15000）
- 优化数据库索引和连接池

### 4. 工作线程超时

**可能原因：**
- 超时时间设置太短
- 数据库响应慢
- 文件太大

**解决方案：**
- 增加 `WORKER_TIMEOUT_MS`
- 优化数据库查询
- 增加 `WORKER_COUNT` 减少每个线程的负载

---

## 配置验证

使用以下命令验证配置是否正确：

```bash
cd data-cleaning-service
node -r ts-node/register test-env-config.ts
```

输出示例：

```
=== 环境变量测试 ===

1. 环境变量值：

  ✓ ENABLE_PARALLEL_PROCESSING = true
  ✓ WORKER_COUNT = 4
  ✓ PARALLEL_BATCH_SIZE = 10000
  ...

2. 加载配置对象：

=== Worker Threads 配置 ===
并行处理: 启用
工作线程数: 4
批处理大小: 10000
...

=== 测试完成 ===
```

---

## 故障排除

### 配置加载失败

**错误信息：** `Worker Threads 配置验证失败`

**解决方案：**
1. 检查 `.env` 文件是否存在
2. 检查环境变量值是否在有效范围内
3. 运行配置验证脚本查看详细错误

### 并行处理未启用

**可能原因：**
- `ENABLE_PARALLEL_PROCESSING=false`
- 文件记录数 < `MIN_RECORDS_FOR_PARALLEL`

**解决方案：**
1. 检查 `ENABLE_PARALLEL_PROCESSING` 设置
2. 检查文件大小是否满足最小阈值
3. 查看日志确认处理模式

### 性能不如预期

**排查步骤：**
1. 检查 CPU 利用率（应 > 80%）
2. 检查内存使用情况
3. 检查数据库连接池大小
4. 查看性能监控指标
5. 调整配置参数进行测试

---

## 相关文档

- [Worker Threads 架构设计](../.kiro/specs/worker-threads-optimization/design.md)
- [配置管理 README](../src/config/README.md)
- [性能优化指南](../docs/PERFORMANCE-TUNING.md)

---

## 更新日志

- 2024-01-16: 初始版本，包含所有 10 个配置项的详细说明
