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
import { DatabasePersistenceService } from './services/database-persistence.service';
import {
    FileRecordService,
    FileService,
    ParserService,
    DataCleanerService,
    ExportService
} from './services';
import { ParallelProcessingManagerService } from './services/parallel/parallel-processing-manager.service';
import { FileStatus, Statistics, ColumnType, ColumnTypeMap } from './common/types';
import * as path from 'path';

@ApiTags('data-cleaning')
@Controller('api/data-cleaning')
export class DataCleaningController {
    private readonly logger = new Logger(DataCleaningController.name);

    // 性能报告缓存（内存存储）
    // TODO: 考虑使用 Redis 或数据库存储以支持分布式部署
    private performanceReportCache = new Map<string, any>();

    constructor(
        private readonly fileRecordService: FileRecordService,
        private readonly fileService: FileService,
        private readonly parserService: ParserService,
        private readonly dataCleanerService: DataCleanerService,
        private readonly exportService: ExportService,
        private readonly databasePersistence: DatabasePersistenceService,
        private readonly parallelProcessingManager: ParallelProcessingManagerService,
    ) { }

    @Post('upload')
    @ApiOperation({
        summary: '上传数据文件',
        description: '上传Excel和CSV文件进行数据清洗处理。支持.xlsx、.xls和.csv格式，最大文件大小500MB。支持大文件流式处理。'
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        description: '数据文件上传',
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                    description: '数据文件（.xlsx、.xls或.csv格式）'
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
        limits: {
            fileSize: 500 * 1024 * 1024, // 500MB
        },
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

    @Get('data/clean/:jobId')
    @ApiOperation({
        summary: '查询清洁数据',
        description: '分页查询指定任务的清洁数据，支持查看清洗后的表格内容'
    })
    @ApiParam({
        name: 'jobId',
        description: '任务ID',
        example: 'job_123456789'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '成功返回清洁数据',
        schema: {
            type: 'object',
            properties: {
                data: { type: 'array', description: '清洁数据列表' },
                total: { type: 'number', description: '总记录数' },
                page: { type: 'number', description: '当前页码' },
                pageSize: { type: 'number', description: '每页大小' },
                totalPages: { type: 'number', description: '总页数' }
            }
        }
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '任务不存在',
        type: ErrorResponseDto
    })
    async getCleanDataPaginated(
        @Param('jobId') jobId: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ): Promise<{
        data: any[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }> {
        this.logger.log(`查询清洁数据，任务ID: ${jobId}, 页码: ${page || 1}, 每页大小: ${pageSize || 100}`);

        try {
            const pageNum = parseInt(page || '1');
            const size = parseInt(pageSize || '100');

            const result = await this.databasePersistence.getCleanDataByJobIdPaginated(
                jobId,
                pageNum,
                size
            );

            return result;
        } catch (error) {
            this.logger.error(`查询清洁数据失败: ${error.message}`, error.stack);
            throw new HttpException(
                'Failed to query clean data',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('data/exceptions/:jobId')
    @ApiOperation({
        summary: '查询异常数据',
        description: '分页查询指定任务的异常数据，包含详细的错误原因说明'
    })
    @ApiParam({
        name: 'jobId',
        description: '任务ID',
        example: 'job_123456789'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '成功返回异常数据',
        schema: {
            type: 'object',
            properties: {
                data: { type: 'array', description: '异常数据列表' },
                total: { type: 'number', description: '总记录数' },
                page: { type: 'number', description: '当前页码' },
                pageSize: { type: 'number', description: '每页大小' },
                totalPages: { type: 'number', description: '总页数' }
            }
        }
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '任务不存在',
        type: ErrorResponseDto
    })
    async getExceptionDataPaginated(
        @Param('jobId') jobId: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ): Promise<{
        data: any[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }> {
        this.logger.log(`查询异常数据，任务ID: ${jobId}, 页码: ${page || 1}, 每页大小: ${pageSize || 100}`);

        try {
            const pageNum = parseInt(page || '1');
            const size = parseInt(pageSize || '100');

            const result = await this.databasePersistence.getErrorLogsByJobIdPaginated(
                jobId,
                pageNum,
                size
            );

            return result;
        } catch (error) {
            this.logger.error(`查询异常数据失败: ${error.message}`, error.stack);
            throw new HttpException(
                'Failed to query exception data',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('progress/:jobId')
    @ApiOperation({
        summary: '查询处理进度',
        description: '查询并行处理任务的实时进度信息，包括总体进度和各工作线程进度'
    })
    @ApiParam({
        name: 'jobId',
        description: '任务ID',
        example: 'job_123456789'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '成功返回进度信息',
        schema: {
            type: 'object',
            properties: {
                jobId: { type: 'string', description: '任务ID' },
                overallProgress: { type: 'number', description: '总体进度百分比 (0-100)' },
                processedRows: { type: 'number', description: '已处理行数' },
                totalRows: { type: 'number', description: '总行数' },
                workerProgress: {
                    type: 'array',
                    description: '各工作线程进度',
                    items: {
                        type: 'object',
                        properties: {
                            workerId: { type: 'number', description: '工作线程ID' },
                            progress: { type: 'number', description: '进度百分比' },
                            processedRows: { type: 'number', description: '已处理行数' },
                            totalRows: { type: 'number', description: '总行数' }
                        }
                    }
                },
                isProcessing: { type: 'boolean', description: '是否正在处理' }
            }
        }
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '任务不存在或未使用并行处理',
        type: ErrorResponseDto
    })
    async getProgress(@Param('jobId') jobId: string): Promise<any> {
        this.logger.log(`查询处理进度: ${jobId}`);

        try {
            // 检查任务是否存在
            const fileRecord = await this.fileRecordService.getFileRecordByJobId(jobId);

            if (!fileRecord) {
                throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
            }

            // 如果任务已完成，返回100%进度和统计信息
            if (fileRecord.status === FileStatus.COMPLETED) {
                return {
                    jobId,
                    overallProgress: 100,
                    processedRows: fileRecord.totalRows || 0,
                    totalRows: fileRecord.totalRows || 0,
                    workerProgress: [],
                    isProcessing: false,
                    statistics: {
                        totalRows: fileRecord.totalRows || 0,
                        cleanedRows: fileRecord.cleanedRows || 0,
                        exceptionRows: fileRecord.exceptionRows || 0,
                        processingTime: fileRecord.processingTime || 0,
                    },
                };
            }

            // 如果任务失败，返回0%进度
            if (fileRecord.status === FileStatus.FAILED) {
                return {
                    jobId,
                    overallProgress: 0,
                    processedRows: 0,
                    totalRows: fileRecord.totalRows || 0,
                    workerProgress: [],
                    isProcessing: false,
                };
            }

            // 对于正在处理的任务，尝试从并行处理管理器获取进度
            if (fileRecord.status === FileStatus.PROCESSING) {
                // 检查是否是当前正在处理的任务
                const status = this.parallelProcessingManager.getStatus();

                if (status.isProcessing && status.currentJobId === jobId) {
                    // 获取详细的进度信息
                    const progressStats = this.parallelProcessingManager.getProgressStats();

                    if (progressStats) {
                        return {
                            jobId,
                            overallProgress: progressStats.overallProgress || 0,
                            processedRows: progressStats.totalProcessed || 0,
                            totalRows: progressStats.totalRows || fileRecord.totalRows || 0,
                            workerProgress: [], // 暂时不返回工作线程详情
                            isProcessing: true,
                        };
                    }
                }

                // 如果不是当前任务或无法获取进度，返回基本信息
                return {
                    jobId,
                    overallProgress: this.calculateProgress(fileRecord.status),
                    processedRows: 0,
                    totalRows: fileRecord.totalRows || 0,
                    workerProgress: [],
                    isProcessing: true,
                    message: '进度信息仅在并行处理期间可用'
                };
            }

            // 其他状态（pending等）
            return {
                jobId,
                overallProgress: 0,
                processedRows: 0,
                totalRows: fileRecord.totalRows || 0,
                workerProgress: [],
                isProcessing: false,
            };

        } catch (error) {
            this.logger.error(`查询处理进度失败: ${error.message}`, error.stack);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                'Failed to get progress',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('metrics/:jobId')
    @ApiOperation({
        summary: '查询性能指标',
        description: '查询并行处理任务的实时性能指标，包括CPU使用率、内存使用、吞吐量等'
    })
    @ApiParam({
        name: 'jobId',
        description: '任务ID',
        example: 'job_123456789'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '成功返回性能指标',
        schema: {
            type: 'object',
            properties: {
                jobId: { type: 'string', description: '任务ID' },
                cpuUsage: { type: 'number', description: 'CPU使用率 (%)' },
                memoryUsage: { type: 'number', description: '内存使用 (MB)' },
                throughput: { type: 'number', description: '吞吐量 (行/秒)' },
                workerCount: { type: 'number', description: '工作线程数' },
                timestamp: { type: 'string', description: '采样时间' },
                isProcessing: { type: 'boolean', description: '是否正在处理' }
            }
        }
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '任务不存在或未使用并行处理',
        type: ErrorResponseDto
    })
    async getMetrics(@Param('jobId') jobId: string): Promise<any> {
        this.logger.log(`查询性能指标: ${jobId}`);

        try {
            // 检查任务是否存在
            const fileRecord = await this.fileRecordService.getFileRecordByJobId(jobId);

            if (!fileRecord) {
                throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
            }

            // 如果任务未在处理中，返回空指标
            if (fileRecord.status !== FileStatus.PROCESSING) {
                return {
                    jobId,
                    cpuUsage: 0,
                    memoryUsage: 0,
                    throughput: 0,
                    workerCount: 0,
                    timestamp: new Date().toISOString(),
                    isProcessing: false,
                    message: '性能指标仅在处理期间可用'
                };
            }

            // 对于正在处理的任务，尝试从并行处理管理器获取性能指标
            const status = this.parallelProcessingManager.getStatus();

            if (status.isProcessing && status.currentJobId === jobId) {
                // 获取实时性能指标
                const metrics = this.parallelProcessingManager.getPerformanceMetrics();

                if (metrics) {
                    return {
                        jobId,
                        cpuUsage: metrics.cpuUsage?.overall || 0,
                        memoryUsage: (metrics.memoryUsage?.heapUsed || 0) / (1024 * 1024), // 转换为 MB
                        throughput: metrics.throughput || 0,
                        workerCount: metrics.workerMetrics?.length || 0,
                        timestamp: new Date(metrics.timestamp).toISOString(),
                        isProcessing: true,
                    };
                }
            }

            // 如果不是当前任务或无法获取指标
            return {
                jobId,
                cpuUsage: 0,
                memoryUsage: 0,
                throughput: 0,
                workerCount: 0,
                timestamp: new Date().toISOString(),
                isProcessing: true,
                message: '实时性能指标仅在并行处理期间可用'
            };

        } catch (error) {
            this.logger.error(`查询性能指标失败: ${error.message}`, error.stack);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                'Failed to get metrics',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('report/:jobId')
    @ApiOperation({
        summary: '查询性能报告',
        description: '查询已完成任务的完整性能报告，包括CPU、内存、吞吐量的平均值和峰值'
    })
    @ApiParam({
        name: 'jobId',
        description: '任务ID',
        example: 'job_123456789'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '成功返回性能报告',
        schema: {
            type: 'object',
            properties: {
                jobId: { type: 'string', description: '任务ID' },
                processingMode: { type: 'string', enum: ['parallel', 'sequential'], description: '处理模式' },
                workerCount: { type: 'number', description: '工作线程数' },
                avgCpuUsage: { type: 'number', description: '平均CPU使用率 (%)' },
                peakCpuUsage: { type: 'number', description: '峰值CPU使用率 (%)' },
                avgMemoryUsage: { type: 'number', description: '平均内存使用 (MB)' },
                peakMemoryUsage: { type: 'number', description: '峰值内存使用 (MB)' },
                avgThroughput: { type: 'number', description: '平均吞吐量 (行/秒)' },
                peakThroughput: { type: 'number', description: '峰值吞吐量 (行/秒)' },
                processingTimeMs: { type: 'number', description: '处理时间 (毫秒)' },
                totalRows: { type: 'number', description: '总行数' },
                successCount: { type: 'number', description: '成功行数' },
                errorCount: { type: 'number', description: '错误行数' }
            }
        }
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '任务不存在或未完成',
        type: ErrorResponseDto
    })
    async getReport(@Param('jobId') jobId: string): Promise<any> {
        this.logger.log(`查询性能报告: ${jobId}`);

        try {
            // 检查任务是否存在
            const fileRecord = await this.fileRecordService.getFileRecordByJobId(jobId);

            if (!fileRecord) {
                throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
            }

            // 只有已完成的任务才有完整的性能报告
            if (fileRecord.status !== FileStatus.COMPLETED) {
                throw new HttpException(
                    'Performance report is only available for completed jobs',
                    HttpStatus.BAD_REQUEST
                );
            }

            // 尝试从缓存获取性能报告
            const cachedReport = this.performanceReportCache.get(jobId);

            if (cachedReport) {
                this.logger.log(`从缓存返回性能报告: ${jobId}`);
                return {
                    jobId,
                    ...cachedReport,
                };
            }

            // 如果缓存中没有，返回基本的性能报告
            const avgThroughput = fileRecord.processingTime && fileRecord.totalRows
                ? (fileRecord.totalRows / (fileRecord.processingTime / 1000))
                : 0;

            return {
                jobId,
                processingMode: 'sequential', // 没有缓存说明使用了顺序处理
                workerCount: 0,
                avgCpuUsage: 0,
                peakCpuUsage: 0,
                avgMemoryUsage: 0,
                peakMemoryUsage: 0,
                avgThroughput,
                peakThroughput: 0,
                processingTimeMs: fileRecord.processingTime || 0,
                totalRows: fileRecord.totalRows || 0,
                successCount: fileRecord.cleanedRows || 0,
                errorCount: fileRecord.exceptionRows || 0,
            };

        } catch (error) {
            this.logger.error(`查询性能报告失败: ${error.message}`, error.stack);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                'Failed to get performance report',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Process file asynchronously
     */
    private async processFileAsync(jobId: string, tempFilePath: string, fileRecordId: string): Promise<void> {
        try {
            this.logger.log(`开始异步处理文件，任务ID: ${jobId}`);

            // Update status to processing
            await this.fileRecordService.updateFileStatus(fileRecordId, FileStatus.PROCESSING);

            // ✅ 在实际数据清洗开始时计时（不包含上传时间）
            const startTime = Date.now();

            // 使用流式处理和数据库持久化
            this.logger.log(`开始流式处理文件: ${tempFilePath}`);
            const streamResult = await this.dataCleanerService.cleanDataStream(tempFilePath, jobId);

            // Calculate processing time (纯数据处理时间，不包含上传)
            const processingTime = Date.now() - startTime;
            const statistics: Statistics = {
                totalRows: streamResult.statistics.totalRows,
                cleanedRows: streamResult.statistics.processedRows,
                exceptionRows: streamResult.statistics.errorRows,
                processingTime,
            };

            // 保存性能报告到缓存（如果有）
            if (streamResult.performanceMetrics) {
                this.performanceReportCache.set(jobId, {
                    ...streamResult.performanceMetrics,
                    totalRows: streamResult.statistics.totalRows,
                    successCount: streamResult.statistics.processedRows,
                    errorCount: streamResult.statistics.errorRows,
                });
                this.logger.log(`性能报告已缓存: ${jobId}`);
            }

            // Update file record with results (without file paths)
            this.logger.log(`更新文件记录为完成状态`);
            await this.fileRecordService.updateFileStatus(
                fileRecordId,
                FileStatus.COMPLETED,
                statistics
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