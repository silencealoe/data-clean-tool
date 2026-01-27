/**
 * Default field mapping configuration
 * Defines aliases and rules for automatic field recognition
 */

import { MappingConfig, StandardFieldType } from '../common/types/field-mapping.types';

/**
 * Default field aliases configuration
 * Maps various field name variations to standard fields
 */
export const DEFAULT_FIELD_ALIASES: MappingConfig['aliases'] = {
    [StandardFieldType.NAME]: [
        '姓名',
        '名字',
        '用户名',
        '员工姓名',
        '客户姓名',
        'name',
        'username',
        'user_name',
        'fullname',
        'full_name',
    ],

    [StandardFieldType.PHONE]: [
        '手机',
        '手机号',
        '手机号码',
        '电话',
        '联系方式',
        '联系电话',
        '移动电话',
        'phone',
        'mobile',
        'tel',
        'telephone',
        'phone_number',
        'mobile_number',
        'contact',
    ],

    [StandardFieldType.ADDRESS]: [
        '地址',
        '详细地址',
        '联系地址',
        '家庭地址',
        '居住地址',
        '通讯地址',
        'address',
        'addr',
        'location',
        'full_address',
    ],

    [StandardFieldType.HIRE_DATE]: [
        '入职日期',
        '入职时间',
        '入职',
        '日期',
        '时间',
        '加入日期',
        'date',
        'hiredate',
        'hire_date',
        'join_date',
        'joindate',
        'start_date',
        'startdate',
    ],

    [StandardFieldType.PROVINCE]: [
        '省',
        '省份',
        'province',
        'prov',
        'state',
    ],

    [StandardFieldType.CITY]: [
        '市',
        '城市',
        'city',
    ],

    [StandardFieldType.DISTRICT]: [
        '区',
        '区县',
        '县',
        'district',
        'county',
        'area',
    ],
};

/**
 * Default regex rules for field recognition
 * Used when exact or alias matching fails
 */
export const DEFAULT_REGEX_RULES: MappingConfig['regexRules'] = [
    // 姓名相关
    {
        pattern: /^(姓名|名字|name)/i,
        standardField: StandardFieldType.NAME,
        priority: 90,
    },

    // 手机号相关
    {
        pattern: /(手机|电话|phone|mobile|tel)/i,
        standardField: StandardFieldType.PHONE,
        priority: 90,
    },

    // 地址相关
    {
        pattern: /(地址|address|addr)/i,
        standardField: StandardFieldType.ADDRESS,
        priority: 90,
    },

    // 日期相关
    {
        pattern: /(日期|时间|date|time)/i,
        standardField: StandardFieldType.HIRE_DATE,
        priority: 80,
    },

    // 省份相关
    {
        pattern: /(省|省份|province)/i,
        standardField: StandardFieldType.PROVINCE,
        priority: 90,
    },

    // 城市相关
    {
        pattern: /(市|城市|city)/i,
        standardField: StandardFieldType.CITY,
        priority: 90,
    },

    // 区县相关
    {
        pattern: /(区|县|district|county)/i,
        standardField: StandardFieldType.DISTRICT,
        priority: 90,
    },
];

/**
 * Default mapping configuration
 */
export const DEFAULT_MAPPING_CONFIG: MappingConfig = {
    aliases: DEFAULT_FIELD_ALIASES,
    regexRules: DEFAULT_REGEX_RULES,
    requiredFields: [StandardFieldType.NAME, StandardFieldType.PHONE],
    confidenceThreshold: 80,
};

/**
 * Get default mapping configuration
 * @returns Default mapping configuration
 */
export function getDefaultMappingConfig(): MappingConfig {
    return {
        ...DEFAULT_MAPPING_CONFIG,
        aliases: { ...DEFAULT_FIELD_ALIASES },
        regexRules: [...DEFAULT_REGEX_RULES],
        requiredFields: [...DEFAULT_MAPPING_CONFIG.requiredFields],
    };
}
