import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
<<<<<<< HEAD
import csv from 'csv-parser';
=======
import * as csv from 'csv-parser';
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
import * as iconv from 'iconv-lite';
import { Readable } from 'stream';
import { RowData, ColumnTypeMap, ColumnType } from '../common/types';

/**
 * 流式解析服务统计信息接口
 */
export interface StreamStatistics {
    totalRows: number;
    processedRows: number;
    errorRows: number;
}

/**
 * 流式解析服务
 * 提供Excel和CSV文件的流式解析功能，支持大文件处理
 */
@Injectable()
export class StreamParserService {
    private readonly logger = new Logger(StreamParserService.name);

    /**
     * 流式解析Excel文件
     * @param filePath Excel文件路径
     * @param onRow 每行数据的回调函数
     * @param onComplete 完成时的回调函数
     * @param onError 错误回调函数
     */
    async parseExcelStream(
        filePath: string,
        onRow: (row: RowData, columnTypes: ColumnTypeMap) => Promise<void>,
        onComplete?: (statistics: StreamStatistics) => void,
        onError?: (error: Error, rowNumber: number) => void,
    ): Promise<StreamStatistics> {
        const statistics: StreamStatistics = {
            totalRows: 0,
            processedRows: 0,
            errorRows: 0,
        };

        try {
            this.logger.log(`开始流式解析Excel文件: ${filePath}`);

            // 创建Excel工作簿
            const workbook = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
                entries: 'emit',
            });

            // 遍历所有工作表
            for await (const worksheet of workbook) {
                // WorksheetReader没有name属性，使用默认名称
                const sheetName = 'Sheet1';
                this.logger.log(`正在处理工作表: ${sheetName}`);

                let headers: string[] = [];
                let columnTypes: ColumnTypeMap = {};
                const sampleRows: Record<string, any>[] = [];

                // 逐行读取数据
                let rowIndex = 0;
                for await (const row of worksheet) {
                    rowIndex++;

                    // 第一行作为表头
                    if (rowIndex === 1) {
                        headers = row.values as string[];
                        headers = headers.filter((h) => h !== undefined);
                        continue;
                    }

                    // 跳过空行
                    if (!row.values || row.values.length === 0) {
                        continue;
                    }

                    // 构建行数据对象
                    const rowData: Record<string, any> = {};
                    for (let i = 0; i < headers.length; i++) {
                        rowData[headers[i]] = row.values[i + 1];
                    }

                    // 收集样本数据用于识别列类型（前100行）
                    if (sampleRows.length < 100) {
                        sampleRows.push(rowData);
                    }

                    // 在处理完前100行后识别列类型
                    if (sampleRows.length === 100 && Object.keys(columnTypes).length === 0) {
                        columnTypes = this.identifyColumnTypes(sampleRows, headers);
                    }

                    try {
                        // 调用行处理回调
                        await onRow(
                            {
                                rowNumber: rowIndex - 1,
                                data: rowData,
                            },
                            columnTypes,
                        );
                        statistics.processedRows++;
                    } catch (error) {
                        statistics.errorRows++;
                        if (onError) {
                            onError(error as Error, rowIndex - 1);
                        }
                        this.logger.error(`处理第 ${rowIndex - 1} 行时出错: ${error.message}`);
                    }

                    statistics.totalRows++;
                }

                // 如果样本数据不足100行，在处理完后识别列类型
                if (sampleRows.length > 0 && Object.keys(columnTypes).length === 0) {
                    columnTypes = this.identifyColumnTypes(sampleRows, headers);
                }
            }

            this.logger.log(`Excel文件流式解析完成，共处理 ${statistics.totalRows} 行数据`);

            if (onComplete) {
                onComplete(statistics);
            }

