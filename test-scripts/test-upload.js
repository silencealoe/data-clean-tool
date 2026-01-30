const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testUpload() {
    try {
        console.log('Testing file upload and progress tracking...');

        // Check if test file exists
        const testFile = 'test-csv-sample.csv';
        if (!fs.existsSync(testFile)) {
            console.log('Creating test CSV file...');
            const csvContent = `name,phone,email,address,date
John Doe,13812345678,john@example.com,北京市朝阳区,2023-01-15
Jane Smith,15987654321,jane@example.com,上海市浦东新区,2023-02-20
Bob Johnson,18765432109,bob@example.com,广州市天河区,2023-03-10`;
            fs.writeFileSync(testFile, csvContent);
        }

        // Create form data
        const form = new FormData();
        form.append('file', fs.createReadStream(testFile));

        console.log('Uploading file...');
        const uploadResponse = await fetch('http://localhost:3100/api/data-cleaning/upload', {
            method: 'POST',
            body: form
        });

        if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }

        const uploadResult = await uploadResponse.json();
        console.log('Upload response:', uploadResult);

        if (uploadResult.jobId) {
            console.log(`File uploaded successfully! Job ID: ${uploadResult.jobId}`);

            // Monitor progress
            await monitorProgress(uploadResult.jobId);
        }

    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

async function monitorProgress(jobId) {
    console.log(`\nMonitoring progress for job: ${jobId}`);

    let completed = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max

    while (!completed && attempts < maxAttempts) {
        try {
            const response = await fetch(`http://localhost:3100/api/async-processing/status/${jobId}`);

            if (!response.ok) {
                throw new Error(`Status check failed: ${response.status}`);
            }

            const status = await response.json();
            console.log(`[${new Date().toLocaleTimeString()}] Status: ${status.status}, Progress: ${status.progress}%`);

            if (status.status === 'completed' || status.status === 'failed') {
                completed = true;
                console.log('Final status:', status);
            } else {
                // Wait 1 second before next check
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

        } catch (error) {
            console.error('Progress check failed:', error.message);
        }

        attempts++;
    }

    if (!completed) {
        console.log('Progress monitoring timed out');
    }
}

// Run the test
testUpload();