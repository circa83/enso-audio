// src/utils/collectionUtils.js
/**
 * Utility functions for working with audio collections
 * Handles mapping between collection tracks and player audio layers
 */

/**
 * Map collection tracks to audio layers based on layer folder
 * @param {Object} collection - Collection data from API/database
 * @returns {Object} Formatted layers object for audio player
 */
export function mapCollectionToLayers(collection) {
  if (!collection || !collection.tracks) {
    console.error('[collectionUtils: mapCollectionToLayers] Invalid collection data');
    return {
      Layer_1: [],
      Layer_2: [],
      Layer_3: [],
      Layer_4: []
    };
  }
  
  console.log(`[collectionUtils: mapCollectionToLayers] Mapping collection: ${collection.name || collection.id}`);
  
  // Initialize layers structure with layer folders instead of types
  const layers = {
    Layer_1: [],
    Layer_2: [],
    Layer_3: [],
    Layer_4: []
  };
  
  // Process tracks by layer folder
  collection.tracks.forEach(track => {
    const layerFolder = track.layerFolder || deriveLayerFolder(track);
    
    // Skip tracks with invalid layer folder
    if (!layers[layerFolder]) {
      console.warn(`[collectionUtils: mapCollectionToLayers] Unknown layer folder: ${layerFolder} for track ${track.id}`);
      return;
    }
    
    // Format track for player
    const formattedTrack = {
      id: track.id,
      name: track.title,
      path: track.audioUrl
    };
    
    // Add to appropriate layer
    layers[layerFolder].push(formattedTrack);
    
    // Process variations if they exist
    if (track.variations && Array.isArray(track.variations)) {
      track.variations.forEach(variation => {
        const variationTrack = {
          id: variation.id,
          name: variation.title || `${track.title} (Variation)`,
          path: variation.audioUrl
        };
        
        layers[layerFolder].push(variationTrack);
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
 * Helper function to determine layer folder from track properties
 * @private
 * @param {Object} track - Track object
 * @returns {string} Layer folder (Layer_1, Layer_2, etc.)
 */
function deriveLayerFolder(track) {
  // First check if track has explicit layerFolder property
  if (track.layerFolder) return track.layerFolder;
  
  // Try to determine from URL patterns
  if (track.audioUrl) {
    const url = track.audioUrl.toLowerCase();
    if (url.includes('/layer_1/')) return 'Layer_1';
    if (url.includes('/layer_2/')) return 'Layer_2';
    if (url.includes('/layer_3/')) return 'Layer_3';
    if (url.includes('/layer_4/')) return 'Layer_4';
  }
  
  // Try to derive from track id or title
  const trackString = `${track.id} ${track.title || ''}`.toLowerCase();
  if (trackString.includes('layer_1') || trackString.includes('layer1')) return 'Layer_1';
  if (trackString.includes('layer_2') || trackString.includes('layer2')) return 'Layer_2';
  if (trackString.includes('layer_3') || trackString.includes('layer3')) return 'Layer_3';
  if (trackString.includes('layer_4') || trackString.includes('layer4')) return 'Layer_4';
  
  // For backward compatibility - map old layer types to layer folders
  if (track.layerType) {
    const layerType = track.layerType.toLowerCase();
    if (layerType === 'drone') return 'Layer_1';
    if (layerType === 'melody') return 'Layer_2';
    if (layerType === 'rhythm') return 'Layer_3';
    if (layerType === 'nature') return 'Layer_4';
  }
  
  // Default to Layer_1 if we can't determine
  return 'Layer_1';
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
        // Return variation with parent track info, using layerFolder instead of layerType
        return {
          ...variation,
          parentTrack: track.id,
          layerFolder: track.layerFolder || deriveLayerFolder(track)
        };
      }
    }
  }
  
  return null;
}

/**
 * Get all track IDs for a specific layer folder
 * @param {Object} collection - Collection data
 * @param {string} layerFolder - Layer folder (Layer_1, Layer_2, Layer_3, Layer_4)
 * @returns {Array} Array of track IDs for the layer
 */
export function getLayerTrackIds(collection, layerFolder) {
  if (!collection || !collection.tracks || !layerFolder) {
    return [];
  }
  
  const trackIds = [];
  
  // Filter tracks by layer folder
  collection.tracks.forEach(track => {
    const trackLayerFolder = track.layerFolder || deriveLayerFolder(track);
    
    if (trackLayerFolder === layerFolder) {
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
 * @returns {Object} Map of layer folders to default track IDs
 */
export function getDefaultLayerTracks(collection) {
  if (!collection || !collection.tracks) {
    return {};
  }
  
  const defaultTracks = {};
  const layerFolders = ['Layer_1', 'Layer_2', 'Layer_3', 'Layer_4'];
  
  // Find first track for each layer folder
  layerFolders.forEach(layerFolder => {
    const layerTracks = collection.tracks.filter(track => {
      const trackLayerFolder = track.layerFolder || deriveLayerFolder(track);
      return trackLayerFolder === layerFolder;
    });
    
    if (layerTracks.length > 0) {
      defaultTracks[layerFolder] = layerTracks[0].id;
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