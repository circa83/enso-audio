// src/pages/api/upload.js
import { put, list, del } from '@vercel/blob';
import { NextApiRequest, NextApiResponse } from 'next';

// Allowed MIME types for audio files
const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mpeg',        // MP3
  'audio/mp3',         // MP3 (alternative)
  'audio/wav',         // WAV
  'audio/x-wav',       // WAV (alternative)
  'audio/ogg',         // OGG
  'audio/aac',         // AAC
  'audio/flac',        // FLAC
  'audio/x-flac',      // FLAC (alternative)
  'audio/webm'         // WebM audio
];

// Allowed MIME types for cover images
const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml'
];

// Maximum file size (100 MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Add at the top with other constants
const STORE_ID = process.env.BLOB_STORE_ID || 'store_uGGTZAuWx9gzThtf';
const BASE_URL = process.env.BLOB_BASE_URL || 'https://uggtzauwx9gzthtf.public.blob.vercel-storage.com';

export const config = {
  api: {
    bodyParser: false, // Disable bodyParser to handle FormData correctly
    responseLimit: false, // Remove the response size limit
  },
};

export default async function handler(req, res) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  console.log('[API: upload] Processing upload request');
  
  try {
    // Check for multipart/form-data content-type
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
    }
    
    // Create a FormData parser
    const formData = await req.formData();
    
    // Get the upload type
    const uploadType = formData.get('uploadType');
    console.log(`[API: upload] Upload type: ${uploadType}`);
    
    // Handle different upload types
    switch (uploadType) {
      case 'single':
        return handleSingleFileUpload(formData, res);
      
      case 'multiple':
        return handleMultipleFileUpload(formData, res);
        
      case 'collection':
        return handleCollectionUpload(formData, res);
        
      default:
        return res.status(400).json({ error: 'Invalid upload type' });
    }
  } catch (error) {
    console.error(`[API: upload] Error processing upload: ${error.message}`);
    return res.status(500).json({ error: 'Failed to process upload', message: error.message });
  }
}

/**
 * Handle single file upload
 */
async function handleSingleFileUpload(formData, res) {
  try {
    const file = formData.get('file');
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    // Validate file
    const validationResult = validateFile(file, {
      allowedMimeTypes: [...ALLOWED_AUDIO_MIME_TYPES, ...ALLOWED_IMAGE_MIME_TYPES],
      maxSize: MAX_FILE_SIZE
    });
    
    if (!validationResult.valid) {
      return res.status(400).json({ error: validationResult.error });
    }
    
    // Get folder path
    const folder = formData.get('folder') || '';
    
    // Upload file
    console.log(`[API: upload] Uploading single file to folder: ${folder}`);
    
    // Generate a clean filename
    const originalName = file.name;
    const cleanName = originalName.replace(/[^a-zA-Z0-9_.-]/g, '_');
    
    // Create the full path including store ID
    const pathname = `${STORE_ID}/${folder ? `${folder}/${cleanName}` : cleanName}`;
    
    // Execute the upload
    const blob = await put(pathname, file, {
      access: 'public',
      addRandomSuffix: false
    });
    
    // Ensure the URL uses your store's base URL
    const url = `${BASE_URL}/${blob.pathname}`;
    
    return res.status(200).json({
      success: true,
      file: {
        url,
        pathname: blob.pathname,
        contentType: file.type,
        size: file.size
      }
    });
  } catch (error) {
    console.error(`[API: upload/single] Error: ${error.message}`);
    return res.status(500).json({ error: 'Failed to upload file', message: error.message });
  }
}

/**
 * Handle multiple file upload
 */
