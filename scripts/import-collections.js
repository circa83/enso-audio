// scripts/import-collections.js
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Get MongoDB URI from environment
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable in .env.local');
}

// Import models
const Collection = require('../src/models/Collection');
const Track = require('../src/models/Track');

/**
 * Import collections from JSON files into MongoDB
 * 
 * @param {boolean} force - Whether to overwrite existing collections
 * @returns {Promise<Object>} - Statistics about the import operation
 */
async function importCollections(force = false) {
  console.log('[import-collections] Starting collections import process');
  
  // Connect to MongoDB
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[import-collections] Connected to MongoDB successfully');
  } catch (error) {
    console.error('[import-collections] Failed to connect to MongoDB:', error);
    throw error;
  }
  
  // Stats to track import progress
  const stats = {
    collectionsProcessed: 0,
    collectionsImported: 0,
    collectionsSkipped: 0,
    tracksProcessed: 0,
    tracksImported: 0,
    tracksSkipped: 0,
    errors: []
  };
  
  try {
    // Read the collections.json file from public directory
    const collectionsFilePath = path.join(process.cwd(), 'public', 'collections', 'collections.json');
    console.log(`[import-collections] Reading collections from: ${collectionsFilePath}`);
    
    if (!fs.existsSync(collectionsFilePath)) {
      throw new Error(`Collections file not found at: ${collectionsFilePath}`);
    }
    
    const collectionsData = JSON.parse(fs.readFileSync(collectionsFilePath, 'utf8'));
    console.log(`[import-collections] Found ${collectionsData.length} collections in file`);
    
    // Process each collection
    for (const collectionData of collectionsData) {
      stats.collectionsProcessed++;
      
      try {
        console.log(`[import-collections] Processing collection: ${collectionData.id}`);
        
        // Check if collection already exists
        const existingCollection = await Collection.findOne({ id: collectionData.id });
        
        if (existingCollection && !force) {
          console.log(`[import-collections] Collection ${collectionData.id} already exists, skipping`);
          stats.collectionsSkipped++;
          continue;
        }
        
        // Create or update the collection
        const collection = existingCollection || new Collection({
          id: collectionData.id,
          name: collectionData.name,
          description: collectionData.description,
          coverImage: collectionData.coverImage,
          metadata: collectionData.metadata,
          tracks: []
        });
        
        // Update collection fields if it exists
        if (existingCollection) {
          collection.name = collectionData.name;
          collection.description = collectionData.description;
          collection.coverImage = collectionData.coverImage;
          collection.metadata = collectionData.metadata;
        }
        
        // Save the collection to get an _id
        await collection.save();
        stats.collectionsImported++;
        
        // Process tracks
        if (collectionData.tracks && Array.isArray(collectionData.tracks)) {
          console.log(`[import-collections] Processing ${collectionData.tracks.length} tracks for collection ${collectionData.id}`);
          
          for (const trackData of collectionData.tracks) {
            stats.tracksProcessed++;
            
            try {
              // Create a unique track ID if not provided
              const trackId = trackData.id || `${collectionData.id}_${trackData.title.replace(/\s+/g, '_').toLowerCase()}`;
              
              // Check if track already exists
              const existingTrack = await Track.findOne({ 
                id: trackId,
                collectionId: collection._id 
              });
              
              if (existingTrack && !force) {
                console.log(`[import-collections] Track ${trackId} already exists, skipping`);
                stats.tracksSkipped++;
                continue;
              }
              
              // Determine layer type based on track title or data
              let layerType = 'drone'; // Default
              if (trackData.title.toLowerCase().includes('melody')) {
                layerType = 'melody';
              } else if (trackData.title.toLowerCase().includes('rhythm')) {
                layerType = 'rhythm';
              } else if (trackData.title.toLowerCase().includes('nature')) {
                layerType = 'nature';
              } else if (trackData.layerType) {
                layerType = trackData.layerType;
              }
              
              // Format variations if they exist
              const variations = trackData.variations || [];
              
              // Create or update the track
              const track = existingTrack || new Track({
                id: trackId,
                title: trackData.title,
                audioUrl: trackData.audioUrl,
                layerType,
                variations,
                collectionId: collection._id
              });
              
              // Update track fields if it exists
              if (existingTrack) {
                track.title = trackData.title;
                track.audioUrl = trackData.audioUrl;
                track.layerType = layerType;
                track.variations = variations;
              }
              
              // Save the track
              await track.save();
              stats.tracksImported++;
              
              // Add track to collection if it's not already there
              if (!collection.tracks.includes(track._id)) {
                collection.tracks.push(track._id);
              }
              
            } catch (trackError) {
              console.error(`[import-collections] Error processing track ${trackData.title}:`, trackError);
              stats.errors.push({
                type: 'track',
                collectionId: collectionData.id,
                trackTitle: trackData.title,
                error: trackError.message
              });
            }
          }
          
          // Save the collection again with updated tracks
          await collection.save();
        }
        
      } catch (collectionError) {
        console.error(`[import-collections] Error processing collection ${collectionData.id}:`, collectionError);
        stats.errors.push({
          type: 'collection',
          collectionId: collectionData.id,
          error: collectionError.message
        });
      }
    }
    
    console.log('[import-collections] Import completed with stats:', stats);
    return stats;
    
  } catch (error) {
    console.error('[import-collections] Fatal error during import:', error);
    stats.errors.push({
      type: 'fatal',
      error: error.message
    });
    return stats;
  } finally {
    // Close the MongoDB connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('[import-collections] MongoDB connection closed');
    }
  }
}

/**
 * Load individual collection metadata file
 * @param {string} collectionId - Collection ID
 * @returns {Object|null} - Collection metadata or null if not found
 */
function loadCollectionMetadata(collectionId) {
  try {
    const metadataPath = path.join(process.cwd(), 'public', 'collections', collectionId, 'metadata.json');
    
    if (!fs.existsSync(metadataPath)) {
      console.warn(`[import-collections] No metadata file found for collection ${collectionId}`);
      return null;
    }
    
    return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch (error) {
    console.error(`[import-collections] Error loading metadata for collection ${collectionId}:`, error);
    return null;
  }
}

// Export the functions
module.exports = {
  importCollections,
  loadCollectionMetadata
};