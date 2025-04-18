// src/pages/api/upload.js
import { put } from '@vercel/blob';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import util from 'util';
import { Collection } from '../../models/Collection';

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

export const config = {
  api: {
    bodyParser: false, // Disable bodyParser for file uploads
  },
};

export default async function handler(req, res) {
  console.log("[API: upload] Handling upload request", { method: req.method });
  
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create a formidable instance with the correct constructor
    const form = new IncomingForm({
      maxFileSize: MAX_FILE_SIZE,
      keepExtensions: true,
      multiples: true,
    });

    // Parse the form
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    console.log("[API: upload] Form parsed", { 
      fields: Object.keys(fields), 
      files: Object.keys(files) 
    });

    // Get upload type
    const uploadType = fields.uploadType?.[0] || 'single';
    console.log(`[API: upload] Upload type: ${uploadType}`);

    // Get folder path if provided
    const folder = fields.folder?.[0] || '';

    // Handle single file upload
    if (uploadType === 'single') {
      const file = files.file?.[0];
      if (!file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      console.log("[API: upload] Uploading single file", { 
        name: file.originalFilename, 
        type: file.mimetype,
        size: file.size
      });

      // Validate file type
      if (![...ALLOWED_AUDIO_MIME_TYPES, ...ALLOWED_IMAGE_MIME_TYPES].includes(file.mimetype)) {
        return res.status(400).json({ 
          error: `Invalid file type: ${file.mimetype}` 
        });
      }

      // Generate a clean filename
      const cleanName = file.originalFilename.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const pathname = folder ? `${folder}/${cleanName}` : cleanName;

      // Read the file
      const fileData = await fs.promises.readFile(file.filepath);

      // Upload to Vercel Blob
      console.log(`[API: upload] Uploading to Vercel Blob: ${pathname}`);
      const blob = await put(pathname, fileData, {
        access: 'public',
        contentType: file.mimetype
      });

      console.log(`[API: upload] Upload successful: ${blob.url}`);
      return res.status(200).json({
        success: true,
        file: {
          url: blob.url,
          pathname: blob.pathname,
          contentType: file.mimetype,
          size: file.size
        }
      });
    }

    // Handle multiple file upload
    if (uploadType === 'multiple') {
      const fileArray = files.files || [];
      if (fileArray.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      console.log(`[API: upload] Uploading ${fileArray.length} files`);

      const uploadPromises = fileArray.map(async (file) => {
        // Validate file type
        if (![...ALLOWED_AUDIO_MIME_TYPES, ...ALLOWED_IMAGE_MIME_TYPES].includes(file.mimetype)) {
          // Skip invalid files and log them
          console.log(`[API: upload] Skipping invalid file type: ${file.mimetype}`);
          return null;
        }

        // Generate a clean filename
        const cleanName = file.originalFilename.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const pathname = folder ? `${folder}/${cleanName}` : cleanName;

        // Read the file
        const fileData = await fs.promises.readFile(file.filepath);

        // Upload to Vercel Blob
        console.log(`[API: upload] Uploading file: ${pathname}`);
        const blob = await put(pathname, fileData, {
          access: 'public',
          contentType: file.mimetype
        });

        return {
          url: blob.url,
          pathname: blob.pathname,
          contentType: file.mimetype,
          size: file.size
        };
      });

      // Wait for all uploads to complete
      const results = (await Promise.all(uploadPromises)).filter(Boolean);

      console.log(`[API: upload] Uploaded ${results.length} files successfully`);
      return res.status(200).json({
        success: true,
        files: results
      });
    }

    // Handle collection upload
    if (uploadType === 'collection') {
      const collectionId = fields.collectionId?.[0];
      if (!collectionId) {
        return res.status(400).json({ error: 'Collection ID is required' });
      }

      console.log(`[API: upload] Processing collection upload: ${collectionId}`);

      // Extract cover files
      const coverFiles = files.cover || [];
      
      // Create results object
      const results = {
        cover: [],
        layers: {}
      };

      // Upload cover images
      if (coverFiles.length > 0) {
        console.log(`[API: upload] Uploading ${coverFiles.length} cover files`);

        const coverPromises = coverFiles.map(async (file) => {
          // Validate file type
          if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
            console.log(`[API: upload] Skipping invalid cover file: ${file.mimetype}`);
            return null;
          }

          const cleanName = file.originalFilename.replace(/[^a-zA-Z0-9_.-]/g, '_');
          const pathname = `collections/${collectionId}/cover/${cleanName}`;

          // Read the file
          const fileData = await fs.promises.readFile(file.filepath);

          // Upload to Vercel Blob
          console.log(`[API: upload] Uploading cover file: ${pathname}`);
          const blob = await put(pathname, fileData, {
            access: 'public',
            contentType: file.mimetype
          });

          return {
            url: blob.url,
            pathname: blob.pathname
          };
        });

        results.cover = (await Promise.all(coverPromises)).filter(Boolean);
      }

      // Find and process layer files
      const layerKeys = Object.keys(files)
        .filter(key => key.startsWith('layer_'))
        .map(key => key.replace('layer_', ''));

      for (const layerKey of layerKeys) {
        const layerFiles = files[`layer_${layerKey}`] || [];
        
        if (layerFiles.length > 0) {
          console.log(`[API: upload] Uploading ${layerFiles.length} files for layer ${layerKey}`);
          
          const layerPromises = layerFiles.map(async (file) => {
            // Validate file type
            if (!ALLOWED_AUDIO_MIME_TYPES.includes(file.mimetype)) {
              console.log(`[API: upload] Skipping invalid audio file: ${file.mimetype}`);
              return null;
            }

            const cleanName = file.originalFilename.replace(/[^a-zA-Z0-9_.-]/g, '_');
            const pathname = `collections/${collectionId}/${layerKey}/${cleanName}`;

            // Read the file
            const fileData = await fs.promises.readFile(file.filepath);

            // Upload to Vercel Blob
            console.log(`[API: upload] Uploading layer file: ${pathname}`);
            const blob = await put(pathname, fileData, {
              access: 'public',
              contentType: file.mimetype
            });

            return {
              url: blob.url,
              pathname: blob.pathname
            };
          });

          results.layers[layerKey] = (await Promise.all(layerPromises)).filter(Boolean);
        }
      }

      console.log(`[API: upload] Collection upload complete`);
      return res.status(200).json({
        success: true,
        collection: {
          id: collectionId,
          results
        }
      });
    }

    // If we get here, it's an unsupported upload type
    return res.status(400).json({ error: 'Invalid upload type' });

  } catch (error) {
    console.error(`[API: upload] Error: ${error.message}`, error);
    return res.status(500).json({ 
      error: 'Failed to process upload',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}