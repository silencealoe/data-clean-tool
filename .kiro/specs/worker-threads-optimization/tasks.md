# 任务列表：Worker Threads 并行处理优化

## 阶段 1: 基础设施搭建

### 1. 创建核心类型和接口
- [x] 1.1 创建 `src/services/parallel/types.ts` 定义所有接口和类型
  - 定义 `ProcessingConfig`, `ProcessingResult`, `WorkerTask`, `WorkerResult` 等接口
  - 定义消息类型：`MainToWorkerMessage`, `WorkerToMainMessage`
  - 定义配置类型：`WorkerThreadsConfig`

### 2. 实现 ChunkSplitter
- [x] 2.1 创建 `src/services/parallel/chunk-splitter.service.ts`
  - 实现 `splitFile()` 方法计算总行数
  - 实现均衡分割算法（确保工作线程间差异 ≤ 1 行）
  - 处理边界情况（文件行数 < 工作线程数）
- [ ] 2.2 为 ChunkSplitter 编写单元测试
  - 测试均衡分割（属性 2）
  - 测试边界情况
  - 测试各种行数和工作线程数组合

### 3. 实现 WorkerPool
- [x] 3.1 创建 `src/services/parallel/worker-pool.service.ts`
  - 实现 `initialize()` 创建工作线程
  - 实现 `executeTask()` 分配任务给工作线程
  - 实现 `getStatus()` 返回池状态
  - 实现 `terminate()` 优雅关闭工作线程
- [ ] 3.2 实现工作线程错误处理和重启逻辑
  - 捕获工作线程崩溃事件
  - 实现自动重启机制
  - 记录错误日志
- [ ] 3.3 为 WorkerPool 编写单元测试
  - 测试工作线程创建和终止
  - 测试任务分配
  - 测试错误恢复（属性 8）

### 4. 创建 DataCleaningWorker 脚本
- [x] 4.1 创建 `src/workers/data-cleaning.worker.ts`
  - 实现消息监听器（处理 START, TERMINATE 消息）
  - 实现 CSV 行范围读取逻辑
  - 集成现有的数据验证服务
- [x] 4.2 实现批量数据库操作
  - 实现批量插入清洗数据（批次大小 10000）
  - 实现批量插入错误日志
  - 使用数据库事务保证一致性
- [x] 4.3 实现进度报告
  - 定期发送 PROGRESS 消息到主线程
  - 包含已处理行数和百分比
- [ ] 4.4 为 Worker 编写集成测试
  - 测试 CSV 读取和验证
  - 测试批量插入
  - 测试进度报告

## 阶段 2: 核心处理逻辑

### 5. 实现 ResultCollector
- [ ] 5.1 创建 `src/services/parallel/result-collector.service.ts`
  - 实现 `addResult()` 收集工作线程结果
  - 实现 `isComplete()` 检查所有工作线程是否完成
  - 实现 `getFinalResult()` 聚合最终结果
  - 实现 `reset()` 重置收集器
- [ ] 5.2 实现数据完整性验证
  - 验证总记录数 = 成功数 + 错误数（属性 1）
  - 验证所有工作线程都已报告结果
- [ ] 5.3 为 ResultCollector 编写单元测试
  - 测试结果聚合
  - 测试数据完整性验证（属性 1）

### 6. 实现 ProgressTracker
- [ ] 6.1 创建 `src/services/parallel/progress-tracker.service.ts`
  - 实现 `updateProgress()` 更新工作线程进度
  - 实现 `getOverallProgress()` 计算总体进度
  - 实现 `getWorkerProgress()` 获取各工作线程进度
  - 实现 `reset()` 重置跟踪器
- [ ] 6.2 实现进度里程碑日志
  - 在 25%, 50%, 75%, 100% 时记录日志
- [ ] 6.3 为 ProgressTracker 编写单元测试
  - 测试进度聚合
  - 测试进度单调递增（属性 4）

