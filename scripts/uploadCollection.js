const fs = require('fs');
const path = require('path');
const { put } = require('@vercel/blob');
const mongoose = require('mongoose');

// Import schemas
const CollectionSchema = require('../src/models/Collection').CollectionSchema;
const TrackSchema = require('../src/models/Track').TrackSchema;

// Register schemas
mongoose.model('Collection', CollectionSchema);
mongoose.model('Track', TrackSchema);

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

// MongoDB connection
async function connectToDatabase() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('Please define the MONGODB_URI environment variable');
    }

    const options = {
      connectTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      serverSelectionTimeoutMS: 5000,
      bufferCommands: false,
      maxPoolSize: 10,
      minPoolSize: 1,
    };

    await mongoose.connect(MONGODB_URI, options);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

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

// Upload collection to blob storage and update database
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
      allowOverwrite: true
    });
    
    console.log(`✓ Uploaded metadata: ${metadataBlob.url}`);

    // Update MongoDB database
    await updateDatabase(collectionId, metadata, results);
    
    return metadataBlob.url;
  } catch (error) {
    console.error(`Error uploading metadata:`, error);
    throw error;
  }
}

// Update MongoDB database with collection and track information
async function updateDatabase(collectionId, metadata, uploadResults) {
  try {
    // Connect to MongoDB
    await connectToDatabase();

    // Get the Collection model
    const Collection = mongoose.model('Collection');
    const Track = mongoose.model('Track');

    // Prepare collection data
    const collectionData = {
      id: collectionId,
      name: metadata.name,
      description: metadata.description,
      coverImage: metadata.coverImage,
      metadata: {
        artist: metadata.artist,
        year: metadata.year,
        tags: metadata.tags
      },
      tracks: []
    };

    // Find or create collection
    let collection = await Collection.findOne({ id: collectionId });
    if (!collection) {
      collection = await Collection.create(collectionData);
      console.log(`Created new collection in database: ${collectionId}`);
    } else {
      collection = await Collection.findOneAndUpdate(
        { id: collectionId },
        collectionData,
        { new: true }
      );
      console.log(`Updated existing collection in database: ${collectionId}`);
    }

    // Process tracks
    const trackPromises = metadata.tracks.map(async (track) => {
      // Generate a unique track ID by combining collection ID and layer name
      const uniqueTrackId = `${collectionId}_${track.id}`;
      
      const trackData = {
        id: uniqueTrackId, // Use the unique track ID
        title: track.title,
        audioUrl: track.audioUrl,
        layerFolder: track.layerFolder,
        variations: track.variations || [],
        collectionId: collectionId,
        collection: collection._id
      };

      // Find or create track using the unique track ID
      let existingTrack = await Track.findOne({ id: uniqueTrackId, collectionId: collectionId });
      if (!existingTrack) {
        existingTrack = await Track.create(trackData);
        console.log(`Created new track in database: ${uniqueTrackId}`);
      } else {
        existingTrack = await Track.findOneAndUpdate(
          { id: uniqueTrackId, collectionId: collectionId },
          trackData,
          { new: true }
        );
        console.log(`Updated existing track in database: ${uniqueTrackId}`);
      }

      return existingTrack._id;
    });

    // Wait for all track operations to complete
    const trackIds = await Promise.all(trackPromises);

    // Update collection with track references
    await Collection.findByIdAndUpdate(
      collection._id,
      { $set: { tracks: trackIds } }
    );

    console.log(`Successfully updated database for collection: ${collectionId}`);
  } catch (error) {
    console.error('Error updating database:', error);
    throw error;
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
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