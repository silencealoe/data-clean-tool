/**
 * Default Rule Configuration
 * 默认的字段规则配置，当无法从后端获取配置时使用
 */

import type { RuleConfiguration } from '@/types/rule-config';

export const DEFAULT_RULE_CONFIG: RuleConfiguration = {
    metadata: {
        name: "default-cleaning-rules",
        description: "默认数据清洗规则配置，等效于现有硬编码逻辑",
        version: "1.0.0",
        priority: 100
    },
    fieldRules: {
        "phone": [
            {
                name: "phone-format-validation",
                strategy: "regex",
                params: {
                    pattern: "^(\\d{11}|\\d{3}-\\d{4}-\\d{4}|\\d{3}\\s\\d{4}\\s\\d{4}|\\+86\\d{11}|\\+86-\\d{11}|\\+86\\s\\d{11}|0\\d{2,3}-\\d{7,8})$",
                    flags: ""
                },
                required: true,
                priority: 100,
                errorMessage: "Invalid phone number format"
            },
            {
                name: "chinese-mobile-validation",
                strategy: "regex",
                params: {
                    pattern: "^1[3-9]\\d{9}$",
                    flags: ""
                },
                required: false,
                priority: 90,
                errorMessage: "手机号格式不正确，应为11位数字且以1开头"
            },
            {
                name: "phone-cleaner-legacy",
                strategy: "phone",
                params: {
                    removeSpaces: true,
                    removeDashes: true,
                    removeCountryCode: false,
                    allowLandline: true
                },
                required: true,
                priority: 80,
                errorMessage: "手机号格式不正确"
            }
        ],
        "手机号": [
            {
                name: "phone-format-validation-chinese",
                strategy: "regex",
                params: {
                    pattern: "^(\\d{11}|\\d{3}-\\d{4}-\\d{4}|\\d{3}\\s\\d{4}\\s\\d{4}|\\+86\\d{11}|\\+86-\\d{11}|\\+86\\s\\d{11}|0\\d{2,3}-\\d{7,8})$",
                    flags: ""
                },
                required: true,
                priority: 100,
                errorMessage: "手机号格式不正确"
            },
            {
                name: "phone-cleaner-legacy-chinese",
                strategy: "phone",
                params: {
                    removeSpaces: true,
                    removeDashes: true,
                    removeCountryCode: false,
                    allowLandline: true
                },
                required: true,
                priority: 90,
                errorMessage: "手机号格式不正确"
            }
        ],
        "手机号码": [
            {
                name: "phone-cleaner-legacy-chinese-full",
                strategy: "phone",
                params: {
                    removeSpaces: true,
                    removeDashes: true,
                    removeCountryCode: false,
                    allowLandline: true
                },
                required: true,
                priority: 100,
                errorMessage: "手机号码格式不正确"
            }
        ],
        "date": [
            {
                name: "date-cleaner-legacy",
                strategy: "date",
                params: {
                    formats: [
                        "YYYY-MM-DD",
                        "YYYY/MM/DD",
                        "YYYY年MM月DD日",
                        "MM/DD/YYYY",
                        "DD/MM/YYYY",
                        "YYYY-M-D",
                        "YYYY/M/D",
                        "M/D/YYYY",
                        "M-D-YYYY"
                    ],
                    minYear: 1900,
                    maxYear: 2100,
                    timezone: "Asia/Shanghai"
                },
                required: true,
                priority: 100,
                errorMessage: "日期格式不正确或超出有效范围(1900-2100年)"
            }
        ],
        "日期": [
            {
                name: "date-cleaner-legacy-chinese",
                strategy: "date",
                params: {
                    formats: [
                        "YYYY-MM-DD",
                        "YYYY/MM/DD",
                        "YYYY年MM月DD日",
                        "YYYY年M月D日"
                    ],
                    minYear: 1900,
                    maxYear: 2100,
                    timezone: "Asia/Shanghai"
                },
                required: true,
                priority: 100,
                errorMessage: "日期格式不正确或超出有效范围"
            }
        ],
        "入职日期": [
            {
                name: "hire-date-cleaner-legacy",
                strategy: "date",
                params: {
                    formats: [
                        "YYYY-MM-DD",
                        "YYYY/MM/DD",
                        "YYYY年MM月DD日"
                    ],
                    minYear: 1980,
                    maxYear: 2030,
                    timezone: "Asia/Shanghai"
                },
                required: true,
                priority: 100,
                errorMessage: "入职日期格式不正确或超出有效范围"
            }
        ],
        "出生日期": [
            {
                name: "birth-date-cleaner",
                strategy: "date",
                params: {
                    formats: [
                        "YYYY-MM-DD",
                        "YYYY/MM/DD",
                        "YYYY年MM月DD日"
                    ],
                    minYear: 1900,
                    maxYear: 2024,
                    timezone: "Asia/Shanghai"
                },
                required: true,
                priority: 100,
                errorMessage: "出生日期格式不正确或超出有效范围"
            }
        ],
        "address": [
            {
                name: "address-cleaner-legacy",
                strategy: "address",
                params: {
                    requireProvince: true,
                    requireCity: true,
                    requireDistrict: false,
                    validateComponents: true
                },
                required: true,
                priority: 100,
                errorMessage: "地址格式不正确，需要包含省份和城市信息"
            }
        ],
        "地址": [
            {
                name: "address-cleaner-legacy-chinese",
                strategy: "address",
                params: {
                    requireProvince: true,
                    requireCity: true,
                    requireDistrict: true,
                    validateComponents: true
                },
                required: true,
                priority: 100,
                errorMessage: "地址格式不正确，需要包含省市区信息"
            }
        ],
        "详细地址": [
            {
                name: "detailed-address-cleaner",
                strategy: "address",
                params: {
                    requireProvince: true,
                    requireCity: true,
                    requireDistrict: true,
                    validateComponents: true
                },
                required: true,
                priority: 100,
                errorMessage: "详细地址格式不正确，需要包含完整的省市区及详细地址信息"
            }
        ],
        "email": [
            {
                name: "email-format-validation",
                strategy: "regex",
                params: {
                    pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
                    flags: "i"
                },
                required: true,
                priority: 100,
                errorMessage: "邮箱格式不正确"
            }
        ],
        "邮箱": [
            {
                name: "email-format-validation-chinese",
                strategy: "regex",
                params: {
                    pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
                    flags: "i"
                },
                required: true,
                priority: 100,
                errorMessage: "邮箱格式不正确"
            }
        ],
        "name": [
            {
                name: "name-length-validation",
                strategy: "length",
                params: {
                    minLength: 2,
                    maxLength: 50
                },
                required: true,
                priority: 100,
                errorMessage: "姓名长度应在2-50个字符之间"
            },
            {
                name: "chinese-name-validation",
                strategy: "regex",
                params: {
                    pattern: "^[\\u4e00-\\u9fa5·]{2,10}$",
                    flags: ""
                },
                required: false,
                priority: 90,
                errorMessage: "中文姓名应为2-10个中文字符"
            }
        ],
        "姓名": [
            {
                name: "chinese-name-validation-chinese",
                strategy: "regex",
                params: {
                    pattern: "^[\\u4e00-\\u9fa5·]{2,10}$",
                    flags: ""
                },
                required: true,
                priority: 100,
                errorMessage: "姓名应为2-10个中文字符"
            },
            {
                name: "name-length-validation-chinese",
                strategy: "length",
                params: {
                    minLength: 2,
                    maxLength: 10
                },
                required: true,
                priority: 90,
                errorMessage: "姓名长度应在2-10个字符之间"
            }
        ],
        "age": [
            {
                name: "age-range-validation",
                strategy: "range",
                params: {
                    min: 0,
                    max: 150,
                    inclusive: true
                },
                required: true,
                priority: 100,
                errorMessage: "年龄应在0-150岁之间"
            }
        ],
        "年龄": [
            {
                name: "age-range-validation-chinese",
                strategy: "range",
                params: {
                    min: 0,
                    max: 150,
                    inclusive: true
                },
                required: true,
                priority: 100,
                errorMessage: "年龄应在0-150岁之间"
            }
        ],
        "身份证号": [
            {
                name: "chinese-id-card-validation",
                strategy: "regex",
                params: {
                    pattern: "^[1-9]\\d{5}(18|19|20)\\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\\d{3}[0-9Xx]$",
                    flags: ""
                },
                required: true,
                priority: 100,
                errorMessage: "身份证号格式不正确"
            },
            {
                name: "id-card-length-validation",
                strategy: "length",
                params: {
                    exactLength: 18
                },
                required: true,
                priority: 90,
                errorMessage: "身份证号应为18位"
            }
        ],
        "工资": [
            {
                name: "salary-range-validation",
                strategy: "range",
                params: {
                    min: 0,
                    max: 1000000,
                    inclusive: true
                },
                required: true,
                priority: 100,
                errorMessage: "工资应在合理范围内(0-1000000)"
            }
        ],
        "salary": [
            {
                name: "salary-range-validation-english",
                strategy: "range",
                params: {
                    min: 0,
                    max: 1000000,
                    inclusive: true
                },
                required: true,
                priority: 100,
                errorMessage: "Salary should be within reasonable range (0-1000000)"
            }
        ]
    },
    globalSettings: {
        strictMode: false,
        continueOnError: true,
        maxErrors: 10,
        enableCaching: true,
        cacheTimeout: 3600,
        parallelProcessing: true,
        maxParallelTasks: 4,
        logLevel: "info",
        enablePerformanceMonitoring: true
    }
};