### 7. 实现 PerformanceMonitor
- [ ] 7.1 创建 `src/services/parallel/performance-monitor.service.ts`
  - 实现 `startMonitoring()` 开始性能监控
  - 实现 `stopMonitoring()` 停止监控并生成报告
  - 实现 `getCurrentMetrics()` 获取实时指标
  - 实现 `recordWorkerMetrics()` 记录工作线程指标
- [ ] 7.2 实现 CPU 监控
  - 使用 `os.cpus()` 获取 CPU 信息
  - 使用 `process.cpuUsage()` 计算 CPU 使用率
  - 计算总体和每核心 CPU 使用率
  - 每秒采样一次
- [ ] 7.3 实现内存监控
  - 使用 `process.memoryUsage()` 获取内存信息
  - 计算堆内存、RSS、外部内存
  - 转换为 MB 单位
  - 计算内存使用百分比
  - 每秒采样一次
- [ ] 7.4 实现工作线程指标收集
  - 从工作线程接收性能数据
  - 聚合各工作线程指标
  - 计算每个工作线程的吞吐量
- [ ] 7.5 实现吞吐量计算
  - 计算实时吞吐量（行/秒）
  - 计算平均吞吐量
  - 记录峰值吞吐量
- [ ] 7.6 实现性能报告生成
  - 聚合所有性能数据
  - 计算平均值和峰值
  - 生成时间线数据
  - 格式化为 PerformanceReport
- [ ] 7.7 为 PerformanceMonitor 编写单元测试
  - 测试 CPU 监控
  - 测试内存监控
  - 测试吞吐量计算
  - 测试报告生成
### 8. 实现 ParallelProcessingManager
- [ ] 8.1 创建 `src/services/parallel/parallel-processing-manager.service.ts`
  - 实现 `processFile()` 主协调方法
  - 集成 ChunkSplitter, WorkerPool, ResultCollector, ProgressTracker, PerformanceMonitor
  - 实现工作线程任务分配逻辑
  - 实现超时处理（5 分钟）
- [ ] 8.2 实现错误处理
  - 处理工作线程失败场景
  - 收集部分结果
  - 生成详细错误报告
- [ ] 8.3 实现 `getProgress()` 方法
  - 返回当前处理进度
- [ ] 8.4 实现 `getPerformanceMetrics()` 方法
  - 返回当前性能指标
- [ ] 8.5 实现 `shutdown()` 方法
  - 优雅关闭所有工作线程
  - 停止性能监控
  - 清理资源
- [ ] 8.6 为 ParallelProcessingManager 编写集成测试
  - 测试端到端处理流程
  - 测试错误恢复（属性 8）
  - 测试超时处理
  - 测试性能监控集成

## 阶段 3: 资源管理和监控

### 9. 实现资源监控
- [ ] 9.1 创建 `src/services/parallel/resource-monitor.service.ts`
  - 实现内存使用监控
  - 实现 CPU 使用监控
  - 实现资源限制检查
- [ ] 9.2 集成资源监控到 ParallelProcessingManager
  - 在内存超限时暂停工作线程创建
  - 记录资源使用指标
- [ ] 9.3 为资源监控编写单元测试
  - 测试内存使用边界（属性 7）

### 10. 实现配置管理
### 10. 实现配置管理
- [-] 10.1 创建 `src/config/worker-threads.config.ts`
  - 定义配置接口
  - 从环境变量读取配置
  - 设置默认值
  - 实现配置验证
- [ ] 10.2 添加环境变量
  - `ENABLE_PARALLEL_PROCESSING` (默认: true)
  - `WORKER_COUNT` (默认: 4)
  - `PARALLEL_BATCH_SIZE` (默认: 10000)
  - `MAX_MEMORY_MB` (默认: 1800)
  - `WORKER_TIMEOUT_MS` (默认: 300000)
  - `MIN_RECORDS_FOR_PARALLEL` (默认: 1000)
  - `ENABLE_PERFORMANCE_MONITORING` (默认: true)
  - `PERFORMANCE_SAMPLE_INTERVAL_MS` (默认: 1000)
