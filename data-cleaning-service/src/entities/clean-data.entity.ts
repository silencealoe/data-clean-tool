import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

@Entity('clean_data')
@Index('IDX_clean_data_job_id', ['jobId'])
@Index('IDX_clean_data_row_number', ['rowNumber'])
export class CleanData {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    jobId: string;

    @Column()
    rowNumber: number;

    @Column({
        type: 'varchar',
        length: 255,
        nullable: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    })
    name: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    phone: string;

    @Column({
        type: 'varchar',
        length: 50,
        nullable: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    })
    hireDate: string;

    @Column({
        type: 'varchar',
        length: 100,
        nullable: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    })
    province: string;

    @Column({
        type: 'varchar',
        length: 100,
        nullable: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    })
    city: string;

    @Column({
        type: 'varchar',
        length: 100,
        nullable: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    })
    district: string;

    @Column({
        type: 'text',
        nullable: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    })
    addressDetail: string;

    @Column({ type: 'json', nullable: true })
    additionalFields: Record<string, any>;

    @CreateDateColumn()
    createdAt: Date;
}
