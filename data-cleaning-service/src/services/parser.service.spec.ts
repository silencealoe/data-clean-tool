import { Test, TestingModule } from '@nestjs/testing';
import { ParserService } from './parser.service';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { ColumnType } from '../common/types';

describe('ParserService', () => {
    let service: ParserService;
    let testFilePath: string;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [ParserService],
        }).compile();

        service = module.get<ParserService>(ParserService);

        // 创建测试Excel文件
        testFilePath = path.join(__dirname, '../../temp/test-sample.xlsx');
        await createTestExcelFile(testFilePath);
    });

    afterEach(async () => {
        // 清理测试文件
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('parseExcelFile', () => {
        it('should parse Excel file successfully', async () => {
            const result = await service.parseExcelFile(testFilePath);

            expect(result).toBeDefined();
            expect(result.sheets).toHaveLength(1);
            expect(result.totalRows).toBe(3);
            expect(result.sheets[0].name).toBe('Sheet1');
            expect(result.sheets[0].headers).toEqual(['姓名', '手机号', '出生日期', '地址']);
            expect(result.sheets[0].rows).toHaveLength(3);
        });

        it('should handle empty Excel file', async () => {
            const emptyFilePath = path.join(__dirname, '../../temp/empty-test.xlsx');
            await createEmptyExcelFile(emptyFilePath);

            const result = await service.parseExcelFile(emptyFilePath);

            expect(result.sheets).toHaveLength(0);
            expect(result.totalRows).toBe(0);

            // 清理
            if (fs.existsSync(emptyFilePath)) {
                fs.unlinkSync(emptyFilePath);
            }
        });

        it('should throw error for non-existent file', async () => {
            await expect(service.parseExcelFile('non-existent.xlsx')).rejects.toThrow();
        });
    });

    describe('sheetToJson', () => {
        it('should convert worksheet to JSON', () => {
            // 创建测试工作表
            const testData = [
                ['姓名', '手机号'],
                ['张三', '13812345678'],
                ['李四', '13987654321']
            ];
            const worksheet = XLSX.utils.aoa_to_sheet(testData);

            const result = service.sheetToJson(worksheet);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ '姓名': '张三', '手机号': '13812345678' });
            expect(result[1]).toEqual({ '姓名': '李四', '手机号': '13987654321' });
        });

        it('should handle empty worksheet', () => {
            const emptyWorksheet = XLSX.utils.aoa_to_sheet([]);
            const result = service.sheetToJson(emptyWorksheet);
            expect(result).toEqual([]);
        });
    });

    describe('identifyColumnTypes', () => {
        it('should identify phone column correctly', () => {
            const headers = ['姓名', '手机号', '联系电话'];
            const sampleData = [
                { '姓名': '张三', '手机号': '13812345678', '联系电话': '010-12345678' },
                { '姓名': '李四', '手机号': '13987654321', '联系电话': '021-87654321' }
            ];

            const result = service.identifyColumnTypes(headers, sampleData);

            expect(result['姓名']).toBe(ColumnType.TEXT);
            expect(result['手机号']).toBe(ColumnType.PHONE);
            expect(result['联系电话']).toBe(ColumnType.PHONE);
        });

        it('should identify date column correctly', () => {
            const headers = ['姓名', '出生日期', '创建时间'];
            const sampleData = [
                { '姓名': '张三', '出生日期': '1990-01-15', '创建时间': '2024年1月15日' },
                { '姓名': '李四', '出生日期': '1985-12-25', '创建时间': '2024年2月20日' }
            ];

            const result = service.identifyColumnTypes(headers, sampleData);

            expect(result['姓名']).toBe(ColumnType.TEXT);
            expect(result['出生日期']).toBe(ColumnType.DATE);
            expect(result['创建时间']).toBe(ColumnType.DATE);
        });

        it('should identify address column correctly', () => {
            const headers = ['姓名', '地址', '详细地址'];
            const sampleData = [
                { '姓名': '张三', '地址': '北京市朝阳区三里屯街道', '详细地址': '广东省广州市天河区珠江新城' },
                { '姓名': '李四', '地址': '上海市浦东新区陆家嘴', '详细地址': '浙江省杭州市西湖区文三路' }
            ];

            const result = service.identifyColumnTypes(headers, sampleData);

            expect(result['姓名']).toBe(ColumnType.TEXT);
            expect(result['地址']).toBe(ColumnType.ADDRESS);
            expect(result['详细地址']).toBe(ColumnType.ADDRESS);
        });

        it('should identify number column correctly', () => {
            const headers = ['姓名', '年龄', '工资'];
            const sampleData = [
                { '姓名': '张三', '年龄': '25', '工资': '8000.50' },
                { '姓名': '李四', '年龄': '30', '工资': '12000' }
            ];

            const result = service.identifyColumnTypes(headers, sampleData);

            expect(result['姓名']).toBe(ColumnType.TEXT);
            expect(result['年龄']).toBe(ColumnType.NUMBER);
            expect(result['工资']).toBe(ColumnType.NUMBER);
        });

        it('should default to text for unknown types', () => {
            const headers = ['未知列'];
            const sampleData = [
                { '未知列': 'some random text' },
                { '未知列': 'another random text' }
            ];

            const result = service.identifyColumnTypes(headers, sampleData);

            expect(result['未知列']).toBe(ColumnType.TEXT);
        });
    });
});

/**
 * 创建测试Excel文件
 */
async function createTestExcelFile(filePath: string): Promise<void> {
    const testData = [
        ['姓名', '手机号', '出生日期', '地址'],
        ['张三', '138 1234 5678', '1990-01-15', '北京市朝阳区三里屯街道'],
        ['李四', '139-8765-4321', '1985年12月25日', '上海市浦东新区陆家嘴'],
        ['王五', '13612345678', '01/15/1992', '广东省广州市天河区珠江新城']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(testData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

    // 确保目录存在
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    XLSX.writeFile(workbook, filePath);
}

/**
 * 创建空的Excel文件
 */
async function createEmptyExcelFile(filePath: string): Promise<void> {
    const worksheet = XLSX.utils.aoa_to_sheet([]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

    // 确保目录存在
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    XLSX.writeFile(workbook, filePath);
}