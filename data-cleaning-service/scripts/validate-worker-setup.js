#!/usr/bin/env node

/**
 * 简单的Worker设置验证脚本
 * 检查关键文件和依赖是否正确配置
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Worker Process Setup...\n');

const checks = [
    {
        name: 'Worker entry file exists',
        check: () => fs.existsSync('dist/src/worker.js'),
        fix: 'Run: npm run build'
    },
    {
        name: 'Worker module exists',
        check: () => fs.existsSync('dist/src/worker.module.js'),
        fix: 'Run: npm run build'
    },
    {
        name: 'TaskConsumer service exists',
        check: () => fs.existsSync('dist/src/services/queue/task-consumer.service.js'),
        fix: 'Ensure TaskConsumer service is properly implemented'
    },
    {
        name: 'QueueManager service exists',
        check: () => fs.existsSync('dist/src/services/queue/queue-manager.service.js'),
        fix: 'Ensure QueueManager service is properly implemented'
    },
    {
        name: 'Redis config exists',
        check: () => fs.existsSync('dist/src/config/redis.config.js'),
        fix: 'Ensure Redis configuration is properly set up'
    },
    {
        name: 'Queue config exists',
        check: () => fs.existsSync('dist/src/config/queue.config.js'),
        fix: 'Ensure Queue configuration is properly set up'
    },
    {
        name: 'Package.json has worker scripts',
        check: () => {
            try {
                const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
                return pkg.scripts && pkg.scripts.worker;
            } catch {
                return false;
            }
        },
        fix: 'Add worker scripts to package.json'
    },
    {
        name: 'Start worker script exists',
        check: () => fs.existsSync('scripts/start-worker.sh') || fs.existsSync('scripts/start-worker.bat'),
        fix: 'Ensure start-worker scripts are created'
    }
];

let passed = 0;
let failed = 0;

console.log('Running validation checks...\n');

for (const check of checks) {
    process.stdout.write(`${check.name}... `);

    try {
        if (check.check()) {
            console.log('✅ PASS');
            passed++;
        } else {
            console.log('❌ FAIL');
            console.log(`   Fix: ${check.fix}`);
            failed++;
        }
    } catch (error) {
        console.log('❌ ERROR');
        console.log(`   Error: ${error.message}`);
        failed++;
    }
}

console.log('\n' + '='.repeat(50));
console.log(`Validation Results: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
    console.log('🎉 Worker setup validation passed!\n');

    console.log('📋 Next Steps:');
    console.log('1. Ensure Redis is running:');
    console.log('   docker run -d --name redis -p 6379:6379 redis:7-alpine');
    console.log('');
    console.log('2. Configure environment variables in .env:');
    console.log('   REDIS_HOST=localhost');
    console.log('   REDIS_PORT=6379');
    console.log('   DB_HOST=localhost');
    console.log('   DB_PORT=3306');
    console.log('   # ... other database settings');
    console.log('');
    console.log('3. Start the worker process:');
    console.log('   npm run worker:dev    # Development mode');
    console.log('   npm run worker:prod   # Production mode');
    console.log('');
    console.log('4. Monitor worker status:');
    console.log('   # Linux/macOS: ./scripts/start-worker.sh status');
    console.log('   # Windows: scripts\\start-worker.bat status');
    console.log('');
    console.log('✨ Worker process is ready for deployment!');

} else {
    console.log('❌ Worker setup validation failed.');
    console.log('Please fix the issues above before proceeding.');
    process.exit(1);
}

// 显示配置示例
console.log('\n📄 Example .env configuration:');
console.log('# Database Configuration');
console.log('DB_TYPE=mysql');
console.log('DB_HOST=localhost');
console.log('DB_PORT=3306');
console.log('DB_USERNAME=root');
console.log('DB_PASSWORD=password');
console.log('DB_DATABASE=data_cleaning_service');
console.log('');
console.log('# Redis Configuration');
console.log('REDIS_HOST=localhost');
console.log('REDIS_PORT=6379');
console.log('REDIS_PASSWORD=');
console.log('REDIS_DB=0');
console.log('');
console.log('# Queue Configuration');
console.log('QUEUE_NAME=file-processing');
console.log('MAX_RETRY_ATTEMPTS=3');
console.log('TASK_TIMEOUT_MS=1800000');
console.log('TASK_TTL_SECONDS=604800');
console.log('PROGRESS_UPDATE_INTERVAL_MS=2000');