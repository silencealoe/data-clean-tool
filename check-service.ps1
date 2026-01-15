Write-Host "Checking backend service..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3100/api/data-cleaning/files?page=1&pageSize=1" -Method GET
    Write-Host "Backend service is running" -ForegroundColor Green
    
    if ($response.files -and $response.files.Count -gt 0) {
        $file = $response.files[0]
        Write-Host ""
        Write-Host "Latest file:" -ForegroundColor Cyan
        Write-Host "  Filename: $($file.originalFileName)"
        Write-Host "  Status: $($file.status)"
        Write-Host "  Total rows: $($file.totalRows)"
        Write-Host "  Clean rows: $($file.cleanedRows)"
        Write-Host "  Exception rows: $($file.exceptionRows)"
        
        if ($file.exceptionRows -eq 0) {
            Write-Host ""
            Write-Host "WARNING: Exception rows is 0!" -ForegroundColor Red
        }
    } else {
        Write-Host "No files found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Backend service is not running or error occurred" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
