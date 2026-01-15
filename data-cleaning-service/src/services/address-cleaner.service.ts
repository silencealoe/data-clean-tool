import { Injectable } from '@nestjs/common';
import { CleanResult, AddressComponents } from '../common/types';

/**
 * Service for cleaning and extracting address components
 * Handles Chinese addresses with province, city, and district extraction
 * Supports special administrative regions like municipalities and autonomous regions
 */
@Injectable()
export class AddressCleanerService {
    // Chinese provinces, municipalities, autonomous regions, and special administrative regions
    private readonly provinces = [
        // Municipalities (直辖市)
        '北京市', '上海市', '天津市', '重庆市',
        // Provinces (省)
        '河北省', '山西省', '辽宁省', '吉林省', '黑龙江省', '江苏省', '浙江省', '安徽省',
        '福建省', '江西省', '山东省', '河南省', '湖北省', '湖南省', '广东省', '海南省',
        '四川省', '贵州省', '云南省', '陕西省', '甘肃省', '青海省', '台湾省',
        // Autonomous regions (自治区)
        '内蒙古自治区', '广西壮族自治区', '西藏自治区', '宁夏回族自治区', '新疆维吾尔自治区',
        // Special administrative regions (特别行政区)
        '香港特别行政区', '澳门特别行政区'
    ];

    // Municipalities and special regions that don't have separate city level
    private readonly municipalities = ['北京市', '上海市', '天津市', '重庆市', '香港特别行政区', '澳门特别行政区'];

    /**
     * Clean address by extracting province, city, and district components
     * @param address - Raw address input (any type)
     * @returns CleanResult with AddressComponents or error
     */
    cleanAddress(address: any): CleanResult<AddressComponents> {
        // Handle null, undefined, or empty values
        if (address === null || address === undefined || address === '') {
            return {
                success: false,
                error: 'Address is empty or null'
            };
        }

        // Convert to string and trim
        const addressStr = String(address).trim();

        if (addressStr === '') {
            return {
                success: false,
                error: 'Address is empty after trimming'
            };
        }

        // Extract address components
        const components = this.extractComponents(addressStr);

        if (!components) {
            // Check if we can at least extract province to give a more specific error
            const provinceMatch = this.matchProvince(addressStr);
            if (provinceMatch) {
                const lengthToSubtract = provinceMatch.matchedLength || provinceMatch.match.length;
                if (addressStr.substring(lengthToSubtract).trim() === '') {
                    return {
                        success: false,
                        error: 'Address is incomplete - missing required province/city information'
                    };
                }
            }

            return {
                success: false,
                error: 'Unable to extract province, city, or district from address'
            };
        }

        // Validate that we have at least province and city (or municipality), and detailed address
        if (!components.province || (!components.city && !this.municipalities.includes(components.province))) {
            return {
                success: false,
                error: 'Address is incomplete - missing required province/city information'
            };
        }

        // Require detailed address information (not just province and city)
        if (!components.detail || components.detail.trim() === '') {
            return {
                success: false,
                error: 'Address is incomplete - missing detailed address information'
            };
        }

        // For non-municipalities, also require district information if possible
        if (!this.municipalities.includes(components.province) && (!components.district || components.district.trim() === '')) {
            return {
                success: false,
                error: 'Address is incomplete - missing district information'
            };
        }

        return {
            success: true,
            value: components
        };
    }

    /**
     * Extract province, city, and district components from address string
     * @param address - Address string to parse
     * @returns AddressComponents or null if extraction fails
     */
    private extractComponents(address: string): AddressComponents | null {
        let remainingAddress = address;
        let province = '';
        let city = '';
        let district = '';
        let detail = '';

        // First, try to match province
        const provinceMatch = this.matchProvince(remainingAddress);
        if (provinceMatch) {
            province = provinceMatch.match;
            const lengthToSubtract = provinceMatch.matchedLength || provinceMatch.match.length;
            remainingAddress = remainingAddress.substring(lengthToSubtract);
        } else {
            // If no province found, this might be an incomplete address
            return null;
        }

        // Check if we only have province (no more content)
        if (remainingAddress.trim() === '') {
            return null; // Only province is not enough
        }

        // Handle municipalities (they don't have separate city level)
        if (this.municipalities.includes(province)) {
            // For municipalities, try to find district directly
            const districtMatch = this.matchDistrict(remainingAddress);
            if (districtMatch) {
                district = districtMatch.match;
                remainingAddress = remainingAddress.substring(districtMatch.match.length);
            }

            // Set city same as province for municipalities
            city = province;
        } else {
            // For regular provinces, try to match city with special handling for cases like "青岛市市南区"
            const cityMatch = this.matchCityWithDistrictCheck(remainingAddress);
            if (cityMatch) {
                city = cityMatch.match;
                remainingAddress = remainingAddress.substring(cityMatch.match.length);

                // Then try to match district
                const districtMatch = this.matchDistrict(remainingAddress);
                if (districtMatch) {
                    district = districtMatch.match;
                    remainingAddress = remainingAddress.substring(districtMatch.match.length);
                }
            }
        }

        // The remaining part is the detailed address
        detail = remainingAddress.trim();

        // Return components (city is required for non-municipalities)
        if (province && (city || this.municipalities.includes(province))) {
            return {
                province,
                city: city || province, // For municipalities, city equals province
                district: district || '',
                detail: detail || ''
            };
        }

        return null;
    }

