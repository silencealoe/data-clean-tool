/**
 * 生成10MB测试CSV文件
 * 包含姓名、手机号、地址、生日等字段
 * 包含各种格式的数据来测试数据清洗功能
 */

const fs = require('fs');
const path = require('path');

// 测试数据模板
const surnames = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗'];
const givenNames = ['伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀兰', '霞'];

const cities = [
    { name: '北京市', districts: ['朝阳区', '海淀区', '西城区', '东城区', '丰台区', '石景山区'] },
    { name: '上海市', districts: ['浦东新区', '黄浦区', '徐汇区', '长宁区', '静安区', '普陀区'] },
    { name: '深圳市', districts: ['南山区', '福田区', '罗湖区', '宝安区', '龙岗区', '盐田区'] },
    { name: '广州市', districts: ['天河区', '越秀区', '荔湾区', '海珠区', '白云区', '黄埔区'] },
    { name: '杭州市', districts: ['西湖区', '拱墅区', '江干区', '下城区', '上城区', '滨江区'] },
    { name: '成都市', districts: ['锦江区', '青羊区', '金牛区', '武侯区', '成华区', '龙泉驿区'] },
    { name: '重庆市', districts: ['渝中区', '江北区', '南岸区', '九龙坡区', '沙坪坝区', '大渡口区'] },
    { name: '武汉市', districts: ['江汉区', '江岸区', '硚口区', '汉阳区', '武昌区', '青山区'] }
];

const streets = ['建国路', '人民路', '中山路', '解放路', '和平路', '胜利路', '光明路', '幸福路', '团结路', '友谊路', '文化路', '教育路', '科技路', '创新路', '发展路'];

// 生成随机姓名
function generateName() {
    const surname = surnames[Math.floor(Math.random() * surnames.length)];
    const givenName = givenNames[Math.floor(Math.random() * givenNames.length)];
    return surname + givenName;
}

