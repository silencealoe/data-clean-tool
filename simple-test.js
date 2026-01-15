
const fs = require('fs');
const csv = require('csv-parser');
const { PhoneCleanerService } = require('./data-cleaning-service/src/services/phone-cleaner.service');
const { DateCleanerService } = require('./data-cleaning-service/src/services/date-cleaner.service');
const { AddressCleanerService } = require('./data-cleaning-service/src/services/address-cleaner.service');
const { StreamParserService } = require('./data-cleaning-service/src/services/stream-parser.service');

// 创建服务实例
const phoneCleaner = new PhoneCleanerService();
const dateCleaner = new DateCleanerService();
const addressCleaner = new AddressCleanerService();
const streamParser = new StreamParserService();

// 测试数据
const testData = [];

// 读取 CSV 文件
fs.createReadStream('testdoc/dirty_test_data.csv')
  .pipe(csv())
  .on('data', (row) => {
    testData.push(row);
  })
  .on('end', () => {
    console.log('=== 成功读取测试数据 ===');
    console.log(`共读取到 ${testData.length} 行数据`);
    console.log('');
    
    // 测试列类型识别
    console.log('=== 测试列类型识别 ===');
    const headers = Object.keys(testData[0]);
    const columnTypes = streamParser.identifyColumnTypes(testData, headers);
    console.log('识别到的列类型:', columnTypes);
    console.log('');
    
    // 逐个测试数据清洗
    console.log('=== 逐个测试数据清洗 ===');
    testData.forEach((row, index) => {
      console.log(`\n处理第 ${index + 1} 行数据:`);
      console.log('原始数据:', JSON.stringify(row, null, 2));
      
      // 测试每个字段
      const errors = [];
      for (const field in row) {
        const value = row[field];
        const columnType = columnTypes[field];
        
        let result;
        switch (columnType) {
          case 'PHONE':
            result = phoneCleaner.cleanPhone(value);
            break;
          case 'DATE':
            result = dateCleaner.cleanDate(value);
            break;
          case 'ADDRESS':
            result = addressCleaner.cleanAddress(value);
            break;
          case 'NUMBER':
            // 这里我们暂时简化处理
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
              result = { success: false, error: 'Not a valid number' };
            } else {
              result = { success: true, value: numValue };
            }
            break;
          default:
            // TEXT类型直接返回
            result = { success: true, value: value };
        }
        
        if (!result.success) {
          errors.push({ field, error: result.error });
        }
        
        console.log(`  ${field} (${columnType}): ${result.success ? '✅ 成功' : '❌ 失败'}${result.success ? ' - ' + JSON.stringify(result.value) : ' - ' + result.error}`);
      }
      
      if (errors.length > 0) {
        console.log(`❌ 行 ${index + 1} 包含 ${errors.length} 个错误:`, errors);
      } else {
        console.log(`✅ 行 ${index + 1} 没有错误`);
      }
    });
    
    console.log('');
    console.log('=== 总结 ===');
    console.log(`总测试行数: ${testData.length}`);
    
    // 计算错误行数
    const errorRows = testData.filter(row => {
      let hasError = false;
      for (const field in row) {
        const value = row[field];
        const columnType = columnTypes[field];
        
        let result;
        switch (columnType) {
          case 'PHONE':
            result = phoneCleaner.cleanPhone(value);
            break;
          case 'DATE':
            result = dateCleaner.cleanDate(value);
            break;
          case 'ADDRESS':
            result = addressCleaner.cleanAddress(value);
            break;
          case 'NUMBER':
            const numValue = parseFloat(value);
            result = { success: !isNaN(numValue) };
            break;
          default:
            result = { success: true };
        }
        
        if (!result.success) {
          hasError = true;
        }
      }
      return hasError;
    });
    
    console.log(`错误行数: ${errorRows.length}`);
    console.log(`成功行数: ${testData.length - errorRows.length}`);
  });
