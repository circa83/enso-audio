// src/hooks/useAudio.js
import { useContext } from 'react';
import AudioContext from '../contexts/AudioContext';

/**
 * Custom hook for accessing the Audio Context
 * 
 * Provides access to all audio functionality including:
 * - Audio playback controls
 * - Layer volume controls
 * - Timeline management
 * - Crossfade functionality
 * - Preset management
 * 
 * @returns {Object} All audio context values and functions
 */
export function useAudio() {
  const context = useContext(AudioContext);
  
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  
  return context;
}

/**
 * Custom hook for audio player controls
 * 
 * Provides focused access to just the player control functionality
 * 
 * @returns {Object} Player control functions and state
 */
export function usePlayerControls() {
  const { 
    isPlaying, 
    startSession, 
    pauseSession, 
    masterVolume, 
    setMasterVolumeLevel,
    getSessionTime
  } = useAudio();
  
  return {
    isPlaying,
    startSession,
    pauseSession,
    masterVolume,
    setMasterVolumeLevel,
    getSessionTime
  };
}

/**
 * Custom hook for audio layer controls
 * 
 * Provides focused access to just the layer control functionality
 * 
 * @returns {Object} Layer control functions and state
 */
export function useLayerControls() {
  const { 
    volumes, 
    setVolume, 
    activeAudio, 
    audioLibrary,
    crossfadeTo,
    activeCrossfades,
    crossfadeProgress,
    preloadProgress,
    LAYERS
  } = useAudio();
  
  return {
    volumes,
    setVolume,
    activeAudio,
    audioLibrary,
    crossfadeTo,
    activeCrossfades,
    crossfadeProgress,
    preloadProgress,
    LAYERS
  };
}

/**
 * Custom hook for timeline functionality
 * 
 * Provides focused access to just the timeline functionality
 * 
 * @returns {Object} Timeline functions and state
 */
export function useTimeline() {
  const {
    timelinePhases,
    updateTimelinePhases,
    resetTimelineEventIndex
  } = useAudio();
  
  return {
    timelinePhases,
    updateTimelinePhases,
    resetTimelineEventIndex
  };
}

/**
 * Custom hook for preset management
 * 
 * Provides focused access to just the preset management functionality
 * 
 * @returns {Object} Preset functions and state
 */
export function usePresets() {
  const {
    savePreset,
    loadPreset,
    deletePreset,
    getPresets,
    exportPreset,
    importPreset
  } = useAudio();
  
  return {
    savePreset,
    loadPreset,
    deletePreset,
    getPresets,
    exportPreset,
    importPreset
  };
}

export default useAudio;