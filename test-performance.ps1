# 性能测试脚本
# 测试当前系统处理大文件的实际性能

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "数据清洗性能测试" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 检查测试文件
$testFile = "testdoc\large_test_data.csv"
if (-not (Test-Path $testFile)) {
    Write-Host "错误: 测试文件不存在: $testFile" -ForegroundColor Red
    exit 1
}

# 获取文件信息
$fileInfo = Get-Item $testFile
$fileSize = [math]::Round($fileInfo.Length / 1MB, 2)
$lineCount = (Get-Content $testFile | Measure-Object -Line).Lines

Write-Host "测试文件信息:" -ForegroundColor Yellow
Write-Host "  文件路径: $testFile"
Write-Host "  文件大小: $fileSize MB"
Write-Host "  数据行数: $($lineCount - 1) 行 (不含表头)"
Write-Host ""

# 清空数据库
Write-Host "清空数据库..." -ForegroundColor Yellow
mysql -u root --password=root123456 -e "USE data_clean_tool; TRUNCATE TABLE clean_data; TRUNCATE TABLE error_logs; SELECT COUNT(*) as clean_count FROM clean_data; SELECT COUNT(*) as error_count FROM error_logs;" 2>$null
Write-Host "数据库已清空" -ForegroundColor Green
Write-Host ""

# 上传文件并记录时间
Write-Host "开始上传文件并处理..." -ForegroundColor Yellow
Write-Host "请在浏览器中上传文件: $testFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "上传后，请观察后端日志中的性能指标：" -ForegroundColor Cyan
Write-Host "  - 每10000行的进度更新" -ForegroundColor Gray
Write-Host "  - 实时处理速度（行/秒）" -ForegroundColor Gray
Write-Host "  - 最终统计信息" -ForegroundColor Gray
Write-Host ""

# 提示查看日志
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "后端日志位置:" -ForegroundColor Yellow
Write-Host "  在另一个终端运行: npm run start:dev" -ForegroundColor Gray
Write-Host "  或查看进程输出" -ForegroundColor Gray
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "按任意键继续..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# 查询数据库统计
Write-Host ""
Write-Host "查询处理结果..." -ForegroundColor Yellow
mysql -u root --password=root123456 -e "USE data_clean_tool; SELECT COUNT(*) as '清洁数据行数' FROM clean_data; SELECT COUNT(*) as '异常数据行数' FROM error_logs;" 2>$null

Write-Host ""
Write-Host "测试完成！" -ForegroundColor Green
