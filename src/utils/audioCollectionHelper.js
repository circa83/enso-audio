// src/utils/audioCollectionHelper.js
/**
 * Helper functions for integrating audio collections with audio engine
 * Facilitates mapping collection data to audio engine components
 */

import { mapCollectionToLayers, findTrackInCollection } from './collectionUtils.js';

/**
 * Prepare collection audio tracks for loading into audio engine
 * @param {Object} collection - Collection data
 * @param {Object} services - Audio services (bufferManager, etc.)
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Prepared audio data
 */
export async function prepareCollectionAudio(collection, services, onProgress) {
  if (!collection || !collection.tracks || !services.bufferManager) {
    console.error('[audioCollectionHelper: prepareCollectionAudio] Invalid input params');
    return null;
  }
  
  const { bufferManager } = services;
  
  console.log(`[audioCollectionHelper: prepareCollectionAudio] Preparing collection: ${collection.name || collection.id}`);
  
  // Format collection to layers structure
  const layers = mapCollectionToLayers(collection);
  
  // Gather URLs that need to be preloaded
  const urlsToPreload = [];
  
  // Track URL to ID mapping for progress tracking
  const urlToTrackMap = new Map();
  
  // Process each layer
  Object.entries(layers).forEach(([layerFolder, tracks]) => {
    tracks.forEach(track => {
      if (track.path) {
        urlsToPreload.push(track.path);
        urlToTrackMap.set(track.path, track.id);
      }
    });
  });
  
  // Progress tracking data
  let preloadProgress = {};
  
  // Preload all audio files with progress tracking
  console.log(`[audioCollectionHelper: prepareCollectionAudio] Preloading ${urlsToPreload.length} audio files`);
  
  // Define progress tracking function
  const trackProgress = (overallProgress, detailedProgress) => {
    // Convert URL-based progress to track ID-based progress
    const trackProgress = {};
    
    Object.entries(detailedProgress).forEach(([url, progress]) => {
      const trackId = urlToTrackMap.get(url);
      if (trackId) {
        trackProgress[trackId] = progress;
      }
    });
    
    // Update tracking object
    preloadProgress = trackProgress;
    
    // Call main progress callback
    if (onProgress) {
      onProgress(overallProgress, trackProgress);
    }
  };
  
  // Perform preloading with progress tracking
  try {
    // Prioritize main layer tracks first
    const mainTracks = urlsToPreload.filter(url => {
      // Check if this is a main track (not a variation)
      const trackId = urlToTrackMap.get(url);
      const track = trackId && findTrackInCollection(collection, trackId);
      return track && !track.parentTrack; // No parentTrack means it's a main track
    });
    
    // Preload main tracks first
    await bufferManager.preloadBuffers(mainTracks, {
      onProgress: trackProgress,
      prioritizeBlobs: true
    });
    
    // Then preload remaining tracks (variations)
    const remainingTracks = urlsToPreload.filter(url => !mainTracks.includes(url));
    
    if (remainingTracks.length > 0) {
      console.log(`[audioCollectionHelper: prepareCollectionAudio] Preloading ${remainingTracks.length} variation tracks`);
      
      await bufferManager.preloadBuffers(remainingTracks, {
        onProgress: trackProgress,
        prioritizeBlobs: true
      });
    }
    
    console.log('[audioCollectionHelper: prepareCollectionAudio] Preloading complete');
    
    return {
      layers,
      preloadProgress,
      success: true
    };
  } catch (error) {
    console.error(`[audioCollectionHelper: prepareCollectionAudio] Preload error: ${error.message}`, error);
    
    return {
      layers,
      preloadProgress,
      success: false,
      error: error.message
    };
  }
}

/**
 * Load collection tracks into active audio layers
 * @param {Object} collection - Collection data
 * @param {Object} audioServices - Audio services object
 * @param {Object} options - Load options
 * @returns {Promise<Object>} Load result
 */
