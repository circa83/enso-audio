/**
 * CollectionService.js
 * 
 * Service for managing audio collections in Ensō Audio
 * Handles fetching, filtering, and processing collection data
 */

import collectionsData from '../../public/collections/collections.json';

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
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL || ''
    };
    
    // Internal state
    this.collectionsCache = null;
    this.lastCacheTime = 0;
    this.pendingRequests = new Map();
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
      // Check cache if enabled
      if (useCache && 
          this.collectionsCache && 
          Date.now() - this.lastCacheTime < this.config.cacheDuration) {
        console.log(`[CollectionService: getCollections] Using cached collections data (${this.collectionsCache.data.length} items)`);
        return this.collectionsCache;
      }
      
      // Filter collections based on options
      let filteredCollections = [...collectionsData];
      
      if (tag) {
        filteredCollections = filteredCollections.filter(collection => 
          collection.metadata?.tags?.includes(tag)
        );
      }
      
      if (artist) {
        filteredCollections = filteredCollections.filter(collection => 
          collection.metadata?.artist?.toLowerCase() === artist.toLowerCase()
        );
      }
      
      // Apply pagination
      const startIndex = (page - 1) * limit;
      const paginatedCollections = filteredCollections.slice(startIndex, startIndex + limit);
      
      const result = {
        success: true,
        data: paginatedCollections,
        pagination: {
          total: filteredCollections.length,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(filteredCollections.length / parseInt(limit))
        }
      };
      
      // Update cache
      this.collectionsCache = result;
      this.lastCacheTime = Date.now();
      
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
   * Get a specific collection by ID
   * @param {string} id - Collection ID
   * @param {boolean} [useCache=true] - Use cached data if possible
   * @returns {Promise<Object>} Collection data
   */
  async getCollection(id, useCache = true) {
    if (!id) {
      throw new Error('Collection ID is required');
    }
    
    try {
      // Find the collection in the data
      const collection = collectionsData.find(c => c.id === id);
      
      if (!collection) {
        return { 
          success: false, 
          error: `Collection with ID '${id}' not found` 
        };
      }
      
      // Ensure all URLs are absolute
      const baseUrl = this.config.baseUrl;
      
      // Process tracks
      collection.tracks = collection.tracks.map(track => {
        // Convert relative URLs to absolute
        if (!track.audioUrl.startsWith('http')) {
          track.audioUrl = `${baseUrl}${track.audioUrl}`;
        }
        
        // Handle variations
        if (track.variations) {
          track.variations = track.variations.map(variation => {
            if (!variation.audioUrl.startsWith('http')) {
              variation.audioUrl = `${baseUrl}${variation.audioUrl}`;
            }
            return variation;
          });
        }
        return track;
      });
      
      // Convert cover image URL to absolute if needed
      if (collection.coverImage && !collection.coverImage.startsWith('http')) {
        collection.coverImage = `${baseUrl}${collection.coverImage}`;
      }
      
      return {
        success: true,
        data: collection
      };
    } catch (error) {
      console.error(`[CollectionService: getCollection] Error: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
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
    
    try {
      const searchQuery = query.toLowerCase().trim();
      
      const results = collectionsData.filter(collection => {
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
    } catch (error) {
      console.error(`[CollectionService: searchCollections] Error: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
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
            : `${this.config.baseUrl}${track.audioUrl.startsWith('/') ? '' : '/'}${track.audioUrl}`;
            
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
                : `${this.config.baseUrl}${variation.audioUrl.startsWith('/') ? '' : '/'}${variation.audioUrl}`;
              
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
            : `${this.config.baseUrl}${collection.coverImage.startsWith('/') ? '' : '/'}${collection.coverImage}`)
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