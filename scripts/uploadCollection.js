const fs = require('fs');
const path = require('path');
const { Blob } = require('@vercel/blob');

// Import the generateCollectionMetadata function from the existing script
const { generateCollectionMetadata } = require('./generateCollectionMetadata');

// Configuration
const COLLECTIONS_DIR = path.join(__dirname, '../public/collections');
const BLOB_STORAGE_URL = process.env.BLOB_STORAGE_URL;

// Helper function to upload file to blob storage
async function uploadFile(filePath, blobPath) {
  const fileBuffer = fs.readFileSync(filePath);
  const blob = await Blob.put(blobPath, fileBuffer, {
    access: 'public',
    contentType: getContentType(filePath)
  });
  return blob.url;
}

// Helper function to get content type
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp3':
      return 'audio/mpeg';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
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
      const relativePath = path.relative(COLLECTIONS_DIR, itemPath);
      
      if (fs.statSync(itemPath).isDirectory()) {
        collectFiles(itemPath);
      } else {
        files.push({
          localPath: itemPath,
          blobPath: `collections/${collectionId}/${relativePath}`
        });
      }
    });
  }
  
  collectFiles(collectionDir);
  
  // Upload files
  const uploadPromises = files.map(async ({ localPath, blobPath }) => {
    try {
      const url = await uploadFile(localPath, blobPath);
      console.log(`Uploaded: ${blobPath} -> ${url}`);
      return url;
    } catch (error) {
      console.error(`Error uploading ${blobPath}:`, error);
      throw error;
    }
  });
  
  await Promise.all(uploadPromises);
  
  // Upload metadata
  const metadataBlobPath = `collections/${collectionId}/metadata.json`;
  const metadataBuffer = Buffer.from(JSON.stringify(metadata, null, 2));
  const metadataBlob = await Blob.put(metadataBlobPath, metadataBuffer, {
    access: 'public',
    contentType: 'application/json'
  });
  
  console.log(`Uploaded metadata for ${collectionId}`);
  return metadataBlob.url;
}

// Main function
async function main() {
  try {
    // Get collection to upload (from command line argument)
    const collectionId = process.argv[2];
    if (!collectionId) {
      console.error('Please provide a collection ID to upload');
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

main();