/**
 * CollectionService.js
 * 
 * Service for managing audio collections in Ensō Audio
 * Handles fetching, filtering, and processing collection data
 */

class CollectionService {
  /**
   * Create a new CollectionService instance
   * @param {Object} options - Configuration options
   * @param {string} [options.apiBasePath='/api'] - Base path for API endpoints
   * @param {number} [options.cacheDuration=60000] - Cache duration in milliseconds (default: 1 minute)
   * @param {boolean} [options.enableLogging=false] - Enable detailed console logging
   */
  constructor(options = {}) {
    // Configuration
    this.config = {
      apiBasePath: options.apiBasePath || '/api',
      cacheDuration: options.cacheDuration || 60000, // 1 minute default
      enableLogging: options.enableLogging || false,
      blobBaseUrl: process.env.NEXT_PUBLIC_BLOB_BASE_URL || 'https://uggtzauwx9gzthtf.public.blob.vercel-storage.com'
    };
    
    // Internal state
    this.collectionsCache = null;
    this.lastCacheTime = 0;
    this.pendingRequests = new Map();
  }
  
  /**
   * Get collection folders from Blob Storage
   * @private
   * @returns {Promise<string[]>} Array of collection folder names
   */
  async _getBlobCollectionFolders() {
    try {
      console.log('[CollectionService: _getBlobCollectionFolders] Fetching blob collections');
      const response = await fetch('/api/blob/list?prefix=collections/');
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const blobs = await response.json();
      
      // Extract unique collection folder names from blob paths
      const folders = new Set();
      // Map to store files by collection folder
      const folderContents = new Map();
      
      blobs.forEach(blob => {
        const path = blob.pathname.replace('collections/', '');
        const parts = path.split('/');
        const folder = parts[0];
        
        if (folder) {
          folders.add(folder);
          
          // Group files by collection folder
          if (!folderContents.has(folder)) {
            folderContents.set(folder, []);
          }
          
          folderContents.get(folder).push({
            path: blob.pathname,
            filename: parts.length > 1 ? parts[parts.length - 1] : null,
            size: blob.size,
            contentType: blob.contentType,
            updatedAt: blob.uploadedAt || blob.updatedAt
          });
        }
      });
      
      // Log detailed information about collection contents
      console.log(`[CollectionService: _getBlobCollectionFolders] Found ${folders.size} collections`);
      
      // Log the structure of each collection folder
      folderContents.forEach((files, folder) => {
        console.log(`[CollectionService: _getBlobCollectionFolders] Collection '${folder}' contains ${files.length} files:`);
        
        // Group files by type/subfolder for cleaner logging
        const filesByType = {};
        files.forEach(file => {
          const subPath = file.path.replace(`collections/${folder}/`, '');
          const type = subPath.includes('/') ? subPath.split('/')[0] : 'root';
          
          if (!filesByType[type]) {
            filesByType[type] = [];
          }
          filesByType[type].push(file);
        });
        
        // Log content structure
        Object.entries(filesByType).forEach(([type, typeFiles]) => {
          console.log(`  - ${type}: ${typeFiles.length} files`);
          // Log up to 3 examples of each type
          typeFiles.slice(0, 3).forEach(file => {
            console.log(`    • ${file.path} (${file.contentType}, ${(file.size / 1024).toFixed(2)} KB)`);
          });
          if (typeFiles.length > 3) {
            console.log(`    • ... and ${typeFiles.length - 3} more`);
          }
        });
      });
      
      return Array.from(folders);
    } catch (error) {
      console.error(`[CollectionService: _getBlobCollectionFolders] Error: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Verify if a collection's audio files exist in Vercel Blob Storage
   * @private
   * @param {Object} collection - Collection data
   * @returns {Promise<boolean>} True if all audio files exist
   */
  async _verifyBlobFiles(collection) {
    if (!collection || !collection.tracks) return false;
    
    try {
      // Check each track's audio URL
      for (const track of collection.tracks) {
        if (!track.audioUrl) return false;
        
        // Verify the URL is accessible
        const response = await fetch(track.audioUrl, { method: 'HEAD' });
        if (!response.ok) return false;
        
        // Check variations if they exist
        if (track.variations) {
          for (const variation of track.variations) {
            if (!variation.audioUrl) return false;
            
            const varResponse = await fetch(variation.audioUrl, { method: 'HEAD' });
            if (!varResponse.ok) return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      this.log(`[_verifyBlobFiles] Error verifying files: ${error.message}`, 'error');
      return false;
    }
  }
  
  /**
   * Helper for building query strings
   * @private
   * @param {Object} params - Object containing query parameters
   * @returns {string} Formatted query string with ? prefix if not empty
   */
  _buildQueryString(params = {}) {
    const query = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, value);
      }
    });
    
    const queryString = query.toString();
    return queryString ? `?${queryString}` : '';
  }
  
  /**
   * Get all collections with optional filtering
   * @param {Object} [options] - Fetch options
   * @param {boolean} [options.useCache=true] - Use cached data if available
   * @param {string} [options.tag] - Filter by tag
   * @param {string} [options.artist] - Filter by artist name
   * @param {number} [options.limit] - Maximum number of results
   * @param {number} [options.page] - Page number for pagination
   * @returns {Promise<Object>} Collections data with pagination info
   */
  async getCollections(options = {}) {
    const {
      useCache = true,
      tag,
      artist,
      limit = 10,
      page = 1
    } = options;
    
    try {
      // First, get the list of collections from Vercel Blob Storage
      const blobFolders = await this._getBlobCollectionFolders();
      console.log(`[CollectionService: getCollections] Found ${blobFolders.length} collections in Blob Storage`);
      
      if (blobFolders.length === 0) {
        console.log('[CollectionService: getCollections] No collections found in Blob Storage');
        return {
          success: true,
          data: [],
          pagination: {
            total: 0,
            page: 1,
            limit: parseInt(limit),
            pages: 0
          }
        };
      }
      
      // Generate cache key based on filter options
      const cacheKey = JSON.stringify({ tag, artist, limit, page });
      
      // Check cache if enabled
      if (useCache && 
          this.collectionsCache && 
          Date.now() - this.lastCacheTime < this.config.cacheDuration &&
          !tag && !artist) {
        console.log(`[CollectionService: getCollections] Using cached collections data (${this.collectionsCache.data.length} items)`);
        
        // Still filter the cached data by blob folders
        const filteredData = this.collectionsCache.data.filter(collection => 
          blobFolders.includes(collection.id)
        );
        
        const filteredResult = {
          ...this.collectionsCache,
          data: filteredData,
          pagination: {
            ...this.collectionsCache.pagination,
            total: filteredData.length,
            pages: Math.ceil(filteredData.length / parseInt(limit))
          }
        };
        
        return filteredResult;
      }
      
      // Check for pending request with same parameters
      if (this.pendingRequests.has(cacheKey)) {
        console.log(`[CollectionService: getCollections] Using pending request for key: ${cacheKey}`);
        return this.pendingRequests.get(cacheKey);
      }
      
      // Then, fetch the corresponding collections from MongoDB
      const endpoint = `${this.config.apiBasePath}/collections${this._buildQueryString(options)}`;
      console.log(`[CollectionService: getCollections] Fetching from API: ${endpoint}`);
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const apiData = await response.json();
      
      // Filter collections to only include those that exist in blob storage
      const filteredCollections = apiData.data.filter(collection => 
        blobFolders.includes(collection.id)
      );
      
      console.log(`[CollectionService: getCollections] Filtered to ${filteredCollections.length} valid collections`);
      
      // Create result with updated pagination
      const result = {
        success: true,
        data: filteredCollections,
        pagination: {
          total: filteredCollections.length,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(filteredCollections.length / parseInt(limit))
        }
      };
      
      // Update cache if this was a full request (no filters)
      if (!tag && !artist) {
        this.collectionsCache = result;
        this.lastCacheTime = Date.now();
        console.log(`[CollectionService: getCollections] Updated cache with ${filteredCollections.length} collections`);
      }
      
      return result;
    } catch (error) {
      console.error(`[CollectionService: getCollections] Error: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get a specific collection by ID with its tracks
   * @param {string} id - Collection ID
   * @param {boolean} [useCache=true] - Use cached data if possible
   * @returns {Promise<Object>} Collection data with tracks
   */
  async getCollection(id, useCache = true) {
    if (!id) {
      throw new Error('Collection ID is required');
    }
    
    // Check if collection exists in cache
    if (useCache && 
        this.collectionsCache && 
        Date.now() - this.lastCacheTime < this.config.cacheDuration) {
      const cachedCollection = this.collectionsCache.data.find(c => c.id === id);
      if (cachedCollection) {
        this.log(`[getCollection] Using cached data for collection: ${id}`);
        return { success: true, data: cachedCollection };
      }
    }
    
    // Check for pending request
    const cacheKey = `collection:${id}`;
    if (this.pendingRequests.has(cacheKey)) {
      this.log(`[getCollection] Using pending request for: ${id}`);
      return this.pendingRequests.get(cacheKey);
    }
    
    // First verify this collection exists in blob storage
    const blobFolders = await this._getBlobCollectionFolders();
    if (!blobFolders.includes(id)) {
      console.log(`[CollectionService: getCollection] Collection ${id} not found in Blob Storage`);
      return { 
        success: false, 
        error: `Collection with ID '${id}' not found in storage` 
      };
    }
    
    const endpoint = `${this.config.apiBasePath}/collections/${id}?bypassVerify=true`;
    console.log(`[CollectionService: getCollection] Fetching collection from: ${endpoint}`);
    
    // Create request promise
    const requestPromise = (async () => {
      try {
        const response = await fetch(endpoint);
        
        if (!response.ok) {
          if (response.status === 404) {
            return { success: false, error: `Collection with ID '${id}' not found` };
          }
          
          const errorText = await response.text();
          throw new Error(`Failed to fetch collection: ${response.status} ${response.statusText}. ${errorText}`);
        }
        
        const data = await response.json();
        
        if (!data.success || !data.data) {
          throw new Error('Invalid response format from collection API');
        }

        // Verify collection has valid files in blob storage
        console.log(`[CollectionService: getCollection] Verifying blob files for collection: ${id}`);
        const filesExist = await this._verifyBlobFiles(data.data);
        
        if (!filesExist) {
          console.log(`[CollectionService: getCollection] Some audio files for collection ${id} are not accessible`);
          data.warning = "Some audio files may not be accessible";
        }
        
        return data;
      } catch (error) {
        console.log(`[CollectionService: getCollection] Error: ${error.message}`, 'error');
        throw error;
      } finally {
        // Remove from pending requests
        this.pendingRequests.delete(cacheKey);
      }
    })();
    
    // Store promise in pending requests
    this.pendingRequests.set(cacheKey, requestPromise);
    
    return requestPromise;
  }
  
 
  /**
 * Format collection data for consumption by the audio player
 * @param {Object} collection - Collection data
 * @returns {Object} Formatted collection data ready for player consumption
 */
formatCollectionForPlayer(collection) {
  if (!collection) {
    throw new Error('Collection data is required');
  }
  
  try {
    console.log(`[CollectionService: formatCollectionForPlayer] Formatting collection: ${collection.id}`);
    
    // Define player layers
    const playerLayers = {
      'Layer 1': [], // Drone
      'Layer 2': [], // Melody
      'Layer 3': [], // Rhythm
      'Layer 4': []  // Nature
    };
    
    // Map of folder names to player layer names
    const folderToLayerMap = {
      'Layer_1': 'Layer 1',
      'Layer_2': 'Layer 2',
      'Layer_3': 'Layer 3',
      'Layer_4': 'Layer 4'
    };
    
    // Ensure collection has tracks array
    if (!collection.tracks || !Array.isArray(collection.tracks) || collection.tracks.length === 0) {
      console.error(`[CollectionService: formatCollectionForPlayer] Collection ${collection.id} has no tracks`);
      throw new Error(`Collection "${collection.name || collection.id}" has no audio tracks`);
    }
    
    let formattedTrackCount = 0;
    
    // Process tracks
    collection.tracks.forEach(track => {
      // Handle missing properties with clear logging
      if (!track.id) {
        console.warn('[CollectionService: formatCollectionForPlayer] Track missing id:', track);
        return;
      }
      
      if (!track.audioUrl) {
        console.warn(`[CollectionService: formatCollectionForPlayer] Track ${track.id} missing audioUrl`);
        return;
      }
      
      // Get the layer folder from the track
      const layerFolder = track.layerFolder;
      if (!layerFolder) {
        console.warn(`[CollectionService: formatCollectionForPlayer] Track ${track.id} missing layerFolder`);
        return;
      }
      
      // Map the folder name to player layer name
      const playerLayer = folderToLayerMap[layerFolder];
      if (!playerLayer) {
        console.warn(`[CollectionService: formatCollectionForPlayer] Invalid layer folder: ${layerFolder}`);
        return;
      }
      
      // Format track for player with full Blob Storage URL if needed
      const audioUrl = track.audioUrl.startsWith('http') 
        ? track.audioUrl 
        : `${this.config.blobBaseUrl}${track.audioUrl.startsWith('/') ? '' : '/'}${track.audioUrl}`;
      
      // Use the original track ID without modification
      const formattedTrack = {
        id: track.id, // Don't modify the ID!
        name: track.title || track.name || `Track ${track.id}`,
        path: audioUrl,
        layer: playerLayer // Use the player layer name
      };
      
      // Add to appropriate layer
      playerLayers[playerLayer].push(formattedTrack);
      formattedTrackCount++;
      
      // Process variations if they exist
      if (track.variations && Array.isArray(track.variations)) {
        track.variations.forEach(variation => {
          // Skip invalid variations
          if (!variation.id) {
            console.warn(`[CollectionService: formatCollectionForPlayer] Variation missing id in track ${track.id}`);
            return;
          }
          
          if (!variation.audioUrl) {
            console.warn(`[CollectionService: formatCollectionForPlayer] Variation ${variation.id} missing audioUrl`);
            return;
          }
          
          // Format variation URL
          const variationUrl = variation.audioUrl.startsWith('http') 
            ? variation.audioUrl 
            : `${this.config.blobBaseUrl}${variation.audioUrl.startsWith('/') ? '' : '/'}${variation.audioUrl}`;
          
          // Create variation track
          const variationTrack = {
            id: variation.id,
            name: variation.title || `${track.title || track.name || 'Track'} (Variation)`,
            path: variationUrl,
            layer: playerLayer // Use the same player layer name
          };
          
          // Add variation to the appropriate layer
          playerLayers[playerLayer].push(variationTrack);
          formattedTrackCount++;
        });
      }
    });
    
    // Ensure we have at least one track formatted
    if (formattedTrackCount === 0) {
      console.error('[CollectionService: formatCollectionForPlayer] No valid tracks found in collection');
      throw new Error('No valid audio tracks found in this collection');
    }
    
    // Format the collection for the player
    const formattedCollection = {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      coverImage: collection.coverImage && !collection.coverImage.startsWith('http')
        ? `${this.config.blobBaseUrl}${collection.coverImage.startsWith('/') ? '' : '/'}${collection.coverImage}`
        : collection.coverImage,
      metadata: collection.metadata,
      layers: playerLayers,
      // Keep the original tracks array for reference
      originalTracks: collection.tracks
    };
    
    console.log(`[CollectionService: formatCollectionForPlayer] Formatted ${formattedTrackCount} tracks across ${Object.keys(playerLayers).length} layers`);
    console.log(`[CollectionService: formatCollectionForPlayer] Cover image URL: ${formattedCollection.coverImage}`);
    
    // Return the formatted collection
    return formattedCollection;
  } catch (error) {
    console.error(`[CollectionService: formatCollectionForPlayer] Error: ${error.message}`);
    throw new Error(`Failed to format collection: ${error.message}`);
  }
}
  
  /**
   * Helper method to determine layer from folder structure
   * @private
   * @param {string} audioUrl - Audio file URL or path
   * @returns {string} Layer folder (Layer_1, Layer_2, etc.)
   */
  _getLayerFromFolder(audioUrl) {
    if (!audioUrl) return 'Layer_1'; // Default to Layer_1 if no URL
    
    // Convert to lowercase for case-insensitive matching
    const url = audioUrl.toLowerCase();
    
    // Check for layer folders in the path
    if (url.includes('/layer_1/') || url.includes('/drone/')) return 'Layer_1';
    if (url.includes('/layer_2/') || url.includes('/melody/')) return 'Layer_2';
    if (url.includes('/layer_3/') || url.includes('/rhythm/')) return 'Layer_3';
    if (url.includes('/layer_4/') || url.includes('/nature/')) return 'Layer_4';
    
    // Default to Layer_1 if no match found
    return 'Layer_1';
  }
  
  /**
   * Reset the collection cache
   */
  resetCache() {
    this.collectionsCache = null;
    this.lastCacheTime = 0;
    console.log('[CollectionService: resetCache] Collection cache cleared');
  }
  
  /**
   * Logging helper that respects configuration
   * @private
   * @param {string} message - Message to log
   * @param {string} [level='info'] - Log level
   */
  log(message, level = 'info') {
    if (!this.config.enableLogging) return;
    
    const prefix = '[CollectionService]';
    
    switch (level) {
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      case 'info':
      default:
        console.log(`${prefix} ${message}`);
        break;
    }
  }
}

export default CollectionService;