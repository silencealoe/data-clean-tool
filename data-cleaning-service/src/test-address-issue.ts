import { PhoneCleanerService } from './services/phone-cleaner.service';
import { AddressCleanerService } from './services/address-cleaner.service';

const phoneService = new PhoneCleanerService();
const addressService = new AddressCleanerService();

// 测试手机号清洗
console.log('--- 手机号清洗测试 ---');
const testPhones = [
    '139-123-45678',
    '138-1234-5678',
    '13912345678',
    '1391234567'
];

testPhones.forEach(phone => {
    const result = phoneService.cleanPhone(phone);
    console.log(`${phone} -> Success: ${result.success}, Value: ${result.value}, Error: ${result.error}`);
});

console.log('\n--- 地址清洗测试 ---');
const testAddresses = [
    '广东省广州市',
    '广东省广州市越秀区',
    '广东省广州市越秀区环市东路',
    '广东省广州市越秀区环市东路339号'
];

testAddresses.forEach(address => {
    const result = addressService.cleanAddress(address);
    console.log(`${address} -> Success: ${result.success}, Error: ${result.error}`);
    if (result.success) {
        console.log('Components:', JSON.stringify(result.value, null, 2));
    }
});

// 打印详细信息
console.log('\n--- 详细信息 ---');
console.log('Municipalities:', addressService['municipalities']);