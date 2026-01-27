# Worker Threads 并行处理实施指南

## 概述

本文档提供 Worker Threads 并行处理优化的详细实施指南，包括关键实现细节、优化建议和最佳实践。

## 目标

- **性能目标：** 将 100 万行数据处理时间从 150-240 秒降低到 45-60 秒
- **加速比：** 至少 250% 性能提升（2.5x 加速）
- **资源利用：** CPU 利用率从 25% 提升到 80-100%
- **数据完整性：** 保持 100% 数据准确性

## 核心架构

### 1. 主线程职责

主线程作为协调器，负责：
- 读取配置并决定是否使用并行处理
- 计算 CSV 文件总行数
- 将文件分割成均衡的数据块
- 创建和管理工作线程池
- 收集和聚合工作线程结果
- 跟踪整体进度
- 处理错误和超时

### 2. 工作线程职责

每个工作线程独立负责：
- 读取分配的 CSV 行范围
- 应用数据验证规则
- 批量插入清洗数据到数据库
- 记录错误到错误日志
- 定期报告进度
- 管理自身内存使用


## 关键实现细节

### 1. CSV 文件分块策略

**挑战：** 如何高效地将大型 CSV 文件分割给多个工作线程？

**解决方案：** 使用行索引范围分配

```typescript
// 示例：100 万行分配给 4 个工作线程
// Worker 1: 行 0-249,999
// Worker 2: 行 250,000-499,999
// Worker 3: 行 500,000-749,999
// Worker 4: 行 750,000-999,999

function calculateChunks(totalRows: number, workerCount: number): ChunkDescriptor[] {
  const baseChunkSize = Math.floor(totalRows / workerCount);
  const remainder = totalRows % workerCount;
  
  const chunks: ChunkDescriptor[] = [];
  let startRow = 0;
  
  for (let i = 0; i < workerCount; i++) {
    // 将余数分配给前几个工作线程
    const chunkSize = baseChunkSize + (i < remainder ? 1 : 0);
    chunks.push({
      chunkId: i,
      startRow,
      endRow: startRow + chunkSize,
      rowCount: chunkSize,
    });
    startRow += chunkSize;
  }
  
  return chunks;
}
```

**优化建议：**
- 确保数据块大小差异不超过 1 行
- 对于小文件（< 1000 行），使用顺序处理
- 考虑文件大小和可用内存动态调整工作线程数


### 2. 工作线程 CSV 读取优化

**挑战：** 每个工作线程如何高效读取其分配的行范围？

**解决方案：** 使用流式读取 + 行跳过

```typescript
// 在 data-cleaning.worker.ts 中
import * as fs from 'fs';
import * as readline from 'readline';

async function readCsvChunk(
  filePath: string,
  startRow: number,
  rowCount: number
): Promise<string[][]> {
  const rows: string[][] = [];
  let currentRow = 0;
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  for await (const line of rl) {
    // 跳过标题行
    if (currentRow === 0) {
      currentRow++;
      continue;
    }
    
    // 跳过不属于此工作线程的行
    if (currentRow - 1 < startRow) {
      currentRow++;
      continue;
    }
    
    // 读取分配的行
    if (currentRow - 1 < startRow + rowCount) {
      rows.push(parseCsvLine(line));
      currentRow++;
    } else {
      // 已读取完所有分配的行
      break;
    }
  }
  
  return rows;
}
```

**优化建议：**
- 使用 `readline` 模块进行流式读取，避免内存溢出
- 实现高效的行跳过逻辑
- 考虑使用更快的 CSV 解析库（如 `csv-parser`, `papaparse`）
- 对于大文件，考虑使用文件偏移量直接定位


### 3. 批量数据库插入优化

**挑战：** 如何最大化数据库插入性能？

**解决方案：** 使用大批次 + 原生 SQL + 事务

```typescript
// 在 worker 中实现高性能批量插入
async function batchInsertCleanData(
  records: CleanDataRecord[],
  batchSize: number = 10000
): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  
  try {
    await queryRunner.startTransaction();
    
    // 分批插入
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      // 使用原生 SQL 批量插入（比 TypeORM save() 快 3-5 倍）
      const values = batch.map(r => 
        `(${queryRunner.escape(r.jobId)}, ${r.rowNumber}, ` +
        `${queryRunner.escape(r.name)}, ${queryRunner.escape(r.phone)}, ` +
        `${queryRunner.escape(r.address)}, ${queryRunner.escape(r.date)})`
      ).join(',');
      
      await queryRunner.query(
        `INSERT INTO clean_data (jobId, rowNumber, name, phone, address, date) ` +
        `VALUES ${values}`
      );
    }
    
    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}
```

**优化建议：**
- 使用批次大小 10000（平衡内存和性能）
- 使用原生 SQL 而非 ORM 方法
- 使用事务减少提交开销
- 考虑在插入期间禁用索引（需要权限）
- 增加数据库连接池大小（至少 20 个连接）


### 4. 工作线程通信模式

**挑战：** 如何在主线程和工作线程之间高效通信？

**解决方案：** 使用结构化消息传递

