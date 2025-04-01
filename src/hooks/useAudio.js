// src/hooks/useAudio.js
import { useContext, useCallback, useEffect } from 'react';
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

  /* Add debugging
  useEffect(() => {
    console.log('useAudio hook - Context received:', {
      hasVolumes: !!context.volumes,
      volumesLength: context.volumes ? Object.keys(context.volumes).length : 0,
      hasSetVolume: !!context.setVolume,
      isSetVolumeFunction: typeof context.setVolume === 'function'
    });
  }, [context]);
*/

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

 // Debug volume-related functionality
 const debugSetLayer = useCallback((layer, value) => {
    console.log(`useAudio.setLayer called for ${layer} with value ${value}`);
    console.log(`setVolume function present:`, !!setVolume);
    if (setVolume) {
      console.log(`Calling setVolume(${layer}, ${value})`);
      setVolume(layer, value);
    } else {
      console.error(`setVolume function not available in context`);
    }
  }, [setVolume]);


  // Group related functionality for a more organized API
  
  // Playback controls
  const playback = {
    isPlaying,
    start: startSession,
    pause: pauseSession,
    getTime: getSessionTime
  };
  
  // Volume controls
  const volume = {
    master: masterVolume,
    layers: volumes,
    setMaster: setMasterVolumeLevel,
    setLayer: (layer, level, options) => setVolume(layer, level, options)
  };
  
  // Layer management
  const layers = {
    active: activeAudio,
    available: audioLibrary,
    hasSwitchable: hasSwitchableAudio,
    TYPES: LAYERS
  };
  
  // Transitions
  const transitions = {
    active: activeCrossfades,
    progress: crossfadeProgress,
    preloadProgress,
    crossfade: crossfadeTo,
    preload: preloadAudio
  };
  
  // Timeline controls
  const timeline = {
    events: timelineEvents,
    phases: timelinePhases,
    activePhase,
    progress,
    duration: sessionDuration,
    transitionDuration,
    reset: resetTimelineEventIndex,
    registerEvent: registerTimelineEvent,
    clearEvents: clearTimelineEvents,
    updatePhases: updateTimelinePhases,
    seekToTime,
    seekToPercent,
    setDuration: setSessionDuration,
    setTransitionDuration
  };
  
  // Preset management
  const presets = {
    registerStateProvider: registerPresetStateProvider,
    save: savePreset,
    load: loadPreset,
    delete: deletePreset,
    getAll: getPresets,
    export: exportPreset,
    import: importPreset
  };
  
  // Loading state
  const loading = {
    isLoading,
    progress: loadingProgress
  };

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