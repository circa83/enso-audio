const fs = require('fs');
const path = require('path');
const { put } = require('@vercel/blob');

// Try to load environment variables from .env.local file
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
} catch (error) {
  console.log('Note: dotenv module not available, continuing without it');
}

// Set default store ID if not in environment
if (!process.env.BLOB_STORE_ID) {
  process.env.BLOB_STORE_ID = 'store_uGGTZAuWx9gzThtf'; // Default from your project
  console.log('Using default BLOB_STORE_ID:', process.env.BLOB_STORE_ID);
}

// Import the generateCollectionMetadata function from the existing script
const { generateCollectionMetadata } = require('./generateCollectionMetadata');

// Configuration
const COLLECTIONS_DIR = path.join(__dirname, '../public/collections');

// Helper function to upload file to blob storage
async function uploadFile(filePath, blobPath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`Uploading ${blobPath} (${fileBuffer.length} bytes)`);
    
    const blob = await put(blobPath, fileBuffer, {
      access: 'public',
      contentType: getContentType(filePath),
      allowOverwrite: true // Allow overwriting existing files
    });
    
    return blob.url;
  } catch (error) {
    console.error(`Error in uploadFile for ${blobPath}:`, error);
    throw error;
  }
}

// Helper function to get content type
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.ogg':
      return 'audio/ogg';
    case '.flac':
      return 'audio/flac';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}

// Upload collection to blob storage
async function uploadCollection(collectionDir) {
  const collectionId = path.basename(collectionDir);
  console.log(`Uploading collection: ${collectionId}`);
  
  // Generate metadata using the imported function
  const metadata = generateCollectionMetadata(collectionDir);
  
  // Upload all files
  const files = [];
  function collectFiles(dir) {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        collectFiles(itemPath);
      } else {
        const relativePath = path.relative(COLLECTIONS_DIR, itemPath).replace(/\\/g, '/');
        files.push({
          localPath: itemPath,
          blobPath: `collections/${relativePath}`,
          size: stat.size
        });
      }
    });
  }
  
  collectFiles(collectionDir);
  console.log(`Found ${files.length} files to upload`);
  
  // Upload files in batches to avoid overwhelming connections
  const batchSize = 5;
  const results = [];
  
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    console.log(`Processing batch ${i/batchSize + 1}/${Math.ceil(files.length/batchSize)}`);
    
    try {
      const batchResults = await Promise.all(batch.map(async ({ localPath, blobPath, size }) => {
        try {
          console.log(`Uploading (${(size/1024/1024).toFixed(2)} MB): ${blobPath}`);
          const url = await uploadFile(localPath, blobPath);
          console.log(`✓ Uploaded: ${blobPath} -> ${url}`);
          return { blobPath, url, success: true };
        } catch (error) {
          console.error(`✗ Error uploading ${blobPath}:`, error.message);
          return { blobPath, error: error.message, success: false };
        }
      }));
      
      results.push(...batchResults);
    } catch (error) {
      console.error(`Error processing batch:`, error);
    }
  }
  
  // Print upload summary
  const successful = results.filter(r => r.success).length;
  console.log(`Upload summary: ${successful}/${files.length} files uploaded successfully`);
  
  // Upload metadata
  try {
    const metadataBlobPath = `collections/${collectionId}/metadata.json`;
    const metadataBuffer = Buffer.from(JSON.stringify(metadata, null, 2));
    console.log(`Uploading metadata for ${collectionId}`);
    
    const metadataBlob = await put(metadataBlobPath, metadataBuffer, {
      access: 'public',
      contentType: 'application/json',
      allowOverwrite: true // Allow overwriting existing metadata file
    });
    
    console.log(`✓ Uploaded metadata: ${metadataBlob.url}`);
    return metadataBlob.url;
  } catch (error) {
    console.error(`Error uploading metadata:`, error);
    throw error;
  }
}

// Main function
async function main() {
  try {
    // Get collection to upload (from command line argument)
    const collectionId = process.argv[2];
    if (!collectionId) {
      console.error('Please provide a collection ID to upload');
      console.error('Usage: node uploadCollection.js <collectionId>');
      process.exit(1);
    }
    
    const collectionDir = path.join(COLLECTIONS_DIR, collectionId);
    if (!fs.existsSync(collectionDir)) {
      console.error(`Collection directory not found: ${collectionDir}`);
      process.exit(1);
    }
    
    // Upload collection
    const metadataUrl = await uploadCollection(collectionDir);
    console.log(`Collection upload complete! Metadata URL: ${metadataUrl}`);
  } catch (error) {
    console.error('Error uploading collection:', error);
    process.exit(1);
  }
}

// Execute the main function
main();