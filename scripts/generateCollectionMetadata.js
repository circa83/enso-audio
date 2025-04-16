const fs = require('fs');
const path = require('path');

// Configuration
const COLLECTIONS_DIR = path.join(__dirname, '../public/collections');

// Helper function to format track name
function formatTrackName(filename) {
  return filename
    .replace(/\.mp3$/, '')
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Helper function to determine layer type from path
function getLayerType(filePath) {
  const pathParts = filePath.split('/');
  const layerDir = pathParts[pathParts.length - 2];
  return layerDir.toLowerCase();
}

// Generate metadata for a collection
function generateCollectionMetadata(collectionDir) {
  const collectionId = path.basename(collectionDir);
  const metadata = {
    id: collectionId,
    name: collectionId.charAt(0).toUpperCase() + collectionId.slice(1),
    description: `A collection of ambient audio tracks for ${collectionId.toLowerCase()}`,
    tracks: {
      drone: [],
      melody: [],
      rhythm: [],
      nature: []
    },
    coverImage: null
  };

  // Process all files in the collection
  function processFiles(dir) {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const itemPath = path.join(dir, item);
      const relativePath = path.relative(collectionDir, itemPath);
      
      if (fs.statSync(itemPath).isDirectory()) {
        processFiles(itemPath);
      } else {
        const ext = path.extname(item).toLowerCase();
        
        // Handle audio files
        if (ext === '.mp3') {
          const layerType = getLayerType(relativePath);
          if (metadata.tracks[layerType]) {
            metadata.tracks[layerType].push({
              id: `${collectionId}-${layerType}-${path.basename(item, '.mp3')}`,
              name: formatTrackName(item),
              audioUrl: `collections/${collectionId}/${relativePath}`,
              duration: 0 // You might want to add duration calculation
            });
          }
        }
        
        // Handle cover image
        if (['.jpg', '.jpeg', '.png'].includes(ext) && 
            item.toLowerCase().includes('cover')) {
          metadata.coverImage = `collections/${collectionId}/${relativePath}`;
        }
      }
    });
  }

  processFiles(collectionDir);
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
    const metadataPath = path.join(collectionDir, 'index.json');
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

main(); 