```typescript
// 主线程发送任务到工作线程
const worker = new Worker('./data-cleaning.worker.js');

worker.postMessage({
  type: 'START',
  payload: {
    filePath: '/path/to/file.csv',
    startRow: 0,
    rowCount: 250000,
    batchSize: 10000,
    workerId: 1,
    dbConfig: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      // ...
    }
  }
});

// 工作线程监听消息
parentPort.on('message', async (message) => {
  if (message.type === 'START') {
    const { filePath, startRow, rowCount, batchSize, workerId } = message.payload;
    
    try {
      // 处理数据
      const result = await processChunk(filePath, startRow, rowCount, batchSize);
      
      // 发送完成消息
      parentPort.postMessage({
        type: 'COMPLETE',
        payload: {
          workerId,
          successCount: result.successCount,
          errorCount: result.errorCount,
          processingTimeMs: result.timeMs
        }
      });
    } catch (error) {
      // 发送错误消息
      parentPort.postMessage({
        type: 'ERROR',
        payload: {
          workerId,
          error: error.message,
          stack: error.stack
        }
      });
    }
  }
});

// 工作线程定期发送进度更新
function reportProgress(workerId: number, processed: number, total: number) {
  parentPort.postMessage({
    type: 'PROGRESS',
    payload: {
      workerId,
      processedRows: processed,
      totalRows: total,
      percentage: (processed / total) * 100
    }
  });
}
```

**优化建议：**
- 使用类型化消息接口
- 限制进度更新频率（如每 1000 行或每秒）
- 避免传递大对象（使用 SharedArrayBuffer 如需要）
- 实现超时机制防止工作线程挂起


### 5. 错误处理和恢复

**挑战：** 如何处理工作线程崩溃和错误？

**解决方案：** 多层错误处理 + 部分结果收集

```typescript
// 在 ParallelProcessingManager 中
async processFile(filePath: string, config: ProcessingConfig): Promise<ProcessingResult> {
  const chunks = await this.chunkSplitter.splitFile(filePath, config.workerCount);
  const workerPromises: Promise<WorkerResult>[] = [];
  
  for (const chunk of chunks) {
    const workerPromise = this.executeWorkerWithTimeout(chunk, config.timeoutMs)
      .catch(error => {
        // 工作线程失败，返回错误结果
        this.logger.error(`Worker ${chunk.chunkId} failed: ${error.message}`);
        return {
          workerId: chunk.chunkId,
          successCount: 0,
          errorCount: 0,
          processingTimeMs: 0,
          errors: [{ message: error.message, stack: error.stack }]
        };
      });
    
    workerPromises.push(workerPromise);
  }
  
  // 等待所有工作线程完成（包括失败的）
  const results = await Promise.all(workerPromises);
  
  // 聚合结果（包括部分结果）
  return this.resultCollector.aggregateResults(results);
}

// 实现超时机制
private executeWorkerWithTimeout(
  chunk: ChunkDescriptor,
  timeoutMs: number
): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./data-cleaning.worker.js');
    
    // 设置超时
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error(`Worker ${chunk.chunkId} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    
    worker.on('message', (message) => {
      if (message.type === 'COMPLETE') {
        clearTimeout(timeout);
        worker.terminate();
        resolve(message.payload);
      } else if (message.type === 'ERROR') {
        clearTimeout(timeout);
        worker.terminate();
        reject(new Error(message.payload.error));
      }
    });
    
    worker.on('error', (error) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(error);
    });
    
    // 发送任务
    worker.postMessage({ type: 'START', payload: chunk });
  });
}
```

**优化建议：**
- 实现工作线程超时（默认 5 分钟）
- 捕获所有工作线程错误并记录
- 即使部分工作线程失败也返回结果
- 在工作线程中实现全局错误处理
- 考虑实现重试机制（最多 3 次）


## 性能优化建议

### 1. 数据库层优化

**连接池配置：**
```typescript
// 在 TypeORM 配置中
{
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  // 增加连接池大小以支持并行工作线程
  extra: {
    connectionLimit: 20,  // 至少 4 个工作线程 * 4 + 主线程
    waitForConnections: true,
    queueLimit: 0
  }
}
```

**MySQL 配置优化：**
```ini
# my.cnf 或 my.ini
[mysqld]
# 增加缓冲池大小
innodb_buffer_pool_size = 2G

# 增加日志文件大小
innodb_log_file_size = 512M

# 调整刷新策略（牺牲一些持久性换取性能）
innodb_flush_log_at_trx_commit = 2

# 增加批量插入缓冲区
bulk_insert_buffer_size = 256M

# 增加最大包大小
max_allowed_packet = 256M

# 禁用查询缓存（MySQL 8.0 已移除）
# query_cache_type = 0
```

**索引优化：**
```sql
-- 在处理前禁用索引（需要 ALTER 权限）
ALTER TABLE clean_data DISABLE KEYS;
ALTER TABLE error_log DISABLE KEYS;

-- 批量插入数据...

-- 处理后重建索引
ALTER TABLE clean_data ENABLE KEYS;
ALTER TABLE error_log ENABLE KEYS;
```


### 2. CSV 解析优化

**使用高性能 CSV 解析库：**

```bash
# 安装 csv-parser（比手动解析快 2-3 倍）
npm install csv-parser
```

```typescript
import csv from 'csv-parser';
import * as fs from 'fs';

