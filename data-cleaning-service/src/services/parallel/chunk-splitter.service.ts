import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as readline from 'readline';
import { ChunkDescriptor } from './types';

/**
 * ChunkSplitter 服务
 * 
 * 负责将 CSV 文件分割成均衡的数据块，分配给不同的工作线程处理
 * 
 * 核心功能：
 * - 计算 CSV 文件总行数
 * - 将行均匀分配给工作线程（确保差异 ≤ 1 行）
 * - 处理边界情况（文件行数 < 工作线程数）
 */
@Injectable()
export class ChunkSplitterService {
  private readonly logger = new Logger(ChunkSplitterService.name);

  /**
   * 将文件分割成数据块
   * 
   * @param filePath - CSV 文件路径
   * @param workerCount - 工作线程数量
   * @returns 数据块描述符数组
   */
  async splitFile(
    filePath: string,
    workerCount: number,
  ): Promise<ChunkDescriptor[]> {
    this.logger.log(`开始分割文件: ${filePath}, 工作线程数: ${workerCount}`);

    // 1. 计算总行数（不包括标题行）
    const totalRows = await this.countRows(filePath);
    this.logger.log(`文件总行数: ${totalRows.toLocaleString()}`);

    // 2. 如果行数为 0，返回空数组
    if (totalRows === 0) {
      this.logger.warn('文件为空，无需分割');
      return [];
    }

    // 3. 如果行数少于工作线程数，调整工作线程数
    const effectiveWorkerCount = Math.min(workerCount, totalRows);
    if (effectiveWorkerCount < workerCount) {
      this.logger.log(
        `文件行数 (${totalRows}) 少于工作线程数 (${workerCount})，` +
        `调整为 ${effectiveWorkerCount} 个工作线程`,
      );
    }

    // 4. 计算数据块
    const chunks = this.calculateChunks(totalRows, effectiveWorkerCount);

    // 5. 估算每个数据块的大小
    const fileStats = fs.statSync(filePath);
    const avgBytesPerRow = fileStats.size / (totalRows + 1); // +1 包括标题行
    
    chunks.forEach(chunk => {
      chunk.estimatedSizeBytes = Math.round(chunk.rowCount * avgBytesPerRow);
    });

    // 6. 记录分割结果
    this.logger.log(`文件分割完成，生成 ${chunks.length} 个数据块:`);
    chunks.forEach(chunk => {
      this.logger.log(
        `  数据块 ${chunk.chunkId}: 行 ${chunk.startRow}-${chunk.endRow - 1} ` +
        `(${chunk.rowCount.toLocaleString()} 行, ~${this.formatBytes(chunk.estimatedSizeBytes)})`,
      );
    });

    // 7. 验证分割结果
    this.validateChunks(chunks, totalRows);

    return chunks;
  }

