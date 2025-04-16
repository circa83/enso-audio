const fs = require('fs');
const path = require('path');
const { put } = require('@vercel/blob');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

// Parse command line arguments
const args = process.argv.slice(2);
const useStreaming = args.includes('--streaming');
const useConcurrent = args.includes('--concurrent');

// Configuration
const TEST_FILES_DIR = path.join(process.cwd(), 'public', 'test-audio');
const BLOB_BASE_URL = process.env.NEXT_PUBLIC_BLOB_BASE_URL;

if (!BLOB_BASE_URL) {
  console.error('Error: NEXT_PUBLIC_BLOB_BASE_URL is not defined in .env.local');
  process.exit(1);
}

// Test files to upload
const testFiles = [
  'drone.mp3',
  
];

/**
 * Upload a single file to Vercel Blob
 * @param {string} filePath - Path to the file to upload
 * @param {boolean} useStreaming - Whether to use streaming upload
 * @returns {Promise<Object>} Upload result
 */
async function uploadFile(filePath, useStreaming = false) {
  try {
    const fileName = path.basename(filePath);
    const blobPath = `test/${fileName}`;
    
    console.log(`Uploading ${fileName}...`);
    
    if (useStreaming) {
      // Create a read stream
      const fileStream = fs.createReadStream(filePath);
      
      // Upload using streaming
      const blob = await put(blobPath, fileStream, {
        access: 'public',
        contentType: 'audio/mpeg'
      });
      
      return { success: true, blob };
    } else {
      // Read entire file into memory
      const fileBuffer = await fs.promises.readFile(filePath);
      
      // Upload using buffer
      const blob = await put(blobPath, fileBuffer, {
        access: 'public',
        contentType: 'audio/mpeg'
      });
      
      return { success: true, blob };
    }
  } catch (error) {
    console.error(`Error uploading ${filePath}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Run the blob integration test
 */
async function runTest() {
  console.log('========================================');
  console.log('Vercel Blob Integration Test');
  console.log('========================================');
  console.log('Configuration:');
  console.log(`- Streaming: ${useStreaming ? 'Enabled' : 'Disabled'}`);
  console.log(`- Concurrent: ${useConcurrent ? 'Enabled' : 'Disabled'}`);
  console.log('----------------------------------------');
  
  // Check if test files exist
  const existingFiles = testFiles.filter(file => 
    fs.existsSync(path.join(TEST_FILES_DIR, file))
  );
  
  if (existingFiles.length === 0) {
    console.error('No test files found in', TEST_FILES_DIR);
    process.exit(1);
  }
  
  console.log(`Found ${existingFiles.length} test files`);
  
  // Upload files
  const results = [];
  
  if (useConcurrent) {
    // Upload files concurrently
    const uploadPromises = existingFiles.map(file => 
      uploadFile(path.join(TEST_FILES_DIR, file), useStreaming)
    );
    
    results.push(...await Promise.all(uploadPromises));
  } else {
    // Upload files sequentially
    for (const file of existingFiles) {
      const result = await uploadFile(path.join(TEST_FILES_DIR, file), useStreaming);
      results.push(result);
    }
  }
  
  // Print results
  console.log('\nUpload Results:');
  console.log('----------------------------------------');
  
  let successCount = 0;
  let errorCount = 0;
  
  results.forEach((result, index) => {
    const fileName = existingFiles[index];
    
    if (result.success) {
      successCount++;
      console.log(`✅ ${fileName}: Success`);
      console.log(`   URL: ${result.blob.url}`);
      console.log(`   Size: ${(result.blob.size / 1024 / 1024).toFixed(2)} MB`);
    } else {
      errorCount++;
      console.log(`❌ ${fileName}: Failed`);
      console.log(`   Error: ${result.error}`);
    }
  });
  
  console.log('\nSummary:');
  console.log('----------------------------------------');
  console.log(`Total files: ${results.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${errorCount}`);
  console.log('========================================');
}

// Run the test
runTest().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
}); 