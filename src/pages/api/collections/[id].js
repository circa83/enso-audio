// src/pages/api/collections/[id].js
import dbConnect from '../../../lib/mongodb';
import Collection from '../../../models/Collection';

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
 * GET: Retrieve a specific collection
 */
async function getCollection(req, res, id) {
  try {
    console.log(`[API: collections/[id]/GET] Fetching collection with ID: ${id}`);
    
    // Find collection by ID
    const collection = await Collection.findOne({ id }).populate('tracks');
    
    if (!collection) {
      return res.status(404).json({
        success: false,
        message: `Collection with ID '${id}' not found`
      });
    }
    
    console.log(`[API: collections/[id]/GET] Found collection: ${collection.name}`);
    
    return res.status(200).json({
      success: true,
      data: collection
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
      return res.status(404).json({
        success: false,
        message: `Collection with ID '${id}' not found`
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
    
    // Find and delete the collection
    const deletedCollection = await Collection.findOneAndDelete({ id });
    
    if (!deletedCollection) {
      return res.status(404).json({
        success: false,
        message: `Collection with ID '${id}' not found`
      });
    }
    
    console.log(`[API: collections/[id]/DELETE] Deleted collection: ${deletedCollection.name}`);
    
    // Note: You may want to also delete related tracks and files here
    
    return res.status(200).json({
      success: true,
      message: `Collection '${deletedCollection.name}' deleted successfully`
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