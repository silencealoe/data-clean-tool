/**
 * Performance Test: 1 Million Rows Processing
 * 
 * This test verifies that the data cleaning service can process
 * 1 million rows in less than 60 seconds.
 * 
 * Acceptance Criteria:
 * - Processing time < 60 seconds
 * - All rows are processed (successCount + errorCount = 1,000,000)
 * - No data loss or corruption
 */

import * as fs from 'fs';
import * as path from 'path';
import { createWriteStream } from 'fs';

// Configuration
const TEST_FILE_PATH = path.join(__dirname, 'test-data', 'performance-1m-rows.csv');
const TOTAL_ROWS = 1_000_000;
const TARGET_TIME_SECONDS = 60;

// Sample data generators
const surnames = ['张', '李', '王', '赵', '钱', '孙', '周', '吴', '郑', '陈', '刘', '杨', '黄', '朱', '林', '何', '郭', '马', '罗', '梁'];
const names = ['伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀兰', '霞'];
const provinces = ['北京市', '上海市', '广东省', '江苏省', '浙江省', '山东省', '河南省', '湖北省', '四川省', '湖南省'];
const cities = ['朝阳区', '海淀区', '浦东新区', '黄浦区', '南山区', '福田区', '鼓楼区', '玄武区', '西湖区', '江干区'];
const streets = ['建国路', '人民路', '中山路', '解放路', '和平路', '胜利路', '光明路', '友谊路', '团结路', '民主路'];

function randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateName(): string {
    const surname = randomChoice(surnames);
    const name = randomChoice(names);
    return surname + name;
}

function generatePhone(): string {
    const prefixes = ['138', '139', '150', '151', '152', '186', '187', '188', '189'];
    const prefix = randomChoice(prefixes);
    const number = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    
    // 90% correct format, 10% with formatting
    if (Math.random() < 0.9) {
        return prefix + number;
    } else {
        return `${prefix}-${number.slice(0, 4)}-${number.slice(4)}`;
    }
}

function generateAddress(): string {
    const province = randomChoice(provinces);
    const city = randomChoice(cities);
    const street = randomChoice(streets);
    const number = Math.floor(Math.random() * 999) + 1;
    return `${province}${city}${street}${number}号`;
}

function generateDate(): string {
    const year = 2023;
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    
    // 80% correct format, 20% various formats
    const rand = Math.random();
    if (rand < 0.8) {
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    } else if (rand < 0.9) {
        return `${year}/${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`;
    } else {
        return `${year}年${month}月${day}日`;
    }
}

async function generateTestFile(): Promise<void> {
    console.log(`\n📝 Generating test file with ${TOTAL_ROWS.toLocaleString()} rows...`);
    
    const testDataDir = path.join(__dirname, 'test-data');
    if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
    }
    
    const startTime = Date.now();
    const writeStream = createWriteStream(TEST_FILE_PATH, { encoding: 'utf-8' });
    
    // Write header
    writeStream.write('姓名,手机号码,地址,入职日期\n');
    
    // Write rows in batches
    const batchSize = 10000;
    let rowsWritten = 0;
    
    for (let i = 0; i < TOTAL_ROWS; i++) {
        const name = generateName();
        const phone = generatePhone();
        const address = generateAddress();
        const date = generateDate();
        
        writeStream.write(`${name},${phone},${address},${date}\n`);
        rowsWritten++;
        
        // Progress update every 100k rows
        if (rowsWritten % 100000 === 0) {
            const elapsed = (Date.now() - startTime) / 1000;
            const progress = (rowsWritten / TOTAL_ROWS) * 100;
            console.log(`  Progress: ${rowsWritten.toLocaleString()} rows (${progress.toFixed(1)}%) - ${elapsed.toFixed(1)}s`);
        }
    }
    
    writeStream.end();
    
    await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
    });
    
    const elapsed = (Date.now() - startTime) / 1000;
    const fileSize = fs.statSync(TEST_FILE_PATH).size;
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
    
    console.log(`✓ Test file generated successfully!`);
    console.log(`  File: ${TEST_FILE_PATH}`);
    console.log(`  Size: ${fileSizeMB} MB`);
    console.log(`  Rows: ${TOTAL_ROWS.toLocaleString()}`);
    console.log(`  Time: ${elapsed.toFixed(2)}s`);
    console.log(`  Speed: ${(TOTAL_ROWS / elapsed).toFixed(0)} rows/s\n`);
}

