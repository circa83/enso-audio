// src/pages/api/collections/[id]/tracks.js
import dbConnect from '../../../../lib/mongodb';
import Collection from '../../../../models/Collection';
import Track from '../../../../models/Track';

export default async function handler(req, res) {
  console.log('[API: collections/[id]/tracks] Processing request', { 
    method: req.method,
    id: req.query.id 
  });
  
  // Connect to the database
  try {
    await dbConnect();
    console.log('[API: collections/[id]/tracks] Connected to MongoDB');
  } catch (error) {
    console.error('[API: collections/[id]/tracks] Database connection error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to connect to the database' 
    });
  }

  // Extract collection ID from the request
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Collection ID is required'
    });
  }

  // Handle different HTTP methods
  switch(req.method) {
    case 'GET':
      return getCollectionTracks(req, res, id);
    case 'POST':
      return addTrackToCollection(req, res, id);
    default:
      return res.status(405).json({ 
        success: false, 
        message: 'Method not allowed' 
      });
  }
}

/**
 * GET: Retrieve all tracks for a collection
 */
async function getCollectionTracks(req, res, id) {
  try {
    console.log(`[API: collections/[id]/tracks/GET] Fetching tracks for collection: ${id}`);
    
    // Check if collection exists
    const collection = await Collection.findOne({ id });
    
    if (!collection) {
      return res.status(404).json({
        success: false,
        message: `Collection with ID '${id}' not found`
      });
    }
    
    // Retrieve tracks for the collection
    const tracks = await Track.find({ collection: collection._id });
    
    console.log(`[API: collections/[id]/tracks/GET] Found ${tracks.length} tracks`);
    
    return res.status(200).json({
      success: true,
      data: tracks
    });
  } catch (error) {
    console.error(`[API: collections/[id]/tracks/GET] Error fetching tracks:`, error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve tracks',
      error: error.message
    });
  }
}

/**
 * POST: Add a new track to a collection
 */
async function addTrackToCollection(req, res, id) {
  try {
    console.log(`[API: collections/[id]/tracks/POST] Adding track to collection: ${id}`);
    
    // Check if collection exists
    const collection = await Collection.findOne({ id });
    
    if (!collection) {
      return res.status(404).json({
        success: false,
        message: `Collection with ID '${id}' not found`
      });
    }
    
    // Extract track data from request body
    const { 
      id: trackId, 
      title, 
      audioUrl, 
      layerType, 
      variations 
    } = req.body;
    
    // Validate required fields
    if (!trackId || !title || !audioUrl || !layerType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: id, title, audioUrl, and layerType are required'
      });
    }
    
    // Check if track with this ID already exists in the collection
    const existingTrack = await Track.findOne({ 
      id: trackId, 
      collection: collection._id 
    });
    
    if (existingTrack) {
      return res.status(409).json({
        success: false,
        message: `Track with ID '${trackId}' already exists in this collection`
      });
    }
    
    // Create new track
    const track = await Track.create({
      id: trackId,
      title,
      audioUrl,
      layerType,
      variations: variations || [],
      collection: collection._id
    });
    
    // Add track to collection
    await Collection.findByIdAndUpdate(
      collection._id,
      { $addToSet: { tracks: track._id } }
    );
    
    console.log(`[API: collections/[id]/tracks/POST] Added track '${title}' to collection`);
    
    return res.status(201).json({
      success: true,
      data: track
    });
  } catch (error) {
    console.error(`[API: collections/[id]/tracks/POST] Error adding track:`, error);
    
    // Check for validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Failed to add track to collection',
      error: error.message
    });
  }
}