import { DataSource } from 'typeorm';
import { CleanData } from './src/entities/clean-data.entity';
import { ErrorLog } from './src/entities/error-log.entity';
import { FileRecord } from './src/entities/file-record.entity';

// 创建数据库连接
const AppDataSource = new DataSource({
    type: 'sqlite',
    database: 'data/data-cleaning.db',
    entities: [CleanData, ErrorLog, FileRecord],
    synchronize: false,
});

async function testDatabaseQuery() {
    try {
        await AppDataSource.initialize();
        console.log('数据库连接成功\n');

        // 查询最近的文件记录
        const fileRecordRepo = AppDataSource.getRepository(FileRecord);
        const recentFiles = await fileRecordRepo.find({
            order: { uploadedAt: 'DESC' },
            take: 5,
        });

        console.log('=== 最近5个文件记录 ===');
        recentFiles.forEach((file, index) => {
            console.log(`\n${index + 1}. ${file.originalFileName}`);
            console.log(`   Job ID: ${file.jobId}`);
            console.log(`   状态: ${file.status}`);
            console.log(`   总行数: ${file.totalRows}`);
            console.log(`   清洁数据: ${file.cleanedRows}`);
            console.log(`   异常数据: ${file.exceptionRows}`);
            console.log(`   上传时间: ${file.uploadedAt}`);
        });

        // 如果有文件，查询第一个文件的详细数据
        if (recentFiles.length > 0) {
            const firstFile = recentFiles[0];
            console.log(`\n\n=== 查询文件 "${firstFile.originalFileName}" 的详细数据 ===`);

            // 查询清洁数据
            const cleanDataRepo = AppDataSource.getRepository(CleanData);
            const cleanDataCount = await cleanDataRepo.count({
                where: { jobId: firstFile.jobId },
            });
            console.log(`\n清洁数据记录数: ${cleanDataCount}`);

            if (cleanDataCount > 0) {
                const sampleCleanData = await cleanDataRepo.find({
                    where: { jobId: firstFile.jobId },
                    take: 3,
                });
                console.log('前3条清洁数据:');
                sampleCleanData.forEach((data, index) => {
                    console.log(`  ${index + 1}. 行号: ${data.rowNumber}`);
                    console.log(`     数据: ${JSON.stringify(data).substring(0, 200)}...`);
                });
            }

            // 查询异常数据
            const errorLogRepo = AppDataSource.getRepository(ErrorLog);
            const errorLogCount = await errorLogRepo.count({
                where: { jobId: firstFile.jobId },
            });
            console.log(`\n异常数据记录数: ${errorLogCount}`);

            if (errorLogCount > 0) {
                const sampleErrorLogs = await errorLogRepo.find({
                    where: { jobId: firstFile.jobId },
                    take: 3,
                });
                console.log('前3条异常数据:');
                sampleErrorLogs.forEach((log, index) => {
                    console.log(`  ${index + 1}. 行号: ${log.rowNumber}`);
                    console.log(`     原始数据: ${JSON.stringify(log.originalData).substring(0, 100)}...`);
                    console.log(`     错误: ${JSON.stringify(log.errors).substring(0, 100)}...`);
                });
            }

            // 验证数据完整性
            const totalInDb = cleanDataCount + errorLogCount;
            console.log(`\n数据完整性检查:`);
            console.log(`  文件记录中的总行数: ${firstFile.totalRows}`);
            console.log(`  数据库中的总记录数: ${totalInDb} (清洁: ${cleanDataCount}, 异常: ${errorLogCount})`);
            console.log(`  数据完整性: ${totalInDb === firstFile.totalRows ? '✓ 正确' : '✗ 不匹配'}`);
        }

        await AppDataSource.destroy();
    } catch (error) {
        console.error('查询失败:', error);
        process.exit(1);
    }
}

testDatabaseQuery();