async function testProcessingPerformance(): Promise<void> {
    console.log(`\n🚀 Starting performance test...`);
    console.log(`  Target: Process ${TOTAL_ROWS.toLocaleString()} rows in < ${TARGET_TIME_SECONDS}s\n`);
    
    // Import required modules
    const { Test } = require('@nestjs/testing');
    const { TypeOrmModule } = require('@nestjs/typeorm');
    const { ConfigModule } = require('@nestjs/config');
    const { DataCleanerService } = require('./src/services/data-cleaner.service');
    const { PhoneCleanerService } = require('./src/services/phone-cleaner.service');
    const { DateCleanerService } = require('./src/services/date-cleaner.service');
    const { AddressCleanerService } = require('./src/services/address-cleaner.service');
    const { StreamParserService } = require('./src/services/stream-parser.service');
    const { DatabasePersistenceService } = require('./src/services/database-persistence.service');
    const { CleanDataEntity } = require('./src/entities/clean-data.entity');
    const { ErrorLogEntity } = require('./src/entities/error-log.entity');
    const { FileRecordEntity } = require('./src/entities/file-record.entity');
    
    // Create testing module
    const moduleRef = await Test.createTestingModule({
        imports: [
            ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: '.env',
            }),
            TypeOrmModule.forRoot({
                type: 'mysql',
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '3306'),
                username: process.env.DB_USERNAME || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_DATABASE || 'data_cleaning',
                entities: [CleanDataEntity, ErrorLogEntity, FileRecordEntity],
                synchronize: false,
            }),
            TypeOrmModule.forFeature([CleanDataEntity, ErrorLogEntity, FileRecordEntity]),
        ],
        providers: [
            DataCleanerService,
            PhoneCleanerService,
            DateCleanerService,
            AddressCleanerService,
            StreamParserService,
            DatabasePersistenceService,
        ],
    }).compile();
    
    const dataCleanerService = moduleRef.get(DataCleanerService);
    const jobId = `perf-test-${Date.now()}`;
    
    console.log(`📊 Processing file...`);
    console.log(`  Job ID: ${jobId}`);
    console.log(`  File: ${TEST_FILE_PATH}\n`);
    
    const startTime = Date.now();
    
    try {
        const result = await dataCleanerService.cleanDataStream(TEST_FILE_PATH, jobId);
        
        const endTime = Date.now();
        const processingTimeSeconds = (endTime - startTime) / 1000;
        
        console.log(`\n✓ Processing completed!`);
        console.log(`\n📈 Results:`);
        console.log(`  Total rows: ${result.statistics.totalRows.toLocaleString()}`);
        console.log(`  Clean rows: ${result.statistics.processedRows.toLocaleString()}`);
        console.log(`  Error rows: ${result.statistics.errorRows.toLocaleString()}`);
        console.log(`  Processing time: ${processingTimeSeconds.toFixed(2)}s`);
        console.log(`  Average speed: ${(result.statistics.totalRows / processingTimeSeconds).toFixed(0)} rows/s`);
        
        // Verify acceptance criteria
        console.log(`\n✅ Acceptance Criteria Verification:`);
        
        // 1. Processing time < 60 seconds
        const timeCheck = processingTimeSeconds < TARGET_TIME_SECONDS;
        console.log(`  ${timeCheck ? '✓' : '✗'} Processing time < ${TARGET_TIME_SECONDS}s: ${processingTimeSeconds.toFixed(2)}s ${timeCheck ? 'PASS' : 'FAIL'}`);
        
        // 2. All rows processed
        const totalProcessed = result.statistics.processedRows + result.statistics.errorRows;
        const dataIntegrityCheck = totalProcessed === TOTAL_ROWS;
        console.log(`  ${dataIntegrityCheck ? '✓' : '✗'} Data integrity: ${totalProcessed.toLocaleString()} / ${TOTAL_ROWS.toLocaleString()} ${dataIntegrityCheck ? 'PASS' : 'FAIL'}`);
        
        // 3. Performance metrics
        const speedCheck = (result.statistics.totalRows / processingTimeSeconds) > 16000; // Target: > 16k rows/s
        console.log(`  ${speedCheck ? '✓' : '✗'} Processing speed > 16,000 rows/s: ${(result.statistics.totalRows / processingTimeSeconds).toFixed(0)} rows/s ${speedCheck ? 'PASS' : 'FAIL'}`);
        
        // Overall result
        const allPassed = timeCheck && dataIntegrityCheck && speedCheck;
        console.log(`\n${allPassed ? '🎉 ALL TESTS PASSED!' : '❌ SOME TESTS FAILED'}`);
        
        if (!allPassed) {
            process.exit(1);
        }
        
    } catch (error) {
        console.error(`\n❌ Processing failed:`, error);
        process.exit(1);
    } finally {
        await moduleRef.close();
    }
}

async function main() {
    console.log('='.repeat(80));
    console.log('Performance Test: 1 Million Rows Processing');
    console.log('='.repeat(80));
    
    try {
        // Check if test file exists
        if (!fs.existsSync(TEST_FILE_PATH)) {
            await generateTestFile();
        } else {
            console.log(`\n✓ Test file already exists: ${TEST_FILE_PATH}`);
            const fileSize = fs.statSync(TEST_FILE_PATH).size;
            const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
            console.log(`  Size: ${fileSizeMB} MB\n`);
        }
        
        // Run performance test
        await testProcessingPerformance();
        
        console.log('\n' + '='.repeat(80));
        console.log('Performance test completed successfully!');
        console.log('='.repeat(80) + '\n');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
