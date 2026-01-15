/**
 * ChunkSplitter 使用示例
 * 
 * 演示如何使用 ChunkSplitter 服务分割文件
 */

import { ChunkSplitterService } from './chunk-splitter.service';

async function example() {
  const splitter = new ChunkSplitterService();

  // 示例 1: 分割 1,000,000 行文件给 4 个工作线程
  console.log('=== 示例 1: 100万行 / 4个工作线程 ===');
  const chunks1 = await splitter.splitFile('test-file.csv', 4);
  console.log('数据块:', chunks1);
  console.log('统计:', splitter.getChunkStatistics(chunks1));

  // 示例 2: 分割 1,000,001 行文件给 4 个工作线程（有余数）
  console.log('\n=== 示例 2: 1,000,001行 / 4个工作线程 ===');
  // 预期结果：
  // - 数据块 0: 250,001 行
  // - 数据块 1: 250,000 行
  // - 数据块 2: 250,000 行
  // - 数据块 3: 250,000 行

  // 示例 3: 文件行数少于工作线程数
  console.log('\n=== 示例 3: 3行 / 4个工作线程 ===');
  // 预期结果：只创建 3 个工作线程，每个处理 1 行
}

// 运行示例
if (require.main === module) {
  example().catch(console.error);
}
