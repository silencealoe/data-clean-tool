import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import {
    ALLOWED_MIME_TYPES,
    ALLOWED_EXTENSIONS,
    DEFAULT_MAX_FILE_SIZE,
    ERROR_CODES
} from '../common/constants';
import { ValidationResult } from '../common/types';

@Injectable()
export class FileService {
    private readonly logger = new Logger(FileService.name);
    private readonly maxFileSize: number;
    private readonly tempDir: string;

    constructor(private readonly configService: ConfigService) {
        this.maxFileSize = this.configService.get<number>('MAX_FILE_SIZE', DEFAULT_MAX_FILE_SIZE);
        this.tempDir = this.configService.get<string>('TEMP_DIR', './temp');
        this.ensureTempDirectoryExists();
    }

    /**
     * Validate uploaded file type, size, and MIME type
     * @param file - The uploaded file
     * @returns ValidationResult indicating if file is valid
     */
    validateFile(file: Express.Multer.File): ValidationResult {
        try {
            // Check if file exists
            if (!file) {
                return {
                    isValid: false,
                    error: 'No file provided'
                };
            }

            // Check file size
            if (file.size > this.maxFileSize) {
                this.logger.warn(`File size exceeded: ${file.size} bytes (max: ${this.maxFileSize})`);
                return {
                    isValid: false,
                    error: ERROR_CODES.FILE_SIZE_EXCEEDED
                };
            }

            // Check MIME type
            if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
                this.logger.warn(`Unsupported MIME type: ${file.mimetype}`);
                return {
                    isValid: false,
                    error: ERROR_CODES.UNSUPPORTED_FILE_TYPE
                };
            }

            // Check file extension
            const fileExtension = path.extname(file.originalname).toLowerCase();
            if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
                this.logger.warn(`Unsupported file extension: ${fileExtension}`);
                return {
                    isValid: false,
                    error: ERROR_CODES.UNSUPPORTED_FILE_TYPE
                };
            }

            // Additional validation: check if file has content
            if (file.size === 0) {
                return {
                    isValid: false,
                    error: ERROR_CODES.EMPTY_FILE
                };
            }

            this.logger.log(`File validation passed: ${file.originalname} (${file.size} bytes)`);
            return { isValid: true };

        } catch (error) {
            this.logger.error(`File validation error: ${error.message}`, error.stack);
            return {
                isValid: false,
                error: ERROR_CODES.UPLOAD_FAILED
            };
        }
    }

    /**
     * Save uploaded file to temporary directory
     * @param file - The uploaded file
     * @returns Promise<string> - Path to the saved temporary file
     */
    async saveTemporaryFile(file: Express.Multer.File): Promise<string> {
        try {
            // Generate unique filename
            const fileExtension = path.extname(file.originalname);
            const uniqueFilename = `${crypto.randomUUID()}${fileExtension}`;
            const tempFilePath = path.join(this.tempDir, uniqueFilename);

            // Write file to temporary directory
            await fs.writeFile(tempFilePath, file.buffer);

            this.logger.log(`File saved to temporary location: ${tempFilePath}`);
            return tempFilePath;

        } catch (error) {
            this.logger.error(`Failed to save temporary file: ${error.message}`, error.stack);
            throw new Error(`${ERROR_CODES.UPLOAD_FAILED}: ${error.message}`);
        }
    }

    /**
     * Clean up temporary file
     * @param filePath - Path to the file to be deleted
     * @returns Promise<void>
     */
    async cleanupFile(filePath: string): Promise<void> {
        try {
            // Check if file exists before attempting to delete
            await fs.access(filePath);
            await fs.unlink(filePath);

            this.logger.log(`Temporary file cleaned up: ${filePath}`);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, which is fine
                this.logger.warn(`File not found during cleanup: ${filePath}`);
            } else {
                this.logger.error(`Failed to cleanup file: ${error.message}`, error.stack);
                throw new Error(`Failed to cleanup file: ${error.message}`);
            }
        }
    }

    /**
     * Get Multer storage configuration for file uploads
     * @returns Multer storage configuration
     */
    getMulterStorageConfig() {
        return {
            storage: 'memory', // Store files in memory for processing
            limits: {
                fileSize: this.maxFileSize,
            },
            fileFilter: (req: any, file: Express.Multer.File, callback: any) => {
                const validation = this.validateFile(file);
                if (validation.isValid) {
                    callback(null, true);
                } else {
                    callback(new Error(validation.error), false);
                }
            },
        };
    }

    /**
     * Ensure temporary directory exists
     * @private
     */
    private async ensureTempDirectoryExists(): Promise<void> {
        try {
            await fs.access(this.tempDir);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.mkdir(this.tempDir, { recursive: true });
                this.logger.log(`Created temporary directory: ${this.tempDir}`);
            } else {
                this.logger.error(`Error checking temp directory: ${error.message}`);
            }
        }
    }

    /**
     * Get file information
     * @param filePath - Path to the file
     * @returns Promise<object> - File information
     */
    async getFileInfo(filePath: string): Promise<{
        size: number;
        exists: boolean;
        extension: string;
    }> {
        try {
            const stats = await fs.stat(filePath);
            return {
                size: stats.size,
                exists: true,
                extension: path.extname(filePath).toLowerCase()
            };
        } catch (error) {
            return {
                size: 0,
                exists: false,
                extension: ''
            };
        }
    }
}