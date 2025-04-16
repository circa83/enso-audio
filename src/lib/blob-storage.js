// src/lib/blob-storage.js
import { put, list, del } from '@vercel/blob';

// Add constants for your Blob store
const STORE_ID = process.env.BLOB_STORE_ID || 'store_uGGTZAuWx9gzThtf';
const BASE_URL = process.env.BLOB_BASE_URL || 'https://uggtzauwx9gzthtf.public.blob.vercel-storage.com';

/**
 * Upload a file to Vercel Blob storage
 * @param {File|Blob|Buffer} file - The file to upload
 * @param {string} folder - The folder path for the file
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} The upload result with URL
 */
export async function uploadFile(file, folder, options = {}) {
  try {
    console.log(`[blob-storage: uploadFile] Uploading file to ${folder}`);
    
    if (!file) {
      throw new Error('No file provided for upload');
    }
    
    // Generate a clean filename (remove special characters, spaces)
    const originalName = options.filename || file.name || 'file';
    const cleanName = originalName.replace(/[^a-zA-Z0-9_.-]/g, '_');
    
    // Create the full path including folder and store prefix
    const pathname = folder ? `${folder}/${cleanName}` : cleanName;
    
    // Prepare upload options
    const uploadOptions = {
      access: 'public',
      ...options
    };
    
    console.log(`[blob-storage: uploadFile] Starting upload to ${pathname}`);
    
    // Execute the upload
    const result = await put(pathname, file, uploadOptions);
    
    // Add store-specific URL if not present
    if (!result.url.includes(BASE_URL)) {
      result.url = `${BASE_URL}/${result.pathname}`;
    }
    
    console.log(`[blob-storage: uploadFile] Upload successful: ${result.url}`);
    return result;
  } catch (error) {
    console.error(`[blob-storage: uploadFile] Upload failed: ${error.message}`);
    throw error;
  }
}

/**
 * List files in a specific folder path
 * @param {string} prefix - The folder path prefix to list
 * @param {Object} options - Additional listing options
 * @returns {Promise<Object>} The listing result
 */
