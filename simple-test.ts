// 复制 StreamParserService 类的核心方法到这个脚本中，以便独立运行测试
const ColumnType = {
    PHONE: 'phone',
    DATE: 'date',
    ADDRESS: 'address',
    TEXT: 'text',
    NUMBER: 'number'
};

class SimpleStreamParser {
    // 判断是否为手机号列
    private isPhoneColumn(header: string, values: string[]): boolean {
        const phoneKeywords = ['手机', '电话', 'phone', 'tel', 'mobile'];
        const headerLower = header.toLowerCase();

        if (!phoneKeywords.some((keyword) => headerLower.includes(keyword))) {
            return false;
        }

        const phoneRegex = /^1[3-9]\d{9}$/;
        const validCount = values.filter((v) => phoneRegex.test(v.toString())).length;
        return validCount / values.length >= 0.8;
    }

    // 判断是否为日期列
    private isDateColumn(header: string, values: string[]): boolean {
        const dateKeywords = ['日期', '时间', 'date', 'time', 'birthday', 'birth'];
        const headerLower = header.toLowerCase();

        if (!dateKeywords.some((keyword) => headerLower.includes(keyword))) {
            return false;
        }

        const dateRegex = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/;
        const validCount = values.filter((v) => dateRegex.test(v.toString())).length;
        return validCount / values.length >= 0.8;
    }

    // 判断是否为地址列
    private isAddressColumn(header: string, values: string[]): boolean {
        const addressKeywords = ['地址', '省', '市', '区', 'address', 'province', 'city'];
        const headerLower = header.toLowerCase();

        if (!addressKeywords.some((keyword) => headerLower.includes(keyword))) {
            return false;
        }

        // 地址列识别条件：包含省/市/区关键词，或符合地址模式
        const addressPattern = /[\u4e00-\u9fa5]{2,}省|[\u4e00-\u9fa5]{2,}市|[\u4e00-\u9fa5]{2,}区/;
        const validCount = values.filter((v) => addressPattern.test(v.toString())).length;
        return validCount / values.length >= 0.5;
    }

    // 判断是否为数字列
    private isNumberColumn(values: string[]): boolean {
        const numericRegex = /^-?\d+(\.\d+)?$/;
        const validCount = values.filter((v) => numericRegex.test(v.toString())).length;
        return validCount / values.length >= 0.8;
    }

    // 识别列类型
    identifyColumnTypes(rows: Record<string, any>[], headers: string[]): Record<string, string> {
        const columnTypes: Record<string, string> = {};

        for (const header of headers) {
            const values = rows.map((row) => row[header]).filter((v) => v !== null && v !== undefined && v !== '');

            if (values.length === 0) {
                columnTypes[header] = ColumnType.TEXT;
                continue;
            }

            // 检测手机号列
            if (this.isPhoneColumn(header, values)) {
                columnTypes[header] = ColumnType.PHONE;
                continue;
            }

            // 检测日期列
            if (this.isDateColumn(header, values)) {
                columnTypes[header] = ColumnType.DATE;
                continue;
            }

            // 检测地址列
            if (this.isAddressColumn(header, values)) {
                columnTypes[header] = ColumnType.ADDRESS;
                continue;
            }

            // 检测数字列
            if (this.isNumberColumn(values)) {
                columnTypes[header] = ColumnType.NUMBER;
                continue;
            }

            // 默认为文本列
            columnTypes[header] = ColumnType.TEXT;
        }

        return columnTypes;
    }
}

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
        const streamParser = new SimpleStreamParser();
        
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
        const columnTypes = streamParser.identifyColumnTypes(testData, headers);
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
