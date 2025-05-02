/**
 * CollectionService.js
 * 
 * Service for managing audio collections in Ensō Audio
 * Handles fetching, filtering, and processing collection data
 */

import appConfig from "../Config/appConfig";
import logger from "../services/LoggingService";

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
      // Generate cache key based on filter options
      const cacheKey = JSON.stringify({ tag, artist, limit, page });

      // Check cache if enabled
      if (useCache &&
        this.collectionsCache &&
        Date.now() - this.lastCacheTime < this.config.cacheDuration &&
        !tag && !artist) {
        this.log(`Using cached collections data (${this.collectionsCache.data.length} items)`);
        return this.collectionsCache;
      }

      // Check for pending request with same parameters
      if (this.pendingRequests.has(cacheKey)) {
        this.log(`Using pending request for key: ${cacheKey}`);
        return this.pendingRequests.get(cacheKey);
      }

      // Create request promise
      const requestPromise = (async () => {
        try {
          // Fetch collections from local file
          this.log('Fetching collections from local file');
          const response = await fetch('/collections/collections.json');

          if (!response.ok) {
            throw new Error(`Failed to load collections: ${response.status}`);
          }

          let collections = await response.json();

          // Apply filters if provided
          if (tag) {
            collections = collections.filter(collection =>
              collection.metadata?.tags?.includes(tag)
            );
            this.log(`Filtered by tag "${tag}": ${collections.length} results`);
          }

          if (artist) {
            collections = collections.filter(collection =>
              collection.metadata?.artist?.toLowerCase().includes(artist.toLowerCase())
            );
            this.log(`Filtered by artist "${artist}": ${collections.length} results`);
          }

          // Calculate pagination
          const startIndex = (page - 1) * limit;
          const endIndex = startIndex + parseInt(limit);
          const paginatedData = collections.slice(startIndex, endIndex);

          const result = {
            success: true,
            data: paginatedData,
            pagination: {
              total: collections.length,
              page: parseInt(page),
              limit: parseInt(limit),
              pages: Math.ceil(collections.length / parseInt(limit))
            }
          };

          // Update cache if this was a full request (no filters)
          if (!tag && !artist) {
            this.collectionsCache = result;
            this.lastCacheTime = Date.now();
            this.log(`Updated cache with ${collections.length} collections`);
          }

          return result;
        } catch (error) {
          this.log(`Error: ${error.message}`, 'error');
          return {
            success: false,
            error: error.message
          };
        } finally {
          this.pendingRequests.delete(cacheKey);
        }
      })();

      // Store promise in pending requests
      this.pendingRequests.set(cacheKey, requestPromise);

      return requestPromise;
    } catch (error) {
      this.log(`Error: ${error.message}`, 'error');
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
        this.log(`Using cached data for collection: ${id}`);
        return { success: true, data: cachedCollection };
      }
    }

    // Check for pending request
    const cacheKey = `collection:${id}`;
    if (this.pendingRequests.has(cacheKey)) {
      this.log(`Using pending request for: ${id}`);
      return this.pendingRequests.get(cacheKey);
    }

    // Create request promise
    const requestPromise = (async () => {
      try {
        // Fetch the collection metadata from the local file
        this.log(`Fetching collection ${id} from local metadata file`);
        const response = await fetch(`/collections/${id}/metadata.json`);

        if (!response.ok) {
          if (response.status === 404) {
            return {
              success: false,
              error: `Collection with ID '${id}' not found`
            };
          }

          throw new Error(`Failed to fetch collection: ${response.status}`);
        }

        const collectionData = await response.json();

        // Return the collection data
        return {
          success: true,
          data: collectionData
        };
      } catch (error) {
        this.log(`Error: ${error.message}`, 'error');
        return {
          success: false,
          error: error.message
        };
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
  * @param {Object} [options] - Formatting options
  * @param {boolean} [options.applyConfig=true] - Whether to apply collection-specific configuration
  * @returns {Object} Formatted collection data ready for player consumption
  */
  formatCollectionForPlayer(collection, options = {}) {
    const { applyConfig = true } = options;

    if (!collection) {
      throw new Error('Collection data is required');
    }

    try {
      this.log(`Formatting collection: ${collection.id}`);
      this.log(`Collection ID type: ${typeof collection.id}`);
      this.log(`Raw collection ID value: "${collection.id}"`);

      // // More specific check of collection ID:
      // if (collection.id === 'Stillness') {
      //   this.log('MATCH: Collection ID exactly matches "stillness"');
      // } else {
      //   this.log('NO MATCH: Collection ID does not exactly match "stillness"');
      // }
      let collectionConfig = null;
      if (applyConfig) {
        const appConfig = require('../Config/appConfig').default;
        // Log available collection IDs in appConfig
        this.log('Available collection configs in appConfig:');
        const availableCollections = appConfig.getAvailableCollections();
        this.log(`- Available IDs: ${JSON.stringify(availableCollections)}`);

        collectionConfig = appConfig.getCollectionConfig(collection.id);
        this.log(`Config fetched for "${collection.id}":`);
        this.log(`- Config found: ${collectionConfig ? 'YES' : 'NO'}`);
        this.log(`- Is default config: ${collectionConfig === appConfig.defaults ? 'YES' : 'NO'}`);
        this.log(`- Has phases: ${collectionConfig.phaseMarkers?.length || 0}`);
        this.log(`Applying collection config for "${collection.id}":`, 'info');
        this.log(`- Session Duration: ${collectionConfig.sessionDuration}ms`, 'info');
        this.log(`- Transition Duration: ${collectionConfig.transitionDuration}ms`, 'info');
        this.log(`- Phase Markers: ${collectionConfig.phaseMarkers?.length || 0}`, 'info');

        // Log each phase's state summary
        if (collectionConfig.phaseMarkers?.length) {
          collectionConfig.phaseMarkers.forEach(phase => {
            const hasVolumes = phase.state?.volumes ? Object.keys(phase.state.volumes).length : 0;
            const hasAudio = phase.state?.activeAudio ? Object.keys(phase.state.activeAudio).length : 0;
            this.log(`  - Phase "${phase.name}": ${hasVolumes} volumes, ${hasAudio} tracks defined`, 'info');
          });
        }

        // Log default volumes
        if (collectionConfig.defaultVolumes) {
          this.log(`- Default Volumes: ${JSON.stringify(collectionConfig.defaultVolumes)}`, 'info');
        }
      }

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
        this.log(`Collection ${collection.id} has no tracks`, 'error');
        throw new Error(`Collection "${collection.name || collection.id}" has no audio tracks`);
      }

      let formattedTrackCount = 0;

      // Process tracks - existing implementation unchanged
      collection.tracks.forEach(track => {
        // Handle missing properties with clear logging
        if (!track.id) {
          this.log('Track missing id:', 'warn');
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

        // Use the audioUrl directly as it's already a relative path to the public folder
        const audioUrl = track.audioUrl;

        // Use the original track ID without modification
        const formattedTrack = {
          id: track.id,
          name: track.title || track.name || `Track ${track.id}`,
          path: audioUrl,
          layer: playerLayer
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

            // Use the variation audioUrl directly - it's already a relative path
            const variationUrl = variation.audioUrl;

            // Create variation track
            const variationTrack = {
              id: variation.id,
              name: variation.title || `${track.title || track.name || 'Track'} (Variation)`,
              path: variationUrl,
              layer: playerLayer
            };

            // Add variation to the appropriate layer
            playerLayers[playerLayer].push(variationTrack);
            formattedTrackCount++;
          });
        }
      });

      // Ensure we have at least one track formatted
      if (formattedTrackCount === 0) {
        this.log('No valid tracks found in collection', 'error');
        throw new Error('No valid audio tracks found in this collection');
      }

      // Format the collection for the player
      // Use the coverImage directly - it's already a relative path
      const formattedCollection = {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        coverImage: collection.coverImage,
        metadata: collection.metadata,
        layers: playerLayers,
        // Keep the original tracks array for reference
        originalTracks: collection.tracks
      };

      // NEW
      // Add configuration from appConfig if available
      if (applyConfig && collectionConfig) {
        // Apply collection configuration
        formattedCollection.sessionDuration = collectionConfig.sessionDuration;
        formattedCollection.transitionDuration = collectionConfig.transitionDuration;
        formattedCollection.phaseMarkers = collectionConfig.phaseMarkers;
        formattedCollection.defaultVolumes = collectionConfig.defaultVolumes;
        formattedCollection.defaultActiveAudio = collectionConfig.defaultActiveAudio;

        this.log(`Applied collection config:
          - Session Duration: ${formattedCollection.sessionDuration}
          - Transition Duration: ${formattedCollection.transitionDuration}
          - Phase Markers: ${formattedCollection.phaseMarkers?.length || 0}`, 'debug');
      }

      this.log(`Formatted ${formattedTrackCount} tracks across ${Object.keys(playerLayers).length} layers for collection ${collection.id}`);

      return formattedCollection;
    } catch (error) {
      this.log(`Error formatting collection: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Get featured collections
   * @param {number} [limit=3] - Maximum number of featured collections
   * @returns {Promise<Object>} Featured collections data
   */
  async getFeaturedCollections(limit = 3) {
    try {
      // Fetch all collections first
      const result = await this.getCollections({ limit: 100 });

      if (!result.success) {
        return result;
      }

      // Filter for featured collections
      const featured = result.data
        .filter(collection => collection.metadata?.featured === true)
        .slice(0, limit);

      this.log(`Found ${featured.length} featured collections`);

      return {
        success: true,
        data: featured
      };
    } catch (error) {
      this.log(`Error getting featured collections: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search collections by query
   * @param {string} query - Search query
   * @param {number} [limit=10] - Maximum number of results
   * @returns {Promise<Object>} Search results
   */
  async searchCollections(query, limit = 10) {
    if (!query || query.trim() === '') {
      return {
        success: true,
        data: [],
        message: 'Query is required'
      };
    }

    try {
      // Get all collections first
      const result = await this.getCollections({ limit: 100 });

      if (!result.success) {
        return result;
      }

      // Normalize query
      const normalizedQuery = query.toLowerCase().trim();
      this.log(`Searching collections for: "${normalizedQuery}"`);

      // Search in various fields
      const searchResults = result.data.filter(collection => {
        // Search in name
        if (collection.name?.toLowerCase().includes(normalizedQuery)) {
          return true;
        }

        // Search in description
        if (collection.description?.toLowerCase().includes(normalizedQuery)) {
          return true;
        }

        // Search in artist
        if (collection.metadata?.artist?.toLowerCase().includes(normalizedQuery)) {
          return true;
        }

        // Search in tags
        if (collection.metadata?.tags && Array.isArray(collection.metadata.tags)) {
          return collection.metadata.tags.some(tag =>
            tag.toLowerCase().includes(normalizedQuery)
          );
        }

        return false;
      });

      // Limit results
      const limitedResults = searchResults.slice(0, limit);

      this.log(`Found ${searchResults.length} collections, returning ${limitedResults.length}`);

      return {
        success: true,
        data: limitedResults,
        total: searchResults.length
      };
    } catch (error) {
      this.log(`Error searching collections: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get collections by tag
   * @param {string} tag - Tag to filter by
   * @param {number} [limit=10] - Maximum number of results
   * @returns {Promise<Object>} Collections with the specified tag
   */
  async getCollectionsByTag(tag, limit = 10) {
    if (!tag || tag.trim() === '') {
      return {
        success: false,
        error: 'Tag is required'
      };
    }

    try {
      // Use the existing getCollections method with tag filter
      return await this.getCollections({
        tag: tag.trim(),
        limit
      });
    } catch (error) {
      this.log(`Error getting collections by tag: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get collections by artist
   * @param {string} artist - Artist name to filter by
   * @param {number} [limit=10] - Maximum number of results
   * @returns {Promise<Object>} Collections by the specified artist
   */
  async getCollectionsByArtist(artist, limit = 10) {
    if (!artist || artist.trim() === '') {
      return {
        success: false,
        error: 'Artist name is required'
      };
    }

    try {
      // Use the existing getCollections method with artist filter
      return await this.getCollections({
        artist: artist.trim(),
        limit
      });
    } catch (error) {
      this.log(`Error getting collections by artist: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get available tags from all collections
   * @returns {Promise<Object>} List of unique tags
   */
  async getAvailableTags() {
    try {
      // Get all collections
      const result = await this.getCollections({ limit: 100 });

      if (!result.success) {
        return result;
      }

      // Extract and deduplicate tags
      const tagSet = new Set();

      result.data.forEach(collection => {
        if (collection.metadata?.tags && Array.isArray(collection.metadata.tags)) {
          collection.metadata.tags.forEach(tag => {
            if (tag && tag.trim() !== '') {
              tagSet.add(tag.trim());
            }
          });
        }
      });

      const tags = Array.from(tagSet).sort();

      this.log(`Found ${tags.length} unique tags`);

      return {
        success: true,
        data: tags
      };
    } catch (error) {
      this.log(`Error getting available tags: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get available artists from all collections
   * @returns {Promise<Object>} List of unique artists
   */
  async getAvailableArtists() {
    try {
      // Get all collections
      const result = await this.getCollections({ limit: 100 });

      if (!result.success) {
        return result;
      }

      // Extract and deduplicate artists
      const artistSet = new Set();

      result.data.forEach(collection => {
        if (collection.metadata?.artist && collection.metadata.artist.trim() !== '') {
          artistSet.add(collection.metadata.artist.trim());
        }
      });

      const artists = Array.from(artistSet).sort();

      this.log(`Found ${artists.length} unique artists`);

      return {
        success: true,
        data: artists
      };
    } catch (error) {
      this.log(`Error getting available artists: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clear the collections cache
   * @returns {boolean} Success status
   */
  clearCache() {
    this.collectionsCache = null;
    this.lastCacheTime = 0;
    this.log('Collections cache cleared');
    return true;
  }

  /**
   * Log a message with the specified level
   * @private
   * @param {string} message - Message to log
   * @param {string} [level='info'] - Log level
   */
  log(message, level = 'info') {
    if (!this.config.enableLogging) return;

    switch (level) {
      case 'error':
        logger.error('CollectionService', message);
        break;
      case 'warn':
        logger.warn('CollectionService', message);
        break;
      case 'debug':
        logger.debug('CollectionService', message);
        break;
      case 'info':
      default:
        logger.info('CollectionService', message);
        break;
    }
  }
}

export default CollectionService;
