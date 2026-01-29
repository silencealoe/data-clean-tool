#!/bin/bash

# Worker进程启动脚本
# 用于生产环境启动和管理Worker进程

set -e

# 配置
WORKER_NAME="data-cleaning-worker"
WORKER_SCRIPT="dist/worker.js"
PID_FILE="/var/run/${WORKER_NAME}.pid"
LOG_FILE="/var/log/${WORKER_NAME}.log"
ERROR_LOG_FILE="/var/log/${WORKER_NAME}.error.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# 检查Node.js是否安装
check_node() {
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
        exit 1
    fi
    log "Node.js version: $(node --version)"
}

# 检查Worker脚本是否存在
check_worker_script() {
    if [ ! -f "$WORKER_SCRIPT" ]; then
        error "Worker script not found: $WORKER_SCRIPT"
        error "Please run 'npm run build' first"
        exit 1
    fi
    log "Worker script found: $WORKER_SCRIPT"
}

# 检查Worker是否正在运行
is_worker_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            # PID文件存在但进程不存在，清理PID文件
            rm -f "$PID_FILE"
            return 1
        fi
    fi
    return 1
}

# 启动Worker
start_worker() {
    log "Starting $WORKER_NAME..."
    
    check_node
    check_worker_script
    
    if is_worker_running; then
        warn "$WORKER_NAME is already running (PID: $(cat $PID_FILE))"
        return 0
    fi
    
    # 创建日志目录
    mkdir -p "$(dirname "$LOG_FILE")"
    mkdir -p "$(dirname "$ERROR_LOG_FILE")"
    
    # 启动Worker进程
    nohup node "$WORKER_SCRIPT" > "$LOG_FILE" 2> "$ERROR_LOG_FILE" &
    local pid=$!
    
    # 保存PID
    echo "$pid" > "$PID_FILE"
    
    # 等待一秒检查进程是否成功启动
    sleep 1
    
    if ps -p "$pid" > /dev/null 2>&1; then
        log "$WORKER_NAME started successfully (PID: $pid)"
        log "Logs: $LOG_FILE"
        log "Error logs: $ERROR_LOG_FILE"
    else
        error "Failed to start $WORKER_NAME"
        rm -f "$PID_FILE"
        exit 1
    fi
}

# 停止Worker
stop_worker() {
    log "Stopping $WORKER_NAME..."
    
    if ! is_worker_running; then
        warn "$WORKER_NAME is not running"
        return 0
    fi
    
    local pid=$(cat "$PID_FILE")
    
    # 发送SIGTERM信号进行优雅关闭
    log "Sending SIGTERM to process $pid..."
    kill -TERM "$pid"
    
    # 等待进程优雅关闭（最多30秒）
    local count=0
    while ps -p "$pid" > /dev/null 2>&1 && [ $count -lt 30 ]; do
        sleep 1
        count=$((count + 1))
        echo -n "."
    done
    echo
    
    # 如果进程仍在运行，强制终止
    if ps -p "$pid" > /dev/null 2>&1; then
        warn "Process did not terminate gracefully, sending SIGKILL..."
        kill -KILL "$pid"
        sleep 2
    fi
    
    # 清理PID文件
    rm -f "$PID_FILE"
    
    if ps -p "$pid" > /dev/null 2>&1; then
        error "Failed to stop $WORKER_NAME (PID: $pid)"
        exit 1
    else
        log "$WORKER_NAME stopped successfully"
    fi
}

# 重启Worker
restart_worker() {
    log "Restarting $WORKER_NAME..."
    stop_worker
    sleep 2
    start_worker
}

# 检查Worker状态
status_worker() {
    if is_worker_running; then
        local pid=$(cat "$PID_FILE")
        log "$WORKER_NAME is running (PID: $pid)"
        
        # 显示进程信息
        if command -v ps &> /dev/null; then
            echo "Process info:"
            ps -p "$pid" -o pid,ppid,cmd,etime,pcpu,pmem
        fi
        
        # 显示最近的日志
        if [ -f "$LOG_FILE" ]; then
            echo
            echo "Recent logs (last 10 lines):"
            tail -n 10 "$LOG_FILE"
        fi
    else
        warn "$WORKER_NAME is not running"
        exit 1
    fi
}

# 显示日志
show_logs() {
    local lines=${2:-50}
    
    case "$1" in
        "error")
            if [ -f "$ERROR_LOG_FILE" ]; then
                log "Showing last $lines lines of error log:"
                tail -n "$lines" "$ERROR_LOG_FILE"
            else
                warn "Error log file not found: $ERROR_LOG_FILE"
            fi
            ;;
        "follow")
            if [ -f "$LOG_FILE" ]; then
                log "Following log file (Ctrl+C to exit):"
                tail -f "$LOG_FILE"
            else
                warn "Log file not found: $LOG_FILE"
            fi
            ;;
        *)
            if [ -f "$LOG_FILE" ]; then
                log "Showing last $lines lines of log:"
                tail -n "$lines" "$LOG_FILE"
            else
                warn "Log file not found: $LOG_FILE"
            fi
            ;;
    esac
}

# 显示帮助信息
show_help() {
    echo "Usage: $0 {start|stop|restart|status|logs|help}"
    echo
    echo "Commands:"
    echo "  start    - Start the worker process"
    echo "  stop     - Stop the worker process"
    echo "  restart  - Restart the worker process"
    echo "  status   - Show worker process status"
    echo "  logs     - Show recent logs (default: 50 lines)"
    echo "  logs error - Show error logs"
    echo "  logs follow - Follow logs in real-time"
    echo "  help     - Show this help message"
    echo
    echo "Files:"
    echo "  PID file: $PID_FILE"
    echo "  Log file: $LOG_FILE"
    echo "  Error log: $ERROR_LOG_FILE"
}

# 主逻辑
case "$1" in
    "start")
        start_worker
        ;;
    "stop")
        stop_worker
        ;;
    "restart")
        restart_worker
        ;;
    "status")
        status_worker
        ;;
    "logs")
        show_logs "$2" "$3"
        ;;
    "help"|"--help"|"-h")
        show_help
        ;;
    *)
        error "Invalid command: $1"
        show_help
        exit 1
        ;;
esac