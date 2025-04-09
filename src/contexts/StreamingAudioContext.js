// src/contexts/StreamingAudioContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createAudioServices } from '../services/audio';

// Define our audio layers as a frozen object to prevent modifications
const LAYERS = Object.freeze({
  DRONE: 'drone',
  MELODY: 'melody',
  RHYTHM: 'rhythm',
  NATURE: 'nature'
});

// Default audio files for each layer
const DEFAULT_AUDIO = Object.freeze({
  [LAYERS.DRONE]: '/samples/default/drone.mp3',
  [LAYERS.MELODY]: '/samples/default/melody.mp3',
  [LAYERS.RHYTHM]: '/samples/default/rhythm.mp3',
  [LAYERS.NATURE]: '/samples/default/nature.mp3'
});

// Create the context
const AudioContext = createContext(null);

// AudioLibrary 

// Custom hook for using the audio context
export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  } 
  return context;
};

export const AudioProvider = ({ children }) => {
  // Service references - using a ref to avoid re-renders when updating services
  const serviceRef = useRef({
    audioCore: null,
    bufferManager: null,
    volumeController: null,
    crossfadeEngine: null,
    timelineEngine: null,
    presetManager: null
  });
  const activeAudioRef = useRef({}); // To keep track of active audio elements without causing re-renders 


  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false); // For race condition prevention
  
  // Master volume control
  const [masterVolume, setMasterVolume] = useState(0.8);
  
  // Layer volumes
  const [volumes, setVolumes] = useState({
    [LAYERS.DRONE]: 0.25,
    [LAYERS.MELODY]: 0.0,
    [LAYERS.RHYTHM]: 0.0,
    [LAYERS.NATURE]: 0.0
  });
  
  // Track currently active audio elements for each layer
  const [activeAudio, setActiveAudio] = useState({});
  
  // Audio library - will store available tracks for each layer
  const [audioLibrary, setAudioLibrary] = useState({
    [LAYERS.DRONE]: [],
    [LAYERS.MELODY]: [],
    [LAYERS.RHYTHM]: [],
    [LAYERS.NATURE]: []
  });
 
  const audioLibraryRef = useRef({
    [LAYERS.DRONE]: [{
      id: `${LAYERS.DRONE}1`,
      name: `${LAYERS.DRONE.charAt(0).toUpperCase() + LAYERS.DRONE.slice(1)}`,
      path: DEFAULT_AUDIO[LAYERS.DRONE]
    }],
    [LAYERS.MELODY]: [{
      id: `${LAYERS.MELODY}1`,
      name: `${LAYERS.MELODY.charAt(0).toUpperCase() + LAYERS.MELODY.slice(1)}`,
      path: DEFAULT_AUDIO[LAYERS.MELODY]
    }],
    [LAYERS.RHYTHM]: [{
      id: `${LAYERS.RHYTHM}1`,
      name: `${LAYERS.RHYTHM.charAt(0).toUpperCase() + LAYERS.RHYTHM.slice(1)}`,
      path: DEFAULT_AUDIO[LAYERS.RHYTHM]
    }],
    [LAYERS.NATURE]: [{
      id: `${LAYERS.NATURE}1`, 
      name: `${LAYERS.NATURE.charAt(0).toUpperCase() + LAYERS.NATURE.slice(1)}`,
      path: DEFAULT_AUDIO[LAYERS.NATURE]
    }]
  });
 
  // Feature availability
  const [hasSwitchableAudio, setHasSwitchableAudio] = useState(false);
  
  // Crossfade state tracking for UI feedback
  const [crossfadeProgress, setCrossfadeProgress] = useState({});
  const [activeCrossfades, setActiveCrossfades] = useState({});
  
  // Track preloading progress
  const [preloadProgress, setPreloadProgress] = useState({});
  
  // Timeline features
  const[timelineIsEnabled, setTimelineIsEnabled] = useState(true);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelinePhases, setTimelinePhases] = useState([]);
  const [activePhase, setActivePhase] = useState(null);
  const [progress, setProgress] = useState(0);
  const [sessionDuration, setSessionDuration] = useState( 1 * 60 * 1000); // 1 min
  const [transitionDuration, setTransitionDuration] = useState(4000); // 4 seconds
  const [timelineIsPlaying, setTimelineIsPlaying] = useState(false);
  // Preset management
  const [presets, setPresets] = useState({});
  const stateProviders = useRef({});

  // Initialize services - Only run once on mount
  useEffect(() => {
    let isMounted = true; // For preventing state updates after unmount
    console.log("AudioProvider mounted, initializing services...");
   
    const initializeServices = async () => {
      if (typeof window === 'undefined') return;
      
      try {
        if (isMounted) setLoadingProgress(5);
        
        // Initialize all audio services
        const services = await createAudioServices({
          audioCore: { 
            initialVolume: masterVolume, 
            autoResume: true 
          },
          volumeController: { 
            initialVolumes: volumes 
          },
          crossfadeEngine: { 
            onProgress: (layer, progress) => {
              if (isMounted) {
                setCrossfadeProgress(prev => ({
                  ...prev,
                  [layer]: progress
                }));
              }
            }
          },
          timelineEngine: {
            sessionDuration,
            transitionDuration,
            onPhaseChange: (phaseId, phaseData) => {
              if (!isMounted) return;
              
              console.log(`[STREAMINGSUDIOCONTEXT: intitialize services] PhaseId changed to: ${phaseId}`);
              setActivePhase(phaseId);
              
              // Instead of directly applying volume changes here, we'll defer to the SessionTimeline
              // component which should handle transitions via the audio services
              
              // Just broadcast a phase change event that SessionTimeline will listen for
              if (typeof window !== 'undefined') {
                const event = new CustomEvent('timeline-phase-changed', { 
                  detail: { phaseId, phaseData } 
                });
                window.dispatchEvent(event);
              }
            },
            onScheduledEvent: (event) => {
              if (!isMounted) return;
              
              console.log('Timeline event triggered:', event);
              
              // Handle events via appropriate services
              if (event.action === 'crossfade' && event.data) {
                const { layer, trackId, duration } = event.data;
                if (layer && trackId) {
                  const actualDuration = duration || transitionDuration;
                  serviceRef.current.crossfadeEngine.crossfade({
                    layer,
                    sourceNode: getActiveSourceNode(layer),
                    sourceElement: getActiveAudioElement(layer),
                    targetNode: getOrCreateSourceNode(layer, trackId),
                    targetElement: getOrCreateAudioElement(layer, trackId),
                    currentVolume: volumes[layer] || 0,
                    duration: actualDuration
                  });
                }
              } else if (event.action === 'volume' && event.data) {
                const { layer, volume } = event.data;
                if (layer !== undefined && volume !== undefined) {
                  console.log(`[STREAMINGAUDIOCONTEXT: onPhaseChange] Setting volume for ${layer} to ${volume}`);
                  serviceRef.current.volumeController.setVolume(layer, volume);
                }
              }
            },
            onProgress: (progress, elapsedTime) => {
              if (isMounted) setProgress(progress);
            }
          },
          presetManager: {
            getStateProviders: () => ({ ...stateProviders.current }),
            onPresetChange: (updatedPresets) => {
              if (isMounted) setPresets(updatedPresets);
            },
            onPresetLoad: (presetName, presetData) => {
              if (isMounted) handleLoadPreset(presetData);
            }
          }
        });
        
        // Store services in ref
        serviceRef.current = services;
        
        if (isMounted) setLoadingProgress(10);
        
        // Initialize audio
        if (isMounted) await initializeDefaultAudio();
        
        // Check for variation files
        if (isMounted) tryLoadVariationFiles();
        
      } catch (error) {
        console.error("Error initializing audio system:", error);
        if (isMounted) {
          setLoadingProgress(100);
          setIsLoading(false);
        }
      }
    };
    
    initializeServices();
    
    // Cleanup function
    return () => {
      isMounted = false;
      
      // Clean up all services
      Object.values(serviceRef.current).forEach(service => {
        if (service && typeof service.dispose === 'function') {
          service.dispose();
        }
      });
    };
  }, []); // Empty dependency array - only run on mount
  
   // Sync activeAudioRef with activeAudio state
  useEffect(() => {
    activeAudioRef.current = {...activeAudio};
  }, [activeAudio]);

  // Then sync the ref with state using an effect
  useEffect(() => {
  audioLibraryRef.current = audioLibrary;
}, [audioLibrary]);

  // Recover Audio From AudioLibrary if needed
  useEffect(() => {
  if (Object.values(audioLibrary).some(layerTracks => layerTracks.length === 0)) {
    console.warn('Detected empty audio library, recovering from ref...');
    setAudioLibrary(audioLibraryRef.current);
  }
}, [audioLibrary]);


  // Update master volume when state changes
  useEffect(() => {
    if (serviceRef.current.audioCore) {
      serviceRef.current.audioCore.setMasterVolume(masterVolume);
    }
  }, [masterVolume]);
  
  // Initialize audio elements with default tracks
  const initializeDefaultAudio = useCallback(async () => {
    const { audioCore, bufferManager, volumeController } = serviceRef.current;
    if (!audioCore || !bufferManager || !volumeController) {
      console.error('Cannot initialize audio, services not ready');
      return false;
    }

    const audioCtx = audioCore.getContext();
    const masterGain = audioCore.getMasterGain();
    
    const totalFiles = Object.values(LAYERS).length;
    let loadedFilesCount = 0;
    
    const newActiveAudio = {};
    const newAudioElements = {};
    Object.values(LAYERS).forEach(layer => {
      newAudioElements[layer] = {};
    });
    
    // Build initial basic library
    const basicLibrary = {};
    Object.values(LAYERS).forEach(layer => {
      const trackId = `${layer}1`;
      basicLibrary[layer] = [{
        id: trackId,
        name: `${layer.charAt(0).toUpperCase() + layer.slice(1)}`,
        path: DEFAULT_AUDIO[layer]
      }];
      newActiveAudio[layer] = trackId;
    });

    // IMPORTANT: Also update the ref to ensure state persistence
audioLibraryRef.current = {...basicLibrary};
console.log("Set audio library reference:", audioLibraryRef.current);

// Force update audio library state to prevent empty state
setTimeout(() => {
  // Check if library state is empty and force update if needed
  setAudioLibrary(prevLibrary => {
    if (Object.values(prevLibrary).some(tracks => !tracks || tracks.length === 0)) {
      console.log("Forcing audio library state update from reference");
      return {...audioLibraryRef.current};
    }
    return prevLibrary;
  });
}, 500);
    
    // Update audio library state
    console.log("Setting basic audio library:", basicLibrary);
    setAudioLibrary(basicLibrary);
    setLoadingProgress(20);
    
    console.log("Initializing audio with track IDs:", newActiveAudio);
    
    // For each layer, create and load the default audio element
    for (const layer of Object.values(LAYERS)) {
      // Always use the first track as default
      console.log(`Attempting to load audio for ${layer} from path:`, DEFAULT_AUDIO[layer]);
      
      const defaultTrack = basicLibrary[layer][0];
      const trackId = defaultTrack.id;

      console.log(`Loading audio for ${layer}, track ID: ${trackId}, path: ${defaultTrack.path}`);
     
      
      try {
        // Create new audio element
        const audioElement = new Audio();
        
        // Set up load handler
        const loadPromise = new Promise((resolve) => {
          const loadHandler = () => {
            loadedFilesCount++;
            const progress = Math.round((loadedFilesCount / totalFiles) * 70) + 20;
            setLoadingProgress(progress);
            console.log(`Loaded audio for ${layer}, progress: ${progress}%`);
            resolve();
          };
          
          // Set up event listeners
          audioElement.addEventListener('canplaythrough', loadHandler, { once: true });
          
          // Handle errors
          audioElement.addEventListener('error', (e) => {
            console.error(`Error loading audio for ${layer}:`, e);
            console.error(`Audio src was:`, audioElement.src);
          console.error(`Error code:`, audioElement.error ? audioElement.error.code : 'unknown');
            loadHandler(); // Still mark as loaded so we don't hang
          }, { once: true });
          
          // Set a timeout in case nothing happens
          setTimeout(() => {
            if (!audioElement.readyState) {
              console.warn(`Loading audio for ${layer} timed out, continuing anyway`);
              loadHandler();
            }
          }, 5000);
        });
        
        // Start loading
        audioElement.src = defaultTrack.path;
        audioElement.loop = true;
        audioElement.load();
        
        // Create media element source
        const source = audioCtx.createMediaElementSource(audioElement);
        
        // Connect source to volume controller
        volumeController.connectToLayer(layer, source, masterGain);
        
        // Store the audio element and its source
        newAudioElements[layer][trackId] = {
          element: audioElement,
          source: source,
          track: defaultTrack,
          isActive: true
        };
        console.log(`Audio element created for ${layer}:`, newAudioElements[layer][trackId]);
        
        // Set as active audio for this layer
        newActiveAudio[layer] = trackId;
        
        // Wait for this layer to load
        await loadPromise;
        
      } catch (error) {
        console.error(`Error initializing audio for layer ${layer}:`, error);
        // Increment progress anyway to avoid getting stuck
        loadedFilesCount++;
        const progress = Math.round((loadedFilesCount / totalFiles) * 70) + 20;
        setLoadingProgress(progress);
      }
    }

    // Store audio elements in AudioCore
  console.log("Registering audio elements with AudioCore:", 
    Object.keys(newAudioElements).map(layer => 
      `${layer}: ${Object.keys(newAudioElements[layer]).join(', ')}`
    )
  );
    // Store audio elements in AudioCore
    if (audioCore.registerElements) {
    const registered = audioCore.registerElements(newAudioElements);
    console.log("AudioCore registration result:", registered);
  } else {
    console.error("AudioCore.registerElements is not defined");
  }
 // Use a more reliable state update approach to ensure synchronization
const updatedLibrary = {...basicLibrary};
// Make sure to add all tracks to the library
Object.values(LAYERS).forEach(layer => {
  if (!updatedLibrary[layer].some(track => track.id === newActiveAudio[layer])) {
    const trackId = newActiveAudio[layer];
    updatedLibrary[layer].push({
      id: trackId,
      name: `${layer.charAt(0).toUpperCase() + layer.slice(1)}`,
      path: DEFAULT_AUDIO[layer]
    });
  }
});
console.log ("Initial audio library reference:", audioLibraryRef.current);
// Update both states together
setAudioLibrary(updatedLibrary);
setActiveAudio(newActiveAudio);
setIsLoading(false);
setLoadingProgress(100);
    console.log("Final active audio state:", newActiveAudio);
    console.log("All audio loaded successfully");
    
    return true;
  }, []); // No dependencies needed as we're using refs

  // Try to load variation files in background
  const tryLoadVariationFiles = useCallback(() => {
    setTimeout(async () => {
      try {
        // Check if variation files exist
        const response = await fetch('/samples/drone/drone_01.mp3', { method: 'HEAD' });
        
        if (response.ok) {
          // If we have variations, we can set up the extended library
          setHasSwitchableAudio(true);
          
          // Add variation files to the library
          setAudioLibrary(prev => {
            const extendedLibrary = { ...prev };
            
            // Add variations for all layers
            Object.values(LAYERS).forEach(layer => {
              extendedLibrary[layer] = [
                ...(Array.isArray(extendedLibrary[layer]) ? extendedLibrary[layer] : []),
                ...[1, 2, 3].map(i => ({
                  id: `${layer}_variation_${i}`,
                  name: `${layer.charAt(0).toUpperCase() + layer.slice(1)} Variation ${i}`,
                  path: `/samples/${layer}/${layer}_0${i}.mp3`
                }))
              ];
            });
            console.log("Extended audio library Variations:", extendedLibrary);
            return extendedLibrary;
          });
        }
      } catch (error) {
        console.log('Variation audio files not detected, using defaults only');
      }
    }, 1000);
  }, []);

  // Set master volume
  const handleSetMasterVolume = useCallback((value) => {
    if (!serviceRef.current.audioCore) return;
    
    setMasterVolume(value);
    serviceRef.current.audioCore.setMasterVolume(value);
  }, []);

  // Set volume for a specific layer
  const handleSetVolume = useCallback((layer, value, options = {}) => {
  //console.log(`handleSetVolume called for ${layer}: ${value}`);
  
  if (!serviceRef.current.volumeController) {
    console.error("Cannot set volume: VolumeController not available");
    return;
  }
  
  // Update our local state for UI
  //console.log(`Updating local volume state for ${layer} from`, volumes[layer], `to ${value}`);
  
  setVolumes(prev => {
    const newVolumes = {
      ...prev,
      [layer]: value
    };
   // console.log(`New volumes state:`, newVolumes);
    return newVolumes;
  });
    
    // Apply volume using the VolumeController
  const result = serviceRef.current.volumeController.setVolume(layer, value, options);
  //console.log(`VolumeController.setVolume result for ${layer}: ${result}`);
  
  // If there's an active crossfade for this layer, update its volume too
  if (serviceRef.current.crossfadeEngine?.isActive(layer)) {
    const result = serviceRef.current.crossfadeEngine.adjustCrossfadeVolume(layer, value);
    console.log(`CrossfadeEngine.adjustCrossfadeVolume result for ${layer}: ${result}`);
  }
}, [volumes]);

  // Function to safely set playing state
  const updatePlayingState = useCallback((newState) => {
    // Debug log before updating
    console.log(`Updating playing state from ${isPlayingRef.current} to ${newState}`);
    
    // Update the ref immediately (sync)
    isPlayingRef.current = newState;
    
    // Update the React state (async)
    setIsPlaying(newState);
    
    // Debug log after updating
    console.log(`Updated playing state, ref is now: ${isPlayingRef.current}`);
  }, []);

  // Handler for Enable Timeline
