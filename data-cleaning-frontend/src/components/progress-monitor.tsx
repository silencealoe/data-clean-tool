/**
 * 进度监控组件
 * 轻量级的进度显示组件，可用于不同场景
 */

import React from 'react';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2,
  AlertTriangle
} from 'lucide-react';
import type { TaskStatus } from '../types/api';
import { cn } from '../lib/utils';

export interface ProgressMonitorProps {
  status: TaskStatus;
  progress: number;
  processedRows?: number;
  totalRows?: number;
  currentPhase?: string;
  estimatedTimeRemaining?: number;
  errorMessage?: string;
  className?: string;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const STATUS_CONFIG = {
  pending: {
    label: '等待中',
    color: 'text-yellow-500',
    icon: Clock,
    badgeVariant: 'secondary' as const,
  },
  processing: {
    label: '处理中',
    color: 'text-blue-500',
    icon: Loader2,
    badgeVariant: 'default' as const,
  },
  completed: {
    label: '已完成',
    color: 'text-green-500',
    icon: CheckCircle,
    badgeVariant: 'success' as const,
  },
  failed: {
    label: '失败',
    color: 'text-red-500',
    icon: XCircle,
    badgeVariant: 'destructive' as const,
  },
  timeout: {
    label: '超时',
    color: 'text-orange-500',
    icon: AlertTriangle,
    badgeVariant: 'destructive' as const,
  },
};

const SIZE_CONFIG = {
  sm: {
    progressHeight: 'h-2',
    iconSize: 'h-4 w-4',
    textSize: 'text-xs',
    spacing: 'space-y-2',
  },
  md: {
    progressHeight: 'h-3',
    iconSize: 'h-5 w-5',
    textSize: 'text-sm',
    spacing: 'space-y-3',
  },
  lg: {
    progressHeight: 'h-4',
    iconSize: 'h-6 w-6',
    textSize: 'text-base',
    spacing: 'space-y-4',
  },
};

export const ProgressMonitor: React.FC<ProgressMonitorProps> = ({
  status,
  progress,
  processedRows = 0,
  totalRows = 0,
  currentPhase,
  estimatedTimeRemaining,
  errorMessage,
  className,
  showDetails = true,
  size = 'md',
}) => {
  const statusConfig = STATUS_CONFIG[status];
  const sizeConfig = SIZE_CONFIG[size];
  const StatusIcon = statusConfig.icon;
  const isProcessing = status === 'processing';

  // 格式化时间
  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // 格式化数字
  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  return (
    <div className={cn(sizeConfig.spacing, className)}>
      {/* 状态头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <StatusIcon 
            className={cn(
              sizeConfig.iconSize,
              statusConfig.color,
              isProcessing && 'animate-spin'
            )}
          />
          <Badge variant={statusConfig.badgeVariant} className={sizeConfig.textSize}>
            {statusConfig.label}
          </Badge>
          {currentPhase && (
            <span className={cn(sizeConfig.textSize, 'text-gray-600')}>
              {currentPhase}
            </span>
          )}
        </div>
        
        <div className={cn(sizeConfig.textSize, 'font-medium')}>
          {progress.toFixed(1)}%
        </div>
      </div>

      {/* 进度条 */}
      <Progress 
        value={progress} 
        className={cn(sizeConfig.progressHeight, 'transition-all duration-300')}
      />

      {/* 详细信息 */}
      {showDetails && (
        <div className={cn(sizeConfig.textSize, 'text-gray-600 space-y-1')}>
          {totalRows > 0 && (
            <div className="flex justify-between">
              <span>进度:</span>
              <span>{formatNumber(processedRows)} / {formatNumber(totalRows)} 行</span>
            </div>
          )}
          
          {isProcessing && estimatedTimeRemaining && (
            <div className="flex justify-between">
              <span>预计剩余:</span>
              <span>{formatTime(estimatedTimeRemaining)}</span>
            </div>
          )}
          
          {errorMessage && (
            <div className="text-red-500 text-xs mt-2">
              错误: {errorMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgressMonitor;