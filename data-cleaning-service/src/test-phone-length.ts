import { PhoneCleanerService } from './services/phone-cleaner.service';

const phoneService = new PhoneCleanerService();

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
    console.log(`${phone} -> Success: ${result.success}, Value: ${result.value}, Length: ${result.value?.length}`);
    if (!result.success) {
        console.log('Error:', result.error);
    }
});