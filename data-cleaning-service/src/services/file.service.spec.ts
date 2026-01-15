import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FileService } from './file.service';
import { ERROR_CODES } from '../common/constants';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Readable } from 'stream';
import * as fc from 'fast-check';

describe('FileService', () => {
    let service: FileService;
    let configService: ConfigService;

    const mockConfigService = {
        get: jest.fn((key: string, defaultValue?: any) => {
            const config = {
                'MAX_FILE_SIZE': 500 * 1024 * 1024, // 500MB
                'TEMP_DIR': './temp'
            };
            return config[key] || defaultValue;
        }),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FileService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<FileService>(FileService);
        configService = module.get<ConfigService>(ConfigService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('validateFile', () => {
        it('should accept valid Excel files (.xlsx)', () => {
            const mockFile: Express.Multer.File = {
                fieldname: 'file',
                originalname: 'test.xlsx',
                encoding: '7bit',
                mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                size: 1024,
                buffer: Buffer.from('test'),
                destination: '',
                filename: '',
                path: '',
                stream: new Readable(),
            };

            const result = service.validateFile(mockFile);
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should accept valid Excel files (.xls)', () => {
            const mockFile: Express.Multer.File = {
                fieldname: 'file',
                originalname: 'test.xls',
                encoding: '7bit',
                mimetype: 'application/vnd.ms-excel',
                size: 1024,
                buffer: Buffer.from('test'),
                destination: '',
                filename: '',
                path: '',
                stream: new Readable(),
            };

            const result = service.validateFile(mockFile);
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should reject files with unsupported MIME types', () => {
            const mockFile: Express.Multer.File = {
                fieldname: 'file',
                originalname: 'test.pdf',
                encoding: '7bit',
                mimetype: 'application/pdf',
                size: 1024,
                buffer: Buffer.from('test'),
                destination: '',
                filename: '',
                path: '',
                stream: new Readable(),
            };

            const result = service.validateFile(mockFile);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe(ERROR_CODES.UNSUPPORTED_FILE_TYPE);
        });

        it('should reject files with unsupported extensions', () => {
            const mockFile: Express.Multer.File = {
                fieldname: 'file',
                originalname: 'test.txt',
                encoding: '7bit',
                mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                size: 1024,
                buffer: Buffer.from('test'),
                destination: '',
                filename: '',
                path: '',
                stream: new Readable(),
            };

            const result = service.validateFile(mockFile);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe(ERROR_CODES.UNSUPPORTED_FILE_TYPE);
        });

        it('should reject files exceeding size limit', () => {
            const mockFile: Express.Multer.File = {
                fieldname: 'file',
                originalname: 'test.xlsx',
                encoding: '7bit',
                mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                size: 524288001, // 500MB + 1 byte (exceeds 500MB limit)
                buffer: Buffer.from('test'),
                destination: '',
                filename: '',
                path: '',
                stream: new Readable(),
            };

            const result = service.validateFile(mockFile);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe(ERROR_CODES.FILE_SIZE_EXCEEDED);
        });

        it('should reject empty files', () => {
            const mockFile: Express.Multer.File = {
                fieldname: 'file',
                originalname: 'test.xlsx',
                encoding: '7bit',
                mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                size: 0,
                buffer: Buffer.from(''),
                destination: '',
                filename: '',
                path: '',
                stream: new Readable(),
            };

            const result = service.validateFile(mockFile);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe(ERROR_CODES.EMPTY_FILE);
        });

        it('should handle null file', () => {
            const result = service.validateFile(null as any);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('No file provided');
        });

        it('should handle undefined file', () => {
            const result = service.validateFile(undefined as any);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('No file provided');
        });

        // Property-based test for invalid file rejection
        // Feature: data-cleaning-service, Property 2: 无效文件拒绝
        describe('Property 2: Invalid file rejection', () => {
            it('should reject all non-Excel files', () => {
                // Generate various non-Excel file types
                const nonExcelMimeTypes = fc.constantFrom(
                    'application/pdf',
                    'text/plain',
                    'image/jpeg',
                    'image/png',
                    'application/json',
                    'text/csv',
                    'application/zip',
                    'video/mp4',
                    'audio/mp3',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                );

                const nonExcelExtensions = fc.constantFrom(
                    '.pdf',
                    '.txt',
                    '.jpg',
                    '.png',
                    '.json',
                    '.csv',
                    '.zip',
                    '.mp4',
                    '.mp3',
                    '.doc',
                    '.docx'
                );

                const fileNameArbitrary = fc.string({ minLength: 1, maxLength: 50 }).map(name => name.replace(/[<>:"/\\|?*]/g, ''));

                fc.assert(
                    fc.property(
                        nonExcelMimeTypes,
                        nonExcelExtensions,
                        fileNameArbitrary,
                        fc.integer({ min: 1, max: 500 * 1024 * 1024 }), // Valid file size
                        (mimetype, extension, baseName, size) => {
                            const mockFile: Express.Multer.File = {
                                fieldname: 'file',
                                originalname: `${baseName}${extension}`,
                                encoding: '7bit',
                                mimetype: mimetype,
                                size: size,
                                buffer: Buffer.alloc(size, 'test'),
                                destination: '',
                                filename: '',
                                path: '',
                                stream: new Readable(),
                            };

                            const result = service.validateFile(mockFile);

                            // All non-Excel files should be rejected
                            expect(result.isValid).toBe(false);
                            expect(result.error).toBe(ERROR_CODES.UNSUPPORTED_FILE_TYPE);
                        }
                    ),
                    { numRuns: 100 }
                );
            });

            it('should reject files with Excel extensions but wrong MIME types', () => {
                const wrongMimeTypes = fc.constantFrom(
                    'application/pdf',
                    'text/plain',
                    'image/jpeg',
                    'application/json',
                    'text/csv'
                );

                const excelExtensions = fc.constantFrom('.xlsx', '.xls');
                const fileNameArbitrary = fc.string({ minLength: 1, maxLength: 50 }).map(name => name.replace(/[<>:"/\\|?*]/g, ''));

                fc.assert(
                    fc.property(
                        wrongMimeTypes,
                        excelExtensions,
                        fileNameArbitrary,
                        fc.integer({ min: 1, max: 500 * 1024 * 1024 }),
                        (mimetype, extension, baseName, size) => {
                            const mockFile: Express.Multer.File = {
                                fieldname: 'file',
                                originalname: `${baseName}${extension}`,
                                encoding: '7bit',
                                mimetype: mimetype,
                                size: size,
                                buffer: Buffer.alloc(size, 'test'),
                                destination: '',
                                filename: '',
                                path: '',
                                stream: new Readable(),
                            };

                            const result = service.validateFile(mockFile);

                            // Files with Excel extensions but wrong MIME types should be rejected
                            expect(result.isValid).toBe(false);
                            expect(result.error).toBe(ERROR_CODES.UNSUPPORTED_FILE_TYPE);
                        }
                    ),
                    { numRuns: 100 }
                );
            });

            it('should reject files with correct MIME types but wrong extensions', () => {
                const excelMimeTypes = fc.constantFrom(
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel'
                );

                const wrongExtensions = fc.constantFrom(
                    '.pdf',
                    '.txt',
                    '.doc',
                    '.csv',
                    '.json'
                );

                const fileNameArbitrary = fc.string({ minLength: 1, maxLength: 50 }).map(name => name.replace(/[<>:"/\\|?*]/g, ''));

                fc.assert(
                    fc.property(
                        excelMimeTypes,
                        wrongExtensions,
                        fileNameArbitrary,
                        fc.integer({ min: 1, max: 500 * 1024 * 1024 }),
                        (mimetype, extension, baseName, size) => {
                            const mockFile: Express.Multer.File = {
                                fieldname: 'file',
                                originalname: `${baseName}${extension}`,
                                encoding: '7bit',
                                mimetype: mimetype,
                                size: size,
                                buffer: Buffer.alloc(size, 'test'),
                                destination: '',
                                filename: '',
                                path: '',
                                stream: new Readable(),
                            };

                            const result = service.validateFile(mockFile);

                            // Files with correct MIME types but wrong extensions should be rejected
                            expect(result.isValid).toBe(false);
                            expect(result.error).toBe(ERROR_CODES.UNSUPPORTED_FILE_TYPE);
                        }
                    ),
                    { numRuns: 100 }
                );
            });
        });

        // Property-based test for file size limits
        // Feature: data-cleaning-service, Property 3: 文件大小限制
        describe('Property 3: File size limits', () => {
            it('should reject all files exceeding the size limit', () => {
                const validExcelMimeTypes = fc.constantFrom(
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel'
                );

                const validExcelExtensions = fc.constantFrom('.xlsx', '.xls');
                const fileNameArbitrary = fc.string({ minLength: 1, maxLength: 50 })
                    .filter(name => name.trim().length > 0) // Ensure non-empty after trimming
                    .map(name => name.replace(/[<>:"/\\|?*]/g, 'a') || 'testfile'); // Replace invalid chars, fallback to 'testfile'

                // Generate file sizes that exceed the limit (500MB = 524288000 bytes)
                const oversizedFileArbitrary = fc.integer({
                    min: 524288001, // Just over the limit
                    max: 624288000  // Up to ~600MB to test various oversized files
                });

                fc.assert(
                    fc.property(
                        validExcelMimeTypes,
                        validExcelExtensions,
                        fileNameArbitrary,
                        oversizedFileArbitrary,
                        (mimetype, extension, baseName, size) => {
                            const mockFile: Express.Multer.File = {
                                fieldname: 'file',
                                originalname: `${baseName}${extension}`,
                                encoding: '7bit',
                                mimetype: mimetype,
                                size: size,
                                buffer: Buffer.alloc(Math.min(size, 1024), 'test'), // Don't actually allocate huge buffers
                                destination: '',
                                filename: '',
                                path: '',
                                stream: new Readable(),
                            };

                            const result = service.validateFile(mockFile);

                            // All files exceeding size limit should be rejected
                            expect(result.isValid).toBe(false);
                            expect(result.error).toBe(ERROR_CODES.FILE_SIZE_EXCEEDED);
                        }
                    ),
                    { numRuns: 100 }
                );
            });

            it('should accept files at or below the size limit', () => {
                const validExcelMimeTypes = fc.constantFrom(
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel'
                );

                const validExcelExtensions = fc.constantFrom('.xlsx', '.xls');
                const fileNameArbitrary = fc.string({ minLength: 1, maxLength: 50 })
                    .filter(name => name.trim().length > 0) // Ensure non-empty after trimming
                    .map(name => name.replace(/[<>:"/\\|?*]/g, 'a') || 'testfile'); // Replace invalid chars, fallback to 'testfile'

                // Generate file sizes within valid range (1 byte to 500MB)
                const validSizeArbitrary = fc.integer({
                    min: 1,
                    max: 524288000  // Exactly at the limit
                });

                fc.assert(
                    fc.property(
                        validExcelMimeTypes,
                        validExcelExtensions,
                        fileNameArbitrary,
                        validSizeArbitrary,
                        (mimetype, extension, baseName, size) => {
                            const mockFile: Express.Multer.File = {
                                fieldname: 'file',
                                originalname: `${baseName}${extension}`,
                                encoding: '7bit',
                                mimetype: mimetype,
                                size: size,
                                buffer: Buffer.alloc(Math.min(size, 1024), 'test'), // Don't actually allocate huge buffers
                                destination: '',
                                filename: '',
                                path: '',
                                stream: new Readable(),
                            };

                            const result = service.validateFile(mockFile);

                            // All files within size limit should be accepted (assuming valid type)
                            expect(result.isValid).toBe(true);
                            expect(result.error).toBeUndefined();
                        }
                    ),
                    { numRuns: 100 }
                );
            });
        });
    });

    describe('saveTemporaryFile', () => {
        const mockFile: Express.Multer.File = {
            fieldname: 'file',
            originalname: 'test.xlsx',
            encoding: '7bit',
            mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            size: 1024,
            buffer: Buffer.from('test content'),
            destination: '',
            filename: '',
            path: '',
            stream: new Readable(),
        };

        it('should save file to temporary directory', async () => {
            const filePath = await service.saveTemporaryFile(mockFile);

            expect(filePath).toContain('temp');
            expect(filePath).toContain('.xlsx');
            expect(path.extname(filePath)).toBe('.xlsx');

            // Verify file was actually created
            const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
            expect(fileExists).toBe(true);

            // Clean up
            await service.cleanupFile(filePath);
        });

        it('should generate unique filenames', async () => {
            const filePath1 = await service.saveTemporaryFile(mockFile);
            const filePath2 = await service.saveTemporaryFile(mockFile);

            expect(filePath1).not.toBe(filePath2);

            // Clean up
            await service.cleanupFile(filePath1);
            await service.cleanupFile(filePath2);
        });

        it('should preserve file extension', async () => {
            const xlsFile: Express.Multer.File = {
                ...mockFile,
                originalname: 'test.xls',
            };

            const filePath = await service.saveTemporaryFile(xlsFile);
            expect(path.extname(filePath)).toBe('.xls');

            // Clean up
            await service.cleanupFile(filePath);
        });
    });

    describe('cleanupFile', () => {
        it('should delete existing file', async () => {
            const mockFile: Express.Multer.File = {
                fieldname: 'file',
                originalname: 'test.xlsx',
                encoding: '7bit',
                mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                size: 1024,
                buffer: Buffer.from('test content'),
                destination: '',
                filename: '',
                path: '',
                stream: new Readable(),
            };

            // First save a file
            const filePath = await service.saveTemporaryFile(mockFile);

            // Verify it exists
            let fileExists = await fs.access(filePath).then(() => true).catch(() => false);
            expect(fileExists).toBe(true);

            // Clean it up
            await service.cleanupFile(filePath);

            // Verify it's gone
            fileExists = await fs.access(filePath).then(() => true).catch(() => false);
            expect(fileExists).toBe(false);
        });

        it('should handle non-existent files gracefully', async () => {
            const nonExistentPath = './temp/non-existent-file.xlsx';

            // Should not throw an error
            await expect(service.cleanupFile(nonExistentPath)).resolves.toBeUndefined();
        });
    });

    describe('getMulterStorageConfig', () => {
        it('should return proper multer configuration', () => {
            const config = service.getMulterStorageConfig();

            expect(config.storage).toBe('memory');
            expect(config.limits.fileSize).toBe(524288000);
            expect(config.fileFilter).toBeDefined();
        });
    });

    describe('getFileInfo', () => {
        it('should return file information for existing file', async () => {
            const mockFile: Express.Multer.File = {
                fieldname: 'file',
                originalname: 'test.xlsx',
                encoding: '7bit',
                mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                size: 1024,
                buffer: Buffer.from('test content'),
                destination: '',
                filename: '',
                path: '',
                stream: new Readable(),
            };

            const filePath = await service.saveTemporaryFile(mockFile);
            const fileInfo = await service.getFileInfo(filePath);

            expect(fileInfo.exists).toBe(true);
            expect(fileInfo.size).toBeGreaterThan(0);
            expect(fileInfo.extension).toBe('.xlsx');

            // Clean up
            await service.cleanupFile(filePath);
        });

        it('should return default values for non-existent file', async () => {
            const fileInfo = await service.getFileInfo('./temp/non-existent.xlsx');

            expect(fileInfo.exists).toBe(false);
            expect(fileInfo.size).toBe(0);
            expect(fileInfo.extension).toBe('');
        });
    });
});