// 生成各种格式的手机号（包含正确和错误格式）
function generatePhone() {
    const formats = [
        // 正确格式
        () => `1${3 + Math.floor(Math.random() * 6)}${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
        () => `1${3 + Math.floor(Math.random() * 6)}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        () => `1${3 + Math.floor(Math.random() * 6)} ${String(Math.floor(Math.random() * 10000)).padStart(4, '0')} ${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,

        // 错误格式（用于测试数据清洗）
        () => `12${String(Math.floor(Math.random() * 1000000000)).padStart(9, '0')}`, // 12开头
        () => `1${String(Math.floor(Math.random() * 10000000000)).padStart(10, '0')}`, // 11位
        () => `invalid_phone_${Math.floor(Math.random() * 1000)}`, // 完全错误
        () => `${Math.floor(Math.random() * 10000000)}`, // 太短
        () => `+86-1${3 + Math.floor(Math.random() * 6)}${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`, // 带国际区号
        () => `(1${3 + Math.floor(Math.random() * 6)})${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`, // 带括号
        () => '', // 空值
    ];

    const format = formats[Math.floor(Math.random() * formats.length)];
    return format();
}

// 生成地址
function generateAddress() {
    const city = cities[Math.floor(Math.random() * cities.length)];
    const district = city.districts[Math.floor(Math.random() * city.districts.length)];
    const street = streets[Math.floor(Math.random() * streets.length)];
    const number = Math.floor(Math.random() * 999) + 1;
    return `${city.name}${district}${street}${number}号`;
}

// 生成各种格式的生日
function generateBirthday() {
    const year = 1960 + Math.floor(Math.random() * 40); // 1960-1999
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1; // 避免月份天数问题

    const formats = [
        // 正确格式
        () => `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`,
        () => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        () => `${year}年${month}月${day}日`,
        () => `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`,

        // 错误格式（用于测试数据清洗）
        () => `${year}/${month}/${day}`, // 不补零
        () => `${year}.${month}.${day}`, // 点分隔
        () => `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`, // 无分隔符
        () => `invalid_date_${Math.floor(Math.random() * 1000)}`, // 完全错误
        () => `${year}/13/32`, // 无效月日
        () => '', // 空值
    ];

    const format = formats[Math.floor(Math.random() * formats.length)];
    return format();
}

// 计算需要生成多少行数据来达到10MB
function calculateRowsNeeded() {
    // 估算每行数据的平均字节数
    const sampleRow = "张伟,13812345678,北京市朝阳区建国路123号,1990/01/15\n";
    const avgBytesPerRow = Buffer.byteLength(sampleRow, 'utf8');
    const targetSizeBytes = 10 * 1024 * 1024; // 10MB
    return Math.floor(targetSizeBytes / avgBytesPerRow);
}

// 生成CSV文件
function generateCSVFile() {
    const outputPath = path.join(__dirname, '..', 'test-data', 'test-data-10mb.csv');
    const rowsNeeded = calculateRowsNeeded();

    console.log(`目标文件大小: 10MB`);
    console.log(`估算需要生成行数: ${rowsNeeded.toLocaleString()}`);
    console.log(`开始生成文件: ${outputPath}`);

    // 创建写入流
    const writeStream = fs.createWriteStream(outputPath);

    // 写入CSV头部
    writeStream.write('姓名,手机号,地址,生日\n');

    let currentSize = 0;
    let rowCount = 0;
    const targetSize = 10 * 1024 * 1024; // 10MB

    // 批量写入数据
    const batchSize = 1000;
    let batch = [];

    while (currentSize < targetSize) {
        // 生成一行数据
        const name = generateName();
        const phone = generatePhone();
        const address = generateAddress();
        const birthday = generateBirthday();

        // 处理包含逗号的字段（用双引号包围）
        const csvRow = [
            name.includes(',') ? `"${name}"` : name,
            phone.includes(',') ? `"${phone}"` : phone,
            address.includes(',') ? `"${address}"` : address,
            birthday.includes(',') ? `"${birthday}"` : birthday
        ].join(',') + '\n';

        batch.push(csvRow);
        currentSize += Buffer.byteLength(csvRow, 'utf8');
        rowCount++;

        // 批量写入
        if (batch.length >= batchSize) {
            writeStream.write(batch.join(''));
            batch = [];

            // 显示进度
            if (rowCount % 10000 === 0) {
                const progress = (currentSize / targetSize * 100).toFixed(1);
                console.log(`已生成 ${rowCount.toLocaleString()} 行, 文件大小: ${(currentSize / 1024 / 1024).toFixed(2)}MB (${progress}%)`);
            }
        }
    }

    // 写入剩余数据
    if (batch.length > 0) {
        writeStream.write(batch.join(''));
    }

    writeStream.end();

    writeStream.on('finish', () => {
        const finalStats = fs.statSync(outputPath);
        const finalSizeMB = (finalStats.size / 1024 / 1024).toFixed(2);

        console.log('\n✅ 文件生成完成!');
        console.log(`📁 文件路径: ${outputPath}`);
        console.log(`📊 总行数: ${rowCount.toLocaleString()} 行`);
        console.log(`📏 文件大小: ${finalSizeMB}MB`);
        console.log(`\n数据格式说明:`);
        console.log(`- 姓名: 随机中文姓名`);
        console.log(`- 手机号: 包含正确格式(13812345678, 138-1234-5678)和错误格式(用于测试清洗)`);
        console.log(`- 地址: 中国主要城市地址`);
        console.log(`- 生日: 包含多种日期格式(1990/01/15, 1990-01-15, 1990年1月15日等)和错误格式`);
        console.log(`\n可以使用此文件测试:`);
        console.log(`- 大文件上传和处理`);
        console.log(`- 数据清洗功能`);
        console.log(`- 进度显示`);
        console.log(`- 异常数据处理`);
    });

    writeStream.on('error', (error) => {
        console.error('❌ 文件生成失败:', error);
    });
}

// 执行生成
if (require.main === module) {
    // 确保test-data目录存在
    const testDataDir = path.join(__dirname, '..', 'test-data');
    if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
    }

    generateCSVFile();
}

module.exports = { generateCSVFile };