import {
    Controller,
    Post,
    Get,
    Param,
    Query,
    UseInterceptors,
    UploadedFile,
    Res,
    HttpStatus,
    HttpException,
    Logger
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as multer from 'multer';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiConsumes,
    ApiBody,
    ApiProduces
} from '@nestjs/swagger';
import {
    UploadResponseDto,
    StatusResponseDto,
    ListFilesDto,
    FileListResponseDto,
    FileDetailResponseDto,
    ErrorResponseDto
} from './common/dto';
import {
    FileRecordService,
    FileService,
    ParserService,
    DataCleanerService,
    ExportService
} from './services';
import { FileStatus, Statistics } from './common/types';
import * as path from 'path';

@ApiTags('data-cleaning')
@Controller('api/data-cleaning')
export class DataCleaningController {
    private readonly logger = new Logger(DataCleaningController.name);

    constructor(
        private readonly fileRecordService: FileRecordService,
        private readonly fileService: FileService,
        private readonly parserService: ParserService,
        private readonly dataCleanerService: DataCleanerService,
        private readonly exportService: ExportService,
    ) { }

    @Post('upload')
    @ApiOperation({
        summary: '上传Excel文件',
        description: '上传Excel文件进行数据清洗处理。支持.xlsx和.xls格式，最大文件大小10MB。'
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        description: 'Excel文件上传',
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Excel文件（.xlsx或.xls格式）'
                }
            }
        }
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '文件上传成功',
        type: UploadResponseDto
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '文件格式不支持或文件过大',
        type: ErrorResponseDto
    })
    @UseInterceptors(FileInterceptor('file', {
        storage: multer.memoryStorage(),
        fileFilter: (req, file, callback) => {
            // 确保文件名使用正确的编码
            if (file.originalname) {
                // 如果文件名包含非ASCII字符，确保正确解码
                try {
                    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
                } catch (error) {
                    // 如果解码失败，保持原文件名
                    console.warn('Failed to decode filename:', error);
                }
            }
            callback(null, true);
        }
    }))
    async uploadFile(@UploadedFile() file: Express.Multer.File): Promise<UploadResponseDto> {
        this.logger.log(`开始处理文件上传: ${file?.originalname}`);

        try {
            // Validate file
            if (!file) {
                throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
            }

            const validationResult = this.fileService.validateFile(file);
            if (!validationResult.isValid) {
                throw new HttpException(validationResult.error || 'File validation failed', HttpStatus.BAD_REQUEST);
            }

            // Generate unique job ID
            const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Save temporary file
            const tempFilePath = await this.fileService.saveTemporaryFile(file);

            // Create file record
            const fileRecord = await this.fileRecordService.createFileRecord({
                jobId,
                originalFileName: file.originalname,
                fileSize: file.size,
                fileType: path.extname(file.originalname).substring(1),
                mimeType: file.mimetype,
            });

            // Start processing asynchronously
            this.processFileAsync(jobId, tempFilePath, fileRecord.id);

            this.logger.log(`文件上传成功，任务ID: ${jobId}`);

            return {
                jobId,
                fileId: fileRecord.id,
                message: '文件上传成功，开始处理',
                totalRows: 0, // Will be updated after parsing
            };

        } catch (error) {
            this.logger.error(`文件上传失败: ${error.message}`, error.stack);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                'File upload failed',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('status/:jobId')
    @ApiOperation({
        summary: '查询处理状态',
        description: '根据任务ID查询数据处理的当前状态和进度'
    })
    @ApiParam({
        name: 'jobId',
        description: '任务ID',
        example: 'job_123456789'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '成功返回处理状态',
        type: StatusResponseDto
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '任务不存在',
        type: ErrorResponseDto
    })
    async getStatus(@Param('jobId') jobId: string): Promise<StatusResponseDto> {
        this.logger.log(`查询任务状态: ${jobId}`);

        try {
            const fileRecord = await this.fileRecordService.getFileRecordByJobId(jobId);

            if (!fileRecord) {
                throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
            }

            const response: StatusResponseDto = {
                jobId,
                status: fileRecord.status as any,
                progress: this.calculateProgress(fileRecord.status),
            };

            // Add statistics if processing is completed
            if (fileRecord.status === FileStatus.COMPLETED && fileRecord.totalRows !== null) {
                response.statistics = {
                    totalRows: fileRecord.totalRows,
                    cleanedRows: fileRecord.cleanedRows || 0,
                    exceptionRows: fileRecord.exceptionRows || 0,
                    processingTime: fileRecord.processingTime || 0,
                };
            }

            return response;

        } catch (error) {
            this.logger.error(`查询任务状态失败: ${error.message}`, error.stack);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                'Failed to get job status',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('files')
    @ApiOperation({
        summary: '查询文件列表',
        description: '分页查询所有上传的文件记录，支持按状态和日期范围筛选'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '成功返回文件列表',
        type: FileListResponseDto
    })
    async listFiles(@Query() query: ListFilesDto): Promise<FileListResponseDto> {
        this.logger.log(`查询文件列表，参数: ${JSON.stringify(query)}`);

        try {
            const result = await this.fileRecordService.listFileRecords(query);

            return {
                files: result.files.map(file => ({
                    id: file.id,
                    jobId: file.jobId,
                    originalFileName: file.originalFileName,
                    fileSize: file.fileSize,
                    fileType: file.fileType,
                    status: file.status,
                    uploadedAt: file.uploadedAt,
                    completedAt: file.completedAt,
                    totalRows: file.totalRows,
                    cleanedRows: file.cleanedRows,
                    exceptionRows: file.exceptionRows,
                })),
                total: result.total,
                page: query.page || 1,
                pageSize: query.pageSize || 10,
            };

        } catch (error) {
            this.logger.error(`查询文件列表失败: ${error.message}`, error.stack);
            throw new HttpException(
                'Failed to list files',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('files/:fileId')
    @ApiOperation({
        summary: '查询文件详情',
        description: '根据文件ID查询文件的详细信息和处理统计'
    })
    @ApiParam({
        name: 'fileId',
        description: '文件ID',
        example: 'file_987654321'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '成功返回文件详情',
        type: FileDetailResponseDto
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '文件不存在',
        type: ErrorResponseDto
    })
    async getFileDetail(@Param('fileId') fileId: string): Promise<FileDetailResponseDto> {
        this.logger.log(`查询文件详情: ${fileId}`);

        try {
            const fileRecord = await this.fileRecordService.getFileRecord(fileId);

            if (!fileRecord) {
                throw new HttpException('File not found', HttpStatus.NOT_FOUND);
            }

            const response: FileDetailResponseDto = {
                file: {
                    id: fileRecord.id,
                    jobId: fileRecord.jobId,
                    originalFileName: fileRecord.originalFileName,
                    fileSize: fileRecord.fileSize,
                    fileType: fileRecord.fileType,
                    mimeType: fileRecord.mimeType,
                    status: fileRecord.status,
                    uploadedAt: fileRecord.uploadedAt,
                    completedAt: fileRecord.completedAt,
                    totalRows: fileRecord.totalRows,
                    cleanedRows: fileRecord.cleanedRows,
                    exceptionRows: fileRecord.exceptionRows,
                    processingTime: fileRecord.processingTime,
                    errorMessage: fileRecord.errorMessage,
                },
            };

            // Add statistics if available
            if (fileRecord.status === FileStatus.COMPLETED && fileRecord.totalRows !== null) {
                response.statistics = {
                    totalRows: fileRecord.totalRows,
                    cleanedRows: fileRecord.cleanedRows || 0,
                    exceptionRows: fileRecord.exceptionRows || 0,
                    processingTime: fileRecord.processingTime || 0,
                };
            }

            return response;

        } catch (error) {
            this.logger.error(`查询文件详情失败: ${error.message}`, error.stack);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                'Failed to get file details',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('download/clean/:jobId')
    @ApiOperation({
        summary: '下载清洁数据',
        description: '下载处理后的清洁数据Excel文件'
    })
    @ApiParam({
        name: 'jobId',
        description: '任务ID',
        example: 'job_123456789'
    })
    @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    @ApiResponse({
        status: HttpStatus.OK,
        description: '成功下载清洁数据文件',
        schema: {
            type: 'string',
            format: 'binary'
        }
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '文件不存在或处理未完成',
        type: ErrorResponseDto
    })
    async downloadClean(@Param('jobId') jobId: string, @Res() res: Response): Promise<void> {
        this.logger.log(`下载清洁数据: ${jobId}`);

        try {
            const fileRecord = await this.fileRecordService.getFileRecordByJobId(jobId);

            if (!fileRecord) {
                throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
            }

            if (fileRecord.status !== FileStatus.COMPLETED) {
                throw new HttpException('Processing not completed', HttpStatus.BAD_REQUEST);
            }

            if (!fileRecord.cleanDataPath) {
                throw new HttpException('Clean data file not found', HttpStatus.NOT_FOUND);
            }

            // Get file buffer
            const fileBuffer = await this.exportService.getFileBuffer(fileRecord.cleanDataPath);

            // Set response headers
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="clean_data_${jobId}.xlsx"`);
            res.setHeader('Content-Length', fileBuffer.length);

            // Send file
            res.send(fileBuffer);

        } catch (error) {
            this.logger.error(`下载清洁数据失败: ${error.message}`, error.stack);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                'Failed to download clean data',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('download/exceptions/:jobId')
    @ApiOperation({
        summary: '下载异常数据',
        description: '下载处理过程中发现的异常数据Excel文件，包含异常原因说明'
    })
    @ApiParam({
        name: 'jobId',
        description: '任务ID',
        example: 'job_123456789'
    })
    @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    @ApiResponse({
        status: HttpStatus.OK,
        description: '成功下载异常数据文件',
        schema: {
            type: 'string',
            format: 'binary'
        }
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '文件不存在或无异常数据',
        type: ErrorResponseDto
    })
    async downloadExceptions(@Param('jobId') jobId: string, @Res() res: Response): Promise<void> {
        this.logger.log(`下载异常数据: ${jobId}`);

        try {
            const fileRecord = await this.fileRecordService.getFileRecordByJobId(jobId);

            if (!fileRecord) {
                throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
            }

            if (fileRecord.status !== FileStatus.COMPLETED) {
                throw new HttpException('Processing not completed', HttpStatus.BAD_REQUEST);
            }

            if (!fileRecord.exceptionDataPath) {
                throw new HttpException('No exception data available', HttpStatus.NOT_FOUND);
            }

            // Get file buffer
            const fileBuffer = await this.exportService.getFileBuffer(fileRecord.exceptionDataPath);

            // Set response headers
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="exceptions_${jobId}.xlsx"`);
            res.setHeader('Content-Length', fileBuffer.length);

            // Send file
            res.send(fileBuffer);

        } catch (error) {
            this.logger.error(`下载异常数据失败: ${error.message}`, error.stack);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                'Failed to download exception data',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Process file asynchronously
     */
    private async processFileAsync(jobId: string, tempFilePath: string, fileRecordId: string): Promise<void> {
        const startTime = Date.now();

        try {
            this.logger.log(`开始异步处理文件，任务ID: ${jobId}`);

            // Update status to processing
            await this.fileRecordService.updateFileStatus(fileRecordId, FileStatus.PROCESSING);

            // Parse Excel file
            this.logger.log(`解析文件: ${tempFilePath}`);
            const parsedData = await this.parserService.parseFile(tempFilePath);

            // Update file record with total rows after parsing
            await this.fileRecordService.updateFileStatus(fileRecordId, FileStatus.PROCESSING, {
                totalRows: parsedData.totalRows,
                cleanedRows: 0,
                exceptionRows: 0,
                processingTime: 0,
            });

            // Clean data
            this.logger.log(`开始数据清洗，总行数: ${parsedData.totalRows}`);
            const cleaningResult = await this.dataCleanerService.cleanData(parsedData);

            // Export clean data
            let cleanDataPath: string | null = null;
            if (cleaningResult.cleanData.length > 0) {
                this.logger.log(`导出清洁数据，行数: ${cleaningResult.cleanData.length}`);

                // Get original headers from first sheet
                const originalHeaders = parsedData.sheets[0]?.headers || [];
                const columnTypes = parsedData.sheets[0]?.columnTypes || {};

                cleanDataPath = await this.exportService.exportCleanData(
                    cleaningResult.cleanData,
                    originalHeaders,
                    columnTypes
                );
                this.logger.log(`清洁数据导出路径: ${cleanDataPath}`);
            }

            // Export exception data
            let exceptionDataPath: string | null = null;
            if (cleaningResult.exceptionData.length > 0) {
                this.logger.log(`导出异常数据，行数: ${cleaningResult.exceptionData.length}`);

                // Get original headers from first sheet
                const originalHeaders = parsedData.sheets[0]?.headers || [];

                exceptionDataPath = await this.exportService.exportExceptionData(
                    cleaningResult.exceptionData,
                    originalHeaders
                );
                this.logger.log(`异常数据导出路径: ${exceptionDataPath}`);
            }

            // Calculate processing time
            const processingTime = Date.now() - startTime;
            const statistics: Statistics = {
                ...cleaningResult.statistics,
                processingTime,
            };

            // Update file record with results
            this.logger.log(`更新文件记录，cleanDataPath: ${cleanDataPath}, exceptionDataPath: ${exceptionDataPath}`);
            await this.fileRecordService.updateFileStatus(
                fileRecordId,
                FileStatus.COMPLETED,
                statistics,
                {
                    cleanDataPath,
                    exceptionDataPath
                }
            );

            // Clean up temporary file
            await this.fileService.cleanupFile(tempFilePath);

            this.logger.log(`文件处理完成，任务ID: ${jobId}, 处理时间: ${processingTime}ms`);

        } catch (error) {
            this.logger.error(`文件处理失败，任务ID: ${jobId}, 错误: ${error.message}`, error.stack);

            // Update file record with error
            try {
                const fileRecord = await this.fileRecordService.getFileRecord(fileRecordId);
                fileRecord.status = FileStatus.FAILED;
                fileRecord.errorMessage = error.message;
                fileRecord.completedAt = new Date();

                await this.fileRecordService.updateFileStatus(fileRecordId, FileStatus.FAILED);
            } catch (updateError) {
                this.logger.error(`更新错误状态失败: ${updateError.message}`, updateError.stack);
            }

            // Clean up temporary file
            try {
                await this.fileService.cleanupFile(tempFilePath);
            } catch (cleanupError) {
                this.logger.error(`清理临时文件失败: ${cleanupError.message}`, cleanupError.stack);
            }
        }
    }

    /**
     * Calculate progress based on status
     */
    private calculateProgress(status: string): number {
        switch (status) {
            case FileStatus.PENDING:
                return 0;
            case FileStatus.PROCESSING:
                return 50;
            case FileStatus.COMPLETED:
                return 100;
            case FileStatus.FAILED:
                return 0;
            default:
                return 0;
        }
    }
}