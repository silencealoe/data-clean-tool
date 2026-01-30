@echo off
REM Start Worker Process Script
REM This script starts the data cleaning worker process to consume tasks from the queue

echo Starting Data Cleaning Worker Process...

REM Change to the service directory
cd data-cleaning-service

REM Check if the built worker file exists
if not exist "dist\src\worker.js" (
    echo Worker script not found. Building project...
    call npm run build
    
    if not exist "dist\src\worker.js" (
        echo Build failed or worker.js not found!
        pause
        exit /b 1
    )
)

REM Start the worker process
echo Starting worker process...
echo Press Ctrl+C to stop the worker

REM Use the npm script to start the worker
call npm run worker

echo Worker process stopped.
pause