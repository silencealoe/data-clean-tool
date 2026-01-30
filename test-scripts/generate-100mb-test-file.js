/**
 * 生成100MB大小的测试CSV文件
 * 格式：姓名,手机号,地址,生日
 */

const fs = require('fs');
const path = require('path');

// 姓名数据池
const surnames = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗', '梁', '宋', '郑', '谢', '韩', '唐', '冯', '于', '董', '萧', '程', '曹', '袁', '邓', '许', '傅', '沈', '曾', '彭', '吕'];
const givenNames = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '霞', '平', '刚', '桂英', '建华', '文', '华', '金凤', '志强', '秀兰', '建国', '国强', '玉兰', '秀珍', '志明', '春梅', '桂兰', '玉梅', '丽娟', '建军', '国华', '玉华'];

// 地址数据池
const addresses = [
    '北京市朝阳区建国路1号',
    '北京市海淀区中关村大街2号',
    '北京市西城区西单北大街3号',
    '北京市东城区王府井大街4号',
    '上海市浦东新区陆家嘴路100号',
    '上海市黄浦区南京东路200号',
    '上海市徐汇区淮海中路300号',
    '上海市静安区南京西路400号',
    '深圳市南山区科技园',
    '深圳市福田区华强北路500号',
    '深圳市罗湖区东门步行街600号',
    '深圳市宝安区新安街道700号',
    '广州市天河区珠江新城800号',
    '广州市越秀区北京路900号',
    '广州市海珠区江南大道1000号',
    '杭州市西湖区文三路1100号',
    '杭州市拱墅区莫干山路1200号',
    '南京市鼓楼区中山路1300号',
    '南京市玄武区中央路1400号',
    '武汉市武昌区中南路1500号',
    '武汉市汉口区江汉路1600号',
    '成都市锦江区春熙路1700号',
    '成都市武侯区天府大道1800号',
    '重庆市渝中区解放碑1900号',
    '重庆市江北区观音桥2000号',
    '西安市雁塔区小寨路2100号',
    '西安市碑林区钟楼2200号',
    '天津市和平区南京路2300号',
    '天津市河西区友谊路2400号',
    '青岛市市南区香港中路2500号',
    '青岛市崂山区海尔路2600号',
    '大连市中山区人民路2700号',
    '大连市沙河口区西安路2800号',
    '沈阳市和平区太原街2900号',
    '沈阳市沈河区中街3000号',
    '长春市朝阳区人民大街3100号',
    '哈尔滨市道里区中央大街3200号',
    '济南市历下区泉城路3300号',
    '郑州市金水区花园路3400号',
    '合肥市蜀山区长江西路3500号',
    '福州市鼓楼区五四路3600号',
    '厦门市思明区中山路3700号',
    '南昌市东湖区八一大道3800号',
    '长沙市芙蓉区五一大道3900号',
    '昆明市五华区金碧路4000号',
    '贵阳市南明区中华南路4100号',
    '兰州市城关区东方红广场4200号',
    '银川市兴庆区解放东街4300号',
    '西宁市城中区西大街4400号',
    '乌鲁木齐市天山区人民路4500号'
];

// 生成随机姓名
function generateName() {
    const surname = surnames[Math.floor(Math.random() * surnames.length)];
    const givenName = givenNames[Math.floor(Math.random() * givenNames.length)];
    return surname + givenName;
}

