// updateImports.js
// A Node.js script to update import paths after file reorganization
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Path mapping from old to new
const pathMapping = {
  // Components
  '../components/Player': '../components/player/Player',
  '../components/Library': '../components/library/Library',
  '../components/TapePlayerGraphic': '../components/player/TapePlayerGraphic',
  '../components/audio/JourneyGuide': '../components/player/JourneyGuide',
  '../components/audio/PlayerControlPanel': '../components/player/PlayerControlPanel',
  '../components/audio/PresetManager': '../components/player/PresetManager',
  '../components/audio/SessionSettings': '../components/player/SessionSettings',
  '../components/audio/SessionTimer': '../components/player/SessionTimer',
  '../components/audio/SessionTimeline': '../components/player/SessionTimeline',
  '../components/audio/PhaseMarker': '../components/player/PhaseMarker',
  '../components/audio/TimelineDebugPanel': '../components/player/TimelineDebugPanel',
  '../components/LoadingScreen': '../components/loading/LoadingScreen',
  
  // Contexts
  '../contexts/StreamingAudioContext': '../contexts/AudioContext',
  
  // Service imports
  '../services/audio/PresetManager': '../services/storage/PresetManager',
  
  // Style imports
  '../styles/App.css': '../styles/globals/App.css',
  '../styles/globals.css': '../styles/globals/globals.css',
  '../styles/index.css': '../styles/globals/index.css',
  '../SimplePlayerDark.css': '../styles/components/SimplePlayer.css',
};

// Absolute path mapping for path aliases (if needed)
const absolutePathMapping = {
  '@/components/Player': '@/components/player/Player',
  '@/components/Library': '@/components/library/Library',
  // Add more as needed
};

// Get all JavaScript and TypeScript files
const getAllFiles = () => {
  return [
    ...glob.sync('src/**/*.js'),
    ...glob.sync('src/**/*.jsx'),
    ...glob.sync('src/**/*.ts'),
    ...glob.sync('src/**/*.tsx')
  ];
};

// Update imports in a file
const updateFileImports = (filePath) => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;
    
    // Check if file contains any imports that need updating
    const importRegex = /import\s+(?:{[^}]*}|\*\s+as\s+[^\s;]+|[^\s;,]+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      
      // Check relative path mappings
      for (const [oldPath, newPath] of Object.entries(pathMapping)) {
        if (importPath === oldPath || importPath.endsWith(`/${oldPath}`)) {
          const updatedImport = match[0].replace(importPath, newPath);
          content = content.replace(match[0], updatedImport);
          updated = true;
          console.log(`Updated in ${filePath}: ${importPath} -> ${newPath}`);
        }
      }
      
      // Check absolute path mappings
      for (const [oldPath, newPath] of Object.entries(absolutePathMapping)) {
        if (importPath === oldPath) {
          const updatedImport = match[0].replace(importPath, newPath);
          content = content.replace(match[0], updatedImport);
          updated = true;
          console.log(`Updated in ${filePath}: ${importPath} -> ${newPath}`);
        }
      }
    }
    
    // Only write file if changes were made
    if (updated) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return false;
  }
};

// Main function
const main = () => {
  console.log('Starting import path updates...');
  
  const files = getAllFiles();
  console.log(`Found ${files.length} files to process`);
  
  let updatedFilesCount = 0;
  
  files.forEach(file => {
    const updated = updateFileImports(file);
    if (updated) {
      updatedFilesCount++;
    }
  });
  
  console.log(`Completed! Updated imports in ${updatedFilesCount} files.`);
};

// Run the script
main();
