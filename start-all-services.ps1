# Start all services for data cleaning tool

Write-Host "Starting Data Cleaning Tool Services..." -ForegroundColor Cyan
Write-Host ""

# Start backend service
Write-Host "1. Starting backend service..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd data-cleaning-service; npm run start:dev"
Write-Host "   Backend service starting in new window..." -ForegroundColor Green

# Wait a bit for backend to start
Start-Sleep -Seconds 3

# Start frontend service
Write-Host ""
Write-Host "2. Starting frontend service..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd data-cleaning-frontend; npm run dev"
Write-Host "   Frontend service starting in new window..." -ForegroundColor Green

Write-Host ""
Write-Host "Services are starting..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Please wait about 10-15 seconds for services to fully start." -ForegroundColor Yellow
Write-Host ""
Write-Host "Then you can:" -ForegroundColor Cyan
Write-Host "  - Access frontend at: http://localhost:5173" -ForegroundColor White
Write-Host "  - Access backend API at: http://localhost:3100/api" -ForegroundColor White
Write-Host ""
Write-Host "To verify services are running, run:" -ForegroundColor Yellow
Write-Host "  powershell -ExecutionPolicy Bypass -File check-service.ps1" -ForegroundColor White
