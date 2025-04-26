// scripts/updateCollections.js
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { generateCollectionMetadata, writeMetadataFile } = require('./generateCollectionMetadata');

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
      
      // Parse and normalize the JSON data
      const metadata = JSON.parse(data);
      
      // Ensure the ID matches the folder name for consistency
      if (metadata.id !== folderName) {
        console.log(`[updateCollections] Fixing inconsistent ID for ${folderName}: changing ${metadata.id} to ${folderName}`);
        metadata.id = folderName;
      }
      
      // Update the updatedAt timestamp
      if (metadata.metadata) {
        metadata.metadata.updatedAt = new Date().toISOString();
      }
      
      return metadata;
    } else {
      console.log(`[updateCollections] No metadata.json found for ${folderName}, generating new metadata`);
      
      // Generate new metadata for this collection
      const generatedMetadata = generateCollectionMetadata(path.join(collectionsDir, folderName));
      
      // Write the generated metadata to file
      writeMetadataFile(path.join(collectionsDir, folderName), generatedMetadata);
      return generatedMetadata;
    }
  } catch (err) {
    console.error(`[updateCollections] Error reading metadata for ${folderName}:`, err);
    return null;
  }
};

// Function to update the collections.json file
const updateCollectionsFile = () => {
  console.log('[updateCollections] Updating collections.json file...');
  
  try {
    // Get all collection directories
    const folders = fs.readdirSync(collectionsDir)
      .filter(item => {
        const fullPath = path.join(collectionsDir, item);
        return fs.statSync(fullPath).isDirectory() && 
               !item.startsWith('.') && 
               item !== 'node_modules';
      });
    
    console.log(`[updateCollections] Found ${folders.length} collection folders`);
    
    // Read metadata from each collection folder
    const metadataList = [];
    const idMap = new Map(); // Track IDs to prevent duplicates
    
    for (const folder of folders) {
      const metadata = readCollectionMetadata(folder);
      
      if (metadata) {
        const existingIndex = idMap.get(metadata.id);
        
        if (existingIndex !== undefined) {
          console.warn(`[updateCollections] Duplicate collection ID detected: ${metadata.id}`);
          console.warn(`[updateCollections] First occurrence in folder: ${folders[existingIndex]}`);
          console.warn(`[updateCollections] Second occurrence in folder: ${folder}`);
          
          // Rename the second occurrence to avoid conflicts
          const newId = `${metadata.id}-${Date.now().toString().slice(-6)}`;
          console.warn(`[updateCollections] Changing duplicate ID to: ${newId}`);
          
          metadata.id = newId;
          
          // Update the metadata file with the new ID
          const metadataPath = path.join(collectionsDir, folder, 'metadata.json');
          fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        }
        
        // Add to our collections list and track the ID
        metadataList.push(metadata);
        idMap.set(metadata.id, metadataList.length - 1);
      }
    }
    
    // Create a summary version for collections.json
    // This includes only essential metadata, not full track details
    const collectionsData = metadataList.map(metadata => ({
      id: metadata.id,
      name: metadata.name,
      description: metadata.description,
      coverImage: metadata.coverImage,
      trackCount: metadata.tracks?.length || 0,
      variationCount: metadata.tracks?.reduce((count, track) => 
        count + (track.variations?.length || 0), 0) || 0,
      tags: metadata.metadata?.tags || [],
      artist: metadata.metadata?.artist || 'Ensō Audio',
      year: metadata.metadata?.year || new Date().getFullYear(),
      updatedAt: metadata.metadata?.updatedAt || new Date().toISOString()
    }));
    
    // Write the collections.json file
    fs.writeFileSync(collectionsFile, JSON.stringify({ 
      collections: collectionsData,
      updatedAt: new Date().toISOString(),
      count: collectionsData.length
    }, null, 2));
    
    console.log(`[updateCollections] Successfully updated collections.json with ${collectionsData.length} collections`);
    return true;
  } catch (err) {
    console.error('[updateCollections] Error updating collections.json:', err);
    return false;
  }
};

// Watch for changes in collection directories
const watchCollections = () => {
  console.log(`[updateCollections] Starting to watch collections directory: ${collectionsDir}`);
  
  // First, ensure we have an up-to-date collections.json file
  updateCollectionsFile();
  
  // Set up file watcher
  const watcher = chokidar.watch([
    path.join(collectionsDir, '*/'),         // Watch for new collection folders
    path.join(collectionsDir, '*/metadata.json') // Watch for changes to metadata files
  ], {
    persistent: true,
    ignoreInitial: true,
    ignored: [
      /(^|[\/\\])\../, // Ignore dotfiles
      '**/node_modules/**', // Ignore node_modules
      collectionsFile // Ignore collections.json itself to avoid loops
    ],
    depth: 2 // Only watch up to depth 2 (collections dir → collection folder → files)
  });
  
  // Handle file events
  watcher
    .on('add', filePath => {
      console.log(`[updateCollections] File added: ${filePath}`);
      if (filePath.endsWith('metadata.json')) {
        updateCollectionsFile();
      }
    })
    .on('change', filePath => {
      console.log(`[updateCollections] File changed: ${filePath}`);
      if (filePath.endsWith('metadata.json')) {
        updateCollectionsFile();
      }
    })
    .on('unlink', filePath => {
      console.log(`[updateCollections] File removed: ${filePath}`);
      if (filePath.endsWith('metadata.json')) {
        updateCollectionsFile();
      }
    })
    .on('addDir', dirPath => {
      console.log(`[updateCollections] Directory added: ${dirPath}`);
      // Only trigger for collection directories, not subdirectories
      if (path.dirname(dirPath) === collectionsDir) {
        updateCollectionsFile();
      }
    })
    .on('unlinkDir', dirPath => {
      console.log(`[updateCollections] Directory removed: ${dirPath}`);
      // Only trigger for collection directories, not subdirectories
      if (path.dirname(dirPath) === collectionsDir) {
        updateCollectionsFile();
      }
    })
    .on('error', error => {
      console.error(`[updateCollections] Watcher error: ${error}`);
    })
    .on('ready', () => {
      console.log('[updateCollections] Initial scan complete, watching for changes...');
    });
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('[updateCollections] Stopping file watcher...');
    watcher.close().then(() => {
      console.log('[updateCollections] Watcher closed, exiting.');
      process.exit(0);
    });
  });
};

// Main function
const main = () => {
  // Get command line arguments
  const args = process.argv.slice(2);
  const watchMode = args.includes('--watch');
  
  // Create collections.json file if it doesn't exist
  if (!fs.existsSync(collectionsFile)) {
    fs.writeFileSync(collectionsFile, JSON.stringify({ collections: [], updatedAt: new Date().toISOString(), count: 0 }, null, 2));
    console.log('[updateCollections] Created initial collections.json file');
  }
  
  if (watchMode) {
    watchCollections();
  } else {
    // Just update the collections file once
    updateCollectionsFile();
  }
};

// Only run main if this script is directly executed
if (require.main === module) {
  main();
}

// Export functions for use in other scripts
module.exports = {
  updateCollectionsFile,
  readCollectionMetadata
};

