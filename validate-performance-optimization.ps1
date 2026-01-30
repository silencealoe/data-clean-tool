#!/usr/bin/env pwsh

# 性能优化验证脚本
# 验证所有优化措施是否正确实施

Write-Host "🚀 开始验证性能优化实施" -ForegroundColor Green
Write-Host "=" * 50

# 1. 检查服务是否运行
Write-Host "1️⃣  检查服务状态..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3101/api/health" -Method GET -TimeoutSec 5
    Write-Host "✅ 后端服务运行正常" -ForegroundColor Green
} catch {
    Write-Host "❌ 后端服务未运行，请先启动服务" -ForegroundColor Red
    Write-Host "启动命令: cd data-cleaning-service && npm run start:dev" -ForegroundColor Yellow
    exit 1
}

# 2. 检查Worker进程
Write-Host "`n2️⃣  检查Worker进程..." -ForegroundColor Yellow

try {
    $workerResponse = Invoke-RestMethod -Uri "http://localhost:3101/api/queue-health" -Method GET -TimeoutSec 5
    Write-Host "✅ Worker进程状态正常" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Worker进程可能未运行，请检查" -ForegroundColor Yellow
    Write-Host "启动命令: cd data-cleaning-service && npm run worker" -ForegroundColor Yellow
}

# 3. 检查测试文件
Write-Host "`n3️⃣  检查测试文件..." -ForegroundColor Yellow

$testFile = "test-data/test-data-10mb.csv"
if (Test-Path $testFile) {
    $fileSize = (Get-Item $testFile).Length / 1MB
    Write-Host "✅ 测试文件存在: $testFile (${fileSize:N2} MB)" -ForegroundColor Green
} else {
    Write-Host "❌ 测试文件不存在，正在生成..." -ForegroundColor Red
    Write-Host "生成10MB测试文件..." -ForegroundColor Yellow
    
    try {
        node test-scripts/generate-10mb-test-file.js
        Write-Host "✅ 测试文件生成完成" -ForegroundColor Green
    } catch {
        Write-Host "❌ 测试文件生成失败" -ForegroundColor Red
        exit 1
    }
}

# 4. 检查优化配置
Write-Host "`n4️⃣  检查优化配置..." -ForegroundColor Yellow

# 检查环境变量
$envFile = "data-cleaning-service/.env"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile
    
    # 检查批次大小配置
    $batchSizeConfig = $envContent | Where-Object { $_ -match "BATCH_SIZE" }
    if ($batchSizeConfig) {
        Write-Host "✅ 批次大小配置: $batchSizeConfig" -ForegroundColor Green
    } else {
        Write-Host "⚠️  未找到批次大小配置，使用默认值" -ForegroundColor Yellow
    }
    
    # 检查并行处理配置
    $parallelConfig = $envContent | Where-Object { $_ -match "ENABLE_PARALLEL_PROCESSING" }
    if ($parallelConfig) {
        Write-Host "✅ 并行处理配置: $parallelConfig" -ForegroundColor Green
    } else {
        Write-Host "⚠️  未找到并行处理配置，使用默认值" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  .env文件不存在，使用默认配置" -ForegroundColor Yellow
}

# 5. 运行性能测试
Write-Host "`n5️⃣  运行性能测试..." -ForegroundColor Yellow
Write-Host "目标：10MB文件在20秒内完成处理，速度达到8000+行/秒" -ForegroundColor Cyan

try {
    Write-Host "开始性能测试..." -ForegroundColor Yellow
    node test-performance-optimization.js
    
    Write-Host "`n✅ 性能测试完成" -ForegroundColor Green
} catch {
    Write-Host "❌ 性能测试失败: $_" -ForegroundColor Red
    Write-Host "请检查服务状态和配置" -ForegroundColor Yellow
}

# 6. 显示优化建议
Write-Host "`n6️⃣  优化建议..." -ForegroundColor Yellow

Write-Host "如果性能未达标，请检查以下配置：" -ForegroundColor Cyan
Write-Host "1. 批次大小 (BATCH_SIZE): 建议20000" -ForegroundColor White
Write-Host "2. 进度更新间隔 (PROGRESS_UPDATE_INTERVAL): 建议50000行" -ForegroundColor White
Write-Host "3. 数据库连接池: 建议100个连接" -ForegroundColor White
Write-Host "4. 内存限制: 建议1800MB" -ForegroundColor White
Write-Host "5. 并行处理: 建议启用，工作线程数8" -ForegroundColor White

Write-Host "`n🎯 性能优化验证完成" -ForegroundColor Green