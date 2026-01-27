# 设计文档：动态字段映射

## 概述

动态字段映射功能通过分析文件表头和数据内容，自动识别字段类型并映射到系统标准字段。该功能使用规则引擎和内容分析相结合的方式，支持多种字段名称变体和字段顺序。

## 架构

### 整体架构

```
┌─────────────────┐
│  File Upload    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Header Parser  │ ← 解析表头
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Field Recognizer│ ← 字段识别
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Mapping Engine  │ ← 映射引擎
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Content Analyzer │ ← 内容分析（可选）
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Mapping Result  │ ← 映射结果
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Data Processing │ ← 数据处理
└─────────────────┘
```

## 组件和接口

### 1. FieldMappingService

字段映射服务，负责协调整个映射流程。

```typescript
interface FieldMappingService {
  /**
   * 分析文件并生成字段映射
   * @param filePath 文件路径
   * @returns 字段映射结果
   */
  analyzeAndMap(filePath: string): Promise<FieldMappingResult>;
  
  /**
   * 验证字段映射结果
   * @param mapping 字段映射
   * @returns 验证结果
   */
  validateMapping(mapping: FieldMapping): ValidationResult;
  
  /**
   * 应用字段映射到数据行
   * @param row 原始数据行
   * @param mapping 字段映射
   * @returns 映射后的标准数据
   */
  applyMapping(row: Record<string, any>, mapping: FieldMapping): StandardData;
}
```

### 2. HeaderParser

表头解析器，负责解析文件的第一行表头。

```typescript
interface HeaderParser {
  /**
   * 解析表头
   * @param firstLine 第一行数据
   * @returns 字段名称数组
   */
  parseHeader(firstLine: string): string[];
  
  /**
   * 标准化字段名
   * @param fieldName 原始字段名
   * @returns 标准化后的字段名
   */
  normalizeFieldName(fieldName: string): string;
}
```

### 3. FieldRecognizer

字段识别器，基于规则识别字段类型。

```typescript
interface FieldRecognizer {
  /**
   * 识别字段类型
   * @param fieldName 字段名称
   * @returns 标准字段类型或null
   */
  recognizeByName(fieldName: string): StandardFieldType | null;
  
  /**
   * 获取识别置信度
   * @param fieldName 字段名称
   * @param standardField 标准字段
   * @returns 置信度分数 (0-100)
   */
  getConfidence(fieldName: string, standardField: StandardFieldType): number;
}
```

### 4. ContentAnalyzer

内容分析器，基于数据内容识别字段类型。

```typescript
interface ContentAnalyzer {
  /**
   * 分析字段内容
   * @param samples 数据样本数组
   * @returns 字段类型或null
   */
  analyzeContent(samples: any[]): StandardFieldType | null;
  
  /**
   * 检查是否为手机号
   * @param samples 数据样本
   * @returns 是否为手机号及置信度
   */
  isPhoneNumber(samples: any[]): { isPhone: boolean; confidence: number };
  
  /**
   * 检查是否为日期
   * @param samples 数据样本
   * @returns 是否为日期及置信度
   */
  isDate(samples: any[]): { isDate: boolean; confidence: number };
  
  /**
   * 检查是否为地址
   * @param samples 数据样本
   * @returns 是否为地址及置信度
   */
  isAddress(samples: any[]): { isAddress: boolean; confidence: number };
  
  /**
   * 检查是否为姓名
   * @param samples 数据样本
   * @returns 是否为姓名及置信度
   */
  isName(samples: any[]): { isName: boolean; confidence: number };
}
```

### 5. MappingConfigService

映射配置服务，管理字段映射规则。

```typescript
interface MappingConfigService {
  /**
   * 加载映射配置
   * @returns 映射规则
   */
  loadConfig(): MappingConfig;
  
  /**
   * 获取字段别名
   * @param standardField 标准字段
   * @returns 别名数组
   */
  getAliases(standardField: StandardFieldType): string[];
  
  /**
   * 添加自定义规则
   * @param rule 映射规则
   */
  addCustomRule(rule: MappingRule): void;
}
```

## 数据模型

### StandardFieldType

标准字段类型枚举：

```typescript
enum StandardFieldType {
  NAME = 'name',           // 姓名
  PHONE = 'phone',         // 手机号
  ADDRESS = 'address',     // 地址
  HIRE_DATE = 'hireDate',  // 入职日期
  PROVINCE = 'province',   // 省份
  CITY = 'city',           // 城市
  DISTRICT = 'district',   // 区县
}
```

### FieldMapping

字段映射结构：

```typescript
interface FieldMapping {
  // 源字段名 -> 标准字段类型
  mappings: Map<string, StandardFieldType>;
  
  // 列索引 -> 标准字段类型
  columnIndexMap: Map<number, StandardFieldType>;
  
  // 未映射的字段（扩展字段）
  unmappedFields: string[];
  
  // 映射置信度
  confidence: Map<string, number>;
}
```

