/**
 * CollectionService.js
 * 
 * Service for managing audio collections in Ensō Audio
 * Handles fetching, filtering, and processing collection data
 */
import eventBus, { EVENTS } from './EventBus';
import AppConfig from '../config/appConfig';


class CollectionService {
  /**
   * Create a new CollectionService instance
   * @param {Object} options - Configuration options
   * @param {string} [options.apiBasePath='/api'] - Base path for API endpoints
   * @param {number} [options.cacheDuration=60000] - Cache duration in milliseconds (default: 1 minute)
   * @param {boolean} [options.enableLogging=false] - Enable detailed console logging
   * @param {boolean} [options.enableLocalStorage=true] - Enable local storage collections
   * @param {string} [options.localStorageKey='enso_collections'] - Key for storing collections in localStorage
   */
  constructor(options = {}) {
    // Configuration
    this.config = {
      apiBasePath: options.apiBasePath || '/api',
      cacheDuration: options.cacheDuration || 60000, // 1 minute default
      enableLogging: options.enableLogging || false,
      blobBaseUrl: process.env.NEXT_PUBLIC_BLOB_BASE_URL || 'https://uggtzauwx9gzthtf.public.blob.vercel-storage.com',
      // Local storage configuration
      enableLocalStorage: options.enableLocalStorage !== false, // Enable by default
      localStorageKey: options.localStorageKey || '/collections'
    };

    // Internal state
    this.collectionsCache = null;
    this.lastCacheTime = 0;
    this.pendingRequests = new Map();
    this.localCollections = new Map(); // Storage for local collections

    this.log('CollectionService initialized');

    // Load local collections if enabled
    if (this.config.enableLocalStorage && typeof window !== 'undefined') {
      this._loadLocalCollections();
    }

    // Emit initialization event
    eventBus.emit(EVENTS.COLLECTION_INITIALIZED || 'collection:initialized', {
      config: {
        apiBasePath: this.config.apiBasePath,
        cacheDuration: this.config.cacheDuration,
        enableLogging: this.config.enableLogging,
        enableLocalStorage: this.config.enableLocalStorage
      },
      timestamp: Date.now()
    });
  }

