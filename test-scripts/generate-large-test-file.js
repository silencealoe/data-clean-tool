const fs = require('fs');
const path = require('path');

/**
 * 生成大文件测试脚本
 * 创建一个1GB的CSV文件用于测试大文件上传和处理
 */

function generateLargeCSVFile(filePath, targetSizeGB = 1) {
    console.log(`开始生成 ${targetSizeGB}GB 的测试CSV文件...`);

    const targetSizeBytes = targetSizeGB * 1024 * 1024 * 1024; // 转换为字节
    const writeStream = fs.createWriteStream(filePath);

    // CSV头部
    const header = 'id,姓名,电话,邮箱,地址,出生日期,身份证号,公司,职位,薪资,备注\n';
    writeStream.write(header);

    let currentSize = Buffer.byteLength(header, 'utf8');
    let rowCount = 0;

    // 预定义的测试数据模板
    const names = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑十一', '王十二'];
    const cities = ['北京市朝阳区', '上海市浦东新区', '广州市天河区', '深圳市南山区', '杭州市西湖区', '成都市锦江区', '武汉市洪山区', '南京市鼓楼区', '西安市雁塔区', '重庆市渝中区'];
    const companies = ['阿里巴巴', '腾讯科技', '百度公司', '字节跳动', '美团', '滴滴出行', '京东集团', '网易公司', '新浪微博', '搜狐公司'];
    const positions = ['软件工程师', '产品经理', '数据分析师', '运营专员', '市场经理', '设计师', '测试工程师', '项目经理', '销售代表', '客服专员'];

    console.log('开始写入数据行...');
    const startTime = Date.now();

    while (currentSize < targetSizeBytes) {
        rowCount++;

        // 生成随机数据行
        const id = rowCount;
        const name = names[rowCount % names.length];
        const phone = `1${Math.floor(Math.random() * 9) + 3}${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`;
        const email = `user${rowCount}@example.com`;
        const address = cities[rowCount % cities.length] + `第${Math.floor(Math.random() * 999) + 1}号`;
        const birthDate = `19${Math.floor(Math.random() * 40) + 60}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;
        const idCard = `${Math.floor(Math.random() * 900000) + 100000}19${Math.floor(Math.random() * 40) + 60}${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}${Math.floor(Math.random() * 9000) + 1000}`;
        const company = companies[rowCount % companies.length];
        const position = positions[rowCount % positions.length];
        const salary = Math.floor(Math.random() * 50000) + 5000;
        const note = `这是第${rowCount}条测试数据，用于验证大文件处理能力和数据清洗功能的稳定性和性能表现`;

        const row = `${id},${name},${phone},${email},${address},${birthDate},${idCard},${company},${position},${salary},${note}\n`;

        writeStream.write(row);
        currentSize += Buffer.byteLength(row, 'utf8');

        // 每10万行显示一次进度
        if (rowCount % 100000 === 0) {
            const progress = (currentSize / targetSizeBytes * 100).toFixed(2);
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = (rowCount / elapsed).toFixed(0);
            console.log(`进度: ${progress}% | 已写入: ${rowCount.toLocaleString()} 行 | 文件大小: ${(currentSize / 1024 / 1024).toFixed(2)} MB | 速度: ${speed} 行/秒`);
        }
    }

    writeStream.end();

    return new Promise((resolve, reject) => {
        writeStream.on('finish', () => {
            const endTime = Date.now();
            const totalTime = (endTime - startTime) / 1000;
            const finalSize = fs.statSync(filePath).size;

            console.log('\n=== 文件生成完成 ===');
            console.log(`文件路径: ${filePath}`);
            console.log(`文件大小: ${(finalSize / 1024 / 1024 / 1024).toFixed(2)} GB (${finalSize.toLocaleString()} 字节)`);
            console.log(`数据行数: ${rowCount.toLocaleString()} 行`);
            console.log(`生成耗时: ${totalTime.toFixed(2)} 秒`);
            console.log(`平均速度: ${(rowCount / totalTime).toFixed(0)} 行/秒`);
            console.log(`写入速度: ${(finalSize / 1024 / 1024 / totalTime).toFixed(2)} MB/秒`);

            resolve({
                filePath,
                fileSize: finalSize,
                rowCount,
                generationTime: totalTime
            });
        });

        writeStream.on('error', reject);
    });
}

async function main() {
    try {
        const filePath = path.join(__dirname, 'large-test-data.csv');

        // 检查是否已存在文件
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            const sizeGB = stats.size / 1024 / 1024 / 1024;

            console.log(`发现已存在的大文件: ${filePath}`);
            console.log(`文件大小: ${sizeGB.toFixed(2)} GB`);

            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const answer = await new Promise(resolve => {
                readline.question('是否重新生成？(y/N): ', resolve);
            });
            readline.close();

            if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
                console.log('使用现有文件。');
                return;
            }

            console.log('删除现有文件...');
            fs.unlinkSync(filePath);
        }

        // 检查磁盘空间
        console.log('检查磁盘空间...');
        const stats = fs.statSync(__dirname);
        console.log('开始生成1GB测试文件...');

        await generateLargeCSVFile(filePath, 1);

        console.log('\n=== 测试建议 ===');
        console.log('1. 使用以下命令测试上传:');
        console.log(`   curl -X POST -F "file=@large-test-data.csv" http://localhost:3101/api/data-cleaning/upload`);
        console.log('2. 监控系统资源使用情况');
        console.log('3. 观察处理进度和性能指标');
        console.log('4. 验证数据库状态同步');
        console.log('\n注意: 大文件处理可能需要较长时间，请耐心等待。');

    } catch (error) {
        console.error('生成文件失败:', error.message);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = { generateLargeCSVFile };