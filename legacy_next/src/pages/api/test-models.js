// src/pages/api/test-models.js
import dbConnect from '../../lib/mongodb';
import Collection from '../../models/Collection';
import Track from '../../models/Track';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  
  try {
    console.log('[test-models] Connecting to MongoDB...');
    await dbConnect();
    
    // Create a test collection
    const testCollectionData = {
      id: 'test-collection',
      name: 'Test Collection',
      description: 'A test collection for validating models',
      coverImage: '/collections/test/cover/test.png',
      metadata: {
        artist: 'Test Artist',
        year: 2025,
        tags: ['test', 'ambient', 'validation']
      }
    };
    
    console.log('[test-models] Creating test collection...');
    // Use findOneAndUpdate to either create or update the test collection
    const collection = await Collection.findOneAndUpdate(
      { id: testCollectionData.id },
      testCollectionData,
      { new: true, upsert: true }
    );
    
    // Create a test track linked to the collection
    const testTrackData = {
      id: 'test-track',
      title: 'Test Track',
      audioUrl: '/collections/test/Layer_1/test.mp3',
      collection: collection._id,
      layerFolder: 'Layer_1',
      variations: [
        {
          id: 'test-track-01',
          title: 'Test Track Variation 1',
          audioUrl: '/collections/test/Layer_1/test_01.mp3'
        }
      ]
    };
    
    console.log('[test-models] Creating test track...');
    // Use findOneAndUpdate to either create or update the test track
    const track = await Track.findOneAndUpdate(
      { id: testTrackData.id, collection: collection._id },
      testTrackData,
      { new: true, upsert: true }
    );
    
    // Update the collection's tracks array
    console.log('[test-models] Updating collection with track reference...');
    await Collection.findByIdAndUpdate(
      collection._id,
      { $addToSet: { tracks: track._id } }
    );
    
    // Query the test data to verify it was saved correctly
    console.log('[test-models] Retrieving test data with populate...');
    const savedCollection = await Collection.findOne({ id: testCollectionData.id })
      .populate('tracks');
    
    return res.status(200).json({
      success: true,
      message: 'Models validated successfully',
      testData: {
        collection: savedCollection
      }
    });
  } catch (error) {
    console.error('[test-models] Error testing models:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Error testing models',
      error: error.message
    });
  }
}