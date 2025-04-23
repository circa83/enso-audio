// src/hooks/useAudio.js
import { useCallback, useMemo } from 'react';
import { useAudioContext } from '../contexts/AudioContext';
import { useVolume } from '../hooks/useVolume';


/**
 * Custom hook to simplify access to the core audio functionality
 * Provides a clean, organized API for audio playback and control
 * 
 * @returns {Object} Object containing core audio functions and state
 */
export function useAudio() {
  // Get core audio functionality from AudioContext
  const audio = useAudioContext();
  
  // Get volume functionality from Volume hook
  const volume = useVolume();
  
  if (!audio) {
    throw new Error('useAudio: AudioContext is not available');
  }
  
  // Extract values from audio context for cleaner access
  const { 
    // State
    isPlaying,
    isLoading,
    masterVolume,
    audioElements,
    initialized,
    
    // Methods
    startPlayback,
    pausePlayback,
    registerElements,
    updateElement,
    getElements,
    
    // Objects
    audioContext,
    masterGain,
    analyzer
  } = audio;
  
  // ===== Core Audio Element Access =====
  
  // Get active audio element for a layer/track
  const getActiveAudioElement = useCallback((layer, trackId = null) => {
    const elements = getElements();
    
    if (!elements || !elements[layer]) {
      return null;
    }
    
    // If trackId is specified, get that specific element
    if (trackId && elements[layer][trackId]) {
      return elements[layer][trackId].element || null;
    }
    
    // Otherwise, find an element marked as active
    for (const [id, data] of Object.entries(elements[layer])) {
      if (data.isActive && data.element) {
        return data.element;
      }
    }
    
    // Fallback: return the first available element
    const firstTrackId = Object.keys(elements[layer])[0];
    return firstTrackId ? elements[layer][firstTrackId].element || null : null;
  }, [getElements]);
  
  // Get active source node for a layer/track
  const getActiveSourceNode = useCallback((layer, trackId = null) => {
    const elements = getElements();
    
    if (!elements || !elements[layer]) {
      return null;
    }
    
    // If trackId is specified, get that specific source
    if (trackId && elements[layer][trackId]) {
      return elements[layer][trackId].source || null;
    }
    
    // Otherwise, find a source marked as active
    for (const [id, data] of Object.entries(elements[layer])) {
      if (data.isActive && data.source) {
        return data.source;
      }
    }
    
    // Fallback: return the first available source
    const firstTrackId = Object.keys(elements[layer])[0];
    return firstTrackId ? elements[layer][firstTrackId].source || null : null;
  }, [getElements]);
  
  // Create or get an audio element for a layer/track
  const getOrCreateAudioElement = useCallback((layer, trackId, options = {}) => {
    const { path, loop = true, preload = true } = options;
    
    // First try to get existing element
    const elements = getElements();
    if (elements && elements[layer] && elements[layer][trackId] && elements[layer][trackId].element) {
      return elements[layer][trackId].element;
    }
    
    // If no element exists and we have a path, create one
    if (!path) {
      console.error(`[useAudio] Cannot create audio element: path required for ${layer}/${trackId}`);
      return null;
    }
    
    try {
      // Create new audio element
      const audioElement = new Audio();
      audioElement.crossOrigin = "anonymous";
      audioElement.loop = loop;
      audioElement.preload = preload ? "auto" : "none";
      audioElement.src = path;
      
      // Create source node
      const source = audioContext.createMediaElementSource(audioElement);
      
      // Connect to volume controller if available
      if (volume && volume.connectSourceToLayer) {
        volume.connectSourceToLayer(layer, source, masterGain);
      } else {
        // Fallback: connect directly to master gain
        source.connect(masterGain);
      }
      
      // Create element data
      const elementData = {
        element: audioElement,
        source: source,
        track: {
          id: trackId,
          path: path,
          name: options.name || trackId
        },
        isActive: options.isActive || false
      };
      
      // Register with audio service
      updateElement(layer, trackId, elementData);
      
      return audioElement;
    } catch (error) {
      console.error(`[useAudio] Error creating audio element: ${error.message}`);
      return null;
    }
  }, [audioContext, masterGain, getElements, updateElement, volume]);
  
  // Create or get a source node for a layer/track
  const getOrCreateSourceNode = useCallback((layer, trackId, options = {}) => {
    // First try to get existing source
    const elements = getElements();
    if (elements && elements[layer] && elements[layer][trackId] && elements[layer][trackId].source) {
      return elements[layer][trackId].source;
    }
    
    // If we have a path, create the full element & source
    if (options.path) {
      const audioElement = getOrCreateAudioElement(layer, trackId, options);
      
      // Return the source that was created with the element
      const updatedElements = getElements();
      return updatedElements[layer]?.[trackId]?.source || null;
    }
    
    console.error(`[useAudio] Cannot create source node: no existing source or path for ${layer}/${trackId}`);
    return null;
  }, [getElements, getOrCreateAudioElement]);
  
  // ===== Playback Controls =====
  
  // Group playback functionality for a more organized API
  const playback = useMemo(() => ({
    isPlaying,
    start: () => {
      console.log('[useAudio] Starting audio playback');
      return startPlayback();
    },
    pause: () => {
      console.log('[useAudio] Pausing audio playback');
      return pausePlayback();
    },
    getTime: (layer) => {
      // If layer specified, get time from that audio element
      if (layer) {
        const audioElement = getActiveAudioElement(layer);
        return audioElement ? audioElement.currentTime * 1000 : 0; // Convert to ms
      }
      
      // Otherwise return 0 (no central time tracker in core audio)
      return 0;
    },
    // Extended playback functions
    togglePlayPause: () => {
      if (isPlaying) {
        console.log('[useAudio] Toggling playback: pause');
        return pausePlayback();
      } else {
        console.log('[useAudio] Toggling playback: play');
        return startPlayback();
      }
    }
  }), [isPlaying, startPlayback, pausePlayback, getActiveAudioElement]);
  
  // ===== Volume Controls =====
  
  // Volume controls - simplified to core functionality
  const volumeControls = useMemo(() => ({
    master: masterVolume,
    setMaster: (level) => {
      console.log(`[useAudio] Setting master volume to ${level}`);
      return audio.setMasterVolume(level);
    }
  }), [masterVolume, audio]);
  
  // ===== Loading State =====
  
  // Loading state
  const loading = useMemo(() => ({
    isLoading,
    initialized
  }), [isLoading, initialized]);
  
  // ===== Audio Registration =====
  
  // Audio element registration
  const registration = useMemo(() => ({
    registerElements,
    updateElement,
    getElements 
  }), [registerElements, updateElement, getElements]);
  
  // Return grouped functionality with clean API
  return {
    // Grouped functionality
    playback,
    volume: volumeControls,
    loading,
    registration,
    
    // Audio elements access
    getActiveAudioElement,
    getActiveSourceNode,
    getOrCreateAudioElement,
    getOrCreateSourceNode,
    
    // Audio objects access
    audioContext,
    masterGain,
    analyzer,
    
    // Direct state access
    isPlaying,
    isLoading,
    initialized,
    masterVolume,
    audioElements,
    
    // Raw methods (for compatibility)
    startPlayback,
    pausePlayback,
    setMasterVolume: audio.setMasterVolume,
    
    // Service access for advanced usage
    service: audio.service
  };
}

// Export as default for flexibility
export default useAudio;
