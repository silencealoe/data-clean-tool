
import { StreamParserService } from './data-cleaning-service/src/services/stream-parser.service';
import { DataCleanerService } from './data-cleaning-service/src/services/data-cleaner.service';
import { PhoneCleanerService } from './data-cleaning-service/src/services/phone-cleaner.service';
import { DateCleanerService } from './data-cleaning-service/src/services/date-cleaner.service';
import { AddressCleanerService } from './data-cleaning-service/src/services/address-cleaner.service';
import { DatabasePersistenceService } from './data-cleaning-service/src/services/database-persistence.service';

async function testDataProcessing() {
    console.log('=== 数据处理测试 ===\n');

    // 创建所需的服务实例
    const phoneCleaner = new PhoneCleanerService();
    const dateCleaner = new DateCleanerService();
    const addressCleaner = new AddressCleanerService();
    const streamParser = new StreamParserService();
    // 为了测试，我们可以创建一个模拟的数据库持久化服务
    const mockDatabasePersistence = {
        batchInsertCleanData: async (data: any[]) => {},
        batchInsertErrorLogs: async (data: any[]) => {}
    } as unknown as DatabasePersistenceService;
    
    const dataCleaner = new DataCleanerService(
        phoneCleaner,
        dateCleaner,
        addressCleaner,
        streamParser,
        mockDatabasePersistence
    );

    // 测试文件路径
    const testFilePath = './testdoc/dirty_test_data.csv';

    console.log('1. 开始测试解析和清洗 dirty_test_data.csv\n');

    try {
        // 使用流式清洗来处理测试数据
        const jobId = 'test-job-' + Date.now();
        const result = await dataCleaner.cleanDataStream(testFilePath, jobId);
        
        console.log('2. 数据处理完成');
        console.log(`   总处理行数: ${result.statistics.processedRows}`);
        console.log(`   错误行数: ${result.statistics.errorRows}`);
        console.log(`   成功处理行数: ${result.statistics.processedRows - result.statistics.errorRows}`);
        
        // 如果没有识别到错误，让我们直接测试各个字段的清洗过程
        if (result.statistics.errorRows === 0) {
            console.log('\n3. 直接测试各个字段的清洗过程:');
            testDirectFieldCleaning(phoneCleaner, dateCleaner, addressCleaner);
        }
        
    } catch (error) {
        console.error('处理文件时出错:', error);
    }
}

function testDirectFieldCleaning(
    phoneCleaner: PhoneCleanerService, 
    dateCleaner: DateCleanerService, 
    addressCleaner: AddressCleanerService
) {
    // 测试数据示例
    const testData = [
        { 姓名: "赵六", 手机号码: "1391234567", 地址: "江苏省南京市鼓楼区中山路88号", 入职日期: "23/08/15" },
        { 姓名: "钱七", 手机号码: "139-123-45678", 地址: "浙江省杭州市西湖区文三路", 入职日期: "2023.09.10" },
        { 姓名: "吴十", 手机号码: "1391234567890", 地址: "湖北省武汉市洪山区珞喻路", 入职日期: "2023年10月15日" },
        { 姓名: "郑十一", 手机号码: "139-1234-567", 地址: "四川省成都市锦江区春熙路", 入职日期: "23-07-20" },
        { 姓名: "陈十二", 手机号码: "13912345", 地址: "广东省广州市越秀区环市东路339号", 入职日期: "2023.06.30" },
        { 姓名: "李十四", 手机号码: "13912345678", 地址: "广东省广州市", 入职日期: "2023.06.30" },
        { 姓名: "王十五", 手机号码: "13912345678", 地址: "东路800号", 入职日期: "2023.06.30" },
    ];
    
    console.log('\n   手机号码清洗测试:');
    testData.forEach(row => {
        const result = phoneCleaner.cleanPhone(row.手机号码);
        console.log(`      ${row.姓名}: "${row.手机号码}" -> "${result.value || 'Invalid'}" (${result.success ? 'Success' : 'Error: ' + result.error})`);
    });
    
    console.log('\n   日期清洗测试:');
    testData.forEach(row => {
        const result = dateCleaner.cleanDate(row.入职日期);
        console.log(`      ${row.姓名}: "${row.入职日期}" -> "${result.value || 'Invalid'}" (${result.success ? 'Success' : 'Error: ' + result.error})`);
    });
    
    console.log('\n   地址清洗测试:');
    testData.forEach(row => {
        const result = addressCleaner.cleanAddress(row.地址);
        console.log(`      ${row.姓名}: "${row.地址}" -> ${JSON.stringify(result.value || {})} (${result.success ? 'Success' : 'Error: ' + result.error})`);
    });
}

// 运行测试
testDataProcessing().catch(console.error);
