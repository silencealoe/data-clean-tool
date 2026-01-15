import { StreamParserService } from './src/services/stream-parser.service';
import { PhoneCleanerService } from './src/services/phone-cleaner.service';
import { DateCleanerService } from './src/services/date-cleaner.service';
import { AddressCleanerService } from './src/services/address-cleaner.service';
import { RowData, ColumnTypeMap, ColumnType } from './src/common/types';
import * as path from 'path';

async function diagnose() {
    console.log('=== 诊断数据清洗流程 ===\n');

    // 初始化服务
    const streamParser = new StreamParserService();
    const phoneCleaner = new PhoneCleanerService();
    const dateCleaner = new DateCleanerService();
    const addressCleaner = new AddressCleanerService();

    // 模拟 DataCleanerService 的 cleanRow 方法
    function cleanRow(row: RowData, columnTypes: ColumnTypeMap) {
        const errors: any[] = [];

        for (const [fieldName, originalValue] of Object.entries(row.data)) {
            const columnType = columnTypes[fieldName] || ColumnType.TEXT;

            if (columnType === ColumnType.PHONE) {
                const result = phoneCleaner.cleanPhone(originalValue);
                if (!result.success) {
                    errors.push({
                        field: fieldName,
                        value: originalValue,
                        error: result.error
                    });
                }
            } else if (columnType === ColumnType.DATE) {
                const result = dateCleaner.cleanDate(originalValue);
                if (!result.success) {
                    errors.push({
                        field: fieldName,
                        value: originalValue,
                        error: result.error
                    });
                }
            } else if (columnType === ColumnType.ADDRESS) {
                const result = addressCleaner.cleanAddress(originalValue);
                if (!result.success) {
                    errors.push({
                        field: fieldName,
                        value: originalValue,
                        error: result.error
                    });
                }
            }
        }

        return { row, errors };
    }

    // 测试文件路径
    const testFilePath = path.join(__dirname, '..', 'testdoc', 'dirty_test_data.csv');
    console.log(`测试文件: ${testFilePath}\n`);

    let columnTypes: ColumnTypeMap = {};
    let totalRows = 0;
    let cleanRows = 0;
    let errorRows = 0;
    const errorDetails: any[] = [];

    try {
        // 使用流式解析器
        await streamParser.parseCsvStream(
            testFilePath,
            async (row: RowData, types: ColumnTypeMap) => {
                // 保存列类型
                if (Object.keys(types).length > 0 && Object.keys(columnTypes).length === 0) {
                    columnTypes = types;
                    console.log('列类型识别结果:');
                    console.log(JSON.stringify(columnTypes, null, 2));
                    console.log('');
                }

                totalRows++;

                // 清洗行
                const result = cleanRow(row, columnTypes);

                if (result.errors.length === 0) {
                    cleanRows++;
                } else {
                    errorRows++;
                    errorDetails.push({
                        rowNumber: row.rowNumber,
                        data: row.data,
                        errors: result.errors
                    });
                }
            },
            (stats) => {
                console.log('\n=== 解析完成 ===');
                console.log(`总行数: ${stats.totalRows}`);
            },
            (error, rowNumber) => {
                console.error(`处理第${rowNumber}行时出错: ${error.message}`);
            }
        );

        console.log('\n=== 清洗结果统计 ===');
        console.log(`总行数: ${totalRows}`);
        console.log(`清洁数据: ${cleanRows} 行`);
        console.log(`异常数据: ${errorRows} 行`);
        console.log(`异常率: ${Math.round((errorRows / totalRows) * 100)}%`);

        if (errorDetails.length > 0) {
            console.log('\n=== 异常数据详情 ===');
            errorDetails.forEach((detail, index) => {
                console.log(`\n${index + 1}. 行号 ${detail.rowNumber}`);
                console.log(`   数据: ${JSON.stringify(detail.data)}`);
                console.log(`   错误:`);
                detail.errors.forEach((err: any) => {
                    console.log(`     - ${err.field}: "${err.value}"`);
                    console.log(`       错误: ${err.error}`);
                });
            });
        }

    } catch (error) {
        console.error('诊断失败:', error);
        process.exit(1);
    }
}

diagnose();
