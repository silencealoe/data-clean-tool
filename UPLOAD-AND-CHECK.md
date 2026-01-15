# 上传测试文件并检查结果

## 步骤 1: 上传文件

请通过前端上传文件: `testdoc/dirty_test_data.csv`

或者使用 curl 命令:
```bash
curl -X POST http://localhost:3100/api/data-cleaning/upload \
  -F "file=@testdoc/dirty_test_data.csv"
```

## 步骤 2: 记录 Job ID

上传后会返回一个 jobId，例如: `job_1234567890_abc123`

## 步骤 3: 查看后端日志

后端日志应该显示:
- ✅ 列类型识别结果
- ✅ 每行的清洗详情
- ✅ 字段清洗成功/失败信息
- ✅ 最终统计: 清洁数据 X 行，异常数据 Y 行

## 步骤 4: 查询任务状态

```bash
curl http://localhost:3100/api/data-cleaning/status/YOUR_JOB_ID
```

应该看到:
```json
{
  "jobId": "job_xxx",
  "status": "completed",
  "progress": 100,
  "statistics": {
    "totalRows": 15,
    "cleanedRows": 8,
    "exceptionRows": 7,
    "processingTime": 123
  }
}
```

## 步骤 5: 查看数据库

运行检查脚本:
```bash
cd data-cleaning-service
npx ts-node ../check-database.ts
```

## 预期结果

- **总行数**: 15
- **清洁行数**: 6-8
- **异常行数**: 7-9

### 异常数据明细:
1. 行2: 手机号 `138-1234-5678` → 10位数字 (错误)
2. 行4: 日期 `23/08/15` → 2位年份 (错误)
3. 行5: 手机号 `139-123-45678` → 12位数字 (错误)
4. 行8: 手机号 `1391234567890` → 13位数字 (错误)
5. 行10: 手机号 `139-1234-567` + 日期 `23-07-20` → 双重错误
6. 行11: 手机号 `13912345` → 8位数字 (错误)
7. 行13: 地址 `广东省广州市` → 不完整 (错误)
8. 行14: 地址 `东路800号` → 不完整 (错误)

## 如果仍然显示 0 异常行

请立即告诉我，我会进一步诊断。