async function readCsvChunkOptimized(
  filePath: string,
  startRow: number,
  rowCount: number
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const rows: any[] = [];
    let currentRow = 0;
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        if (currentRow >= startRow && currentRow < startRow + rowCount) {
          rows.push(row);
        }
        currentRow++;
        
        // 提前终止流
        if (currentRow >= startRow + rowCount) {
          this.destroy();
        }
      })
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}
```

**预编译正则表达式：**
```typescript
// 在 Worker 初始化时预编译
class DataValidator {
  private readonly phoneRegex = /^1[3-9]\d{9}$/;
  private readonly dateRegex = /^\d{4}[-/.年]\d{1,2}[-/.月]?\d{1,2}日?$/;
  private readonly addressRegex = /^[\u4e00-\u9fa5a-zA-Z0-9\s,，.。-]+$/;
  
  validatePhone(phone: string): boolean {
    return this.phoneRegex.test(phone);
  }
  
  validateDate(date: string): boolean {
    return this.dateRegex.test(date);
  }
  
  validateAddress(address: string): boolean {
    return this.addressRegex.test(address);
  }
}
```


### 3. 内存管理优化

**流式处理避免内存溢出：**
```typescript
async function processChunkStreaming(
  filePath: string,
  startRow: number,
  rowCount: number,
  batchSize: number
): Promise<WorkerResult> {
  let successCount = 0;
  let errorCount = 0;
  let currentBatch: CleanDataRecord[] = [];
  let processedRows = 0;
  
  const stream = fs.createReadStream(filePath)
    .pipe(csv());
  
  for await (const row of stream) {
    if (processedRows >= startRow && processedRows < startRow + rowCount) {
      const validationResult = validateRow(row);
      
      if (validationResult.isValid) {
        currentBatch.push(validationResult.cleanData);
        
        // 达到批次大小，立即插入并清空
        if (currentBatch.length >= batchSize) {
          await batchInsertCleanData(currentBatch);
          successCount += currentBatch.length;
          currentBatch = [];  // 释放内存
        }
      } else {
        await logError(validationResult.error);
        errorCount++;
      }
    }
    
    processedRows++;
    
    // 提前终止
    if (processedRows >= startRow + rowCount) {
      break;
    }
  }
  
  // 插入剩余记录
  if (currentBatch.length > 0) {
    await batchInsertCleanData(currentBatch);
    successCount += currentBatch.length;
  }
  
  return { successCount, errorCount };
}
```

**监控内存使用：**
```typescript
function checkMemoryUsage(): void {
  const usage = process.memoryUsage();
  const usedMB = usage.heapUsed / 1024 / 1024;
  
  if (usedMB > 1800) {
    console.warn(`High memory usage: ${usedMB.toFixed(2)} MB`);
    // 触发垃圾回收（需要 --expose-gc 标志）
    if (global.gc) {
      global.gc();
    }
  }
}
```


### 4. 动态工作线程数调整

**根据系统资源动态调整：**
```typescript
import * as os from 'os';

function calculateOptimalWorkerCount(): number {
  const cpuCount = os.cpus().length;
  const totalMemoryGB = os.totalmem() / (1024 ** 3);
  
  // 基于 CPU 核心数（保留 1 个核心给主线程）
  const cpuBasedCount = Math.max(1, cpuCount - 1);
  
  // 基于内存（每个工作线程假设需要 500MB）
  const memoryBasedCount = Math.floor(totalMemoryGB * 0.8 / 0.5);
  
  // 取较小值，最多 8 个工作线程
  return Math.min(cpuBasedCount, memoryBasedCount, 8);
}

// 在配置中使用
const workerCount = process.env.WORKER_COUNT 
  ? parseInt(process.env.WORKER_COUNT)
  : calculateOptimalWorkerCount();
```


## 测试策略

### 1. 单元测试示例

```typescript
// chunk-splitter.service.spec.ts
describe('ChunkSplitter', () => {
  let splitter: ChunkSplitter;
  
  beforeEach(() => {
    splitter = new ChunkSplitter();
  });
  
  it('should split evenly divisible rows equally', () => {
    const chunks = splitter.calculateChunks(1000000, 4);
    
    expect(chunks).toHaveLength(4);
    expect(chunks[0].rowCount).toBe(250000);
    expect(chunks[1].rowCount).toBe(250000);
    expect(chunks[2].rowCount).toBe(250000);
    expect(chunks[3].rowCount).toBe(250000);
  });
  
  it('should distribute remainder rows', () => {
    const chunks = splitter.calculateChunks(1000001, 4);
    
    expect(chunks).toHaveLength(4);
    expect(chunks[0].rowCount).toBe(250001);  // 获得余数
    expect(chunks[1].rowCount).toBe(250000);
    expect(chunks[2].rowCount).toBe(250000);
    expect(chunks[3].rowCount).toBe(250000);
  });
  
  it('should ensure max difference is 1', () => {
    const chunks = splitter.calculateChunks(999999, 4);
    const sizes = chunks.map(c => c.rowCount);
    const max = Math.max(...sizes);
    const min = Math.min(...sizes);
    
    expect(max - min).toBeLessThanOrEqual(1);
  });
});
```

### 2. 属性测试示例

```typescript
// parallel-processing.property.spec.ts
import * as fc from 'fast-check';

