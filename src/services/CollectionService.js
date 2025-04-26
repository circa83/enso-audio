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
      localStorageKey: options.localStorageKey || 'enso_collections'
    };

    // Internal state
    this.collectionsCache = null;
    this.lastCacheTime = 0;
    this.pendingRequests = new Map();
    this.localCollections = new Map(); // Storage for local collections
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
        enableLocalStorage: this.config.enableLocalStorage
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
   * @param {string} url - Original URL or path
   * @param {string} collectionId - Collection ID for local folder paths
   * @param {string} [source='blob'] - Source type: 'blob', 'local', or 'local-folder'
   * @returns {string} Formatted URL
   */
  _formatUrl(url, collectionId, source = 'blob') {
    if (!url) return null;
    
    // Already an absolute URL
    if (url.startsWith('http')) return url;
    
    if (source === 'blob') {
      // Format for blob storage
      return `${this.config.blobBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    } else if (source === 'local-folder') {
      // Format for local folder
      return `/collections/${collectionId}/${url.startsWith('/') ? url.substring(1) : url}`;
    }
    
    // Return as-is for other sources
    return url;
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
   * Handle service errors
   * @private
   * @param {string} method - Method name where error occurred
   * @param {Error} error - Error object
   * @param {Object} [options] - Options that were being processed
   */
  _handleError(method, error, options = {}) {
    this.log(`Error in ${method}: ${error.message}`, 'error');
    
    // Emit error event
    eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
      method,
      error: error.message,
      options,
      timestamp: Date.now()
    });
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
      const checkResponse = await fetch('/collections/index.json', { method: 'HEAD' });
      if (!checkResponse.ok) {
        // File doesn't exist - log it but don't treat as error
        this.log('Collections index.json not found, skipping local folder collections', 'info');
        return [];
      }
    } catch (e) {
      // Fetch error for HEAD request means file doesn't exist
      this.log('Unable to check collections index.json, skipping local folder collections', 'info');
      return [];
    }
      
      // Fetch the index file that contains metadata about all collections
      const response = await fetch('/collections/index.json');
      
      if (!response.ok) {
        throw new Error(`Failed to load collections index: ${response.status}`);
      }
      
      const collectionsIndex = await response.json();
      
      // Process each collection in the index
      const collections = await Promise.all(
        collectionsIndex.collections.map(async (collectionInfo) => {
          try {
            // Load the full collection data
            const collectionResponse = await fetch(`/collections/${collectionInfo.id}/collection.json`);
            
            if (!collectionResponse.ok) {
              this.log(`Error loading collection ${collectionInfo.id}`, 'warn');
              return null;
            }
            
            const collection = await collectionResponse.json();
            
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
          const response = await fetch(`/collections/${id}/collection.json`);
          
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
   * @param {string} [options.source='all'] - Source filter: 'all', 'blob', 'local' or 'local-folder'
   * @returns {Promise<Object>} Collections data with pagination info
   */
  async getCollections(options = {}) {
    const {
      useCache = true,
      tag,
      artist,
      limit = 10,
      page = 1,
      source = 'all'
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
      
      // Determine which sources to query
      const sourcesToQuery = source === 'all' 
        ? ['blob', 'local', 'local-folder'] 
        : [source];
      
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
          
          // Apply pagination
          const result = this._paginateCollections(collections, page, limit);
          
          // Update cache if appropriate
          if (source === 'all' && !tag && !artist) {
            this._updateCache(result);
          }
    
          // Emit collections loaded event
          eventBus.emit(EVENTS.COLLECTIONS_LOADED || 'collections:loaded', {
            count: result.data.length,
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
    
        // Try each source in order (local, local-folder, blob)
        for (const source of ['local', 'local-folder', 'blob']) {
          try {
            const result = await this.sourceHandlers[source].getCollection(id, useCache);
            if (result && result.success) {
              return result;
            }
          } catch (error) {
            // Just log and continue to the next source
            this.log(`Collection ${id} not found in ${source}: ${error.message}`, 'info');
          }
        }
    
        // If we get here, collection was not found in any source
        const error = `Collection with ID '${id}' not found in any storage location`;
        eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:notFound', {
          id,
          error,
          timestamp: Date.now()
        });
        
        return {
          success: false,
          error
        };
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
    
            // Normalize the audioUrl property
            const audioUrl = track.audioUrl || track.path;
            if (!audioUrl) {
              this.log(`Track ${track.id} missing audioUrl/path`, 'warn');
              return;
            }
    
            // Get the layer folder from the track or determine it from the path
            const layerFolder = track.layerFolder || this._getLayerFromFolder(audioUrl);
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
    
            // Format track for player with the appropriate URL based on source
            const formattedUrl = this._formatUrl(
              audioUrl, 
              collection.id, 
              collection.source || 'blob'
            );
    
            // Use the original track ID without modification
            const formattedTrack = {
              id: track.id, // Don't modify the ID!
              name: track.title || track.name || `Track ${track.id}`,
              path: formattedUrl,
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
                const variationUrl = this._formatUrl(
                  variation.audioUrl,
                  collection.id,
                  collection.source || 'blob'
                );
    
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
            coverImage: this._formatUrl(
              collection.coverImage,
              collection.id,
              collection.source || 'blob'
            ),
            metadata: collection.metadata || {},
            layers: playerLayers,
            source: collection.source || 'blob',
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
    