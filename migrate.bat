@echo off
echo ========================================
echo 省市区字段和入职日期字段修复
echo ========================================
echo.

echo 执行数据库迁移...
echo.

mysql -u root -p < data-cleaning-service\rename-date-to-hiredate.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo 迁移成功!
    echo.
    echo 下一步:
    echo 1. 重启后端服务
    echo 2. 上传测试文件进行验证
) else (
    echo.
    echo 迁移失败，请检查错误信息
)

pause
