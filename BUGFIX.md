# Bug修复说明

## 问题描述
上传 `dirty_test_data.csv` 文件后，系统显示 `exceptionRows` 为 0，但文件中明显包含多个脏数据。

## 根本原因

在 `stream-parser.service.ts` 的 `parseCsvStream` 方法中发现了一个严重的逻辑错误：

### 原始代码的问题

```typescript
.on('data', async (row) => {
    statistics.totalRows++;

    // 第一行作为表头
    if (statistics.totalRows === 1) {
        headers = Object.keys(row);
        return;  // ❌ 这里直接返回了
    }

    // 收集样本数据用于识别列类型（前100行）
    if (sampleRows.length < 100) {
        sampleRows.push(row);
    }

    // 在处理完前100行后识别列类型
    if (sampleRows.length === 100 && Object.keys(columnTypes).length === 0) {
        columnTypes = this.identifyColumnTypes(sampleRows, headers);
    }

    // 调用行处理回调
    await onRow({ rowNumber: statistics.totalRows - 1, data: row }, columnTypes);
    // ❌ 这里的 columnTypes 在前100行之前都是空对象！
})
```

**问题分析：**

1. **列类型识别延迟**：代码设计为收集前100行样本后才识别列类型
2. **小文件无法识别**：对于只有15行的测试文件，永远不会触发列类型识别（需要100行）
3. **空的列类型映射**：在识别列类型之前，所有行都使用空的 `columnTypes` 对象传递给 `onRow` 回调
4. **数据清洗失败**：由于 `columnTypes` 为空，`data-cleaner.service.ts` 中的 `cleanRow` 方法会将所有字段识别为 `ColumnType.TEXT`，不会进行任何验证

### 修复方案

修改为先收集所有数据，然后识别列类型，最后再处理每一行：

```typescript
// 解析CSV - 先收集所有数据，然后再处理
const allRows: any[] = [];

readable
    .pipe(csv({ separator: delimiter }))
    .on('data', (row) => {
        allRows.push(row);  // ✓ 先收集所有行
    })
    .on('end', async () => {
        // 获取表头
        headers = Object.keys(allRows[0]);
        
        // ✓ 使用所有数据行识别列类型
        columnTypes = this.identifyColumnTypes(allRows, headers);
        this.logger.log(`列类型识别结果: ${JSON.stringify(columnTypes)}`);

        // ✓ 现在处理每一行，columnTypes 已经正确识别
        for (let i = 0; i < allRows.length; i++) {
            const row = allRows[i];
            await onRow(
                { rowNumber: i + 2, data: row },
                columnTypes  // ✓ 正确的列类型映射
            );
        }
    })
```

## 修复效果

修复后，系统能够正确：

1. **识别列类型**：
   - `手机号码` → `ColumnType.PHONE`
   - `地址` → `ColumnType.ADDRESS`
   - `入职日期` → `ColumnType.DATE`

2. **验证数据**：
   - 手机号：验证格式和长度
   - 地址：验证省市区和详细地址
   - 日期：验证日期格式和年份

3. **正确统计**：
   - 总行数：15行
   - 清洁数据：约3-4行
   - 异常数据：约8-9行 ✓
   - 异常率：60-70%

## 测试验证

### 预期的异常数据

修复后，以下数据应该被正确识别为异常：

**手机号错误（5个）：**
- 赵六: `1391234567` (10位)
- 钱七: `139-123-45678` (格式错误)
- 吴十: `1391234567890` (13位)
- 郑十一: `139-1234-567` (格式错误)
- 陈十二: `13912345` (8位)

**地址错误（2个）：**
- 李十四: `广东省广州市` (缺少区和详细地址)
- 王十五: `东路800号` (缺少省市区)

**日期错误（2个）：**
- 赵六: `23/08/15` (年份只有2位)
- 郑十一: `23-07-20` (年份只有2位)

## 如何验证修复

### 步骤1: 重启后端服务

```bash
cd data-cleaning-service
# 停止当前服务（Ctrl+C）
npm run start:dev
```

### 步骤2: 上传测试文件

1. 访问 http://localhost:5173
2. 上传 `testdoc/dirty_test_data.csv`
3. 等待处理完成

### 步骤3: 查看结果

你应该看到：
- ✓ 异常数据：8-9行（不再是0！）
- ✓ 清洁数据：3-4行
- ✓ 异常率：60-70%

### 步骤4: 查看后端日志

后端日志应该显示：

```
[StreamParserService] CSV表头: 姓名,手机号码,地址,入职日期
[StreamParserService] 列类型识别结果: {"姓名":"TEXT","手机号码":"PHONE","地址":"ADDRESS","入职日期":"DATE"}
[DataCleanerService] 批量插入清洁数据: 3条
[DataCleanerService] 批量插入错误日志: 9条
[DataCleanerService] 流式数据清洗完成: job_xxx, 清洁数据: 3行, 异常数据: 9行
```

## 附加说明

### 为什么之前的测试通过了？

之前的单元测试（`test-dirty-validation.ts`）直接调用了各个清洗服务（`PhoneCleanerService`、`AddressCleanerService` 等），并手动指定了列类型，所以测试通过了。

但在实际的流式处理中，列类型识别逻辑有问题，导致所有字段都被识别为 `TEXT` 类型，从而跳过了验证。

### 性能影响

修改后的代码会先将所有CSV数据加载到内存中，然后再处理。对于小文件（< 10MB）这不是问题，但对于大文件可能会增加内存使用。

如果需要处理超大文件（> 100MB），可以考虑：
1. 使用两次遍历：第一次识别列类型，第二次处理数据
2. 或者使用固定的样本大小（如前1000行）来识别列类型

但对于当前的使用场景（人事数据清洗），这个修改是合适的。

## 相关文件

- 修改的文件：`data-cleaning-service/src/services/stream-parser.service.ts`
- 影响的功能：CSV文件的流式解析和列类型识别
- 测试文件：`testdoc/dirty_test_data.csv`
