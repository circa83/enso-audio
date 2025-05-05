// src/hooks/useCrossfade.js
import { useState, useEffect, useCallback, useRef } from 'react';


/**
 * Hook for managing audio crossfades and track transitions
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.audioCore - The audio core service
 * @param {Object} options.volumeController - The volume controller service
 * @param {Object} options.crossfadeEngine - The crossfade engine service
 * @param {Object} options.bufferManager - The buffer manager service
 * @param {Object} options.activeAudio - Current active audio tracks
 * @param {Object} options.audioLibrary - Available audio tracks library
 * @param {Function} options.onActiveAudioChange - Callback when active audio changes
 * @param {boolean} options.isPlaying - Whether audio is currently playing
 * @param {number} options.transitionDuration - Current transition duration from useTimeline
 * @returns {Object} Crossfade state and control functions
 */
export function useCrossfade(options = {}) {
  const {
    audioCore,
    volumeController,
    crossfadeEngine,
    bufferManager,
    activeAudio = {},
    audioLibrary = {},
    onActiveAudioChange = null,
    isPlaying = false,
    // Change parameter name to be more explicit
    transitionDuration = 4000, // Default if not provided by useTimeline
  } = options;

    // Check if required services are provided
    if (!audioCore || !volumeController || !crossfadeEngine || !bufferManager) {
      console.error('[useCrossfade] Required audio services are missing');
    }
   
  // Crossfade state
  const [crossfadeProgress, setCrossfadeProgress] = useState({});
  const [activeCrossfades, setActiveCrossfades] = useState({});
  const [preloadProgress, setPreloadProgress] = useState({});
  
  // Refs for callback stability and current state access
  const activeAudioRef = useRef(activeAudio);
  const audioLibraryRef = useRef(audioLibrary);
  const isPlayingRef = useRef(isPlaying);
  // Add ref to track current transition duration
  const transitionDurationRef = useRef(transitionDuration);
  
  // Update refs when dependencies change
  useEffect(() => {
    activeAudioRef.current = activeAudio;
    audioLibraryRef.current = audioLibrary;
    isPlayingRef.current = isPlaying;
    transitionDurationRef.current = transitionDuration;
    
    // Log when transition duration changes
    console.log(`[useCrossfade] Transition duration updated to: ${transitionDuration}ms`);
  }, [activeAudio, audioLibrary, isPlaying, transitionDuration]);
  


  // Initialize crossfade engine with callbacks
  useEffect(() => {
    if (!crossfadeEngine) return;
    
    console.log("[useCrossfade] Initializing crossfade engine with callbacks");
    
    // Set up progress callback
    const handleProgress = (layer, progress) => {
      setCrossfadeProgress(prev => ({
        ...prev,
        [layer]: progress
      }));
    };
    
    // Register callback with the engine
    if (typeof crossfadeEngine.setProgressCallback === 'function') {
      crossfadeEngine.setProgressCallback(handleProgress);
    } else if (crossfadeEngine.onProgress !== undefined) {
      crossfadeEngine.onProgress = handleProgress;
    }
    
    // Clean up on unmount
    return () => {
      // Remove callbacks if the engine supports it
      if (crossfadeEngine.cleanup) {
        crossfadeEngine.cleanup();
      }
    };
  }, [crossfadeEngine]);
  



  // Preload audio using BufferManager
  const preloadAudio = useCallback(async (layer, trackId) => {
    if (!bufferManager) {
      console.error("[useCrossfade] Cannot preload: missing BufferManager");
      return false;
    }

    try {
      // Find the track in library
      const track = audioLibraryRef.current[layer]?.find(t => t.id === trackId);
      console.log(`[useCrossfade] Preloading audio for ${layer}/${trackId}:`, track ? 'Found' : 'Not found', track);
      
      if (!track) {
        console.error(`[useCrossfade] Track ${trackId} not found in library`);
        return false;
      }

      // Update UI to show loading progress
      setPreloadProgress(prev => ({
        ...prev,
        [trackId]: 0
      }));

      // Use BufferManager to preload the audio file
      await bufferManager.loadAudioBuffer(track.path, {
        onProgress: (progress) => {
          setPreloadProgress(prev => ({
            ...prev,
            [trackId]: progress
          }));
        }
      });

      // Success - clear progress display
      setPreloadProgress(prev => {
        const newState = {...prev};
        delete newState[trackId];
        return newState;
      });

      return true;
    } catch (error) {
      console.error(`[useCrossfade] Error preloading audio: ${error.message}`);
      
      // Reset progress on error
      setPreloadProgress(prev => {
        const newState = {...prev};
        delete newState[trackId];
        return newState;
      });
      
      return false;
    }
  }, [bufferManager]);

  // Crossfade between audio tracks
  const crossfadeTo = useCallback(async (layer, newTrackId, fadeDuration = null) => {
    console.log(`[useCrossfade] Starting crossfade process for ${layer}: ${newTrackId}`);
    const actualDuration = fadeDuration !== null ? fadeDuration : transitionDurationRef.current;
    console.log(`[useCrossfade] Using transition duration: ${actualDuration}ms`);
    
    // Verify we have what we need
    if (!audioCore || !volumeController || !crossfadeEngine) {
      console.error("[useCrossfade] Cannot crossfade: missing required services");
      return false;
    }
    
    const audioCtx = audioCore.getContext();
    const masterGain = audioCore.getMasterGain();

    // Get the audio elements
    const audioElements = audioCore.getElements?.() || {};
    console.log("[useCrossfade] Audio elements retrieved:", audioElements);

    // Get the current active track ID with improved reliability
    const currentTrackId = (() => {
      // First try from activeAudio state
      const stateTrackId = activeAudioRef.current[layer];
      
      // If valid, use it
      if (stateTrackId) {
        console.log(`[useCrossfade] Using current track for ${layer} from state: ${stateTrackId}`);
        return stateTrackId;
      }
      
      // If not valid, try to recover from audio elements
      const layerElements = audioElements[layer] || {};
      const activeTrackEntry = Object.entries(layerElements).find(([id, data]) => data?.isActive);
      
      if (activeTrackEntry) {
        console.log(`[useCrossfade] Recovered current track for ${layer} from audio elements: ${activeTrackEntry[0]}`);
        return activeTrackEntry[0];
      }
      
      // Last resort - use the first track from the library
      if (audioLibraryRef.current[layer]?.length > 0) {
        const defaultTrackId = audioLibraryRef.current[layer][0].id;
        console.log(`[useCrossfade] No active track found for ${layer}, using first from library: ${defaultTrackId}`);
        return defaultTrackId;
      }
      
      // Absolute fallback
      const fallbackId = `${layer}1`;
      console.log(`[useCrossfade] No tracks found in library for ${layer}, using fallback ID: ${fallbackId}`);
      return fallbackId;
    })();

    console.log(`[useCrossfade] Current track for ${layer}: ${currentTrackId}`);

    // Skip if already playing requested track
    if (currentTrackId === newTrackId) {
      console.log(`[useCrossfade] Already playing ${newTrackId} on ${layer}`);
      return true;
    }

    // Find the target track in library
    let libraryTrack = audioLibraryRef.current[layer]?.find(t => t.id === newTrackId);

    // If not found, create a fallback
    if (!libraryTrack) {
      console.log(`[useCrossfade] Track ${newTrackId} not found in library for layer ${layer}, creating fallback`);
      
      // Create a fallback track - this would need to be adapted to your app's structure
      libraryTrack = {
        id: newTrackId,
        name: newTrackId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        path: `/samples/default/${layer.toLowerCase()}.mp3` // Fallback path
      };
    }

    console.log(`[useCrossfade] Starting crossfade for ${layer} to track ${newTrackId}`);

    // Get or create the target track's audio elements
    let newTrackElements = audioElements[layer]?.[newTrackId];

    // Create the new track if it doesn't exist yet
    if (!newTrackElements) {
      console.log(`[useCrossfade] Creating new audio element for ${layer}/${newTrackId} with path ${libraryTrack.path}`);
      const audioElement = new Audio();
      audioElement.preload = "auto";
      audioElement.loop = true;
      audioElement.src = libraryTrack.path;
      audioElement.crossOrigin = "anonymous"; // Ensure CORS is set for remote files
      
      // Create source node
      const source = audioCtx.createMediaElementSource(audioElement);
      
      // Connect to VolumeController
      volumeController.connectToLayer(layer, source, masterGain);
      
      // Store the new track
      newTrackElements = {
        element: audioElement,
        source: source,
        track: libraryTrack,
        isActive: false
      };
      
      // Update audio elements in AudioCore if it supports it
      if (audioCore.updateElement) {
        console.log(`[useCrossfade] Registering new element with AudioCore: ${layer}/${newTrackId}`);
        audioCore.updateElement(layer, newTrackId, newTrackElements);
      }
    }

    // If we're not playing or have no current track, do an immediate switch
    if (!isPlayingRef.current || !currentTrackId) {
      console.log(`[useCrossfade] Not currently playing or no current track, using immediate switch instead of crossfade`);
      
      // Update active audio state immediately
      if (onActiveAudioChange) {
        onActiveAudioChange(layer, newTrackId);
      }
      
      console.log(`[useCrossfade] Immediate switch to ${newTrackId} successful for ${layer}`);
      return true;
    }

    // Get the current track elements with improved error handling
    let currentTrack = audioElements[layer]?.[currentTrackId];
    
    // Handle case where current track elements are missing but should exist
    if (!currentTrack) {
      console.log(`[useCrossfade] Current track ${currentTrackId} not found in audio elements, attempting recovery`);
      
      // Try to find any active element for this layer as a fallback
      const activeElement = Object.values(audioElements[layer] || {}).find(elem => elem.isActive);
      
      if (activeElement) {
        console.log(`[useCrossfade] Found active element for ${layer}, using as current track`);
        currentTrack = activeElement;
      } else {
        // If no active element found, create one for immediate switch
        console.log(`[useCrossfade] No active elements found for ${layer}, switching immediately to new track`);
        
        // Update active audio state
        if (onActiveAudioChange) {
          onActiveAudioChange(layer, newTrackId);
        }
        
        // Play the new track directly if we're playing
        if (isPlayingRef.current && newTrackElements?.element) {
          newTrackElements.element.currentTime = 0;
          try {
            await newTrackElements.element.play();
          } catch (e) {
            console.error(`[useCrossfade] Error playing new track: ${e.message}`);
          }
        }
        
        return true;
      }
    }

    // Start a crossfade using the CrossfadeEngine
  
    // First, update UI to show we're preparing for crossfade
    setActiveCrossfades(prev => ({
      ...prev,
      [layer]: { 
        from: currentTrackId,
        to: newTrackId,
        progress: 0,
        isLoading: true 
      }
    }));
    
    // Update active track state - do this before the crossfade
    if (onActiveAudioChange) {
      onActiveAudioChange(layer, newTrackId);
    }
    
    // Update UI - now loading is complete
    setActiveCrossfades(prev => ({
      ...prev,
      [layer]: { 
        ...prev[layer],
        isLoading: false 
      }
    }));
    
    // Get the current volume for the layer
    const currentVolume = volumeController.getVolume(layer);
    
    // Prepare crossfade options
    const crossfadeOptions = {
      layer,
      sourceNode: currentTrack.source,
      sourceElement: currentTrack.element,
      targetNode: newTrackElements.source,
      targetElement: newTrackElements.element,
      currentVolume: currentVolume,
      duration: actualDuration, // Use the calculated duration
      syncPosition: true,
      metadata: {
        fromTrackId: currentTrackId,
        toTrackId: newTrackId,
        volumeController: volumeController
      }
    };
      
    try {
      // Execute the crossfade with the CrossfadeEngine
      const success = await crossfadeEngine.crossfade(crossfadeOptions);
      
      // When crossfade completes, check if successful
      if (!success) {
        console.error(`[useCrossfade] Crossfade failed for ${layer}`);
        
        // Clear the UI state
        setActiveCrossfades(prev => {
          const newState = {...prev};
          delete newState[layer];
          return newState;
        });
        
        return false;
      }
      
      // After successful crossfade, ensure the node is properly connected
      if (volumeController && newTrackElements && newTrackElements.source) {
        volumeController.connectToLayer(
          layer, 
          newTrackElements.source, 
          audioCore.getMasterGain()
        );
      }
      
      // Clear the crossfade UI state when complete
      setActiveCrossfades(prev => {
        const newState = {...prev};
        delete newState[layer];
        return newState;
      });
      
      setCrossfadeProgress(prev => {
        const newState = {...prev};
        delete newState[layer];
        return newState;
      });
      
      console.log(`[useCrossfade] Crossfade complete for ${layer}: ${currentTrackId} -> ${newTrackId}`);
      return true;
      
    } catch (error) {
      console.error(`[useCrossfade] Error during crossfade: ${error.message}`);
      
      // Clear UI state
      setActiveCrossfades(prev => {
        const newState = {...prev};
        delete newState[layer];
        return newState;   
      });
      
  setCrossfadeProgress(prev => {
        const newState = {...prev};
        delete newState[layer];
        return newState;
      });
      
      return false;
    }
  }, [
    audioCore, 
    volumeController, 
    crossfadeEngine, 
    onActiveAudioChange
  ]);

  // Cancel all active crossfades
  const cancelCrossfades = useCallback((options = {}) => {
    if (!crossfadeEngine) {
      console.error("[useCrossfade] Cannot cancel crossfades: missing crossfadeEngine");
      return false;
    }
    
    console.log("[useCrossfade] Cancelling all active crossfades");
    
    // Cancel all crossfades in the engine
    const result = crossfadeEngine.cancelAllCrossfades({
      reconnectSource: true,
      reconnectTarget: true,
      ...options
    });
    
    // Clear UI state
    setActiveCrossfades({});
    setCrossfadeProgress({});
    
    return result;
  }, [crossfadeEngine]);

  // Adjust volume during an active crossfade
  const adjustCrossfadeVolume = useCallback((layer, volume) => {
    if (!crossfadeEngine || !crossfadeEngine.adjustCrossfadeVolume) {
      return false;
    }
    
    console.log(`[useCrossfade] Adjusting crossfade volume for ${layer} to ${volume}`);
    return crossfadeEngine.adjustCrossfadeVolume(layer, volume);
  }, [crossfadeEngine]);

  // Get active source node for a layer
  const getActiveSourceNode = useCallback((layer) => {
    if (!audioCore || !audioCore.getElements) {
      return null;
    }
    
    const elements = audioCore.getElements();
    const trackId = activeAudioRef.current[layer];
    
    if (!trackId || !elements[layer] || !elements[layer][trackId]) {
      return null;
    }
    
    return elements[layer][trackId].source;
  }, [audioCore]);

  // Get active audio element for a layer
  const getActiveAudioElement = useCallback((layer) => {
    if (!audioCore || !audioCore.getElements) {
      return null;
    }
    
    const elements = audioCore.getElements();
    const trackId = activeAudioRef.current[layer];
    
    if (!trackId || !elements[layer] || !elements[layer][trackId]) {
      return null;
    }
    
    return elements[layer][trackId].element;
  }, [audioCore]);

  // Get or create a source node for a layer/track
  const getOrCreateSourceNode = useCallback((layer, trackId) => {
    if (!audioCore || !audioCore.getOrCreateSourceNode) {
      return null;
    }
    
    return audioCore.getOrCreateSourceNode(layer, trackId);
  }, [audioCore]);

  // Get or create an audio element for a layer/track
  const getOrCreateAudioElement = useCallback((layer, trackId) => {
    if (!audioCore || !audioCore.getOrCreateAudioElement) {
      return null;
    }
    
    return audioCore.getOrCreateAudioElement(layer, trackId);
  }, [audioCore]);

  // Return all crossfade state and functions
  return {
    // Crossfade state
    crossfadeProgress,
    activeCrossfades,
    preloadProgress,
    
    // Crossfade functions
    crossfadeTo,
    preloadAudio,
    cancelCrossfades,
    adjustCrossfadeVolume,
    
    // Audio element access
    getActiveSourceNode,
    getActiveAudioElement,
    getOrCreateSourceNode,
    getOrCreateAudioElement
  };
}

export default useCrossfade;