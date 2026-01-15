# 🚀 超高性能优化方案 - 1分钟内处理100万条数据

## 目标
将100万条数据处理时间从当前的 **2.5-4分钟** 降低到 **1分钟以内**

需要性能提升: **150-300%**

---

## 方案对比

| 方案 | 预计时间 | 性能提升 | 实施难度 | 实施时间 | 推荐度 |
|-----|---------|---------|---------|---------|--------|
| 方案1: 批量优化 + 异步 | 90-120秒 | 100% | 简单 | 2小时 | ⭐⭐⭐⭐ |
| 方案2: Worker Threads | 45-60秒 | 250% | 中等 | 1天 | ⭐⭐⭐⭐⭐ |
| 方案3: 数据库优化 | 60-90秒 | 150% | 中等 | 4小时 | ⭐⭐⭐⭐ |
| 方案4: 组合方案 | 30-45秒 | 400% | 困难 | 2-3天 | ⭐⭐⭐⭐⭐ |

---

## 🎯 方案1: 批量优化 + 异步处理（推荐快速实施）

### 实施内容

#### 1.1 增大批次到极限
```typescript
const BATCH_SIZE = 10000; // 从5000增加到10000
```

#### 1.2 异步批量插入（不等待）
```typescript
// 当前：await 等待每次插入完成
if (cleanBatch.length >= BATCH_SIZE) {
    await this.databasePersistence.batchInsertCleanData(cleanBatch);
    cleanBatch = [];
}

// 优化：使用Promise.all并行插入
const insertPromises: Promise<any>[] = [];

if (cleanBatch.length >= BATCH_SIZE) {
    insertPromises.push(
        this.databasePersistence.batchInsertCleanData([...cleanBatch])
    );
    cleanBatch = [];
}

// 在最后等待所有插入完成
await Promise.all(insertPromises);
```

#### 1.3 移除不必要的对象拷贝
```typescript
// 优化 mapToCleanDataEntity，减少对象创建
// 直接修改对象而不是创建新对象
```

#### 1.4 优化正则表达式
```typescript
// 预编译正则表达式，避免重复编译
private readonly phoneRegex = /^1[3-9]\d{9}$/;
private readonly dateRegex = /^\d{4}[-/.年]\d{1,2}[-/.月]?\d{1,2}日?$/;
```

### 预期效果
- **处理时间: 90-120秒**
- **实施时间: 2小时**
- **风险: 低**

---

## 🚀 方案2: Worker Threads 并行处理（最佳方案）

### 架构设计

```
主进程
├── Worker 1 (处理 0-250k 行)
├── Worker 2 (处理 250k-500k 行)
├── Worker 3 (处理 500k-750k 行)
└── Worker 4 (处理 750k-1000k 行)
```

### 实施步骤

#### 2.1 创建 Worker 文件
```typescript
// src/workers/data-cleaning.worker.ts
import { parentPort, workerData } from 'worker_threads';

parentPort.on('message', async (data) => {
    const { rows, columnTypes, jobId, startRow } = data;
    
    // 处理数据
    const results = await processRows(rows, columnTypes, jobId, startRow);
    
    // 返回结果
    parentPort.postMessage(results);
});
```

#### 2.2 修改主服务
```typescript
async cleanDataStreamParallel(filePath: string, jobId: string) {
    // 1. 先读取所有数据到内存
    const allRows = await this.readAllRows(filePath);
    
    // 2. 分成4个批次
    const chunkSize = Math.ceil(allRows.length / 4);
    const chunks = [
        allRows.slice(0, chunkSize),
        allRows.slice(chunkSize, chunkSize * 2),
        allRows.slice(chunkSize * 2, chunkSize * 3),
        allRows.slice(chunkSize * 3),
    ];
    
    // 3. 创建4个Worker并行处理
    const workers = chunks.map((chunk, index) => {
        return new Promise((resolve) => {
            const worker = new Worker('./data-cleaning.worker.js', {
                workerData: { chunk, jobId, startRow: index * chunkSize }
            });
            
            worker.on('message', resolve);
        });
    });
    
    // 4. 等待所有Worker完成
    const results = await Promise.all(workers);
    
    // 5. 合并结果并批量插入数据库
    await this.mergeAndInsertResults(results);
}
```

### 预期效果
- **处理时间: 45-60秒**
- **实施时间: 1天**
- **风险: 中等**
- **CPU利用率: 从25% → 100%**

---

## 💾 方案3: 数据库优化

### 3.1 使用事务批量提交
```typescript
async batchInsertCleanData(data: CleanData[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
        // 使用原生SQL批量插入（比TypeORM快3-5倍）
        const values = data.map(d => 
            `('${d.jobId}', ${d.rowNumber}, '${d.name}', '${d.phone}', ...)`
        ).join(',');
        
        await queryRunner.query(
            `INSERT INTO clean_data (jobId, rowNumber, name, phone, ...) VALUES ${values}`
        );
        
        await queryRunner.commitTransaction();
    } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
    } finally {
        await queryRunner.release();
    }
}
```

