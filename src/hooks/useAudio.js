// src/hooks/useAudio.js
import { useContext, useCallback, useMemo } from 'react';
import AudioContext from '../contexts/StreamingAudioContext';

/**
 * Custom hook to simplify access to the Audio context functionality
 * Provides a clean, organized API grouped by functionality areas
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
    
    // Core audio functions
    setMasterVolumeLevel,
    setVolume,
    startSession,
    pauseSession,
    getSessionTime,
    
    // Audio transition state
    crossfadeProgress,
    activeCrossfades,
    fadeLayerVolume,
    preloadProgress,
    
    // Audio transition functions
    crossfadeTo,
    preloadAudio,
    
    // Timeline state 
    timelineEvents,
    timelinePhases,
    activePhase,
    progress,
    sessionDuration,
    transitionDuration,
    timelineIsEnabled,
    setTimelineEnabled,
    timelineIsPlaying, 
    startTimeline,
    pauseTimeline,
    resumeTimeline,
    stopTimeline,
  
    
    // Timeline functions
    resetTimelineEventIndex,
    registerTimelineEvent,
    clearTimelineEvents,
    updateTimelinePhases,
    seekToTime,
    seekToPercent,
    setSessionDuration,
    setTransitionDuration,
    
    // Preset functions
    registerPresetStateProvider,
    savePreset,
    loadPreset,
    deletePreset,
    getPresets,
    exportPreset,
    importPreset,
    
    // Constants
    LAYERS
  } = context;

  // Group related functionality for a more organized API
  
  // Playback controls
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
  
  // Volume controls
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
  
  // Layer management
  const layers = useMemo(() => ({
    active: activeAudio,
    available: audioLibrary,
    hasSwitchable: hasSwitchableAudio,
    TYPES: LAYERS
  }), [activeAudio, audioLibrary, hasSwitchableAudio, LAYERS]);
  
  // Transitions
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
  
  // Timeline controls with enhanced debugging
  const timeline = useMemo(() => ({
    events: timelineEvents,
    phases: timelinePhases,
    activePhase,
    progress,
    duration: sessionDuration,
    transitionDuration,
    enabled: timelineIsEnabled,
    setTimelineEnabled, 
    isPlaying: timelineIsPlaying,
    
    startTimeline: () => { 
      console.log('[useAudio] Starting timeline progression');
      return startTimeline();
    },
    pauseTimeline: () => { 
      console.log('[useAudio] Pausing timeline progression (preserving position)');
     return pauseTimeline();
    },
    resumeTimeline: () => {
      console.log('[useAudio] Resuming timeline progression from current position');
      return resumeTimeline();
    },
    stopTimeline: () => { 
      console.log('[useAudio] Stopping timeline progression');
      return stopTimeline();
    },
    resetTimeline: () => {
      console.log('[useAudio] Resetting timeline event index');
      return resetTimelineEventIndex();
    },
    reset: () => {
      console.log('[useAudio] Resetting timeline event index');
      return resetTimelineEventIndex();
    },
    registerEvent: (event) => {
      console.log(`[useAudio] Registering timeline event: ${event.id}`);
      return registerTimelineEvent(event);
    },
    clearEvents: () => {
      console.log('[useAudio] Clearing all timeline events');
      return clearTimelineEvents();
    },
    updatePhases: (phases) => {
     // console.log(`[useAudio] Updating timeline phases (${phases.length} phases)`);
      return updateTimelinePhases(phases);
    },
    seekToTime: (timeMs) => {
      console.log(`[useAudio] Seeking to time: ${timeMs}ms`);
      return seekToTime(timeMs);
    },
    seekToPercent: (percent) => {
      console.log(`[useAudio] Seeking to percent: ${percent}%`);
      return seekToPercent(percent);
    },
    setDuration: (duration) => {
      console.log(`[useAudio] Setting session duration: ${duration}ms`);
      return setSessionDuration(duration);
    },
    setTransitionDuration: (duration) => {
      console.log(`[useAudio] Setting transition duration: ${duration}ms`);
      return setTransitionDuration(duration);
    }
  }), [
    startTimeline,
    pauseTimeline,
    resumeTimeline,
    stopTimeline,
    timelineIsEnabled,
    timelineIsPlaying,
    setTimelineEnabled,
    timelineEvents, 
    timelinePhases, 
    activePhase, 
    progress, 
    sessionDuration, 
    transitionDuration,
    resetTimelineEventIndex,
    registerTimelineEvent,
    clearTimelineEvents,
    updateTimelinePhases,
    seekToTime,
    seekToPercent,
    setSessionDuration,
    setTransitionDuration
  ]);
  
  // Preset management
  const presets = useMemo(() => ({
    registerStateProvider: (key, providerFn) => {
      console.log(`[useAudio] ${providerFn ? 'Registering' : 'Unregistering'} preset state provider: ${key}`);
      return registerPresetStateProvider(key, providerFn);
    },
    save: (name) => {
      console.log(`[useAudio] Saving preset: ${name}`);
      return savePreset(name);
    },
    load: (nameOrData) => {
      if (typeof nameOrData === 'string') {
        console.log(`[useAudio] Loading preset: ${nameOrData}`);
      } else {
        console.log('[useAudio] Loading preset from data object');
      }
      return loadPreset(nameOrData);
    },
    delete: (name) => {
      console.log(`[useAudio] Deleting preset: ${name}`);
      return deletePreset(name);
    },
    getAll: () => {
      // Don't log for get operations
      return getPresets();
    },
    export: (name) => {
      console.log(`[useAudio] Exporting preset: ${name}`);
      return exportPreset(name);
    },
    import: (jsonString) => {
      console.log('[useAudio] Importing preset from JSON data');
      return importPreset(jsonString);
    }
  }), [
    registerPresetStateProvider,
    savePreset,
    loadPreset,
    deletePreset,
    getPresets,
    exportPreset,
    importPreset
  ]);
  
  // Loading state
  const loading = useMemo(() => ({
    isLoading,
    progress: loadingProgress
  }), [isLoading, loadingProgress]);

  // Return both grouped functionality and individual functions/values
  // to support both usage patterns:
  // const { playback, volume } = useAudio(); // Grouped
  // const { isPlaying, startSession } = useAudio(); // Individual
  return {
    // Grouped functionality
    playback,
    volume,
    layers,
    transitions,
    timeline,
    presets,
    loading,
    
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
    timelineEvents,
    timelinePhases,
    activePhase,
    progress,
    sessionDuration,
    transitionDuration,
    LAYERS,
    
    // Functions
    setMasterVolumeLevel,
    setVolume,
    startSession,
    pauseSession,
    crossfadeTo,
    preloadAudio,
    getSessionTime,
    resetTimelineEventIndex,
    timelineIsEnabled,
    setTimelineEnabled,
    registerTimelineEvent,
    clearTimelineEvents,
    updateTimelinePhases,
    seekToTime,
    seekToPercent,
    setSessionDuration,
    setTransitionDuration,
    registerPresetStateProvider,
    savePreset,
    loadPreset,
    deletePreset,
    getPresets,
    exportPreset,
    importPreset
  };
}

// Export as default as well for flexibility
export default useAudio;