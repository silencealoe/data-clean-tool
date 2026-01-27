/**
 * Tests for field mapping types
 * Verifies that the type definitions are correct and usable
 */

import {
    StandardFieldType,
    FieldMapping,
    FieldMappingResult,
    MappingConfig,
    StandardData,
    MappingLog,
    MappingRule,
} from './field-mapping.types';

describe('Field Mapping Types', () => {
    describe('StandardFieldType', () => {
        it('should have all required field types', () => {
            expect(StandardFieldType.NAME).toBe('name');
            expect(StandardFieldType.PHONE).toBe('phone');
            expect(StandardFieldType.ADDRESS).toBe('address');
            expect(StandardFieldType.HIRE_DATE).toBe('hireDate');
            expect(StandardFieldType.PROVINCE).toBe('province');
            expect(StandardFieldType.CITY).toBe('city');
            expect(StandardFieldType.DISTRICT).toBe('district');
        });
    });

    describe('FieldMapping', () => {
        it('should create a valid FieldMapping object', () => {
            const mapping: FieldMapping = {
                mappings: new Map([
                    ['姓名', StandardFieldType.NAME],
                    ['手机号', StandardFieldType.PHONE],
                ]),
                columnIndexMap: new Map([
                    [0, StandardFieldType.NAME],
                    [1, StandardFieldType.PHONE],
                ]),
                unmappedFields: ['额外字段'],
                confidence: new Map([
                    ['姓名', 100],
                    ['手机号', 95],
                ]),
            };

            expect(mapping.mappings.size).toBe(2);
            expect(mapping.columnIndexMap.size).toBe(2);
            expect(mapping.unmappedFields.length).toBe(1);
            expect(mapping.confidence.size).toBe(2);
        });
    });

    describe('FieldMappingResult', () => {
        it('should create a valid FieldMappingResult object', () => {
            const result: FieldMappingResult = {
                mapping: {
                    mappings: new Map(),
                    columnIndexMap: new Map(),
                    unmappedFields: [],
                    confidence: new Map(),
                },
                success: true,
                hasRequiredFields: true,
                missingRequiredFields: [],
                lowConfidenceFields: [],
                logs: [],
            };

            expect(result.success).toBe(true);
            expect(result.hasRequiredFields).toBe(true);
            expect(result.missingRequiredFields.length).toBe(0);
        });

        it('should handle missing required fields', () => {
            const result: FieldMappingResult = {
                mapping: {
                    mappings: new Map(),
                    columnIndexMap: new Map(),
                    unmappedFields: [],
                    confidence: new Map(),
                },
                success: false,
                hasRequiredFields: false,
                missingRequiredFields: [StandardFieldType.NAME, StandardFieldType.PHONE],
                lowConfidenceFields: [],
                logs: [],
            };

            expect(result.success).toBe(false);
            expect(result.hasRequiredFields).toBe(false);
            expect(result.missingRequiredFields.length).toBe(2);
        });
    });

    describe('MappingConfig', () => {
        it('should create a valid MappingConfig object', () => {
            const config: MappingConfig = {
                aliases: {
                    [StandardFieldType.NAME]: ['姓名', 'name'],
                    [StandardFieldType.PHONE]: ['手机', 'phone'],
                    [StandardFieldType.ADDRESS]: ['地址', 'address'],
                    [StandardFieldType.HIRE_DATE]: ['日期', 'date'],
                    [StandardFieldType.PROVINCE]: ['省', 'province'],
                    [StandardFieldType.CITY]: ['市', 'city'],
                    [StandardFieldType.DISTRICT]: ['区', 'district'],
                },
                regexRules: [],
                requiredFields: [StandardFieldType.NAME, StandardFieldType.PHONE],
                confidenceThreshold: 80,
            };

            expect(config.aliases[StandardFieldType.NAME].length).toBe(2);
            expect(config.requiredFields.length).toBe(2);
            expect(config.confidenceThreshold).toBe(80);
        });
    });

    describe('StandardData', () => {
        it('should create a valid StandardData object', () => {
            const data: StandardData = {
                name: '张三',
                phone: '13800138000',
                address: '北京市朝阳区',
                hireDate: '2024-01-01',
                province: '北京市',
                city: '北京市',
                district: '朝阳区',
                extraFields: {
                    department: '技术部',
                    position: '工程师',
                },
                rowNumber: 1,
            };

            expect(data.name).toBe('张三');
            expect(data.phone).toBe('13800138000');
            expect(data.extraFields.department).toBe('技术部');
            expect(data.rowNumber).toBe(1);
        });

        it('should handle null values for optional fields', () => {
            const data: StandardData = {
                name: '张三',
                phone: '13800138000',
                address: null,
                hireDate: null,
                province: null,
                city: null,
                district: null,
                extraFields: {},
                rowNumber: 1,
            };

            expect(data.name).toBe('张三');
            expect(data.address).toBeNull();
            expect(data.hireDate).toBeNull();
        });
    });

    describe('MappingLog', () => {
        it('should create a valid MappingLog object', () => {
            const log: MappingLog = {
                sourceField: '姓名',
                candidateFields: [
                    {
                        standardField: StandardFieldType.NAME,
                        score: 100,
                        matchType: 'exact',
                    },
                ],
                finalMapping: StandardFieldType.NAME,
                confidence: 100,
                timestamp: new Date(),
            };

            expect(log.sourceField).toBe('姓名');
            expect(log.candidateFields.length).toBe(1);
            expect(log.finalMapping).toBe(StandardFieldType.NAME);
            expect(log.confidence).toBe(100);
        });
    });

    describe('MappingRule', () => {
        it('should create a valid MappingRule object', () => {
            const rule: MappingRule = {
                pattern: /^姓名/,
                standardField: StandardFieldType.NAME,
                priority: 90,
            };

            expect(rule.pattern).toBeInstanceOf(RegExp);
            expect(rule.standardField).toBe(StandardFieldType.NAME);
            expect(rule.priority).toBe(90);
        });
    });
});
