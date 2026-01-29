import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueManagerService } from '../services/queue';
import redisConfig from '../config/redis.config';
import queueConfig from '../config/queue.config';

@Module({
    imports: [
        ConfigModule.forFeature(redisConfig),
        ConfigModule.forFeature(queueConfig),
    ],
    providers: [QueueManagerService],
    exports: [QueueManagerService],
})
export class RedisModule { }