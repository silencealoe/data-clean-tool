# 服务启动测试指南

## 问题修复

已修复 `ParallelProcessingManagerService` 依赖注入错误。

## 修复内容

在 `src/app.module.ts` 中添加了以下服务到 providers 数组：

1. ParallelProcessingManagerService
2. ChunkSplitterService
3. WorkerPoolService
4. ResultCollectorService
5. ProgressTrackerService
6. PerformanceMonitorService
7. ResourceMonitorService

## 验证步骤

### 1. 编译检查

```bash
cd data-cleaning-service
npm run build
```

预期结果：编译成功，无错误

### 2. 启动服务（开发模式）

```bash
npm run start:dev
```

预期结果：
- 服务成功启动
- 看到 "Nest application successfully started" 消息
- 没有依赖注入错误

### 3. 启动服务（生产模式）

```bash
npm run start
```

预期结果：服务正常启动

### 4. 检查日志

启动后应该看到类似以下的日志：

```
[Nest] 12345  - 2026/01/16 10:00:00     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 2026/01/16 10:00:00     LOG [InstanceLoader] AppModule dependencies initialized
[Nest] 12345  - 2026/01/16 10:00:00     LOG [InstanceLoader] TypeOrmModule dependencies initialized
[Nest] 12345  - 2026/01/16 10:00:00     LOG [InstanceLoader] ConfigModule dependencies initialized
[Nest] 12345  - 2026/01/16 10:00:00     LOG [DataCleanerService] DataCleanerService 初始化: 并行处理=启用, 工作线程数=4, 最小并行记录数=1000
[Nest] 12345  - 2026/01/16 10:00:00     LOG [NestApplication] Nest application successfully started
```

### 5. 测试 API 端点

```bash
# 测试健康检查
curl http://localhost:3000/

# 测试 Swagger 文档
curl http://localhost:3000/api

# 测试新增的进度查询端点（需要有效的 jobId）
curl http://localhost:3000/api/data-cleaning/progress/test-job-001
```

## 常见问题

### Q1: 仍然出现依赖注入错误

**解决方案：**
1. 确保所有服务文件都有 `@Injectable()` 装饰器
2. 清理并重新构建：
   ```bash
   rm -rf dist node_modules
   npm install
   npm run build
   ```

### Q2: 数据库连接错误

**解决方案：**
1. 检查 `.env` 文件中的数据库配置
2. 确保 MySQL 服务正在运行
3. 验证数据库凭据

### Q3: 端口已被占用

**解决方案：**
1. 修改 `.env` 文件中的 `PORT` 配置
2. 或者停止占用端口的进程

## 成功标志

✅ 服务启动无错误
✅ 所有依赖注入成功
✅ DataCleanerService 初始化日志显示
✅ API 端点可访问
✅ Swagger 文档可访问

## 下一步

服务启动成功后，可以：

1. 测试文件上传功能
2. 测试并行处理功能
3. 测试新增的进度查询、性能指标和性能报告端点
4. 运行完整的集成测试

## 相关文档

- [DEPENDENCY-INJECTION-FIX.md](./DEPENDENCY-INJECTION-FIX.md) - 依赖注入修复详情
- [TASK-12-SUMMARY.md](./TASK-12-SUMMARY.md) - 任务12完成总结
- [README.md](./README.md) - 项目说明文档
