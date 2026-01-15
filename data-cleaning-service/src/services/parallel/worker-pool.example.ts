/**
 * WorkerPool 使用示例
 * 
 * 演示如何使用 WorkerPool 服务管理工作线程
 */

import { WorkerPoolService } from './worker-pool.service';
import { WorkerTask } from './types';

async function example() {
  const pool = new WorkerPoolService();

  try {
    // 1. 初始化工作线程池（创建 4 个工作线程）
    console.log('=== 初始化工作线程池 ===');
    await pool.initialize(4);
    
    // 2. 查看池状态
    console.log('\n=== 工作线程池状态 ===');
    const status = pool.getStatus();
    console.log('状态:', status);
    console.log('详情:', pool.getWorkerDetails());

    // 3. 分配任务给工作线程
    console.log('\n=== 分配任务 ===');
    const task: WorkerTask = {
      filePath: '/path/to/file.csv',
      startRow: 0,
      rowCount: 250000,
      batchSize: 10000,
      workerId: 0,
      jobId: 'test-job-123',
      timeoutMs: 300000, // 5 分钟
    };

    const result = await pool.executeTask(task);
    console.log('任务结果:', result);

    // 4. 检查健康状态
    console.log('\n=== 健康检查 ===');
    console.log('是否健康:', pool.isHealthy());

    // 5. 优雅关闭
    console.log('\n=== 关闭工作线程池 ===');
    await pool.terminate();
    console.log('✓ 工作线程池已关闭');

  } catch (error) {
    console.error('错误:', error);
    await pool.terminate();
  }
}

// 运行示例
if (require.main === module) {
  example().catch(console.error);
}
