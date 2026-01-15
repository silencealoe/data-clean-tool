# Worker Threads 并行处理模块

本模块实现了基于 Node.js Worker Threads 的并行数据清洗功能。

## 目录结构

```
parallel/
├── types.ts                              # 核心类型定义 ✅
├── chunk-splitter.service.ts            # 数据分块服务 ✅
├── worker-pool.service.ts               # 工作线程池管理 ✅
├── result-collector.service.ts          # 结果收集器 ✅
├── progress-tracker.service.ts          # 进度跟踪器 ✅
├── performance-monitor.service.ts       # 性能监控器 ✅
├── parallel-processing-manager.service.ts # 并行处理管理器 ✅
├── resource-monitor.service.ts          # 资源监控器 (待实现)
└── index.ts                             # 模块导出 ✅

workers/
└── data-cleaning.worker.ts              # 数据清洗工作线程 ✅
```

## 已完成的任务

- ✅ **任务 1.1**: 创建核心类型和接口定义
- ✅ **任务 2.1**: 实现 ChunkSplitter 服务
- ✅ **任务 3.1**: 实现 WorkerPool 服务
- ✅ **任务 4.1**: 创建 DataCleaningWorker 脚本
- ✅ **任务 4.2**: 实现批量数据库操作
- ✅ **任务 4.3**: 实现进度报告
- ✅ **任务 5.1**: 实现 ResultCollector 服务
- ✅ **任务 6.1**: 实现 ProgressTracker 服务
- ✅ **任务 7.1**: 实现 PerformanceMonitor 服务
- ✅ **任务 8.1**: 实现 ParallelProcessingManager 服务

## 类型说明

### 配置类型
- `ProcessingConfig`: 并行处理配置
- `WorkerThreadsConfig`: 完整的 Worker Threads 配置

### 任务和结果类型
- `WorkerTask`: 工作线程任务定义
- `WorkerResult`: 工作线程执行结果
- `ProcessingResult`: 最终处理结果

### 消息类型
- `MainToWorkerMessage`: 主线程到工作线程的消息
- `WorkerToMainMessage`: 工作线程到主线程的消息

### 性能监控类型
- `PerformanceMetrics`: 实时性能指标
- `PerformanceReport`: 完整性能报告
- `CPUMetrics`: CPU 使用指标
- `MemoryMetrics`: 内存使用指标
- `WorkerMetrics`: 工作线程指标

## 组件说明

### 1. ChunkSplitter (数据分块服务)

将 CSV 文件均匀分割成多个数据块，分配给不同的工作线程处理。

**主要功能:**
- 计算 CSV 文件总行数
- 均衡分配数据块（确保工作线程间差异 ≤ 1 行）
- 处理边界情况（文件行数 < 工作线程数）

**使用示例:** 参见 `chunk-splitter.example.ts`

### 2. WorkerPool (工作线程池管理)

管理工作线程的生命周期，包括创建、任务分配、状态监控和终止。

**主要功能:**
- 创建和初始化工作线程
- 分配任务给空闲工作线程
- 监控工作线程状态
- 处理工作线程错误和重启
- 优雅关闭工作线程

**使用示例:** 参见 `worker-pool.example.ts`

### 3. ResultCollector (结果收集器)

收集和聚合来自所有工作线程的处理结果。

**主要功能:**
- 收集工作线程结果
- 聚合成功和错误计数
- 验证数据完整性（属性 1）
- 支持部分结果获取（错误恢复）
- 检测缺失的工作线程

**使用示例:** 参见 `result-collector.example.ts`

### 4. DataCleaningWorker (数据清洗工作线程)

在独立线程中执行数据清洗任务。

**主要功能:**
- 读取分配的 CSV 行范围
- 应用数据验证规则
- 批量插入清洗数据到数据库
- 报告进度更新
- 监控性能指标

**使用示例:** 参见 `../../workers/data-cleaning.worker.ts`

### 5. ProgressTracker (进度跟踪器)

跟踪所有工作线程的聚合进度，提供实时进度查询。

**主要功能:**
- 接收工作线程进度更新
- 计算总体进度百分比
- 记录进度里程碑（25%, 50%, 75%, 100%）
- 验证进度单调递增（属性 4）
- 提供各工作线程进度查询
- 生成进度统计报告

**使用示例:** 参见 `progress-tracker.example.ts`

### 6. PerformanceMonitor (性能监控器)

监控系统性能指标，包括 CPU、内存使用情况和吞吐量。

**主要功能:**
- 实时收集 CPU 使用率（总体、每核心、用户态、系统态）
- 实时收集内存使用情况（堆内存、RSS、使用百分比）
- 监控每个工作线程的资源使用
- 计算吞吐量和处理速度（实时、平均、峰值）
- 记录峰值指标（CPU、内存、吞吐量）
- 生成详细的性能报告和时间线数据
- 支持自定义采样间隔

**使用示例:** 参见 `performance-monitor.example.ts`

### 7. ParallelProcessingManager (并行处理管理器)

主协调器，管理整个并行处理流程，整合所有组件。

**主要功能:**
- 协调整个并行处理流程（5 个步骤）
- 集成 ChunkSplitter、WorkerPool、ResultCollector、ProgressTracker、PerformanceMonitor
- 文件分割和数据块分配
- 并行任务执行和监控
- 超时处理（默认 5 分钟）
- 错误处理和部分结果收集
- 资源清理和优雅关闭
- 实时进度和性能查询
- 完整的状态管理

**使用示例:** 参见 `parallel-processing-manager.example.ts`

## 核心处理流程

ParallelProcessingManager 的处理流程：

1. **步骤 1/5: 分割文件** - 使用 ChunkSplitter 将 CSV 文件分割成均衡的数据块
2. **步骤 2/5: 初始化组件** - 初始化工作线程池、结果收集器、进度跟踪器、性能监控器
3. **步骤 3/5: 创建任务** - 为每个数据块创建 WorkerTask
4. **步骤 4/5: 并行执行** - 使用 WorkerPool 并行执行所有任务，监控进度和性能
5. **步骤 5/5: 收集结果** - 聚合所有工作线程结果，生成性能报告

## 下一步

继续执行任务 10.1：实现配置管理

```bash
# 执行下一个任务
请执行任务 10.1
```

## 参考文档

- 需求文档: `.kiro/specs/worker-threads-optimization/requirements.md`
- 设计文档: `.kiro/specs/worker-threads-optimization/design.md`
- 实施指南: `.kiro/specs/worker-threads-optimization/IMPLEMENTATION-GUIDE.md`
