const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Script to generate metadata.json files for audio collections
 * 
 * IMPORTANT: All paths in metadata.json should be relative paths without /collections/collectionName/ prefix
 * - Audio URLs should be format: "Layer_1/track.mp3" (not "/collections/CollectionName/Layer_1/track.mp3")
 * - Cover images should be format: "cover/image.jpg" (not "/collections/CollectionName/cover/image.jpg")
 * 
 * The CollectionService will handle adding the appropriate prefix when loading these resources.
 */

// Configuration
const COLLECTIONS_DIR = path.join(__dirname, '../public/collections');

// Helper function to format track name
function formatTrackName(filename) {
  return filename
    .replace(/\.mp3$/, '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Helper to generate a unique ID
function generateUniqueId(collectionName, seed = Date.now()) {
  // First try to create a URL-friendly version of the name
  const urlFriendlyName = collectionName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  // If the name is valid and at least 3 chars, use it as the ID
  if (urlFriendlyName.length >= 3) {
    return urlFriendlyName;
  }
  
  // Otherwise generate a hash-based ID
  const hash = crypto
    .createHash('md5')
    .update(`${collectionName}-${seed}`)
    .digest('hex')
    .substring(0, 8);
  
  return `collection-${hash}`;
}

// Generate metadata for a collection
function generateCollectionMetadata(collectionDir, options = {}) {
  const { forceId = null, forceOverwrite = false } = options;
  const collectionFolder = path.basename(collectionDir);
  
  // Check if metadata file already exists and we're not forcing overwrite
  const metadataPath = path.join(collectionDir, 'metadata.json');
  if (fs.existsSync(metadataPath) && !forceOverwrite) {
    console.log(`[generateCollectionMetadata.js] Metadata already exists for ${collectionFolder}, skipping. Use --force to overwrite.`);
    
    // Still read and return the existing metadata
    try {
      const existingMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      return existingMetadata;
    } catch (err) {
      console.warn(`[generateCollectionMetadata.js] Error reading existing metadata: ${err.message}`);
      console.log(`[generateCollectionMetadata.js] Will generate new metadata for ${collectionFolder}`);
    }
  }
  
  // Determine collection ID (either from forced value, collectionFolder, or generate a new one)
  let collectionId = forceId || collectionFolder;
  
  // Create metadata structure
  const metadata = {
    id: collectionId,
    name: collectionFolder.charAt(0).toUpperCase() + collectionFolder.slice(1).replace(/-/g, ' '),
    description: `A collection of ambient audio tracks for ${collectionFolder.toLowerCase()}`,
    coverImage: null,
    metadata: {
      artist: "Ensō Audio",
      year: new Date().getFullYear(),
      tags: ["ambient", "meditation", "peaceful", "soundscape"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    },
    tracks: []
  };

  console.log(`[generateCollectionMetadata.js] Processing collection: ${collectionFolder}`);
  
  // Process all files in the collection directory
  const layerFolders = ['Layer_1', 'Layer_2', 'Layer_3', 'Layer_4'];
  
  // Process cover images first
  const coverDir = path.join(collectionDir, 'cover');
  if (fs.existsSync(coverDir)) {
    try {
      const coverFiles = fs.readdirSync(coverDir);
      for (const file of coverFiles) {
        const ext = path.extname(file).toLowerCase();
        if (['.jpg', '.jpeg', '.png'].includes(ext)) {
          // Store as relative path from collection root
          metadata.coverImage = `cover/${file}`;
          console.log(`[generateCollectionMetadata.js] Found cover image: ${file}`);
          break; // Just use the first image found
        }
      }
    } catch (err) {
      console.warn(`[generateCollectionMetadata.js] Error reading cover directory: ${err.message}`);
    }
  }
  
  // Process each layer folder
  for (const layerFolder of layerFolders) {
    const layerPath = path.join(collectionDir, layerFolder);
    if (!fs.existsSync(layerPath)) {
      console.log(`[generateCollectionMetadata.js] Layer folder not found: ${layerFolder}`);
      continue;
    }
    
    try {
      console.log(`[generateCollectionMetadata.js] Processing layer folder: ${layerFolder}`);
      const files = fs.readdirSync(layerPath);
      const mp3Files = files.filter(file => file.endsWith('.mp3'));
      
      if (mp3Files.length === 0) {
        console.log(`[generateCollectionMetadata.js] No MP3 files found in: ${layerFolder}`);
        continue;
      }
      
      // Find the main track (either named same as folder or first mp3)
      const mainFileName = mp3Files.find(file => 
        file.toLowerCase() === `${layerFolder.toLowerCase()}.mp3`
      ) || mp3Files[0];
      
      // Generate unique track ID
      const trackId = `${layerFolder.toLowerCase()}`;
      
      // Create the main track entry
      const trackEntry = {
        id: trackId,
        title: formatTrackName(mainFileName),
        // Store relative path - key change
        audioUrl: `${layerFolder}/${mainFileName}`,
        layerFolder: layerFolder,
        variations: []
      };
      
      // Add variations (all other MP3s in the folder)
      const variationFiles = mp3Files.filter(file => file !== mainFileName);
      
      if (variationFiles.length > 0) {
        console.log(`[generateCollectionMetadata.js] Found ${variationFiles.length} variations for ${layerFolder}`);
        
        for (let i = 0; i < variationFiles.length; i++) {
          const varFile = variationFiles[i];
          // Create variation ID based on file naming pattern if available
          let variationId;
          
          if (varFile.includes('_')) {
            // Use existing numbering from filename (e.g. "drone_01.mp3" -> "layer_1-01")
            const suffix = varFile.replace(/.*_(\d+)\.mp3$/i, '$1');
            if (suffix && suffix !== varFile) {
              variationId = `${trackId}-${suffix}`;
            } else {
              variationId = `${trackId}-${i + 1}`;
            }
          } else {
            // Simple sequential numbering
            variationId = `${trackId}-${i + 1}`;
          }
          
          trackEntry.variations.push({
            id: variationId,
            title: formatTrackName(varFile),
            // Store relative path - key change
            audioUrl: `${layerFolder}/${varFile}`
          });
        }
      }
      
      metadata.tracks.push(trackEntry);
      
    } catch (err) {
      console.warn(`[generateCollectionMetadata.js] Error processing layer ${layerFolder}: ${err.message}`);
    }
  }
  
  console.log(`[generateCollectionMetadata.js] Finished processing collection: ${collectionFolder}`);
  console.log(`[generateCollectionMetadata.js] Found ${metadata.tracks.length} tracks with a total of ${metadata.tracks.reduce((acc, track) => acc + (track.variations ? track.variations.length : 0), 0)} variations`);
  
  return metadata;
}

// Write metadata to file
function writeMetadataFile(collectionDir, metadata, options = {}) {
  const { forceOverwrite = false } = options;
  const metadataPath = path.join(collectionDir, 'metadata.json');
  
  if (fs.existsSync(metadataPath) && !forceOverwrite) {
    console.log(`[generateCollectionMetadata.js] Metadata file already exists at ${metadataPath}. Use --force to overwrite.`);
    return false;
  }
  
  try {
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`[generateCollectionMetadata.js] Successfully wrote metadata to ${metadataPath}`);
    return true;
  } catch (err) {
    console.error(`[generateCollectionMetadata.js] Error writing metadata: ${err.message}`);
    return false;
  }
}

// Main function
function main() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    const forceOverwrite = args.includes('--force');
    const allCollections = args.includes('--all');
    
    // Get collection to process
    let collectionId = args.find(arg => !arg.startsWith('--'));
    
    if (allCollections) {
      // Process all collection directories
      console.log(`[generateCollectionMetadata.js] Processing all collections in ${COLLECTIONS_DIR}`);
      
      const collectionDirs = fs.readdirSync(COLLECTIONS_DIR)
        .filter(name => {
          const fullPath = path.join(COLLECTIONS_DIR, name);
          return fs.statSync(fullPath).isDirectory() && name !== 'node_modules' && !name.startsWith('.');
        });
      
      console.log(`[generateCollectionMetadata.js] Found ${collectionDirs.length} collection directories`);
      
      let successCount = 0;
      
      for (const dir of collectionDirs) {
        const collectionDir = path.join(COLLECTIONS_DIR, dir);
        const metadata = generateCollectionMetadata(collectionDir, { forceOverwrite });
        
        if (metadata && metadata.tracks.length > 0) {
          const success = writeMetadataFile(collectionDir, metadata, { forceOverwrite });
          if (success) successCount++;
        }
      }
      
      console.log(`[generateCollectionMetadata.js] Successfully generated metadata for ${successCount} collections`);
      return;
    }
    
    if (!collectionId) {
      console.error('[generateCollectionMetadata.js] Please provide a collection ID to process or use --all flag');
      process.exit(1);
    }
    
    const collectionDir = path.join(COLLECTIONS_DIR, collectionId);
    if (!fs.existsSync(collectionDir) || !fs.statSync(collectionDir).isDirectory()) {
      console.error(`[generateCollectionMetadata.js] Collection directory not found: ${collectionDir}`);
      process.exit(1);
    }
    
    // Generate metadata
    const metadata = generateCollectionMetadata(collectionDir, { forceOverwrite });
    
    // Write metadata to file
    writeMetadataFile(collectionDir, metadata, { forceOverwrite });
    
  } catch (error) {
    console.error('[generateCollectionMetadata.js] Error generating metadata:', error);
    process.exit(1);
  }
}

// Only run main if this script is directly executed
if (require.main === module) {
  main();
}

// Export the function so it can be imported by other scripts
module.exports = {
  generateCollectionMetadata,
  writeMetadataFile
};
