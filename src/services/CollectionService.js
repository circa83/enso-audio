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
      blobs.forEach(blob => {
        const path = blob.pathname.replace('collections/', '');
        const folder = path.split('/')[0];
        if (folder) {
          folders.add(folder);
        }
      });
      
      console.log(`[CollectionService: _getBlobCollectionFolders] Found ${folders.size} collections`);
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
   * Fetch all collections with optional filtering
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
    
    const endpoint = `${this.config.apiBasePath}/collections/${id}`;
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
        
        // Verify collection has valid files in blob storage
        console.log(`[CollectionService: getCollection] Verifying blob files for collection: ${id}`);
        
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
   * Get the tracks for a specific collection
   * @param {string} collectionId - Collection ID
   * @returns {Promise<Array>} Collection tracks
   */
  async getCollectionTracks(collectionId) {
    if (!collectionId) {
      throw new Error('Collection ID is required');
    }
    
    const endpoint = `${this.config.apiBasePath}/collections/${collectionId}/tracks`;
    console.log(`[CollectionService: getCollectionTracks] Fetching tracks from: ${endpoint}`);
    
    try {
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        if (response.status === 404) {
          return { success: false, error: `Collection with ID '${collectionId}' not found` };
        }
        
        const errorText = await response.text();
        throw new Error(`Failed to fetch tracks: ${response.status} ${response.statusText}. ${errorText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.log(`[CollectionService: getCollectionTracks] Error: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Search collections by name, description, or tags
   * @param {string} query - Search query
   * @param {Object} [options] - Search options
   * @returns {Promise<Array>} Matching collections
   */
  async searchCollections(query, options = {}) {
    if (!query || query.trim() === '') {
      throw new Error('Search query is required');
    }
    
    // If we have cached collections, perform client-side search
    if (this.collectionsCache && 
        Date.now() - this.lastCacheTime < this.config.cacheDuration) {
      console.log(`[CollectionService: searchCollections] Performing client-side search for: ${query}`);
      
      const searchQuery = query.toLowerCase().trim();
      const results = this.collectionsCache.data.filter(collection => {
        // Match against name, description, and tags
        const nameMatch = collection.name?.toLowerCase().includes(searchQuery);
        const descMatch = collection.description?.toLowerCase().includes(searchQuery);
        const tagMatch = collection.metadata?.tags?.some(tag => 
          tag.toLowerCase().includes(searchQuery)
        );
        const artistMatch = collection.metadata?.artist?.toLowerCase().includes(searchQuery);
        
        return nameMatch || descMatch || tagMatch || artistMatch;
      });
      
      // Get blob folders to filter results
      const blobFolders = await this._getBlobCollectionFolders();
      const filteredResults = results.filter(collection => 
        blobFolders.includes(collection.id)
      );
      
      console.log(`[CollectionService: searchCollections] Found ${filteredResults.length} matching collections`);
      
      return {
        success: true,
        data: filteredResults,
        pagination: {
          total: filteredResults.length,
          page: 1,
          limit: filteredResults.length,
          pages: 1
        }
      };
    }
    
    // Otherwise, fetch collections first
    await this.getCollections();
    
    // Then perform client-side search
    return this.searchCollections(query, options);
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
      
      // Group tracks by layer type
      const layers = {
        drone: [],
        melody: [],
        rhythm: [],
        nature: []
      };
      
      // Process tracks if they exist
      if (collection.tracks && Array.isArray(collection.tracks)) {
        collection.tracks.forEach(track => {
          const layerType = track.layerType?.toLowerCase();
          
          // Skip tracks with invalid layer type
          if (!layers[layerType]) {
            console.log(`[CollectionService: formatCollectionForPlayer] Skipping track with invalid layer type: ${layerType}`);
            return;
          }
          
          // Format track for player with full Blob Storage URL if needed
          const audioUrl = track.audioUrl.startsWith('http') 
            ? track.audioUrl 
            : `${this.config.blobBaseUrl}${track.audioUrl.startsWith('/') ? '' : '/'}${track.audioUrl}`;
            
          const formattedTrack = {
            id: track.id,
            name: track.title,
            path: audioUrl
          };
          
          // Add to appropriate layer
          layers[layerType].push(formattedTrack);
          
          // Process variations if they exist
          if (track.variations && Array.isArray(track.variations)) {
            track.variations.forEach(variation => {
              // Format variation URL
              const variationUrl = variation.audioUrl.startsWith('http') 
                ? variation.audioUrl 
                : `${this.config.blobBaseUrl}${variation.audioUrl.startsWith('/') ? '' : '/'}${variation.audioUrl}`;
              
              const variationTrack = {
                id: variation.id,
                name: variation.title || `${track.title} (Variation)`,
                path: variationUrl
              };
              
              layers[layerType].push(variationTrack);
            });
          }
        });
      }
      
      // Format cover image URL
      const coverImage = collection.coverImage 
        ? (collection.coverImage.startsWith('http') 
            ? collection.coverImage 
            : `${this.config.blobBaseUrl}${collection.coverImage.startsWith('/') ? '' : '/'}${collection.coverImage}`)
        : null;
      
      console.log(`[CollectionService: formatCollectionForPlayer] Formatted ${Object.values(layers).flat().length} tracks across ${Object.keys(layers).length} layers`);
      
      return {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        coverImage: coverImage,
        metadata: collection.metadata,
        layers
      };
    } catch (error) {
      console.error(`[CollectionService: formatCollectionForPlayer] Error: ${error.message}`, 'error');
      throw new Error(`Failed to format collection: ${error.message}`);
    }
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