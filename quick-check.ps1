# 数据清洗功能快速检查脚本

Write-Host "=== 数据清洗功能快速检查 ===" -ForegroundColor Cyan
Write-Host ""

# 检查后端服务是否运行
Write-Host "1. 检查后端服务..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3100/api" -Method GET -TimeoutSec 2 -ErrorAction Stop
    Write-Host "   ✓ 后端服务正在运行" -ForegroundColor Green
} catch {
    Write-Host "   ✗ 后端服务未运行" -ForegroundColor Red
    Write-Host "   请运行: cd data-cleaning-service && npm run start:dev" -ForegroundColor Yellow
    exit 1
}

# 检查前端服务是否运行
Write-Host ""
Write-Host "2. 检查前端服务..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -Method GET -TimeoutSec 2 -ErrorAction Stop
    Write-Host "   ✓ 前端服务正在运行" -ForegroundColor Green
} catch {
    Write-Host "   ✗ 前端服务未运行" -ForegroundColor Red
    Write-Host "   请运行: cd data-cleaning-frontend && npm run dev" -ForegroundColor Yellow
}

# 检查最近的文件记录
Write-Host ""
Write-Host "3. 检查最近的文件记录..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3100/api/data-cleaning/files?page=1&pageSize=1" -Method GET
    Write-Host "   ✓ API返回正常" -ForegroundColor Green
    
    if ($response.files -and $response.files.Count -gt 0) {
        $file = $response.files[0]
        Write-Host ""
        Write-Host "   最近的文件:" -ForegroundColor Cyan
        Write-Host "   - 文件名: $($file.originalFileName)"
        Write-Host "   - 状态: $($file.status)"
        Write-Host "   - 总行数: $($file.totalRows)"
        Write-Host "   - 清洁数据: $($file.cleanedRows)"
        Write-Host "   - 异常数据: $($file.exceptionRows)"
        
        if ($file.exceptionRows -eq 0) {
            Write-Host ""
            Write-Host "   ⚠ 警告: 异常数据为0，这可能是问题所在" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "   建议操作:" -ForegroundColor Cyan
            Write-Host "   1. 重启后端服务"
            Write-Host "   2. 重新上传测试文件 testdoc/dirty_test_data.csv"
            Write-Host "   3. 查看后端日志中的 '批量插入错误日志' 信息"
        } elseif ($file.exceptionRows -gt 0) {
            Write-Host ""
            Write-Host "   ✓ 检测到异常数据，系统工作正常" -ForegroundColor Green
            
            # 查询异常数据详情
            Write-Host ""
            Write-Host "4. 查询异常数据详情..." -ForegroundColor Yellow
            try {
                $exceptionData = Invoke-RestMethod -Uri "http://localhost:3100/api/data-cleaning/data/exceptions/$($file.jobId)?page=1&pageSize=5" -Method GET
                Write-Host "   异常数据总数: $($exceptionData.total)"
                Write-Host "   前5条异常数据:"
                foreach ($item in $exceptionData.data) {
                    Write-Host "   - 行号 $($item.rowNumber): $($item.errors.Count) 个错误"
                }
            } catch {
                Write-Host "   ✗ 无法查询异常数据详情" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "   ⚠ 没有找到文件记录" -ForegroundColor Yellow
        Write-Host "   请先上传测试文件" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ✗ API请求失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== 检查完成 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "如果发现问题，请参考 diagnose-issue.md 文件进行详细诊断" -ForegroundColor Yellow
