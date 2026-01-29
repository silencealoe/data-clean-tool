import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

@Entity('file_records')
@Index('IDX_file_record_status', ['status'])
@Index('IDX_file_record_uploaded_at', ['uploadedAt'])
@Index('IDX_file_record_job_id', ['jobId'])
@Index('IDX_file_record_task_id', ['taskId'])
@Index('IDX_file_record_queue_status', ['queueStatus'])
export class FileRecord {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    jobId: string;

    @Column({ nullable: true, unique: true })
    taskId?: string;

    @Column({
        type: 'varchar',
        length: 255,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    })
    originalFileName: string;

    @Column()
    fileSize: number;

    @Column()
    fileType: string; // 'xlsx' | 'xls'

    @Column()
    mimeType: string;

    @Column({
        type: 'enum',
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
    })
    status: 'pending' | 'processing' | 'completed' | 'failed';

    @Column({
        type: 'enum',
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
        nullable: true
    })
    queueStatus?: 'pending' | 'processing' | 'completed' | 'failed';

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    uploadedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    enqueuedAt?: Date;

    @Column({ type: 'timestamp', nullable: true })
    processingStartedAt?: Date;

    @Column({ type: 'timestamp', nullable: true })
    completedAt?: Date;

    @Column({ type: 'int', nullable: true })
    totalRows?: number;

    @Column({ type: 'int', nullable: true })
    cleanedRows?: number;

    @Column({ type: 'int', nullable: true })
    exceptionRows?: number;

    @Column({ type: 'int', nullable: true })
    processingTime?: number; // 毫秒

    @Column({ nullable: true })
    cleanDataPath?: string;

    @Column({ nullable: true })
    exceptionDataPath?: string;

    @Column({ type: 'text', nullable: true })
    errorMessage?: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}