# 规则引擎配置文档

## 概述

本目录包含动态规则引擎的配置文件，用于定义数据清洗和验证规则。规则引擎支持基于JSON配置的灵活规则定义，可以在运行时动态加载和更新规则而无需重启服务。

## 配置文件说明

### 1. default-rules.json
**默认规则配置**
- 等效于现有硬编码清洗逻辑
- 包含手机号、日期、地址等常见字段的验证规则
- 适用于大多数数据清洗场景
- 优先级：100

### 2. strict-rules.json
**严格模式规则配置**
- 用于高质量数据要求的场景
- 更严格的验证标准和错误处理
- 不允许继续处理错误数据
- 优先级：200

### 3. lenient-rules.json
**宽松模式规则配置**
- 用于数据质量要求较低的场景
- 更宽松的验证标准
- 允许更多格式变体
- 优先级：50

## 配置文件结构

### 元数据 (metadata)
```json
{
  "metadata": {
    "name": "配置名称",
    "description": "配置描述",
    "version": "版本号",
    "priority": 100,
    "author": "作者",
    "createdAt": "创建时间",
    "updatedAt": "更新时间"
  }
}
```

### 字段规则 (fieldRules)
```json
{
  "fieldRules": {
    "字段名": [
      {
        "name": "规则名称",
        "strategy": "验证策略",
        "params": {
          "参数名": "参数值"
        },
        "required": true,
        "priority": 100,
        "errorMessage": "错误消息",
        "condition": {
          "operator": "AND|OR",
          "rules": []
        }
      }
    ]
  }
}
```

### 全局设置 (globalSettings)
```json
{
  "globalSettings": {
    "strictMode": false,
    "continueOnError": true,
    "maxErrors": 10,
    "enableCaching": true,
    "cacheTimeout": 3600,
    "parallelProcessing": true,
    "maxParallelTasks": 4,
    "logLevel": "info",
    "enablePerformanceMonitoring": true
  }
}
```

## 支持的验证策略

### 1. regex - 正则表达式验证
```json
{
  "strategy": "regex",
  "params": {
    "pattern": "正则表达式模式",
    "flags": "正则表达式标志 (i, g, m等)"
  }
}
```

### 2. range - 数值范围验证
```json
{
  "strategy": "range",
  "params": {
    "min": 最小值,
    "max": 最大值,
    "inclusive": true
  }
}
```

### 3. length - 长度验证
```json
{
  "strategy": "length",
  "params": {
    "minLength": 最小长度,
    "maxLength": 最大长度,
    "exactLength": 精确长度
  }
}
```

### 4. phone-cleaner - 手机号清洗
```json
{
  "strategy": "phone-cleaner",
  "params": {
    "removeSpaces": true,
    "removeDashes": true,
    "removeCountryCode": false,
    "allowLandline": true
  }
}
```

### 5. date-cleaner - 日期清洗
```json
{
  "strategy": "date-cleaner",
  "params": {
    "formats": ["YYYY-MM-DD", "YYYY/MM/DD"],
    "minYear": 1900,
    "maxYear": 2100,
    "timezone": "Asia/Shanghai",
    "supportExcelSerial": true,
    "supportTimestamp": true
  }
}
```

### 6. address-cleaner - 地址清洗
```json
{
  "strategy": "address-cleaner",
  "params": {
    "requireProvince": true,
    "requireCity": true,
    "requireDistrict": false,
    "validateComponents": true,
    "supportMunicipalities": true,
    "supportAutonomousRegions": true,
    "supportSpecialAdministrativeRegions": true,
    "requireDetailedAddress": false
  }
}
```

## 字段名映射

系统支持中英文字段名，以下是常见的字段名映射：

| 中文字段名 | 英文字段名 | 说明 |
|-----------|-----------|------|
| 手机号/手机号码 | phone | 手机号码 |
| 日期/入职日期/出生日期 | date | 日期类型 |
| 地址/详细地址 | address | 地址信息 |
| 邮箱 | email | 电子邮箱 |
| 姓名 | name | 姓名 |
| 年龄 | age | 年龄 |
| 身份证号 | id_card | 身份证号码 |
| 工资 | salary | 工资 |

## 规则优先级

规则按优先级从高到低执行：
- 200: 严格模式规则
- 100: 默认规则
- 50: 宽松模式规则

同一字段的多个规则按优先级排序执行。

## 错误处理

### 错误级别
- **严格模式**: 遇到错误立即停止处理
- **默认模式**: 记录错误但继续处理其他字段
- **宽松模式**: 忽略大部分错误，仅记录严重错误

### 错误消息
每个规则可以定义自定义错误消息，支持中英文。错误消息应该：
- 清晰描述问题
- 提供修正建议
- 包含字段上下文

## 性能优化

### 缓存机制
- 编译后的规则会被缓存
- 缓存超时时间可配置
- 支持手动清除缓存

### 并行处理
- 支持字段级并行验证
- 可配置并行任务数量
- 适用于大数据集处理

### 监控指标
- 规则执行时间
- 错误率统计
- 缓存命中率
- 内存使用情况

## 配置更新

### 热重载
系统支持配置文件的热重载：
1. 修改配置文件
2. 系统自动检测变更
3. 验证新配置
4. 应用新规则

### API更新
通过REST API更新配置：
```bash
# 获取当前配置
GET /api/rule-config

# 更新配置
PUT /api/rule-config

# 验证配置
POST /api/rule-config/validate

# 重载配置
POST /api/rule-config/reload
```

## 最佳实践

### 1. 规则设计
- 从宽松到严格逐步收紧规则
- 为每个规则提供清晰的错误消息
- 使用优先级控制规则执行顺序
- 避免冲突的规则定义

### 2. 性能优化
- 启用缓存机制
- 合理设置并行任务数
- 监控规则执行性能
- 定期清理无用规则

### 3. 错误处理
- 根据业务需求选择错误处理模式
- 记录详细的错误日志
- 提供用户友好的错误消息
- 建立错误恢复机制

### 4. 配置管理
- 使用版本控制管理配置文件
- 在生产环境前充分测试规则
- 建立配置回滚机制
- 定期备份配置文件

## 故障排除

### 常见问题

1. **规则不生效**
   - 检查规则优先级
   - 验证JSON格式
   - 确认字段名匹配

2. **性能问题**
   - 检查缓存配置
   - 优化正则表达式
   - 调整并行任务数

3. **错误消息不准确**
   - 检查错误消息模板
   - 验证规则逻辑
   - 确认字段上下文

### 调试工具

使用配置验证工具进行调试：
```bash
# 验证配置文件
npm run validate-config -- --file=default-rules.json

# 测试规则执行
npm run test-rules -- --config=default-rules.json --data=sample.csv

# 性能分析
npm run profile-rules -- --config=default-rules.json
```