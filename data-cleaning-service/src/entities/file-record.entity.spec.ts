import { FileRecord } from './file-record.entity';

describe('FileRecord Entity', () => {
    describe('Entity Creation', () => {
        it('should create a FileRecord instance with all required fields', () => {
            const fileRecord = new FileRecord();

            // Set required fields
            fileRecord.jobId = 'test-job-123';
            fileRecord.originalFileName = 'test-file.xlsx';
            fileRecord.fileSize = 1024;
            fileRecord.fileType = 'xlsx';
            fileRecord.mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

            expect(fileRecord).toBeInstanceOf(FileRecord);
            expect(fileRecord.jobId).toBe('test-job-123');
            expect(fileRecord.originalFileName).toBe('test-file.xlsx');
            expect(fileRecord.fileSize).toBe(1024);
            expect(fileRecord.fileType).toBe('xlsx');
            expect(fileRecord.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        });

        it('should create a FileRecord with all possible fields', () => {
            const fileRecord = new FileRecord();

            // Set all fields
            fileRecord.id = 'uuid-123';
            fileRecord.jobId = 'test-job-456';
            fileRecord.originalFileName = 'data.xlsx';
            fileRecord.fileSize = 2048;
            fileRecord.fileType = 'xlsx';
            fileRecord.mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            fileRecord.status = 'completed';
            fileRecord.uploadedAt = new Date('2024-01-15T10:00:00Z');
            fileRecord.completedAt = new Date('2024-01-15T10:05:00Z');
            fileRecord.totalRows = 100;
            fileRecord.cleanedRows = 95;
            fileRecord.exceptionRows = 5;
            fileRecord.processingTime = 5000;
            fileRecord.cleanDataPath = '/path/to/clean.xlsx';
            fileRecord.exceptionDataPath = '/path/to/exceptions.xlsx';
            fileRecord.errorMessage = 'Test error message';
            fileRecord.createdAt = new Date('2024-01-15T10:00:00Z');
            fileRecord.updatedAt = new Date('2024-01-15T10:05:00Z');

            expect(fileRecord.id).toBe('uuid-123');
            expect(fileRecord.jobId).toBe('test-job-456');
            expect(fileRecord.originalFileName).toBe('data.xlsx');
            expect(fileRecord.fileSize).toBe(2048);
            expect(fileRecord.fileType).toBe('xlsx');
            expect(fileRecord.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            expect(fileRecord.status).toBe('completed');
            expect(fileRecord.uploadedAt).toEqual(new Date('2024-01-15T10:00:00Z'));
            expect(fileRecord.completedAt).toEqual(new Date('2024-01-15T10:05:00Z'));
            expect(fileRecord.totalRows).toBe(100);
            expect(fileRecord.cleanedRows).toBe(95);
            expect(fileRecord.exceptionRows).toBe(5);
            expect(fileRecord.processingTime).toBe(5000);
            expect(fileRecord.cleanDataPath).toBe('/path/to/clean.xlsx');
            expect(fileRecord.exceptionDataPath).toBe('/path/to/exceptions.xlsx');
            expect(fileRecord.errorMessage).toBe('Test error message');
            expect(fileRecord.createdAt).toEqual(new Date('2024-01-15T10:00:00Z'));
            expect(fileRecord.updatedAt).toEqual(new Date('2024-01-15T10:05:00Z'));
        });
    });

    describe('Field Validation', () => {
        it('should have correct field types for required fields', () => {
            const fileRecord = new FileRecord();

            fileRecord.jobId = 'test-job-789';
            fileRecord.originalFileName = 'test.xlsx';
            fileRecord.fileSize = 512;
            fileRecord.fileType = 'xlsx';
            fileRecord.mimeType = 'application/vnd.ms-excel';

            expect(typeof fileRecord.jobId).toBe('string');
            expect(typeof fileRecord.originalFileName).toBe('string');
            expect(typeof fileRecord.fileSize).toBe('number');
            expect(typeof fileRecord.fileType).toBe('string');
            expect(typeof fileRecord.mimeType).toBe('string');
        });

        it('should handle valid status enum values', () => {
            const fileRecord = new FileRecord();

            const validStatuses: Array<'pending' | 'processing' | 'completed' | 'failed'> = [
                'pending',
                'processing',
                'completed',
                'failed'
            ];

            validStatuses.forEach(status => {
                fileRecord.status = status;
                expect(fileRecord.status).toBe(status);
            });
        });

        it('should handle nullable fields correctly', () => {
            const fileRecord = new FileRecord();

            // Test nullable fields - these should be undefined initially
            expect(fileRecord.completedAt).toBeUndefined();
            expect(fileRecord.totalRows).toBeUndefined();
            expect(fileRecord.cleanedRows).toBeUndefined();
            expect(fileRecord.exceptionRows).toBeUndefined();
            expect(fileRecord.processingTime).toBeUndefined();
            expect(fileRecord.cleanDataPath).toBeUndefined();
            expect(fileRecord.exceptionDataPath).toBeUndefined();
            expect(fileRecord.errorMessage).toBeUndefined();
        });

        it('should handle numeric fields correctly', () => {
            const fileRecord = new FileRecord();

            fileRecord.fileSize = 1024;
            fileRecord.totalRows = 500;
            fileRecord.cleanedRows = 450;
            fileRecord.exceptionRows = 50;
            fileRecord.processingTime = 3000;

            expect(typeof fileRecord.fileSize).toBe('number');
            expect(typeof fileRecord.totalRows).toBe('number');
            expect(typeof fileRecord.cleanedRows).toBe('number');
            expect(typeof fileRecord.exceptionRows).toBe('number');
            expect(typeof fileRecord.processingTime).toBe('number');

            expect(fileRecord.fileSize).toBe(1024);
            expect(fileRecord.totalRows).toBe(500);
            expect(fileRecord.cleanedRows).toBe(450);
            expect(fileRecord.exceptionRows).toBe(50);
            expect(fileRecord.processingTime).toBe(3000);
        });
    });

    describe('Default Values and Timestamps', () => {
        it('should have undefined default status when not set (TypeORM will apply default)', () => {
            const fileRecord = new FileRecord();

            // When creating a new instance without setting status,
            // it should be undefined until TypeORM applies the default
            expect(fileRecord.status).toBeUndefined();
        });

        it('should allow setting status to default value manually', () => {
            const fileRecord = new FileRecord();

            // Manually set to default value
            fileRecord.status = 'pending';
            expect(fileRecord.status).toBe('pending');
        });

        it('should handle uploadedAt timestamp field', () => {
            const fileRecord = new FileRecord();
            const testDate = new Date('2024-01-15T12:00:00Z');

            fileRecord.uploadedAt = testDate;
            expect(fileRecord.uploadedAt).toEqual(testDate);
            expect(fileRecord.uploadedAt).toBeInstanceOf(Date);
        });

        it('should handle createdAt and updatedAt timestamp fields', () => {
            const fileRecord = new FileRecord();
            const createdDate = new Date('2024-01-15T10:00:00Z');
            const updatedDate = new Date('2024-01-15T11:00:00Z');

            fileRecord.createdAt = createdDate;
            fileRecord.updatedAt = updatedDate;

            expect(fileRecord.createdAt).toEqual(createdDate);
            expect(fileRecord.updatedAt).toEqual(updatedDate);
            expect(fileRecord.createdAt).toBeInstanceOf(Date);
            expect(fileRecord.updatedAt).toBeInstanceOf(Date);
        });

        it('should handle completedAt timestamp when processing is done', () => {
            const fileRecord = new FileRecord();
            const completedDate = new Date('2024-01-15T10:30:00Z');

            // Initially undefined
            expect(fileRecord.completedAt).toBeUndefined();

            // Set when completed
            fileRecord.completedAt = completedDate;
            expect(fileRecord.completedAt).toEqual(completedDate);
            expect(fileRecord.completedAt).toBeInstanceOf(Date);
        });

        it('should handle timestamp auto-generation behavior simulation', () => {
            const fileRecord = new FileRecord();

            // Simulate what TypeORM would do for auto-generated timestamps
            const now = new Date();
            fileRecord.uploadedAt = now; // Simulates CURRENT_TIMESTAMP default
            fileRecord.createdAt = now;  // Simulates @CreateDateColumn
            fileRecord.updatedAt = now;  // Simulates @UpdateDateColumn

            expect(fileRecord.uploadedAt).toEqual(now);
            expect(fileRecord.createdAt).toEqual(now);
            expect(fileRecord.updatedAt).toEqual(now);

            // Verify all are Date instances
            expect(fileRecord.uploadedAt).toBeInstanceOf(Date);
            expect(fileRecord.createdAt).toBeInstanceOf(Date);
            expect(fileRecord.updatedAt).toBeInstanceOf(Date);
        });
    });

    describe('Entity Structure', () => {
        it('should have all expected properties defined', () => {
            const fileRecord = new FileRecord();

            // Check that all properties exist (even if undefined)
            expect('id' in fileRecord).toBe(true);
            expect('jobId' in fileRecord).toBe(true);
            expect('originalFileName' in fileRecord).toBe(true);
            expect('fileSize' in fileRecord).toBe(true);
            expect('fileType' in fileRecord).toBe(true);
            expect('mimeType' in fileRecord).toBe(true);
            expect('status' in fileRecord).toBe(true);
            expect('uploadedAt' in fileRecord).toBe(true);
            expect('completedAt' in fileRecord).toBe(true);
            expect('totalRows' in fileRecord).toBe(true);
            expect('cleanedRows' in fileRecord).toBe(true);
            expect('exceptionRows' in fileRecord).toBe(true);
            expect('processingTime' in fileRecord).toBe(true);
            expect('cleanDataPath' in fileRecord).toBe(true);
            expect('exceptionDataPath' in fileRecord).toBe(true);
            expect('errorMessage' in fileRecord).toBe(true);
            expect('createdAt' in fileRecord).toBe(true);
            expect('updatedAt' in fileRecord).toBe(true);
        });

        it('should support file type variations', () => {
            const fileRecord = new FileRecord();

            // Test xlsx file
            fileRecord.fileType = 'xlsx';
            fileRecord.mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            expect(fileRecord.fileType).toBe('xlsx');
            expect(fileRecord.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

            // Test xls file
            fileRecord.fileType = 'xls';
            fileRecord.mimeType = 'application/vnd.ms-excel';
            expect(fileRecord.fileType).toBe('xls');
            expect(fileRecord.mimeType).toBe('application/vnd.ms-excel');
        });

        it('should handle error message field correctly', () => {
            const fileRecord = new FileRecord();

            // Initially undefined
            expect(fileRecord.errorMessage).toBeUndefined();

            // Set error message
            const errorMsg = 'File parsing failed: Invalid format';
            fileRecord.errorMessage = errorMsg;
            expect(fileRecord.errorMessage).toBe(errorMsg);
            expect(typeof fileRecord.errorMessage).toBe('string');
        });
    });
});