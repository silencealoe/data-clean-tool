# Start Worker Process Script
# This script starts the data cleaning worker process to consume tasks from the queue

Write-Host "Starting Data Cleaning Worker Process..." -ForegroundColor Green

# Change to the service directory
Set-Location "data-cleaning-service"

# Check if the built worker file exists
if (-not (Test-Path "dist/src/worker.js")) {
    Write-Host "Worker script not found. Building project..." -ForegroundColor Yellow
    npm run build
    
    if (-not (Test-Path "dist/src/worker.js")) {
        Write-Host "Build failed or worker.js not found!" -ForegroundColor Red
        exit 1
    }
}

# Start the worker process
Write-Host "Starting worker process..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the worker" -ForegroundColor Cyan

# Use the npm script to start the worker
npm run worker

Write-Host "Worker process stopped." -ForegroundColor Yellow