export async function loadCollectionIntoAudioEngine(collection, audioServices, options = {}) {
  const {
    fadeInDuration = 2000,
    initialVolumes = {},
    activePhase = null
  } = options;
  
  if (!collection || !audioServices) {
    console.error('[audioCollectionHelper: loadCollectionIntoAudioEngine] Invalid parameters');
    return { success: false, error: 'Invalid parameters' };
  }
  
  console.log(`[audioCollectionHelper: loadCollectionIntoAudioEngine] Loading collection: ${collection.name || collection.id}`);
  
  try {
    // Get formatted layers
    const { layers } = await prepareCollectionAudio(collection, audioServices, options.onProgress);
    
    // Track which layers were successfully loaded
    const loadedLayers = {};
    const errors = [];
    
    // For each layer type, load the first track
    for (const [layerFolder, tracks] of Object.entries(layers)) {
      if (!tracks || tracks.length === 0) {
        console.log(`[audioCollectionHelper: loadCollectionIntoAudioEngine] No tracks for layer: ${layerFolder}`);
        continue;
      }
      
      try {
        // Get first track for this layer
        const track = tracks[0];
        
        // Get desired volume for this layer
        const layerVolume = initialVolumes[layerFolder] !== undefined 
            ? initialVolumes[layerFolder]
          : layerFolder === 'Layer_1' ? 0.6 : 0; // Default: drone on, others off
        
        console.log(`[audioCollectionHelper: loadCollectionIntoAudioEngine] Loading ${layerFolder}: ${track.id} at volume ${layerVolume}`);
        
        // Set volume for layer
        if (audioServices.volumeController) {
          audioServices.volumeController.setVolume(layerFolder, layerVolume, {
            immediate: true // Set immediately initially
          });
        }
        
        // If crossfade engine is available, use it to properly load the track
        if (audioServices.crossfadeEngine && audioServices.crossfadeEngine.crossfadeTo) {
          // Use crossfade with very short duration for initial load
          await audioServices.crossfadeEngine.crossfadeTo(layerFolder, track.id, 100);
        } else {
          // Fallback if crossfadeEngine not available
          console.warn(`[audioCollectionHelper: loadCollectionIntoAudioEngine] No crossfade engine available for ${layerFolder}`);
          // Here we'd need a direct loading mechanism, but it depends on app structure
        }
        
        // Track successful load
        loadedLayers[layerFolder] = track.id;
      } catch (error) {
        console.error(`[audioCollectionHelper: loadCollectionIntoAudioEngine] Error loading ${layerFolder}: ${error.message}`);
        errors.push({ layer: layerFolder, error: error.message });
      }
    }
    
    // If phase is specified and timeline engine is available, set the phase
    if (activePhase && audioServices.timelineEngine) {
      console.log(`[audioCollectionHelper: loadCollectionIntoAudioEngine] Setting timeline phase to: ${activePhase}`);
      
      // Find phase in collection
      const phaseData = collection.phases?.find(p => p.id === activePhase);
      
      if (phaseData) {
        // Apply phase to timeline
        audioServices.timelineEngine.setActivePhase(activePhase, phaseData);
      }
    }
    
    return {
      success: true,
      loadedLayers,
      errors: errors.length > 0 ? errors : null
    };
  } catch (error) {
    console.error(`[audioCollectionHelper: loadCollectionIntoAudioEngine] Load error: ${error.message}`, error);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update active tracks for a collection
 * @param {Object} collection - Collection data
 * @param {Object} audioServices - Audio services
 * @param {Object} activeAudio - Current active audio state
 * @returns {Promise<Object>} Result with active tracks
 */
export async function updateCollectionActiveTracks(collection, audioServices, activeAudio) {
  if (!collection || !audioServices || !activeAudio) {
    console.error('[audioCollectionHelper: updateCollectionActiveTracks] Invalid parameters');
    return { success: false };
  }
  
  try {
    // Get collection layer mapping
    const layers = mapCollectionToLayers(collection);
    const updatedAudio = {...activeAudio};
    const changes = [];
    
    // Check each layer
    for (const [layerFolder, tracks] of Object.entries(layers)) {
      if (!tracks || tracks.length === 0) continue;
      
      const currentTrackId = activeAudio[layerFolder];
      
      // If current track not found in collection, update to first track
      if (currentTrackId) {
        const foundInCollection = tracks.some(t => t.id === currentTrackId);
        
        if (!foundInCollection) {
          console.log(`[audioCollectionHelper: updateCollectionActiveTracks] Track ${currentTrackId} not found in collection for ${layerFolder}, updating`);
          
          // Update to first track
          updatedAudio[layerFolder] = tracks[0].id;
          changes.push({ layer: layerFolder, from: currentTrackId, to: tracks[0].id });
        }
      } else {
        // No track set, set to first track
        updatedAudio[layerFolder] = tracks[0].id;
        changes.push({ layer: layerFolder, from: null, to: tracks[0].id });
      }
    }
    
    // If changes were needed, return the updated state
    if (changes.length > 0) {
      return {
        success: true,
        activeAudio: updatedAudio,
        changes
      };
    }
    
    // No changes needed
    return { 
      success: true, 
      activeAudio,
      changes: []
    };
  } catch (error) {
    console.error(`[audioCollectionHelper: updateCollectionActiveTracks] Error: ${error.message}`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a test to validate audio loading from a collection
 * @param {Object} collection - Collection to test
 * @param {Object} audioServices - Audio services
 * @returns {Promise<Object>} Test results
 */
export async function testCollectionAudioLoading(collection, audioServices) {
  if (!collection || !audioServices || !audioServices.bufferManager) {
    return { success: false, error: 'Invalid parameters' };
  }
  
  console.log(`[audioCollectionHelper: testCollectionAudioLoading] Testing collection: ${collection.name || collection.id}`);
  
  const testResults = {
    collection: collection.id,
    layerResults: {},
    bufferResults: [],
    errors: []
  };
  
  try {
    // Format collection to layers
    const layers = mapCollectionToLayers(collection);
    
    // Test loading audio for each layer
    for (const [layerFolder, tracks] of Object.entries(layers)) {
      if (!tracks || tracks.length === 0) {
        testResults.layerResults[layerFolder] = { 
          tracks: 0, 
          message: 'No tracks found'
        };
        continue;
      }
      
      // Test results for this layer
      const layerResult = {
        tracks: tracks.length,
        loadedTracks: 0,
        failedTracks: 0,
        details: []
      };
      
      // Test first track in each layer
      try {
        const track = tracks[0];
        console.log(`[audioCollectionHelper: testCollectionAudioLoading] Testing ${layerFolder}: ${track.id}`);
        
        // Try to load buffer
        const buffer = await audioServices.bufferManager.loadAudioBuffer(track.path);
        
        // Store buffer info
        if (buffer) {
          testResults.bufferResults.push({
            trackId: track.id,
            layer: layerFolder,
            duration: buffer.duration,
            sampleRate: buffer.sampleRate,
            channels: buffer.numberOfChannels
          });
          
          layerResult.loadedTracks++;
          layerResult.details.push({ 
            trackId: track.id, 
            success: true, 
            duration: buffer.duration 
          });
        }
      } catch (error) {
        testResults.errors.push({
          layer: layerFolder,
          trackId: tracks[0].id,
          error: error.message
        });
        
        layerResult.failedTracks++;
        layerResult.details.push({ 
          trackId: tracks[0].id, 
          success: false, 
          error: error.message 
        });
      }
      
      // Store results for this layer
      testResults.layerResults[layerFolder] = layerResult;
    }
    
    // Final success determination
    const success = testResults.errors.length === 0;
    
    return {
      ...testResults,
      success
    };
  } catch (error) {
    console.error(`[audioCollectionHelper: testCollectionAudioLoading] Test error: ${error.message}`, error);
    
    return {
      ...testResults,
      success: false,
      error: error.message
    };
  }
}