  /**
   * 计算 CSV 文件的总行数（不包括标题行）
   * 
   * @param filePath - CSV 文件路径
   * @returns 总行数
   */
  private async countRows(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      let lineCount = 0;
      let isFirstLine = true;

      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      rl.on('line', () => {
        if (isFirstLine) {
          // 跳过标题行
          isFirstLine = false;
        } else {
          lineCount++;
        }
      });

      rl.on('close', () => {
        resolve(lineCount);
      });

      rl.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 计算数据块分配
   * 
   * 算法：
   * 1. 计算基础块大小 = floor(totalRows / workerCount)
   * 2. 计算余数 = totalRows % workerCount
   * 3. 将余数分配给前几个工作线程（每个多分配 1 行）
   * 
   * 这样可以确保任意两个数据块的大小差异 ≤ 1 行
   * 
   * @param totalRows - 总行数
   * @param workerCount - 工作线程数量
   * @returns 数据块描述符数组
   */
  private calculateChunks(
    totalRows: number,
    workerCount: number,
  ): ChunkDescriptor[] {
    const chunks: ChunkDescriptor[] = [];
    
    // 计算基础块大小和余数
    const baseChunkSize = Math.floor(totalRows / workerCount);
    const remainder = totalRows % workerCount;

    let startRow = 0;

    for (let i = 0; i < workerCount; i++) {
      // 前 remainder 个工作线程多分配 1 行
      const chunkSize = baseChunkSize + (i < remainder ? 1 : 0);
      
      chunks.push({
        chunkId: i,
        startRow,
        endRow: startRow + chunkSize,
        rowCount: chunkSize,
        estimatedSizeBytes: 0, // 稍后计算
      });

      startRow += chunkSize;
    }

    return chunks;
  }

  /**
   * 验证数据块分割的正确性
   * 
   * 验证项：
   * 1. 所有数据块的行数之和等于总行数
   * 2. 数据块之间没有重叠
   * 3. 数据块之间没有遗漏
   * 4. 任意两个数据块的大小差异 ≤ 1
   * 
   * @param chunks - 数据块数组
   * @param totalRows - 总行数
   */
  private validateChunks(chunks: ChunkDescriptor[], totalRows: number): void {
    // 验证 1: 总行数匹配
    const sumRows = chunks.reduce((sum, chunk) => sum + chunk.rowCount, 0);
    if (sumRows !== totalRows) {
      throw new Error(
        `数据块分割错误：总行数不匹配 (期望: ${totalRows}, 实际: ${sumRows})`,
      );
    }

    // 验证 2 & 3: 连续性和无重叠
    for (let i = 0; i < chunks.length - 1; i++) {
      const current = chunks[i];
      const next = chunks[i + 1];

      if (current.endRow !== next.startRow) {
        throw new Error(
          `数据块分割错误：数据块 ${i} 和 ${i + 1} 之间不连续 ` +
          `(块 ${i} 结束于 ${current.endRow}, 块 ${i + 1} 开始于 ${next.startRow})`,
        );
      }
    }

    // 验证第一个块从 0 开始
    if (chunks.length > 0 && chunks[0].startRow !== 0) {
      throw new Error(
        `数据块分割错误：第一个数据块应该从 0 开始 (实际: ${chunks[0].startRow})`,
      );
    }

    // 验证最后一个块结束于 totalRows
    if (chunks.length > 0 && chunks[chunks.length - 1].endRow !== totalRows) {
      throw new Error(
        `数据块分割错误：最后一个数据块应该结束于 ${totalRows} ` +
        `(实际: ${chunks[chunks.length - 1].endRow})`,
      );
    }

    // 验证 4: 大小差异 ≤ 1
    const sizes = chunks.map(c => c.rowCount);
    const maxSize = Math.max(...sizes);
    const minSize = Math.min(...sizes);
    
    if (maxSize - minSize > 1) {
      throw new Error(
        `数据块分割错误：数据块大小差异过大 ` +
        `(最大: ${maxSize}, 最小: ${minSize}, 差异: ${maxSize - minSize})`,
      );
    }

    this.logger.log('✓ 数据块分割验证通过');
  }

  /**
   * 格式化字节大小为可读格式
   * 
   * @param bytes - 字节数
   * @returns 格式化的字符串
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * 获取数据块统计信息
   * 
   * @param chunks - 数据块数组
   * @returns 统计信息
   */
  getChunkStatistics(chunks: ChunkDescriptor[]): {
    totalChunks: number;
    totalRows: number;
    avgChunkSize: number;
    minChunkSize: number;
    maxChunkSize: number;
    sizeDifference: number;
  } {
    if (chunks.length === 0) {
      return {
        totalChunks: 0,
        totalRows: 0,
        avgChunkSize: 0,
        minChunkSize: 0,
        maxChunkSize: 0,
        sizeDifference: 0,
      };
    }

    const sizes = chunks.map(c => c.rowCount);
    const totalRows = sizes.reduce((sum, size) => sum + size, 0);
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);

    return {
      totalChunks: chunks.length,
      totalRows,
      avgChunkSize: totalRows / chunks.length,
      minChunkSize: minSize,
      maxChunkSize: maxSize,
      sizeDifference: maxSize - minSize,
    };
  }
}
