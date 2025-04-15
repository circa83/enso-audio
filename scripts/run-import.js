// scripts/run-import.js
const { importCollections } = require('./import-collections');

// Parse command line arguments
const args = process.argv.slice(2);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');

console.log('========================================');
console.log('Ensō Audio - Collection Import Utility');
console.log('========================================');
console.log('Starting import with options:');
console.log(`- Force update: ${force ? 'Yes' : 'No'}`);
console.log(`- Dry run: ${dryRun ? 'Yes' : 'No'}`);
console.log('----------------------------------------');

// Run the import
importCollections(force)
  .then(stats => {
    console.log('Import complete!');
    console.log('----------------------------------------');
    console.log('Import statistics:');
    console.log(`- Collections processed: ${stats.collectionsProcessed}`);
    console.log(`- Collections imported: ${stats.collectionsImported}`);
    console.log(`- Collections skipped: ${stats.collectionsSkipped}`);
    console.log(`- Tracks processed: ${stats.tracksProcessed}`);
    console.log(`- Tracks imported: ${stats.tracksImported}`);
    console.log(`- Tracks skipped: ${stats.tracksSkipped}`);
    
    if (stats.errors.length > 0) {
      console.log(`Errors encountered (${stats.errors.length}):`);
      stats.errors.forEach((err, index) => {
        console.log(`  ${index + 1}. [${err.type}] ${err.collectionId || ''}: ${err.error}`);
      });
    }
    
    console.log('----------------------------------------');
    console.log('Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error running import:', error);
    process.exit(1);
  });