- [ ] 10.3 更新 `.env.example` 文件
  - 添加所有新配置项
  - 添加配置说明

## 阶段 4: 服务集成

### 11. 集成到 DataCleanerService
- [x] 11.1 修改 `src/services/data-cleaner.service.ts`
  - 注入 ParallelProcessingManager
  - 添加配置检查逻辑
  - 实现并行/顺序处理切换
- [x] 11.2 实现处理逻辑选择
  - 如果 `enableParallelProcessing == true` 且 `rowCount > minRecordsForParallel`，使用并行处理
  - 否则使用现有顺序处理
- [x] 11.3 保持 API 响应格式兼容
  - 确保并行处理返回相同格式的结果
  - 添加性能指标到响应（可选字段）
- [ ] 11.4 为集成编写测试
  - 测试配置切换
  - 测试向后兼容性（属性 10）

### 12. 更新 API 端点
- [x] 12.1 添加进度查询端点
  - `GET /api/data-cleaning/progress/:jobId`
  - 返回当前处理进度
- [x] 12.2 添加性能指标查询端点
  - `GET /api/data-cleaning/metrics/:jobId`
  - 返回实时性能指标（CPU、内存、吞吐量）
- [x] 12.3 添加性能报告端点
  - `GET /api/data-cleaning/report/:jobId`
  - 返回完整的性能报告
- [ ] 12.4 更新处理结果响应
  - 在响应中包含性能摘要
  - 添加 `performanceSummary` 字段
- [ ] 12.5 更新 Swagger 文档
  - 更新现有端点文档
  - 添加新端点文档
  - 添加性能指标数据结构说明
  - 添加配置说明

## 阶段 5: 测试

### 13. 单元测试
- [ ] 13.1 确保所有组件都有单元测试
  - ChunkSplitter
  - WorkerPool
  - ResultCollector
  - ProgressTracker
  - PerformanceMonitor
  - ParallelProcessingManager
  - ResourceMonitor
- [ ] 13.2 测试覆盖率 > 80%

### 14. 集成测试
- [ ] 14.1 编写端到端集成测试
  - 测试小文件（100 行）
  - 测试中等文件（10,000 行）
  - 测试大文件（100,000 行）
- [ ] 14.2 测试错误场景
  - 工作线程崩溃
  - 数据库连接失败
  - 超时场景
  - 无效 CSV 文件
- [ ] 14.3 测试性能监控
  - 验证 CPU 指标准确性
  - 验证内存指标准确性
  - 验证吞吐量计算
  - 验证性能报告生成

### 15. 属性测试
- [ ] 15.1 安装 fast-check 库
  - `npm install --save-dev fast-check @types/fast-check`
- [ ] 15.2 编写属性测试 - 数据完整性保持（属性 1）
  - 生成随机 CSV 文件
  - 验证 successCount + errorCount == totalInputRows
- [ ] 15.3 编写属性测试 - 数据块均衡分配（属性 2）
  - 生成随机行数和工作线程数
  - 验证数据块大小差异 ≤ 1
- [ ] 15.4 编写属性测试 - 验证规则一致性（属性 3）
  - 生成随机记录
  - 比较并行和顺序验证结果
- [ ] 15.5 编写属性测试 - 进度单调递增（属性 4）
  - 监控进度序列
  - 验证单调递增
- [ ] 15.6 编写属性测试 - 工作线程隔离性（属性 5）
  - 跟踪每个工作线程处理的行
  - 验证无重叠和遗漏
- [ ] 15.7 编写属性测试 - 性能提升保证（属性 6）
  - 测量并行和顺序处理时间
  - 验证加速比 > 2x