  /**
   * Get collection folders from Blob Storage
   * @private
   * @returns {Promise<string[]>} Array of collection folder names
   */
  async _getBlobCollectionFolders() {
    try {
      this.log('Fetching blob collections');
      eventBus.emit(EVENTS.COLLECTION_BLOB_FETCH_START || 'collection:blobFetchStart', {
        timestamp: Date.now()
      });

      const response = await fetch('/api/blob/list?prefix=collections/');

      if (!response.ok) {
        const error = `HTTP error ${response.status}`;
        eventBus.emit(EVENTS.COLLECTION_BLOB_FETCH_ERROR || 'collection:blobFetchError', {
          error,
          status: response.status,
          timestamp: Date.now()
        });
        throw new Error(error);
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

      // Emit success event
      eventBus.emit(EVENTS.COLLECTION_BLOB_FETCH_SUCCESS || 'collection:blobFetchSuccess', {
        folderCount: folders.size,
        folders: Array.from(folders),
        timestamp: Date.now()
      });

      return Array.from(folders);
    } catch (error) {
      this.log(`Error fetching blob collections: ${error.message}`, 'error');
      // Error event already emitted in the initial error case
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
      eventBus.emit(EVENTS.COLLECTION_VERIFY_START || 'collection:verifyStart', {
        collectionId: collection.id,
        trackCount: collection.tracks.length,
        timestamp: Date.now()
      });

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

      eventBus.emit(EVENTS.COLLECTION_VERIFY_SUCCESS || 'collection:verifySuccess', {
        collectionId: collection.id,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      this.log(`Error verifying files: ${error.message}`, 'error');

      eventBus.emit(EVENTS.COLLECTION_VERIFY_ERROR || 'collection:verifyError', {
        collectionId: collection.id,
        error: error.message,
        timestamp: Date.now()
      });

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
   * Load collections from localStorage
   * @private
   */
  _loadLocalCollections() {
    try {
      const storedData = localStorage.getItem(this.config.localStorageKey);
      if (!storedData) return;

      const collections = JSON.parse(storedData);

      if (Array.isArray(collections)) {
        // Handle array format
        collections.forEach(collection => {
          if (collection && collection.id) {
            this.localCollections.set(collection.id, collection);
          }
        });
      } else if (typeof collections === 'object') {
        // Handle object format
        Object.entries(collections).forEach(([id, collection]) => {
          if (collection) {
            this.localCollections.set(id, collection);
          }
        });
      }

      this.log(`Loaded ${this.localCollections.size} collections from localStorage`);

      // Emit loaded event
      eventBus.emit(EVENTS.COLLECTION_LOCAL_LOADED || 'collection:localLoaded', {
        count: this.localCollections.size,
        timestamp: Date.now()
      });
    } catch (error) {
      this.log(`Error loading local collections: ${error.message}`, 'error');

      // Emit error event
      eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
        source: 'localStorage',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Save collections to localStorage
   * @private
   */
  _saveLocalCollections() {
    if (typeof window === 'undefined') return;

    try {
      const collections = Array.from(this.localCollections.values());
      localStorage.setItem(this.config.localStorageKey, JSON.stringify(collections));

      this.log(`Saved ${collections.length} collections to localStorage`);

      // Emit saved event
      eventBus.emit(EVENTS.COLLECTION_LOCAL_SAVED || 'collection:localSaved', {
        count: collections.length,
        timestamp: Date.now()
      });
    } catch (error) {
      this.log(`Error saving local collections: ${error.message}`, 'error');

      // Emit error event
      eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
        operation: 'saveLocal',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get all local collections
   * @returns {Array} Array of collection objects
   */
  getLocalCollections() {
    return Array.from(this.localCollections.values());
  }

  /**
   * Get a local collection by ID
   * @param {string} id - Collection ID
   * @returns {Object|null} Collection object or null if not found
   */
  getLocalCollection(id) {
    return this.localCollections.get(id) || null;
  }

  /**
   * Save a collection to localStorage
   * @param {Object} collection - Collection object to save
   * @returns {Object} Saved collection with ID
   */
  saveLocalCollection(collection) {
    if (!collection) {
      throw new Error('Collection data is required');
    }

    // Ensure collection has an ID
    const collectionToSave = { ...collection };
    if (!collectionToSave.id) {
      collectionToSave.id = `local_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }

    // Add local source marker
    collectionToSave.source = 'local';
    collectionToSave.updatedAt = new Date().toISOString();

    if (!collectionToSave.createdAt) {
      collectionToSave.createdAt = collectionToSave.updatedAt;
    }

    // Save to local map
    this.localCollections.set(collectionToSave.id, collectionToSave);

    // Persist to localStorage
    this._saveLocalCollections();

    this.log(`Saved collection '${collectionToSave.name}' (${collectionToSave.id}) to localStorage`);

    // Emit saved event
    eventBus.emit(EVENTS.COLLECTION_LOCAL_SAVED || 'collection:localSaved', {
      id: collectionToSave.id,
      name: collectionToSave.name,
      timestamp: Date.now()
    });

    return collectionToSave;
  }

  /**
   * Delete a local collection
   * @param {string} id - Collection ID to delete
   * @returns {boolean} True if collection was deleted
   */
  deleteLocalCollection(id) {
    if (!this.localCollections.has(id)) {
      return false;
    }

    // Get collection for event
    const collection = this.localCollections.get(id);

    // Remove from map
    this.localCollections.delete(id);

    // Save updated collections
    this._saveLocalCollections();

    this.log(`Deleted local collection: ${id}`);

    // Emit deleted event
    eventBus.emit(EVENTS.COLLECTION_LOCAL_DELETED || 'collection:localDeleted', {
      id,
      name: collection.name,
      timestamp: Date.now()
    });

    return true;
  }


/**
 * Get all collections with optional filtering
 * @param {Object} [options] - Fetch options
 * @param {boolean} [options.useCache=true] - Use cached data if available
 * @param {string} [options.tag] - Filter by tag
 * @param {string} [options.artist] - Filter by artist name
 * @param {number} [options.limit] - Maximum number of results
 * @param {number} [options.page] - Page number for pagination
 * @param {string} [options.source='all'] - Source filter: 'all', 'blob', or 'local'
 * @returns {Promise<Object>} Collections data with pagination info
 */
async getCollections(options = {}) {
  const {
    useCache = true,
    tag,
    artist,
    limit = 10,
    page = 1,
    source = 'all' // New parameter to filter by source
  } = options;

  // Emit fetch start event
  eventBus.emit(EVENTS.COLLECTIONS_LOADED || 'collections:loadStart', {
    options,
    useCache,
    timestamp: Date.now()
  });

  try {
    // Initialize collections array
    let collections = [];
    
    // If we want blob collections (all or blob)
    if (source === 'all' || source === 'blob') {
      // First, get the list of collections from Vercel Blob Storage
      const blobFolders = await this._getBlobCollectionFolders();
      this.log(`Found ${blobFolders.length} collections in Blob Storage`);

      if (blobFolders.length > 0) {
        // Check cache if enabled for blob collections
        if (useCache &&
          this.collectionsCache &&
          Date.now() - this.lastCacheTime < this.config.cacheDuration &&
          !tag && !artist) {
          this.log(`Using cached collections data (${this.collectionsCache.data.length} items)`);

          // Filter the cached data by blob folders
          collections = this.collectionsCache.data.filter(collection =>
            blobFolders.includes(collection.id)
          );
        } else {
          // Fetch from API
          const apiData = await this._fetchCollectionsFromAPI(options);

          // Filter to only include collections that exist in blob storage
          const blobCollections = apiData.data.filter(collection =>
            blobFolders.includes(collection.id)
          );
          
          // Add source information
          blobCollections.forEach(collection => {
            collection.source = 'blob';
          });
          
          collections = blobCollections;
        }
      }
    }
    
    // If we want local collections (all or local)
    if (source === 'all' || source === 'local') {
      // Get collections from localStorage
      const localCollections = this.getLocalCollections();
      
      // Add to collections array
      collections = [...collections, ...localCollections];
    }
    
    // Apply filtering
    if (tag || artist) {
      collections = this._filterCollections(collections, { tag, artist });
    }
    
    // Apply pagination
    const total = collections.length;
    const pages = Math.ceil(total / parseInt(limit));
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedCollections = collections.slice(startIndex, endIndex);

    // Create result object
    const result = {
      success: true,
      data: paginatedCollections,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages
      },
      sources: {
        blob: collections.filter(c => c.source === 'blob').length,
        local: collections.filter(c => c.source === 'local').length
      }
    };

    // Update cache if appropriate
    if (source === 'all' && !tag && !artist) {
      this.collectionsCache = result;
      this.lastCacheTime = Date.now();
      this.log(`Updated cache with ${paginatedCollections.length} collections`);
      
      // Emit cache update event
      eventBus.emit(EVENTS.COLLECTION_CACHE_UPDATED || 'collection:cacheUpdated', {
        count: paginatedCollections.length,
        timestamp: Date.now()
      });
    }

    // Emit collections loaded event
    eventBus.emit(EVENTS.COLLECTIONS_LOADED || 'collections:loaded', {
      count: paginatedCollections.length,
      useCache,
      fromCache: false,
      filters: { tag, artist, source },
      timestamp: Date.now()
    });

    return result;
  } catch (error) {
    this.log(`Error getting collections: ${error.message}`, 'error');
    
    // Emit error event
    eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
      error: error.message,
      options,
      timestamp: Date.now()
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Helper method to filter collections
 * @private
 * @param {Array} collections - Array of collections to filter
 * @param {Object} filters - Filter options
 * @returns {Array} Filtered collections
 */
_filterCollections(collections, filters = {}) {
  const { tag, artist } = filters;
  let filtered = [...collections];
  
  if (tag) {
    filtered = filtered.filter(collection => 
      collection.tags && 
      Array.isArray(collection.tags) && 
      collection.tags.includes(tag)
    );
  }
  
  if (artist) {
    filtered = filtered.filter(collection => 
      collection.artist && 
      collection.artist.toLowerCase().includes(artist.toLowerCase())
    );
  }
  
  return filtered;
}

/**
 * Helper method to fetch collections from API
 * @private
 * @param {Object} options - API request options
 * @returns {Promise<Object>} API response
 */
async _fetchCollectionsFromAPI(options = {}) {
  const endpoint = `${this.config.apiBasePath}/collections${this._buildQueryString(options)}`;
  this.log(`Fetching collections from API: ${endpoint}`);
  
  // Emit API fetch start event
  eventBus.emit(EVENTS.COLLECTION_API_FETCH_START || 'collection:apiFetchStart', {
    endpoint,
    options,
    timestamp: Date.now()
  });

  const response = await fetch(endpoint);

  if (!response.ok) {
    const errorMsg = `API error: ${response.status}`;
    // Emit API error event
    eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
      status: response.status,
      endpoint,
      options,
      error: errorMsg,
      timestamp: Date.now()
    });
    
    throw new Error(errorMsg);
  }

  return await response.json();
}

 /**
 * Get a specific collection by ID with its tracks
 * @param {string} id - Collection ID
 * @param {boolean} [useCache=true] - Use cached data if possible
 * @returns {Promise<Object>} Collection data with tracks
 */
async getCollection(id, useCache = true) {
  if (!id) {
    const error = 'Collection ID is required';
    eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
      id,
      error,
      timestamp: Date.now()
    });
    throw new Error(error);
  }

  // Emit collection fetch start event
  eventBus.emit(EVENTS.COLLECTION_SELECTED || 'collection:fetchStart', {
    id,
    useCache,
    timestamp: Date.now()
  });
  
  // First check if this is a local collection
  if (this.config.enableLocalStorage && this.localCollections.has(id)) {
    const localCollection = this.localCollections.get(id);
    this.log(`Found local collection: ${id}`);
    
    // Emit local collection loaded event
    eventBus.emit(EVENTS.COLLECTION_SELECTED || 'collection:loaded', {
      id,
      name: localCollection.name,
      source: 'local',
      trackCount: localCollection.tracks?.length || 0,
      timestamp: Date.now()
    });
    
    return { success: true, data: localCollection, source: 'local' };
  }
  
  // If not local, check cache for blob collection
  if (useCache &&
    this.collectionsCache &&
    Date.now() - this.lastCacheTime < this.config.cacheDuration) {
    const cachedCollection = this.collectionsCache.data.find(c => c.id === id);
    if (cachedCollection) {
      this.log(`Using cached data for collection: ${id}`);
      
      // Emit cache hit event
      eventBus.emit(EVENTS.COLLECTION_CACHE_HIT || 'collection:cacheHit', {
        id,
        name: cachedCollection.name,
        timestamp: Date.now()
      });
      
      return { success: true, data: cachedCollection, source: 'blob' };
    }
  }

  // Check for pending request
  const cacheKey = `collection:${id}`;
  if (this.pendingRequests.has(cacheKey)) {
    this.log(`Using pending request for: ${id}`);
    return this.pendingRequests.get(cacheKey);
  }

  // First verify this collection exists in blob storage
  const blobFolders = await this._getBlobCollectionFolders();
  if (!blobFolders.includes(id)) {
    this.log(`Collection ${id} not found in Blob Storage`, 'warn');
    
    // Emit not found event
    eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:notFound', {
      id,
      error: `Collection with ID '${id}' not found in storage`,
      timestamp: Date.now()
    });
    
    return {
      success: false,
      error: `Collection with ID '${id}' not found in storage`
    };
  }

  const endpoint = `${this.config.apiBasePath}/collections/${id}?bypassVerify=true`;
  this.log(`Fetching collection from: ${endpoint}`);
  
  // Emit API fetch start
  eventBus.emit(EVENTS.COLLECTION_API_FETCH_START || 'collection:apiFetchStart', {
    id,
    endpoint,
    timestamp: Date.now()
  });

  // Create request promise
  const requestPromise = (async () => {
    try {
      const response = await fetch(endpoint);

      if (!response.ok) {
        const error = response.status === 404 
          ? `Collection with ID '${id}' not found`
          : `Failed to fetch collection: ${response.status} ${response.statusText}`;
          
        // Emit error event
        eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
          id,
          status: response.status,
          error,
          timestamp: Date.now()
        });
        
        if (response.status === 404) {
          return { success: false, error: `Collection with ID '${id}' not found` };
        }

        const errorText = await response.text();
        throw new Error(`Failed to fetch collection: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const data = await response.json();

      if (!data.success || !data.data) {
        const error = 'Invalid response format from collection API';
        eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
          id,
          error,
          timestamp: Date.now()
        });
        throw new Error(error);
      }

      // Mark as coming from blob storage
      data.data.source = 'blob';

      // Verify collection has valid files in blob storage
      this.log(`Verifying blob files for collection: ${id}`);
      const filesExist = await this._verifyBlobFiles(data.data);

      if (!filesExist) {
        this.log(`Some audio files for collection ${id} are not accessible`, 'warn');
        data.warning = "Some audio files may not be accessible";
        
        // Emit warning event
        eventBus.emit(EVENTS.COLLECTION_FILE_WARNING || 'collection:fileWarning', {
          id,
          warning: "Some audio files may not be accessible",
          timestamp: Date.now()
        });
      }

      // Emit success event
      eventBus.emit(EVENTS.COLLECTION_SELECTED || 'collection:loaded', {
        id,
        name: data.data.name,
        source: 'blob',
        trackCount: data.data.tracks?.length || 0,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      this.log(`Error fetching collection: ${error.message}`, 'error');
      
      // Emit error event if not already emitted
      if (!error.message.includes('Failed to fetch collection:') && 
          !error.message.includes('Invalid response format')) {
        eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
          id,
          error: error.message,
          timestamp: Date.now()
        });
      }
      
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
      const error = 'Collection data is required';
      eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:formatError', {
        error,
        timestamp: Date.now()
      });
      throw new Error(error);
    }

    try {
      this.log(`Formatting collection: ${collection.id}`);

      // Emit format start event
      eventBus.emit(EVENTS.COLLECTION_FORMAT_START || 'collection:formatStart', {
        id: collection.id,
        name: collection.name,
        timestamp: Date.now()
      });

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
        const error = `Collection "${collection.name || collection.id}" has no audio tracks`;
        this.log(`Collection ${collection.id} has no tracks`, 'error');

        // Emit format error event
        eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:formatError', {
          id: collection.id,
          error,
          timestamp: Date.now()
        });

        throw new Error(error);
      }

      let formattedTrackCount = 0;

      // Process tracks
      collection.tracks.forEach(track => {
        // Handle missing properties with clear logging
        if (!track.id) {
          this.log('Track missing id', 'warn');
          return;
        }

        if (!track.audioUrl) {
          this.log(`Track ${track.id} missing audioUrl`, 'warn');
          return;
        }

        // Get the layer folder from the track
        const layerFolder = track.layerFolder;
        if (!layerFolder) {
          this.log(`Track ${track.id} missing layerFolder`, 'warn');
          return;
        }

        // Map the folder name to player layer name
        const playerLayer = folderToLayerMap[layerFolder];
        if (!playerLayer) {
          this.log(`Invalid layer folder: ${layerFolder}`, 'warn');
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
              this.log(`Variation missing id in track ${track.id}`, 'warn');
              return;
            }

            if (!variation.audioUrl) {
              this.log(`Variation ${variation.id} missing audioUrl`, 'warn');
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
        const error = 'No valid audio tracks found in this collection';
        this.log('No valid tracks found in collection', 'error');

        // Emit format error event
        eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:formatError', {
          id: collection.id,
          error,
          timestamp: Date.now()
        });

        throw new Error(error);
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

      this.log(`Formatted ${formattedTrackCount} tracks across ${Object.keys(playerLayers).length} layers`);
      this.log(`Cover image URL: ${formattedCollection.coverImage}`);

      // Emit success event
      eventBus.emit(EVENTS.COLLECTION_FORMATTED || 'collection:formatted', {
        id: collection.id,
        name: collection.name,
        trackCount: formattedTrackCount,
        layerCount: Object.keys(playerLayers).filter(layer => playerLayers[layer].length > 0).length,
        timestamp: Date.now()
      });

      // Return the formatted collection
      return formattedCollection;
    } catch (error) {
      this.log(`Error formatting collection: ${error.message}`, 'error');

      // Emit error event if not already emitted
      if (!error.message.includes('has no audio tracks') &&
        !error.message.includes('No valid audio tracks')) {
        eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:formatError', {
          id: collection?.id,
          error: error.message,
          timestamp: Date.now()
        });
      }

      throw new Error(`Failed to format collection: ${error.message}`);
    }
  }

/**
 * Export all local collections as a JSON string
 * @returns {string} JSON string of all local collections
 */
exportLocalCollections() {
  const collections = this.getLocalCollections();
  
  try {
    // Format for better readability
    const exportData = JSON.stringify(collections, null, 2);
    
    // Emit export event
    eventBus.emit(EVENTS.COLLECTION_LOCAL_EXPORTED || 'collection:localExported', {
      count: collections.length,
      timestamp: Date.now()
    });
    
    return exportData;
  } catch (error) {
    this.log(`Error exporting collections: ${error.message}`, 'error');
    
    // Emit error event
    eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
      operation: 'export',
      error: error.message,
      timestamp: Date.now()
    });
    
    throw new Error(`Failed to export collections: ${error.message}`);
  }
}

