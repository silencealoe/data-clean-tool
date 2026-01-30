const fs = require('fs');
const path = require('path');

async function testUpload() {
    try {
        // Create test file if it doesn't exist
        const testFile = 'test-sample.csv';
        if (!fs.existsSync(testFile)) {
            const csvContent = `name,phone,email,address,date
John Doe,13812345678,john@example.com,北京市朝阳区,2023-01-15
Jane Smith,15987654321,jane@example.com,上海市浦东新区,2023-02-20
Bob Johnson,18765432109,bob@example.com,广州市天河区,2023-03-10`;
            fs.writeFileSync(testFile, csvContent);
            console.log('Test CSV file created');
        }

        // Read file
        const fileBuffer = fs.readFileSync(testFile);
        const fileName = path.basename(testFile);

        console.log(`File: ${fileName}`);
        console.log(`Size: ${fileBuffer.length} bytes`);
        console.log(`Extension: ${path.extname(fileName)}`);

        // Create form data manually
        const boundary = '----formdata-boundary-' + Math.random().toString(36);
        const formData = [];

        formData.push(`--${boundary}\r\n`);
        formData.push(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`);
        formData.push(`Content-Type: text/csv\r\n\r\n`);
        formData.push(fileBuffer);
        formData.push(`\r\n--${boundary}--\r\n`);

        const body = Buffer.concat([
            Buffer.from(formData[0]),
            Buffer.from(formData[1]),
            Buffer.from(formData[2]),
            formData[3],
            Buffer.from(formData[4])
        ]);

        // Make request using fetch (if available) or http
        const http = require('http');

        const options = {
            hostname: 'localhost',
            port: 3100,
            path: '/api/data-cleaning/upload',
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length
            }
        };

        console.log('Uploading file...');

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`Status: ${res.statusCode}`);
                console.log('Response:', data);

                if (res.statusCode === 201) {
                    try {
                        const result = JSON.parse(data);
                        console.log(`Upload successful! Job ID: ${result.jobId}`);

                        // Test status check
                        setTimeout(() => {
                            checkStatus(result.jobId);
                        }, 1000);
                    } catch (e) {
                        console.log('Response is not JSON:', data);
                    }
                }
            });
        });

        req.on('error', (error) => {
            console.error('Upload failed:', error.message);
        });

        req.write(body);
        req.end();

    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

function checkStatus(jobId) {
    const http = require('http');

    const options = {
        hostname: 'localhost',
        port: 3100,
        path: `/api/data-cleaning/check-status/${jobId}`,
        method: 'GET'
    };

    console.log(`\nChecking status for job: ${jobId}`);

    const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            console.log(`Status check: ${res.statusCode}`);
            console.log('Status response:', data);
        });
    });

    req.on('error', (error) => {
        console.error('Status check failed:', error.message);
    });

    req.end();
}

testUpload();