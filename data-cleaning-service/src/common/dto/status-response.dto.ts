import { Statistics } from '../types';

/**
 * Response DTO for status query
 */
export class StatusResponseDto {
    jobId: string;
    status: 'processing' | 'completed' | 'failed';
    progress: number;
    statistics?: Statistics;
}
