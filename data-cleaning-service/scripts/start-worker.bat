@echo off
REM Worker进程启动脚本 (Windows版本)
REM 用于Windows环境启动和管理Worker进程

setlocal enabledelayedexpansion

REM 配置
set WORKER_NAME=data-cleaning-worker
set WORKER_SCRIPT=dist\worker.js
set PID_FILE=%TEMP%\%WORKER_NAME%.pid
set LOG_FILE=%TEMP%\%WORKER_NAME%.log
set ERROR_LOG_FILE=%TEMP%\%WORKER_NAME%.error.log

REM 检查参数
if "%1"=="" goto show_help
if "%1"=="help" goto show_help
if "%1"=="--help" goto show_help
if "%1"=="-h" goto show_help

REM 执行命令
if "%1"=="start" goto start_worker
if "%1"=="stop" goto stop_worker
if "%1"=="restart" goto restart_worker
if "%1"=="status" goto status_worker
if "%1"=="logs" goto show_logs

echo ERROR: Invalid command: %1
goto show_help

:log
echo [%date% %time%] %1
goto :eof

:error_log
echo [%date% %time%] ERROR: %1
goto :eof

:warn_log
echo [%date% %time%] WARNING: %1
goto :eof

:check_node
where node >nul 2>&1
if errorlevel 1 (
    call :error_log "Node.js is not installed"
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
call :log "Node.js version: !NODE_VERSION!"
goto :eof

:check_worker_script
if not exist "%WORKER_SCRIPT%" (
    call :error_log "Worker script not found: %WORKER_SCRIPT%"
    call :error_log "Please run 'npm run build' first"
    exit /b 1
)
call :log "Worker script found: %WORKER_SCRIPT%"
goto :eof

:is_worker_running
if not exist "%PID_FILE%" (
    exit /b 1
)

set /p WORKER_PID=<"%PID_FILE%"
tasklist /fi "PID eq %WORKER_PID%" 2>nul | find /i "%WORKER_PID%" >nul
if errorlevel 1 (
    REM PID文件存在但进程不存在，清理PID文件
    del "%PID_FILE%" 2>nul
    exit /b 1
)
exit /b 0

:start_worker
call :log "Starting %WORKER_NAME%..."

call :check_node
if errorlevel 1 exit /b 1

call :check_worker_script
if errorlevel 1 exit /b 1

call :is_worker_running
if not errorlevel 1 (
    set /p EXISTING_PID=<"%PID_FILE%"
    call :warn_log "%WORKER_NAME% is already running (PID: !EXISTING_PID!)"
    goto :eof
)

REM 启动Worker进程
start /b "" node "%WORKER_SCRIPT%" > "%LOG_FILE%" 2> "%ERROR_LOG_FILE%"

REM 获取新进程的PID (Windows下比较复杂，使用wmic)
timeout /t 1 /nobreak >nul
for /f "tokens=2 delims=," %%i in ('wmic process where "name='node.exe' and commandline like '%%worker.js%%'" get processid /format:csv ^| find /v "Node"') do (
    set NEW_PID=%%i
)

if "!NEW_PID!"=="" (
    call :error_log "Failed to get process PID"
    exit /b 1
)

REM 保存PID
echo !NEW_PID! > "%PID_FILE%"

REM 检查进程是否成功启动
timeout /t 2 /nobreak >nul
tasklist /fi "PID eq !NEW_PID!" 2>nul | find /i "!NEW_PID!" >nul
if errorlevel 1 (
    call :error_log "Failed to start %WORKER_NAME%"
    del "%PID_FILE%" 2>nul
    exit /b 1
)

call :log "%WORKER_NAME% started successfully (PID: !NEW_PID!)"
call :log "Logs: %LOG_FILE%"
call :log "Error logs: %ERROR_LOG_FILE%"
goto :eof

:stop_worker
call :log "Stopping %WORKER_NAME%..."

call :is_worker_running
if errorlevel 1 (
    call :warn_log "%WORKER_NAME% is not running"
    goto :eof
)

set /p WORKER_PID=<"%PID_FILE%"

REM 尝试优雅关闭（发送Ctrl+C信号）
call :log "Terminating process %WORKER_PID%..."
taskkill /pid %WORKER_PID% /t >nul 2>&1

REM 等待进程关闭
set /a count=0
:wait_loop
if !count! geq 30 goto force_kill
tasklist /fi "PID eq %WORKER_PID%" 2>nul | find /i "%WORKER_PID%" >nul
if errorlevel 1 goto cleanup_pid
timeout /t 1 /nobreak >nul
set /a count+=1
goto wait_loop

:force_kill
call :warn_log "Process did not terminate gracefully, forcing termination..."
taskkill /f /pid %WORKER_PID% /t >nul 2>&1
timeout /t 2 /nobreak >nul

:cleanup_pid
del "%PID_FILE%" 2>nul

REM 验证进程是否已停止
tasklist /fi "PID eq %WORKER_PID%" 2>nul | find /i "%WORKER_PID%" >nul
if not errorlevel 1 (
    call :error_log "Failed to stop %WORKER_NAME% (PID: %WORKER_PID%)"
    exit /b 1
)

call :log "%WORKER_NAME% stopped successfully"
goto :eof

:restart_worker
call :log "Restarting %WORKER_NAME%..."
call :stop_worker
timeout /t 2 /nobreak >nul
call :start_worker
goto :eof

:status_worker
call :is_worker_running
if errorlevel 1 (
    call :warn_log "%WORKER_NAME% is not running"
    exit /b 1
)

set /p WORKER_PID=<"%PID_FILE%"
call :log "%WORKER_NAME% is running (PID: %WORKER_PID%)"

REM 显示进程信息
echo Process info:
tasklist /fi "PID eq %WORKER_PID%" /fo table

REM 显示最近的日志
if exist "%LOG_FILE%" (
    echo.
    echo Recent logs (last 10 lines):
    powershell -command "Get-Content '%LOG_FILE%' | Select-Object -Last 10"
)
goto :eof

:show_logs
set LINES=50
if not "%2"=="" set LINES=%2

if "%2"=="error" (
    if exist "%ERROR_LOG_FILE%" (
        call :log "Showing last %LINES% lines of error log:"
        powershell -command "Get-Content '%ERROR_LOG_FILE%' | Select-Object -Last %LINES%"
    ) else (
        call :warn_log "Error log file not found: %ERROR_LOG_FILE%"
    )
) else if "%2"=="follow" (
    if exist "%LOG_FILE%" (
        call :log "Following log file (Ctrl+C to exit):"
        powershell -command "Get-Content '%LOG_FILE%' -Wait"
    ) else (
        call :warn_log "Log file not found: %LOG_FILE%"
    )
) else (
    if exist "%LOG_FILE%" (
        call :log "Showing last %LINES% lines of log:"
        powershell -command "Get-Content '%LOG_FILE%' | Select-Object -Last %LINES%"
    ) else (
        call :warn_log "Log file not found: %LOG_FILE%"
    )
)
goto :eof

:show_help
echo Usage: %0 {start^|stop^|restart^|status^|logs^|help}
echo.
echo Commands:
echo   start    - Start the worker process
echo   stop     - Stop the worker process
echo   restart  - Restart the worker process
echo   status   - Show worker process status
echo   logs     - Show recent logs (default: 50 lines)
echo   logs error - Show error logs
echo   logs follow - Follow logs in real-time
echo   help     - Show this help message
echo.
echo Files:
echo   PID file: %PID_FILE%
echo   Log file: %LOG_FILE%
echo   Error log: %ERROR_LOG_FILE%
goto :eof