/**
 * 文件上传进度跟踪服务
 * 提供实时的文件上传进度监控
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface UploadProgress {
    uploadId: string;
    fileName: string;
    totalSize: number;
    uploadedSize: number;
    progress: number;
    speed: number; // bytes per second
    startTime: number;
    lastUpdateTime: number;
    status: 'uploading' | 'completed' | 'failed';
}

@Injectable()
export class UploadProgressService extends EventEmitter {
    private readonly logger = new Logger(UploadProgressService.name);
    private progressMap = new Map<string, UploadProgress>();

    /**
     * 开始跟踪上传进度
     */
    startTracking(uploadId: string, fileName: string, totalSize: number): void {
        const now = Date.now();
        const progress: UploadProgress = {
            uploadId,
            fileName,
            totalSize,
            uploadedSize: 0,
            progress: 0,
            speed: 0,
            startTime: now,
            lastUpdateTime: now,
            status: 'uploading',
        };

        this.progressMap.set(uploadId, progress);
        this.logger.log(`开始跟踪上传进度: ${uploadId} - ${fileName}`);

        // 发送初始进度事件
        this.emit('progress', progress);
    }

    /**
     * 更新上传进度
     */
    updateProgress(uploadId: string, uploadedSize: number): void {
        const progress = this.progressMap.get(uploadId);
        if (!progress) {
            this.logger.warn(`未找到上传进度记录: ${uploadId}`);
            return;
        }

        const now = Date.now();
        const timeDiff = now - progress.lastUpdateTime;
        const sizeDiff = uploadedSize - progress.uploadedSize;

        // 计算上传速度 (bytes per second)
        const speed = timeDiff > 0 ? (sizeDiff / timeDiff) * 1000 : 0;

        // 更新进度信息
        progress.uploadedSize = uploadedSize;
        progress.progress = progress.totalSize > 0 ? (uploadedSize / progress.totalSize) * 100 : 0;
        progress.speed = speed;
        progress.lastUpdateTime = now;

        this.progressMap.set(uploadId, progress);

        // 发送进度更新事件
        this.emit('progress', progress);

        this.logger.debug(`上传进度更新: ${uploadId} - ${progress.progress.toFixed(1)}%`);
    }

    /**
     * 完成上传
     */
    completeUpload(uploadId: string): void {
        const progress = this.progressMap.get(uploadId);
        if (!progress) {
            this.logger.warn(`未找到上传进度记录: ${uploadId}`);
            return;
        }

        progress.status = 'completed';
        progress.progress = 100;
        progress.uploadedSize = progress.totalSize;

        this.progressMap.set(uploadId, progress);
        this.emit('progress', progress);
        this.emit('completed', progress);

        this.logger.log(`上传完成: ${uploadId} - ${progress.fileName}`);

        // 5分钟后清理进度记录
        setTimeout(() => {
            this.progressMap.delete(uploadId);
            this.logger.debug(`清理上传进度记录: ${uploadId}`);
        }, 5 * 60 * 1000);
    }

    /**
     * 上传失败
     */
    failUpload(uploadId: string, error: string): void {
        const progress = this.progressMap.get(uploadId);
        if (!progress) {
            this.logger.warn(`未找到上传进度记录: ${uploadId}`);
            return;
        }

        progress.status = 'failed';
        this.progressMap.set(uploadId, progress);
        this.emit('progress', progress);
        this.emit('failed', { progress, error });

        this.logger.error(`上传失败: ${uploadId} - ${error}`);

        // 1分钟后清理进度记录
        setTimeout(() => {
            this.progressMap.delete(uploadId);
        }, 60 * 1000);
    }

    /**
     * 获取上传进度
     */
    getProgress(uploadId: string): UploadProgress | null {
        return this.progressMap.get(uploadId) || null;
    }

    /**
     * 获取所有活跃的上传进度
     */
    getAllActiveUploads(): UploadProgress[] {
        return Array.from(this.progressMap.values()).filter(
            progress => progress.status === 'uploading'
        );
    }

    /**
     * 清理过期的进度记录
     */
    cleanup(): void {
        const now = Date.now();
        const expiredTime = 10 * 60 * 1000; // 10分钟

        for (const [uploadId, progress] of this.progressMap.entries()) {
            if (now - progress.lastUpdateTime > expiredTime) {
                this.progressMap.delete(uploadId);
                this.logger.debug(`清理过期的上传进度记录: ${uploadId}`);
            }
        }
    }
}