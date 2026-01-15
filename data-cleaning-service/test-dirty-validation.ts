import { PhoneCleanerService } from './src/services/phone-cleaner.service';
import { AddressCleanerService } from './src/services/address-cleaner.service';
import { DateCleanerService } from './src/services/date-cleaner.service';

const phoneCleaner = new PhoneCleanerService();
const addressCleaner = new AddressCleanerService();
const dateCleaner = new DateCleanerService();

console.log('=== 测试脏数据验证 ===\n');

// 测试手机号
console.log('--- 手机号测试 ---');
const phones = [
    { name: '张三', phone: '138-1234-5678', expected: '应该通过' },
    { name: '李四', phone: '13987654321', expected: '应该通过' },
    { name: '王五', phone: '156 1234 5678', expected: '应该通过' },
    { name: '赵六', phone: '1391234567', expected: '应该失败(10位)' },
    { name: '钱七', phone: '139-123-45678', expected: '应该失败(格式错误)' },
    { name: '孙八', phone: '13912345678', expected: '应该通过' },
    { name: '周九', phone: '139 1234 5678', expected: '应该通过' },
    { name: '吴十', phone: '1391234567890', expected: '应该失败(13位)' },
    { name: '郑十一', phone: '139-1234-567', expected: '应该失败(格式错误)' },
    { name: '陈十二', phone: '13912345', expected: '应该失败(8位)' },
];

phones.forEach(({ name, phone, expected }) => {
    const result = phoneCleaner.cleanPhone(phone);
    console.log(`${name}: ${phone} -> ${result.success ? '✓ 通过' : '✗ 失败'} (${expected})`);
    if (!result.success) {
        console.log(`  错误: ${result.error}`);
    }
});

// 测试地址
console.log('\n--- 地址测试 ---');
const addresses = [
    { name: '张三', address: '北京市朝阳区建国路1号', expected: '应该通过' },
    { name: '李四', address: '上海市浦东新区陆家嘴路100号', expected: '应该通过' },
    { name: '王五', address: '广东省深圳市南山区科技园南路', expected: '应该通过' },
    { name: '李十四', address: '广东省广州市', expected: '应该失败(缺少区和详细地址)' },
    { name: '王十五', address: '东路800号', expected: '应该失败(缺少省市区)' },
];

addresses.forEach(({ name, address, expected }) => {
    const result = addressCleaner.cleanAddress(address);
    console.log(`${name}: ${address} -> ${result.success ? '✓ 通过' : '✗ 失败'} (${expected})`);
    if (!result.success) {
        console.log(`  错误: ${result.error}`);
    }
});

// 测试日期
console.log('\n--- 日期测试 ---');
const dates = [
    { name: '张三', date: '2023/01/15', expected: '应该通过' },
    { name: '李四', date: '2023-05-20', expected: '应该通过' },
    { name: '王五', date: '2023年12月03日', expected: '应该通过' },
    { name: '赵六', date: '23/08/15', expected: '应该失败(年份2位)' },
    { name: '钱七', date: '2023.09.10', expected: '应该通过' },
    { name: '郑十一', date: '23-07-20', expected: '应该失败(年份2位)' },
];

dates.forEach(({ name, date, expected }) => {
    const result = dateCleaner.cleanDate(date);
    console.log(`${name}: ${date} -> ${result.success ? '✓ 通过' : '✗ 失败'} (${expected})`);
    if (!result.success) {
        console.log(`  错误: ${result.error}`);
    }
});
