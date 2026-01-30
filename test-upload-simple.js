const fs = require('fs');

// Create a simple test CSV file
const csvContent = `name,phone,email,address,date
John Doe,13812345678,john@example.com,北京市朝阳区,2023-01-15
Jane Smith,15987654321,jane@example.com,上海市浦东新区,2023-02-20
Bob Johnson,18765432109,bob@example.com,广州市天河区,2023-03-10`;

fs.writeFileSync('test-sample.csv', csvContent);
console.log('Test CSV file created: test-sample.csv');

// Test with curl command
console.log('\nTo test upload, run this command:');
console.log('curl -X POST -F "file=@test-sample.csv" http://localhost:3100/api/data-cleaning/upload');
console.log('\nThen check status with:');
console.log('curl http://localhost:3100/api/async-processing/status/[JOB_ID]');