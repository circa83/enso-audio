const { list } = require('@vercel/blob');
const CollectionService = require('../src/services/CollectionService');
const AudioFileService = require('../src/services/AudioFileService');

// Configuration
const BLOB_BASE_URL = process.env.NEXT_PUBLIC_BLOB_BASE_URL || 'https://uggtzauwx9gzthtf.public.blob.vercel-storage.com';
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN ||'vercel_blob_rw_uGGTZAuWx9gzThtf_5bjgVxoV3Htb2IfhOvumTFI4CWHHIa';

/**
 * Test Vercel Blob Storage Integration
 */
async function testBlobIntegration() {
  console.log('\n=== Testing Vercel Blob Storage Integration ===\n');
  
  if (!BLOB_TOKEN) {
    console.error('❌ Error: BLOB_READ_WRITE_TOKEN environment variable is not set');
    return;
  }

  // Initialize services with logging enabled
  const collectionService = new CollectionService({
    enableLogging: true,
    blobBaseUrl: BLOB_BASE_URL
  });

  const audioFileService = new AudioFileService({
    enableLogging: true
  });

  try {
    // Step 1: List all collections in Blob Storage
    console.log('1. Listing collections in Blob Storage...');
    const collections = await list({
      token: BLOB_TOKEN,
      prefix: 'collections/'
    });

    console.log(`Found ${collections.blobs.length} collection folders in Blob Storage:`);
    collections.blobs.forEach(blob => {
      console.log(`  - ${blob.pathname}`);
    });

    // Step 2: Test CollectionService with Blob Storage
    console.log('\n2. Testing CollectionService with Blob Storage...');
    const collectionResult = await collectionService.getCollections();
    
    if (collectionResult.success && collectionResult.data) {
      console.log(`Found ${collectionResult.data.length} collections in MongoDB:`);
      collectionResult.data.forEach(collection => {
        console.log(`  - ${collection.name} (${collection.id})`);
      });

      // Step 3: Test getting a specific collection
      if (collectionResult.data.length > 0) {
        const firstCollection = collectionResult.data[0];
        console.log(`\n3. Testing getCollection for: ${firstCollection.name}`);
        
        const singleCollection = await collectionService.getCollection(firstCollection.id);
        if (singleCollection.success && singleCollection.data) {
          console.log('Collection details:');
          console.log(`  Name: ${singleCollection.data.name}`);
          console.log(`  Description: ${singleCollection.data.description}`);
          console.log(`  Tracks: ${singleCollection.data.tracks?.length || 0}`);
          
          // Step 4: Test formatting for player
          console.log('\n4. Testing formatCollectionForPlayer...');
          const formattedCollection = collectionService.formatCollectionForPlayer(singleCollection.data);
          
          console.log('Formatted collection layers:');
          Object.entries(formattedCollection.layers).forEach(([layerType, tracks]) => {
            console.log(`  ${layerType}: ${tracks.length} tracks`);
            tracks.forEach(track => {
              console.log(`    - ${track.title} (${track.path})`);
            });
          });

          // Step 5: Test audio URL resolution
          console.log('\n5. Testing audio URL resolution...');
          const resolvedCollection = await audioFileService.resolveCollectionUrls(singleCollection.data);
          
          console.log('Resolved audio URLs:');
          resolvedCollection.tracks.forEach(track => {
            console.log(`  Track: ${track.title}`);
            console.log(`    Original URL: ${track.audioUrl}`);
            console.log(`    Resolved URL: ${track.audioUrl}`);
            
            if (track.variations) {
              track.variations.forEach(variation => {
                console.log(`    Variation: ${variation.title}`);
                console.log(`      Original URL: ${variation.audioUrl}`);
                console.log(`      Resolved URL: ${variation.audioUrl}`);
              });
            }
          });
        }
      }
    }

    console.log('\n✅ Blob Storage integration test completed successfully');
  } catch (error) {
    console.error('\n❌ Error during Blob Storage integration test:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testBlobIntegration().catch(console.error); 