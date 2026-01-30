/**
 * 支持进度跟踪的Multer存储引擎
 */

import { Injectable, Logger } from '@nestjs/common';
import { StorageEngine } from 'multer';
import { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { UploadProgressService } from './upload-progress.service';

export interface ProgressStorageOptions {
    destination: string;
    filename?: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => void;
}

@Injectable()
export class ProgressStorageService {
    private readonly logger = new Logger(ProgressStorageService.name);

    constructor(private readonly uploadProgressService: UploadProgressService) { }

    /**
     * 创建支持进度跟踪的存储引擎
     */
    createStorage(options: ProgressStorageOptions): StorageEngine {
        const { destination, filename } = options;

        return {
            _handleFile: (req: Request, file: Express.Multer.File, cb: (error?: any, info?: Partial<Express.Multer.File>) => void) => {
                // 生成唯一的上传ID
                const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                // 生成文件名
                const generateFilename = filename || ((req, file, cb) => {
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                    const ext = path.extname(file.originalname);
                    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
                });

                generateFilename(req, file, (err, generatedFilename) => {
                    if (err) {
                        return cb(err);
                    }

                    const filePath = path.join(destination, generatedFilename);
                    const writeStream = fs.createWriteStream(filePath);

                    let uploadedSize = 0;
                    let totalSize = 0;

                    // 尝试从请求头获取文件大小
                    if (req.headers['content-length']) {
                        totalSize = parseInt(req.headers['content-length'], 10);
                    }

                    // 开始跟踪上传进度
                    this.uploadProgressService.startTracking(uploadId, file.originalname, totalSize);

                    // 监听数据流
                    file.stream.on('data', (chunk: Buffer) => {
                        uploadedSize += chunk.length;

                        // 更新进度
                        this.uploadProgressService.updateProgress(uploadId, uploadedSize);

                        // 写入文件
                        writeStream.write(chunk);
                    });

                    file.stream.on('end', () => {
                        writeStream.end();

                        // 完成上传
                        this.uploadProgressService.completeUpload(uploadId);

                        // 读取文件到内存（为了兼容现有代码）
                        fs.readFile(filePath, (readErr, buffer) => {
                            if (readErr) {
                                this.uploadProgressService.failUpload(uploadId, readErr.message);
                                return cb(readErr);
                            }

                            // 删除临时文件
                            fs.unlink(filePath, (unlinkErr) => {
                                if (unlinkErr) {
                                    this.logger.warn(`删除临时文件失败: ${filePath}`, unlinkErr);
                                }
                            });

                            // 返回文件信息（包含buffer，兼容现有代码）
                            cb(null, {
                                fieldname: file.fieldname,
                                originalname: file.originalname,
                                encoding: file.encoding,
                                mimetype: file.mimetype,
                                buffer: buffer,
                                size: buffer.length,
                                filename: generatedFilename,
                                path: filePath,
                            } as Express.Multer.File & { uploadId: string });
                        });
                    });

                    file.stream.on('error', (streamErr) => {
                        writeStream.destroy();
                        this.uploadProgressService.failUpload(uploadId, streamErr.message);

                        // 删除部分上传的文件
                        fs.unlink(filePath, (unlinkErr) => {
                            if (unlinkErr) {
                                this.logger.warn(`删除部分上传文件失败: ${filePath}`, unlinkErr);
                            }
                        });

                        cb(streamErr);
                    });

                    writeStream.on('error', (writeErr) => {
                        this.uploadProgressService.failUpload(uploadId, writeErr.message);
                        cb(writeErr);
                    });
                });
            },

            _removeFile: (req: Request, file: Express.Multer.File, cb: (error: Error | null) => void) => {
                // 如果文件还存在，删除它
                if (file.path && fs.existsSync(file.path)) {
                    fs.unlink(file.path, cb);
                } else {
                    cb(null);
                }
            }
        };
    }
}