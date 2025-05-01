/**
 * CollectionService.js
 * 
 * Service for managing audio collections in Ensō Audio
 * Handles fetching, filtering, and processing collection data
 */

import appConfig from "../Config/appConfig";


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
        console.log(`[CollectionService: getCollections] Using cached collections data (${this.collectionsCache.data.length} items)`);
        return this.collectionsCache;
      }

      // Check for pending request with same parameters
      if (this.pendingRequests.has(cacheKey)) {
        console.log(`[CollectionService: getCollections] Using pending request for key: ${cacheKey}`);
        return this.pendingRequests.get(cacheKey);
      }

      // Create request promise
      const requestPromise = (async () => {
        try {
          // Fetch collections from local file
          console.log('[CollectionService: getCollections] Fetching collections from local file');
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
            console.log(`[CollectionService: getCollections] Filtered by tag "${tag}": ${collections.length} results`);
          }

          if (artist) {
            collections = collections.filter(collection =>
              collection.metadata?.artist?.toLowerCase().includes(artist.toLowerCase())
            );
            console.log(`[CollectionService: getCollections] Filtered by artist "${artist}": ${collections.length} results`);
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
            console.log(`[CollectionService: getCollections] Updated cache with ${collections.length} collections`);
          }

          return result;
        } catch (error) {
          console.error(`[CollectionService: getCollections] Error: ${error.message}`);
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

    // Create request promise
    const requestPromise = (async () => {
      try {
        // Fetch the collection metadata from the local file
        console.log(`[CollectionService: getCollection] Fetching collection ${id} from local metadata file`);
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
        console.log(`[CollectionService: getCollection] Error: ${error.message}`, 'error');
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
      console.log(`[CollectionService: formatCollectionForPlayer] Formatting collection: ${collection.id}`);
      console.log(`[CollectionService: formatCollectionForPlayer] Collection ID type: ${typeof collection.id}`);
      console.log(`[CollectionService: formatCollectionForPlayer] Raw collection ID value: "${collection.id}"`);
      
      // // More specific check of collection ID:
      // if (collection.id === 'Stillness') {
      //   console.log('[CollectionService: formatCollectionForPlayer] MATCH: Collection ID exactly matches "stillness"');
      // } else {
      //   console.log('[CollectionService: formatCollectionForPlayer] NO MATCH: Collection ID does not exactly match "stillness"');
      // }
      let collectionConfig = null;
      if (applyConfig) {
        const appConfig = require('../Config/appConfig').default;
              // Log available collection IDs in appConfig
      console.log('[CollectionService: formatCollectionForPlayer] Available collection configs in appConfig:');
      const availableCollections = appConfig.getAvailableCollections();
      console.log(`[CollectionService: formatCollectionForPlayer] - Available IDs: ${JSON.stringify(availableCollections)}`);
      
        collectionConfig = appConfig.getCollectionConfig(collection.id);
        console.log(`[CollectionService: formatCollectionForPlayer] Config fetched for "${collection.id}":`);
        console.log(`- Config found: ${collectionConfig ? 'YES' : 'NO'}`);
        console.log(`- Is default config: ${collectionConfig === appConfig.defaults ? 'YES' : 'NO'}`);
        console.log(`- Has phases: ${collectionConfig.phaseMarkers?.length || 0}`);
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
        console.error(`[CollectionService: formatCollectionForPlayer] Collection ${collection.id} has no tracks`);
        throw new Error(`Collection "${collection.name || collection.id}" has no audio tracks`);
      }

      let formattedTrackCount = 0;

      // Process tracks - existing implementation unchanged
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
              console.warn(`[CollectionService: formatCollectionForPlayer] Variation missing id in track ${track.id}`);
              return;
            }

            if (!variation.audioUrl) {
              console.warn(`[CollectionService: formatCollectionForPlayer] Variation ${variation.id} missing audioUrl`);
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
        console.error('[CollectionService: formatCollectionForPlayer] No valid tracks found in collection');
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

      // NEW: Apply collection-specific configuration if requested
      if (applyConfig) {
        this.applyCollectionConfig(formattedCollection);
      }

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
    * Apply collection-specific configuration from appConfig
    * @param {Object} formattedCollection - Formatted collection object
    * @returns {Object} Collection with applied configuration
    */
  applyCollectionConfig(formattedCollection) {
    try {
      if (!formattedCollection || !formattedCollection.id) {
        console.warn('[CollectionService: applyCollectionConfig] Cannot apply config: Invalid collection');
        return formattedCollection;
      }

      // Normalize the collection ID for better matching
      const collectionId = formattedCollection.id.trim();
      console.log(`[CollectionService: applyCollectionConfig] Applying config for normalized ID: "${collectionId}"`);

      // Get the collection-specific configuration (this checks if enabled)
      const collectionConfig = appConfig.getCollectionConfig(collectionId);

      if (!collectionConfig) {
        console.warn(`[CollectionService: applyCollectionConfig] No configuration found for collection: ${formattedCollection.id}`);
        return formattedCollection;
      }

      console.log(`[CollectionService: applyCollectionConfig] Applying configuration to collection: ${formattedCollection.id}`);

      // Apply session and transition duration
      formattedCollection.sessionDuration = collectionConfig.sessionDuration;
      formattedCollection.transitionDuration = collectionConfig.transitionDuration;

      // Apply default volumes
      formattedCollection.defaultVolumes = { ...collectionConfig.volumes };

      // Apply phase markers if available
      if (collectionConfig.phaseMarkers && Array.isArray(collectionConfig.phaseMarkers)) {
        console.log(`[CollectionService: applyCollectionConfig] Found ${collectionConfig.phaseMarkers.length} phase markers in config`);
        
        // Log state information before cloning
        collectionConfig.phaseMarkers.forEach(phase => {
          console.log(`[CollectionService: applyCollectionConfig] Phase "${phase.name}" before cloning:`);
          console.log(`- Has state: ${phase.state ? 'YES' : 'NO'}`);
          if (phase.state) {
            console.log(`- Volumes: ${JSON.stringify(phase.state.volumes || {})}`);
            console.log(`- ActiveAudio: ${JSON.stringify(phase.state.activeAudio || {})}`);
          }
        });
        
        // Use structured cloning instead of JSON parse/stringify to better preserve objects
        formattedCollection.phaseMarkers = collectionConfig.phaseMarkers.map(marker => {
          // Create a new marker object with all properties
          const newMarker = {
            id: marker.id,
            name: marker.name,
            position: marker.position,
            color: marker.color,
            locked: marker.locked || false
          };
          
          // Explicitly copy the state object if it exists
          if (marker.state) {
            newMarker.state = {
              volumes: marker.state.volumes ? {...marker.state.volumes} : {},
              activeAudio: marker.state.activeAudio ? {...marker.state.activeAudio} : {}
            };
          }
          
          return newMarker;
        });
        
        // Validate and log after cloning
        formattedCollection.phaseMarkers.forEach(marker => {
          console.log(`[CollectionService: applyCollectionConfig] Phase "${marker.name}" after cloning:`);
          console.log(`- Has state: ${marker.state ? 'YES' : 'NO'}`);
          if (marker.state) {
            console.log(`- Volumes: ${JSON.stringify(marker.state.volumes || {})}`);
            console.log(`- ActiveAudio: ${JSON.stringify(marker.state.activeAudio || {})}`);
          }
          
          // Validate tracks if activeAudio is present
          if (marker.state && marker.state.activeAudio) {
            Object.entries(marker.state.activeAudio).forEach(([layer, trackId]) => {
              const valid = this.validateTrackExists(formattedCollection, layer, trackId);
             // console.log(`[CollectionService: applyCollectionConfig] - Track ${trackId} for layer ${layer}: ${valid ? 'VALID' : 'INVALID'}`);
            });
          }
        });
      }

      return formattedCollection;
    } catch (error) {
      console.error(`[CollectionService: applyCollectionConfig] Error applying config: ${error.message}`);
      // Return the original collection without config applied
      return formattedCollection;
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