### 3.2 禁用索引（插入时）
```typescript
// 插入前
await queryRunner.query('ALTER TABLE clean_data DISABLE KEYS');

// 批量插入
await batchInsert();

// 插入后
await queryRunner.query('ALTER TABLE clean_data ENABLE KEYS');
```

### 3.3 调整MySQL配置
```ini
# my.ini / my.cnf
[mysqld]
innodb_buffer_pool_size = 2G
innodb_log_file_size = 512M
innodb_flush_log_at_trx_commit = 2
bulk_insert_buffer_size = 256M
max_allowed_packet = 256M
```

### 预期效果
- **处理时间: 60-90秒**
- **实施时间: 4小时**
- **风险: 中等**

---

## 🔥 方案4: 组合优化（终极方案）

### 组合内容
1. Worker Threads 并行处理（4个Worker）
2. 每个Worker使用10000批次大小
3. 异步批量插入（不等待）
4. 数据库原生SQL + 事务
5. 预编译正则表达式
6. 移除所有不必要的对象拷贝

### 架构图
```
CSV文件 (100万行)
    ↓
流式读取 + 分块
    ↓
┌─────────┬─────────┬─────────┬─────────┐
│Worker 1 │Worker 2 │Worker 3 │Worker 4 │
│ 250k    │ 250k    │ 250k    │ 250k    │
└────┬────┴────┬────┴────┬────┴────┬────┘
     │         │         │         │
     └─────────┴─────────┴─────────┘
                  ↓
          批量插入数据库
          (原生SQL + 事务)
                  ↓
              完成 (30-45秒)
```

### 预期效果
- **处理时间: 30-45秒** ⚡
- **实施时间: 2-3天**
- **风险: 中等**
- **性能提升: 400%**

---

## 📊 性能对比总结

| 指标 | 当前 | 方案1 | 方案2 | 方案3 | 方案4 |
|-----|------|------|------|------|------|
| 处理时间 | 2.5-4分钟 | 90-120秒 | 45-60秒 | 60-90秒 | 30-45秒 |
| 批次大小 | 5000 | 10000 | 10000 | 10000 | 10000 |
| 并行度 | 1 | 1 | 4 | 1 | 4 |
| 数据库优化 | 否 | 否 | 否 | 是 | 是 |
| CPU利用率 | 25% | 30% | 100% | 30% | 100% |
| 内存占用 | 低 | 中 | 高 | 低 | 高 |
| 实施难度 | - | 简单 | 中等 | 中等 | 困难 |
| 实施时间 | - | 2小时 | 1天 | 4小时 | 2-3天 |

---

## 🎯 推荐实施路径

### 快速路径（今天完成）
1. **立即实施方案1** (2小时)
   - 增大批次到10000
   - 异步批量插入
   - 预编译正则表达式
   - **达到: 90-120秒**

2. **如果还不够快，加上方案3** (+4小时)
   - 数据库原生SQL
   - 调整MySQL配置
   - **达到: 60-90秒**

### 完美路径（2-3天完成）
1. 实施方案1 (2小时)
2. 实施方案2 (1天)
3. 实施方案3 (4小时)
4. 整合为方案4 (1天)
   - **最终达到: 30-45秒** 🎉

---

## 💡 其他优化建议

### 1. 使用内存数据库（Redis）作为缓存
```typescript
// 先写入Redis，后台异步写入MySQL
await redis.lpush(`job:${jobId}:clean`, JSON.stringify(cleanData));
await redis.lpush(`job:${jobId}:errors`, JSON.stringify(errorData));

// 后台任务批量写入MySQL
```

### 2. 使用消息队列（RabbitMQ/Kafka）
```typescript
// 将清洗任务放入队列
await queue.publish('data-cleaning', { jobId, filePath });

// 多个消费者并行处理
```

### 3. 使用列式存储（ClickHouse）
- 适合大数据量的分析查询
- 插入性能比MySQL快10倍以上

---

## 🚦 风险评估

| 方案 | 内存风险 | 数据一致性 | 系统稳定性 | 可回滚性 |
|-----|---------|-----------|-----------|---------|
| 方案1 | 低 | 高 | 高 | 高 |
| 方案2 | 中 | 高 | 中 | 中 |
| 方案3 | 低 | 中 | 中 | 高 |
| 方案4 | 高 | 中 | 中 | 低 |

---

## 📝 下一步行动

**我建议立即实施方案1，预计2小时内完成，可将处理时间降低到90-120秒。**

是否现在开始实施？我可以：
1. 立即修改代码实施方案1
2. 创建方案2的Worker Threads架构
3. 优化数据库配置（方案3）
4. 或者您有其他偏好？
