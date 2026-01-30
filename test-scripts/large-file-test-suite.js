const fs = require('fs');
const path = require('path');
const { generateLargeCSVFile } = require('./generate-large-test-file');
const { testLargeFileUpload } = require('./test-large-file-upload');

/**
 * 大文件测试套件
 * 提供生成大文件和测试上传的完整流程
 */

function showMenu() {
    console.log('\\n=== 大文件测试套件 ===');
    console.log('1. 生成1GB测试文件');
    console.log('2. 测试大文件上传');
    console.log('3. 完整测试流程 (生成 + 上传)');
    console.log('4. 检查现有文件状态');
    console.log('5. 清理测试文件');
    console.log('0. 退出');
    console.log('========================');
}

async function checkFileStatus() {
    const largeFilePath = path.join(__dirname, 'large-test-data.csv');

    if (fs.existsSync(largeFilePath)) {
        const stats = fs.statSync(largeFilePath);
        const sizeGB = stats.size / 1024 / 1024 / 1024;
        const createdTime = stats.birthtime;

        console.log('\\n=== 文件状态 ===');
        console.log(`文件路径: ${largeFilePath}`);
        console.log(`文件大小: ${sizeGB.toFixed(2)} GB (${stats.size.toLocaleString()} 字节)`);
        console.log(`创建时间: ${createdTime.toLocaleString()}`);
        console.log(`文件存在: ✅`);

        // 估算行数（基于平均行长度）
        const sampleSize = Math.min(1024 * 1024, stats.size); // 读取1MB样本
        const buffer = Buffer.alloc(sampleSize);
        const fd = fs.openSync(largeFilePath, 'r');
        fs.readSync(fd, buffer, 0, sampleSize, 0);
        fs.closeSync(fd);

        const sampleText = buffer.toString('utf8');
        const lines = sampleText.split('\\n');
        const avgLineLength = sampleText.length / lines.length;
        const estimatedRows = Math.floor(stats.size / avgLineLength);

        console.log(`估算行数: ${estimatedRows.toLocaleString()} 行`);
        console.log(`平均行长: ${avgLineLength.toFixed(0)} 字节`);

    } else {
        console.log('\\n=== 文件状态 ===');
        console.log(`文件路径: ${largeFilePath}`);
        console.log(`文件存在: ❌`);
        console.log('需要先生成测试文件');
    }
}

async function cleanupFiles() {
    const largeFilePath = path.join(__dirname, 'large-test-data.csv');

    if (fs.existsSync(largeFilePath)) {
        const stats = fs.statSync(largeFilePath);
        const sizeGB = stats.size / 1024 / 1024 / 1024;

        console.log(`\\n发现大文件: ${sizeGB.toFixed(2)} GB`);

        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answer = await new Promise(resolve => {
            readline.question('确认删除？(y/N): ', resolve);
        });
        readline.close();

        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            console.log('正在删除文件...');
            fs.unlinkSync(largeFilePath);
            console.log('✅ 文件已删除');
        } else {
            console.log('取消删除');
        }
    } else {
        console.log('\\n没有找到需要清理的文件');
    }
}

async function generateFile() {
    console.log('\\n=== 生成1GB测试文件 ===');

    const largeFilePath = path.join(__dirname, 'large-test-data.csv');

    // 检查磁盘空间
    try {
        const stats = fs.statSync(__dirname);
        console.log('检查磁盘空间...');

        // 检查是否已存在文件
        if (fs.existsSync(largeFilePath)) {
            const existingStats = fs.statSync(largeFilePath);
            const sizeGB = existingStats.size / 1024 / 1024 / 1024;

            console.log(`发现已存在的文件: ${sizeGB.toFixed(2)} GB`);

            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const answer = await new Promise(resolve => {
                readline.question('是否重新生成？(y/N): ', resolve);
            });
            readline.close();

            if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
                console.log('使用现有文件');
                return;
            }

            console.log('删除现有文件...');
            fs.unlinkSync(largeFilePath);
        }

        await generateLargeCSVFile(largeFilePath, 1);
        console.log('✅ 文件生成完成');

    } catch (error) {
        console.error('❌ 生成文件失败:', error.message);
    }
}

async function testUpload() {
    console.log('\\n=== 测试大文件上传 ===');

    const largeFilePath = path.join(__dirname, 'large-test-data.csv');

    if (!fs.existsSync(largeFilePath)) {
        console.log('❌ 测试文件不存在，请先生成文件');
        return;
    }

    await testLargeFileUpload();
}

async function fullTest() {
    console.log('\\n=== 完整测试流程 ===');

    // 1. 生成文件
    await generateFile();

    // 2. 等待用户确认
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    await new Promise(resolve => {
        readline.question('\\n文件生成完成，按回车键继续测试上传...', resolve);
    });
    readline.close();

    // 3. 测试上传
    await testUpload();
}

async function main() {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    while (true) {
        showMenu();

        const choice = await new Promise(resolve => {
            readline.question('请选择操作 (0-5): ', resolve);
        });

        switch (choice) {
            case '1':
                await generateFile();
                break;
            case '2':
                await testUpload();
                break;
            case '3':
                await fullTest();
                break;
            case '4':
                await checkFileStatus();
                break;
            case '5':
                await cleanupFiles();
                break;
            case '0':
                console.log('退出测试套件');
                readline.close();
                return;
            default:
                console.log('无效选择，请重新输入');
        }

        // 等待用户按键继续
        await new Promise(resolve => {
            readline.question('\\n按回车键继续...', resolve);
        });
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(error => {
        console.error('测试套件运行失败:', error.message);
        process.exit(1);
    });
}

module.exports = {
    generateFile,
    testUpload,
    fullTest,
    checkFileStatus,
    cleanupFiles
};