    /**
     * Match city with special handling for districts that start with the same character as city ends
     * @param address - Address string (after province is removed)
     * @returns Match result with matched text and position
     */
    private matchCityWithDistrictCheck(address: string): { match: string; position: number } | null {
        // Special handling for cases like "青岛市市南区" where city ends with "市" and district starts with "市"
        // Look for pattern: [city]市市[district_name]区
        const specialPattern1 = /^([\u4e00-\u9fff]{2,8}市)市([\u4e00-\u9fff]{1,4}区)/;
        const specialMatch1 = address.match(specialPattern1);
        if (specialMatch1) {
            // Return just the city part, let district matching handle the district
            return { match: specialMatch1[1], position: 0 };
        }

        // Special handling for cases like "广州市越秀区" where city ends with "市" and is followed by district
        // Look for pattern: [city]市[district_name]区
        const specialPattern2 = /^([\u4e00-\u9fff]{2,8}市)([\u4e00-\u9fff]{2,6}区)/;
        const specialMatch2 = address.match(specialPattern2);
        if (specialMatch2) {
            // Return just the city part, let district matching handle the district
            return { match: specialMatch2[1], position: 0 };
        }

        // Fall back to regular city matching
        return this.matchCity(address);
    }

    /**
     * Match province from the beginning of address string
     * @param address - Address string
     * @returns Match result with matched text and position
     */
    private matchProvince(address: string): { match: string; position: number; matchedLength?: number } | null {
        for (const province of this.provinces) {
            if (address.startsWith(province)) {
                return { match: province, position: 0 };
            }
        }

        // Try to match province without suffix (e.g., "广东" instead of "广东省")
        for (const province of this.provinces) {
            if (province.endsWith('省') || province.endsWith('市') || province.endsWith('自治区') || province.endsWith('特别行政区')) {
                const provinceWithoutSuffix = province.replace(/(省|市|自治区|特别行政区)$/, '');
                if (address.startsWith(provinceWithoutSuffix)) {
                    return { match: province, position: 0, matchedLength: provinceWithoutSuffix.length };
                }
            }
        }

        return null;
    }

    /**
     * Match city from address string
     * @param address - Address string (after province is removed)
     * @returns Match result with matched text and position
     */
    private matchCity(address: string): { match: string; position: number } | null {
        // Try to find city with common suffixes
        const cityPatterns = [
            // Match city names ending with 市 (Chinese characters only, 2-8 chars)
            /^([\u4e00-\u9fff]{2,8}市)/,
            // Match autonomous prefectures and leagues
            /^([\u4e00-\u9fff]{2,12}(自治州|地区|盟))/,
        ];

        for (const pattern of cityPatterns) {
            const match = address.match(pattern);
            if (match) {
                return { match: match[1], position: 0 };
            }
        }

        return null;
    }

    /**
     * Match district from address string
     * @param address - Address string (after province and city are removed)
     * @returns Match result with matched text and position
     */
    private matchDistrict(address: string): { match: string; position: number } | null {
        // Try to find district with common suffixes - only match actual administrative divisions
        // Exclude scenic areas, development zones, etc.
        const districtPatterns = [
            // Match districts ending with 区, but exclude scenic areas and special zones
            /^((?!.*风景)[\u4e00-\u9fff]{2,6}区)/,
            // Match counties ending with 县
            /^([\u4e00-\u9fff]{2,6}县)/,
            // Match county-level cities ending with 市
            /^([\u4e00-\u9fff]{2,6}市)/,
            // Match banners ending with 旗
            /^([\u4e00-\u9fff]{2,8}旗)/,
            // Match autonomous counties and banners
            /^([\u4e00-\u9fff]{2,12}(自治县|自治旗))/,
        ];

        for (const pattern of districtPatterns) {
            const match = address.match(pattern);
            if (match) {
                return { match: match[1], position: 0 };
            }
        }

        return null;
    }
}