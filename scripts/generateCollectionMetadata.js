const fs = require('fs');
const path = require('path');

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

// Generate metadata for a collection
function generateCollectionMetadata(collectionDir) {
  const collectionId = path.basename(collectionDir);
  
  // Create metadata structure
  const metadata = {
    id: collectionId,
    name: collectionId.charAt(0).toUpperCase() + collectionId.slice(1),
    description: `A collection of ambient audio tracks for ${collectionId.toLowerCase()}`,
    coverImage: null,
    metadata: {
      artist: "Ensō Audio",
      year: 2025,
      tags: ["ambient", "meditation", "peaceful", "soundscape"]
    },
    tracks: []
  };

  console.log(`[generateCollectionMetadata.js] Processing collection: ${collectionId}`);
  
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
          metadata.coverImage = `/collections/${collectionId}/cover/${file}`;
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
      
      // Create the main track entry
      const trackEntry = {
        id: layerFolder.toLowerCase(),
        title: formatTrackName(mainFileName),
        audioUrl: `/collections/${collectionId}/${layerFolder}/${mainFileName}`,
        layerFolder: layerFolder,  // Store the layer folder instead of a "type"
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
              variationId = `${layerFolder.toLowerCase()}-${suffix}`;
            } else {
              variationId = `${layerFolder.toLowerCase()}-${i + 1}`;
            }
          } else {
            // Simple sequential numbering
            variationId = `${layerFolder.toLowerCase()}-${i + 1}`;
          }
          
          trackEntry.variations.push({
            id: variationId,
            title: formatTrackName(varFile),
            audioUrl: `/collections/${collectionId}/${layerFolder}/${varFile}`
          });
        }
      }
      
      metadata.tracks.push(trackEntry);
      
    } catch (err) {
      console.warn(`[generateCollectionMetadata.js] Error processing layer ${layerFolder}: ${err.message}`);
    }
  }
  
  console.log(`[generateCollectionMetadata.js] Finished processing collection: ${collectionId}`);
  console.log(`[generateCollectionMetadata.js] Found ${metadata.tracks.length} tracks with a total of ${metadata.tracks.reduce((acc, track) => acc + (track.variations ? track.variations.length : 0), 0)} variations`);
  
  return metadata;
}

// Main function
function main() {
  try {
    // Get collection to process (from command line argument)
    const collectionId = process.argv[2];
    if (!collectionId) {
      console.error('Please provide a collection ID to process');
      process.exit(1);
    }
    
    const collectionDir = path.join(COLLECTIONS_DIR, collectionId);
    if (!fs.existsSync(collectionDir)) {
      console.error(`Collection directory not found: ${collectionDir}`);
      process.exit(1);
    }
    
    // Generate metadata
    const metadata = generateCollectionMetadata(collectionDir);
    
    // Write metadata to file
    const metadataPath = path.join(collectionDir, 'metadata.json');
    fs.writeFileSync(
      metadataPath,
      JSON.stringify(metadata, null, 2)
    );
    
    console.log(`Generated metadata for ${collectionId} at ${metadataPath}`);
  } catch (error) {
    console.error('Error generating metadata:', error);
    process.exit(1);
  }
}

// Only run main if this script is directly executed
if (require.main === module) {
  main();
}

// Export the function so it can be imported by other scripts
module.exports = {
  generateCollectionMetadata
};