async function handleMultipleFileUpload(formData, res) {
  try {
    const files = formData.getAll('files');
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }
    
    // Get folder path
    const folder = formData.get('folder') || '';
    
    // Validate each file
    for (const file of files) {
      const validationResult = validateFile(file, {
        allowedMimeTypes: [...ALLOWED_AUDIO_MIME_TYPES, ...ALLOWED_IMAGE_MIME_TYPES],
        maxSize: MAX_FILE_SIZE
      });
      
      if (!validationResult.valid) {
        return res.status(400).json({ 
          error: `File validation failed for ${file.name}: ${validationResult.error}` 
        });
      }
    }
    
    // Upload files
    console.log(`[API: upload] Uploading ${files.length} files to folder: ${folder}`);
    
    // Process files with concurrency limit
    const concurrentLimit = 3;
    const results = [];
    
    // Process in batches for better handling
    for (let i = 0; i < files.length; i += concurrentLimit) {
      const batch = files.slice(i, i + concurrentLimit);
      
      const batchPromises = batch.map(file => {
        // Generate a clean filename
        const originalName = file.name;
        const cleanName = originalName.replace(/[^a-zA-Z0-9_.-]/g, '_');
        
        // Create path
        const pathname = folder ? `${folder}/${cleanName}` : cleanName;
        
        // Upload file
        return put(pathname, file, {
          access: 'public',
        });
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    // Format response
    const fileResults = results.map(result => ({
      url: result.url,
      pathname: result.pathname
    }));
    
    return res.status(200).json({
      success: true,
      files: fileResults
    });
  } catch (error) {
    console.error(`[API: upload/multiple] Error: ${error.message}`);
    return res.status(500).json({ error: 'Failed to upload files', message: error.message });
  }
}

/**
 * Handle collection structure upload
 */
async function handleCollectionUpload(formData, res) {
  try {
    const collectionId = formData.get('collectionId');
    if (!collectionId) {
      return res.status(400).json({ error: 'Collection ID is required' });
    }
    
    console.log(`[API: upload] Processing collection upload for: ${collectionId}`);
    
    // Extract files per category
    const coverFiles = formData.getAll('cover');
    
    // Structure to hold layer files
    const layerFiles = {};
    
    // Get layer names from form data
    const layerKeys = Array.from(formData.keys())
      .filter(key => key.startsWith('layer_'))
      .map(key => key.replace('layer_', ''));
    
    // Populate layer files
    for (const layerKey of layerKeys) {
      const files = formData.getAll(`layer_${layerKey}`);
      if (files.length > 0) {
        layerFiles[layerKey] = files;
      }
    }
    
    // Validate all files
    const allFiles = [
      ...coverFiles,
      ...Object.values(layerFiles).flat()
    ];
    
    for (const file of allFiles) {
      // Cover images should be images, layer files should be audio
      const isLayerFile = Object.values(layerFiles).some(files => 
        files.some(f => f.name === file.name)
      );
      const allowedTypes = isLayerFile ? ALLOWED_AUDIO_MIME_TYPES : ALLOWED_IMAGE_MIME_TYPES;
      
      const validationResult = validateFile(file, {
        allowedMimeTypes: allowedTypes,
        maxSize: MAX_FILE_SIZE
      });
      
      if (!validationResult.valid) {
        return res.status(400).json({ 
          error: `File validation failed for ${file.name}: ${validationResult.error}` 
        });
      }
    }
    
    const results = {
      cover: [],
      layers: {}
    };
    
    // Upload cover images
    if (coverFiles.length > 0) {
      console.log(`[API: upload] Uploading ${coverFiles.length} cover files`);
      
      const coverPromises = coverFiles.map(file => {
        const cleanName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const pathname = `collections/${collectionId}/cover/${cleanName}`;
        
        return put(pathname, file, {
          access: 'public',
        });
      });
      
      results.cover = await Promise.all(coverPromises);
    }
    
    // Upload layer files
    for (const [layerName, files] of Object.entries(layerFiles)) {
      if (files.length > 0) {
        console.log(`[API: upload] Uploading ${files.length} files for layer ${layerName}`);
        
        const layerPromises = files.map(file => {
          const cleanName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
          const pathname = `collections/${collectionId}/${layerName}/${cleanName}`;
          
          return put(pathname, file, {
            access: 'public',
          });
        });
        
        results.layers[layerName] = await Promise.all(layerPromises);
      }
    }
    
    // Format the results for response
    const formattedResults = {
      cover: results.cover.map(result => ({
        url: result.url,
        pathname: result.pathname
      })),
      layers: {}
    };
    
    for (const [layerName, layerResults] of Object.entries(results.layers)) {
      formattedResults.layers[layerName] = layerResults.map(result => ({
        url: result.url,
        pathname: result.pathname
      }));
    }
    
    return res.status(200).json({
      success: true,
      collection: {
        id: collectionId,
        results: formattedResults
      }
    });
  } catch (error) {
    console.error(`[API: upload/collection] Error: ${error.message}`);
    return res.status(500).json({ error: 'Failed to upload collection', message: error.message });
  }
}

/**
 * Validate a file based on MIME type and size
 */
function validateFile(file, options = {}) {
  const { allowedMimeTypes, maxSize } = options;
  
  // Check file type
  if (allowedMimeTypes && allowedMimeTypes.length > 0) {
    if (!allowedMimeTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Invalid file type: ${file.type}. Allowed types: ${allowedMimeTypes.join(', ')}`
      };
    }
  }
  
  // Check file size
  if (maxSize && file.size > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024);
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${maxSizeMB} MB`
    };
  }
  
  return { valid: true };
}