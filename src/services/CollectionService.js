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
      localStorageKey: options.localStorageKey || 'enso_collections',
      collectionSource: AppConfig.collections.source || 'local-folder',
      // Fallback settings
      fallbackToBlob: AppConfig.collections.local?.fallbackToBlob || false,
      fallbackToLocal: AppConfig.collections.blob?.fallbackToLocal || false
    };

    // Internal state
    this.collectionsCache = null;
    this.lastCacheTime = 0;
    this.pendingRequests = new Map();
    this.localCollections = new Map(); // Storage for local collections
    this.errorLog = []; // Initialize error log array
    this.sourceHandlers = this._initializeSourceHandlers();

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
        enableLocalStorage: this.config.enableLocalStorage,
        localStorageKey: this.config.localStorageKey,
        collectionSource: this.config.collectionSource,
        fallbackToBlob: this.config.fallbackToBlob,
        fallbackToLocal: this.config.fallbackToLocal
      },
      timestamp: Date.now()
    });
  }

  /**
   * Initialize collection source handlers for unified access
   * @private
   * @returns {Object} Collection source handlers
   */
  _initializeSourceHandlers() {
    return {
      // Blob storage handler
      blob: {
        getCollections: async (options) => {
          const blobFolders = await this._getBlobCollectionFolders();
          if (blobFolders.length === 0) return [];

          // Check cache or fetch from API
          let collections = [];
          if (this._canUseCache(options)) {
            collections = this.collectionsCache.data.filter(collection =>
              blobFolders.includes(collection.id)
            );
          } else {
            const apiData = await this._fetchCollectionsFromAPI(options);
            collections = apiData.data.filter(collection =>
              blobFolders.includes(collection.id)
            );
          }

          // Add source information
          collections.forEach(collection => {
            collection.source = 'blob';
          });

          return collections;
        },
        getCollection: async (id, useCache) => {
          // First verify this collection exists in blob storage
          const blobFolders = await this._getBlobCollectionFolders();
          if (!blobFolders.includes(id)) {
            return { success: false, error: `Collection ${id} not found in Blob Storage` };
          }

          // Check cache if enabled
          if (useCache && this._canUseCache({ useCache })) {
            const cachedCollection = this.collectionsCache.data.find(c => c.id === id);
            if (cachedCollection) {
              this.log(`Using cached data for collection: ${id}`);

              // Add source info if missing
              cachedCollection.source = 'blob';

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

          // Fetch from API
          const requestPromise = this._fetchCollectionFromAPI(id);
          this.pendingRequests.set(cacheKey, requestPromise);
          return requestPromise;
        }
      },

      // Local storage (browser) handler
      local: {
        getCollections: () => {
          return this.getLocalCollections();
        },
        getCollection: (id) => {
          const collection = this.getLocalCollection(id);
          if (!collection) {
            return { success: false, error: `Collection ${id} not found in local storage` };
          }

          // Emit success event
          eventBus.emit(EVENTS.COLLECTION_SELECTED || 'collection:loaded', {
            id,
            name: collection.name,
            source: 'local',
            timestamp: Date.now()
          });

          return { success: true, data: collection, source: 'local' };
        }
      },

      // Public folder handler
      'local-folder': {
        getCollections: async () => {
          return await this.loadPublicFolderCollections();
        },
        getCollection: async (id) => {
          return await this.getPublicFolderCollection(id);
        }
      }
    };
  }

  /**
   * Check if cache can be used based on options
   * @private
   * @param {Object} options - Options containing useCache, tag, and artist
   * @returns {boolean} Whether cache can be used
   */
  _canUseCache(options) {
    return options.useCache &&
      this.collectionsCache &&
      Date.now() - this.lastCacheTime < this.config.cacheDuration &&
      !options.tag && !options.artist;
  }

  /**
   * Get collection folders from Blob Storage
   * @private
   * @returns {Promise<string[]>} Array of collection folder names
   */
  async _getBlobCollectionFolders() {
    // IMPORTANT: Skip blob operations entirely if not using blob source
    if (this.config.collectionSource !== 'blob' &&
      !this.config.fallbackToBlob &&
      // Check if this was explicitly requested (for specific API calls)
      !this._forceBlobFetch) {
      this.log('Skipping blob fetch - not using blob source', 'info');
      return [];
    }

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
   * Format URL paths for collections and tracks
   * @private
   * @param {string} url - Original URL or path (should be relative)
   * @param {string} collectionId - Collection ID for local folder paths
   * @param {string} [source='blob'] - Source type: 'blob', 'local', or 'local-folder'
   * @returns {string} Formatted URL
   */
  _formatUrl(url, collectionId, source = 'blob') {
    if (!url) return null;

    // For logging/debugging
    const originalUrl = url;

    // Already an absolute URL
    if (url.startsWith('http')) return url;

    // Remove any leading slash from the URL for consistency
    const relativePath = url.startsWith('/') ? url.substring(1) : url;

    // Check if URL already contains collections/[collectionId]
    const collectionPathRegex = new RegExp(`^(collections|collection)/${collectionId}/`, 'i');
    if (collectionPathRegex.test(relativePath)) {
      // URL already has the collections path, normalize it
      this.log(`URL already contains collections path: ${url}`, 'debug');
      return `/${relativePath}`;
    }

    let result;
    if (source === 'blob') {
      // Format for blob storage
      result = `${this.config.blobBaseUrl}/${relativePath}`;
      this.log(`Formatted blob URL: ${originalUrl} → ${result}`, 'debug');
    } else if (source === 'local-folder') {
      // Format for local folder
      result = `/collections/${collectionId}/${relativePath}`;
      this.log(`Formatted local folder URL: ${originalUrl} → ${result}`, 'debug');
    } else {
      // Default formatting
      result = `/${relativePath}`;
      this.log(`Default URL formatting: ${originalUrl} → ${result}`, 'debug');
    }

    return result;
  }


  /**
   * Apply pagination to collections
   * @private
   * @param {Array} collections - Collection array
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Object} Paginated result
   */
  _paginateCollections(collections, page, limit) {
    const total = collections.length;
    const pages = Math.ceil(total / parseInt(limit));
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedCollections = collections.slice(startIndex, endIndex);

    return {
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
        local: collections.filter(c => c.source === 'local').length,
        localFolder: collections.filter(c => c.source === 'local-folder').length
      }
    };
  }

  /**
 * Get a collection from the cache
 * @private
 * @param {string} id - Collection ID
 * @returns {Object|null} Collection or null if not found
 */
_getCollectionFromCache(id) {
  if (!this.collectionsCache || !this.collectionsCache.data) {
    return null;
  }
  
  return this.collectionsCache.data.find(c => c.id === id) || null;
}

  /**
   * Update the collections cache
   * @private
   * @param {Object} result - Collection result to cache
   */
  _updateCache(result) {
    this.collectionsCache = result;
    this.lastCacheTime = Date.now();
    this.log(`Updated cache with ${result.data.length} collections`);

    // Emit cache update event
    eventBus.emit(EVENTS.COLLECTION_CACHE_UPDATED || 'collection:cacheUpdated', {
      count: result.data.length,
      timestamp: Date.now()
    });
  }

/**
 * Standardized error handler for collection service
 * @private
 * @param {string} operation - The operation that failed
 * @param {Error} error - The error object
 * @param {Object} context - Additional context for the error
 */
_handleError(operation, error, context = {}) {
  const errorMessage = error.message || 'Unknown error';
  this.log(`Error in ${operation}: ${errorMessage}`, 'error');
  
  // Emit appropriate error event
  if (operation.includes('Collections') || operation === 'getCollections') {
    // Plural operation
    eventBus.emit(EVENTS.COLLECTIONS_ERROR || 'collections:error', {
      operation,
      error: errorMessage,
      context,
      timestamp: Date.now()
    });
  } else {
    // Singular operation
    eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
      operation,
      id: context.id,
      error: errorMessage,
      context,
      timestamp: Date.now()
    });
  }
  
  // Initialize errorLog if it doesn't exist
  if (!this.errorLog) {
    this.errorLog = [];
  }
  
  // Add to error log
  this.errorLog.push({
    operation,
    error: errorMessage,
    context,
    timestamp: Date.now()
  });
  
  // Keep error log from growing too large
  if (this.errorLog.length > 50) {
    this.errorLog.shift();
  }
}


  /**
   * Filter collections by tags, artist, or other criteria
   * @private
   * @param {Array} collections - Collections to filter
   * @param {Object} filters - Filter criteria
   * @param {string} [filters.tag] - Tag to filter by
   * @param {string} [filters.artist] - Artist to filter by
   * @returns {Array} Filtered collections
   */
  _filterCollections(collections, filters = {}) {
    if (!collections || !Array.isArray(collections)) return [];

    const { tag, artist } = filters;

    // If no filters are set, return all collections
    if (!tag && !artist) return collections;

    return collections.filter(collection => {
      // Tag filter
      if (tag && collection.tags) {
        // Handle different tag formats (array or comma-separated string)
        const tags = Array.isArray(collection.tags)
          ? collection.tags
          : collection.tags.split(',').map(t => t.trim());

        // Case-insensitive check
        const tagMatches = tags.some(t =>
          t.toLowerCase() === tag.toLowerCase()
        );

        if (!tagMatches) return false;
      }

      // Artist filter - case insensitive
      if (artist && collection.artist) {
        if (collection.artist.toLowerCase().indexOf(artist.toLowerCase()) === -1) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Internal helper to fetch collections from API
   * @private
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Collections data
   */
  async _fetchCollectionsFromAPI(options = {}) {
    try {
      const endpoint = `${this.config.apiBasePath}/collections${this._buildQueryString(options)}`;
      this.log(`Fetching from API: ${endpoint}`);

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

      const apiData = await response.json();
      return apiData;
    } catch (error) {
      this.log(`Error fetching from API: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Internal helper to fetch collection from API
   * @private
   * @param {string} id - Collection ID
   * @returns {Promise<Object>} Collection data response
   */
  async _fetchCollectionFromAPI(id) {
    try {
      const endpoint = `${this.config.apiBasePath}/collections/${id}?bypassVerify=true`;
      this.log(`Fetching collection from API: ${endpoint}`);

      // Emit API fetch start
      eventBus.emit(EVENTS.COLLECTION_API_FETCH_START || 'collection:apiFetchStart', {
        id,
        endpoint,
        timestamp: Date.now()
      });

      const response = await fetch(endpoint);

      if (!response.ok) {
        const error = response.status === 404
          ? `Collection with ID '${id}' not found in API`
          : `Failed to fetch collection: ${response.status} ${response.statusText}`;

        // Emit error event
        eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
          id,
          status: response.status,
          error,
          timestamp: Date.now()
        });

        if (response.status === 404) {
          return { success: false, error: `Collection with ID '${id}' not found in API` };
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

      // Add source information
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
      this.log(`Error in _fetchCollectionFromAPI: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
 * Load collections from public/collections directory
 * @returns {Promise<Array>} Array of collection objects
 */
  async loadPublicFolderCollections() {
    try {
      this.log('Loading collections from public/collections directory');

      // Emit loading event
      eventBus.emit(EVENTS.COLLECTION_LOCAL_LOADING || 'collection:localLoading', {
        source: 'public-folder',
        timestamp: Date.now()
      });

      // First check if the index file exists to avoid 404 errors
      try {
        const checkResponse = await fetch('/collections/collections.json', { method: 'HEAD' });
        if (!checkResponse.ok) {
          // File doesn't exist - log it but don't treat as error
          this.log('Collections collections.json not found, skipping local folder collections', 'info');
          return [];
        }
      } catch (e) {
        // Fetch error for HEAD request means file doesn't exist
        this.log('Unable to check collections collections.json, skipping local folder collections', 'info');
        return [];
      }

      // Fetch the index file that contains metadata about all collections
      const response = await fetch('/collections/collections.json');

      if (!response.ok) {
        throw new Error(`Failed to load collections index: ${response.status}`);
      }

      // Parse the JSON response
      const collectionsData = await response.json();

      // Determine the structure of the data and extract collection info array
      let collectionInfoArray;

      if (Array.isArray(collectionsData)) {
        // Case 1: Data is already an array of collections
        this.log('Collections JSON is an array format');
        collectionInfoArray = collectionsData;
      } else if (collectionsData.collections && Array.isArray(collectionsData.collections)) {
        // Case 2: Data has a 'collections' property that is an array
        this.log('Collections JSON has collections property');
        collectionInfoArray = collectionsData.collections;
      } else if (typeof collectionsData === 'object') {
        // Case 3: Data is an object with collection IDs as keys
        this.log('Collections JSON appears to be an object with collection IDs as keys');
        collectionInfoArray = Object.entries(collectionsData).map(([id, data]) => ({
          id,
          ...data
        }));
      } else {
        // No valid collections data found
        this.log('No valid collections data found in collections.json', 'warn');
        return [];
      }

      if (!collectionInfoArray || collectionInfoArray.length === 0) {
        this.log('No collections found in collections.json', 'info');
        return [];
      }

      // Process each collection in the array
      const collections = await Promise.all(
        collectionInfoArray.map(async (collectionInfo) => {
          try {
            // Skip if no ID is provided
            if (!collectionInfo.id) {
              this.log('Collection info missing ID, skipping', 'warn');
              return null;
            }

            // Load the full collection data
            const collectionResponse = await fetch(`/collections/${collectionInfo.id}/metadata.json`);

            if (!collectionResponse.ok) {
              this.log(`Error loading collection ${collectionInfo.id}`, 'warn');
              return null;
            }

            const collection = await collectionResponse.json();

            // Ensure collection has ID from the index
            collection.id = collectionInfo.id;

            // Add source information
            collection.source = 'local-folder';

            // Format URLs to be absolute if they are relative
            if (collection.coverImage && !collection.coverImage.startsWith('http')) {
              collection.coverImage = `/collections/${collectionInfo.id}/${collection.coverImage}`;
            }

            // Process tracks to ensure their URLs are correct
            if (collection.tracks && Array.isArray(collection.tracks)) {
              collection.tracks.forEach(track => {
                if (track.audioUrl && !track.audioUrl.startsWith('http')) {
                  track.audioUrl = `/collections/${collectionInfo.id}/${track.audioUrl}`;
                }

                // Process variations if they exist
                if (track.variations && Array.isArray(track.variations)) {
                  track.variations.forEach(variation => {
                    if (variation.audioUrl && !variation.audioUrl.startsWith('http')) {
                      variation.audioUrl = `/collections/${collectionInfo.id}/${variation.audioUrl}`;
                    }
                  });
                }
              });
            }

            return collection;
          } catch (error) {
            this.log(`Error processing collection ${collectionInfo.id}: ${error.message}`, 'error');
            return null;
          }
        })
      );

      // Filter out any null results (failed loads)
      const validCollections = collections.filter(collection => collection !== null);

      this.log(`Successfully loaded ${validCollections.length} collections from public folder`);

      // Emit success event
      eventBus.emit(EVENTS.COLLECTION_LOCAL_LOADED || 'collection:localLoaded', {
        count: validCollections.length,
        source: 'public-folder',
        timestamp: Date.now()
      });

      return validCollections;
    } catch (error) {
      this.log(`Error loading public folder collections: ${error.message}`, 'error');

      // Emit error event
      eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
        source: 'public-folder',
        error: error.message,
        timestamp: Date.now()
      });

      return [];
    }
  }


  /**
   * Get a specific collection from the public folder
   * @param {string} id - Collection ID
   * @returns {Promise<Object|null>} Collection data or null if not found
   */
  async getPublicFolderCollection(id) {
    try {
      this.log(`Loading public folder collection: ${id}`);

      // Check if we've already cached this collection
      const cacheKey = `public-folder:${id}`;
      if (this.pendingRequests.has(cacheKey)) {
        return this.pendingRequests.get(cacheKey);
      }

      // Create request promise
      const requestPromise = (async () => {
        try {
          const response = await fetch(`/collections/${id}/metadata.json`);

          if (!response.ok) {
            throw new Error(`Failed to load collection: ${response.status}`);
          }

          const collection = await response.json();

          // Add source information
          collection.source = 'local-folder';

          // Format URLs to be absolute if they are relative
          if (collection.coverImage && !collection.coverImage.startsWith('http')) {
            collection.coverImage = `/collections/${id}/${collection.coverImage}`;
          }

          // Process tracks to ensure their URLs are correct
          if (collection.tracks && Array.isArray(collection.tracks)) {
            collection.tracks.forEach(track => {
              if (track.audioUrl && !track.audioUrl.startsWith('http')) {
                track.audioUrl = `/collections/${id}/${track.audioUrl}`;
              }

              // Process variations if they exist
              if (track.variations && Array.isArray(track.variations)) {
                track.variations.forEach(variation => {
                  if (variation.audioUrl && !variation.audioUrl.startsWith('http')) {
                    variation.audioUrl = `/collections/${id}/${variation.audioUrl}`;
                  }
                });
              }
            });
          }

          // Emit success event
          eventBus.emit(EVENTS.COLLECTION_LOADED || 'collection:loaded', {
            id,
            source: 'public-folder',
            timestamp: Date.now()
          });

          return { success: true, data: collection, source: 'local-folder' };
        } catch (error) {
          this.log(`Error loading public folder collection ${id}: ${error.message}`, 'error');

          // Emit error event
          eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
            id,
            source: 'public-folder',
            error: error.message,
            timestamp: Date.now()
          });

          return { success: false, error: error.message };
        } finally {
          this.pendingRequests.delete(cacheKey);
        }
      })();

      // Store promise in pending requests
      this.pendingRequests.set(cacheKey, requestPromise);

      return requestPromise;
    } catch (error) {
      this.log(`Error initiating public folder collection load: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  /**
 * Get all collections with optional filtering
 * @param {Object} [options] - Fetch options
 * @param {boolean} [options.useCache=true] - Use cached data if available
 * @param {string} [options.tag] - Filter by tag
 * @param {string} [options.artist] - Filter by artist name
 * @param {number} [options.limit] - Maximum number of results
 * @param {number} [options.page] - Page number for pagination
 * @param {string} [options.source] - Source override: 'all', 'blob', 'local' or 'local-folder'
 * @returns {Promise<Object>} Collections data with pagination info
 */
async getCollections(options = {}) {
  const {
    useCache = true,
    tag,
    artist,
    limit = 10,
    page = 1,
    source // If source is provided in options, it overrides the config
  } = options;

  // Emit fetch start event - using consistent 'collections:loadStart' event
  eventBus.emit(EVENTS.COLLECTIONS_LOAD_START || 'collections:loadStart', {
    options,
    useCache,
    timestamp: Date.now()
  });

  try {
    // Initialize collections array
    let collections = [];

    // Determine which sources to query based on configuration and options
    let sourcesToQuery = [];
    
    if (source === 'all') {
      // Only with explicit 'all' do we query every source
      this.log('Explicit request for all sources', 'info');
      sourcesToQuery = ['blob', 'local', 'local-folder'];
      // Allow blob operations for this request only
      this._forceBlobFetch = true;
    } else if (source) {
      // Explicit source in options overrides config
      this.log(`Using explicit source override: ${source}`, 'info');
      sourcesToQuery = [source];
      // Allow blob operations if blob is explicitly requested
      this._forceBlobFetch = (source === 'blob');
    } else {
      // Use configured source
      const configSource = this.config.collectionSource;
      this.log(`Using configured collection source: ${configSource}`, 'info');
      
      // Make source handling very explicit
      if (configSource === 'local') {
        sourcesToQuery = ['local', 'local-folder'];
        this._forceBlobFetch = false;
      } else if (configSource === 'blob') {
        sourcesToQuery = ['blob'];
        this._forceBlobFetch = true;
      } else if (configSource === 'local-folder') {
        sourcesToQuery = ['local-folder'];
        this._forceBlobFetch = false;
      } else {
        // Default to local-folder if unknown source
        sourcesToQuery = ['local-folder'];
        this._forceBlobFetch = false;
      }
    }

    this.log(`Fetching collections from sources: ${sourcesToQuery.join(', ')}`);

    // Get collections from each source
    for (const sourceType of sourcesToQuery) {
      if (this.sourceHandlers[sourceType]) {
        const sourceCollections = await this.sourceHandlers[sourceType].getCollections(options);
        collections = [...collections, ...sourceCollections];
      }
    }

    // Apply filtering
    if (tag || artist) {
      collections = this._filterCollections(collections, { tag, artist });
    }

    // Deduplicate collections by ID to prevent React key issues
    const uniqueCollections = [];
    const seenIds = new Set();
    
    collections.forEach(collection => {
      if (!seenIds.has(collection.id)) {
        seenIds.add(collection.id);
        uniqueCollections.push(collection);
      } else {
        this.log(`Found duplicate collection ID: ${collection.id} (${collection.name}) from source ${collection.source}`, 'warn');
      }
    });
    
    if (collections.length !== uniqueCollections.length) {
      this.log(`Filtered out ${collections.length - uniqueCollections.length} duplicate collections`, 'warn');
    }

    // Apply pagination
    const result = this._paginateCollections(uniqueCollections, page, limit);

    // Update cache if appropriate
    if (!tag && !artist) {
      this._updateCache(result);
    }

    // Emit collections loaded event - using 'collections:loaded' (plural) consistently
    eventBus.emit(EVENTS.COLLECTIONS_LOADED || 'collections:loaded', {
      count: result.data.length,
      total: result.pagination.total,
      page: result.pagination.page,
      useCache,
      fromCache: false,
      filters: { tag, artist, source },
      timestamp: Date.now()
    });

    return result;
  } catch (error) {
    this._handleError('getCollections', error, options);
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
 * @param {Object} [options] - Additional options
 * @param {string} [options.source] - Override source configuration
 * @returns {Promise<Object>} Collection data with tracks
 */
async getCollection(id, useCache = true, options = {}) {
  if (!id) {
    const error = 'Collection ID is required';
    eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
      id,
      error,
      timestamp: Date.now()
    });
    throw new Error(error);
  }

  // Emit collection fetch start event - using 'collection:fetchStart' consistently
  eventBus.emit(EVENTS.COLLECTION_FETCH_START || 'collection:fetchStart', {
    id,
    useCache,
    timestamp: Date.now()
  });
  
  try {
    // Check if collection exists in cache
    if (useCache && this.collectionsCache && 
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
        
        return { success: true, data: cachedCollection };
      }
    }

    // Check for pending request
    const cacheKey = `collection:${id}`;
    if (this.pendingRequests.has(cacheKey)) {
      this.log(`Using pending request for: ${id}`);
      return this.pendingRequests.get(cacheKey);
    }

    // First verify this collection exists in blob storage if using blob source
    if (this.config.collectionSource === 'blob' || options.source === 'blob') {
      const blobFolders = await this._getBlobCollectionFolders();
      if (!blobFolders.includes(id)) {
        this.log(`Collection ${id} not found in Blob Storage`, 'warn');
        
        // Emit not found event
        eventBus.emit(EVENTS.COLLECTION_NOT_FOUND || 'collection:notFound', {
          id,
          source: 'blob',
          error: `Collection with ID '${id}' not found in storage`,
          timestamp: Date.now()
        });
        
        // If fallback is enabled, continue to other sources
        if (!this.config.fallbackToLocal) {
          return {
            success: false,
            error: `Collection with ID '${id}' not found in storage`
          };
        }
      }
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

        // Emit loaded event - using 'collection:loaded' (singular) consistently
        eventBus.emit(EVENTS.COLLECTION_LOADED || 'collection:loaded', {
          id,
          collection: data.data,
          name: data.data.name,
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
  } catch (error) {
    if (!this.errorLog) {
      this.errorLog = [];
    }
    
    this.log(`Error in getCollection: ${error.message}`, 'error');
    eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
      id,
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
   * Check for duplicate collection IDs in the cache
   * @returns {Array} Array of duplicate collections with their counts
   */
  checkForDuplicateIds() {
    // This assumes you have the raw collection data accessible
    const allCollections = this.collectionsCache?.data || [];
    const idCounts = {};
    const duplicates = [];

    allCollections.forEach(collection => {
      idCounts[collection.id] = (idCounts[collection.id] || 0) + 1;

      if (idCounts[collection.id] > 1) {
        duplicates.push({
          id: collection.id,
          name: collection.name,
          source: collection.source,
          count: idCounts[collection.id]
        });
      }
    });

    if (duplicates.length > 0) {
      this.log('[CollectionService] Found duplicate collection IDs:', 'warn');
      duplicates.forEach(dup => {
        this.log(`  - ID: ${dup.id}, Name: ${dup.name}, Count: ${dup.count}`, 'warn');
      });
    }

    return duplicates;
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
      eventBus.emit(EVENTS.COLLECTION_FORMAT_ERROR || 'collection:formatError', {
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
      eventBus.emit(EVENTS.COLLECTION_FORMAT_ERROR || 'collection:formatError', {
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
      collection: formattedCollection,
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
 * Validate collection data structure
 * @private
 * @param {Object} collection - Collection object to validate
 * @returns {boolean} True if valid, false otherwise
 */
_validateCollection(collection) {
  if (!collection) {
    return false;
  }
  
  // Required fields
  if (!collection.id || !collection.name) {
    this.log(`Invalid collection missing id or name: ${JSON.stringify(collection).substring(0, 100)}...`, 'warn');
    return false;
  }
  
  // Tracks validation
  if (!collection.tracks || !Array.isArray(collection.tracks)) {
    this.log(`Collection ${collection.id} has no tracks array`, 'warn');
    return false;
  }
  
  // Require at least one valid track with audioUrl
  const hasValidTrack = collection.tracks.some(track => 
    track && track.id && track.audioUrl);
  
  if (!hasValidTrack) {
    this.log(`Collection ${collection.id} has no valid tracks with audioUrl`, 'warn');
    return false;
  }
  
  return true;
}


  /**
   * Format collection tracks by layer for internal services
   * @param {Object} collection - Collection data
   * @param {Object} options - Formatting options
   * @returns {Object} Tracks organized by layer
   */
  formatCollectionTracksByLayer(collection, options = {}) {
    if (!collection || !collection.tracks) {
      throw new Error('Invalid collection format');
    }

    const {
      usePlayerLayerNames = false,
      includeVariations = true
    } = options;

    // Map of folder names to player layer names
    const folderToLayerMap = {
      'Layer_1': 'Layer 1',
      'Layer_2': 'Layer 2',
      'Layer_3': 'Layer 3',
      'Layer_4': 'Layer 4'
    };

    // Create a layer-organized structure
    const layerTracks = {};

    // Process each track
    collection.tracks.forEach(track => {
      // Skip invalid tracks
      if (!track.id || !track.audioUrl) return;

      const layerFolder = track.layerFolder || this._getLayerFromFolder(track.audioUrl);
      const layerName = usePlayerLayerNames ? (folderToLayerMap[layerFolder] || layerFolder) : layerFolder;

      if (!layerTracks[layerName]) {
        layerTracks[layerName] = [];
      }

      // Format URL if needed
      const audioUrl = this._formatUrl(
        track.audioUrl,
        collection.id,
        collection.source || 'blob'
      );

      // Add the main track
      layerTracks[layerName].push({
        id: track.id,
        path: audioUrl,
        name: track.title || track.name || track.id,
        layer: layerName,
        originalTrack: track
      });

      // Add variations if they exist and are requested
      if (includeVariations && track.variations && Array.isArray(track.variations)) {
        track.variations.forEach(variation => {
          // Skip invalid variations
          if (!variation.id || !variation.audioUrl) return;

          // Format variation URL
          const variationUrl = this._formatUrl(
            variation.audioUrl,
            collection.id,
            collection.source || 'blob'
          );

          layerTracks[layerName].push({
            id: variation.id,
            path: variationUrl,
            name: variation.title || `${track.title || track.name || track.id} (Variation)`,
            layer: layerName,
            originalVariation: variation,
            parentTrackId: track.id
          });
        });
      }
    });

    return layerTracks;
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
   * Load collections from browser localStorage
   * @private
   */
  _loadLocalCollections() {
    try {
      if (typeof window === 'undefined' || !this.config.enableLocalStorage) return;

      const storedCollections = localStorage.getItem(this.config.localStorageKey);
      if (!storedCollections) return;

      const collectionsData = JSON.parse(storedCollections);

      // Convert array to Map for easy access
      collectionsData.forEach(collection => {
        this.localCollections.set(collection.id, {
          ...collection,
          source: 'local'
        });
      });

      this.log(`Loaded ${this.localCollections.size} collections from localStorage`);

      // Emit loaded event
      eventBus.emit(EVENTS.COLLECTION_LOCAL_LOADED || 'collection:localLoaded', {
        count: this.localCollections.size,
        source: 'localStorage',
        timestamp: Date.now()
      });
    } catch (error) {
      this.log(`Error loading local collections: ${error.message}`, 'error');
    }
  }

  /**
   * Save collections to browser localStorage
   * @private
   */
  _saveLocalCollections() {
    try {
      if (typeof window === 'undefined' || !this.config.enableLocalStorage) return;

      const collectionsArray = Array.from(this.localCollections.values());
      localStorage.setItem(this.config.localStorageKey, JSON.stringify(collectionsArray));

      this.log(`Saved ${collectionsArray.length} collections to localStorage`);

      // Emit saved event
      eventBus.emit(EVENTS.COLLECTION_LOCAL_SAVED || 'collection:localSaved', {
        count: collectionsArray.length,
        timestamp: Date.now()
      });
    } catch (error) {
      this.log(`Error saving local collections: ${error.message}`, 'error');

      // Emit error event
      eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
        method: '_saveLocalCollections',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get all collections from localStorage
   * @returns {Array} Array of collection objects
   */
  getLocalCollections() {
    return Array.from(this.localCollections.values());
  }

  /**
   * Get a collection from localStorage
   * @param {string} id - Collection ID
   * @returns {Object|null} Collection object or null if not found
   */
  getLocalCollection(id) {
    return this.localCollections.get(id) || null;
  }

  /**
   * Save a collection to localStorage
   * @param {Object} collection - Collection to save
   * @returns {boolean} Success state
   */
  saveLocalCollection(collection) {
    try {
      if (!collection || !collection.id) {
        throw new Error('Invalid collection object');
      }

      // Set source to 'local'
      const localCollection = {
        ...collection,
        source: 'local',
        savedAt: Date.now()
      };

      // Add to local collections map
      this.localCollections.set(collection.id, localCollection);

      // Save to localStorage
      this._saveLocalCollections();

      this.log(`Saved collection ${collection.id} to localStorage`);

      // Emit saved event
      eventBus.emit(EVENTS.COLLECTION_LOCAL_SAVED || 'collection:localSaved', {
        id: collection.id,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      this.log(`Error saving local collection: ${error.message}`, 'error');

      // Emit error event
      eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
        method: 'saveLocalCollection',
        error: error.message,
        timestamp: Date.now()
      });

      return false;
    }
  }

  /**
   * Remove a collection from localStorage
   * @param {string} id - Collection ID to remove
   * @returns {boolean} Success state
   */
  removeLocalCollection(id) {
    try {
      if (!id) {
        throw new Error('Collection ID is required');
      }

      const exists = this.localCollections.has(id);
      if (!exists) {
        this.log(`Collection ${id} not found in localStorage`);
        return false;
      }

      // Remove from local collections map
      this.localCollections.delete(id);

      // Save updates to localStorage
      this._saveLocalCollections();

      this.log(`Removed collection ${id} from localStorage`);

      // Emit removed event
      eventBus.emit(EVENTS.COLLECTION_LOCAL_REMOVED || 'collection:localRemoved', {
        id,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      this.log(`Error removing local collection: ${error.message}`, 'error');

      // Emit error event
      eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
        method: 'removeLocalCollection',
        error: error.message,
        timestamp: Date.now()
      });

      return false;
    }
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
   * Create a new user-generated collection
   * @param {Object} data - Collection data
   * @param {string} data.name - Collection name
   * @param {string} [data.description] - Collection description
   * @param {string} [data.coverImage] - Cover image URL
   * @param {Array} [data.tracks] - Collection tracks
   * @returns {Object} Created collection
   */
  createCollection(data) {
    try {
      if (!data || !data.name) {
        throw new Error('Collection name is required');
      }

      // Generate unique ID
      const id = `local_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      // Create collection object
      const collection = {
        id,
        name: data.name,
        description: data.description || '',
        coverImage: data.coverImage || null,
        tracks: data.tracks || [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'local'
      };

      // Save to localStorage
      this.saveLocalCollection(collection);

      this.log(`Created new collection: ${collection.name} (${id})`);

      // Emit created event
      eventBus.emit(EVENTS.COLLECTION_CREATED || 'collection:created', {
        id,
        name: collection.name,
        timestamp: Date.now()
      });

      return { success: true, data: collection };
    } catch (error) {
      this.log(`Error creating collection: ${error.message}`, 'error');

      // Emit error event
      eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
        method: 'createCollection',
        error: error.message,
        timestamp: Date.now()
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Update an existing collection
   * @param {string} id - Collection ID
   * @param {Object} updates - Collection updates
   * @returns {Object} Updated collection
   */
  updateCollection(id, updates) {
    try {
      if (!id) {
        throw new Error('Collection ID is required');
      }

      // Check if collection exists
      const collection = this.getLocalCollection(id);
      if (!collection) {
        throw new Error(`Collection with ID ${id} not found`);
      }

      // Apply updates
      const updatedCollection = {
        ...collection,
        ...updates,
        updatedAt: Date.now()
      };

      // Preserve source and ID
      updatedCollection.id = id;
      updatedCollection.source = 'local';

      // Save to localStorage
      this.saveLocalCollection(updatedCollection);

      this.log(`Updated collection: ${updatedCollection.name} (${id})`);

      // Emit updated event
      eventBus.emit(EVENTS.COLLECTION_UPDATED || 'collection:updated', {
        id,
        name: updatedCollection.name,
        timestamp: Date.now()
      });

      return { success: true, data: updatedCollection };
    } catch (error) {
      this.log(`Error updating collection: ${error.message}`, 'error');

      // Emit error event
      eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
        method: 'updateCollection',
        id,
        error: error.message,
        timestamp: Date.now()
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Add a track to a collection
   * @param {string} collectionId - Collection ID
   * @param {Object} track - Track to add
   * @returns {Object} Result with success status
   */
  addTrackToCollection(collectionId, track) {
    try {
      if (!collectionId) {
        throw new Error('Collection ID is required');
      }

      if (!track || !track.id || !track.audioUrl) {
        throw new Error('Track is missing required fields (id, audioUrl)');
      }

      // Get collection
      const collection = this.getLocalCollection(collectionId);
      if (!collection) {
        throw new Error(`Collection with ID ${collectionId} not found`);
      }

      // Ensure tracks array exists
      if (!collection.tracks) {
        collection.tracks = [];
      }

      // Check if track already exists
      const trackExists = collection.tracks.some(t => t.id === track.id);
      if (trackExists) {
        throw new Error(`Track with ID ${track.id} already exists in this collection`);
      }

      // Add track
      collection.tracks.push({
        ...track,
        addedAt: Date.now()
      });

      // Update collection
      collection.updatedAt = Date.now();

      // Save to localStorage
      this.saveLocalCollection(collection);

      this.log(`Added track ${track.id} to collection ${collectionId}`);

      // Emit track added event
      eventBus.emit(EVENTS.COLLECTION_TRACK_ADDED || 'collection:trackAdded', {
        collectionId,
        trackId: track.id,
        timestamp: Date.now()
      });

      return { success: true };
    } catch (error) {
      this.log(`Error adding track to collection: ${error.message}`, 'error');

      // Emit error event
      eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
        method: 'addTrackToCollection',
        collectionId,
        error: error.message,
        timestamp: Date.now()
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Remove a track from a collection
   * @param {string} collectionId - Collection ID
   * @param {string} trackId - Track ID to remove
   * @returns {Object} Result with success status
   */
  removeTrackFromCollection(collectionId, trackId) {
    try {
      if (!collectionId) {
        throw new Error('Collection ID is required');
      }

      if (!trackId) {
        throw new Error('Track ID is required');
      }

      // Get collection
      const collection = this.getLocalCollection(collectionId);
      if (!collection) {
        throw new Error(`Collection with ID ${collectionId} not found`);
      }

      // Ensure tracks array exists
      if (!collection.tracks || !Array.isArray(collection.tracks)) {
        return { success: false, error: 'Collection has no tracks' };
      }

      // Find track index
      const trackIndex = collection.tracks.findIndex(t => t.id === trackId);
      if (trackIndex === -1) {
        return { success: false, error: `Track with ID ${trackId} not found in collection` };
      }

      // Remove track
      collection.tracks.splice(trackIndex, 1);

      // Update collection
      collection.updatedAt = Date.now();

      // Save to localStorage
      this.saveLocalCollection(collection);

      this.log(`Removed track ${trackId} from collection ${collectionId}`);

      // Emit track removed event
      eventBus.emit(EVENTS.COLLECTION_TRACK_REMOVED || 'collection:trackRemoved', {
        collectionId,
        trackId,
        timestamp: Date.now()
      });

      return { success: true };
    } catch (error) {
      this.log(`Error removing track from collection: ${error.message}`, 'error');

      // Emit error event
      eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
        method: 'removeTrackFromCollection',
        collectionId,
        trackId,
        error: error.message,
        timestamp: Date.now()
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Export a collection to JSON
   * @param {string} id - Collection ID
   * @returns {Object} Result with success status and JSON data
   */
  exportCollection(id) {
    try {
      if (!id) {
        throw new Error('Collection ID is required');
      }

      // Try to get collection from any source
      return this.getCollection(id, true)
        .then(result => {
          if (!result.success) {
            throw new Error(`Collection with ID ${id} not found`);
          }

          const collection = result.data;

          // Create export with required fields
          const exportData = {
            id: collection.id,
            name: collection.name,
            description: collection.description,
            coverImage: collection.coverImage,
            tracks: collection.tracks || [],
            metadata: collection.metadata || {},
            exportedAt: Date.now(),
            source: collection.source
          };

          this.log(`Exported collection ${id}`);

          // Emit export event
          eventBus.emit(EVENTS.COLLECTION_EXPORTED || 'collection:exported', {
            id,
            name: collection.name,
            timestamp: Date.now()
          });

          return {
            success: true,
            data: exportData,
            json: JSON.stringify(exportData, null, 2)
          };
        });
    } catch (error) {
      this.log(`Error exporting collection: ${error.message}`, 'error');

      // Emit error event
      eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
        method: 'exportCollection',
        id,
        error: error.message,
        timestamp: Date.now()
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Import a collection from JSON
   * @param {string|Object} data - JSON string or object to import
   * @returns {Object} Result with success status and imported collection
   */
  importCollection(data) {
    try {
      // Parse JSON if string
      let collectionData;
      if (typeof data === 'string') {
        try {
          collectionData = JSON.parse(data);
        } catch (e) {
          throw new Error('Invalid JSON format');
        }
      } else if (typeof data === 'object' && data !== null) {
        collectionData = data;
      } else {
        throw new Error('Invalid import data format');
      }

      // Validate required fields
      if (!collectionData.name) {
        throw new Error('Collection name is required');
      }

      // Generate new local ID to avoid conflicts
      const originalId = collectionData.id;
      const newId = `local_import_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      // Create new collection object
      const collection = {
        ...collectionData,
        id: newId,
        importedFrom: originalId,
        importedAt: Date.now(),
        source: 'local'
      };

      // Save to localStorage
      this.saveLocalCollection(collection);

      this.log(`Imported collection: ${collection.name} (${newId})`);

      // Emit import event
      eventBus.emit(EVENTS.COLLECTION_IMPORTED || 'collection:imported', {
        id: newId,
        originalId,
        name: collection.name,
        timestamp: Date.now()
      });

      return { success: true, data: collection };
    } catch (error) {
      this.log(`Error importing collection: ${error.message}`, 'error');

      // Emit error event
      eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
        method: 'importCollection',
        error: error.message,
        timestamp: Date.now()
      });

      return { success: false, error: error.message };
    }
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
