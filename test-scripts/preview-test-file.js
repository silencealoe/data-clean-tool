/**
 * 预览测试文件的前几行
 */

const fs = require('fs');
const readline = require('readline');

async function previewFile(filename, lines = 10) {
    console.log(`预览文件: ${filename}`);
    console.log('=' * 50);

    try {
        // 获取文件大小
        const stats = fs.statSync(filename);
        const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`文件大小: ${fileSizeMB} MB`);
        console.log('');

        const fileStream = fs.createReadStream(filename);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let lineCount = 0;

        for await (const line of rl) {
            console.log(`${lineCount + 1}: ${line}`);
            lineCount++;

            if (lineCount >= lines) {
                break;
            }
        }

        rl.close();
        fileStream.close();

    } catch (error) {
        console.error('预览文件失败:', error.message);
    }
}

// 预览生成的文件
previewFile('test-data-100mb.csv', 10);