// 生成随机手机号（多种格式）
function generatePhone() {
    const formats = [
        // 标准格式
        () => `1${Math.floor(Math.random() * 9) + 3}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
        // 带横线格式
        () => {
            const prefix = `1${Math.floor(Math.random() * 9) + 3}${Math.floor(Math.random() * 10)}`;
            const middle = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            const suffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            return `${prefix}-${middle}-${suffix}`;
        },
        // 老式固话格式
        () => `${Math.floor(Math.random() * 900) + 100}${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
        // 带区号的固话
        () => {
            const areaCode = ['010', '021', '0755', '020', '0571', '025', '027', '028', '023', '029'][Math.floor(Math.random() * 10)];
            const number = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
            return `${areaCode}-${number}`;
        }
    ];

    const format = formats[Math.floor(Math.random() * formats.length)];
    return format();
}

// 生成随机地址
function generateAddress() {
    return addresses[Math.floor(Math.random() * addresses.length)];
}

// 生成随机生日（多种格式）
function generateBirthday() {
    const year = Math.floor(Math.random() * 50) + 1960; // 1960-2009
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1; // 避免月份天数问题

    const formats = [
        // YYYY/MM/DD
        () => `${year}/${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`,
        // YYYY-MM-DD
        () => `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
        // 中文格式
        () => `${year}年${month}月${day}日`,
        // MM/DD/YYYY
        () => `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`,
        // DD-MM-YYYY
        () => `${day.toString().padStart(2, '0')}-${month.toString().padStart(2, '0')}-${year}`
    ];

    const format = formats[Math.floor(Math.random() * formats.length)];
    return format();
}

// 生成一行数据
function generateRow() {
    const name = generateName();
    const phone = generatePhone();
    const address = generateAddress();
    const birthday = generateBirthday();

    return `${name},${phone},${address},${birthday}`;
}

// 估算行数以达到100MB
function estimateRowsFor100MB() {
    // 生成一些样本行来估算平均长度
    const sampleRows = [];
    for (let i = 0; i < 1000; i++) {
        sampleRows.push(generateRow());
    }

    const totalLength = sampleRows.join('\n').length;
    const avgRowLength = totalLength / sampleRows.length;

    console.log(`样本行平均长度: ${avgRowLength.toFixed(2)} 字节`);

    // 目标大小：100MB = 100 * 1024 * 1024 字节
    const targetSize = 100 * 1024 * 1024;
    const estimatedRows = Math.floor(targetSize / avgRowLength);

    console.log(`估算需要生成 ${estimatedRows.toLocaleString()} 行数据`);
    return estimatedRows;
}

// 生成文件
async function generateFile() {
    const filename = 'test-data-100mb.csv';
    const estimatedRows = estimateRowsFor100MB();

    console.log(`开始生成 ${filename}...`);
    console.log(`目标大小: 100MB`);
    console.log(`预计行数: ${estimatedRows.toLocaleString()}`);

    const writeStream = fs.createWriteStream(filename);

    // 写入表头
    writeStream.write('姓名,手机号,地址,生日\n');

    let currentSize = 0;
    let rowCount = 0;
    const targetSize = 100 * 1024 * 1024; // 100MB

    // 批量写入以提高性能
    const batchSize = 10000;
    let batch = [];

    const startTime = Date.now();

    while (currentSize < targetSize) {
        const row = generateRow();
        batch.push(row);

        if (batch.length >= batchSize) {
            const batchData = batch.join('\n') + '\n';
            writeStream.write(batchData);
            currentSize += Buffer.byteLength(batchData, 'utf8');
            rowCount += batch.length;
            batch = [];

            // 显示进度
            const progress = (currentSize / targetSize * 100).toFixed(1);
            const currentMB = (currentSize / 1024 / 1024).toFixed(1);
            process.stdout.write(`\r进度: ${progress}% (${currentMB}MB / 100MB) - ${rowCount.toLocaleString()} 行`);
        }
    }

    // 写入剩余的批次
    if (batch.length > 0) {
        const batchData = batch.join('\n') + '\n';
        writeStream.write(batchData);
        currentSize += Buffer.byteLength(batchData, 'utf8');
        rowCount += batch.length;
    }

    writeStream.end();

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`\n\n✅ 文件生成完成！`);
    console.log(`文件名: ${filename}`);
    console.log(`实际大小: ${(currentSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`总行数: ${rowCount.toLocaleString()} 行（包含表头）`);
    console.log(`生成时间: ${duration.toFixed(2)} 秒`);
    console.log(`生成速度: ${(rowCount / duration).toFixed(0)} 行/秒`);

    // 显示文件的前几行作为预览
    console.log('\n📋 文件预览（前5行）:');
    const fileContent = fs.readFileSync(filename, 'utf8');
    const lines = fileContent.split('\n').slice(0, 6);
    lines.forEach((line, index) => {
        if (line.trim()) {
            console.log(`${index + 1}: ${line}`);
        }
    });
}

// 运行生成器
generateFile().catch(console.error);