/**
 * Import collections from JSON string
 * @param {string} jsonData - JSON string with collections data
 * @param {boolean} [replace=false] - Whether to replace existing collections
 * @returns {Object} Import results with counts
 */
importLocalCollections(jsonData, replace = false) {
  if (!jsonData) {
    throw new Error('Import data is required');
  }
  
  try {
    // Parse the JSON data
    const collections = JSON.parse(jsonData);
    
    if (!Array.isArray(collections)) {
      throw new Error('Import data must be an array of collections');
    }
    
    // Track import statistics
    const stats = {
      total: collections.length,
      imported: 0,
      skipped: 0,
      errors: 0
    };
    
    // Clear existing collections if replace is true
    if (replace) {
      this.localCollections.clear();
      this.log('Cleared existing local collections for import');
    }
    
    // Import each collection
    collections.forEach(collection => {
      try {
        if (!collection.id || !collection.name) {
          this.log(`Skipping invalid collection in import data`, 'warn');
          stats.errors++;
          return;
        }
        
        // Check for existing collection with same ID
        if (!replace && this.localCollections.has(collection.id)) {
          this.log(`Skipping existing collection: ${collection.id}`);
          stats.skipped++;
          return;
        }
        
        // Mark as local source
        collection.source = 'local';
        
        // Add updated timestamp if missing
        if (!collection.updatedAt) {
          collection.updatedAt = new Date().toISOString();
        }
        
        // Save to local collections
        this.localCollections.set(collection.id, collection);
        stats.imported++;
      } catch (error) {
        this.log(`Error importing collection: ${error.message}`, 'error');
        stats.errors++;
      }
    });
    
    // Save to localStorage
    this._saveLocalCollections();
    
    this.log(`Imported ${stats.imported} collections, skipped ${stats.skipped}, ${stats.errors} errors`);
    
    // Emit import event
    eventBus.emit(EVENTS.COLLECTION_LOCAL_IMPORTED || 'collection:localImported', {
      ...stats,
      timestamp: Date.now()
    });
    
    return {
      success: true,
      stats
    };
  } catch (error) {
    this.log(`Error importing collections: ${error.message}`, 'error');
    
    // Emit error event
    eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
      operation: 'import',
      error: error.message,
      timestamp: Date.now()
    });
    
    return {
      success: false,
      error: error.message
    };
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
    this.log('Collection cache cleared');

    // Emit cache cleared event
    eventBus.emit(EVENTS.COLLECTION_CACHE_CLEARED || 'collection:cacheCleared', {
      timestamp: Date.now()
    });
  }

  /**
   * Logging helper that respects configuration
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

  /**
   * Clean up resources used by CollectionService
   * This should be called when the service is no longer needed
   */
  dispose() {
    this.resetCache();
    this.pendingRequests.clear();
    this.log('CollectionService disposed');

    // Emit disposal event
    eventBus.emit(EVENTS.COLLECTION_DISPOSED || 'collection:disposed', {
      timestamp: Date.now()
    });
  }

  /**
   * Alias for dispose to maintain API compatibility with other services
   */
  cleanup() {
    this.dispose();
  }
}

export default CollectionService;