describe('Parallel Processing Properties', () => {
  it('Property 1: Data integrity - total records preserved', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 10000 }),  // 随机行数
        async (rowCount) => {
          // 生成测试 CSV 文件
          const filePath = await generateTestCsv(rowCount);
          
          // 并行处理
          const result = await parallelProcessor.processFile(filePath);
          
          // 验证：成功 + 错误 = 总数
          expect(result.successCount + result.errorCount).toBe(rowCount);
          
          // 清理
          await fs.unlink(filePath);
        }
      ),
      { numRuns: 100 }  // 运行 100 次
    );
  });
  
  it('Property 2: Chunk balance - max difference <= 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000000 }),  // 总行数
        fc.integer({ min: 1, max: 16 }),       // 工作线程数
        (totalRows, workerCount) => {
          const chunks = chunkSplitter.calculateChunks(totalRows, workerCount);
          const sizes = chunks.map(c => c.rowCount);
          const max = Math.max(...sizes);
          const min = Math.min(...sizes);
          
          return max - min <= 1;
        }
      ),
      { numRuns: 1000 }
    );
  });
  
  it('Property 3: Validation consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          phone: fc.string({ minLength: 11, maxLength: 11 }),
          address: fc.string({ minLength: 1, maxLength: 100 }),
          date: fc.string({ minLength: 8, maxLength: 20 })
        }),
        async (record) => {
          // 并行验证
          const parallelResult = await validateInParallel(record);
          
          // 顺序验证
          const sequentialResult = await validateSequentially(record);
          
          // 验证结果应该相同
          expect(parallelResult.isValid).toBe(sequentialResult.isValid);
          if (!parallelResult.isValid) {
            expect(parallelResult.errorMessage).toBe(sequentialResult.errorMessage);
          }
        }
      ),
      { numRuns: 500 }
    );
  });
});
```


### 3. 性能测试脚本

```typescript
// performance-test.ts
import * as fs from 'fs';
import * as path from 'path';

