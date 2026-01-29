import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QueueManagerService } from '../services/queue';

@ApiTags('Queue Health')
@Controller('api/queue')
export class QueueHealthController {
    constructor(private readonly queueManager: QueueManagerService) { }

    @Get('health')
    @ApiOperation({ summary: 'Check queue system health' })
    @ApiResponse({ status: 200, description: 'Queue system health status' })
    async checkHealth() {
        try {
            const isHealthy = await this.queueManager.isHealthy();
            const stats = await this.queueManager.getQueueStats();

            return {
                status: isHealthy ? 'healthy' : 'unhealthy',
                redis: {
                    connected: isHealthy,
                },
                queue: {
                    length: stats.queueLength,
                    totalEnqueued: stats.totalEnqueued,
                    totalProcessed: stats.totalProcessed,
                    totalFailed: stats.totalFailed,
                    activeWorkers: stats.activeWorkers,
                },
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString(),
            };
        }
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get detailed queue statistics' })
    @ApiResponse({ status: 200, description: 'Detailed queue statistics' })
    async getStats() {
        try {
            const stats = await this.queueManager.getQueueStats();
            return {
                ...stats,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            return {
                error: error.message,
                timestamp: new Date().toISOString(),
            };
        }
    }
}