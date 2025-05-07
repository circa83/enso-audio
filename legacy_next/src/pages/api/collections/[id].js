// src/pages/api/collections/[id].js
import dbConnect from '../../../lib/mongodb';
import Collection from '../../../models/Collection';
import Track from '../../../models/Track';
import { verifyCollectionStructure } from '../../../lib/blob-storage';

export default async function handler(req, res) {
  console.log('[API: collections/[id]] Processing request', { 
    method: req.method,
    id: req.query.id 
  });
  
  // Connect to the database
  try {
    await dbConnect();
    console.log('[API: collections/[id]] Connected to MongoDB');
  } catch (error) {
    console.error('[API: collections/[id]] Database connection error:', error);
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
      return getCollection(req, res, id);
    case 'PUT':
      return updateCollection(req, res, id);
    case 'DELETE':
      return deleteCollection(req, res, id);
    default:
      return res.status(405).json({ 
        success: false, 
        message: 'Method not allowed' 
      });
  }
}

/**
 * GET: Retrieve a specific collection with its tracks
 */
async function getCollection(req, res, id) {
  try {
    console.log(`[API: collections/[id]/GET] Fetching collection with ID: ${id}`);
    
    // Try to skip Blob verification if it's causing issues
    let bypassBlobVerification = req.query.bypassVerify === 'true';
    
    // First verify this collection exists in blob storage (with error handling)
    let validCollection = true;
    try {
      if (!bypassBlobVerification) {
        validCollection = await verifyCollectionStructure(id, ['cover']);
        console.log(`[API: collections/[id]/GET] Blob verification result: ${validCollection}`);
      }
    } catch (verifyError) {
      console.error(`[API: collections/[id]/GET] Error in blob verification: ${verifyError.message}`);
      // Continue anyway since we have the collection in MongoDB
      validCollection = true;
    }
    
    if (!validCollection) {
      console.log(`[API: collections/[id]/GET] Collection not found in Blob storage: ${id}`);
      return res.status(404).json({
        success: false,
        message: `Collection with ID '${id}' not found in Blob storage`
      });
    }
    
    // Find collection by ID - try case-insensitive search if not found
    let collection = await Collection.findOne({ id: id });
    
    if (!collection) {
      // Try case-insensitive search
      console.log(`[API: collections/[id]/GET] Trying case-insensitive search for: ${id}`);
      const regex = new RegExp(`^${id}$`, 'i');
      collection = await Collection.findOne({ id: regex });
    }
    
    if (!collection) {
      console.log(`[API: collections/[id]/GET] Collection not found in database: ${id}`);
      return res.status(404).json({
        success: false,
        message: `Collection with ID '${id}' not found in database`
      });
    }

    // Fetch tracks for this collection
    const tracks = await Track.find({ 
      $or: [
        { collectionId: id },
        { collection: collection._id }
      ]
    });
    console.log(`[API: collections/[id]/GET] Found ${tracks.length} tracks for collection: ${id}`);
    
    // Add tracks to collection
    const collectionWithTracks = {
      ...collection.toObject(),
      tracks: tracks
    };
    
    console.log(`[API: collections/[id]/GET] Successfully retrieved collection: ${collection.name} with ${tracks.length} tracks`);
    
    return res.status(200).json({
      success: true,
      data: collectionWithTracks
    });
  } catch (error) {
    console.error(`[API: collections/[id]/GET] Error fetching collection:`, error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve collection',
      error: error.message
    });
  }
}

/**
 * PUT: Update a specific collection
 */
async function updateCollection(req, res, id) {
  try {
    console.log(`[API: collections/[id]/PUT] Updating collection with ID: ${id}`);
    
    // Verify this collection exists in blob storage
    const validCollection = await verifyCollectionStructure(id);
    
    if (!validCollection) {
      console.log(`[API: collections/[id]/PUT] Collection not found in Blob storage: ${id}`);
      return res.status(404).json({
        success: false,
        message: `Collection with ID '${id}' not found in Blob storage`
      });
    }
    
    // Extract update data from request body
    const { name, description, coverImage, metadata } = req.body;
    
    // Find and update the collection
    const updatedCollection = await Collection.findOneAndUpdate(
      { id },
      { 
        name, 
        description, 
        coverImage, 
        metadata,
        updatedAt: Date.now() 
      },
      { new: true, runValidators: true }
    );
    
    if (!updatedCollection) {
      console.log(`[API: collections/[id]/PUT] Collection not found in database: ${id}`);
      return res.status(404).json({
        success: false,
        message: `Collection with ID '${id}' not found in database`
      });
    }
    
    console.log(`[API: collections/[id]/PUT] Updated collection: ${updatedCollection.name}`);
    
    return res.status(200).json({
      success: true,
      data: updatedCollection
    });
  } catch (error) {
    console.error(`[API: collections/[id]/PUT] Error updating collection:`, error);
    
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
      message: 'Failed to update collection',
      error: error.message
    });
  }
}

/**
 * DELETE: Delete a specific collection
 */
async function deleteCollection(req, res, id) {
  try {
    console.log(`[API: collections/[id]/DELETE] Deleting collection with ID: ${id}`);
    
    // Note: We don't verify blob storage for deletion since we want to be able
    // to clean up orphaned database records even if files are missing
    
    // Find and delete the collection
    const deletedCollection = await Collection.findOneAndDelete({ id });
    
    if (!deletedCollection) {
      console.log(`[API: collections/[id]/DELETE] Collection not found in database: ${id}`);
      return res.status(404).json({
        success: false,
        message: `Collection with ID '${id}' not found in database`
      });
    }
    
    // Delete all tracks associated with this collection
    const deleteResult = await Track.deleteMany({ collectionId: id });
    console.log(`[API: collections/[id]/DELETE] Deleted ${deleteResult.deletedCount} tracks associated with collection: ${id}`);
    
    console.log(`[API: collections/[id]/DELETE] Successfully deleted collection: ${deletedCollection.name} and its tracks`);
    
    return res.status(200).json({
      success: true,
      message: `Collection '${deletedCollection.name}' and its tracks deleted successfully`,
      details: {
        tracksRemoved: deleteResult.deletedCount
      }
    });
  } catch (error) {
    console.error(`[API: collections/[id]/DELETE] Error deleting collection:`, error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete collection',
      error: error.message
    });
  }
}