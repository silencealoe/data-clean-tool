import { StreamParserService } from './data-cleaning-service/src/services/stream-parser.service';
import * as fs from 'fs';
import * as csv from 'csv-parser';
import { Readable } from 'stream';

// 创建测试数据
const testData = [
    { '姓名': '张三', '手机号码': '138-1234-5678', '地址': '北京市朝阳区建国路1号', '入职日期': '2023/01/15' },
    { '姓名': '李四', '手机号码': '13987654321', '地址': '上海市浦东新区陆家嘴路100号', '入职日期': '2023-05-20' },
    { '姓名': '王五', '手机号码': '156 1234 5678', '地址': '广东省深圳市南山区科技园南路', '入职日期': '2023年12月03日' },
    { '姓名': '赵六', '手机号码': '1391234567', '地址': '江苏省南京市鼓楼区中山路88号', '入职日期': '23/08/15' },
    { '姓名': '钱七', '手机号码': '139-123-45678', '地址': '浙江省杭州市西湖区文三路', '入职日期': '2023.09.10' },
    { '姓名': '孙八', '手机号码': '13912345678', '地址': '山东省青岛市市南区香港中路68号', '入职日期': '2023-11-25' },
    { '姓名': '周九', '手机号码': '139 1234 5678', '地址': '河南省郑州市金水区花园路', '入职日期': '2023/12/01' },
    { '姓名': '吴十', '手机号码': '1391234567890', '地址': '湖北省武汉市洪山区珞喻路', '入职日期': '2023年10月15日' },
    { '姓名': '郑十一', '手机号码': '139-1234-567', '地址': '四川省成都市锦江区春熙路', '入职日期': '23-07-20' },
    { '姓名': '陈十二', '手机号码': '13912345', '地址': '广东省广州市越秀区环市东路339号', '入职日期': '2023.06.30' },
];

// 创建测试函数
async function testColumnTypeRecognition() {
    try {
        console.log('开始测试列类型识别方法...\n');
        
        // 创建 StreamParserService 实例
        const streamParser = new StreamParserService();
        
        // 提取表头
        const headers = Object.keys(testData[0]);
        console.log('表头信息:', headers);
        
        // 提取各列的值
        const columnValues: Record<string, any[]> = {};
        headers.forEach(header => {
            columnValues[header] = testData.map(row => row[header]).filter(v => v !== null && v !== undefined && v !== '');
        });
        
        // 输出各列的样本数据
        console.log('\n各列样本数据:');
        for (const header in columnValues) {
            console.log(`${header}: ${JSON.stringify(columnValues[header])}`);
        }
        
        // 识别列类型
        console.log('\n开始识别列类型...');
        const columnTypes = streamParser['identifyColumnTypes'](testData, headers);
        console.log('识别结果:', columnTypes);
        
        // 分析识别结果
        console.log('\n分析识别结果:');
        const expectedTypes: Record<string, string> = {
            '姓名': 'text',
            '手机号码': 'phone',
            '地址': 'address',
            '入职日期': 'date'
        };
        
        for (const header in columnTypes) {
            const actual = columnTypes[header];
            const expected = expectedTypes[header];
            
            console.log(`字段 "${header}":`);
            console.log(`  实际类型: ${actual}`);
            console.log(`  预期类型: ${expected}`);
            console.log(`  是否匹配: ${actual === expected}`);
            
            // 如果类型不匹配，分析原因
            if (actual !== expected) {
                console.log(`  可能原因分析:`);
                if (actual === 'text') {
                    console.log(`    未满足该类型的识别条件，默认为文本类型`);
                } else {
                    console.log(`    识别逻辑可能需要调整`);
                }
            }
            
            console.log();
        }
        
        console.log('测试完成!');
    } catch (error) {
        console.error('测试过程中出现错误:', error);
    }
}

// 执行测试
testColumnTypeRecognition();
