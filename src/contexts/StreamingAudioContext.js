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
  
  // Feature availability
  const [hasSwitchableAudio, setHasSwitchableAudio] = useState(false);
  
  // Crossfade state tracking for UI feedback
  const [crossfadeProgress, setCrossfadeProgress] = useState({});
  const [activeCrossfades, setActiveCrossfades] = useState({});
  
  // Track preloading progress
  const [preloadProgress, setPreloadProgress] = useState({});
  
  // Timeline features
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelinePhases, setTimelinePhases] = useState([]);
  const [activePhase, setActivePhase] = useState(null);
  const [progress, setProgress] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(60 * 60 * 1000); // 1 hour
  const [transitionDuration, setTransitionDuration] = useState(4000); // 4 seconds
  
  // Preset management
  const [presets, setPresets] = useState({});
  const stateProviders = useRef({});

  // Initialize services - Only run once on mount
  useEffect(() => {
    let isMounted = true; // For preventing state updates after unmount
    
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
              
              console.log(`Phase changed to: ${phaseId}`);
              setActivePhase(phaseId);
              
              // Apply phase state if it exists
              if (phaseData?.state) {
                // Apply volumes
                if (phaseData.state.volumes) {
                  Object.entries(phaseData.state.volumes).forEach(([layer, volume]) => {
                    setVolumes(prev => ({ ...prev, [layer]: volume }));
                    services.volumeController.setVolume(layer, volume);
                  });
                }
                
                // Apply track changes
                if (phaseData.state.activeAudio) {
                  Object.entries(phaseData.state.activeAudio).forEach(([layer, trackId]) => {
                    if (trackId && trackId !== activeAudio[layer]) {
                      handleCrossfadeTo(layer, trackId, transitionDuration);
                    }
                  });
                }
              }
            },
            onScheduledEvent: (event) => {
              if (!isMounted) return;
              
              console.log('Timeline event triggered:', event);
              
              if (event.action === 'crossfade' && event.data) {
                const { layer, trackId, duration } = event.data;
                if (layer && trackId) {
                  handleCrossfadeTo(layer, trackId, duration || transitionDuration);
                }
              } else if (event.action === 'volume' && event.data) {
                const { layer, volume } = event.data;
                if (layer !== undefined && volume !== undefined) {
                  handleSetVolume(layer, volume);
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
    
    // Update audio library state
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
    
    // Update state with loaded audio
    setActiveAudio(newActiveAudio);
    setIsLoading(false);
    setLoadingProgress(100);
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
  console.log(`handleSetVolume called for ${layer}: ${value}`);
  
  if (!serviceRef.current.volumeController) {
    console.error("Cannot set volume: VolumeController not available");
    return;
  }
  
  // Update our local state for UI
  console.log(`Updating local volume state for ${layer} from`, volumes[layer], `to ${value}`);
  
  setVolumes(prev => {
    const newVolumes = {
      ...prev,
      [layer]: value
    };
    console.log(`New volumes state:`, newVolumes);
    return newVolumes;
  });
    
    // Apply volume using the VolumeController
  const result = serviceRef.current.volumeController.setVolume(layer, value, options);
  console.log(`VolumeController.setVolume result for ${layer}: ${result}`);
  
  // If there's an active crossfade for this layer, update its volume too
  if (serviceRef.current.crossfadeEngine?.isActive(layer)) {
    const result = serviceRef.current.crossfadeEngine.adjustCrossfadeVolume(layer, value);
    console.log(`CrossfadeEngine.adjustCrossfadeVolume result for ${layer}: ${result}`);
  }
}, [volumes]);

  // Function to safely set playing state
  const updatePlayingState = useCallback((newState) => {
    // Update the ref immediately (sync)
    isPlayingRef.current = newState;
    // Update the React state (async)
    setIsPlaying(newState);
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
            
            // Start the TimelineEngine
            console.log("About to start TimelineEngine, current instance:", serviceRef.current.timelineEngine);
            if (serviceRef.current.timelineEngine) {
              const started = serviceRef.current.timelineEngine.start({ reset: true });
              console.log("TimelineEngine start result:", started);
            }
          }
        })
        .catch(error => {
          console.error('Error in play promises:', error);
          // Try to update state anyway
          updatePlayingState(true);
          
          // Start the TimelineEngine
          console.log("About to start TimelineEngine, current instance:", serviceRef.current.timelineEngine);
          if (serviceRef.current.timelineEngine) {
            const started = serviceRef.current.timelineEngine.start({ reset: true });
            console.log("TimelineEngine start result:", started);
          }
        });
      
      // Set state immediately as a fallback
      if (!isPlayingRef.current) {
        updatePlayingState(true);
        
        // Start the TimelineEngine
        console.log("About to start TimelineEngine, current instance:", serviceRef.current.timelineEngine);
        if (serviceRef.current.timelineEngine) {
          const started = serviceRef.current.timelineEngine.start({ reset: true });
          console.log("TimelineEngine start result:", started);
        }
      }
      
    } catch (error) {
      console.error('Error starting session:', error);
      updatePlayingState(false);
    }
  }, [activeAudio, updatePlayingState]);

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
      
      // Update state immediately
      updatePlayingState(false);
      
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
  const handleCrossfadeTo = useCallback(async (layer, newTrackId, fadeDuration = 4000) => {
    console.log(`Starting crossfade process for ${layer}: ${newTrackId}`);
    
    // Verify we have what we need
    if (!serviceRef.current.audioCore || 
        !serviceRef.current.volumeController || 
        !serviceRef.current.crossfadeEngine) {
      console.error("Cannot crossfade: missing required services");
      return false;
    }
    
    const audioCtx = serviceRef.current.audioCore.getContext();
    const masterGain = serviceRef.current.audioCore.getMasterGain();
    const audioElements = serviceRef.current.audioCore.getElements?.() || {};
    
    // Get the current active track ID
    const currentTrackId = activeAudio[layer];
    
    // Skip if already playing requested track
    if (currentTrackId === newTrackId) {
      console.log(`Already playing ${newTrackId} on ${layer}`);
      return true;
    }
    
    // If audio is not playing, do an immediate switch without crossfade
    if (!isPlayingRef.current) {
      try {
        // Find track in library
        const track = audioLibrary[layer].find(t => t.id === newTrackId);
        if (!track) {
          console.error(`Track ${newTrackId} not found in library`);
          return false;
        }
        
        // Check if we already have this track loaded
        let trackElements = audioElements[layer]?.[newTrackId];
        
        if (!trackElements) {
          // Create and load the track if needed
          const audioElement = new Audio();
          audioElement.preload = "auto";
          audioElement.loop = true;
          audioElement.src = track.path;
          
          // Create source node
          const source = audioCtx.createMediaElementSource(audioElement);
          
          // Connect to VolumeController
          serviceRef.current.volumeController.connectToLayer(layer, source, masterGain);
          
          // Store the new track
          trackElements = {
            element: audioElement,
            source: source,
            track: track,
            isActive: false
          };
          
          // Update audio elements in AudioCore if it supports it
          if (serviceRef.current.audioCore.updateElement) {
            serviceRef.current.audioCore.updateElement(layer, newTrackId, trackElements);
          }
        }
        
        // Update active audio state immediately
        setActiveAudio(prev => ({
          ...prev,
          [layer]: newTrackId
        }));
        
        console.log(`Immediate switch to ${newTrackId} successful for ${layer}`);
        return true;
      } catch (error) {
        console.error(`Error during immediate track switch: ${error.message}`);
        return false;
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
    
    // Get or create the new track's audio elements
    let newTrackElements = audioElements[layer]?.[newTrackId];
    
    // Load the track if it doesn't exist yet
    if (!newTrackElements) {
      console.log(`Track ${newTrackId} needs loading, preparing now...`);
      
      // Find the track in the library
      const track = audioLibrary[layer].find(t => t.id === newTrackId);
      if (!track) {
        console.error(`Track ${newTrackId} not found in library`);
        
        // Reset crossfade state
        setActiveCrossfades(prev => {
          const newState = {...prev};
          delete newState[layer];
          return newState;
        });
        
        return false;
      }
      
      try {
        // Use BufferManager for loading with progress tracking
        await handlePreloadAudio(layer, newTrackId);
        
        // Create the audio element
        const audioElement = new Audio();
        audioElement.preload = "auto";
        audioElement.loop = true;
        audioElement.src = track.path;
        
        // Create the source node after loading
        const source = audioCtx.createMediaElementSource(audioElement);
        
        // Connect to VolumeController
        serviceRef.current.volumeController.connectToLayer(layer, source, masterGain);
        
        // Create the track elements
        newTrackElements = {
          element: audioElement,
          source: source,
          track: track,
          isActive: false
        };
        
        // Update audio elements in AudioCore if it supports it
        if (serviceRef.current.audioCore.updateElement) {
          serviceRef.current.audioCore.updateElement(layer, newTrackId, newTrackElements);
        }
      } catch (error) {
        console.error(`Error preparing track ${newTrackId}: ${error.message}`);
        
        // Reset crossfade state
        setActiveCrossfades(prev => {
          const newState = {...prev};
          delete newState[layer];
          return newState;
        });
        
        return false;
      }
    }
    
    // Update UI - now loading is complete
    setActiveCrossfades(prev => ({
      ...prev,
      [layer]: { 
        ...prev[layer],
        isLoading: false 
      }
    }));
    
    // Get the current track
    const currentTrack = audioElements[layer]?.[currentTrackId];
    if (!currentTrack) {
      console.error(`Current track ${currentTrackId} not found in audio elements`);
      return false;
    }
    
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
      duration: fadeDuration,
      syncPosition: true,
      metadata: {
        fromTrackId: currentTrackId,
        toTrackId: newTrackId,
        volumeController: serviceRef.current.volumeController
      }
    };
    
    try {
      // Update active track state - do this before the crossfade
      setActiveAudio(prev => ({
        ...prev,
        [layer]: newTrackId
      }));
      
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
  }, [audioLibrary, activeAudio, handlePreloadAudio]);

  // Timeline functions - wrapped in useCallback
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
  
  // Timeline functions
  handleResetTimelineEventIndex,
  handleRegisterTimelineEvent,
  handleClearTimelineEvents,
  handleUpdateTimelinePhases,
  handleSeekToTime,
  handleSeekToPercent,
  handleSetSessionDuration,
  handleSetTransitionDuration,
  
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