async function runPerformanceTest() {
  console.log('=== Performance Test: 1 Million Records ===\n');
  
  // 1. 生成测试数据
  console.log('Generating test data...');
  const testFile = await generateLargeTestCsv(1000000);
  console.log(`Test file created: ${testFile}\n`);
  
  // 2. 顺序处理基准
  console.log('Running sequential processing...');
  const sequentialStart = Date.now();
  const sequentialResult = await processSequentially(testFile);
  const sequentialTime = Date.now() - sequentialStart;
  console.log(`Sequential: ${sequentialTime}ms`);
  console.log(`  Success: ${sequentialResult.successCount}`);
  console.log(`  Errors: ${sequentialResult.errorCount}\n`);
  
  // 3. 并行处理
  console.log('Running parallel processing...');
  const parallelStart = Date.now();
  const parallelResult = await processInParallel(testFile);
  const parallelTime = Date.now() - parallelStart;
  console.log(`Parallel: ${parallelTime}ms`);
  console.log(`  Success: ${parallelResult.successCount}`);
  console.log(`  Errors: ${parallelResult.errorCount}\n`);
  
  // 4. 计算性能指标
  const speedup = sequentialTime / parallelTime;
  const throughput = 1000000 / (parallelTime / 1000);
  
  console.log('=== Performance Metrics ===');
  console.log(`Speedup: ${speedup.toFixed(2)}x`);
  console.log(`Throughput: ${throughput.toFixed(0)} rows/sec`);
  console.log(`Time saved: ${((sequentialTime - parallelTime) / 1000).toFixed(1)}s`);
  
  // 5. 验证目标
  console.log('\n=== Target Validation ===');
  console.log(`✓ Processing time < 60s: ${parallelTime < 60000 ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Speedup > 2x: ${speedup > 2 ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Data integrity: ${
    sequentialResult.successCount === parallelResult.successCount ? 'PASS' : 'FAIL'
  }`);
  
  // 6. 资源使用
  const memUsage = process.memoryUsage();
  console.log('\n=== Resource Usage ===');
  console.log(`Memory: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`CPU cores: ${os.cpus().length}`);
  
  // 清理
  await fs.promises.unlink(testFile);
}

// 运行测试
runPerformanceTest().catch(console.error);
```


## 部署和配置

### 环境变量配置

```bash
# .env 文件
# 并行处理配置
ENABLE_PARALLEL_PROCESSING=true
WORKER_COUNT=4
PARALLEL_BATCH_SIZE=10000
MIN_RECORDS_FOR_PARALLEL=1000

# 资源限制
MAX_MEMORY_MB=1800
WORKER_TIMEOUT_MS=300000

# 进度跟踪
ENABLE_PROGRESS_TRACKING=true
PROGRESS_UPDATE_INTERVAL=1000

# 数据库连接池
DB_CONNECTION_LIMIT=20
DB_QUEUE_LIMIT=0
```

### 部署检查清单

**部署前：**
- [ ] 所有测试通过（单元、集成、属性、性能）
- [ ] 代码审查完成
- [ ] 文档更新完成
- [ ] 数据库连接池配置已更新
- [ ] 环境变量已配置
- [ ] 回滚计划已准备

**部署步骤：**
1. 备份当前代码和数据库
2. 部署新代码到测试环境
3. 运行冒烟测试
4. 运行性能测试验证目标
5. 部署到生产环境
6. 监控性能指标和错误日志
7. 验证功能正常

**部署后监控：**
- [ ] 处理时间是否在预期范围内（< 60 秒）
- [ ] CPU 利用率是否提升（> 80%）
- [ ] 内存使用是否在限制内（< 2GB）
- [ ] 错误率是否正常
- [ ] 数据完整性是否保持


## 故障排除

### 常见问题和解决方案

**问题 1: 性能未达到预期**

症状：处理时间仍然 > 60 秒

可能原因和解决方案：
- 数据库连接池太小 → 增加到至少 20
- 批次大小太小 → 增加到 10000
- 工作线程数不足 → 增加到 CPU 核心数
- 数据库配置未优化 → 调整 MySQL 配置
- CSV 解析慢 → 使用更快的解析库

诊断命令：
```bash
# 检查 CPU 使用率
top -p $(pgrep -f "node.*data-cleaning")

# 检查内存使用
ps aux | grep node

# 检查数据库连接
mysql -e "SHOW PROCESSLIST;"
```

**问题 2: 内存溢出**

症状：进程崩溃，错误 "JavaScript heap out of memory"

解决方案：
- 减少批次大小
- 减少工作线程数
- 确保使用流式读取
- 增加 Node.js 堆大小：`node --max-old-space-size=4096`

**问题 3: 工作线程超时**

症状：工作线程在 5 分钟后被终止

解决方案：
- 检查数据库连接是否正常
- 检查 CSV 文件是否损坏
- 增加超时时间
- 检查是否有死锁

**问题 4: 数据不一致**

症状：并行处理结果与顺序处理不同

解决方案：
- 检查工作线程是否处理了重叠的行
- 验证数据块分割逻辑
- 检查数据库事务是否正确
- 运行属性测试验证

**问题 5: 数据库连接耗尽**

症状：错误 "Too many connections"

解决方案：
- 增加数据库最大连接数
- 减少工作线程数
- 确保连接正确释放
- 使用连接池


## 最佳实践

### 1. 代码组织

```
src/
├── services/
│   ├── parallel/
│   │   ├── parallel-processing-manager.service.ts
│   │   ├── worker-pool.service.ts
│   │   ├── chunk-splitter.service.ts
│   │   ├── result-collector.service.ts
│   │   ├── progress-tracker.service.ts
│   │   ├── resource-monitor.service.ts
│   │   └── types.ts
│   └── data-cleaner.service.ts
├── workers/
│   └── data-cleaning.worker.ts
├── config/
│   └── worker-threads.config.ts
└── tests/
    ├── unit/
    │   ├── chunk-splitter.spec.ts
    │   ├── worker-pool.spec.ts
    │   └── ...
    ├── integration/
    │   └── parallel-processing.spec.ts
    └── property/
        └── parallel-processing.property.spec.ts
```

### 2. 日志记录

```typescript
// 使用结构化日志
this.logger.log({
  message: 'Parallel processing started',
  jobId,
  workerCount: 4,
  totalRows: 1000000,
  batchSize: 10000
});

this.logger.log({
  message: 'Worker completed',
  workerId: 1,
  successCount: 248000,
  errorCount: 2000,
  processingTimeMs: 12500
});

this.logger.log({
  message: 'Parallel processing completed',
  jobId,
  totalSuccessCount: 995000,
  totalErrorCount: 5000,
  totalProcessingTimeMs: 45000,
  speedup: 3.2
});
```

### 3. 监控指标

关键指标：
- 处理时间（目标：< 60 秒）
- CPU 利用率（目标：> 80%）
- 内存使用（目标：< 2GB）
- 吞吐量（目标：> 16k 行/秒）
- 错误率
- 工作线程失败率

### 4. 渐进式部署

1. **阶段 1：** 在测试环境启用并行处理
2. **阶段 2：** 在生产环境对 10% 流量启用
3. **阶段 3：** 逐步增加到 50%
4. **阶段 4：** 全量启用
5. **回滚：** 如有问题，通过配置立即禁用


## 预期性能结果

### 基准测试结果（100 万行）

| 指标 | 当前（顺序） | 目标（并行） | 实际预期 |
|-----|------------|------------|---------|
| 处理时间 | 150-240 秒 | 45-60 秒 | 50-55 秒 |
| CPU 利用率 | 25% | 80-100% | 85-95% |
| 内存使用 | 500MB | 1200-1800MB | 1400-1600MB |
| 吞吐量 | 4-7k 行/秒 | 16-22k 行/秒 | 18-20k 行/秒 |
| 数据库连接 | 2-3 | 8-12 | 10-12 |

### 性能提升分解

**时间节省来源：**
1. **并行处理：** 4 个工作线程同时处理 → 节省 60-70%
2. **批量插入优化：** 10000 行/批 → 节省 10-15%
3. **原生 SQL：** 替代 ORM → 节省 5-10%
4. **预编译正则：** 避免重复编译 → 节省 3-5%

**总计：** 约 250-300% 性能提升

### 不同文件大小的预期性能

| 文件大小 | 顺序处理 | 并行处理 | 加速比 |
|---------|---------|---------|--------|
| 1,000 行 | 0.5 秒 | 0.5 秒 | 1.0x（不启用并行）|
| 10,000 行 | 5 秒 | 3 秒 | 1.7x |
| 100,000 行 | 50 秒 | 20 秒 | 2.5x |
| 1,000,000 行 | 200 秒 | 55 秒 | 3.6x |
| 5,000,000 行 | 1000 秒 | 280 秒 | 3.6x |

## 总结

本实施指南提供了 Worker Threads 并行处理优化的详细实现方案，包括：

1. **核心架构：** 主线程协调 + 4 个工作线程并行处理
2. **关键优化：** CSV 流式读取、批量数据库插入、预编译正则表达式
3. **错误处理：** 多层错误处理、超时机制、部分结果收集
4. **测试策略：** 单元测试、集成测试、属性测试、性能测试
5. **部署方案：** 渐进式部署、监控指标、故障排除

通过遵循本指南，预期可以将 100 万行数据的处理时间从 150-240 秒降低到 45-60 秒，实现 250% 以上的性能提升，同时保持 100% 的数据完整性和准确性。

## 下一步

1. 阅读 `requirements.md` 了解详细需求
2. 阅读 `design.md` 了解系统设计
3. 按照 `tasks.md` 中的任务列表逐步实施
4. 参考本指南中的代码示例和优化建议
5. 运行测试验证实现
6. 进行性能测试确保达到目标
7. 部署到生产环境并监控

祝实施顺利！🚀

## 性能监控实现

### 1. PerformanceMonitor 实现示例

```typescript
// src/services/parallel/performance-monitor.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as os from 'os';

@Injectable()
export class PerformanceMonitor {
  private readonly logger = new Logger(PerformanceMonitor.name);
  
  private jobId: string;
  private startTime: number;
  private monitoringInterval: NodeJS.Timeout;
  private snapshots: PerformanceSnapshot[] = [];
  private workerMetricsMap: Map<number, WorkerMetrics[]> = new Map();
  
  // 基准 CPU 使用（用于计算增量）
  private baselineCpuUsage: NodeJS.CpuUsage;
  
  /**
   * 开始性能监控
   */
  startMonitoring(jobId: string): void {
    this.jobId = jobId;
    this.startTime = Date.now();
    this.snapshots = [];
    this.workerMetricsMap.clear();
    
    // 记录基准 CPU 使用
    this.baselineCpuUsage = process.cpuUsage();
    
    // 每秒采样一次
    this.monitoringInterval = setInterval(() => {
      this.collectSnapshot();
    }, 1000);
    
    this.logger.log(`Performance monitoring started for job ${jobId}`);
  }
  
  /**
   * 停止性能监控并生成报告
   */
  stopMonitoring(): PerformanceReport {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    const duration = Date.now() - this.startTime;
    const report = this.generateReport(duration);
    
    this.logger.log(`Performance monitoring stopped for job ${this.jobId}`);
    this.logger.log(`Report: ${JSON.stringify(report, null, 2)}`);
    
    return report;
  }
  
  /**
   * 获取当前性能指标
   */
  getCurrentMetrics(): PerformanceMetrics {
    const cpuMetrics = this.getCPUMetrics();
    const memoryMetrics = this.getMemoryMetrics();
    const workerMetrics = this.getLatestWorkerMetrics();
    const throughput = this.calculateCurrentThroughput();
    
    return {
      timestamp: Date.now(),
      cpuUsage: cpuMetrics,
      memoryUsage: memoryMetrics,
      workerMetrics,
      throughput,
    };
  }
  
  /**
   * 记录工作线程指标
   */
  recordWorkerMetrics(workerId: number, metrics: WorkerMetrics): void {
    if (!this.workerMetricsMap.has(workerId)) {
      this.workerMetricsMap.set(workerId, []);
    }
    
    this.workerMetricsMap.get(workerId).push({
      ...metrics,
      timestamp: Date.now(),
    });
  }
  
  /**
   * 收集性能快照
   */
  private collectSnapshot(): void {
    const metrics = this.getCurrentMetrics();
    
    this.snapshots.push({
      timestamp: metrics.timestamp,
      cpuUsage: metrics.cpuUsage.overall,
      memoryUsage: metrics.memoryUsage.heapUsedMB,
      processedRows: this.getTotalProcessedRows(),
      throughput: metrics.throughput,
    });
  }
  
  /**
   * 获取 CPU 指标
   */
  private getCPUMetrics(): CPUMetrics {
    const cpus = os.cpus();
    const cpuUsage = process.cpuUsage(this.baselineCpuUsage);
    
    // 计算总 CPU 时间（微秒）
    const totalCpuTime = cpuUsage.user + cpuUsage.system;
    
    // 计算经过的时间（微秒）
    const elapsedTime = (Date.now() - this.startTime) * 1000;
    
    // 计算 CPU 使用率百分比
    const cpuCount = cpus.length;
    const overall = Math.min(100, (totalCpuTime / elapsedTime) * 100);
    
    // 计算每个核心的使用率（简化版本）
    const perCore = cpus.map((cpu, index) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return ((total - idle) / total) * 100;
    });
    
    return {
      overall,
      perCore,
      user: (cpuUsage.user / elapsedTime) * 100,
      system: (cpuUsage.system / elapsedTime) * 100,
    };
  }
  
  /**
   * 获取内存指标
   */
  private getMemoryMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const rssMB = memUsage.rss / 1024 / 1024;
    const usagePercentage = (memUsage.rss / totalMemory) * 100;
    
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      heapUsedMB,
      heapTotalMB,
      rssMB,
      usagePercentage,
    };
  }
  
  /**
   * 获取最新的工作线程指标
   */
  private getLatestWorkerMetrics(): WorkerMetrics[] {
    const latestMetrics: WorkerMetrics[] = [];
    
    this.workerMetricsMap.forEach((metrics, workerId) => {
      if (metrics.length > 0) {
        latestMetrics.push(metrics[metrics.length - 1]);
      }
    });
    
    return latestMetrics;
  }
  
  /**
   * 计算当前吞吐量
   */
  private calculateCurrentThroughput(): number {
    const totalProcessed = this.getTotalProcessedRows();
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    
    return elapsedSeconds > 0 ? totalProcessed / elapsedSeconds : 0;
  }
  
  /**
   * 获取总处理行数
   */
  private getTotalProcessedRows(): number {
    let total = 0;
    
    this.workerMetricsMap.forEach((metrics) => {
      if (metrics.length > 0) {
        const latest = metrics[metrics.length - 1];
        total += latest.processedRows;
      }
    });
    
    return total;
  }
  
  /**
   * 生成性能报告
   */
  private generateReport(duration: number): PerformanceReport {
    // 计算 CPU 指标
    const cpuSnapshots = this.snapshots.map(s => s.cpuUsage);
    const avgCpuUsage = this.average(cpuSnapshots);
    const peakCpuUsage = Math.max(...cpuSnapshots);
    const cpuUtilization = (avgCpuUsage / (os.cpus().length * 100)) * 100;
    
    // 计算内存指标
    const memorySnapshots = this.snapshots.map(s => s.memoryUsage);
    const avgMemoryUsage = this.average(memorySnapshots);
    const peakMemoryUsage = Math.max(...memorySnapshots);
    const memoryUtilization = (peakMemoryUsage / (os.totalmem() / 1024 / 1024)) * 100;
    
    // 计算吞吐量指标
    const throughputSnapshots = this.snapshots.map(s => s.throughput);
    const avgThroughput = this.average(throughputSnapshots);
    const peakThroughput = Math.max(...throughputSnapshots);
    const totalRows = this.getTotalProcessedRows();
    
    // 生成工作线程报告
    const workerReports = this.generateWorkerReports();
    
    return {
      jobId: this.jobId,
      duration,
      avgCpuUsage,
      peakCpuUsage,
      cpuUtilization,
      avgMemoryUsage,
      peakMemoryUsage,
      memoryUtilization,
      totalRows,
      avgThroughput,
      peakThroughput,
      workerReports,
      timeline: this.snapshots,
    };
  }
  
  /**
   * 生成工作线程报告
   */
  private generateWorkerReports(): WorkerReport[] {
    const reports: WorkerReport[] = [];
    
    this.workerMetricsMap.forEach((metrics, workerId) => {
      if (metrics.length === 0) return;
      
      const cpuValues = metrics.map(m => m.cpuUsage);
      const memoryValues = metrics.map(m => m.memoryUsage);
      const throughputValues = metrics.map(m => m.throughput);
      
      const firstMetric = metrics[0];
      const lastMetric = metrics[metrics.length - 1];
      const duration = lastMetric.timestamp - firstMetric.timestamp;
      
      reports.push({
        workerId,
        avgCpuUsage: this.average(cpuValues),
        peakCpuUsage: Math.max(...cpuValues),
        avgMemoryUsage: this.average(memoryValues),
        peakMemoryUsage: Math.max(...memoryValues),
        processedRows: lastMetric.processedRows,
        avgThroughput: this.average(throughputValues),
        duration,
      });
    });
    
    return reports;
  }
  
  /**
   * 计算平均值
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
}
```

### 2. 在 Worker 中收集指标

```typescript
// src/workers/data-cleaning.worker.ts
import { parentPort } from 'worker_threads';
import * as os from 'os';

let baselineCpuUsage: NodeJS.CpuUsage;
let processedRows = 0;

// 初始化
baselineCpuUsage = process.cpuUsage();

// 定期发送性能指标
setInterval(() => {
  const cpuUsage = process.cpuUsage(baselineCpuUsage);
  const memUsage = process.memoryUsage();
  
  // 计算 CPU 使用率
  const totalCpuTime = cpuUsage.user + cpuUsage.system;
  const elapsedTime = 1000000; // 1 秒（微秒）
  const cpuPercentage = (totalCpuTime / elapsedTime) * 100;
  
  // 发送指标到主线程
  parentPort.postMessage({
    type: 'METRICS',
    payload: {
      workerId: workerData.workerId,
      cpuUsage: cpuPercentage,
      memoryUsage: memUsage.heapUsed / 1024 / 1024, // MB
      processedRows,
      throughput: processedRows / ((Date.now() - startTime) / 1000),
      status: 'running',
    }
  });
}, 1000);

// 在处理记录时更新计数
function processRecord(record: any) {
  // ... 处理逻辑
  processedRows++;
}
```

### 3. API 端点实现

```typescript
// src/data-cleaning.controller.ts
import { Controller, Get, Param } from '@nestjs/common';

@Controller('api/data-cleaning')
export class DataCleaningController {
  constructor(
    private readonly parallelProcessingManager: ParallelProcessingManager,
    private readonly performanceMonitor: PerformanceMonitor,
  ) {}
  
  /**
   * 获取实时性能指标
   */
  @Get('metrics/:jobId')
  async getMetrics(@Param('jobId') jobId: string) {
    const metrics = this.performanceMonitor.getCurrentMetrics();
    
    return {
      jobId,
      timestamp: new Date().toISOString(),
      metrics: {
        cpu: {
          overall: `${metrics.cpuUsage.overall.toFixed(2)}%`,
          perCore: metrics.cpuUsage.perCore.map(c => `${c.toFixed(2)}%`),
          user: `${metrics.cpuUsage.user.toFixed(2)}%`,
          system: `${metrics.cpuUsage.system.toFixed(2)}%`,
        },
        memory: {
          heapUsed: `${metrics.memoryUsage.heapUsedMB.toFixed(2)} MB`,
          heapTotal: `${metrics.memoryUsage.heapTotalMB.toFixed(2)} MB`,
          rss: `${metrics.memoryUsage.rssMB.toFixed(2)} MB`,
          usage: `${metrics.memoryUsage.usagePercentage.toFixed(2)}%`,
        },
        throughput: `${metrics.throughput.toFixed(0)} rows/sec`,
        workers: metrics.workerMetrics.map(w => ({
          id: w.workerId,
          cpu: `${w.cpuUsage.toFixed(2)}%`,
          memory: `${w.memoryUsage.toFixed(2)} MB`,
          processed: w.processedRows,
          throughput: `${w.throughput.toFixed(0)} rows/sec`,
          status: w.status,
        })),
      },
    };
  }
  
  /**
   * 获取性能报告
   */
  @Get('report/:jobId')
  async getReport(@Param('jobId') jobId: string) {
    const report = await this.getPerformanceReport(jobId);
    
    return {
      jobId,
      summary: {
        duration: `${(report.duration / 1000).toFixed(2)}s`,
        totalRows: report.totalRows.toLocaleString(),
        avgThroughput: `${report.avgThroughput.toFixed(0)} rows/sec`,
        peakThroughput: `${report.peakThroughput.toFixed(0)} rows/sec`,
      },
      cpu: {
        average: `${report.avgCpuUsage.toFixed(2)}%`,
        peak: `${report.peakCpuUsage.toFixed(2)}%`,
        utilization: `${report.cpuUtilization.toFixed(2)}%`,
      },
      memory: {
        average: `${report.avgMemoryUsage.toFixed(2)} MB`,
        peak: `${report.peakMemoryUsage.toFixed(2)} MB`,
        utilization: `${report.memoryUtilization.toFixed(2)}%`,
      },
      workers: report.workerReports.map(w => ({
        id: w.workerId,
        processed: w.processedRows.toLocaleString(),
        avgCpu: `${w.avgCpuUsage.toFixed(2)}%`,
        peakCpu: `${w.peakCpuUsage.toFixed(2)}%`,
        avgMemory: `${w.avgMemoryUsage.toFixed(2)} MB`,
        peakMemory: `${w.peakMemoryUsage.toFixed(2)} MB`,
        avgThroughput: `${w.avgThroughput.toFixed(0)} rows/sec`,
        duration: `${(w.duration / 1000).toFixed(2)}s`,
      })),
      timeline: report.timeline,
    };
  }
}
```

### 4. 前端性能仪表板示例

```typescript
// 前端实时性能监控组件
import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';

export const PerformanceMonitor: React.FC<{ jobId: string }> = ({ jobId }) => {
  const [metrics, setMetrics] = useState(null);
  
  useEffect(() => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/data-cleaning/metrics/${jobId}`);
      const data = await response.json();
      setMetrics(data.metrics);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [jobId]);
  
  if (!metrics) return <div>Loading...</div>;
  
  return (
    <div className="performance-monitor">
      <h2>实时性能监控</h2>
      
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>CPU 使用率</h3>
          <div className="metric-value">{metrics.cpu.overall}</div>
          <div className="metric-detail">
            用户态: {metrics.cpu.user} | 系统态: {metrics.cpu.system}
          </div>
        </div>
        
        <div className="metric-card">
          <h3>内存使用</h3>
          <div className="metric-value">{metrics.memory.heapUsed}</div>
          <div className="metric-detail">
            总计: {metrics.memory.heapTotal} | 使用率: {metrics.memory.usage}
          </div>
        </div>
        
        <div className="metric-card">
          <h3>吞吐量</h3>
          <div className="metric-value">{metrics.throughput}</div>
        </div>
      </div>
      
      <div className="workers-section">
        <h3>工作线程状态</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>状态</th>
              <th>CPU</th>
              <th>内存</th>
              <th>已处理</th>
              <th>吞吐量</th>
            </tr>
          </thead>
          <tbody>
            {metrics.workers.map(worker => (
              <tr key={worker.id}>
                <td>{worker.id}</td>
                <td>{worker.status}</td>
                <td>{worker.cpu}</td>
                <td>{worker.memory}</td>
                <td>{worker.processed.toLocaleString()}</td>
                <td>{worker.throughput}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

这个性能监控实现提供了：
- 实时 CPU 使用率监控（总体和每核心）
- 实时内存使用监控（堆内存、RSS、使用百分比）
- 实时吞吐量计算
- 每个工作线程的独立指标
- 完整的性能报告生成
- 时间线数据用于图表展示
- RESTful API 端点
- 前端实时监控组件