export async function listFiles(prefix, options = {}) {
  try {
    console.log(`[blob-storage: listFiles] Listing files with prefix: ${prefix}`);
    
    const result = await list({
      prefix,
      ...options,
    });
    
    console.log(`[blob-storage: listFiles] Found ${result.blobs.length} files`);
    return result;
  } catch (error) {
    console.error(`[blob-storage: listFiles] List operation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get all collection folders from Blob storage
 * @returns {Promise<string[]>} Array of collection folder names
 */
export async function listCollectionFolders() {
  try {
    console.log('[blob-storage: listCollectionFolders] Fetching collection folders');
    
    // Use the listFiles function with a collections/ prefix
    const response = await fetch('/api/blob/list?prefix=collections/');
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const blobs = await response.json();
    
    // Extract unique folder names
    const folders = new Set();
    blobs.forEach(blob => {
      const pathParts = blob.pathname.split('/');
      if (pathParts.length > 1) {
        folders.add(pathParts[1]); // collections/[folder-name]/...
      }
    });
    
    console.log(`[blob-storage: listCollectionFolders] Found ${folders.size} collections`);
    return Array.from(folders);
  } catch (error) {
    console.error(`[blob-storage: listCollectionFolders] Error: ${error.message}`);
    return [];
  }
}

/**
 * Get sub-folders within a collection
 * @param {string} collectionId - The collection identifier
 * @returns {Promise<string[]>} Array of subfolder names (e.g., 'cover', 'Layer_1', etc.)
 */
export async function listCollectionSubfolders(collectionId) {
  try {
    console.log(`[blob-storage: listCollectionSubfolders] Fetching subfolders for collection: ${collectionId}`);
    
    if (!collectionId) {
      throw new Error('Collection ID is required');
    }
    
    const prefix = `collections/${collectionId}/`;
    const response = await fetch(`/api/blob/list?prefix=${encodeURIComponent(prefix)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const blobs = await response.json();
    
    // Extract unique subfolder names
    const subfolders = new Set();
    blobs.forEach(blob => {
      const path = blob.pathname.replace(prefix, '');
      const subfolder = path.split('/')[0];
      if (subfolder) {
        subfolders.add(subfolder);
      }
    });
    
    console.log(`[blob-storage: listCollectionSubfolders] Found ${subfolders.size} subfolders`);
    return Array.from(subfolders);
  } catch (error) {
    console.error(`[blob-storage: listCollectionSubfolders] Error: ${error.message}`);
    return [];
  }
}

/**
 * Delete a file from Vercel Blob storage
 * @param {string} url - The URL of the file to delete
 * @returns {Promise<Object>} The deletion result
 */
export async function deleteFile(url) {
  try {
    console.log(`[blob-storage: deleteFile] Deleting file: ${url}`);
    
    const result = await del(url);
    
    console.log(`[blob-storage: deleteFile] Delete successful`);
    return result;
  } catch (error) {
    console.error(`[blob-storage: deleteFile] Delete failed: ${error.message}`);
    throw error;
  }
}

/**
 * Upload multiple files to a folder
 * @param {Array<File|Blob|Buffer>} files - Array of files to upload
 * @param {string} folder - The folder path for the files
 * @param {Object} options - Additional options
 * @returns {Promise<Array<Object>>} Array of upload results
 */
export async function uploadMultipleFiles(files, folder, options = {}) {
  try {
    console.log(`[blob-storage: uploadMultipleFiles] Uploading ${files.length} files to ${folder}`);
    
    // Process uploads concurrently with a limit
    const concurrentLimit = options.concurrentLimit || 3;
    const results = [];
    
    // Process files in batches to avoid overwhelming the network
    for (let i = 0; i < files.length; i += concurrentLimit) {
      const batch = files.slice(i, i + concurrentLimit);
      
      console.log(`[blob-storage: uploadMultipleFiles] Processing batch ${Math.floor(i/concurrentLimit) + 1} (${batch.length} files)`);
      
      const batchPromises = batch.map(file => 
        uploadFile(file, folder, {
          ...options,
          filename: file.name || `file_${Date.now()}`
        })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    console.log(`[blob-storage: uploadMultipleFiles] Completed uploading ${results.length} files`);
    return results;
  } catch (error) {
    console.error(`[blob-storage: uploadMultipleFiles] Batch upload failed: ${error.message}`);
    throw error;
  }
}

/**
 * Upload files representing a collection structure
 * @param {Object} collectionFiles - Object with categorized files
 * @param {string} collectionId - The collection identifier
 * @returns {Promise<Object>} The upload results organized by category
 */
export async function uploadCollectionFiles(collectionFiles, collectionId) {
  try {
    if (!collectionId) {
      throw new Error('Collection ID is required');
    }
    
    console.log(`[blob-storage: uploadCollectionFiles] Uploading collection: ${collectionId}`);
    
    const basePath = `collections/${collectionId}`;
    const results = {
      cover: [],
      layers: {}
    };
    
    // Upload cover images
    if (collectionFiles.cover && collectionFiles.cover.length > 0) {
      console.log(`[blob-storage: uploadCollectionFiles] Uploading ${collectionFiles.cover.length} cover files`);
      results.cover = await uploadMultipleFiles(
        collectionFiles.cover, 
        `${basePath}/cover`
      );
    }
    
    // Upload layer files
    if (collectionFiles.layers) {
      for (const [layerName, layerFiles] of Object.entries(collectionFiles.layers)) {
        if (layerFiles && layerFiles.length > 0) {
          console.log(`[blob-storage: uploadCollectionFiles] Uploading ${layerFiles.length} files for layer ${layerName}`);
          results.layers[layerName] = await uploadMultipleFiles(
            layerFiles,
            `${basePath}/${layerName}`
          );
        }
      }
    }
    
    console.log(`[blob-storage: uploadCollectionFiles] Collection upload completed`);
    return results;
  } catch (error) {
    console.error(`[blob-storage: uploadCollectionFiles] Collection upload failed: ${error.message}`);
    throw error;
  }
}

/**
 * Verify if a collection has all necessary files in Blob storage
 * @param {string} collectionId - The collection identifier
 * @param {Array<string>} requiredFolders - Array of required folder names (e.g., ['cover', 'Layer_1'])
 * @returns {Promise<boolean>} True if collection has all required folders
 */
export async function verifyCollectionStructure(collectionId, requiredFolders = ['cover']) {
  try {
    console.log(`[blob-storage: verifyCollectionStructure] Verifying collection: ${collectionId}`);
    
    if (!collectionId) {
      return false;
    }
    
    // Get collection subfolders
    const subfolders = await listCollectionSubfolders(collectionId);
    
    // Check if all required folders exist
    const hasAllRequired = requiredFolders.every(folder => 
      subfolders.includes(folder)
    );
    
    console.log(`[blob-storage: verifyCollectionStructure] Collection ${collectionId} validation: ${hasAllRequired}`);
    return hasAllRequired;
  } catch (error) {
    console.error(`[blob-storage: verifyCollectionStructure] Error verifying collection: ${error.message}`);
    return false;
  }
}