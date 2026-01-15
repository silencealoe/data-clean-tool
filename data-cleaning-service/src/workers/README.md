# Worker Threads

本目录包含 Worker Thread 脚本，用于并行数据处理。

## 文件

### data-cleaning.worker.ts

数据清洗工作线程，在独立线程中执行数据清洗任务。

**功能：**
- 读取分配的 CSV 行范围
- 应用数据验证规则
- 批量插入清洗数据到数据库
- 记录错误到错误日志
- 报告进度和性能指标

**消息协议：**

主线程 → Worker:
- `START`: 开始处理任务
- `TERMINATE`: 终止 Worker

Worker → 主线程:
- `PROGRESS`: 进度更新
- `COMPLETE`: 任务完成
- `ERROR`: 错误报告
- `METRICS`: 性能指标

**性能监控：**
- CPU 使用率
- 内存使用
- 处理吞吐量
- 已处理行数

## 编译

Worker 文件需要编译为 JavaScript 才能运行：

```bash
# 编译 TypeScript
npm run build

# 编译后的文件位置
dist/workers/data-cleaning.worker.js
```

## 使用示例

```typescript
import { Worker } from 'worker_threads';

const worker = new Worker('./dist/workers/data-cleaning.worker.js');

// 发送任务
worker.postMessage({
  type: 'START',
  payload: {
    filePath: 'data.csv',
    startRow: 0,
    rowCount: 250000,
    batchSize: 10000,
    workerId: 0,
    jobId: 'job-123',
  },
});

// 监听消息
worker.on('message', (message) => {
  if (message.type === 'COMPLETE') {
    console.log('任务完成:', message.payload);
  }
});
```

## 注意事项

1. **数据库连接**: 每个 Worker 需要独立的数据库连接
2. **内存管理**: 使用批量处理避免内存溢出
3. **错误处理**: Worker 中的错误不会影响主线程
4. **性能监控**: 每秒采样一次性能指标
5. **优雅退出**: 响应 TERMINATE 消息正常退出

## 环境变量

Worker 使用以下环境变量连接数据库：

```bash
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=password
DB_DATABASE=data_cleaning
```

## 性能特点

- **并发处理**: 多个 Worker 同时处理不同数据块
- **内存隔离**: 每个 Worker 有独立的内存空间
- **批量操作**: 使用批量插入提高数据库性能
- **流式读取**: 避免一次性加载大文件

## 调试

启用 Worker 调试：

```bash
# 启用调试日志
NODE_OPTIONS='--inspect' npm run start:dev
```

## 已完成

- ✅ 消息监听器（START, TERMINATE）
- ✅ CSV 行范围读取
- ✅ 数据验证逻辑
- ✅ 批量数据库操作
- ✅ 进度报告
- ✅ 性能监控
- ✅ 错误处理

## 下一步

继续执行任务 4.2：实现批量数据库操作

```bash
请执行任务 4.2
```

注意：任务 4.2 的功能已经在 4.1 中实现了（batchInsertCleanData, batchInsertErrorLogs）
