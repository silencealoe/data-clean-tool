/**
 * Field mapping types and interfaces for dynamic field recognition
 */

/**
 * Standard field types supported by the system
 */
export enum StandardFieldType {
    NAME = 'name',           // 姓名
    PHONE = 'phone',         // 手机号
    ADDRESS = 'address',     // 地址
    HIRE_DATE = 'hireDate',  // 入职日期
    PROVINCE = 'province',   // 省份
    CITY = 'city',           // 城市
    DISTRICT = 'district',   // 区县
}

/**
 * Field mapping structure
 * Maps source fields to standard fields
 */
export interface FieldMapping {
    // 源字段名 -> 标准字段类型
    mappings: Map<string, StandardFieldType>;

    // 列索引 -> 标准字段类型
    columnIndexMap: Map<number, StandardFieldType>;

    // 未映射的字段（扩展字段）
    unmappedFields: string[];

    // 映射置信度
    confidence: Map<string, number>;
}

/**
 * Mapping log entry for debugging and auditing
 */
export interface MappingLog {
    // 源字段名
    sourceField: string;

    // 候选标准字段
    candidateFields: Array<{
        standardField: StandardFieldType;
        score: number;
        matchType: 'exact' | 'alias' | 'regex' | 'fuzzy' | 'content';
    }>;

    // 最终映射结果
    finalMapping: StandardFieldType | null;

    // 置信度
    confidence: number;

    // 时间戳
    timestamp: Date;
}

/**
 * Field mapping result
 * Contains the mapping and validation information
 */
export interface FieldMappingResult {
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

/**
 * Mapping rule for regex-based field recognition
 */
export interface MappingRule {
    // 正则表达式模式
    pattern: RegExp;

    // 对应的标准字段
    standardField: StandardFieldType;

    // 优先级（数字越大优先级越高）
    priority: number;
}

/**
 * Mapping configuration
 * Defines aliases and rules for field recognition
 */
export interface MappingConfig {
    // 字段别名映射
    aliases: {
        [key in StandardFieldType]: string[];
    };

    // 正则表达式规则
    regexRules: MappingRule[];

    // 必需字段
    requiredFields: StandardFieldType[];

    // 置信度阈值
    confidenceThreshold: number;
}

/**
 * Standard data structure after field mapping
 * Contains both standard fields and extra fields
 */
export interface StandardData {
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
