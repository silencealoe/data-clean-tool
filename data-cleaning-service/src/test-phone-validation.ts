import { PhoneCleanerService } from './services/phone-cleaner.service';

const phoneService = new PhoneCleanerService();

const testPhone = '139-123-45678';
const result = phoneService.cleanPhone(testPhone);
console.log(`Phone: ${testPhone}`);
console.log(`Cleaned: ${result.value}`);
console.log(`Length: ${result.value?.length}`);
console.log(`Success: ${result.success}`);
console.log(`Error: ${result.error}`);

// 直接测试手机号验证
const validateMobile = (phone: any) => {
    const phoneStr = String(phone).trim();
    const cleaned = phoneStr.replace(/\D/g, '');
    const secondDigit = parseInt(cleaned.charAt(1));
    console.log(`\nValidation details:`);
    console.log(`Trimmed: ${phoneStr}`);
    console.log(`Cleaned: ${cleaned}`);
    console.log(`Length: ${cleaned.length}`);
    console.log(`Starts with 1: ${cleaned.startsWith('1')}`);
    console.log(`Second digit: ${secondDigit} (should be 3-9)`);
};

validateMobile(testPhone);