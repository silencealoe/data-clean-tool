# 数据清洗异常数据显示问题诊断指南

## 问题描述
上传包含脏数据的文件后，系统显示没有异常数据。

## 已验证的事实
✅ 数据清洗逻辑是正确的（已通过单元测试验证）
✅ 以下脏数据应该被识别为异常：
   - 赵六: 1391234567 (10位手机号)
   - 钱七: 139-123-45678 (格式错误)
   - 吴十: 1391234567890 (13位手机号)
   - 郑十一: 139-1234-567 (格式错误)
   - 陈十二: 13912345 (8位手机号)
   - 李十四: 广东省广州市 (缺少区和详细地址)
   - 王十五: 东路800号 (缺少省市区)
   - 赵六: 23/08/15 (2位年份)
   - 郑十一: 23-07-20 (2位年份)

## 诊断步骤

### 步骤1: 检查后端服务状态
```bash
cd data-cleaning-service
npm run start:dev
```

查看控制台输出，确认服务正常启动。

### 步骤2: 检查数据库连接
确认 `.env` 文件中的数据库配置正确：
```
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=root123456
DB_DATABASE=data_clean_tool
```

### 步骤3: 清空旧数据（可选）
如果数据库中有旧的测试数据，可能会影响结果。

连接到MySQL数据库：
```bash
mysql -u root -p
```

清空相关表：
```sql
USE data_clean_tool;
TRUNCATE TABLE clean_data;
TRUNCATE TABLE error_log;
DELETE FROM file_record WHERE status = 'completed';
```

### 步骤4: 重新上传测试文件
1. 启动前端服务（如果未启动）：
   ```bash
   cd data-cleaning-frontend
   npm run dev
   ```

2. 访问 http://localhost:5173

3. 上传 `testdoc/dirty_test_data.csv` 文件

4. 等待处理完成

### 步骤5: 检查后端日志
在后端服务的控制台中查找以下关键日志：
- `开始流式处理文件`
- `批量插入清洁数据: X条`
- `批量插入错误日志: X条`
- `流式数据清洗完成`

特别注意 `exceptionRows` 的数量。

### 步骤6: 直接查询数据库
```sql
USE data_clean_tool;

-- 查询最近的文件记录
SELECT id, jobId, originalFileName, status, totalRows, cleanedRows, exceptionRows 
FROM file_record 
ORDER BY uploadedAt DESC 
LIMIT 5;

-- 使用上面查询到的 jobId，查询异常数据数量
SELECT COUNT(*) as error_count 
FROM error_log 
WHERE jobId = 'YOUR_JOB_ID_HERE';

-- 查看异常数据详情
SELECT rowNumber, originalData, errors 
FROM error_log 
WHERE jobId = 'YOUR_JOB_ID_HERE' 
LIMIT 10;
```

### 步骤7: 检查前端API调用
打开浏览器开发者工具（F12），切换到 Network 标签：

1. 查看文件详情页面的API调用：
   - `GET /api/data-cleaning/files/{fileId}`
   - 检查返回的 `exceptionRows` 字段

2. 查看异常数据查询API：
   - `GET /api/data-cleaning/data/exceptions/{jobId}`
   - 检查返回的数据数量

## 可能的问题和解决方案

### 问题1: 后端服务使用了旧代码
**解决方案**: 重启后端服务
```bash
cd data-cleaning-service
# 停止当前服务（Ctrl+C）
npm run start:dev
```

### 问题2: 数据库中有缓存数据
**解决方案**: 清空数据库表（见步骤3）

### 问题3: 前端显示了缓存数据
**解决方案**: 
- 清除浏览器缓存
- 硬刷新页面（Ctrl+Shift+R）
- 或者在开发者工具中禁用缓存

### 问题4: 列类型识别错误
**检查方法**: 在后端日志中查找 `列类型:` 输出

如果列类型识别错误（例如手机号被识别为TEXT），则不会进行验证。

**解决方案**: 检查 `parser.service.ts` 中的列类型识别逻辑。

### 问题5: 数据库字段类型问题
**检查方法**: 
```sql
DESCRIBE error_log;
```

确认 `errors` 字段类型为 `JSON` 或 `TEXT`。

## 预期结果

正确处理 `dirty_test_data.csv` 后，应该看到：
- 总行数: 15行（包含3行空行）
- 清洁数据: 约3-4行
- 异常数据: 约8-9行
- 异常率: 约60-70%

## 需要帮助？

如果按照以上步骤仍然无法解决问题，请提供：
1. 后端服务的完整日志输出
2. 数据库查询结果
3. 浏览器Network标签中的API响应
4. 文件记录表中的 `exceptionRows` 值
