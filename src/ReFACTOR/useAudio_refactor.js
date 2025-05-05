// src/hooks/useAudio.js
import { useContext, useCallback, useMemo } from 'react';
import AudioContext from '../contexts/StreamingAudioContext';

/**
 * Custom hook to simplify access to the Audio context functionality
 * Provides a clean, organized API grouped by functionality areas
 * Works with the manager-based architecture in StreamingAudioContext
 * 
 * @returns {Object} Object containing all audio functions and state
 */
export function useAudio() {
  const context = useContext(AudioContext);

  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }

  // Extract values from context for cleaner access
  const {
    // Core audio state
    isPlaying,
    isLoading,
    loadingProgress,
    masterVolume,
    volumes,
    activeAudio,
    audioLibrary,
    hasSwitchableAudio,

    // Core audio functions (from PlaybackManager)
    startSession,
    pauseSession,
    getSessionTime,
    preloadAudio,

    // Volume and Layer functions (from LayerManager)
    setMasterVolumeLevel,
    setVolume,
    crossfadeTo,
    fadeLayerVolume,
    switchTrack,

    // Audio element functions
    getActiveAudioElement,
    getActiveSourceNode,
    getOrCreateAudioElement,
    getOrCreateSourceNode,

    // Audio transition state
    crossfadeProgress,
    activeCrossfades,
    preloadProgress,

    // Collection state and functions (from CollectionLoader)
    currentCollection,
    loadingCollection,
    collectionError,
    collectionLoadProgress,
    loadCollection,

    // Constants
    LAYERS
  } = context;

  // Group related functionality for a more organized API

  // Playback controls (maps to PlaybackManager)
  const playback = useMemo(() => ({
    isPlaying,
    start: () => {
      console.log('[useAudio] Starting session playback');
      return startSession();
    },
    pause: () => {
      console.log('[useAudio] Pausing session playback');
      return pauseSession();
    },
    getTime: () => {
      // Don't log this to avoid console spam
      return getSessionTime();
    }
  }), [isPlaying, startSession, pauseSession, getSessionTime]);

  // Volume controls (maps to LayerManager)
  const volume = useMemo(() => ({
    master: masterVolume,
    layers: volumes,
    setMaster: (level, options) => {
      return setMasterVolumeLevel(level, options);
    },
    setLayer: (layer, level, options) => {
      return setVolume(layer, level, options);
    },
    fadeVolume: (layer, targetVolume, duration) => {
      console.log(`[useAudio] Fading ${layer} volume to ${targetVolume} over ${duration}ms`);
      return fadeLayerVolume(layer, targetVolume, duration);
    }
  }), [masterVolume, volumes, setMasterVolumeLevel, setVolume, fadeLayerVolume]);

  // Layer management (maps to LayerManager)
  const layers = useMemo(() => ({
    active: activeAudio,
    available: audioLibrary,
    hasSwitchable: hasSwitchableAudio,
    TYPES: LAYERS
  }), [activeAudio, audioLibrary, hasSwitchableAudio, LAYERS]);

  // Helper functions for audio elements - match the original implementation
  const getActiveAudio = useCallback((layer) => {
    return getActiveAudioElement(layer);
  }, [getActiveAudioElement]);

  const getActiveSource = useCallback((layer) => {
    return getActiveSourceNode(layer);
  }, [getActiveSourceNode]);

  const getOrCreateAudio = useCallback((layer) => {
    return getOrCreateAudioElement(layer);
  }, [getOrCreateAudioElement]);

  const getOrCreateSource = useCallback((layer) => {
    return getOrCreateSourceNode(layer);
  }, [getOrCreateSourceNode]);

  // Transitions (crossfade functionality from LayerManager)
  const transitions = useMemo(() => ({
    active: activeCrossfades,
    progress: crossfadeProgress,
    preloadProgress,
    crossfade: (layer, trackId, duration) => {
      console.log(`[useAudio] Crossfading ${layer} to track ${trackId}`);
      return crossfadeTo(layer, trackId, duration);
    },
    preload: (layer, trackId) => {
      console.log(`[useAudio] Preloading ${layer} track ${trackId}`);
      return preloadAudio(layer, trackId);
    }
  }), [activeCrossfades, crossfadeProgress, preloadProgress, crossfadeTo, preloadAudio]);

  // Collection functionality (maps to CollectionLoader)
  const collections = useMemo(() => ({
    current: currentCollection,
    isLoading: loadingCollection,
    error: collectionError,
    loadProgress: collectionLoadProgress,
    load: (id, options) => {
      console.log(`[useAudio] Loading collection: ${id}`);
      return loadCollection(id, options);
    },
    switchTrack: (layer, trackId, options) => {
      console.log(`[useAudio] Switching track for ${layer} to ${trackId}`);
      return switchTrack(layer, trackId, options);
    }
  }), [
    currentCollection,
    loadingCollection,
    collectionError,
    collectionLoadProgress,
    loadCollection,
    switchTrack
  ]);

  // Loading state
  const loading = useMemo(() => ({
    isLoading,
    progress: loadingProgress
  }), [isLoading, loadingProgress]);

  // Return both grouped functionality and individual functions/values
  return {
    // Grouped functionality
    playback,
    volume,
    layers,
    transitions,
    loading,
    collections,

    // Individual values and functions (for backward compatibility)
    isPlaying,
    isLoading,
    loadingProgress,
    masterVolume,
    volumes,
    activeAudio,
    audioLibrary,
    hasSwitchableAudio,
    crossfadeProgress,
    activeCrossfades,
    preloadProgress,
    LAYERS,

    // Collection state
    currentCollection,
    loadingCollection,
    collectionError,
    collectionLoadProgress,

    // Functions - use original names
    setMasterVolumeLevel,
    setVolume,
    startSession,
    pauseSession,
    crossfadeTo,
    preloadAudio,
    getSessionTime,
    getActiveAudioElement,
    getActiveSourceNode,
    getOrCreateAudioElement,
    getOrCreateSourceNode,
    loadCollection,
    switchTrack
  };
}

// Export as default as well for flexibility
export default useAudio;
