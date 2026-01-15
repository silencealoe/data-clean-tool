# 安装前端依赖并启动测试

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  前端更新 - 安装和测试脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 进入前端目录
Set-Location data-cleaning-frontend

Write-Host "步骤 1: 安装 @radix-ui/react-tabs 依赖..." -ForegroundColor Yellow
pnpm add @radix-ui/react-tabs

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ 依赖安装成功!" -ForegroundColor Green
} else {
    Write-Host "✗ 依赖安装失败!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "步骤 2: 启动前端开发服务器..." -ForegroundColor Yellow
Write-Host ""
Write-Host "前端将在 http://localhost:5173 启动" -ForegroundColor Cyan
Write-Host "后端应该在 http://localhost:3100 运行" -ForegroundColor Cyan
Write-Host ""
Write-Host "测试步骤:" -ForegroundColor Green
Write-Host "1. 打开浏览器访问 http://localhost:5173" -ForegroundColor White
Write-Host "2. 上传测试文件 testdoc/dirty_test_data.csv" -ForegroundColor White
Write-Host "3. 等待处理完成" -ForegroundColor White
Write-Host "4. 进入文件详情页面" -ForegroundColor White
Write-Host "5. 在页面底部查看新的数据查看器" -ForegroundColor White
Write-Host "6. 测试Tab切换、分页、下载等功能" -ForegroundColor White
Write-Host ""
Write-Host "按 Ctrl+C 停止服务器" -ForegroundColor Yellow
Write-Host ""

pnpm dev
