import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';
import * as iconv from 'iconv-lite';
import { Readable } from 'stream';
import { ParsedData, SheetData, RowData, ColumnTypeMap, ColumnType } from '../common/types';

/**
 * CSV解析服务
 * 提供CSV文件的解析功能，支持多种编码和分隔符
 */
@Injectable()
export class CsvParserService {
    private readonly logger = new Logger(CsvParserService.name);

    /**
     * 解析CSV文件（非流式，用于小文件）
     * @param filePath CSV文件路径
     * @returns 解析后的数据
     */
    async parseCsvFile(filePath: string): Promise<ParsedData> {
        try {
            this.logger.log(`开始解析CSV文件: ${filePath}`);

            // 检测文件编码
            const encoding = await this.detectEncoding(filePath);
            this.logger.log(`检测到文件编码: ${encoding}`);

            // 检测分隔符
            const delimiter = await this.detectDelimiter(filePath, encoding);
            this.logger.log(`检测到分隔符: ${delimiter === ',' ? '逗号' : delimiter === ';' ? '分号' : '制表符'}`);

            // 读取并解析CSV文件
            const rows = await this.readCsvFile(filePath, encoding, delimiter);

            if (rows.length === 0) {
                throw new Error('CSV文件为空或格式不正确');
            }

            // 提取表头
            const headers = Object.keys(rows[0]);

            // 识别列类型
            const columnTypes = this.identifyColumnTypes(rows, headers);

            // 构建SheetData
            const sheetData: SheetData = {
                name: path.basename(filePath, '.csv'),
                headers,
                rows: rows.map((row, index) => ({
                    rowNumber: index + 1,
                    data: row,
                })),
                columnTypes,
            };

            this.logger.log(`CSV文件解析完成，共 ${rows.length} 行数据`);

            return {
                sheets: [sheetData],
                totalRows: rows.length,
            };
        } catch (error) {
            this.logger.error(`解析CSV文件失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 流式解析CSV文件
     * @param filePath CSV文件路径
     * @param onRow 每行数据的回调函数
     * @param onComplete 完成时的回调函数
     */
    async parseCsvStream(
        filePath: string,
        onRow: (row: RowData) => void,
        onComplete?: (totalRows: number) => void,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            this.logger.log(`开始流式解析CSV文件: ${filePath}`);

            // 检测文件编码
            this.detectEncoding(filePath)
                .then((encoding) => {
                    this.logger.log(`检测到文件编码: ${encoding}`);

                    // 检测分隔符
                    return this.detectDelimiter(filePath, encoding).then((delimiter) => {
                        this.logger.log(`检测到分隔符: ${delimiter === ',' ? '逗号' : delimiter === ';' ? '分号' : '制表符'}`);
                        return { encoding, delimiter };
                    });
                })
                .then(({ encoding, delimiter }) => {
                    let rowCount = 0;
                    let headers: string[] = [];

                    // 创建文件读取流
                    const fileStream = fs.createReadStream(filePath);

                    // 处理BOM和编码转换
                    const chunks: Buffer[] = [];
                    fileStream.on('data', (chunk) => {
                        // 确保chunk是Buffer类型
                        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                        chunks.push(buffer);
                    });

                    fileStream.on('end', () => {
                        const buffer = Buffer.concat(chunks);

                        // 移除BOM标记
                        let content = buffer;
                        if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
                            content = buffer.slice(3);
                        }

                        // 转换编码
                        const decodedContent = iconv.decode(content, encoding);

                        // 创建可读流
                        const readable = new Readable();
                        readable.push(decodedContent);
                        readable.push(null);

                        // 解析CSV
                        readable
                            .pipe(csv({ separator: delimiter }))
                            .on('data', (row) => {
                                rowCount++;
                                if (rowCount === 1) {
                                    headers = Object.keys(row);
                                }
                                onRow({
                                    rowNumber: rowCount,
                                    data: row,
                                });
                            })
                            .on('end', () => {
                                this.logger.log(`流式解析完成，共 ${rowCount} 行数据`);
                                if (onComplete) {
                                    onComplete(rowCount);
                                }
                                resolve();
                            })
                            .on('error', (error) => {
                                this.logger.error(`流式解析CSV文件失败: ${error.message}`);
                                reject(error);
                            });
                    });

                    fileStream.on('error', (error) => {
                        this.logger.error(`读取CSV文件失败: ${error.message}`);
                        reject(error);
                    });
                })
                .catch((error) => {
                    this.logger.error(`流式解析CSV文件失败: ${error.message}`);
                    reject(error);
                });
        });
    }

    /**
     * 检测文件编码
     * @param filePath 文件路径
     * @returns 检测到的编码
     */
    private async detectEncoding(filePath: string): Promise<string> {
        try {
            // 读取文件前1024字节用于检测编码
            const buffer = fs.readFileSync(filePath, { encoding: null }).slice(0, 1024);

            // 检查BOM标记
            if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
                return 'utf8';
            }

            // 尝试UTF-8解码
            try {
                const decoded = iconv.decode(buffer, 'utf8');
                if (this.isValidUtf8(decoded)) {
                    return 'utf8';
                }
            } catch (e) {
                // UTF-8解码失败，继续尝试其他编码
            }

            // 尝试GBK解码
            try {
                const decoded = iconv.decode(buffer, 'gbk');
                if (this.isValidChineseText(decoded)) {
                    return 'gbk';
                }
            } catch (e) {
                // GBK解码失败，继续尝试其他编码
            }

            // 尝试GB2312解码
            try {
                const decoded = iconv.decode(buffer, 'gb2312');
                if (this.isValidChineseText(decoded)) {
                    return 'gb2312';
                }
            } catch (e) {
                // GB2312解码失败
            }

            // 默认使用UTF-8
            return 'utf8';
        } catch (error) {
            this.logger.warn(`检测文件编码失败，使用默认编码UTF-8: ${error.message}`);
            return 'utf8';
        }
    }

    /**
     * 检测CSV分隔符
     * @param filePath 文件路径
     * @param encoding 文件编码
     * @returns 检测到的分隔符
     */
    private async detectDelimiter(filePath: string, encoding: string): Promise<string> {
        try {
            // 读取文件前几行用于检测分隔符
            const buffer = fs.readFileSync(filePath, { encoding: null }).slice(0, 4096);

            // 移除BOM标记
            let content = buffer;
            if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
                content = buffer.slice(3);
            }

            // 转换编码
            const decodedContent = iconv.decode(content, encoding);

            // 提取前几行
            const lines = decodedContent.split('\n').slice(0, 5);

            // 统计各分隔符出现的次数
            const delimiters = [',', ';', '\t'];
            const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };

            for (const line of lines) {
                for (const delimiter of delimiters) {
                    const count = (line.match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
                    counts[delimiter] += count;
                }
            }

            // 选择出现次数最多的分隔符
            let maxCount = 0;
            let selectedDelimiter = ',';

            for (const delimiter of delimiters) {
                if (counts[delimiter] > maxCount) {
                    maxCount = counts[delimiter];
                    selectedDelimiter = delimiter;
                }
            }

            // 如果没有检测到分隔符，默认使用逗号
            if (maxCount === 0) {
                this.logger.warn('未检测到分隔符，使用默认分隔符逗号');
                return ',';
            }

            return selectedDelimiter;
        } catch (error) {
            this.logger.warn(`检测分隔符失败，使用默认分隔符逗号: ${error.message}`);
            return ',';
        }
    }

    /**
     * 读取CSV文件
     * @param filePath 文件路径
     * @param encoding 文件编码
     * @param delimiter 分隔符
     * @returns 解析后的行数据
     */
    private async readCsvFile(
        filePath: string,
        encoding: string,
        delimiter: string,
    ): Promise<Record<string, any>[]> {
        return new Promise((resolve, reject) => {
            const rows: Record<string, any>[] = [];

            // 创建文件读取流
            const fileStream = fs.createReadStream(filePath);

            // 处理BOM和编码转换
            const chunks: Buffer[] = [];
            fileStream.on('data', (chunk) => {
                // 确保chunk是Buffer类型
                const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                chunks.push(buffer);
            });

            fileStream.on('end', () => {
                const buffer = Buffer.concat(chunks);

                // 移除BOM标记
                let content = buffer;
                if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
                    content = buffer.slice(3);
                }

                // 转换编码
                const decodedContent = iconv.decode(content, encoding);

                // 创建可读流
                const readable = new Readable();
                readable.push(decodedContent);
                readable.push(null);

                // 解析CSV
                readable
                    .pipe(csv({ separator: delimiter }))
                    .on('data', (row) => {
                        rows.push(row);
                    })
                    .on('end', () => {
                        resolve(rows);
                    })
                    .on('error', (error) => {
                        reject(error);
                    });
            });

            fileStream.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * 识别列类型
     * @param rows 行数据
     * @param headers 表头
     * @returns 列类型映射
     */
    private identifyColumnTypes(rows: Record<string, any>[], headers: string[]): ColumnTypeMap {
        const columnTypes: ColumnTypeMap = {};

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

    /**
     * 判断是否为有效的UTF-8文本
     * @param text 文本
     * @returns 是否有效
     */
    private isValidUtf8(text: string): boolean {
        // 检查是否包含无效的UTF-8字符
        try {
            Buffer.from(text, 'utf8');
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * 判断是否为有效的中文文本
     * @param text 文本
     * @returns 是否有效
     */
    private isValidChineseText(text: string): boolean {
        // 检查是否包含中文字符
        const chineseRegex = /[\u4e00-\u9fa5]/;
        return chineseRegex.test(text);
    }

    /**
     * 判断是否为手机号列
     * @param header 列名
     * @param values 列值
     * @returns 是否为手机号列
     */
    private isPhoneColumn(header: string, values: string[]): boolean {
        const phoneKeywords = ['手机', '电话', 'phone', 'tel', 'mobile'];
        const headerLower = header.toLowerCase();

        // 检查列名是否包含手机号关键词
        if (!phoneKeywords.some((keyword) => headerLower.includes(keyword))) {
            return false;
        }

        // 检查至少80%的值符合手机号格式
        const phoneRegex = /^1[3-9]\d{9}$/;
        const validCount = values.filter((v) => phoneRegex.test(v.toString())).length;
        return validCount / values.length >= 0.8;
    }

    /**
     * 判断是否为日期列
     * @param header 列名
     * @param values 列值
     * @returns 是否为日期列
     */
    private isDateColumn(header: string, values: string[]): boolean {
        const dateKeywords = ['日期', '时间', 'date', 'time', 'birthday', 'birth'];
        const headerLower = header.toLowerCase();

        // 检查列名是否包含日期关键词
        if (!dateKeywords.some((keyword) => headerLower.includes(keyword))) {
            return false;
        }

        // 检查至少80%的值符合日期格式
        const dateRegex = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/;
        const validCount = values.filter((v) => dateRegex.test(v.toString())).length;
        return validCount / values.length >= 0.8;
    }

    /**
     * 判断是否为地址列
     * @param header 列名
     * @param values 列值
     * @returns 是否为地址列
     */
    private isAddressColumn(header: string, values: string[]): boolean {
        const addressKeywords = ['地址', '省', '市', '区', 'address', 'province', 'city'];
        const headerLower = header.toLowerCase();

        // 检查列名是否包含地址关键词
        if (!addressKeywords.some((keyword) => headerLower.includes(keyword))) {
            return false;
        }

        // 检查至少80%的值包含省市区信息
        const addressRegex = /(省|市|区|自治区|特别行政区)/;
        const validCount = values.filter((v) => addressRegex.test(v.toString())).length;
        return validCount / values.length >= 0.8;
    }

    /**
     * 判断是否为数字列
     * @param values 列值
     * @returns 是否为数字列
     */
    private isNumberColumn(values: string[]): boolean {
        const validCount = values.filter((v) => !isNaN(Number(v))).length;
        return validCount / values.length >= 0.8;
    }
}
