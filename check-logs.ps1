# Script to check backend logs after file upload
Write-Host "等待文件上传..." -ForegroundColor Yellow
Write-Host "上传文件后，按任意键查看日志..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host "`n=== 后端日志 ===" -ForegroundColor Green
# The logs will be shown in the terminal where npm run start:dev is running
Write-Host "请查看运行 'npm run start:dev' 的终端窗口" -ForegroundColor Cyan
