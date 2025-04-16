// src/utils/testServices.js
import CollectionService from '../services/CollectionService';
import AudioFileService from '../services/AudioFileService';

/**
 * Test the CollectionService with console output
 * @returns {Promise<void>}
 */
export async function testCollectionService() {
  console.log('=== Testing CollectionService ===');
  
  // Create service with logging enabled
  const collectionService = new CollectionService({
    enableLogging: true
  });
  
  try {
    // Test getting all collections
    console.log('\n1. Getting all collections...');
    const collectionsResult = await collectionService.getCollections();
    console.log(`Found ${collectionsResult.data?.length || 0} collections`);
    
    // Test getting a single collection
    if (collectionsResult.data?.length > 0) {
      const firstCollection = collectionsResult.data[0];
      console.log(`\n2. Getting collection: ${firstCollection.id}`);
      
      const singleCollection = await collectionService.getCollection(firstCollection.id);
      console.log(`Got collection: ${singleCollection.data?.name}`);
      
      // Test formatting for player
      console.log('\n3. Formatting collection for player...');
      const formattedCollection = collectionService.formatCollectionForPlayer(singleCollection.data);
      
      console.log('Formatted collection layers:');
      Object.entries(formattedCollection.layers).forEach(([layerFolder, tracks]) => {
        console.log(`  ${layerFolder}: ${tracks.length} tracks`);
      });
    }
    
    // Test searching
    console.log('\n4. Testing search...');
    const searchQuery = 'ambient'; // Common term likely to return results
    const searchResults = await collectionService.searchCollections(searchQuery);
    console.log(`Search for "${searchQuery}" returned ${searchResults.data?.length || 0} results`);
    
  } catch (error) {
    console.error('CollectionService test failed:', error);
  }
  
  console.log('\nCollectionService test complete');
}

/**
 * Test the AudioFileService with console output
 * @returns {Promise<void>}
 */
export async function testAudioFileService() {
  console.log('=== Testing AudioFileService ===');
  
  // Create service with logging enabled
  const audioFileService = new AudioFileService({
    enableLogging: true
  });
  
  // Sample URLs to test
  const testUrls = [
    '/samples/default/drone.mp3',               // Relative path
    '/collections/Stillness/Layer_1/drone.mp3', // Another relative path
    'https://example.com/audio/test.mp3',       // External URL
  ];
  
  // If Blob URL is configured, add it to test
  const blobBaseUrl = process.env.NEXT_PUBLIC_BLOB_BASE_URL;
  if (blobBaseUrl) {
    testUrls.push(`${blobBaseUrl}/collections/test/audio.mp3`);
  }
  
  try {
    // Test resolving a single URL
    console.log('\n1. Resolving single URL...');
    const resolvedUrl = await audioFileService.getAudioUrl(testUrls[0]);
    console.log(`Original: ${testUrls[0]}`);
    console.log(`Resolved: ${resolvedUrl}`);
    
    // Test batch resolving
    console.log('\n2. Batch resolving URLs...');
    const batchResults = await audioFileService.batchResolveUrls(testUrls);
    
    console.log('Batch results:');
    batchResults.forEach((resolved, original) => {
      console.log(`  Original: ${original}`);
      console.log(`  Resolved: ${resolved}`);
      console.log('---');
    });
    
    // Test with a mock collection
    console.log('\n3. Resolving collection URLs...');
    
    const mockCollection = {
      id: 'test-collection',
      name: 'Test Collection',
      tracks: [
        {
          id: 'track1',
          title: 'Track 1',
          audioUrl: testUrls[0],
          variations: [
            {
              id: 'track1-var1',
              title: 'Track 1 Variation',
              audioUrl: testUrls[1]
            }
          ]
        },
        {
          id: 'track2',
          title: 'Track 2',
          audioUrl: testUrls[2]
        }
      ]
    };
    
    const resolvedCollection = await audioFileService.resolveCollectionUrls(mockCollection);
    
    console.log('Resolved collection tracks:');
    resolvedCollection.tracks.forEach(track => {
      console.log(`  Track: ${track.title}`);
      console.log(`  URL: ${track.audioUrl}`);
      
      if (track.variations) {
        track.variations.forEach(variation => {
          console.log(`  Variation: ${variation.title}`);
          console.log(`  URL: ${variation.audioUrl}`);
        });
      }
      console.log('---');
    });
    
  } catch (error) {
    console.error('AudioFileService test failed:', error);
  }
  
  console.log('\nAudioFileService test complete');
}

/**
 * Run all service tests
 */
export async function runServiceTests() {
  try {
    await testCollectionService();
    console.log('\n');
    await testAudioFileService();
    console.log('\nAll tests completed');
  } catch (error) {
    console.error('Service tests failed:', error);
  }
}

// If called directly (e.g., via Next.js API route)
if (typeof window !== 'undefined') {
  console.log('Service test utilities loaded. Call runServiceTests() to run tests.');
}