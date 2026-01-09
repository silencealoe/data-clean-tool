import { Test, TestingModule } from '@nestjs/testing';
import { AddressCleanerService } from './address-cleaner.service';
import { AddressComponents } from '../common/types';

describe('AddressCleanerService', () => {
    let service: AddressCleanerService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [AddressCleanerService],
        }).compile();

        service = module.get<AddressCleanerService>(AddressCleanerService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('cleanAddress', () => {
        it('should handle null and undefined values', () => {
            expect(service.cleanAddress(null)).toEqual({
                success: false,
                error: 'Address is empty or null'
            });

            expect(service.cleanAddress(undefined)).toEqual({
                success: false,
                error: 'Address is empty or null'
            });

            expect(service.cleanAddress('')).toEqual({
                success: false,
                error: 'Address is empty or null'
            });
        });

        it('should handle empty string after trimming', () => {
            expect(service.cleanAddress('   ')).toEqual({
                success: false,
                error: 'Address is empty after trimming'
            });
        });

        it('should extract components from complete address', () => {
            const result = service.cleanAddress('广东省广州市天河区珠江新城');
            expect(result.success).toBe(true);
            expect(result.value).toEqual({
                province: '广东省',
                city: '广州市',
                district: '天河区',
                detail: '珠江新城'
            });
        });

        it('should handle municipality addresses', () => {
            const result = service.cleanAddress('北京市朝阳区三里屯街道');
            expect(result.success).toBe(true);
            expect(result.value).toEqual({
                province: '北京市',
                city: '北京市',
                district: '朝阳区',
                detail: '三里屯街道'
            });
        });

        it('should handle address without district', () => {
            const result = service.cleanAddress('浙江省杭州市西湖风景区');
            expect(result.success).toBe(true);
            expect(result.value).toEqual({
                province: '浙江省',
                city: '杭州市',
                district: '',
                detail: '西湖风景区'
            });
        });

        it('should handle province without suffix', () => {
            const result = service.cleanAddress('广东广州市天河区');
            expect(result.success).toBe(true);
            expect(result.value).toEqual({
                province: '广东省',
                city: '广州市',
                district: '天河区',
                detail: ''
            });
        });

        it('should handle autonomous regions', () => {
            const result = service.cleanAddress('新疆维吾尔自治区乌鲁木齐市天山区');
            expect(result.success).toBe(true);
            expect(result.value).toEqual({
                province: '新疆维吾尔自治区',
                city: '乌鲁木齐市',
                district: '天山区',
                detail: ''
            });
        });

        it('should handle special administrative regions', () => {
            const result = service.cleanAddress('香港特别行政区中西区');
            expect(result.success).toBe(true);
            expect(result.value).toEqual({
                province: '香港特别行政区',
                city: '香港特别行政区',
                district: '中西区',
                detail: ''
            });
        });

        it('should reject incomplete addresses', () => {
            const result = service.cleanAddress('某某街道123号');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Unable to extract province, city, or district from address');
        });

        it('should reject addresses with only province', () => {
            const result = service.cleanAddress('广东省');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Address is incomplete - missing required province/city information');
        });

        it('should handle autonomous counties', () => {
            const result = service.cleanAddress('云南省大理白族自治州大理市');
            expect(result.success).toBe(true);
            expect(result.value?.province).toBe('云南省');
            expect(result.value?.city).toBe('大理白族自治州');
        });

        it('should handle different district types', () => {
            // Test with 县 (county)
            const result1 = service.cleanAddress('河北省石家庄市正定县');
            expect(result1.success).toBe(true);
            expect(result1.value?.district).toBe('正定县');

            // Test with 旗 (banner)
            const result2 = service.cleanAddress('内蒙古自治区呼和浩特市土默特左旗');
            expect(result2.success).toBe(true);
            expect(result2.value?.district).toBe('土默特左旗');
        });

        it('should convert non-string input to string', () => {
            const result = service.cleanAddress(12345);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Unable to extract province, city, or district from address');
        });

        it('should handle cities with districts starting with same character', () => {
            // Test case for 青岛市市南区 - city ending with 市 followed by district starting with 市
            const result = service.cleanAddress('山东省青岛市市南区香港中路68号');
            expect(result.success).toBe(true);
            expect(result.value).toEqual({
                province: '山东省',
                city: '青岛市',
                district: '市南区',
                detail: '香港中路68号'
            });
        });

        it('should handle other similar cases', () => {
            // Test case for 青岛市市北区
            const result1 = service.cleanAddress('山东省青岛市市北区台东路');
            expect(result1.success).toBe(true);
            expect(result1.value).toEqual({
                province: '山东省',
                city: '青岛市',
                district: '市北区',
                detail: '台东路'
            });

            // Test case for 青岛市李沧区 (normal case)
            const result2 = service.cleanAddress('山东省青岛市李沧区');
            expect(result2.success).toBe(true);
            expect(result2.value).toEqual({
                province: '山东省',
                city: '青岛市',
                district: '李沧区',
                detail: ''
            });
        });

        it('should handle city followed by district without special characters', () => {
            // Test case for 广州市越秀区 - city ending with 市 followed by district ending with 区
            const result = service.cleanAddress('广东省广州市越秀区环市东路339号');
            expect(result.success).toBe(true);
            expect(result.value).toEqual({
                province: '广东省',
                city: '广州市',
                district: '越秀区',
                detail: '环市东路339号'
            });
        });
    });
});