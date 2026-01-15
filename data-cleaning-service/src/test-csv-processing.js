const { readFileSync } = require('fs');
const { parse } = require('csv-parse');
const { PhoneCleanerService } = require('./services/phone-cleaner.service');
const { DateCleanerService } = require('./services/date-cleaner.service');
const { AddressCleanerService } = require('./services/address-cleaner.service');

// 创建服务实例
const phoneCleaner = new PhoneCleanerService();
const dateCleaner = new DateCleanerService();
const addressCleaner = new AddressCleanerService();

// CSV 文件路径
const csvFilePath = '/d/newworkdoc/code/personnel/data-cleaning-tool/testdoc/dirty_test_data.csv';

console.log('=== 开始处理 dirty_test_data.csv 文件 ===');
console.log();

// 读取并解析 CSV 文件
const csvContent = readFileSync(csvFilePath, 'utf8');

parse(csvContent, {
    columns: true,
    skip_empty_lines: true
}, (err, records) => {
    if (err) {
        console.error('解析 CSV 文件时出错:', err);
        return;
    }

    console.log(`成功解析 ${records.length} 行数据`);
    console.log();

    // 用于统计结果
    const totalRecords = records.length;
    const cleanRecords = [];
    const exceptionRecords = [];

    // 处理每一行数据
    records.forEach((record, index) => {
        const rowNumber = index + 2; // 加上标题行
        const errors = [];
        const cleanedFields = {};

        // 清洗每个字段
        // 手机号清洗
        const phoneResult = phoneCleaner.cleanPhone(record['手机号码']);
        if (phoneResult.success) {
            cleanedFields['手机号码'] = phoneResult.value;
        } else {
            errors.push({
                field: '手机号码',
                originalValue: record['手机号码'],
                errorType: 'INVALID_PHONE',
                errorMessage: phoneResult.error
            });
        }

        // 日期清洗
        const dateResult = dateCleaner.cleanDate(record['入职日期']);
        if (dateResult.success) {
            cleanedFields['入职日期'] = dateResult.value;
        } else {
            errors.push({
                field: '入职日期',
                originalValue: record['入职日期'],
                errorType: 'INVALID_DATE',
                errorMessage: dateResult.error
            });
        }

        // 地址清洗
        const addressResult = addressCleaner.cleanAddress(record['地址']);
        if (addressResult.success) {
            cleanedFields['地址'] = addressResult.value;
        } else {
            errors.push({
                field: '地址',
                originalValue: record['地址'],
                errorType: 'INVALID_ADDRESS',
                errorMessage: addressResult.error
            });
        }

        // 姓名保留原样（文本类型）
        cleanedFields['姓名'] = record['姓名'];

        // 分类记录
        if (errors.length === 0) {
            cleanRecords.push({ rowNumber, originalData: record, cleanedData: cleanedFields });
        } else {
            exceptionRecords.push({ rowNumber, originalData: record, errors });
        }
    });

    // 打印统计信息
    console.log('=== 处理结果统计 ===');
    console.log(`总记录数: ${totalRecords}`);
    console.log(`清洁数据数: ${cleanRecords.length}`);
    console.log(`异常数据数: ${exceptionRecords.length}`);
    console.log();

    // 打印异常数据详情
    if (exceptionRecords.length > 0) {
        console.log('=== 异常数据详情 ===');
        exceptionRecords.forEach(exception => {
            console.log(`第 ${exception.rowNumber} 行:`);
            console.log('原始数据:', exception.originalData);
            console.log('错误信息:');
            exception.errors.forEach(error => {
                console.log(`  - ${error.field}: ${error.errorMessage}`);
            });
            console.log();
        });
    }

    // 打印清洁数据样例
    if (cleanRecords.length > 0) {
        console.log('=== 清洁数据样例 ===');
        const sampleSize = Math.min(3, cleanRecords.length);
        for (let i = 0; i < sampleSize; i++) {
            const record = cleanRecords[i];
            console.log(`第 ${record.rowNumber} 行:`);
            console.log('原始数据:', record.originalData);
            console.log('清洁后数据:', record.cleanedData);
            console.log();
        }
    }
});
