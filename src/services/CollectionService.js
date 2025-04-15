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
        enableLogging: options.enableLogging || false
      };
      
      // Internal state
      this.collectionsCache = null;
      this.lastCacheTime = 0;
      this.pendingRequests = new Map();
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
        limit,
        page
      } = options;
      
      // Generate cache key based on filter options
      const cacheKey = JSON.stringify({ tag, artist, limit, page });
      
      // Check cache if enabled
      if (useCache && 
          this.collectionsCache && 
          Date.now() - this.lastCacheTime < this.config.cacheDuration &&
          !tag && !artist && !limit && !page) {
        this.log(`[getCollections] Using cached collections data (${this.collectionsCache.data.length} items)`);
        return this.collectionsCache;
      }
      
      // Check for pending request with same parameters
      if (this.pendingRequests.has(cacheKey)) {
        this.log(`[getCollections] Using pending request for key: ${cacheKey}`);
        return this.pendingRequests.get(cacheKey);
      }
      
      // Build query string for filters
      const queryParams = new URLSearchParams();
      if (tag) queryParams.append('tag', tag);
      if (artist) queryParams.append('artist', artist);
      if (limit) queryParams.append('limit', limit);
      if (page) queryParams.append('page', page);
      
      const queryString = queryParams.toString();
      const endpoint = `${this.config.apiBasePath}/collections${queryString ? `?${queryString}` : ''}`;
      
      this.log(`[getCollections] Fetching collections from: ${endpoint}`);
      
      // Create request promise
      const requestPromise = (async () => {
        try {
          const response = await fetch(endpoint);
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch collections: ${response.status} ${response.statusText}. ${errorText}`);
          }
          
          const data = await response.json();
          
          // Update cache if this was a full request (no filters)
          if (!tag && !artist && !limit && !page) {
            this.collectionsCache = data;
            this.lastCacheTime = Date.now();
            this.log(`[getCollections] Updated cache with ${data.data.length} collections`);
          }
          
          return data;
        } catch (error) {
          this.log(`[getCollections] Error: ${error.message}`, 'error');
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
      
      const endpoint = `${this.config.apiBasePath}/collections/${id}`;
      this.log(`[getCollection] Fetching collection from: ${endpoint}`);
      
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
          return data;
        } catch (error) {
          this.log(`[getCollection] Error: ${error.message}`, 'error');
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
      this.log(`[getCollectionTracks] Fetching tracks from: ${endpoint}`);
      
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
        this.log(`[getCollectionTracks] Error: ${error.message}`, 'error');
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
        this.log(`[searchCollections] Performing client-side search for: ${query}`);
        
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
        
        return {
          success: true,
          data: results,
          pagination: {
            total: results.length,
            page: 1,
            limit: results.length,
            pages: 1
          }
        };
      }
      
      // Otherwise, fetch collections first
      const collections = await this.getCollections();
      
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
            if (!layers[layerType]) return;
            
            // Format track for player
            const formattedTrack = {
              id: track.id,
              name: track.title,
              path: track.audioUrl
            };
            
            // Add to appropriate layer
            layers[layerType].push(formattedTrack);
            
            // Process variations if they exist
            if (track.variations && Array.isArray(track.variations)) {
              track.variations.forEach(variation => {
                const variationTrack = {
                  id: variation.id,
                  name: variation.title,
                  path: variation.audioUrl
                };
                
                layers[layerType].push(variationTrack);
              });
            }
          });
        }
        
        return {
          id: collection.id,
          name: collection.name,
          description: collection.description,
          coverImage: collection.coverImage,
          metadata: collection.metadata,
          layers
        };
      } catch (error) {
        this.log(`[formatCollectionForPlayer] Error: ${error.message}`, 'error');
        throw new Error(`Failed to format collection: ${error.message}`);
      }
    }
    
    /**
     * Reset the collection cache
     */
    resetCache() {
      this.collectionsCache = null;
      this.lastCacheTime = 0;
      this.log('[resetCache] Collection cache cleared');
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