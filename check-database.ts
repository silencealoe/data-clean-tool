import { createConnection } from 'typeorm';

async function checkDatabase() {
    const connection = await createConnection({
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        username: 'root',
        password: 'root123456',
        database: 'data_clean_tool',
    });

    try {
        // Get the latest job
        const fileRecords = await connection.query(`
            SELECT * FROM file_record 
            ORDER BY uploaded_at DESC 
            LIMIT 1
        `);

        if (fileRecords.length === 0) {
            console.log('没有找到文件记录');
            return;
        }

        const latestJob = fileRecords[0];
        console.log('\n最新任务信息:');
        console.log('Job ID:', latestJob.job_id);
        console.log('文件名:', latestJob.original_file_name);
        console.log('状态:', latestJob.status);
        console.log('总行数:', latestJob.total_rows);
        console.log('清洁行数:', latestJob.cleaned_rows);
        console.log('异常行数:', latestJob.exception_rows);

        // Check clean data count
        const cleanCount = await connection.query(`
            SELECT COUNT(*) as count 
            FROM clean_data 
            WHERE job_id = ?
        `, [latestJob.job_id]);
        console.log('\n数据库中清洁数据记录数:', cleanCount[0].count);

        // Check error logs count
        const errorCount = await connection.query(`
            SELECT COUNT(*) as count 
            FROM error_log 
            WHERE job_id = ?
        `, [latestJob.job_id]);
        console.log('数据库中错误日志记录数:', errorCount[0].count);

        // Show some error logs
        if (errorCount[0].count > 0) {
            const errors = await connection.query(`
                SELECT * FROM error_log 
                WHERE job_id = ? 
                LIMIT 5
            `, [latestJob.job_id]);

            console.log('\n前5条错误日志:');
            errors.forEach((err: any) => {
                console.log(`行 ${err.row_number}:`, JSON.parse(err.errors));
            });
        }

    } finally {
        await connection.close();
    }
}

checkDatabase().catch(console.error);
