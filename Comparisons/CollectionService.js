/**
 * CollectionService.js
 * 
 * Service for managing audio collections in Ensō Audio
 * Handles fetching, filtering, and processing collection data
 * Enhanced with explicit state management and EventBus integration
 */

import eventBus from './EventBus';

// Event constants specific to collections
const COLLECTION_EVENTS = {
  LOADED: 'collections:loaded',
  LOADING: 'collections:loading',
  ERROR: 'collections:error',
  SELECTED: 'collection:selected',
  FORMATTED: 'collection:formatted',
  CACHE_UPDATED: 'collections:cacheUpdated',
  CACHE_CLEARED: 'collections:cacheCleared',
  FILES_VERIFIED: 'collection:filesVerified'
};

class CollectionService {
  /**
   * Create a new CollectionService instance
   * @param {Object} options - Configuration options
   * @param {string} [options.apiBasePath='/api'] - Base path for API endpoints
   * @param {number} [options.cacheDuration=60000] - Cache duration in milliseconds (default: 1 minute)
   * @param {boolean} [options.enableLogging=false] - Enable detailed console logging
   * @param {boolean} [options.enableEventBus=true] - Enable EventBus communication
   */
  constructor(options = {}) {
    // Configuration
    this.config = {
      apiBasePath: options.apiBasePath || '/api',
      cacheDuration: options.cacheDuration || 60000, // 1 minute default
      enableLogging: options.enableLogging || false,
      enableEventBus: options.enableEventBus !== false, // Enabled by default
      blobBaseUrl: process.env.NEXT_PUBLIC_BLOB_BASE_URL || 'https://uggtzauwx9gzthtf.public.blob.vercel-storage.com'
    };

    // Internal state - private to the service
    this._collectionsCache = null;
    this._lastCacheTime = 0;
    this._pendingRequests = new Map();
    this._loadingState = {
      isLoading: false,
      currentOperation: null,
      error: null
    };
    this._selectedCollection = null;
    
    // Statistics
    this._stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      lastUpdate: Date.now()
    };