            return statistics;
        } catch (error) {
            this.logger.error(`流式解析Excel文件失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 流式解析CSV文件
     * @param filePath CSV文件路径
     * @param onRow 每行数据的回调函数
     * @param onComplete 完成时的回调函数
     * @param onError 错误回调函数
     */
    async parseCsvStream(
        filePath: string,
        onRow: (row: RowData, columnTypes: ColumnTypeMap) => Promise<void>,
        onComplete?: (statistics: StreamStatistics) => void,
        onError?: (error: Error, rowNumber: number) => void,
    ): Promise<StreamStatistics> {
        const statistics: StreamStatistics = {
            totalRows: 0,
            processedRows: 0,
            errorRows: 0,
        };

        return new Promise((resolve, reject) => {
            try {
                this.logger.log(`开始流式解析CSV文件: ${filePath}`);

                // 检测文件编码
                this.detectEncoding(filePath)
                    .then(encoding => {
                        this.logger.log(`检测到文件编码: ${encoding}`);

                        // 检测分隔符
                        this.detectDelimiter(filePath, encoding)
                            .then(delimiter => {
                                this.logger.log(`检测到分隔符: ${delimiter === ',' ? '逗号' : delimiter === ';' ? '分号' : '制表符'}`);

                                let headers: string[] = [];
                                let columnTypes: ColumnTypeMap = {};
                                const sampleRows: Record<string, any>[] = [];

                                // 创建文件读取流
                                const fileStream = fs.createReadStream(filePath);

                                // 处理BOM和编码转换
                                const chunks: Buffer[] = [];
                                fileStream.on('data', (chunk) => {
                                    // 确保chunk是Buffer类型
                                    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                                    chunks.push(buffer);
                                });

                                fileStream.on('end', async () => {
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

                                    // 解析CSV - 先收集所有数据，然后再处理
                                    const allRows: any[] = [];

                                    readable
                                        .pipe(csv({ separator: delimiter }))
                                        .on('data', (row) => {
                                            allRows.push(row);
                                        })
                                        .on('end', async () => {
                                            try {
                                                if (allRows.length === 0) {
                                                    this.logger.warn('CSV文件为空');
                                                    if (onComplete) {
                                                        onComplete(statistics);
                                                    }
                                                    resolve(statistics);
                                                    return;
                                                }

                                                // 获取表头
                                                headers = Object.keys(allRows[0]);
                                                this.logger.log(`CSV表头: ${headers.join(', ')}`);

                                                // 识别列类型（使用所有数据行）
                                                columnTypes = this.identifyColumnTypes(allRows, headers);
                                                this.logger.log(`列类型识别结果: ${JSON.stringify(columnTypes)}`);

                                                // 处理每一行数据
                                                for (let i = 0; i < allRows.length; i++) {
                                                    const row = allRows[i];
                                                    statistics.totalRows++;

                                                    try {
                                                        // 调用行处理回调
                                                        await onRow(
                                                            {
                                                                rowNumber: i + 2, // 行号从2开始（第1行是表头）
                                                                data: row,
                                                            },
                                                            columnTypes,
                                                        );
                                                        statistics.processedRows++;
                                                    } catch (error) {
                                                        statistics.errorRows++;
                                                        if (onError) {
                                                            onError(error as Error, i + 2);
                                                        }
                                                        this.logger.error(`处理第 ${i + 2} 行时出错: ${error.message}`);
                                                    }
                                                }

                                                this.logger.log(`CSV文件流式解析完成，共处理 ${statistics.totalRows} 行数据`);

                                                if (onComplete) {
                                                    onComplete(statistics);
                                                }
                                                resolve(statistics);
                                            } catch (error) {
                                                this.logger.error(`处理CSV数据失败: ${error.message}`);
                                                reject(error);
                                            }
                                        })
                                        .on('error', (error) => {
                                            this.logger.error(`流式解析CSV文件失败: ${error.message}`);
                                            if (onError) {
                                                onError(error, statistics.totalRows);
                                            }
                                            reject(error);
                                        });
                                });

                                fileStream.on('error', (error) => {
                                    this.logger.error(`读取CSV文件失败: ${error.message}`);
                                    if (onError) {
                                        onError(error, statistics.totalRows);
                                    }
                                    reject(error);
                                });
                            })
                            .catch(error => {
                                this.logger.error(`检测分隔符失败: ${error.message}`);
                                reject(error);
                            });
                    })
                    .catch(error => {
                        this.logger.error(`检测文件编码失败: ${error.message}`);
                        reject(error);
                    });
            } catch (error) {
                this.logger.error(`流式解析CSV文件失败: ${error.message}`);
                reject(error);
            }
        });
    }

    /**
     * 识别列类型
     * @param rows 行数据
     * @param headers 表头
     * @returns 列类型映射
     */
    identifyColumnTypes(rows: Record<string, any>[], headers: string[]): ColumnTypeMap {
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
     * 判断是否为有效的UTF-8文本
     * @param text 文本
     * @returns 是否有效
     */
    private isValidUtf8(text: string): boolean {
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

        if (!phoneKeywords.some((keyword) => headerLower.includes(keyword))) {
            return false;
        }

        // 更宽松的手机号正则表达式，允许包含分隔符（如-、空格），并支持更多格式
        const phoneRegex = /^1[3-9]\d{9}$|^1[3-9]\d{2}[- ]?\d{3}[- ]?\d{4}$|^1[3-9]\d{4}[- ]?\d{4}$|^1[3-9]\d{2}[- ]?\d{5}$|^1[3-9]\d{8,11}$/;
        const validCount = values.filter((v) => {
            const trimmedValue = v.toString().trim().replace(/[^0-9]/g, ''); // 去除所有非数字字符
            return phoneRegex.test(trimmedValue) || (trimmedValue.length >= 10 && trimmedValue.length <= 13 && trimmedValue.startsWith('1'));
        }).length;
        // 进一步降低识别阈值，提高对包含脏数据的列的识别准确率
        return validCount / values.length >= 0.3;
    }

    /**
     * 判断是否为日期列
     * @param header 列名
     * @param values 列值
     * @returns 是否为日期列
     */
    private isDateColumn(header: string, values: string[]): boolean {
        const dateKeywords = ['日期', '时间', 'date', 'time', 'birthday', 'birth', '入职'];
        const headerLower = header.toLowerCase();

        if (!dateKeywords.some((keyword) => headerLower.includes(keyword))) {
            return false;
        }

        // 更宽松的日期正则表达式，允许多种格式
        const dateRegex = /^\d{4}[-/.年]\d{1,2}[-/.月]?\d{1,2}日?$|^\d{2}[-/.]\d{1,2}[-/.]\d{1,2}$/;
        const validCount = values.filter((v) => dateRegex.test(v.toString().trim())).length;
        // 降低识别阈值，提高对包含脏数据的列的识别准确率
        return validCount / values.length >= 0.5;
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

        if (!addressKeywords.some((keyword) => headerLower.includes(keyword))) {
            return false;
        }

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
