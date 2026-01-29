/**
 * PM2 生态系统配置文件
 * 用于生产环境进程管理和监控
 * 
 * 使用方法:
 * - 启动所有服务: pm2 start ecosystem.config.js
 * - 启动单个服务: pm2 start ecosystem.config.js --only api
 * - 启动Worker: pm2 start ecosystem.config.js --only worker
 * - 监控: pm2 monit
 * - 日志: pm2 logs
 * - 重启: pm2 restart ecosystem.config.js
 * - 停止: pm2 stop ecosystem.config.js
 */

module.exports = {
    apps: [
        {
            // 主Web API服务
            name: 'data-cleaning-api',
            script: 'dist/main.js',
            cwd: '/app',
            instances: 'max', // 使用所有CPU核心
            exec_mode: 'cluster', // 集群模式
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
            },
            env_development: {
                NODE_ENV: 'development',
                PORT: 3000,
            },
            log_file: '/app/logs/api.log',
            out_file: '/app/logs/api.out.log',
            error_file: '/app/logs/api.error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            // 健康检查
            health_check_url: 'http://localhost:3000/health',
            health_check_grace_period: 3000,
            // 自动重启配置
            min_uptime: '10s',
            max_restarts: 10,
            restart_delay: 4000,
        },

        {
            // Worker进程
            name: 'data-cleaning-worker',
            script: 'dist/worker.js',
            cwd: '/app',
            instances: 1, // Worker通常运行单实例，避免任务重复处理
            exec_mode: 'fork', // fork模式
            watch: false,
            max_memory_restart: '2G', // Worker可能需要更多内存
            env: {
                NODE_ENV: 'production',
                WORKER_ID: 1,
            },
            env_development: {
                NODE_ENV: 'development',
                WORKER_ID: 1,
            },
            log_file: '/app/logs/worker.log',
            out_file: '/app/logs/worker.out.log',
            error_file: '/app/logs/worker.error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            // 自动重启配置
            min_uptime: '30s', // Worker需要更长的启动时间
            max_restarts: 5,
            restart_delay: 10000, // Worker重启间隔更长
            // 优雅关闭配置
            kill_timeout: 30000, // 30秒优雅关闭时间
            wait_ready: true,
            listen_timeout: 10000,
        },

        {
            // 额外的Worker进程（可选）
            name: 'data-cleaning-worker-2',
            script: 'dist/worker.js',
            cwd: '/app',
            instances: 1,
            exec_mode: 'fork',
            watch: false,
            max_memory_restart: '2G',
            env: {
                NODE_ENV: 'production',
                WORKER_ID: 2,
            },
            env_development: {
                NODE_ENV: 'development',
                WORKER_ID: 2,
            },
            log_file: '/app/logs/worker-2.log',
            out_file: '/app/logs/worker-2.out.log',
            error_file: '/app/logs/worker-2.error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            min_uptime: '30s',
            max_restarts: 5,
            restart_delay: 10000,
            kill_timeout: 30000,
            wait_ready: true,
            listen_timeout: 10000,
            // 默认不启动，需要手动启动
            autorestart: false,
        }
    ],

    // 部署配置
    deploy: {
        production: {
            user: 'deploy',
            host: ['server1.example.com', 'server2.example.com'],
            ref: 'origin/main',
            repo: 'git@github.com:your-org/data-cleaning-service.git',
            path: '/var/www/data-cleaning-service',
            'pre-deploy-local': '',
            'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
            'pre-setup': '',
            env: {
                NODE_ENV: 'production'
            }
        },

        staging: {
            user: 'deploy',
            host: 'staging.example.com',
            ref: 'origin/develop',
            repo: 'git@github.com:your-org/data-cleaning-service.git',
            path: '/var/www/data-cleaning-service-staging',
            'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging',
            env: {
                NODE_ENV: 'staging'
            }
        }
    }
};