- [ ] 15.8 编写属性测试 - 内存使用边界（属性 7）
  - 监控内存使用
  - 验证不超过限制
- [ ] 15.9 编写属性测试 - 错误恢复能力（属性 8）
  - 模拟工作线程失败
  - 验证部分结果返回
- [ ] 15.10 编写属性测试 - 批处理一致性（属性 9）
  - 验证验证记录数 == 插入记录数
- [ ] 15.11 编写属性测试 - 配置向后兼容性（属性 10）
  - 比较并行禁用和原始实现

### 16. 性能测试
- [ ] 16.1 创建性能测试脚本
  - 生成 100 万行测试数据
  - 测量处理时间
  - 测量 CPU 和内存使用
  - 收集性能指标
- [ ] 16.2 运行基准测试
  - 顺序处理基准
  - 并行处理基准
  - 比较结果
- [ ] 16.3 验证性能目标
  - 处理时间 < 60 秒
  - CPU 利用率 > 80%
  - 内存使用 < 2GB
  - 加速比 > 2x
- [ ] 16.4 验证性能监控准确性
  - 对比实际 CPU 使用和监控数据
  - 对比实际内存使用和监控数据
  - 验证吞吐量计算准确性
- [ ] 16.5 性能优化（如需要）
  - 识别瓶颈
  - 优化关键路径
  - 调整配置参数

## 阶段 6: 文档和部署

### 17. 技术文档
- [ ] 17.1 编写架构文档
  - 系统架构图
  - 组件交互流程
  - 数据流图
- [ ] 17.2 编写 API 文档
  - 更新 Swagger/OpenAPI 规范
  - 添加使用示例
  - 文档化性能监控 API
- [ ] 17.3 编写配置指南
  - 所有配置项说明
  - 推荐配置
  - 性能调优建议
- [ ] 17.4 编写性能监控文档
  - 性能指标说明
  - 如何读取和解释指标
  - 性能优化建议

### 18. 运维文档
- [ ] 18.1 编写部署指南
  - 环境要求
  - 部署步骤
  - 配置检查清单
- [ ] 18.2 编写监控指南
  - 关键指标
  - 告警设置
  - 日志分析
  - 性能仪表板设置
- [ ] 18.3 编写故障排除指南
  - 常见问题
  - 诊断步骤
  - 解决方案
  - 性能问题诊断

### 19. 部署准备
- [ ] 19.1 创建数据库迁移脚本（如需要）
- [ ] 19.2 准备回滚计划
  - 回滚步骤
  - 数据恢复方案
- [ ] 19.3 进行部署演练
  - 在测试环境部署
  - 验证功能
  - 验证性能
  - 验证监控指标

## 验收标准

### 功能验收
- [ ] 所有单元测试通过
- [ ] 所有集成测试通过
- [ ] 所有属性测试通过
- [ ] API 保持向后兼容
- [ ] 配置可以启用/禁用并行处理
- [ ] 性能监控正常工作
- [ ] 性能指标 API 正常工作

### 性能验收
- [-] 100 万行文件处理时间 < 60 秒
- [ ] CPU 利用率 > 80%
- [ ] 内存使用 < 2GB
- [ ] 相比顺序处理加速 > 2x
- [ ] 性能监控数据准确（误差 < 5%）

### 质量验收
- [ ] 代码覆盖率 > 80%
- [ ] 无严重或高优先级 bug
- [ ] 文档完整且准确
- [ ] 通过代码审查
- [ ] 性能监控文档完整

## 注意事项

1. **数据库连接池：** 确保数据库连接池大小足够（建议 ≥ 20）
2. **内存管理：** 使用流式读取，避免一次性加载大文件
3. **错误处理：** 所有工作线程必须有全局错误处理
4. **测试数据：** 使用真实数据进行性能测试
5. **向后兼容：** 确保现有功能不受影响
6. **监控：** 添加足够的日志和指标以便诊断问题
