// src/pages/api/collections/index.js
import dbConnect from '../../../lib/mongodb';
import Collection from '../../../models/Collection';
import { listCollectionFolders } from '../../../lib/blob-storage';

export default async function handler(req, res) {
  console.log('[API: collections] Processing request', { method: req.method });
  
  // Connect to the database
  try {
    await dbConnect();
    console.log('[API: collections] Connected to MongoDB');
  } catch (error) {
    console.error('[API: collections] Database connection error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to connect to the database' 
    });
  }

  // Handle different HTTP methods
  switch(req.method) {
    case 'GET':
      return getCollections(req, res);
    case 'POST':
      return createCollection(req, res);
    default:
      return res.status(405).json({ 
        success: false, 
        message: 'Method not allowed' 
      });
  }
}

/**
 * GET: Retrieve all collections with blob storage validation
 */
async function getCollections(req, res) {
  try {
    console.log('[API: collections/GET] Fetching collections with query:', req.query);
    
    // Get query parameters for filtering
    const { tag, artist, limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * parseInt(limit);
    
    // Build query based on filters
    const query = {};
    
    if (tag) {
      query['metadata.tags'] = tag;
      console.log(`[API: collections/GET] Filtering by tag: ${tag}`);
    }
    
    if (artist) {
      query['metadata.artist'] = { $regex: artist, $options: 'i' };
      console.log(`[API: collections/GET] Filtering by artist: ${artist}`);
    }
    
    // First get available collections from Blob Storage
    console.log('[API: collections/GET] Fetching collection folders from Blob Storage');
    const blobCollections = await listCollectionFolders();
    console.log(`[API: collections/GET] Found ${blobCollections.length} collections in Blob Storage`);

    if (blobCollections.length > 0) {
      // Add blob storage validation to the query
      query.id = { $in: blobCollections };
    } else {
      console.log('[API: collections/GET] No collections found in Blob Storage');
    }
    
    // Execute query with pagination
    const collections = await Collection.find(query)
      .select('-__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Collection.countDocuments(query);
    
    console.log(`[API: collections/GET] Found ${collections.length} validated collections in MongoDB`);
    
    // Return collections with pagination info
    return res.status(200).json({
      success: true,
      data: collections,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('[API: collections/GET] Error fetching collections:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve collections',
      error: error.message
    });
  }
}

/**
 * POST: Create a new collection with blob storage validation
 */
async function createCollection(req, res) {
  try {
    console.log('[API: collections/POST] Creating new collection');
    
    // Extract collection data from request body
    const { id, name, description, coverImage, metadata } = req.body;
    
    // Validate required fields
    if (!id || !name || !description) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: id, name, and description are required'
      });
    }
    
    // Check if collection with this ID already exists in MongoDB
    const existingCollection = await Collection.findOne({ id });
    if (existingCollection) {
      return res.status(409).json({
        success: false,
        message: `Collection with ID '${id}' already exists in database`
      });
    }
    
    // Verify this collection exists in Blob Storage
    console.log(`[API: collections/POST] Verifying collection ${id} exists in Blob Storage`);
    const blobCollections = await listCollectionFolders();
    
    if (!blobCollections.includes(id)) {
      return res.status(400).json({
        success: false,
        message: `Collection '${id}' not found in Blob Storage. Please upload audio files first.`
      });
    }
    
    // Create new collection
    const collection = await Collection.create({
      id,
      name,
      description,
      coverImage,
      metadata,
      tracks: [] // Initialize with empty tracks array
    });
    
    console.log(`[API: collections/POST] Created new collection: ${id}`);
    
    return res.status(201).json({
      success: true,
      data: collection
    });
  } catch (error) {
    console.error('[API: collections/POST] Error creating collection:', error);
    
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
      message: 'Failed to create collection',
      error: error.message
    });
  }
}