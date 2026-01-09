import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { ParsedData, SheetData, RowData, ColumnTypeMap, ColumnType } from '../common/types';

@Injectable()
export class ParserService {
    private readonly logger = new Logger(ParserService.name);

    /**
     * 解析文件（支持Excel和CSV）
     * @param filePath 文件路径
     * @returns 解析后的数据
     */
    async parseFile(filePath: string): Promise<ParsedData> {
        const fileExtension = path.extname(filePath).toLowerCase();

        switch (fileExtension) {
            case '.xlsx':
            case '.xls':
                return this.parseExcelFile(filePath);
            case '.csv':
                return this.parseCsvFile(filePath);
            default:
                throw new Error(`不支持的文件类型: ${fileExtension}`);
        }
    }

    /**
     * 解析CSV文件
     * @param filePath CSV文件路径
     * @returns 解析后的数据
     */
    async parseCsvFile(filePath: string): Promise<ParsedData> {
        try {
            this.logger.log(`开始解析CSV文件: ${filePath}`);

            // 读取CSV文件内容
            const fileContent = fs.readFileSync(filePath, 'utf8');

            // 检测编码并转换
            const csvContent = this.detectAndConvertEncoding(fileContent);

            // 解析CSV内容
            const csvData = this.parseCsvContent(csvContent);

            if (csvData.length === 0) {
                throw new Error('CSV文件为空或格式不正确');
            }

            // 提取表头（第一行）
            const headers = Object.keys(csvData[0] || {});

            // 转换为RowData格式
            const rows: RowData[] = csvData.map((row, index) => ({
                rowNumber: index + 2, // CSV行号从2开始（第1行是表头）
                data: row,
            }));

            // 识别列类型
            const sampleData = csvData.slice(0, Math.min(10, csvData.length));
            const columnTypes = this.identifyColumnTypes(headers, sampleData);

            const sheetData: SheetData = {
                name: 'Sheet1', // CSV文件只有一个工作表
                headers,
                rows,
                columnTypes,
            };

            this.logger.log(`CSV解析完成，共处理 ${rows.length} 行数据`);

            return {
                sheets: [sheetData],
                totalRows: rows.length,
            };
        } catch (error) {
            this.logger.error(`CSV文件解析失败: ${error.message}`, error.stack);
            throw new Error(`CSV文件解析失败: ${error.message}`);
        }
    }

    /**
     * 检测并转换文件编码
     * @param content 文件内容
     * @returns 转换后的UTF-8内容
     */
    private detectAndConvertEncoding(content: string): string {
        // 简单的编码检测和转换
        // 如果包含乱码字符，尝试从GBK转换
        if (this.containsGarbledText(content)) {
            try {
                // 这里可以使用iconv-lite库进行编码转换
                // 暂时返回原内容，后续可以扩展
                this.logger.warn('检测到可能的编码问题，建议使用UTF-8编码的CSV文件');
            } catch (error) {
                this.logger.warn('编码转换失败，使用原始内容');
            }
        }
        return content;
    }

    /**
     * 检测是否包含乱码文本
     * @param text 文本内容
     * @returns 是否包含乱码
     */
    private containsGarbledText(text: string): boolean {
        // 检测常见的乱码模式
        const garbledPatterns = [
            /[��]/g, // 常见的乱码字符
            /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, // 控制字符
        ];

        return garbledPatterns.some(pattern => pattern.test(text));
    }

    /**
     * 解析CSV内容
     * @param csvContent CSV文件内容
     * @returns 解析后的JSON数据
     */
    private parseCsvContent(csvContent: string): any[] {
        const lines = csvContent.split('\n').filter(line => line.trim() !== '');

        if (lines.length === 0) {
            return [];
        }

        // 解析第一行作为表头
        const headers = this.parseCsvLine(lines[0]);
        const dataRows = lines.slice(1);

        // 解析数据行
        const jsonData = dataRows.map(line => {
            const values = this.parseCsvLine(line);
            const rowObj: Record<string, any> = {};

            headers.forEach((header, index) => {
                rowObj[header] = values[index] || '';
            });

            return rowObj;
        });

        return jsonData;
    }

    /**
     * 解析CSV行（处理引号和逗号）
     * @param line CSV行内容
     * @returns 解析后的字段数组
     */
    private parseCsvLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        let i = 0;

