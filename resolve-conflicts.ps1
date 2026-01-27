# PowerShell script to resolve Git conflicts by keeping HEAD version
Write-Host "开始解决Git冲突，保留HEAD版本..." -ForegroundColor Green

# 获取所有包含冲突标记的文件
$conflictFiles = @()

# 搜索包含冲突标记的文件
$files = Get-ChildItem -Recurse -File | Where-Object { $_.Extension -match '\.(ts|js|json|py|md)$' }

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -and ($content -match '<<<<<<< HEAD' -or $content -match '=======' -or $content -match '>>>>>>> ')) {
        $conflictFiles += $file.FullName
        Write-Host "发现冲突文件: $($file.FullName)" -ForegroundColor Yellow
    }
}

Write-Host "总共发现 $($conflictFiles.Count) 个冲突文件" -ForegroundColor Cyan

# 处理每个冲突文件
foreach ($filePath in $conflictFiles) {
    Write-Host "处理文件: $filePath" -ForegroundColor Blue
    
    try {
        $content = Get-Content $filePath -Raw
        $originalContent = $content
        
        # 使用正则表达式处理冲突标记
        # 匹配整个冲突块：<<<<<<< HEAD ... ======= ... >>>>>>> commit_hash
        $pattern = '<<<<<<< HEAD\r?\n(.*?)\r?\n=======\r?\n(.*?)\r?\n>>>>>>> [^\r\n]*'
        
        # 替换为HEAD版本（第一个捕获组）
        $content = [regex]::Replace($content, $pattern, '$1', [System.Text.RegularExpressions.RegexOptions]::Singleline)
        
        # 如果内容有变化，写回文件
        if ($content -ne $originalContent) {
            Set-Content -Path $filePath -Value $content -NoNewline
            Write-Host "  ✓ 已解决冲突" -ForegroundColor Green
        } else {
            Write-Host "  - 无需处理" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "  ✗ 处理失败: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "冲突解决完成！" -ForegroundColor Green