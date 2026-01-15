#!/bin/bash

echo "=== 数据清洗功能快速检查 ==="
echo ""

# 检查后端服务是否运行
echo "1. 检查后端服务..."
if curl -s http://localhost:3100/api > /dev/null 2>&1; then
    echo "   ✓ 后端服务正在运行"
else
    echo "   ✗ 后端服务未运行"
    echo "   请运行: cd data-cleaning-service && npm run start:dev"
    exit 1
fi

# 检查前端服务是否运行
echo ""
echo "2. 检查前端服务..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "   ✓ 前端服务正在运行"
else
    echo "   ✗ 前端服务未运行"
    echo "   请运行: cd data-cleaning-frontend && npm run dev"
fi

# 检查最近的文件记录
echo ""
echo "3. 检查最近的文件记录..."
response=$(curl -s http://localhost:3100/api/data-cleaning/files?page=1&pageSize=1)
echo "   API响应: $response"

# 提取文件信息
if echo "$response" | grep -q "exceptionRows"; then
    echo "   ✓ API返回正常"
    
    # 尝试提取异常数据数量
    exceptionRows=$(echo "$response" | grep -o '"exceptionRows":[0-9]*' | grep -o '[0-9]*')
    if [ -n "$exceptionRows" ]; then
        echo "   异常数据行数: $exceptionRows"
        if [ "$exceptionRows" -eq 0 ]; then
            echo "   ⚠ 警告: 异常数据为0，这可能是问题所在"
        fi
    fi
else
    echo "   ✗ API响应异常"
fi

echo ""
echo "=== 检查完成 ==="
echo ""
echo "如果发现问题，请参考 diagnose-issue.md 文件进行详细诊断"
