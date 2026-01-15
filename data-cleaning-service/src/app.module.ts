import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataCleaningController } from './data-cleaning.controller';
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
} from './services';

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
        },
      }),
      inject: [ConfigService],
    }),

    // Configure TypeORM for entities
    TypeOrmModule.forFeature([FileRecord, CleanData, ErrorLog]),
  ],
  controllers: [AppController, DataCleaningController],
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
    DatabasePersistenceService
  ],
})
export class AppModule { }