const handleSetTimelineEnabled = useCallback((enabled) => {
  console.log(`Setting timeline enabled: ${enabled}`);
  setTimelineIsEnabled(enabled);
}, []);

  // Start the session 
  const handleStartSession = useCallback(() => {
   
    // Use ref for current state check to avoid race conditions
    if (!serviceRef.current.audioCore || isPlayingRef.current) {
      console.log("Can't start: AudioCore missing or already playing");
      return;
    }
    
    try {
      console.log("Starting session...");
      
      // Resume AudioCore
      serviceRef.current.audioCore.resume().catch(err => {
        console.error('Error resuming audio context:', err);
        
      });
      
      // Get currently active audio elements
      const audioElements = serviceRef.current.audioCore.getElements?.() || {};

     console.log("Starting session - Audio Elements:", 
      Object.keys(audioElements).map(layer => 
        `${layer}: ${Object.keys(audioElements[layer] || {}).join(', ')}`
      )
    );
    console.log("Active Audio Mapping:", JSON.stringify(activeAudio));
    console.log("Audio elements retrieved from AudioCore:", 
      Object.keys(audioElements).length === 0 ? "{}" : "Found elements"
    );
       // Make sure all audio elements are reset to beginning
    Object.entries(activeAudio).forEach(([layer, trackId]) => {
      const track = audioElements[layer]?.[trackId];
      console.log(`Layer ${layer} - Attempting to play track ${trackId}:`, track ? 'Found' : 'Not found');
      
      if (track?.element) {
        // Log volume level
        console.log(`Layer ${layer} - Volume level:`, volumes[layer]);
        console.log(`Layer ${layer} - Audio element readyState:`, track.element.readyState);
        
        // Reset to beginning of track
        track.element.currentTime = 0;
      }
    });
      
         // Play all active audio elements
    let allPlayPromises = [];
    
    Object.entries(activeAudio).forEach(([layer, trackId]) => {
      const track = audioElements[layer]?.[trackId];
      if (track?.element) {
        // Play and collect the promise
        try {
          console.log(`Layer ${layer} - Initiating play() for track ${trackId}`);
          const playPromise = track.element.play();
          if (playPromise !== undefined) {
            allPlayPromises.push(
              playPromise.catch(err => {
                console.error(`Error playing ${layer}:`, err);
                return null;
              })
            );
          }
        } catch (err) {
          console.error(`Error starting ${layer}:`, err);
        }
      } else {
        console.error(`No track found for ${layer}/${trackId}`);
      }
    });
      
      // Wait for all play operations to complete
      Promise.all(allPlayPromises)
        .then(() => {
          if (!isPlayingRef.current) {
            updatePlayingState(true);
          }
        })
        .catch(error => {
          console.error('Error in play promises:', error);
          // Try to update state anyway
          updatePlayingState(true);
        });
      
      // Set state immediately as a fallback
      if (!isPlayingRef.current) {
        updatePlayingState(true);
      }
      
    } catch (error) {
      console.error('Error starting session:', error);
      updatePlayingState(false);
    }
  }, [activeAudio, updatePlayingState, timelineIsEnabled]);

  // Pause/Stop session
  const handlePauseSession = useCallback(() => {
    if (!isPlayingRef.current) {
      console.log("Not playing, nothing to pause");
      return;
    }
    
    try {
      console.log("Pausing session...");
      
      // First, cancel any active crossfades
      if (serviceRef.current.crossfadeEngine) {
        serviceRef.current.crossfadeEngine.cancelAllCrossfades({
          reconnectSource: true,
          reconnectTarget: true
        });
      }
      
      // Clear UI state for crossfades
      setActiveCrossfades({});
      setCrossfadeProgress({});
      
      // Get audio elements from AudioCore
      const audioElements = serviceRef.current.audioCore.getElements?.() || {};
      
      // Pause all active audio elements
      Object.entries(activeAudio).forEach(([layer, trackId]) => {
        const track = audioElements[layer]?.[trackId];
        if (track?.element) {
          try {
            track.element.pause();
          } catch (err) {
            console.error(`Error pausing ${layer}:`, err);
          }
        }
      });
      
      // Stop the TimelineEngine
      if (serviceRef.current.timelineEngine) {
        serviceRef.current.timelineEngine.stop();
      }
      
      // Suspend the AudioCore context
      if (serviceRef.current.audioCore) {
        serviceRef.current.audioCore.suspend().catch(err => {
          console.warn('Error suspending audio context:', err);
        });
      }
      
     // Check for proper state update
console.log("Before updatePlayingState in handlePauseSession, current state:", isPlayingRef.current);
updatePlayingState(false);
console.log("After updatePlayingState in handlePauseSession, new state:", isPlayingRef.current);
    } catch (error) {
      console.error('Error pausing session:', error);
      // Still try to update state even if an error occurs
      updatePlayingState(false);
    }
  }, [activeAudio, updatePlayingState]);

  // Preload audio using BufferManager
  const handlePreloadAudio = useCallback(async (layer, trackId) => {
    if (!serviceRef.current.bufferManager) {
      console.error("Cannot preload: missing BufferManager");
      return false;
    }

    try {
      // Find the track in library
      const track = audioLibrary[layer].find(t => t.id === trackId);
      console.log(`Preloading audio for ${layer}/${trackId}:`, track ? 'Found' : 'Not found', track);
      if (!track) {
        console.error(`Track ${trackId} not found in library`);
        return false;
      }

      // Update UI to show loading progress
      setPreloadProgress(prev => ({
        ...prev,
        [trackId]: 0
      }));

      // Use BufferManager to preload the audio file
      await serviceRef.current.bufferManager.loadAudioBuffer(track.path, {
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
      console.error(`Error preloading audio: ${error.message}`);
      
      // Reset progress on error
      setPreloadProgress(prev => {
        const newState = {...prev};
        delete newState[trackId];
        return newState;
      });
      
      return false;
    }
  }, [audioLibrary]);

  // Crossfade between audio tracks
const handleCrossfadeTo = useCallback(async (layer, newTrackId, fadeDuration = null) => {
  console.log(`Starting crossfade process for ${layer}: ${newTrackId}`);
  const actualDuration = fadeDuration !== null ? fadeDuration : transitionDuration;
  
  // Verify we have what we need
  if (!serviceRef.current.audioCore || 
      !serviceRef.current.volumeController || 
      !serviceRef.current.crossfadeEngine) {
    console.error("Cannot crossfade: missing required services");
    return false;
  }
  
  const audioCtx = serviceRef.current.audioCore.getContext();
  const masterGain = serviceRef.current.audioCore.getMasterGain();

  // Get the audio elements
  const audioElements = serviceRef.current.audioCore.getElements?.() || {};
  console.log("Audio elements retrieved:", audioElements);

 // Get the current active track ID with improved reliability
 const currentTrackId = (() => {
  // First try from activeAudio state
  const stateTrackId = activeAudio[layer];
  
  // Second try from activeAudioRef (more up-to-date than state during transitions)
  const refTrackId = activeAudioRef.current[layer];
  
  // If either is valid, use it
  if (stateTrackId) {
    console.log(`Using current track for ${layer} from state: ${stateTrackId}`);
    return stateTrackId;
  }
  
  if (refTrackId) {
    console.log(`Using current track for ${layer} from ref: ${refTrackId}`);
    return refTrackId;
  }
  
  // If neither is valid, try to recover from audio elements
  const layerElements = audioElements[layer] || {};
  const activeTrackEntry = Object.entries(layerElements).find(([id, data]) => data?.isActive);
  
  if (activeTrackEntry) {
    console.log(`Recovered current track for ${layer} from audio elements: ${activeTrackEntry[0]}`);
    return activeTrackEntry[0];
  }
  
  // Last resort - use the first track from the library or default pattern
  if (audioLibrary[layer]?.length > 0) {
    const defaultTrackId = audioLibrary[layer][0].id;
    console.log(`No active track found for ${layer}, using first from library: ${defaultTrackId}`);
    return defaultTrackId;
  }
  
  // Absolute fallback
  const fallbackId = `${layer}1`;
  console.log(`No tracks found in library for ${layer}, using fallback ID: ${fallbackId}`);
  return fallbackId;
})();

console.log(`Current track for ${layer}: ${currentTrackId}`);



   // CRITICAL: Ensure the audio library is populated - sync from ref if needed
   if (!audioLibrary[layer] || audioLibrary[layer].length === 0) {
    console.log(`Proactively syncing audio library for ${layer} from reference`);
    if (audioLibraryRef.current[layer] && audioLibraryRef.current[layer].length > 0) {
      // Update the audio library state
      setAudioLibrary(prevLibrary => {
        const updated = {...prevLibrary};
        updated[layer] = [...audioLibraryRef.current[layer]];
        console.log(`Synchronized audio library for ${layer}:`, updated[layer]);
        return updated;
      });
    }
  }

  // Skip if already playing requested track
  if (currentTrackId === newTrackId) {
    console.log(`Already playing ${newTrackId} on ${layer}`);
    return true;
  }

  // Find the target track in library
  let libraryTrack = null;
  
  // Try to find in current library state
  if (audioLibrary[layer]) {
    libraryTrack = audioLibrary[layer].find(t => t.id === newTrackId);
  }
  
  // If not found, try ref backup
  if (!libraryTrack && audioLibraryRef.current[layer]) {
    libraryTrack = audioLibraryRef.current[layer].find(t => t.id === newTrackId);
    
    // If found in ref but not in state, update state
    if (libraryTrack) {
      console.log(`Found track ${newTrackId} in backup library reference but not in state, updating state`);
      setAudioLibrary(prevLibrary => {
        const updated = {...prevLibrary};
        if (!updated[layer]) updated[layer] = [];
        if (!updated[layer].some(t => t.id === newTrackId)) {
          updated[layer] = [...updated[layer], libraryTrack];
        }
        return updated;
      });
    }
  }

  // If still not found, create a fallback
  if (!libraryTrack) {
    console.log(`Track ${newTrackId} not found in any library source for layer ${layer}, creating fallback`);
    
    // Create a fallback track
    libraryTrack = {
      id: newTrackId,
      name: newTrackId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      path: DEFAULT_AUDIO[layer] // Use the default audio path
    };
    
    // Add to audio library
    setAudioLibrary(prev => {
      const updated = {...prev};
      if (!updated[layer]) updated[layer] = [];
      
      // Add track if it doesn't exist
      if (!updated[layer].some(t => t.id === newTrackId)) {
        updated[layer] = [...updated[layer], libraryTrack];
      }
      
      return updated;
    });
  }

  // Get or create the target track's audio elements
  let newTrackElements = audioElements[layer]?.[newTrackId];

  // Create the new track if it doesn't exist yet
  if (!newTrackElements) {
    console.log(`Creating new audio element for ${layer}/${newTrackId} with path ${libraryTrack.path}`);
    const audioElement = new Audio();
    audioElement.preload = "auto";
    audioElement.loop = true;
    audioElement.src = libraryTrack.path;
    
    // Create source node
    const source = audioCtx.createMediaElementSource(audioElement);
    
    // Connect to VolumeController
    serviceRef.current.volumeController.connectToLayer(layer, source, masterGain);
    
    // Store the new track
    newTrackElements = {
      element: audioElement,
      source: source,
      track: libraryTrack,
      isActive: false
    };
    
    // Update audio elements in AudioCore if it supports it
    if (serviceRef.current.audioCore.updateElement) {
      serviceRef.current.audioCore.updateElement(layer, newTrackId, newTrackElements);
    }
  }

  // If we're not playing or have no current track, do an immediate switch
  if (!isPlayingRef.current || !currentTrackId) {
    console.log(`Not currently playing or no current track, using immediate switch instead of crossfade`);
    
    // Update active audio state immediately
    setActiveAudio(prev => {
      const updated = {
        ...prev,
        [layer]: newTrackId
      };
      // Also update the ref for immediate access
      activeAudioRef.current = {
        ...activeAudioRef.current,
        [layer]: newTrackId
      };
      return updated;
    });
    
    console.log(`Immediate switch to ${newTrackId} successful for ${layer}`);
    return true;
  }

  // Get the current track elements with improved error handling
  let currentTrack = audioElements[layer]?.[currentTrackId];
  
  // Handle case where current track elements are missing but should exist
  if (!currentTrack) {
    console.log(`Current track ${currentTrackId} not found in audio elements, attempting recovery`);
    
    // Try to find any active element for this layer as a fallback
    const activeElement = Object.values(audioElements[layer] || {}).find(elem => elem.isActive);
    
    if (activeElement) {
      console.log(`Found active element for ${layer}, using as current track`);
      currentTrack = activeElement;
    } else {
      // If no active element found, create one for immediate switch
      console.log(`No active elements found for ${layer}, switching immediately to new track`);
      
      // Update active audio state
      setActiveAudio(prev => {
        const updated = {
          ...prev,
          [layer]: newTrackId
        };
        // Also update the ref for immediate access
        activeAudioRef.current = {
          ...activeAudioRef.current,
          [layer]: newTrackId
        };
        return updated;
      });
      
      // Play the new track directly if we're playing
      if (isPlayingRef.current && newTrackElements?.element) {
        newTrackElements.element.currentTime = 0;
        try {
          await newTrackElements.element.play();
        } catch (e) {
          console.error(`Error playing new track: ${e.message}`);
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
  setActiveAudio(prev => {
    const updated = {
      ...prev,
      [layer]: newTrackId
    };
    // Also update the ref for immediate access
    activeAudioRef.current = {
      ...activeAudioRef.current,
      [layer]: newTrackId
    };
    return updated;
  });
  
  // Update UI - now loading is complete
  setActiveCrossfades(prev => ({
    ...prev,
    [layer]: { 
      ...prev[layer],
      isLoading: false 
    }
  }));
  
  // Get the current volume for the layer
  const currentVolume = serviceRef.current.volumeController.getVolume(layer);
  
  // Prepare crossfade options
  const crossfadeOptions = {
    layer,
    sourceNode: currentTrack.source,
    sourceElement: currentTrack.element,
    targetNode: newTrackElements.source,
    targetElement: newTrackElements.element,
    currentVolume: currentVolume,
    duration: actualDuration,
    syncPosition: true,
    metadata: {
      fromTrackId: currentTrackId,
      toTrackId: newTrackId,
      volumeController: serviceRef.current.volumeController
    }
  };
    
  try {
    // Execute the crossfade with the CrossfadeEngine
    const success = await serviceRef.current.crossfadeEngine.crossfade(crossfadeOptions);
    
    // When crossfade completes, check if successful
    if (!success) {
      console.error(`Crossfade failed for ${layer}`);
      
      // Clear the UI state
      setActiveCrossfades(prev => {
        const newState = {...prev};
        delete newState[layer];
        return newState;
      });
      
      return false;
    }
    
    // After successful crossfade, ensure the node is properly connected
    if (serviceRef.current.volumeController && newTrackElements && newTrackElements.source) {
      serviceRef.current.volumeController.connectToLayer(
        layer, 
        newTrackElements.source, 
        serviceRef.current.audioCore.getMasterGain()
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
    
    console.log(`Crossfade complete for ${layer}: ${currentTrackId} -> ${newTrackId}`);
    return true;
    
  } catch (error) {
    console.error(`Error during crossfade: ${error.message}`);
    
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
}, [audioLibrary, activeAudio, transitionDuration]);

// Fade volume for a specific layerh
const handleFadeVolume = useCallback((layer, targetVolume, durationMs) => {
  if (!serviceRef.current.volumeController) {
    console.error("[StreamingAudioContext] Cannot fade volume: VolumeController not available");
    return Promise.resolve(false);
  }
  
  console.log(`[StreamingAudioContext] Fading ${layer} volume to ${targetVolume} over ${durationMs}ms`);
  
  // Convert milliseconds to seconds for VolumeController
  const durationSec = durationMs / 1000;
  
  // Create a progress callback to update the volumes state
  const progressCallback = (layerId, currentValue, progress) => {
    // Update the volumes state to reflect current fade position
    setVolumes(prev => ({
      ...prev,
      [layerId]: currentValue
    }));
    
    // Log progress for debugging
    console.log(`[StreamingAudioContext] Fade progress for ${layerId}: ${Math.round(progress * 100)}% - Volume: ${Math.round(currentValue * 100)}%`);
  };
  
  // Call the service method with progress callback
  return serviceRef.current.volumeController.fadeVolume(layer, targetVolume, durationSec, progressCallback);
}, []);

  // Timeline functions - wrapped in useCallback
const handleStartTimeline = useCallback(() => {
  if (!serviceRef.current.timelineEngine) {
    console.error("TimelineEngine not initialized");
    return false;
  }

  // Ensure the audio is playing first - timeline should not auto-start audio
  if (!isPlayingRef.current) {
    console.log("Audio is not playing, cannot start timeline");
    return false;
  }

  // Reset the timeline state first
  serviceRef.current.timelineEngine.stop();
  
  // Start the timeline with reset option
  const started = serviceRef.current.timelineEngine.start({ reset: true });
  console.log("TimelineEngine start result:", started);
  
  if (started) {
    setTimelineIsPlaying(true);
  }
  
  return started;
}, [ isPlayingRef, sessionDuration]);

const handleStopTimeline = useCallback(() => {
  if (!serviceRef.current.timelineEngine) {
    console.log("Can't stop timeline: TimelineEngine missing");
    return false;
  }
  console.log("Stopping timeline...");
  // Just stop the timeline without affecting audio playback
  const stopped = serviceRef.current.timelineEngine.stop();
  console.log("TimelineEngine stop result:", stopped);
  
  if (stopped) {
    setTimelineIsPlaying(false);
  }
  
  return stopped;
}, []);

// In src/contexts/StreamingAudioContext.js
const handlePauseTimeline = useCallback(() => {
  if (!serviceRef.current.timelineEngine) {
    console.log("Can't pause timeline: TimelineEngine missing");
    return false;
  }
  console.log("Pausing timeline (preserving position)...");
  
  // Use the pauseTimeline method if it exists, otherwise fall back to stop
  if (serviceRef.current.timelineEngine.pauseTimeline) {
    const paused = serviceRef.current.timelineEngine.pauseTimeline();
    console.log("TimelineEngine pause result:", paused);
    
    if (paused) {
      setTimelineIsPlaying(false);
    }
    
    return paused;
  } else {
    // Fall back to stop if pause isn't available
    console.log("pauseTimeline not available, using stopTimeline as fallback");
    const stopped = serviceRef.current.timelineEngine.stop();
    console.log("TimelineEngine stop result:", stopped);
    
    if (stopped) {
      setTimelineIsPlaying(false);
    }
    
    return stopped;
  }
}, []);

// In src/contexts/StreamingAudioContext.js
const handleResumeTimeline = useCallback(() => {
  if (!serviceRef.current.timelineEngine) {
    console.log("Can't resume timeline: TimelineEngine missing");
    return false;
  }
  console.log("Resuming timeline from current position...");
  
  // Use the resumeTimeline method if it exists
  if (serviceRef.current.timelineEngine.resumeTimeline) {
    const resumed = serviceRef.current.timelineEngine.resumeTimeline();
    console.log("TimelineEngine resume result:", resumed);
    
    if (resumed) {
      setTimelineIsPlaying(true);
    }
    
    return resumed;
  } else {
    // Fall back to start with reset:false if resume isn't available
    console.log("resumeTimeline not available, using startTimeline with reset:false as fallback");
    const started = serviceRef.current.timelineEngine.start({ reset: false });
    console.log("TimelineEngine start result:", started);
    
    if (started) {
      setTimelineIsPlaying(true);
    }
    
    return started;
  }
}, []);


  const handleGetSessionTime = useCallback(() => {
    if (serviceRef.current.timelineEngine) {
      return serviceRef.current.timelineEngine.getElapsedTime();
    }
    return 0;
  }, []);

  const handleResetTimelineEventIndex = useCallback(() => {
    if (serviceRef.current.timelineEngine) {
      serviceRef.current.timelineEngine.stop();
      serviceRef.current.timelineEngine.reset();
    }
  }, []);

  const handleUpdateTimelinePhases = useCallback((phases) => {
    if (!phases || !Array.isArray(phases)) return;
    
    setTimelinePhases(phases);
    
    if (serviceRef.current.timelineEngine) {
      serviceRef.current.timelineEngine.setPhases(phases);
    }
  }, []);

  const handleRegisterTimelineEvent = useCallback((event) => {
    if (!event) return false;
    
    setTimelineEvents(prev => {
      const updatedEvents = [...prev, event].sort((a, b) => a.time - b.time);
      return updatedEvents;
    });
    
    if (serviceRef.current.timelineEngine) {
      serviceRef.current.timelineEngine.addEvent(event);
    }
    
    return true;
  }, []);

  const handleClearTimelineEvents = useCallback(() => {
    setTimelineEvents([]);
    
    if (serviceRef.current.timelineEngine) {
      serviceRef.current.timelineEngine.clearEvents();
    }
    
    return true;
  }, []);

  const handleSetSessionDuration = useCallback((duration) => {
    setSessionDuration(duration);
    
    if (serviceRef.current.timelineEngine) {
      serviceRef.current.timelineEngine.setSessionDuration(duration);
    }
    
    return true;
  }, []);
  
  const handleSetTransitionDuration = useCallback((duration) => {
    setTransitionDuration(duration);
    
    if (serviceRef.current.timelineEngine) {
      serviceRef.current.timelineEngine.setTransitionDuration(duration);
    }
    
    return true;
  }, []);
  
  const handleSeekToTime = useCallback((timeMs) => {
    if (serviceRef.current.timelineEngine) {
      return serviceRef.current.timelineEngine.seekTo(timeMs);
    }
    return false;
  }, []);
  
  const handleSeekToPercent = useCallback((percent) => {
    if (serviceRef.current.timelineEngine) {
      return serviceRef.current.timelineEngine.seekToPercent(percent);
    }
    return false;
  }, []);
  
  // Preset Management Functions
  const handleRegisterPresetStateProvider = useCallback((key, providerFn) => {
    if (!key) return;
    
    if (providerFn === null) {
      // Unregister provider
      const updatedProviders = { ...stateProviders.current };
      delete updatedProviders[key];
      stateProviders.current = updatedProviders;
    } else {
      // Register provider
      stateProviders.current = {
        ...stateProviders.current,
        [key]: providerFn
      };
    }
  }, []);
  
  const handleSavePreset = useCallback((name) => {
    if (!name || name.trim() === '' || !serviceRef.current.presetManager) return false;
    
    const preset = serviceRef.current.presetManager.savePreset(name);
    return !!preset;
  }, []);
  
  const handleLoadPreset = useCallback((nameOrData) => {
    if (!serviceRef.current.presetManager) return false;
    
    // If it's a string, assume it's a preset name
    if (typeof nameOrData === 'string') {
      return serviceRef.current.presetManager.loadPreset(nameOrData);
    }
    
    // If it's an object, process the preset data directly
    const presetData = nameOrData;
    
    // Apply component states
    if (presetData.components) {
      Object.entries(presetData.components).forEach(([componentKey, state]) => {
        // Dispatch custom events for each component to handle its own state
        if (typeof window !== 'undefined') {
          const event = new CustomEvent(`${componentKey}-update`, { detail: state });
          window.dispatchEvent(event);
        }
      });
    }
    
    return true;
  }, []);
  
  const handleDeletePreset = useCallback((name) => {
    if (!serviceRef.current.presetManager) return false;
    return serviceRef.current.presetManager.deletePreset(name);
  }, []);
  
  const handleGetPresets = useCallback(() => {
    if (!serviceRef.current.presetManager) return [];
    return serviceRef.current.presetManager.getPresetArray('date', true);
  }, []);
  
  const handleExportPreset = useCallback((name) => {
    if (!serviceRef.current.presetManager) return null;
    return serviceRef.current.presetManager.exportPreset(name);
  }, []);
  
  const handleImportPreset = useCallback((jsonString) => {
    if (!serviceRef.current.presetManager) {
      return { success: false, error: 'PresetManager not available' };
    }
    return serviceRef.current.presetManager.importPreset(jsonString);
  }, []);

  // Create a memoized context value to prevent unnecessary re-renders
const contextValue = useMemo(() => {
 // console.log("Creating memoized context value with volumes:", volumes);
  return {
    // Audio state
    isLoading,
    loadingProgress,
    isPlaying,
    volumes,
    activeAudio,
    audioLibrary,
    hasSwitchableAudio,
    crossfadeProgress,
    activeCrossfades,
    preloadProgress,
    
    // Master volume
    masterVolume,
    setMasterVolumeLevel: handleSetMasterVolume,
    
    // Audio controls
    setVolume: handleSetVolume,
    startSession: handleStartSession,
    pauseSession: handlePauseSession,
    crossfadeTo: handleCrossfadeTo, 
    fadeLayerVolume: handleFadeVolume,
    preloadAudio: handlePreloadAudio,
    getSessionTime: handleGetSessionTime,
    
    // Timeline functions
    timelineEvents,
    timelinePhases,
    activePhase,
    progress,
    sessionDuration,
    transitionDuration,
    resetTimelineEventIndex: handleResetTimelineEventIndex,
    registerTimelineEvent: handleRegisterTimelineEvent,
    clearTimelineEvents: handleClearTimelineEvents,
    updateTimelinePhases: handleUpdateTimelinePhases,
    seekToTime: handleSeekToTime,
    seekToPercent: handleSeekToPercent,
    setSessionDuration: handleSetSessionDuration,
    setTransitionDuration: handleSetTransitionDuration,
    timelineIsEnabled,
    setTimelineIsEnabled: handleSetTimelineEnabled,
    startTimeline: handleStartTimeline,
    pauseTimeline: handlePauseTimeline,
    resumeTimeline: handleResumeTimeline,
    stopTimeline: handleStopTimeline,
    
    // Preset functions
    registerPresetStateProvider: handleRegisterPresetStateProvider,
    savePreset: handleSavePreset,
    loadPreset: handleLoadPreset,
    deletePreset: handleDeletePreset,
    getPresets: handleGetPresets,
    exportPreset: handleExportPreset,
    importPreset: handleImportPreset,
    
    // Constants
    LAYERS
  };
}, [
  // Audio state
  isLoading, 
  loadingProgress, 
  isPlaying, 
  volumes, // Make sure volumes is in dependencies
  activeAudio, 
  audioLibrary,
  hasSwitchableAudio,
  crossfadeProgress, 
  activeCrossfades,
  preloadProgress,
  masterVolume,
  
  // Function dependencies
  handleSetMasterVolume,
  handleSetVolume,
  handleStartSession,
  handlePauseSession,
  handleCrossfadeTo,
  handlePreloadAudio,
  handleGetSessionTime,
  
  // Timeline state
  timelineEvents,
  timelinePhases,
  activePhase,
  progress,
  sessionDuration,
  transitionDuration,
  timelineIsEnabled,
  
  // Timeline functions
  handleResetTimelineEventIndex,
  handleRegisterTimelineEvent,
  handleClearTimelineEvents,
  handleUpdateTimelinePhases,
  handleSeekToTime,
  handleSeekToPercent,
  handleSetSessionDuration,
  handleSetTransitionDuration,
  handleSetTimelineEnabled,
  
  // Preset functions
  handleRegisterPresetStateProvider,
  handleSavePreset,
  handleLoadPreset,
  handleDeletePreset,
  handleGetPresets,
  handleExportPreset,
  handleImportPreset
]);

return (
  <AudioContext.Provider value={contextValue}>
    {children}
  </AudioContext.Provider>
);
};

export default AudioContext;