        while (i < line.length) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // 转义的引号
                    current += '"';
                    i += 2;
                } else {
                    // 开始或结束引号
                    inQuotes = !inQuotes;
                    i++;
                }
            } else if (char === ',' && !inQuotes) {
                // 字段分隔符
                result.push(current.trim());
                current = '';
                i++;
            } else {
                current += char;
                i++;
            }
        }

        // 添加最后一个字段
        result.push(current.trim());

        return result;
    }
    async parseExcelFile(filePath: string): Promise<ParsedData> {
        try {
            this.logger.log(`开始解析Excel文件: ${filePath}`);

            // 读取Excel文件
            const workbook = XLSX.readFile(filePath);
            const sheets: SheetData[] = [];
            let totalRows = 0;

            // 处理每个工作表
            for (const sheetName of workbook.SheetNames) {
                this.logger.log(`处理工作表: ${sheetName}`);

                const worksheet = workbook.Sheets[sheetName];
                const jsonData = this.sheetToJson(worksheet);

                if (jsonData.length === 0) {
                    this.logger.warn(`工作表 ${sheetName} 为空，跳过处理`);
                    continue;
                }

                // 提取表头
                const headers = Object.keys(jsonData[0] || {});

                // 转换为RowData格式
                const rows: RowData[] = jsonData.map((row, index) => ({
                    rowNumber: index + 2, // Excel行号从2开始（第1行是表头）
                    data: row,
                }));

                // 识别列类型
                const sampleData = jsonData.slice(0, Math.min(10, jsonData.length));
                const columnTypes = this.identifyColumnTypes(headers, sampleData);

                sheets.push({
                    name: sheetName,
                    headers,
                    rows,
                    columnTypes,
                });

                totalRows += rows.length;
            }

            this.logger.log(`Excel解析完成，共处理 ${sheets.length} 个工作表，${totalRows} 行数据`);

            return {
                sheets,
                totalRows,
            };
        } catch (error) {
            this.logger.error(`Excel文件解析失败: ${error.message}`, error.stack);
            throw new Error(`Excel文件解析失败: ${error.message}`);
        }
    }

    /**
     * 将工作表转换为JSON
     * @param sheet Excel工作表
     * @returns JSON数据数组
     */
    sheetToJson(sheet: XLSX.WorkSheet): any[] {
        try {
            // 使用xlsx库的sheet_to_json方法
            const jsonData = XLSX.utils.sheet_to_json(sheet, {
                header: 1, // 使用数组格式
                defval: '', // 空单元格默认值
                raw: false, // 不使用原始值，转换为字符串
            }) as any[][];

            if (jsonData.length === 0) {
                return [];
            }

            // 第一行作为表头
            const headers = jsonData[0] as string[];
            const dataRows = jsonData.slice(1);

            // 转换为对象格式
            return dataRows.map(row => {
                const rowObj: Record<string, any> = {};
                headers.forEach((header, index) => {
                    rowObj[header] = (row as any[])[index] || '';
                });
                return rowObj;
            });
        } catch (error) {
            this.logger.error(`工作表转换JSON失败: ${error.message}`, error.stack);
            throw new Error(`工作表转换失败: ${error.message}`);
        }
    }

    /**
     * 识别列类型（手机号、日期、地址等）
     * @param headers 表头数组
     * @param sampleData 样本数据
     * @returns 列类型映射
     */
    identifyColumnTypes(headers: string[], sampleData: any[]): ColumnTypeMap {
        const columnTypes: ColumnTypeMap = {};

        headers.forEach(header => {
            // 获取该列的样本值
            const columnValues = sampleData
                .map(row => row[header])
                .filter(value => value !== null && value !== undefined && value !== '');

            if (columnValues.length === 0) {
                columnTypes[header] = ColumnType.TEXT;
                return;
            }

            // 根据表头名称和数据内容识别类型
            const headerLower = header.toLowerCase();
            const type = this.detectColumnType(headerLower, columnValues);
            columnTypes[header] = type;
        });

        return columnTypes;
    }

    /**
     * 检测列类型
     * @param headerName 表头名称（小写）
     * @param values 列值数组
     * @returns 列类型
     */
    private detectColumnType(headerName: string, values: any[]): ColumnType {
        // 基于表头名称的规则
        if (this.isPhoneHeader(headerName)) {
            return ColumnType.PHONE;
        }

        if (this.isDateHeader(headerName)) {
            return ColumnType.DATE;
        }

        if (this.isAddressHeader(headerName)) {
            return ColumnType.ADDRESS;
        }

        // 基于数据内容的规则
        const phoneCount = values.filter(value => this.looksLikePhone(value)).length;
        const dateCount = values.filter(value => this.looksLikeDate(value)).length;
        const numberCount = values.filter(value => this.looksLikeNumber(value)).length;
        const addressCount = values.filter(value => this.looksLikeAddress(value)).length;

        const total = values.length;
        const threshold = 0.6; // 60%的数据符合某种类型才认为是该类型

        if (phoneCount / total >= threshold) {
            return ColumnType.PHONE;
        }

        if (dateCount / total >= threshold) {
            return ColumnType.DATE;
        }

        if (addressCount / total >= threshold) {
            return ColumnType.ADDRESS;
        }

        if (numberCount / total >= threshold) {
            return ColumnType.NUMBER;
        }

        return ColumnType.TEXT;
    }

    /**
     * 判断表头是否为手机号字段
     */
    private isPhoneHeader(header: string): boolean {
        const phoneKeywords = ['手机', '电话', 'phone', 'mobile', 'tel', '联系方式', '联系电话'];
        return phoneKeywords.some(keyword => header.includes(keyword));
    }

    /**
     * 判断表头是否为日期字段
     */
    private isDateHeader(header: string): boolean {
        const dateKeywords = ['日期', '时间', 'date', 'time', '创建时间', '更新时间', '生日', '出生日期'];
        return dateKeywords.some(keyword => header.includes(keyword));
    }

    /**
     * 判断表头是否为地址字段
     */
    private isAddressHeader(header: string): boolean {
        const addressKeywords = ['地址', '住址', 'address', '省', '市', '区', '县', '街道', '详细地址'];
        return addressKeywords.some(keyword => header.includes(keyword));
    }

    /**
     * 判断值是否像手机号
     */
    private looksLikePhone(value: any): boolean {
        if (typeof value !== 'string') {
            value = String(value);
        }

        // 移除常见的分隔符
        const cleaned = value.replace(/[\s\-\(\)\.]/g, '');

        // 检查是否为数字且长度合理
        if (!/^\d+$/.test(cleaned)) {
            return false;
        }

        // 中国手机号11位，固定电话7-12位
        const length = cleaned.length;
        return (length === 11 && cleaned.startsWith('1')) || (length >= 7 && length <= 12);
    }

    /**
     * 判断值是否像日期
     */
    private looksLikeDate(value: any): boolean {
        if (typeof value !== 'string') {
            value = String(value);
        }

        // 常见日期格式的正则表达式
        const datePatterns = [
            /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/, // 2024-01-15 或 2024/01/15
            /^\d{4}年\d{1,2}月\d{1,2}日$/, // 2024年1月15日
            /^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/, // 01/15/2024 或 01-15-2024
            /^\d{4}\d{2}\d{2}$/, // 20240115
        ];

        return datePatterns.some(pattern => pattern.test(value.trim()));
    }

    /**
     * 判断值是否像数字
     */
    private looksLikeNumber(value: any): boolean {
        if (typeof value === 'number') {
            return true;
        }

        if (typeof value !== 'string') {
            value = String(value);
        }

        // 检查是否为有效数字（包括小数）
        return /^-?\d+(\.\d+)?$/.test(value.trim());
    }

    /**
     * 判断值是否像地址
     */
    private looksLikeAddress(value: any): boolean {
        if (typeof value !== 'string') {
            value = String(value);
        }

        // 检查是否包含常见的地址关键词
        const addressKeywords = [
            '省', '市', '区', '县', '街道', '路', '号', '村', '镇', '乡',
            '北京', '上海', '天津', '重庆', '广东', '浙江', '江苏', '山东',
            '河南', '河北', '湖南', '湖北', '四川', '福建', '安徽', '江西',
            '辽宁', '黑龙江', '吉林', '山西', '陕西', '甘肃', '青海', '宁夏',
            '新疆', '西藏', '内蒙古', '广西', '海南', '贵州', '云南'
        ];

        return addressKeywords.some(keyword => value.includes(keyword)) && value.length > 5;
    }
}