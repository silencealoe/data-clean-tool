import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataCleaningController } from './data-cleaning.controller';
<<<<<<< HEAD
import { RuleConfigController } from './rule-config.controller';
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
  ExportService,
  DatabasePersistenceService,
  RuleEngineService,
  FieldProcessorService,
  RuleLoaderService,
  ConfigValidatorService,
  StrategyFactoryService,
  StrategyRegistrationService
=======
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
    ExportService,
    DatabasePersistenceService
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
} from './services';
import { ConfigurationManagerService } from './services/rule-engine/configuration-manager.service';
import { StrategyCacheService } from './services/rule-engine/strategy-cache.service';
import { ParallelProcessorService } from './services/rule-engine/parallel-processor.service';
import { ConfigValidationToolService } from './services/rule-engine/config-validation-tool.service';
import { ParallelProcessingManagerService } from './services/parallel/parallel-processing-manager.service';
import { ChunkSplitterService } from './services/parallel/chunk-splitter.service';
import { WorkerPoolService } from './services/parallel/worker-pool.service';
import { ResultCollectorService } from './services/parallel/result-collector.service';
import { ProgressTrackerService } from './services/parallel/progress-tracker.service';
import { PerformanceMonitorService } from './services/parallel/performance-monitor.service';
import { ResourceMonitorService } from './services/parallel/resource-monitor.service';

@Module({
  imports: [
    // Configure environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Configure TypeORM with async configuration
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
        // Additional configuration for better performance and reliability
        autoLoadEntities: true,
        retryAttempts: 3,
        retryDelay: 3000,
        // 确保使用正确的字符集处理中文
        charset: 'utf8mb4',
        extra: {
          charset: 'utf8mb4_unicode_ci',
          connectionLimit: 100, // 连接池（增加到100以支持更高并发）
          queueLimit: 0,
        },
      }),
      inject: [ConfigService],
    }),

    // Configure TypeORM for entities
    TypeOrmModule.forFeature([FileRecord, CleanData, ErrorLog]),
  ],
  controllers: [AppController, DataCleaningController, RuleConfigController],
  providers: [
    AppService,
    FileRecordService,
    FileService,
    DateCleanerService,
    AddressCleanerService,
    PhoneCleanerService,
    ParserService,
    StreamParserService,
    DataCleanerService,
    ExportService,
<<<<<<< HEAD
    DatabasePersistenceService,
    // Rule Engine Services
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
    // 并行处理服务
    ParallelProcessingManagerService,
    ChunkSplitterService,
    WorkerPoolService,
    ResultCollectorService,
    ProgressTrackerService,
    PerformanceMonitorService,
    ResourceMonitorService,
=======
    DatabasePersistenceService
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
  ],
})
export class AppModule { }
