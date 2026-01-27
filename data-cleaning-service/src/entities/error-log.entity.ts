import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';
import { FieldError } from '../common/types';

@Entity('error_logs')
@Index('IDX_error_log_job_id', ['jobId'])
@Index('IDX_error_log_row_number', ['rowNumber'])
export class ErrorLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    jobId: string;

    @Column()
    rowNumber: number;

    @Column({ type: 'json' })
    originalData: Record<string, any>;

    @Column({
        type: 'text',
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    })
    errors: string;

    @Column({
        type: 'text',
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    })
    errorSummary: string;

    @CreateDateColumn()
    createdAt: Date;
}