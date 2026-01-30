# 测试脚本文件夹

这个文件夹包含用于测试数据清洗系统的各种脚本和工具。

## 文件分类

### 数据生成脚本
- `generate-100mb-test-file.js` - 生成100MB测试CSV文件
- `generate-large-test-file.js` - 生成大文件测试数据
- `generate-medium-test-file.js` - 生成中等大小测试文件
- `generate_excel_test.js` - 生成Excel测试文件
- `generate_test_data.py` - Python数据生成脚本
- `large-file-test-suite.js` - 大文件测试套件

### API测试脚本
- `test-api-simple.js` - 简单API测试
- `test-api-status.js` - API状态测试
- `test-upload-*.js` - 文件上传测试脚本
- `test-sync-*.js` - 同步功能测试
- `test-status-sync.js` - 状态同步测试
- `test-failure-sync.js` - 失败同步测试

### 系统检查脚本
- `check-database.ts` - 数据库连接检查
- `check-redis-*.js` - Redis连接和队列检查
- `check-task-status.js` - 任务状态检查

### 数据处理测试
- `test-data-processing.ts` - 数据处理功能测试
- `test-dirty-data*.ts` - 脏数据处理测试
- `test-column-type-recognition.ts` - 列类型识别测试

### 其他工具
- `simple-test.js` - 简单功能测试
- `preview-test-file.js` - 测试文件预览

## 使用方法

### 生成测试数据
```bash
# 生成100MB测试文件
node test-scripts/generate-100mb-test-file.js

# 运行大文件测试套件
node test-scripts/large-file-test-suite.js
```

### 运行API测试
```bash
# 简单API测试
node test-scripts/test-api-simple.js

# 文件上传测试
node test-scripts/test-upload-simple.js
```

### 系统检查
```bash
# 检查Redis连接
node test-scripts/check-redis-simple.js

# 检查任务状态
node test-scripts/check-task-status.js
```

## 注意事项

- 运行测试前请确保后端服务已启动
- 大文件测试可能需要较长时间
- 某些测试脚本需要配置正确的API端点
- 测试数据会保存在 `../test-data/` 文件夹中