    this.log('CollectionService initialized');
  }

  /**
   * Get collection folders from Blob Storage
   * @private
   * @returns {Promise<string[]>} Array of collection folder names
   */
  async _getBlobCollectionFolders() {
    try {
      this._setLoadingState(true, 'fetchBlobCollections');
      this.log('Fetching blob collections');
      
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
      this.log(`Found ${folders.size} collections`);

      // Log the structure of each collection folder
      folderContents.forEach((files, folder) => {
        this.log(`Collection '${folder}' contains ${files.length} files:`);

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

        // Log content structure with reduced detail when logging is enabled
        if (this.config.enableLogging) {
          Object.entries(filesByType).forEach(([type, typeFiles]) => {
            this.log(`  - ${type}: ${typeFiles.length} files`);
            // Log up to 3 examples of each type
            typeFiles.slice(0, 3).forEach(file => {
              this.log(`    • ${file.path} (${file.contentType}, ${(file.size / 1024).toFixed(2)} KB)`);
            });
            if (typeFiles.length > 3) {
              this.log(`    • ... and ${typeFiles.length - 3} more`);
            }
          });
        }
      });
      
      // Emit event for blob collections found
      if (this.config.enableEventBus) {
        eventBus.emit('collections:blobFoldersFound', {
          folders: Array.from(folders),
          folderContents: Object.fromEntries(folderContents),
          count: folders.size,
          timestamp: Date.now()
        });
      }
      
      this._setLoadingState(false);
      return Array.from(folders);
    } catch (error) {
      this.log(`Error fetching blob collections: ${error.message}`, 'error');
      this._setLoadingState(false, null, error);
      
      // Emit error event
      if (this.config.enableEventBus) {
        eventBus.emit(COLLECTION_EVENTS.ERROR, {
          operation: 'fetchBlobCollections',
          message: error.message,
          error,
          timestamp: Date.now()
        });
      }
      
      this._stats.errors++;
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
      this._setLoadingState(true, 'verifyBlobFiles');
      
      // Start with all files valid
      let allFilesValid = true;
      const invalidFiles = [];
      
      // Progress tracking
      let totalTracks = collection.tracks.length;
      let tracksProcessed = 0;
      
      // Tracks additional variations
      collection.tracks.forEach(track => {
        if (track.variations && Array.isArray(track.variations)) {
          totalTracks += track.variations.length;
        }
      });
      
      // Check each track's audio URL
      for (const track of collection.tracks) {
        if (!track.audioUrl) {
          allFilesValid = false;
          invalidFiles.push({ id: track.id, reason: 'Missing audioUrl' });
          continue;
        }

        // Verify the URL is accessible
        try {
          const response = await fetch(track.audioUrl, { method: 'HEAD' });
          
          if (!response.ok) {
            allFilesValid = false;
            invalidFiles.push({ id: track.id, url: track.audioUrl, status: response.status });
          }
          
          // Update progress
          tracksProcessed++;
          if (this.config.enableEventBus) {
            eventBus.emit('collection:fileVerificationProgress', {
              collectionId: collection.id,
              trackId: track.id,
              progress: Math.round((tracksProcessed / totalTracks) * 100),
              totalTracks,
              processed: tracksProcessed
            });
          }
        } catch (err) {
          allFilesValid = false;
          invalidFiles.push({ id: track.id, url: track.audioUrl, error: err.message });
          tracksProcessed++;
        }

        // Check variations if they exist
        if (track.variations) {
          for (const variation of track.variations) {
            if (!variation.audioUrl) {
              allFilesValid = false;
              invalidFiles.push({ id: variation.id, reason: 'Missing audioUrl' });
              continue;
            }

            try {
              const varResponse = await fetch(variation.audioUrl, { method: 'HEAD' });
              
              if (!varResponse.ok) {
                allFilesValid = false;
                invalidFiles.push({ id: variation.id, url: variation.audioUrl, status: varResponse.status });
              }
              
              // Update progress
              tracksProcessed++;
              if (this.config.enableEventBus) {
                eventBus.emit('collection:fileVerificationProgress', {
                  collectionId: collection.id,
                  trackId: variation.id,
                  progress: Math.round((tracksProcessed / totalTracks) * 100),
                  totalTracks,
                  processed: tracksProcessed
                });
              }
            } catch (err) {
              allFilesValid = false;
              invalidFiles.push({ id: variation.id, url: variation.audioUrl, error: err.message });
              tracksProcessed++;
            }
          }
        }
      }
      
      // Emit verification result event
      if (this.config.enableEventBus) {
        eventBus.emit(COLLECTION_EVENTS.FILES_VERIFIED, {
          collectionId: collection.id,
          valid: allFilesValid,
          invalidFiles: invalidFiles.length > 0 ? invalidFiles : null,
          totalFiles: totalTracks,
          timestamp: Date.now()
        });
      }
      
      this._setLoadingState(false);
      return allFilesValid;
    } catch (error) {
      this.log(`Error verifying files: ${error.message}`, 'error');
      this._setLoadingState(false, null, error);
      
      // Emit error event
      if (this.config.enableEventBus) {
        eventBus.emit(COLLECTION_EVENTS.ERROR, {
          operation: 'verifyBlobFiles',
          collectionId: collection.id,
          message: error.message,
          error,
          timestamp: Date.now()
        });
      }
      
      this._stats.errors++;
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
   * Set the loading state and emit appropriate events
   * @private
   * @param {boolean} isLoading - Whether the service is currently loading
   * @param {string|null} operation - Current operation or null if none
   * @param {Error|null} error - Error object if there was an error
   */
  _setLoadingState(isLoading, operation = null, error = null) {
    // Update internal state
    this._loadingState = {
      isLoading,
      currentOperation: operation,
      error: error ? error.message : null,
      errorObj: error || null,
      timestamp: Date.now()
    };
    
    // Emit loading state change event
    if (this.config.enableEventBus) {
      if (isLoading) {
        eventBus.emit(COLLECTION_EVENTS.LOADING, {
          operation,
          timestamp: Date.now()
        });
      } else if (error) {
        eventBus.emit(COLLECTION_EVENTS.ERROR, {
          operation,
          message: error.message,
          error,
          timestamp: Date.now()
        });
      }
    }
  }
  
  /**
   * Update internal cache with collection data
   * @private
   * @param {Object} data - Collection data to cache
   */
  _updateCache(data) {
    this._collectionsCache = data;
    this._lastCacheTime = Date.now();
    this._stats.lastUpdate = Date.now();
    
    // Emit cache updated event
    if (this.config.enableEventBus) {
      eventBus.emit(COLLECTION_EVENTS.CACHE_UPDATED, {
        cacheSize: data.data ? data.data.length : 0,
        timestamp: this._lastCacheTime
      });
    }
    
    this.log(`Updated cache with ${data.data ? data.data.length : 0} collections`);
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
      this._setLoadingState(true, 'getCollections');
      this._stats.totalRequests++;
      // Emit event for collections requested
      if (this.config.enableEventBus) {
        eventBus.emit('collections:requested', {
          filters: { tag, artist, limit, page },
          useCache,
          timestamp: Date.now()
        });
      }

      // Use cache if available and valid
      if (useCache && 
          this._collectionsCache && 
          (Date.now() - this._lastCacheTime < this.config.cacheDuration)) {
        this.log('Using cached collections data');
        this._stats.cacheHits++;
        
        // Filter cached data based on options
        const result = this._filterCachedCollections(this._collectionsCache, { tag, artist, limit, page });
        
        this._setLoadingState(false);
        
        // Emit collections loaded event
        if (this.config.enableEventBus) {
          eventBus.emit(COLLECTION_EVENTS.LOADED, {
            source: 'cache',
            count: result.data.length,
            total: result.total,
            filters: { tag, artist, limit, page },
            timestamp: Date.now()
          });
        }
        
        return result;
      }

      this._stats.cacheMisses++;
      this.log('Fetching fresh collections data');
      
      // Check if we have a pending request
      const requestKey = JSON.stringify({ tag, artist, limit, page });
      if (this._pendingRequests.has(requestKey)) {
        this.log('Reusing pending request');
        const result = await this._pendingRequests.get(requestKey);
        return result;
      }
      
      // Create query parameters
      const queryParams = this._buildQueryString({
        tag,
        artist,
        limit,
        page
      });
      
      // Create the promise for the request
      const requestPromise = new Promise(async (resolve) => {
        try {
          // Determine API endpoint based on configuration
          const endpoint = `${this.config.apiBasePath}/collections${queryParams}`;
          
          const response = await fetch(endpoint);
          
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          // Update cache with fresh data
          this._updateCache(data);
          
          this._setLoadingState(false);
          
          // Emit collections loaded event
          if (this.config.enableEventBus) {
            eventBus.emit(COLLECTION_EVENTS.LOADED, {
              source: 'api',
              count: data.data.length,
              total: data.total,
              filters: { tag, artist, limit, page },
              timestamp: Date.now()
            });
          }
          
          // Resolve with the data
          resolve(data);
        } catch (error) {
          this.log(`Error fetching collections: ${error.message}`, 'error');
          this._stats.errors++;
          this._setLoadingState(false, null, error);
          
          // Create error result
          const errorResult = {
            success: false,
            error: error.message,
            data: [],
            total: 0,
            page: page,
            limit: limit
          };
          
          // Emit error event
          if (this.config.enableEventBus) {
            eventBus.emit(COLLECTION_EVENTS.ERROR, {
              operation: 'getCollections',
              message: error.message,
              error,
              timestamp: Date.now()
            });
          }
          
          // Resolve with error result
          resolve(errorResult);
        } finally {
          // Clean up pending request
          this._pendingRequests.delete(requestKey);
        }
      });
      
      // Store the pending request
      this._pendingRequests.set(requestKey, requestPromise);
      
      // Await the result
      return await requestPromise;
    } catch (error) {
      this.log(`Unexpected error in getCollections: ${error.message}`, 'error');
      this._stats.errors++;
      this._setLoadingState(false, null, error);
      
      // Emit error event
      if (this.config.enableEventBus) {
        eventBus.emit(COLLECTION_EVENTS.ERROR, {
          operation: 'getCollections',
          message: error.message,
          error,
          timestamp: Date.now()
        });
      }
      
      // Return error result
      return {
        success: false,
        error: error.message,
        data: [],
        total: 0,
        page: page || 1,
        limit: limit || 10
      };
    }
  }
  
  /**
   * Filter cached collections based on options
   * @private
   * @param {Object} cachedData - Cached collection data
   * @param {Object} options - Filter options (tag, artist, limit, page)
   * @returns {Object} Filtered collection data
   */
  _filterCachedCollections(cachedData, options = {}) {
    const { tag, artist, limit = 10, page = 1 } = options;
    
    if (!cachedData || !cachedData.data || !Array.isArray(cachedData.data)) {
      return {
        success: false,
        error: 'Invalid cache data',
        data: [],
        total: 0,
        page: page,
        limit: limit
      };
    }
    
    let filteredData = [...cachedData.data];
    
    // Apply tag filter
    if (tag) {
      filteredData = filteredData.filter(
        collection => collection.tags && collection.tags.includes(tag)
      );
    }
    
    // Apply artist filter
    if (artist) {
      filteredData = filteredData.filter(
        collection => collection.artist && 
                      collection.artist.toLowerCase().includes(artist.toLowerCase())
      );
    }
    
    // Calculate total for pagination
    const total = filteredData.length;
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    filteredData = filteredData.slice(startIndex, endIndex);
    
    // Return formatted result
    return {
      success: true,
      data: filteredData,
      total: total,
      page: page,
      limit: limit
    };
  }

  /**
   * Get a specific collection by ID
   * @param {string} id - Collection ID
   * @param {Object} [options] - Fetch options
   * @param {boolean} [options.useCache=true] - Use cached data if available
   * @param {boolean} [options.verifyFiles=false] - Verify audio files exist
   * @returns {Promise<Object>} Collection data
   */
  async getCollection(id, options = {}) {
    const { useCache = true, verifyFiles = false } = options;
    
    if (!id) {
      const error = new Error('Collection ID is required');
      
      // Emit error event
      if (this.config.enableEventBus) {
        eventBus.emit(COLLECTION_EVENTS.ERROR, {
          operation: 'getCollection',
          message: error.message,
          error,
          timestamp: Date.now()
        });
      }
      
      return { success: false, error: error.message };
    }
    
    try {
      this._setLoadingState(true, 'getCollection');
      this._stats.totalRequests++;
      
      // Emit event for collection requested
      if (this.config.enableEventBus) {
        eventBus.emit('collection:requested', {
          id,
          useCache,
          verifyFiles,
          timestamp: Date.now()
        });
      }
      
      // Check cache first if enabled
      if (useCache && this._collectionsCache && this._lastCacheTime) {
        // Check if collection is in cache
        const cachedCollection = this._collectionsCache.data.find(c => c.id === id);
        
        if (cachedCollection && (Date.now() - this._lastCacheTime < this.config.cacheDuration)) {
          this.log(`Using cached data for collection ${id}`);
          this._stats.cacheHits++;
          
          // Set as selected collection
          this._selectedCollection = cachedCollection;
          
          // Emit selected event
          if (this.config.enableEventBus) {
            eventBus.emit(COLLECTION_EVENTS.SELECTED, {
              id,
              name: cachedCollection.name,
              source: 'cache',
              timestamp: Date.now()
            });
          }
          
          // Verify files if requested
          if (verifyFiles) {
            this.log(`Verifying audio files for collection ${id}`);
            const filesValid = await this._verifyBlobFiles(cachedCollection);
            
            // Include file verification in result
            const result = {
              success: true,
              data: cachedCollection,
              filesVerified: true,
              filesValid
            };
            
            this._setLoadingState(false);
            return result;
          }
          
          this._setLoadingState(false);
          return { success: true, data: cachedCollection };
        }
      }
      
      this._stats.cacheMisses++;
      this.log(`Fetching collection data for ID: ${id}`);
      
      // Check for pending request
      const requestKey = `collection-${id}`;
      if (this._pendingRequests.has(requestKey)) {
        this.log('Reusing pending request');
        return await this._pendingRequests.get(requestKey);
      }
      
      // Create the promise for the request
      const requestPromise = new Promise(async (resolve) => {
        try {
          // Fetch the collection data
          const endpoint = `${this.config.apiBasePath}/collections/${id}`;
          const response = await fetch(endpoint);
          
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          // Set as selected collection
          this._selectedCollection = data.data;
          
          // Emit selected event
          if (this.config.enableEventBus) {
            eventBus.emit(COLLECTION_EVENTS.SELECTED, {
              id,
              name: data.data.name,
              source: 'api',
              timestamp: Date.now()
            });
          }
          
          // Verify files if requested
          if (verifyFiles && data.success && data.data) {
            this.log(`Verifying audio files for collection ${id}`);
            const filesValid = await this._verifyBlobFiles(data.data);
            
            // Include file verification in result
            data.filesVerified = true;
            data.filesValid = filesValid;
          }
          
          this._setLoadingState(false);
          resolve(data);
        } catch (error) {
          this.log(`Error fetching collection ${id}: ${error.message}`, 'error');
          this._stats.errors++;
          this._setLoadingState(false, null, error);
          
          // Emit error event
          if (this.config.enableEventBus) {
            eventBus.emit(COLLECTION_EVENTS.ERROR, {
              operation: 'getCollection',
              id,
              message: error.message,
              error,
              timestamp: Date.now()
            });
          }
          
          // Resolve with error result
          resolve({
            success: false,
            error: error.message
          });
        } finally {
          // Clean up pending request
          this._pendingRequests.delete(requestKey);
        }
      });
      
      // Store the pending request
      this._pendingRequests.set(requestKey, requestPromise);
      
      // Await the result
      return await requestPromise;
    } catch (error) {
      this.log(`Unexpected error in getCollection: ${error.message}`, 'error');
      this._stats.errors++;
      this._setLoadingState(false, null, error);
      
      // Emit error event
      if (this.config.enableEventBus) {
        eventBus.emit(COLLECTION_EVENTS.ERROR, {
          operation: 'getCollection',
          id,
          message: error.message,
          error,
          timestamp: Date.now()
        });
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Format a collection for use in the audio player
   * Maps collection tracks to audio layers
   * @param {Object} collection - Collection data
   * @returns {Object} Formatted collection with layers for the player
   */
  formatCollectionForPlayer(collection) {
    if (!collection || !collection.tracks) {
      this.log('Invalid collection data for formatting', 'warn');
      
      // Emit error event
      if (this.config.enableEventBus) {
        eventBus.emit(COLLECTION_EVENTS.ERROR, {
          operation: 'formatCollectionForPlayer',
          message: 'Invalid collection data',
          timestamp: Date.now()
        });
      }
      
      return null;
    }
    
    this.log(`Formatting collection for player: ${collection.name || collection.id}`);
    
    try {
      // Initialize layers structure
      const layers = {
        Layer_1: [],
        Layer_2: [],
        Layer_3: [],
        Layer_4: []
      };
      
      // Process tracks by layer folder
      collection.tracks.forEach(track => {
        const layerFolder = track.layerFolder || this._deriveLayerFolder(track);
        
        // Skip tracks with invalid layer folder
        if (!layers[layerFolder]) {
          this.log(`Unknown layer folder: ${layerFolder} for track ${track.id}`, 'warn');
          return;
        }
        
        // Format track for player
        const formattedTrack = {
          id: track.id,
          name: track.title,
          path: track.audioUrl,
          duration: track.duration,
          bpm: track.bpm,
          key: track.key
        };
        
        // Add to appropriate layer
        layers[layerFolder].push(formattedTrack);
        
        // Process variations if they exist
        if (track.variations && Array.isArray(track.variations)) {
          track.variations.forEach(variation => {
            const variationTrack = {
              id: variation.id,
              name: variation.title || `${track.title} (Variation)`,
              path: variation.audioUrl,
              duration: variation.duration,
              bpm: variation.bpm || track.bpm,
              key: variation.key || track.key,
              isVariation: true,
              parentId: track.id
            };
            
            layers[layerFolder].push(variationTrack);
          });
        }
      });
      
      // Create the formatted collection
      const formattedCollection = {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        coverImage: collection.coverImage,
        artist: collection.artist,
        tags: collection.tags,
        category: collection.category,
        duration: collection.duration,
        layers: layers
      };
      
      // Log layer statistics
      this.log(`Formatted collection: ${collection.name} with layers:`, 'info');
      Object.entries(layers).forEach(([layer, tracks]) => {
        this.log(`  ${layer}: ${
tracks.length} tracks`);
});

// Emit event for formatted collection
if (this.config.enableEventBus) {
  eventBus.emit(COLLECTION_EVENTS.FORMATTED, {
    collectionId: collection.id,
    name: collection.name,
    layerCount: Object.keys(layers).length,
    trackCounts: Object.fromEntries(
      Object.entries(layers).map(([layer, tracks]) => [layer, tracks.length])
    ),
    timestamp: Date.now()
  });
}

return formattedCollection;
} catch (error) {
this.log(`Error formatting collection: ${error.message}`, 'error');
this._stats.errors++;

// Emit error event
if (this.config.enableEventBus) {
  eventBus.emit(COLLECTION_EVENTS.ERROR, {
    operation: 'formatCollectionForPlayer',
    collectionId: collection.id,
    message: error.message,
    error,
    timestamp: Date.now()
  });
}

return null;
}
}

/**
* Derive the layer folder from track properties
* @private
* @param {Object} track - Track data
* @returns {string} Derived layer folder name
*/
_deriveLayerFolder(track) {
// Use explicit layer folder if available
if (track.layerFolder) return track.layerFolder;

// Try to derive from track type or tags
if (track.type) {
switch (track.type.toLowerCase()) {
  case 'drone':
  case 'background':
  case 'base':
    return 'Layer_1';
  case 'melody':
  case 'lead':
    return 'Layer_2';
  case 'rhythm':
  case 'percussion':
  case 'drums':
    return 'Layer_3';
  case 'nature':
  case 'ambient':
  case 'environment':
  case 'effects':
    return 'Layer_4';
}
}

// Check tags if available
if (track.tags && Array.isArray(track.tags)) {
const tagStr = track.tags.join(' ').toLowerCase();

if (tagStr.includes('drone') || tagStr.includes('background') || tagStr.includes('base')) {
  return 'Layer_1';
}
if (tagStr.includes('melody') || tagStr.includes('lead')) {
  return 'Layer_2';
}
if (tagStr.includes('rhythm') || tagStr.includes('percussion') || tagStr.includes('drums')) {
  return 'Layer_3';
}
if (tagStr.includes('nature') || tagStr.includes('ambient') || 
    tagStr.includes('environment') || tagStr.includes('effects')) {
  return 'Layer_4';
}
}

// Default to Layer_1 for unknown types
return 'Layer_1';
}

/**
* Resolve URLs for tracks in a collection
* Ensures all audio URLs are correct absolute URLs
* @param {Object} collection - Collection data to process
* @returns {Object} Collection with resolved URLs
*/
resolveCollectionUrls(collection) {
if (!collection) return null;

this.log(`Resolving URLs for collection: ${collection.name || collection.id}`);

try {
// Handle both formatted and raw collections
const tracks = collection.tracks || [];
const layers = collection.layers || {};

// Collection has layers structure (already formatted)
if (Object.keys(layers).length > 0) {
  Object.entries(layers).forEach(([layer, layerTracks]) => {
    layerTracks.forEach(track => {
      if (track.path) {
        track.path = this._resolveAudioUrl(track.path);
      }
    });
  });
}

// Collection has tracks array
tracks.forEach(track => {
  if (track.audioUrl) {
    track.audioUrl = this._resolveAudioUrl(track.audioUrl);
  }
  
  // Resolve variation URLs if they exist
  if (track.variations && Array.isArray(track.variations)) {
    track.variations.forEach(variation => {
      if (variation.audioUrl) {
        variation.audioUrl = this._resolveAudioUrl(variation.audioUrl);
      }
    });
  }
});

// Resolve cover image URL if it exists
if (collection.coverImage) {
  collection.coverImage = this._resolveImageUrl(collection.coverImage);
}

// Emit event for resolved URLs
if (this.config.enableEventBus) {
  eventBus.emit('collection:urlsResolved', {
    collectionId: collection.id,
    name: collection.name,
    timestamp: Date.now()
  });
}

return collection;
} catch (error) {
this.log(`Error resolving collection URLs: ${error.message}`, 'error');
this._stats.errors++;

// Emit error event
if (this.config.enableEventBus) {
  eventBus.emit(COLLECTION_EVENTS.ERROR, {
    operation: 'resolveCollectionUrls',
    collectionId: collection ? collection.id : 'unknown',
    message: error.message,
    error,
    timestamp: Date.now()
  });
}

// Return original collection as fallback
return collection;
}
}

/**
* Resolve a relative audio URL to an absolute URL
* @private
* @param {string} url - URL to resolve
* @returns {string} Resolved absolute URL
*/
_resolveAudioUrl(url) {
if (!url) return url;

// Already an absolute URL
if (url.startsWith('http://') || url.startsWith('https://')) {
return url;
}

// Blob storage URL
if (url.startsWith('/') && (
  url.includes('/collections/') || 
  url.includes('/samples/') || 
  url.includes('/audio/'))) {
return `${this.config.blobBaseUrl}${url}`;
}

// Public folder URL
if (url.startsWith('/')) {
return url;
}

// Relative URL without leading slash
return `/${url}`;
}

/**
* Resolve a relative image URL to an absolute URL
* @private
* @param {string} url - URL to resolve
* @returns {string} Resolved absolute URL
*/
_resolveImageUrl(url) {
if (!url) return url;

// Already an absolute URL
if (url.startsWith('http://') || url.startsWith('https://')) {
return url;
}

// Blob storage URL for collection images
if (url.startsWith('/') && (
  url.includes('/collections/') || 
  url.includes('/images/'))) {
return `${this.config.blobBaseUrl}${url}`;
}

// Public folder URL
if (url.startsWith('/')) {
return url;
}

// Relative URL without leading slash
return `/${url}`;
}

/**
* Get current loading state
* Useful for UI components to show loading indicators
* @returns {Object} Current loading state
*/
getLoadingState() {
return { 
...this._loadingState,
timestamp: Date.now()
};
}

/**
* Get currently selected collection
* @returns {Object|null} Selected collection or null if none selected
*/
getSelectedCollection() {
return this._selectedCollection;
}

/**
* Check if collection data is cached
* @returns {boolean} True if collections are cached
*/
hasCachedData() {
return Boolean(
this._collectionsCache && 
(Date.now() - this._lastCacheTime < this.config.cacheDuration)
);
}

/**
* Get service statistics
* @returns {Object} Service statistics
*/
getStats() {
return {
...this._stats,
cacheAge: this._lastCacheTime ? Date.now() - this._lastCacheTime : null,
isCacheValid: this.hasCachedData(),
pendingRequests: this._pendingRequests.size
};
}

/**
* Reset the cache to force fresh data fetching
*/
resetCache() {
this._collectionsCache = null;
this._lastCacheTime = 0;

// Emit cache cleared event
if (this.config.enableEventBus) {
eventBus.emit(COLLECTION_EVENTS.CACHE_CLEARED, {
  timestamp: Date.now()
});
}

this.log('Collection cache reset');
}

/**
* Clean up service resources
*/
dispose() {
this.resetCache();
this._pendingRequests.clear();
this._selectedCollection = null;
this.log('CollectionService disposed');
}

/**
* Logging helper that respects configuration
* @param {string} message - Message to log
* @param {string} [level='info'] - Log level: 'info', 'warn', 'error'
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

// Export the event constants
export { COLLECTION_EVENTS };

// Export the service as default
export default CollectionService;
