
import { PhoneCleanerService } from './data-cleaning-service/src/services/phone-cleaner.service';
import { DateCleanerService } from './data-cleaning-service/src/services/date-cleaner.service';
import { AddressCleanerService } from './data-cleaning-service/src/services/address-cleaner.service';
import { StreamParserService } from './data-cleaning-service/src/services/stream-parser.service';
import { DataCleanerService } from './data-cleaning-service/src/services/data-cleaner.service';

// 创建服务实例
const phoneCleaner = new PhoneCleanerService();
const dateCleaner = new DateCleanerService();
const addressCleaner = new AddressCleanerService();
const streamParser = new StreamParserService();

// 测试手机号清洗
console.log('=== 手机号清洗测试 ===');
const dirtyPhones = [
  '1391234567',
  '139-123-45678',
  '1391234567890',
  '139-1234-567',
  '13912345'
];

dirtyPhones.forEach(phone => {
  const result = phoneCleaner.cleanPhone(phone);
  console.log(`原始值: ${phone}`);
  console.log(`结果: ${JSON.stringify(result, null, 2)}`);
  console.log();
});

// 测试日期清洗
console.log('=== 日期清洗测试 ===');
const dirtyDates = [
  '23/08/15',
  '2023.09.10',
  '23-07-20',
  '2023.06.30'
];

dirtyDates.forEach(date => {
  const result = dateCleaner.cleanDate(date);
  console.log(`原始值: ${date}`);
  console.log(`结果: ${JSON.stringify(result, null, 2)}`);
  console.log();
});

// 测试地址清洗
console.log('=== 地址清洗测试 ===');
const dirtyAddresses = [
  '广东省广州市',
  '东路800号'
];

dirtyAddresses.forEach(address => {
  const result = addressCleaner.cleanAddress(address);
  console.log(`原始值: ${address}`);
  console.log(`结果: ${JSON.stringify(result, null, 2)}`);
  console.log();
});
