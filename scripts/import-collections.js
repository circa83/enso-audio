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
    // Read the collections directory to find all collection folders
    const collectionsDir = path.join(process.cwd(), 'public', 'collections');
    console.log(`[import-collections] Scanning collections directory: ${collectionsDir}`);
    
    if (!fs.existsSync(collectionsDir)) {
      throw new Error(`Collections directory not found at: ${collectionsDir}`);
    }
    
    // Get all directories in the collections folder
    const collectionFolders = fs.readdirSync(collectionsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .filter(name => name !== 'assets' && !name.startsWith('.')); // Exclude non-collection directories
    
    console.log(`[import-collections] Found ${collectionFolders.length} potential collection folders`);
    
    // Process each collection folder
    for (const collectionId of collectionFolders) {
      stats.collectionsProcessed++;
      
      try {
        console.log(`[import-collections] Processing collection: ${collectionId}`);
        
        // Load collection metadata from the individual metadata.json file
        const collectionData = loadCollectionMetadata(collectionId);
        
        if (!collectionData) {
          console.log(`[import-collections] No valid metadata found for collection ${collectionId}, skipping`);
          stats.collectionsSkipped++;
          continue;
        }
        
        // Check if collection already exists
        const existingCollection = await Collection.findOne({ id: collectionId });
        
        if (existingCollection && !force) {
          console.log(`[import-collections] Collection ${collectionId} already exists, skipping`);
          stats.collectionsSkipped++;
          continue;
        }
        
        // Create or update the collection
        const collection = existingCollection || new Collection({
          id: collectionId,
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
          console.log(`[import-collections] Processing ${collectionData.tracks.length} tracks for collection ${collectionId}`);
          
          for (const trackData of collectionData.tracks) {
            stats.tracksProcessed++;
            
            try {
              // Use the track ID from metadata or create one
              const trackId = trackData.id || `${collectionId}_${trackData.title.replace(/\s+/g, '_').toLowerCase()}`;
              
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
              
              // Get layer folder from the track data
              // This is now our primary organization method
              const layerFolder = trackData.layerFolder || determineLayerFolder(trackData);
              
              // Format variations if they exist
              const variations = trackData.variations || [];
              
              // Create or update the track
              const track = existingTrack || new Track({
                id: trackId,
                title: trackData.title,
                audioUrl: trackData.audioUrl,
                layerFolder: layerFolder,  // Use layerFolder instead of layerType
                variations: variations,
                collectionId: collection._id
              });
              
              // Update track fields if it exists
              if (existingTrack) {
                track.title = trackData.title;
                track.audioUrl = trackData.audioUrl;
                track.layerFolder = layerFolder;
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
                collectionId: collectionId,
                trackTitle: trackData.title,
                error: trackError.message
              });
            }
          }
          
          // Save the collection again with updated tracks
          await collection.save();
        }
        
      } catch (collectionError) {
        console.error(`[import-collections] Error processing collection ${collectionId}:`, collectionError);
        stats.errors.push({
          type: 'collection',
          collectionId: collectionId,
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

/**
 * Determine layer folder based on track data
 * @param {Object} trackData - Track metadata
 * @returns {string} - Layer folder (Layer_1, Layer_2, etc.)
 */
function determineLayerFolder(trackData) {
  // First check if we can determine from the URL
  if (trackData.audioUrl) {
    const url = trackData.audioUrl.toLowerCase();
    
    // Check if URL contains layer folder information
    if (url.includes('/layer_1/')) return 'Layer_1';
    if (url.includes('/layer_2/')) return 'Layer_2';
    if (url.includes('/layer_3/')) return 'Layer_3';
    if (url.includes('/layer_4/')) return 'Layer_4';
  }
  
  // Check track ID if available
  if (trackData.id) {
    const id = trackData.id.toLowerCase();
    if (id.startsWith('layer_1') || id === 'layer1') return 'Layer_1';
    if (id.startsWith('layer_2') || id === 'layer2') return 'Layer_2';
    if (id.startsWith('layer_3') || id === 'layer3') return 'Layer_3';
    if (id.startsWith('layer_4') || id === 'layer4') return 'Layer_4';
  }
  
  // Fallback based on track title (less reliable)
  if (trackData.title) {
    const title = trackData.title.toLowerCase();
    if (title.includes('layer 1') || title.includes('layer1')) return 'Layer_1';
    if (title.includes('layer 2') || title.includes('layer2')) return 'Layer_2';
    if (title.includes('layer 3') || title.includes('layer3')) return 'Layer_3';
    if (title.includes('layer 4') || title.includes('layer4')) return 'Layer_4';
  }
  
  // Default to Layer_1 if we can't determine
  return 'Layer_1';
}

// If this script is run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');
  
  if (dryRun) {
    console.log('[import-collections] DRY RUN: No data will be written to the database');
    console.log('[import-collections] Scanning collections...');
    
    // Just print the collections that would be imported
    const collectionsDir = path.join(process.cwd(), 'public', 'collections');
    if (fs.existsSync(collectionsDir)) {
      const collectionFolders = fs.readdirSync(collectionsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => name !== 'assets' && !name.startsWith('.'));
      
      console.log(`Found ${collectionFolders.length} collections to process:`);
      
      for (const collectionId of collectionFolders) {
        const metadata = loadCollectionMetadata(collectionId);
        if (metadata) {
          console.log(`- ${collectionId}: ${metadata.name} (${metadata.tracks?.length || 0} tracks)`);
        } else {
          console.log(`- ${collectionId}: No valid metadata found`);
        }
      }
    } else {
      console.error(`Collections directory not found at: ${collectionsDir}`);
    }
  } else {
    // Run the import
    importCollections(force)
      .then(stats => {
        console.log('Import completed successfully with stats:', stats);
        process.exit(0);
      })
      .catch(error => {
        console.error('Import failed:', error);
        process.exit(1);
      });
  }
}

// Export the functions
module.exports = {
  importCollections,
  loadCollectionMetadata
};