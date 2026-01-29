import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileRecord, CleanData, ErrorLog } from './entities';
import {
    FileRecordService,
    FileService,
    DateCleanerService,
    AddressCleanerService,
    PhoneCleanerService,
    ParserService,
    StreamParserService,
    DataCleanerService,
    DatabasePersistenceService,
    RuleEngineService,
    FieldProcessorService,
    RuleLoaderService,
    ConfigValidatorService,
    StrategyFactoryService,
    StrategyRegistrationService,
} from './services';
import { QueueManagerService } from './services/queue/queue-manager.service';
import { TaskConsumerService } from './services/queue/task-consumer.service';
import { ErrorHandlerService } from './services/queue/error-handler.service';
import { TimeoutManagerService } from './services/queue/timeout-manager.service';
import { ConfigurationManagerService } from './services/rule-engine/configuration-manager.service';
import { StrategyCacheService } from './services/rule-engine/strategy-cache.service';
import { ParallelProcessorService } from './services/rule-engine/parallel-processor.service';
import { ConfigValidationToolService } from './services/rule-engine/config-validation-tool.service';
import { RedisModule } from './modules/redis.module';
import redisConfig from './config/redis.config';
import queueConfig from './config/queue.config';

/**
 * Worker模块
 * 
 * 专门为独立Worker进程设计的模块，只包含队列处理所需的服务
 * 不包含Web API相关的控制器和服务，减少内存占用和启动时间
 * 
 * 需求：3.1 - 消费者应作为独立于Web API的单独进程运行
 */
@Module({
    imports: [
        // 配置模块 - 加载环境变量和配置
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
            load: [redisConfig, queueConfig],
        }),

        // Redis模块 - 队列管理所需
        RedisModule,

        // 数据库模块 - 异步配置
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                type: configService.get<'mysql'>('DB_TYPE', 'mysql'),
                host: configService.get<string>('DB_HOST', 'localhost'),
                port: configService.get<number>('DB_PORT', 3306),
                username: configService.get<string>('DB_USERNAME', 'root'),
                password: configService.get<string>('DB_PASSWORD', 'password'),
                database: configService.get<string>('DB_DATABASE', 'data_cleaning_service'),
                entities: [FileRecord, CleanData, ErrorLog],
                synchronize: configService.get<boolean>('DB_SYNCHRONIZE', true),
                logging: configService.get<boolean>('DB_LOGGING', false),
                // Worker进程优化配置
                autoLoadEntities: true,
                retryAttempts: 3,
                retryDelay: 3000,
                charset: 'utf8mb4',
                extra: {
                    charset: 'utf8mb4_unicode_ci',
                    // Worker进程使用较少的连接池
                    connectionLimit: 10, // 减少连接数，Worker进程通常只需要少量连接
                    queueLimit: 0,
                    // 优化Worker进程的数据库连接
                    acquireTimeout: 60000,
                    timeout: 60000,
                },
            }),
            inject: [ConfigService],
        }),

        // 实体模块
        TypeOrmModule.forFeature([FileRecord, CleanData, ErrorLog]),
    ],
    providers: [
        // 队列服务 - 核心功能
        QueueManagerService,
        TaskConsumerService,
        ErrorHandlerService,
        TimeoutManagerService,

        // 文件处理服务
        FileRecordService,
        FileService,
        DataCleanerService,
        DatabasePersistenceService,

        // 解析服务
        ParserService,
        StreamParserService,

        // 数据清洗服务
        DateCleanerService,
        AddressCleanerService,
        PhoneCleanerService,

        // 规则引擎服务
        RuleEngineService,
        FieldProcessorService,
        RuleLoaderService,
        ConfigValidatorService,
        StrategyFactoryService,
        StrategyRegistrationService,
        ConfigurationManagerService,
        StrategyCacheService,
        ParallelProcessorService,
        ConfigValidationToolService,
    ],
    exports: [
        // 导出主要服务供Worker进程使用
        TaskConsumerService,
        QueueManagerService,
        DataCleanerService,
    ],
})
export class WorkerModule {
    constructor() {
        // Worker模块初始化日志
        console.log('WorkerModule initialized for queue processing');
    }
}