### FieldMappingResult

字段映射结果：

```typescript
interface FieldMappingResult {
  // 字段映射
  mapping: FieldMapping;
  
  // 是否成功
  success: boolean;
  
  // 必需字段是否都已映射
  hasRequiredFields: boolean;
  
  // 缺失的必需字段
  missingRequiredFields: StandardFieldType[];
  
  // 低置信度字段
  lowConfidenceFields: Array<{
    sourceField: string;
    standardField: StandardFieldType;
    confidence: number;
  }>;
  
  // 映射日志
  logs: MappingLog[];
}
```

### MappingConfig

映射配置：

```typescript
interface MappingConfig {
  // 字段别名映射
  aliases: {
    [key in StandardFieldType]: string[];
  };
  
  // 正则表达式规则
  regexRules: Array<{
    pattern: RegExp;
    standardField: StandardFieldType;
    priority: number;
  }>;
  
  // 必需字段
  requiredFields: StandardFieldType[];
  
  // 置信度阈值
  confidenceThreshold: number;
}
```

### StandardData

标准化数据结构：

```typescript
interface StandardData {
  // 标准字段
  name: string | null;
  phone: string | null;
  address: string | null;
  hireDate: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  
  // 扩展字段（JSON格式）
  extraFields: Record<string, any>;
  
  // 原始行号
  rowNumber: number;
}
```

## 正确性属性

*属性是关于系统应该如何行为的形式化陈述，可以通过属性测试来验证。*

### 属性 1：映射完整性

*对于任何*有效的CSV文件，如果文件包含N个字段，那么映射结果中的已映射字段数量加上未映射字段数量应该等于N。

**验证：需求 1.2, 4.1**

### 属性 2：必需字段验证

*对于任何*字段映射结果，如果映射成功（success=true），那么所有必需字段（name, phone）都必须已映射。

**验证：需求 6.4**

### 属性 3：置信度范围

*对于任何*字段映射，所有置信度分数必须在0到100之间（包含边界）。

**验证：需求 6.2**

### 属性 4：映射唯一性

*对于任何*字段映射，每个源字段最多只能映射到一个标准字段，每个标准字段最多只能被一个源字段映射。

**验证：需求 2.1-2.7**

### 属性 5：标准化幂等性

*对于任何*字段名称，多次调用标准化函数应该返回相同的结果。即 normalize(normalize(x)) = normalize(x)。

**验证：需求 1.5**

### 属性 6：内容分析一致性

*对于任何*数据样本，如果80%以上的样本符合某种类型特征，那么内容分析应该识别为该类型。

**验证：需求 3.2-3.5**

### 属性 7：映射应用正确性

*对于任何*原始数据行和有效的字段映射，应用映射后的标准数据应该包含所有已映射字段的值，且值来自原始数据行的对应位置。

**验证：需求 7.1-7.5**

### 属性 8：扩展字段保留

*对于任何*包含未映射字段的数据行，应用映射后的标准数据的extraFields应该包含所有未映射字段及其值。

**验证：需求 4.1-4.3**

### 属性 9：向后兼容性

*对于任何*字段顺序为"姓名,手机号码,地址,入职日期"的文件，动态映射的结果应该与硬编码映射的结果一致。

**验证：需求 9.1-9.4**

### 属性 10：配置热重载

*对于任何*有效的配置更新，系统应该在不重启的情况下应用新配置，且新配置应该立即生效于后续的映射操作。

**验证：需求 5.3**

## 错误处理

### 1. 表头解析错误

- **场景**：文件第一行为空或格式错误
- **处理**：返回错误信息，拒绝处理文件
- **日志**：记录文件路径和错误详情

### 2. 必需字段缺失

- **场景**：无法映射到name或phone字段
- **处理**：返回错误信息，标记缺失字段
- **日志**：记录所有字段名和映射尝试结果

### 3. 低置信度映射

- **场景**：映射置信度低于阈值（默认80%）
- **处理**：标记为低置信度，建议用户确认
- **日志**：记录字段名、候选映射和置信度分数

### 4. 配置文件错误

- **场景**：配置文件格式错误或不存在
- **处理**：使用默认配置，记录警告日志
- **日志**：记录配置文件路径和错误详情

### 5. 内容分析失败

- **场景**：数据样本不足或格式混乱
- **处理**：回退到基于名称的映射
- **日志**：记录字段名和样本数据

## 测试策略

### 单元测试

- 测试HeaderParser的表头解析功能
- 测试FieldRecognizer的字段识别规则
- 测试ContentAnalyzer的内容分析逻辑
- 测试MappingConfigService的配置加载
- 测试字段名标准化函数

