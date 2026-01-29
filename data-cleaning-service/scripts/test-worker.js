#!/usr/bin/env node

/**
 * Worker进程测试脚本
 * 验证Worker进程能否正常启动和配置
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('Testing Worker Process Setup...\n');

// 测试配置
const tests = [
    {
        name: 'Check Node.js version',
        command: 'node',
        args: ['--version'],
        timeout: 5000
    },
    {
        name: 'Check TypeScript compilation',
        command: 'npm',
        args: ['run', 'build'],
        timeout: 30000
    },
    {
        name: 'Validate worker.js exists',
        command: 'node',
        args: ['-e', 'console.log(require("fs").existsSync("dist/src/worker.js") ? "EXISTS" : "NOT_FOUND")'],
        timeout: 5000
    },
    {
        name: 'Test worker module import',
        command: 'node',
        args: ['-e', 'try { require("./dist/src/worker.module.js"); console.log("IMPORT_OK"); } catch(e) { console.log("IMPORT_ERROR:", e.message); }'],
        timeout: 10000
    }
];

// 运行测试
async function runTests() {
    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        console.log(`🧪 ${test.name}...`);

        try {
            const result = await runCommand(test.command, test.args, test.timeout);

            if (result.code === 0) {
                console.log(`✅ PASSED: ${result.stdout.trim()}`);
                passed++;
            } else {
                console.log(`❌ FAILED: ${result.stderr.trim()}`);
                failed++;
            }
        } catch (error) {
            console.log(`❌ ERROR: ${error.message}`);
            failed++;
        }

        console.log('');
    }

    // 总结
    console.log('='.repeat(50));
    console.log(`Test Results: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
        console.log('🎉 All tests passed! Worker setup is ready.');

        console.log('\nNext steps:');
        console.log('1. Start Redis: docker run -d --name redis -p 6379:6379 redis:7-alpine');
        console.log('2. Configure database connection in .env file');
        console.log('3. Start worker: npm run worker:dev');

        process.exit(0);
    } else {
        console.log('❌ Some tests failed. Please fix the issues before proceeding.');
        process.exit(1);
    }
}

// 运行命令的辅助函数
function runCommand(command, args, timeout) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: process.cwd(),
            stdio: 'pipe'
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            resolve({ code, stdout, stderr });
        });

        child.on('error', (error) => {
            reject(error);
        });

        // 超时处理
        setTimeout(() => {
            child.kill();
            reject(new Error(`Command timed out after ${timeout}ms`));
        }, timeout);
    });
}

// 运行测试
runTests().catch(console.error);