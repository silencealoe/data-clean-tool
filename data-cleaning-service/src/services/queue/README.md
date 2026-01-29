# Queue Services - Error Handling and Timeout Management

This directory contains the error handling and timeout management services for the async queue processing system.

## Services

### ErrorHandlerService
Handles error classification, retry logic, and error logging for queue processing tasks.

**Features:**
- **Error Classification**: Automatically classifies errors into retryable and permanent types
- **Retry Logic**: Implements exponential backoff for retryable errors
- **Error Logging**: Comprehensive error logging with task context
- **System Notifications**: Notifies administrators for system-level errors

**Error Types:**
- `RETRYABLE_NETWORK`: Network-related errors (connection timeouts, DNS failures)
- `RETRYABLE_RESOURCE`: Resource-related errors (memory, disk space)
- `PERMANENT_FORMAT`: File format errors (invalid CSV, corrupted files)
- `PERMANENT_BUSINESS`: Business logic errors (validation failures)
- `PERMANENT_PERMISSION`: Permission errors (access denied)

**Configuration:**
- `maxRetries`: Maximum number of retry attempts (default: 3)
- `baseRetryDelay`: Base delay for exponential backoff (default: 1000ms)
- `systemErrorNotificationThreshold`: Threshold for system error notifications

### TimeoutManagerService
Manages task timeouts and handles timeout detection and cleanup.

**Features:**
- **Timeout Monitoring**: Tracks processing time for each task
- **Automatic Timeout Handling**: Automatically marks timed-out tasks as failed
- **Periodic Checks**: Runs periodic timeout checks to catch stale tasks
- **Timeout Extension**: Allows extending timeout for long-running tasks
- **Statistics**: Provides timeout statistics and monitoring data

**Configuration:**
- `maxProcessingTimeMs`: Maximum processing time per task (default: 30 minutes)
- `timeoutCheckIntervalMs`: Interval for periodic timeout checks (default: 1 minute)

## Integration

Both services are integrated into:
- **TaskConsumerService**: Uses ErrorHandler for error classification and retry logic
- **QueueManagerService**: Uses TimeoutManager for task timeout monitoring
- **AppModule**: Registered as providers for dependency injection
- **WorkerModule**: Available in worker processes for background processing

## Usage Example

```typescript
// Error handling in task processing
try {
  await processTask(task);
} catch (error) {
  const shouldRetry = this.errorHandler.shouldRetry(error, task.retryCount);
  
  if (shouldRetry) {
    const delay = this.errorHandler.calculateRetryDelay(task.retryCount);
    await this.scheduleRetry(task, delay);
  } else {
    await this.errorHandler.handlePermanentFailure(task, error);
  }
}

// Timeout management
this.timeoutManager.startTimeout(taskId, 30000); // 30 seconds
// ... process task ...
this.timeoutManager.clearTimeout(taskId); // Clear on completion
```

## Testing

Both services include comprehensive unit tests:
- **error-handler.service.spec.ts**: Tests error classification, retry logic, and failure handling
- **timeout-manager.service.spec.ts**: Tests timeout monitoring, extension, and cleanup

Run tests with:
```bash
npm test -- error-handler.service.spec.ts
npm test -- timeout-manager.service.spec.ts
```

## Requirements Fulfilled

This implementation fulfills the following requirements:
- **8.1**: Exponential backoff retry mechanism for Redis connection failures
- **8.2**: Configurable automatic retry for temporary failures
- **8.3**: Error details storage and administrator notifications
- **8.4**: Error classification (retryable vs permanent)
- **8.5**: Permanent failure marking when retry limits exceeded
- **7.4**: Task timeout detection for hanging operations
- **7.5**: Timeout task marking and error handling