// src/utils/collectionUtils.js
/**
 * Utility functions for working with audio collections
 * Handles mapping between collection tracks and player audio layers
 */

/**
 * Map collection tracks to audio layers based on layer type
 * @param {Object} collection - Collection data from API/database
 * @returns {Object} Formatted layers object for audio player
 */
export function mapCollectionToLayers(collection) {
    if (!collection || !collection.tracks) {
      console.error('[collectionUtils: mapCollectionToLayers] Invalid collection data');
      return {
        drone: [],
        melody: [],
        rhythm: [],
        nature: []
      };
    }
    
    console.log(`[collectionUtils: mapCollectionToLayers] Mapping collection: ${collection.name || collection.id}`);
    
    // Initialize layers structure
    const layers = {
      drone: [],
      melody: [],
      rhythm: [],
      nature: []
    };
    
    // Process tracks by layer type
    collection.tracks.forEach(track => {
      const layerType = track.layerType?.toLowerCase();
      
      // Skip tracks with invalid layer type
      if (!layers[layerType]) {
        console.warn(`[collectionUtils: mapCollectionToLayers] Unknown layer type: ${layerType} for track ${track.id}`);
        return;
      }
      
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
            name: variation.title || `${track.title} (Variation)`,
            path: variation.audioUrl
          };
          
          layers[layerType].push(variationTrack);
        });
      }
    });
    
    // Log results
    Object.entries(layers).forEach(([layer, tracks]) => {
      console.log(`[collectionUtils: mapCollectionToLayers] Layer ${layer}: ${tracks.length} tracks`);
    });
    
    return layers;
  }
  
  /**
   * Find a track by ID within a collection
   * @param {Object} collection - Collection data
   * @param {string} trackId - Track ID to find
   * @returns {Object|null} Found track or null
   */
  export function findTrackInCollection(collection, trackId) {
    if (!collection || !collection.tracks || !trackId) {
      return null;
    }
    
    // Check main tracks
    const mainTrack = collection.tracks.find(track => track.id === trackId);
    if (mainTrack) return mainTrack;
    
    // Check variations
    for (const track of collection.tracks) {
      if (track.variations && Array.isArray(track.variations)) {
        const variation = track.variations.find(v => v.id === trackId);
        if (variation) {
          // Return variation with parent track info
          return {
            ...variation,
            parentTrack: track.id,
            layerType: track.layerType
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Get all track IDs for a specific layer type
   * @param {Object} collection - Collection data
   * @param {string} layerType - Layer type (drone, melody, rhythm, nature)
   * @returns {Array} Array of track IDs for the layer
   */
  export function getLayerTrackIds(collection, layerType) {
    if (!collection || !collection.tracks || !layerType) {
      return [];
    }
    
    const trackIds = [];
    
    // Filter tracks by layer type
    collection.tracks.forEach(track => {
      if (track.layerType?.toLowerCase() === layerType.toLowerCase()) {
        trackIds.push(track.id);
        
        // Add variation IDs
        if (track.variations && Array.isArray(track.variations)) {
          track.variations.forEach(variation => {
            trackIds.push(variation.id);
          });
        }
      }
    });
    
    return trackIds;
  }
  
  /**
   * Get default track ID for each layer
   * @param {Object} collection - Collection data
   * @returns {Object} Map of layer types to default track IDs
   */
  export function getDefaultLayerTracks(collection) {
    if (!collection || !collection.tracks) {
      return {};
    }
    
    const defaultTracks = {};
    const layerTypes = ['drone', 'melody', 'rhythm', 'nature'];
    
    // Find first track for each layer type
    layerTypes.forEach(layerType => {
      const layerTracks = collection.tracks.filter(
        track => track.layerType?.toLowerCase() === layerType
      );
      
      if (layerTracks.length > 0) {
        defaultTracks[layerType] = layerTracks[0].id;
      }
    });
    
    return defaultTracks;
  }
  
  /**
   * Get path to a track's audio file
   * @param {Object} collection - Collection data
   * @param {string} trackId - Track ID
   * @returns {string|null} Path to audio file or null if not found
   */
  export function getTrackAudioPath(collection, trackId) {
    const track = findTrackInCollection(collection, trackId);
    return track ? track.audioUrl : null;
  }
  
  /**
   * Format collection metadata for display
   * @param {Object} collection - Collection data
   * @returns {Object} Formatted metadata
   */
  export function formatCollectionMetadata(collection) {
    if (!collection) return {};
    
    return {
      id: collection.id,
      name: collection.name || 'Unnamed Collection',
      description: collection.description || '',
      coverImage: collection.coverImage || null,
      artist: collection.metadata?.artist || 'Unknown Artist',
      year: collection.metadata?.year || null,
      tags: collection.metadata?.tags || [],
      trackCount: collection.tracks?.length || 0
    };
  }