### 属性测试

- 属性1：映射完整性测试
- 属性2：必需字段验证测试
- 属性3：置信度范围测试
- 属性4：映射唯一性测试
- 属性5：标准化幂等性测试
- 属性6：内容分析一致性测试
- 属性7：映射应用正确性测试
- 属性8：扩展字段保留测试
- 属性9：向后兼容性测试
- 属性10：配置热重载测试

每个属性测试应该运行至少100次迭代，使用随机生成的测试数据。

### 集成测试

- 测试完整的字段映射流程
- 测试不同字段顺序的文件处理
- 测试包含扩展字段的文件处理
- 测试配置更新后的映射行为
- 测试与现有数据处理流程的集成

### 性能测试

- 测试100个字段的映射时间（应<1秒）
- 测试大文件的映射性能影响（应<1%）
- 测试并发映射的性能
- 测试配置缓存的效果

## 实现细节

### 字段识别规则优先级

1. **精确匹配**（优先级最高）：字段名完全匹配标准字段或别名
2. **正则匹配**：字段名匹配配置的正则表达式规则
3. **模糊匹配**：字段名包含标准字段关键词
4. **内容分析**（优先级最低）：基于数据内容识别

### 默认字段别名配置

```typescript
const DEFAULT_ALIASES = {
  name: ['姓名', '名字', '用户名', 'name', 'username', '员工姓名'],
  phone: ['手机', '手机号', '手机号码', '电话', '联系方式', 'phone', 'mobile', 'tel', 'telephone'],
  address: ['地址', '详细地址', '联系地址', '家庭地址', 'address', 'addr'],
  hireDate: ['入职日期', '入职时间', '入职', '日期', '时间', 'date', 'hireDate', 'hire_date', 'join_date'],
  province: ['省', '省份', 'province', 'prov'],
  city: ['市', '城市', 'city'],
  district: ['区', '区县', '县', 'district', 'county'],
};
```

### 内容分析规则

#### 手机号识别

- 样本中80%以上为11位数字
- 或样本中80%以上符合手机号格式（带横杠、空格、国家代码）

#### 日期识别

- 样本中80%以上符合日期格式（YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, YYYY年MM月DD日）
- 或样本中80%以上可以被日期解析函数成功解析

#### 地址识别

- 样本中80%以上包含省市区关键词（省、市、区、县、街道、路、号）
- 或样本中80%以上长度大于10个字符且包含中文

#### 姓名识别

- 样本中80%以上为2-10个汉字
- 或样本中80%以上符合中文姓名格式

### 数据库schema更新

需要在clean_data表中添加extra_fields字段：

```sql
ALTER TABLE clean_data 
ADD COLUMN extra_fields TEXT COMMENT '扩展字段（JSON格式）';
```

### Worker线程更新

Worker线程需要接收字段映射信息：

```typescript
interface WorkerMessage {
  // ... 现有字段
  fieldMapping: FieldMapping; // 新增：字段映射信息
}
```

Worker在处理数据时使用字段映射：

```typescript
function processRow(row: string[], mapping: FieldMapping): StandardData {
  const data: StandardData = {
    name: null,
    phone: null,
    address: null,
    hireDate: null,
    province: null,
    city: null,
    district: null,
    extraFields: {},
    rowNumber: 0,
  };
  
  // 应用映射
  for (const [colIndex, standardField] of mapping.columnIndexMap.entries()) {
    data[standardField] = row[colIndex];
  }
  
  // 处理未映射字段
  for (const unmappedField of mapping.unmappedFields) {
    const colIndex = getColumnIndex(unmappedField);
    data.extraFields[unmappedField] = row[colIndex];
  }
  
  return data;
}
```

## 部署考虑

### 配置文件位置

- 默认配置：`src/config/field-mapping.config.ts`
- 自定义配置：`config/field-mapping.json`（可选）

### 环境变量

```
# 字段映射配置
FIELD_MAPPING_CONFIDENCE_THRESHOLD=80  # 置信度阈值
FIELD_MAPPING_SAMPLE_SIZE=10           # 内容分析样本大小
FIELD_MAPPING_ENABLE_CONTENT_ANALYSIS=true  # 是否启用内容分析
```

### 向后兼容

- 保持现有API接口不变
- 在内部使用动态映射替换硬编码映射
- 提供配置开关，可以禁用动态映射回退到硬编码模式

## 性能优化

1. **缓存映射结果**：对于相同表头的文件，缓存映射结果
2. **并行内容分析**：使用Promise.all并行分析多个字段
3. **限制样本大小**：只读取前10行数据进行内容分析
4. **配置预编译**：启动时预编译正则表达式规则
5. **懒加载内容分析**：只在名称识别失败时才进行内容分析
