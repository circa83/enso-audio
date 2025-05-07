// src/pages/api/tracks/[id].js
import dbConnect from '../../../lib/mongodb';
import Track from '../../../models/Track';
import Collection from '../../../models/Collection';

export default async function handler(req, res) {
  console.log('[API: tracks/[id]] Processing request', { 
    method: req.method,
    id: req.query.id 
  });
  
  // Connect to the database
  try {
    await dbConnect();
    console.log('[API: tracks/[id]] Connected to MongoDB');
  } catch (error) {
    console.error('[API: tracks/[id]] Database connection error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to connect to the database' 
    });
  }

  // Extract track ID from the request
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Track ID is required'
    });
  }

  // Handle different HTTP methods
  switch(req.method) {
    case 'GET':
      return getTrack(req, res, id);
    case 'PUT':
      return updateTrack(req, res, id);
    case 'DELETE':
      return deleteTrack(req, res, id);
    default:
      return res.status(405).json({ 
        success: false, 
        message: 'Method not allowed' 
      });
  }
}

/**
 * GET: Retrieve a specific track
 */
async function getTrack(req, res, id) {
  try {
    console.log(`[API: tracks/[id]/GET] Fetching track with ID: ${id}`);
    
    // Find track by ID
    const track = await Track.findOne({ id });
    
    if (!track) {
      return res.status(404).json({
        success: false,
        message: `Track with ID '${id}' not found`
      });
    }
    
    console.log(`[API: tracks/[id]/GET] Found track: ${track.title}`);
    
    return res.status(200).json({
      success: true,
      data: track
    });
  } catch (error) {
    console.error(`[API: tracks/[id]/GET] Error fetching track:`, error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve track',
      error: error.message
    });
  }
}

/**
 * PUT: Update a specific track
 */
async function updateTrack(req, res, id) {
  try {
    console.log(`[API: tracks/[id]/PUT] Updating track with ID: ${id}`);
    
    // Extract update data from request body
    const { title, audioUrl, layerType, variations } = req.body;
    
    // Prepare update object
    const updateData = {};
    if (title) updateData.title = title;
    if (audioUrl) updateData.audioUrl = audioUrl;
    if (layerType) updateData.layerType = layerType;
    if (variations) updateData.variations = variations;
    updateData.updatedAt = Date.now();
    
    // Find and update the track
    const updatedTrack = await Track.findOneAndUpdate(
      { id },
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!updatedTrack) {
      return res.status(404).json({
        success: false,
        message: `Track with ID '${id}' not found`
      });
    }
    
    console.log(`[API: tracks/[id]/PUT] Updated track: ${updatedTrack.title}`);
    
    return res.status(200).json({
      success: true,
      data: updatedTrack
    });
  } catch (error) {
    console.error(`[API: tracks/[id]/PUT] Error updating track:`, error);
    
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
      message: 'Failed to update track',
      error: error.message
    });
  }
}

/**
 * DELETE: Delete a specific track
 */
async function deleteTrack(req, res, id) {
  try {
    console.log(`[API: tracks/[id]/DELETE] Deleting track with ID: ${id}`);
    
    // Find the track first to get the collection reference
    const track = await Track.findOne({ id });
    
    if (!track) {
      return res.status(404).json({
        success: false,
        message: `Track with ID '${id}' not found`
      });
    }
    
    // Get collection ID from track
    const collectionId = track.collection;
    
    // Delete the track
    await Track.findOneAndDelete({ id });
    
    // Remove track reference from the collection
    await Collection.findByIdAndUpdate(
      collectionId,
      { $pull: { tracks: track._id } }
    );
    
    console.log(`[API: tracks/[id]/DELETE] Deleted track: ${track.title}`);
    
    return res.status(200).json({
      success: true,
      message: `Track '${track.title}' deleted successfully`
    });
  } catch (error) {
    console.error(`[API: tracks/[id]/DELETE] Error deleting track:`, error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete track',
      error: error.message
    });
  }
}