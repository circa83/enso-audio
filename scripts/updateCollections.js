// scripts/updateCollections.js
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

// Define paths
const collectionsDir = path.join(__dirname, '../public/collections');
const collectionsFile = path.join(collectionsDir, 'collections.json');

// Function to read existing collections.json file
const readExistingCollections = () => {
  try {
    if (fs.existsSync(collectionsFile)) {
      const data = fs.readFileSync(collectionsFile, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (err) {
    console.error('[updateCollections] Error reading collections.json:', err);
    return [];
  }
};

// Function to read metadata from a collection folder
const readCollectionMetadata = (folderName) => {
  const metadataPath = path.join(collectionsDir, folderName, 'metadata.json');
  
  try {
    if (fs.existsSync(metadataPath)) {
      const data = fs.readFileSync(metadataPath, 'utf8');
      console.log(`[updateCollections] Found metadata file for ${folderName}`);
      return JSON.parse(data);
    } else {
      console.log(`[updateCollections] No metadata.json found for ${folderName}, checking collection structure`);
      
      // Check if collection has the expected structure
      const hasRequiredFolders = checkCollectionStructure(folderName);
      
      if (hasRequiredFolders) {
        console.log(`[updateCollections] Structure validation passed for ${folderName}, generating basic metadata`);
        // Create a basic metadata entry
        return {
          id: folderName,
          name: folderName.charAt(0).toUpperCase() + folderName.slice(1).replace(/-/g, ' '),
          description: `A collection of ambient layers for ${folderName.toLowerCase()}`,
          coverImage: findCoverImage(folderName),
          metadata: {
            artist: "Ensō Audio",
            year: new Date().getFullYear(),
            tags: ["ambient", "meditation", "peaceful", "soundscape"]
          },
          tracks: [] // Empty tracks array will be filled when generateCollectionMetadata.js is run
        };
      } else {
        console.log(`[updateCollections] Structure validation failed for ${folderName}, skipping`);
        return null;
      }
    }
  } catch (err) {
    console.error(`[updateCollections] Error reading metadata for ${folderName}:`, err);
    return null;
  }
};

// Function to check if a collection has the required folder structure
const checkCollectionStructure = (folderName) => {
  // Check if at least one of Layer_1, Layer_2, etc. exists
  const collectionPath = path.join(collectionsDir, folderName);
  const layerFolders = ['Layer_1', 'Layer_2', 'Layer_3', 'Layer_4'];
  
  // At least one layer folder should exist for a valid collection
  return layerFolders.some(layer => {
    const layerPath = path.join(collectionPath, layer);
    return fs.existsSync(layerPath) && fs.statSync(layerPath).isDirectory();
  });
};

// Function to find a cover image in the collection
const findCoverImage = (folderName) => {
  const coverDir = path.join(collectionsDir, folderName, 'cover');
  
  if (fs.existsSync(coverDir) && fs.statSync(coverDir).isDirectory()) {
    try {
      const files = fs.readdirSync(coverDir);
      
      // Look for image files
      const imageFile = files.find(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
      });
      
      if (imageFile) {
        return `/collections/${folderName}/cover/${imageFile}`;
      }
    } catch (err) {
      console.error(`[updateCollections] Error reading cover directory for ${folderName}:`, err);
    }
  }
  
  return null; // No cover image found
};

// Function to check if a path is a collection directory
const isCollectionDirectory = (dirPath) => {
  try {
    return fs.statSync(dirPath).isDirectory() && 
           path.basename(dirPath) !== 'assets' &&
           !path.basename(dirPath).startsWith('.');
  } catch (err) {
    return false;
  }
};

// Function to update collections.json
const updateCollectionsJson = () => {
  try {
    // Get all directories in the collections folder
    const files = fs.readdirSync(collectionsDir);
    
    // Filter for collection folders
    const collectionFolders = files.filter(file => {
      const fullPath = path.join(collectionsDir, file);
      return isCollectionDirectory(fullPath);
    });
    
    console.log(`[updateCollections] Found ${collectionFolders.length} collection folders`);
    
    // Get existing collections from collections.json
    const existingCollections = readExistingCollections();
    const existingCollectionsMap = new Map(
      existingCollections.map(collection => [collection.id, collection])
    );
    
    // Process each collection folder and gather metadata
    const updatedCollections = [];
    
    for (const folder of collectionFolders) {
      const metadata = readCollectionMetadata(folder);
      
      if (metadata) {
        // Update existing entry or add new one
        updatedCollections.push(metadata);
        console.log(`[updateCollections] Added collection: ${metadata.name}`);
      }
    }
    
    // Write the updated collections to the JSON file
    fs.writeFileSync(collectionsFile, JSON.stringify(updatedCollections, null, 2));
    
    console.log(`[updateCollections] ✅ collections.json has been updated with ${updatedCollections.length} collections!`);
    
    // Log added or removed collections
    const newCollections = updatedCollections.filter(c => !existingCollectionsMap.has(c.id));
    const removedCollections = existingCollections.filter(c => 
      !updatedCollections.some(uc => uc.id === c.id)
    );
    
    if (newCollections.length > 0) {
      console.log(`[updateCollections] 📁 Added new collections: ${newCollections.map(c => c.name).join(', ')}`);
    }
    
    if (removedCollections.length > 0) {
      console.log(`[updateCollections] 🗑️ Removed collections: ${removedCollections.map(c => c.name).join(', ')}`);
    }
    
    return updatedCollections;
  } catch (err) {
    console.error('[updateCollections] Error updating collections.json:', err);
    return [];
  }
};

// Initial update
console.log('[updateCollections] 🔄 Initializing collections.json...');
updateCollectionsJson();

// Watch the collections directory for changes
console.log('[updateCollections] 👀 Watching collections directory for changes...');

const watcher = chokidar.watch(collectionsDir, {
  persistent: true,
  ignoreInitial: true,
  ignored: [
    '**/node_modules/**',
    '**/.git/**',
    // Ignore collections.json itself to prevent circular updates
    path.join(collectionsDir, 'collections.json')
  ],
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 100
  }
});

watcher
  .on('addDir', (changedPath) => {
    // Only process changes at the collection root level or metadata.json changes
    if (path.dirname(changedPath) === collectionsDir || 
        path.basename(changedPath) === 'metadata.json') {
      console.log(`[updateCollections] 📂 New folder added: ${changedPath}`);
      updateCollectionsJson();
    }
  })
  .on('change', (changedPath) => {
    // Only process metadata.json changes
    if (path.basename(changedPath) === 'metadata.json') {
      console.log(`[updateCollections] 🔄 Metadata file changed: ${changedPath}`);
      updateCollectionsJson();
    }
  })
  .on('unlink', (changedPath) => {
    // Only process metadata.json removals
    if (path.basename(changedPath) === 'metadata.json') {
      console.log(`[updateCollections] 🗑️ Metadata file removed: ${changedPath}`);
      updateCollectionsJson();
    }
  })
  .on('unlinkDir', (changedPath) => {
    // Only process collection directory removals
    if (path.dirname(changedPath) === collectionsDir) {
      console.log(`[updateCollections] 🗑️ Directory removed: ${changedPath}`);
      updateCollectionsJson();
    }
  })
  .on('error', (error) => {
    console.error('[updateCollections] ❌ Watcher error:', error);
  });

console.log('[updateCollections] 🚀 Collections watcher is now running. Press Ctrl+C to stop.');

// Allow direct execution
if (require.main === module) {
  // The script is already running at this point
} else {
  // Export functions for potential use in other scripts
  module.exports = {
    updateCollectionsJson,
    readCollectionMetadata
  };
}