# Worker进程设置指南

本文档描述如何设置和管理独立的Worker进程，用于异步队列处理。

## 概述

Worker进程是一个独立的NestJS应用实例，专门用于处理文件清洗任务。它与主Web API进程分离运行，确保：

- 文件处理不会影响API响应性能
- 可以独立扩展和监控
- 支持优雅关闭和故障恢复
- 提供详细的健康检查和监控

## 快速开始

### 1. 开发环境

```bash
# 启动Redis（必需）
docker run -d --name redis -p 6379:6379 redis:7-alpine

# 启动Worker进程
npm run worker:dev

# 或者使用调试模式
npm run worker:debug
```

### 2. 生产环境

```bash
# 构建应用
npm run build

# 启动Worker进程
npm run worker:prod

# 或者使用进程管理脚本
./scripts/start-worker.sh start
```

## 部署选项

### 选项1: 直接运行

```bash
# Linux/macOS
./scripts/start-worker.sh start

# Windows
scripts\start-worker.bat start
```

### 选项2: PM2进程管理

```bash
# 安装PM2
npm install -g pm2

# 启动所有服务（API + Worker）
pm2 start ecosystem.config.js

# 只启动Worker
pm2 start ecosystem.config.js --only data-cleaning-worker

# 监控
pm2 monit

# 查看日志
pm2 logs data-cleaning-worker
```

### 选项3: Docker容器

```bash
# 构建Worker镜像
docker build -f Dockerfile.worker -t data-cleaning-worker .

# 使用Docker Compose启动完整环境
docker-compose -f docker-compose.worker.yml up -d

# 扩展Worker实例
docker-compose -f docker-compose.worker.yml --profile scale up -d
```

### 选项4: Kubernetes部署

```yaml
# worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: data-cleaning-worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: data-cleaning-worker
  template:
    metadata:
      labels:
        app: data-cleaning-worker
    spec:
      containers:
      - name: worker
        image: data-cleaning-worker:latest
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_HOST
          value: "redis-service"
        - name: DB_HOST
          value: "mysql-service"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - "ps aux | grep worker.js | grep -v grep"
          initialDelaySeconds: 30
          periodSeconds: 30
```

## 配置

### 环境变量

Worker进程使用以下环境变量：

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=password
DB_DATABASE=data_cleaning_service

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# 队列配置
QUEUE_NAME=file-processing
MAX_RETRY_ATTEMPTS=3
TASK_TIMEOUT_MS=1800000
TASK_TTL_SECONDS=604800
PROGRESS_UPDATE_INTERVAL_MS=2000

# Worker配置
WORKER_ID=1
NODE_ENV=production
```

### 配置文件

Worker使用与主应用相同的配置文件：

- `src/config/redis.config.ts` - Redis连接配置
- `src/config/queue.config.ts` - 队列参数配置
- `.env` - 环境变量

## 监控和管理

### 健康检查

Worker进程提供多种健康检查方式：

```bash
# 检查进程状态
./scripts/start-worker.sh status

# 查看日志
./scripts/start-worker.sh logs

# 查看错误日志
./scripts/start-worker.sh logs error

# 实时跟踪日志
./scripts/start-worker.sh logs follow
```

### 性能监控

Worker进程内置性能监控：

- **内存使用**: 监控RSS和堆内存使用
- **CPU使用**: 跟踪CPU使用率
- **任务处理**: 统计处理的任务数量
- **运行时间**: 记录进程运行时间

### 日志管理

日志文件位置：

- **标准日志**: `/var/log/data-cleaning-worker.log`
- **错误日志**: `/var/log/data-cleaning-worker.error.log`
- **PID文件**: `/var/run/data-cleaning-worker.pid`

日志轮转配置（logrotate）：

```bash
# /etc/logrotate.d/data-cleaning-worker
/var/log/data-cleaning-worker*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 worker worker
    postrotate
        /scripts/start-worker.sh restart > /dev/null 2>&1 || true
    endscript
}
```

## 扩展和负载均衡

### 水平扩展

可以运行多个Worker实例来处理更高的负载：

```bash
# 启动多个Worker实例
pm2 start ecosystem.config.js --only data-cleaning-worker
pm2 start ecosystem.config.js --only data-cleaning-worker-2

# 或者使用Docker Compose扩展
docker-compose -f docker-compose.worker.yml up -d --scale worker=3
```

### 负载分配

Worker进程使用Redis队列的FIFO特性自动分配任务：

- 每个Worker从同一个队列获取任务
- Redis的BRPOP操作确保任务不会重复处理
- 支持任务优先级和重试机制

## 故障排除

### 常见问题

1. **Worker无法启动**
   ```bash
   # 检查依赖
   npm install
   npm run build
   
   # 检查Redis连接
   redis-cli ping
   
   # 检查数据库连接
   npm run validate-config
   ```

2. **任务处理失败**
   ```bash
   # 查看错误日志
   ./scripts/start-worker.sh logs error
   
   # 检查队列状态
   redis-cli llen file-processing
   
   # 重启Worker
   ./scripts/start-worker.sh restart
   ```

3. **内存泄漏**
   ```bash
   # 监控内存使用
   ./scripts/start-worker.sh status
   
   # 设置内存限制
   export NODE_OPTIONS="--max-old-space-size=2048"
   ```

### 调试模式

启用详细日志进行调试：

```bash
# 设置日志级别
export LOG_LEVEL=debug

# 启用Node.js调试
npm run worker:debug

# 使用Chrome DevTools
chrome://inspect
```

## 安全考虑

### 进程权限

- Worker进程应以非root用户运行
- 限制文件系统访问权限
- 使用安全的数据库连接

### 网络安全

- Redis连接使用密码认证
- 数据库连接使用SSL/TLS
- 限制网络访问范围

### 资源限制

```bash
# 设置进程资源限制
ulimit -n 65536  # 文件描述符
ulimit -u 32768  # 进程数
ulimit -m 2097152  # 内存限制(KB)
```

## 性能优化

### 数据库连接

- 使用连接池优化数据库性能
- 调整连接池大小和超时设置
- 启用查询缓存

### Redis优化

- 配置适当的内存策略
- 启用持久化选项
- 监控连接数和内存使用

### 系统调优

```bash
# 系统参数优化
echo 'net.core.somaxconn = 65535' >> /etc/sysctl.conf
echo 'vm.overcommit_memory = 1' >> /etc/sysctl.conf
sysctl -p
```

## 备份和恢复

### 数据备份

- 定期备份Redis数据
- 备份数据库和文件存储
- 测试恢复流程

### 灾难恢复

- 准备故障转移方案
- 配置多区域部署
- 建立监控和告警机制

## 更新和维护

### 滚动更新

```bash
# 零停机更新
pm2 reload ecosystem.config.js

# 或者使用蓝绿部署
./scripts/blue-green-deploy.sh
```

### 维护窗口

- 计划定期维护
- 监控系统健康状态
- 及时应用安全补丁

## 支持和文档

- [API文档](./API.md)
- [配置参考](./CONFIG.md)
- [故障排除指南](./TROUBLESHOOTING.md)
- [性能调优指南](./PERFORMANCE.md)