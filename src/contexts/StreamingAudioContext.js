// src/contexts/StreamingAudioContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createAudioServices } from '../services/audio';
import CollectionService from '../services/CollectionService';
import AudioFileService from '../services/AudioFileService';
import { useCollections } from '../hooks/useCollections';
import { mapCollectionToLayers } from '../utils/collectionUtils';

// Define our audio layers as a frozen object to prevent modifications
const LAYERS = Object.freeze({
  Layer_1: 'Layer 1',
  Layer_2: 'Layer 2',
  Layer_3: 'Layer 3',
  Layer_4: 'Layer 4'
});

// Default audio files for each layer
const DEFAULT_AUDIO = Object.freeze({
  [LAYERS.Layer_1]: '/samples/default/drone.mp3',
  [LAYERS.Layer_2]: '/samples/default/melody.mp3',
  [LAYERS.Layer_3]: '/samples/default/rhythm.mp3',
  [LAYERS.Layer_4]: '/samples/default/nature.mp3'
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
  // Service references
  const serviceRef = useRef({
    audioCore: null,
    bufferManager: null,
    volumeController: null,
    layerController: null,
    crossfadeEngine: null,
    timelineEngine: null,

  });

  // Collection services
  const collectionService = useMemo(() => new CollectionService({
    enableLogging: true
  }), []);

  const audioFileService = useMemo(() => new AudioFileService({
    enableLogging: true
  }), []);

  //========STATE MANAGMENT=================
  //========================================

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
    [LAYERS.Layer_1]: 0.25,
    [LAYERS.Layer_2]: 0.0,
    [LAYERS.Layer_3]: 0.0,
    [LAYERS.Layer_4]: 0.0
  });

  // Track currently active audio elements for each layer
  const [activeAudio, setActiveAudio] = useState({});
  const activeAudioRef = useRef({});

  // Audio library - will store available tracks for each layer
  const [audioLibrary, setAudioLibrary] = useState({
    [LAYERS.Layer_1]: [],
    [LAYERS.Layer_2]: [],
    [LAYERS.Layer_3]: [],
    [LAYERS.Layer_4]: []
  });

  const audioLibraryRef = useRef({
    [LAYERS.Layer_1]: [{
      id: `${LAYERS.Layer_1}1`,
      name: `${LAYERS.Layer_1.charAt(0).toUpperCase() + LAYERS.Layer_1.slice(1)}`,
      path: DEFAULT_AUDIO[LAYERS.Layer_1]
    }],
    [LAYERS.Layer_2]: [{
      id: `${LAYERS.Layer_2}1`,
      name: `${LAYERS.Layer_2.charAt(0).toUpperCase() + LAYERS.Layer_2.slice(1)}`,
      path: DEFAULT_AUDIO[LAYERS.Layer_2]
    }],
    [LAYERS.Layer_3]: [{
      id: `${LAYERS.Layer_3}1`,
      name: `${LAYERS.Layer_3.charAt(0).toUpperCase() + LAYERS.Layer_3.slice(1)}`,
      path: DEFAULT_AUDIO[LAYERS.Layer_3]
    }],
    [LAYERS.Layer_4]: [{
      id: `${LAYERS.Layer_4}1`,
      name: `${LAYERS.Layer_4.charAt(0).toUpperCase() + LAYERS.Layer_4.slice(1)}`,
      path: DEFAULT_AUDIO[LAYERS.Layer_4]
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
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelinePhases, setTimelinePhases] = useState([]);
  const [activePhase, setActivePhase] = useState(null);
  const [progress, setProgress] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(1 * 60 * 1000); // 1 min
  const [transitionDuration, setTransitionDuration] = useState(4000); // 4 seconds
  const [timelineIsPlaying, setTimelineIsPlaying] = useState(false);




  // Collection state
  const [currentCollection, setCurrentCollection] = useState(null);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [collectionError, setCollectionError] = useState(null);
  const [collectionLoadProgress, setCollectionLoadProgress] = useState(0);




  //==========INITIALIZE============
  //================================


  // Initialize collection hooks
  const {
    collections,
    isLoading: isLoadingCollections,
    error: collectionsError,
    loadCollections,
    getCollection: fetchCollection
  } = useCollections({
    loadOnMount: false // Change to false to prevent automatic loading
  });

  // Use a ref to track if collections have been loaded
  const collectionsLoadedRef = useRef(false);

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


            },
            onProgress: (progress, elapsedTime) => {
              if (isMounted) setProgress(progress);
            }
          }

        });

        // Store services in ref
        serviceRef.current = services;

        if (isMounted) setLoadingProgress(10);

        // Initialize audio
        if (isMounted) await initializeDefaultAudio();

        // You can replace 'your-collection-id' with any collection ID you want to load by default
        if (isMounted) {
          console.log("Loading initial collection...");
          // Don't auto-play since this is the initial load
          handleLoadCollection('Stillness', { autoPlay: false })
            .then(success => {
              console.log(`Initial collection load ${success ? 'succeeded' : 'failed'}`);
            })
            .catch(err => {
              console.error("Error loading initial collection:", err);
            });
        }


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

  //=========EFFECTS===========
  //=========================== 

  // Load collections on mount using useEffect with error handling
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    const loadInitialCollections = async () => {
      if (!isMounted || collectionsLoadedRef.current) return;

      try {
        await loadCollections();
        collectionsLoadedRef.current = true;
      } catch (error) {
        console.error('Error loading initial collections:', error);

        // Retry with exponential backoff
        if (retryCount < maxRetries) {
          retryCount++;
          const delay = retryDelay * Math.pow(2, retryCount - 1);
          console.log(`Retrying collection load in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
          setTimeout(loadInitialCollections, delay);
        } else {
          console.error('Max retries reached for loading collections');
        }
      }
    };

    loadInitialCollections();

    return () => {
      isMounted = false;
    };
  }, [loadCollections]); // Only run once on mount

  // Sync activeAudioRef with activeAudio state
  useEffect(() => {
    activeAudioRef.current = { ...activeAudio };
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


  //==========LAYERS===========
  //===========================

  // Initialize audio elements with default tracks
  const initializeDefaultAudio = useCallback(async () => {
    const { audioCore, volumeController } = serviceRef.current;
    if (!audioCore || !volumeController) {
      console.error('[StreamingAudioContext: initializeDefaultAudio] Cannot initialize audio, services not ready');
      return false;
    }

    const audioCtx = audioCore.getContext();
    const masterGain = audioCore.getMasterGain();

    const totalFiles = Object.values(LAYERS).length;
    let loadedFilesCount = 0;

    const newActiveAudio = {};
    const newAudioElements = {};

    // Initialize the audio elements structure for each layer
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

    // Update audio library state and reference
    audioLibraryRef.current = { ...basicLibrary };
    setAudioLibrary(basicLibrary);
    setLoadingProgress(20);

    console.log("[StreamingAudioContext: initializeDefaultAudio] Initializing audio with track IDs:", newActiveAudio);

    // For each layer, create and load the default audio element
    // We'll wrap this in a Promise.all to ensure all layers are properly initialized
    const layerInitPromises = Object.values(LAYERS).map(async layer => {
      const defaultTrack = basicLibrary[layer][0];
      const trackId = defaultTrack.id;

      console.log(`[StreamingAudioContext: initializeDefaultAudio] Loading audio for ${layer}, track ID: ${trackId}, path: ${defaultTrack.path}`);

      try {
        // Create new audio element
        const audioElement = new Audio();

        // Set up load handler
        const loadPromise = new Promise((resolve) => {
          const loadHandler = () => {
            loadedFilesCount++;
            const progress = Math.round((loadedFilesCount / totalFiles) * 70) + 20;
            setLoadingProgress(progress);
            console.log(`[StreamingAudioContext: initializeDefaultAudio] Loaded audio for ${layer}, progress: ${progress}%`);
            resolve();
          };

          // Set up event listeners
          audioElement.addEventListener('canplaythrough', loadHandler, { once: true });

          // Handle errors
          audioElement.addEventListener('error', (e) => {
            console.error(`[StreamingAudioContext: initializeDefaultAudio] Error loading audio for ${layer}:`, e);
            console.error(`[StreamingAudioContext: initializeDefaultAudio] Audio src was:`, audioElement.src);
            console.error(`[StreamingAudioContext: initializeDefaultAudio] Error code:`, audioElement.error ? audioElement.error.code : 'unknown');
            loadHandler(); // Still mark as loaded so we don't hang
          }, { once: true });

          // Set a timeout in case nothing happens
          setTimeout(() => {
            if (!audioElement.readyState) {
              console.warn(`[StreamingAudioContext: initializeDefaultAudio] Loading audio for ${layer} timed out, continuing anyway`);
              loadHandler();
            }
          }, 5000);
        });

        // Start loading - IMPORTANT: Set crossOrigin to allow CORS if needed
        audioElement.crossOrigin = "anonymous";
        audioElement.src = defaultTrack.path;
        audioElement.loop = true;
        audioElement.preload = "auto"; // Force preloading
        audioElement.load();

        // Create media element source
        const source = audioCtx.createMediaElementSource(audioElement);

        // Connect source to volume controller - THIS IS CRITICAL
        const connected = volumeController.connectToLayer(layer, source, masterGain);
        console.log(`[StreamingAudioContext: initializeDefaultAudio] Connected ${layer} to volume controller:`, connected);

        // Store the audio element and its source
        newAudioElements[layer][trackId] = {
          element: audioElement,
          source: source,
          track: defaultTrack,
          isActive: true
        };

        console.log(`[StreamingAudioContext: initializeDefaultAudio] Audio element created for ${layer}:`,
          { trackId, path: defaultTrack.path, connected: true });

        // Set as active audio for this layer
        newActiveAudio[layer] = trackId;

        // Wait for this layer to load
        await loadPromise;

        return { layer, success: true };

      } catch (error) {
        console.error(`[StreamingAudioContext: initializeDefaultAudio] Error initializing audio for layer ${layer}:`, error);
        // Increment progress anyway to avoid getting stuck
        loadedFilesCount++;
        const progress = Math.round((loadedFilesCount / totalFiles) * 70) + 20;
        setLoadingProgress(progress);

        return { layer, success: false, error };
      }
    });

    // Wait for all layers to initialize
    const results = await Promise.all(layerInitPromises);

    // Log initialization results
    results.forEach(result => {
      console.log(`[StreamingAudioContext: initializeDefaultAudio] Layer ${result.layer} initialization ${result.success ? 'succeeded' : 'failed'}`);
    });

    // Store audio elements in AudioCore
    console.log("[StreamingAudioContext: initializeDefaultAudio] Registering audio elements with AudioCore:",
      Object.keys(newAudioElements).map(layer =>
        `${layer}: ${Object.keys(newAudioElements[layer]).join(', ')}`
      )
    );

    // Store audio elements in AudioCore
    if (audioCore.registerElements) {
      const registered = audioCore.registerElements(newAudioElements);
      console.log("[StreamingAudioContext: initializeDefaultAudio] AudioCore registration result:", registered);
    } else {
      console.error("[StreamingAudioContext: initializeDefaultAudio] AudioCore.registerElements is not defined");
    }

    // Update both states together
    setAudioLibrary(prev => ({ ...basicLibrary }));
    setActiveAudio(prev => ({ ...newActiveAudio }));
    setIsLoading(false);
    setLoadingProgress(100);

    console.log("[StreamingAudioContext: initializeDefaultAudio] Final active audio state:", newActiveAudio);
    console.log("[StreamingAudioContext: initializeDefaultAudio] All audio loaded successfully");

    return true;
  }, []);
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



  //=========VOLUME=========
  //========================

  // Set master volume
  const handleSetMasterVolume = useCallback((value) => {
    if (!serviceRef.current.audioCore) return;

    setMasterVolume(value);
    serviceRef.current.audioCore.setMasterVolume(value);
  }, []);

  // Set volume for a specific layer
  const handleSetVolume = useCallback((layer, value, options = {}) => {
    console.log(`[StreamingAudioContext: handleSetVolume] Setting volume for ${layer} to ${value}`);

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
    console.log(`[StreamingAudioContext: handleSetVolume] Volume controller result: ${result}`);

    // If there's an active crossfade for this layer, update its volume too
    if (serviceRef.current.crossfadeEngine?.isActive(layer)) {
      const result = serviceRef.current.crossfadeEngine.adjustCrossfadeVolume(layer, value);
      console.log(`CrossfadeEngine.adjustCrossfadeVolume result for ${layer}: ${result}`);
    }
  }, [volumes]);



  //========PLAYBACK=============
  //=============================

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

  // Start the session 
  const handleStartSession = useCallback(() => {
    // Use ref for current state check to avoid race conditions
    if (!serviceRef.current.audioCore || isPlayingRef.current) {
      console.log("Can't start: AudioCore missing or already playing");
      return;
    }

    try {
      console.log("[StreamingAudioContext: handleStartSession] Starting session...");

      // Resume AudioCore
      serviceRef.current.audioCore.resume().catch(err => {
        console.error('[StreamingAudioContext: handleStartSession] Error resuming audio context:', err);
      });

      // Get currently active audio elements
      const audioElements = serviceRef.current.audioCore.getElements?.() || {};


      // Force update all layer volumes from current UI state
      Object.entries(volumes).forEach(([layer, volume]) => {
        if (serviceRef.current.volumeController) {
          // Set volumes with immediate=true to ensure they're set before playback
          serviceRef.current.volumeController.setVolume(layer, volume, {
            immediate: false,
            transitionTime: 0.05
          });
          console.log(`[StreamingAudioContext: handleStartSession] Layer ${layer} - Set initial volume: ${volume}`);
        }
      });

      console.log("[StreamingAudioContext: handleStartSession] Audio Elements:",
        Object.keys(audioElements).map(layer =>
          `${layer}: ${Object.keys(audioElements[layer] || {}).join(', ')}`
        )
      );

      // Log active layer info
      Object.values(LAYERS).forEach(layer => {
        const trackId = activeAudio[layer];
        console.log(`[StreamingAudioContext: handleStartSession] Layer ${layer} - Active track: ${trackId}, Volume: ${volumes[layer]}`);
      });

      // Make sure all audio elements are reset to beginning
      Object.entries(activeAudio).forEach(([layer, trackId]) => {
        const track = audioElements[layer]?.[trackId];
        console.log(`[StreamingAudioContext: handleStartSession] Layer ${layer} - Attempting to play track ${trackId}:`, track ? 'Found' : 'Not found');

        if (track?.element) {
          // Log volume level
          console.log(`[StreamingAudioContext: handleStartSession] Layer ${layer} - Volume level:`, volumes[layer]);
          console.log(`[StreamingAudioContext: handleStartSession] Layer ${layer} - Audio element readyState:`, track.element.readyState);


          // Reset to beginning of track
          track.element.currentTime = 0;

          // Set volume to 0 for fade-in
          if (track.source && track.source.gain) {
            track.source.gain.value = 0;
          }
        }
      });

      // Play all active audio elements
      let allPlayPromises = [];

      Object.entries(activeAudio).forEach(([layer, trackId]) => {
        const track = audioElements[layer]?.[trackId];
        if (track?.element) {
          // Play and collect the promise
          try {
            console.log(`[StreamingAudioContext: handleStartSession] Layer ${layer} - Initiating play() for track ${trackId}`);
            const playPromise = track.element.play();
            if (playPromise !== undefined) {
              allPlayPromises.push(
                playPromise.catch(err => {
                  console.error(`[StreamingAudioContext: handleStartSession] Error playing ${layer}:`, err);
                  return null;
                })
              );
            }
          } catch (err) {
            console.error(`[StreamingAudioContext: handleStartSession] Error starting ${layer}:`, err);
          }
        } else {
          console.error(`[StreamingAudioContext: handleStartSession] No track found for ${layer}/${trackId}`);
        }
      });

      // Wait for all play operations to complete, then fade in
      Promise.all(allPlayPromises)
        .then(() => {
          // Fade in all layers
          Object.entries(activeAudio).forEach(([layer, trackId]) => {
            const layerKey = layer.toLowerCase();
            if (serviceRef.current.volumeController) {
              // Fade in using the volume controller with 50ms duration
              const targetVolume = volumes[layer] || 0;
              console.log(`[StreamingAudioContext: handleStartSession] Fading in ${layer} to ${targetVolume}`);
              serviceRef.current.volumeController.setVolume(layerKey, targetVolume, {
                immediate: false,
                transitionTime: 0.05 // 50ms
              });
            }
          });

          if (!isPlayingRef.current) {
            updatePlayingState(true);
          }
        })
        .catch(error => {
          console.error('[StreamingAudioContext: handleStartSession] Error in play promises:', error);
          // Try to update state anyway
          updatePlayingState(true);
        });

      // Set state immediately as a fallback
      if (!isPlayingRef.current) {
        updatePlayingState(true);
      }

    } catch (error) {
      console.error('[StreamingAudioContext: handleStartSession] Error starting session:', error);
      updatePlayingState(false);
    }
  }, [activeAudio, volumes, updatePlayingState, LAYERS]);

  // Pause/Stop session
  // Inside handlePauseSession() to implement fade out
  const handlePauseSession = useCallback(() => {
    if (!isPlayingRef.current) {
      console.log("[StreamingAudioContext: handlePauseSession] Not playing, nothing to pause");
      return;
    }

    try {
      console.log("[StreamingAudioContext: handlePauseSession] Fading out and pausing session...");

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

      // Fade out all active layers first
      const fadeDuration = 50; // 50ms fade duration
      const layerFadePromises = [];

      Object.entries(activeAudio).forEach(([layer, trackId]) => {
        const track = audioElements[layer]?.[trackId];
        if (track?.element && serviceRef.current.volumeController) {
          try {
            // Use VolumeController to fade out
            const fadePromise = serviceRef.current.volumeController.setVolume(layer, 0, {
              immediate: false,
              transitionTime: fadeDuration / 1000 // Convert ms to seconds
            });

            layerFadePromises.push(fadePromise);
            console.log(`[StreamingAudioContext: handlePauseSession] Fading out ${layer}`);
          } catch (err) {
            console.error(`[StreamingAudioContext: handlePauseSession] Error fading out ${layer}:`, err);
          }
        }
      });

      // After a short delay to allow fade out, pause all audio elements
      setTimeout(() => {
        Object.entries(activeAudio).forEach(([layer, trackId]) => {
          const track = audioElements[layer]?.[trackId];
          if (track?.element) {
            try {
              track.element.pause();
              console.log(`[StreamingAudioContext: handlePauseSession] Paused ${layer}`);
            } catch (err) {
              console.error(`[StreamingAudioContext: handlePauseSession] Error pausing ${layer}:`, err);
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
            console.warn('[StreamingAudioContext: handlePauseSession] Error suspending audio context:', err);
          });
        }

        // Check for proper state update
        console.log("[StreamingAudioContext: handlePauseSession] Before updatePlayingState, current state:", isPlayingRef.current);
        updatePlayingState(false);
        console.log("[StreamingAudioContext: handlePauseSession] After updatePlayingState, new state:", isPlayingRef.current);
      }, fadeDuration + 10); // Add a small buffer to ensure fade completes

    } catch (error) {
      console.error('[StreamingAudioContext: handlePauseSession] Error pausing session:', error);
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
        const newState = { ...prev };
        delete newState[trackId];
        return newState;
      });

      return true;
    } catch (error) {
      console.error(`Error preloading audio: ${error.message}`);

      // Reset progress on error
      setPreloadProgress(prev => {
        const newState = { ...prev };
        delete newState[trackId];
        return newState;
      });

      return false;
    }
  }, [audioLibrary]);


  //==========CROSSFADE=================
  //====================================

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
          const updated = { ...prevLibrary };
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
          const updated = { ...prevLibrary };
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
        const updated = { ...prev };
        if (!updated[layer]) updated[layer] = [];

        // Add track if it doesn't exist
        if (!updated[layer].some(t => t.id === newTrackId)) {
          updated[layer] = [...updated[layer], libraryTrack];
        }

        return updated;
      });
    }
    // Update the logging for better debugging (around line 1530-1540)
    console.log(`[StreamingAudioContext: handleCrossfadeTo] Starting crossfade for ${layer} to track ${newTrackId}`);
    console.log(`[StreamingAudioContext: handleCrossfadeTo] Available tracks in audioLibrary for ${layer}:`,
      audioLibrary[layer] ? audioLibrary[layer].map(t => `${t.id} (${t.name})`).join(', ') : 'None'
    );

    // Get or create the target track's audio elements
    let newTrackElements = audioElements[layer]?.[newTrackId];

    // Create the new track if it doesn't exist yet
    if (!newTrackElements) {
      console.log(`[StreamingAudioContext: handleCrossfadeTo] Creating new audio element for ${layer}/${newTrackId} with path ${libraryTrack.path}`);
      const audioElement = new Audio();
      audioElement.preload = "auto";
      audioElement.loop = true;
      audioElement.src = libraryTrack.path;
      audioElement.crossOrigin = "anonymous"; // Ensure CORS is set for remote files

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
        console.log(`[StreamingAudioContext: handleCrossfadeTo] Registering new element with AudioCore: ${layer}/${newTrackId}`);
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
          const newState = { ...prev };
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
        const newState = { ...prev };
        delete newState[layer];
        return newState;
      });

      setCrossfadeProgress(prev => {
        const newState = { ...prev };
        delete newState[layer];
        return newState;
      });

      console.log(`Crossfade complete for ${layer}: ${currentTrackId} -> ${newTrackId}`);
      return true;

    } catch (error) {
      console.error(`Error during crossfade: ${error.message}`);

      // Clear UI state
      setActiveCrossfades(prev => {
        const newState = { ...prev };
        delete newState[layer];
        return newState;
      });

      setCrossfadeProgress(prev => {
        const newState = { ...prev };
        delete newState[layer];
        return newState;
      });

      return false;
    }
  }, [audioLibrary, activeAudio, transitionDuration]);




  //==========TIMELINE=================
  //====================================

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
  }, [isPlayingRef, sessionDuration]);

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
  if (!phases || !Array.isArray(phases)) {
    console.log("[StreamingAudioContext: TIMELINE] No phases to update");
    return;
  }

// ADD THIS GUARD to prevent unnecessary updates:
if (JSON.stringify(timelinePhases) === JSON.stringify(phases)) {
  console.log("[StreamingAudioContext: TIMELINE] Phases unchanged, skipping update");
  return;
}


  console.log(`[StreamingAudioContext: TIMELINE] Updating ${phases.length} timeline phases:`);
  
  // Ensure phases are properly formed with states
  const validPhases = phases.map(phase => {
    console.log(`[StreamingAudioContext: TIMELINE] - Phase "${phase.name}" (${phase.id}) at position ${phase.position}:`);
    
    // Create a properly structured phase
    const validPhase = {
      id: phase.id,
      name: phase.name,
      position: phase.position,
      color: phase.color,
      locked: phase.locked || false
    };
    
    // Ensure state is properly structured if it exists
    if (phase.state) {
      console.log(`[StreamingAudioContext: TIMELINE] -- Phase has state`);
      validPhase.state = {
        volumes: phase.state.volumes ? {...phase.state.volumes} : {},
        activeAudio: phase.state.activeAudio ? {...phase.state.activeAudio} : {}
      };
      
      if (phase.state.volumes) {
        console.log(`[StreamingAudioContext: TIMELINE] -- Volumes: ${JSON.stringify(phase.state.volumes)}`);
      }
      
      if (phase.state.activeAudio) {
        console.log(`[StreamingAudioContext: TIMELINE] -- Tracks: ${JSON.stringify(phase.state.activeAudio)}`);
      }
    } else {
      console.log(`[StreamingAudioContext: TIMELINE] -- No state defined, creating empty state`);
      // Always provide a state object, even if empty
      validPhase.state = {
        volumes: {},
        activeAudio: {}
      };
    }
    
    return validPhase;
  });

  setTimelinePhases(validPhases);

  if (serviceRef.current.timelineEngine) {
    serviceRef.current.timelineEngine.setPhases(validPhases);
    console.log(`[StreamingAudioContext: TIMELINE] Phases updated in timeline engine`);
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



  //==========COLLECTIONS=================
  //======================================

  // Utility function to find a track by ID in an array of tracks
  const findTrackById = (tracks, trackId) => {
    if (!tracks || !Array.isArray(tracks)) return null;
    return tracks.find(track => track.id === trackId);
  };

  // Collection loading function
  const handleLoadCollection = useCallback(async (collectionId, options = {}) => {
    if (!collectionId) {
      console.error('[StreamingAudioContext: handleLoadCollection] No collection ID provided');
      return false;
    }

    try {
      setLoadingCollection(true);
      setCollectionError(null);
      setCollectionLoadProgress(0);

      console.log(`[StreamingAudioContext: handleLoadCollection] Loading collection: ${collectionId}, autoPlay:`,
        options.autoPlay === true ? 'true' : 'false');

      // Pause if currently playing
      if (isPlayingRef.current) {
        await handlePauseSession();
      }

      // Load collection data using CollectionService
      const result = await collectionService.getCollection(collectionId);
      console.log('[StreamingAudioContext: handleLoadCollection] Collection result:', {
        success: result.success,
        id: result.data?.id,
        idType: typeof result.data?.id,
        name: result.data?.name
      });
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to load collection');
      }

      const collection = result.data;
      setCollectionLoadProgress(20);

      // Validate collection has tracks
      if (!collection.tracks || !Array.isArray(collection.tracks) || collection.tracks.length === 0) {
        console.error(`[StreamingAudioContext: handleLoadCollection] Collection "${collectionId}" has no tracks`);
        throw new Error(`Collection "${collection.name || collectionId}" has no audio tracks`);
      }

      console.log(`[StreamingAudioContext: handleLoadCollection] Loaded collection: ${collection.name} with ${collection.tracks.length} tracks`);


      // Format collection for player using CollectionService
      try {

        console.log(`[StreamingAudioContext: handleLoadCollection] About to format collection with ID: "${collection.id}" (${typeof collection.id})`);
        // Use applyConfig parameter (defaults to true) to apply collection-specific configuration
        const formattedCollection = collectionService.formatCollectionForPlayer(collection, { applyConfig: true });


        
        // NEW LOGGING: Log formatted collection config details
        console.log('[StreamingAudioContext: CONFIG] Collection config details for', collectionId);
        console.log(`[StreamingAudioContext: CONFIG] - Session Duration: ${formattedCollection.sessionDuration || 'Not set'}`);
        console.log(`[StreamingAudioContext: CONFIG] - Transition Duration: ${formattedCollection.transitionDuration || 'Not set'}`);

        // Log phase marker details
        if (formattedCollection.phaseMarkers && formattedCollection.phaseMarkers.length > 0) {
          console.log(`[StreamingAudioContext: CONFIG] - Phase Markers: ${formattedCollection.phaseMarkers.length}`);
          formattedCollection.phaseMarkers.forEach(phase => {
            console.log(`[StreamingAudioContext: CONFIG] -- Phase "${phase.name}" (id: ${phase.id}):`);

            if (phase.state?.volumes) {
              console.log(`[StreamingAudioContext: CONFIG] --- Volumes: ${JSON.stringify(phase.state.volumes)}`);
            } else {
              console.log(`[StreamingAudioContext: CONFIG] --- Volumes: None defined`);
            }

            if (phase.state?.activeAudio) {
              console.log(`[StreamingAudioContext: CONFIG] --- Tracks: ${JSON.stringify(phase.state.activeAudio)}`);
            } else {
              console.log(`[StreamingAudioContext: CONFIG] --- Tracks: None defined`);
            }
          });
        } else {
          console.log('[StreamingAudioContext: CONFIG] - No phase markers defined in collection config');
        }

        // Log default volumes
        if (formattedCollection.defaultVolumes) {
          console.log(`[StreamingAudioContext: CONFIG] - Default Volumes: ${JSON.stringify(formattedCollection.defaultVolumes)}`);
        } else {
          console.log('[StreamingAudioContext: CONFIG] - No default volumes defined in collection config');
        }

        // Original collection processing continues
        console.log(`[StreamingAudioContext: handleLoadCollection] Formatted collection:`, {
          id: formattedCollection.id,
          name: formattedCollection.name,
          coverImage: formattedCollection.coverImage,
          layers: Object.keys(formattedCollection.layers || {})
        });

        // Make sure all audio URLs are properly formed for local playback
        Object.entries(formattedCollection.layers).forEach(([layerName, tracks]) => {
          tracks.forEach(track => {
            // Ensure path starts with a forward slash for proper path resolution
            if (track.path && !track.path.startsWith('/')) {
              track.path = '/' + track.path;
            }
            console.log(`[StreamingAudioContext: handleLoadCollection] Track path for ${layerName}: ${track.path}`);
          });
        });

        setCollectionLoadProgress(40);

        // Verify layers were properly formatted
        const hasAnyTracks = Object.values(formattedCollection.layers || {}).some(
          tracks => Array.isArray(tracks) && tracks.length > 0
        );

        if (!hasAnyTracks) {
          console.error('[StreamingAudioContext: handleLoadCollection] No tracks found in formatted collection');
          throw new Error('No compatible audio tracks found in this collection');
        }

        console.log('[StreamingAudioContext: handleLoadCollection] Formatted collection layers:',
          Object.entries(formattedCollection.layers).map(([layer, tracks]) =>
            `${layer}: ${tracks.length} tracks`
          ).join(', ')
        );

        // Update audio library with collection tracks
        setAudioLibrary(prevLibrary => {
          const newLibrary = { ...prevLibrary };

          // Replace each layer's tracks with the ones from the collection
          Object.entries(formattedCollection.layers).forEach(([layerName, tracks]) => {
            console.log(`[StreamingAudioContext: handleLoadCollection] Setting ${tracks.length} tracks for ${layerName}`);

            // Log the actual track IDs and names for debugging
            tracks.forEach(track => {
              console.log(`[StreamingAudioContext: handleLoadCollection] Track: ${track.id} (${track.name})`);
            });

            // Update this layer in the library
            newLibrary[layerName] = [...tracks];
          });

          // Also update the reference for immediate access
          audioLibraryRef.current = { ...newLibrary };

          console.log('[StreamingAudioContext: handleLoadCollection] Updated audioLibrary with collection tracks');
          return newLibrary;
        });

        setCollectionLoadProgress(60);

        // Register new audio elements with AudioCore
        console.log('[StreamingAudioContext: handleLoadCollection] Registering new collection audio with AudioCore');

        // First, get the audio context and master gain node
        const audioCtx = serviceRef.current.audioCore.getContext();
        const masterGain = serviceRef.current.audioCore.getMasterGain();

        // Create a new audio elements structure to register with AudioCore
        const newAudioElements = {};

        // Process each layer and its tracks
        Object.entries(formattedCollection.layers).forEach(([layerName, tracks]) => {
          // Initialize empty object for this layer
          newAudioElements[layerName] = {};

          // Process each track in the layer
          tracks.forEach(track => {
            try {
              console.log(`[StreamingAudioContext: handleLoadCollection] Creating audio element for ${layerName}/${track.id}`);

              // Create new audio element
              const audioElement = new Audio();
              audioElement.preload = "auto";
              audioElement.loop = true;
              audioElement.crossOrigin = "anonymous";
              audioElement.src = track.path;

              // Create media element source
              const source = audioCtx.createMediaElementSource(audioElement);

              // Connect to volume controller
              if (serviceRef.current.volumeController) {
                serviceRef.current.volumeController.connectToLayer(layerName, source, masterGain);
              }

              // Store audio element data
              newAudioElements[layerName][track.id] = {
                element: audioElement,
                source: source,
                track: track,
                isActive: false // Will be set to true when activated
              };

            } catch (error) {
              console.error(`[StreamingAudioContext: handleLoadCollection] Error creating audio element for ${track.id}: ${error.message}`);
            }
          });
        });

        // Register the new audio elements with AudioCore
        if (serviceRef.current.audioCore.registerElements) {
          const registered = serviceRef.current.audioCore.registerElements(newAudioElements);
          console.log('[StreamingAudioContext: handleLoadCollection] AudioCore registration result:', registered);
        } else {
          console.error('[StreamingAudioContext: handleLoadCollection] AudioCore.registerElements is not defined');
        }

        setCollectionLoadProgress(80);

        // Apply configured session and transition duration
        if (formattedCollection.sessionDuration) {
          handleSetSessionDuration(formattedCollection.sessionDuration);
          console.log(`[StreamingAudioContext: handleLoadCollection] Set session duration: ${formattedCollection.sessionDuration}ms`);
        }

        if (formattedCollection.transitionDuration) {
          handleSetTransitionDuration(formattedCollection.transitionDuration);
          console.log(`[StreamingAudioContext: handleLoadCollection] Set transition duration: ${formattedCollection.transitionDuration}ms`);
        }

        // Process and apply phase markers if available
        if (formattedCollection.phaseMarkers && Array.isArray(formattedCollection.phaseMarkers)) {
          // NEW LOGGING: Log phase marker processing
          console.log(`[StreamingAudioContext: PHASES] Processing ${formattedCollection.phaseMarkers.length} phase markers from collection config`);

          // Process each phase marker to ensure track IDs reference actual tracks in the collection
          const processedPhaseMarkers = formattedCollection.phaseMarkers.map(marker => {
            // Create a deep clone of the marker
            const processedMarker = JSON.parse(JSON.stringify(marker));
            console.log(`[StreamingAudioContext: PHASES] Processing phase "${marker.name}" (${marker.id})`);

            // If this phase has state with activeAudio, validate and possibly update track IDs
            if (processedMarker.state && processedMarker.state.activeAudio) {
              console.log(`[StreamingAudioContext: PHASES] -- Validating ${Object.keys(processedMarker.state.activeAudio).length} track references`);

              // For each layer in the phase's activeAudio
              Object.entries(processedMarker.state.activeAudio).forEach(([layer, trackId]) => {
                // Find if this track exists in the collection
                const layerTracks = formattedCollection.layers[layer];
                const trackExists = layerTracks && layerTracks.some(t => t.id === trackId);

                if (!trackExists) {
                  console.warn(`[StreamingAudioContext: PHASES] Phase "${marker.name}" references non-existent track "${trackId}" for layer "${layer}"`);

                  // If the track doesn't exist, use the first track from the layer instead
                  if (layerTracks && layerTracks.length > 0) {
                    const fallbackTrack = layerTracks[0];
                    console.log(`[StreamingAudioContext: PHASES] Using fallback track "${fallbackTrack.id}" for layer "${layer}" in phase "${marker.name}"`);
                    processedMarker.state.activeAudio[layer] = fallbackTrack.id;
                  } else {
                    // If there are no tracks in this layer, remove the entry
                    delete processedMarker.state.activeAudio[layer];
                    console.log(`[StreamingAudioContext: PHASES] Removed entry for layer "${layer}" in phase "${marker.name}" - no tracks available`);
                  }
                } else {
                  console.log(`[StreamingAudioContext: PHASES] -- Valid track reference: ${layer}/${trackId}`);
                }
              });
            } else {
              console.log(`[StreamingAudioContext: PHASES] -- No activeAudio state for phase "${marker.name}"`);
            }

            // Log volumes in the phase state
            if (processedMarker.state && processedMarker.state.volumes) {
              console.log(`[StreamingAudioContext: PHASES] -- Volumes for phase "${marker.name}": ${JSON.stringify(processedMarker.state.volumes)}`);
            }

            return processedMarker;
          });

          // NEW LOGGING: Log phase marker state before updating timeline
          console.log(`[StreamingAudioContext: PHASES] Final processed phase markers (${processedPhaseMarkers.length}):`);
          processedPhaseMarkers.forEach(phase => {
            console.log(`[StreamingAudioContext: PHASES] - Phase "${phase.name}" (${phase.id}) at position ${phase.position}%`);
            if (phase.state) {
              if (phase.state.volumes) {
                console.log(`[StreamingAudioContext: PHASES] -- Volumes: ${JSON.stringify(phase.state.volumes)}`);
              }
              if (phase.state.activeAudio) {
                console.log(`[StreamingAudioContext: PHASES] -- Tracks: ${JSON.stringify(phase.state.activeAudio)}`);
              }
            } else {
              console.log(`[StreamingAudioContext: PHASES] -- No state data defined`);
            }
          });

          // Update timeline phases with the processed markers
          console.log('[StreamingAudioContext: PHASES] Calling handleUpdateTimelinePhases with processed markers');
          handleUpdateTimelinePhases(processedPhaseMarkers);
          console.log(`[StreamingAudioContext: PHASES] Timeline phases updated. Check if these appear in SessionTimeline component.`);
        } else {
          console.log('[StreamingAudioContext: PHASES] No phase markers in collection config to apply');
        }

        // Function to get initial phase state if available
        const getInitialPhaseState = () => {
          if (formattedCollection.phaseMarkers && formattedCollection.phaseMarkers.length > 0) {
            // Find the pre-onset phase (usually the first one)
            const initialPhase = formattedCollection.phaseMarkers.find(p => p.id === 'pre-onset') ||
              formattedCollection.phaseMarkers[0];

            if (initialPhase && initialPhase.state) {
              console.log(`[StreamingAudioContext: INITIAL_STATE] Found initial phase state: ${initialPhase.id}`);
              console.log(`[StreamingAudioContext: INITIAL_STATE] - Phase name: ${initialPhase.name}`);

              if (initialPhase.state.volumes) {
                console.log(`[StreamingAudioContext: INITIAL_STATE] - Volumes: ${JSON.stringify(initialPhase.state.volumes)}`);
              }

              if (initialPhase.state.activeAudio) {
                console.log(`[StreamingAudioContext: INITIAL_STATE] - Tracks: ${JSON.stringify(initialPhase.state.activeAudio)}`);
              }

              return initialPhase.state;
            } else {
              console.log(`[StreamingAudioContext: INITIAL_STATE] Found phase ${initialPhase.id} but it has no state data`);
            }
          } else {
            console.log(`[StreamingAudioContext: INITIAL_STATE] No phase markers found in collection`);
          }
          return null;
        };

        // Get initial phase state if available
        const initialPhaseState = getInitialPhaseState();
        console.log(`[StreamingAudioContext: INITIAL_STATE] Initial phase state available: ${initialPhaseState ? 'YES' : 'NO'}`);

        // Track successful layer loads
        const loadedLayers = {};

        // For each layer, load the appropriate track
        console.log('[StreamingAudioContext: LAYERS] Begin loading tracks for each layer');
        for (const [layerFolder, tracks] of Object.entries(formattedCollection.layers)) {
          if (!tracks || tracks.length === 0) {
            console.log(`[StreamingAudioContext: LAYERS] No tracks for layer: ${layerFolder}`);
            continue;
          }

          try {
            // Determine which track to load in order of precedence:
            // 1. Initial phase state's activeAudio (if available)
            // 2. Collection's defaultActiveAudio (if available)
            // 3. First track in the layer
            let trackToLoad;
            let trackSource = "default";

            // Check initial phase state first
            if (initialPhaseState?.activeAudio && initialPhaseState.activeAudio[layerFolder]) {
              const phaseTrackId = initialPhaseState.activeAudio[layerFolder];
              const phaseTrack = findTrackById(tracks, phaseTrackId);

              if (phaseTrack) {
                trackToLoad = phaseTrack;
                trackSource = "phase state";
                console.log(`[StreamingAudioContext: LAYERS] Using initial phase track for ${layerFolder}: ${trackToLoad.id}`);
              } else {
                console.log(`[StreamingAudioContext: LAYERS] Phase state specified track ${phaseTrackId} for ${layerFolder} but it wasn't found`);
              }
            }

            // If no track from phase state, check collection defaultActiveAudio
            if (!trackToLoad && formattedCollection.defaultActiveAudio && formattedCollection.defaultActiveAudio[layerFolder]) {
              const configTrackId = formattedCollection.defaultActiveAudio[layerFolder];
              const configTrack = findTrackById(tracks, configTrackId);

              if (configTrack) {
                trackToLoad = configTrack;
                trackSource = "collection config";
                console.log(`[StreamingAudioContext: LAYERS] Using configured track for ${layerFolder}: ${trackToLoad.id}`);
              } else {
                console.log(`[StreamingAudioContext: LAYERS] Config specified track ${configTrackId} for ${layerFolder} but it wasn't found`);
              }
            }

            // Fall back to first track if needed
            if (!trackToLoad) {
              trackToLoad = tracks[0];
              trackSource = "fallback";
              console.log(`[StreamingAudioContext: LAYERS] Using first track for ${layerFolder}: ${trackToLoad.id} (fallback)`);
            }

            // Determine volume to use in order of precedence:
            // 1. Initial phase state volumes
            // 2. Collection defaultVolumes
            // 3. Options provided to loadCollection
            // 4. Defaults (Layer 1 on, others off)
            let initialVolume;
            let volumeSource;

            // Use initial phase state volumes if available
            if (initialPhaseState?.volumes && initialPhaseState.volumes[layerFolder] !== undefined) {
              initialVolume = initialPhaseState.volumes[layerFolder];
              volumeSource = "phase state";
              console.log(`[StreamingAudioContext: LAYERS] Using volume from phase state for ${layerFolder}: ${initialVolume}`);
            }
            // Try collection default volumes
            else if (formattedCollection.defaultVolumes && formattedCollection.defaultVolumes[layerFolder] !== undefined) {
              initialVolume = formattedCollection.defaultVolumes[layerFolder];
              volumeSource = "collection config";
              console.log(`[StreamingAudioContext: LAYERS] Using volume from collection config for ${layerFolder}: ${initialVolume}`);
            }
            // Fall back to options or default
            else {
              initialVolume = options.initialVolumes?.[layerFolder] !== undefined
                ? options.initialVolumes[layerFolder]
                : layerFolder === 'Layer 1' ? 0.6 : 0;
              volumeSource = options.initialVolumes?.[layerFolder] !== undefined ? "options" : "fallback";
              console.log(`[StreamingAudioContext: LAYERS] Using ${volumeSource} volume for ${layerFolder}: ${initialVolume}`);
            }

            console.log(`[StreamingAudioContext: LAYERS] Layer ${layerFolder} final setup: track=${trackToLoad.id} (from ${trackSource}), volume=${initialVolume} (from ${volumeSource})`);

            // Set volume for layer
            handleSetVolume(layerFolder, initialVolume, { immediate: true });

            // Load the track
            await handleCrossfadeTo(layerFolder, trackToLoad.id, 100);

            // Track successful load
            loadedLayers[layerFolder] = trackToLoad.id;
            console.log(`[StreamingAudioContext: LAYERS] Successfully loaded layer ${layerFolder}: ${trackToLoad.id} at volume ${initialVolume}`);
          } catch (layerError) {
            console.error(`[StreamingAudioContext: LAYERS] Error loading ${layerFolder}: ${layerError.message}`);
          }
        }

        setCollectionLoadProgress(90);

        // If no layers were loaded successfully, throw an error
        if (Object.keys(loadedLayers).length === 0) {
          throw new Error('Failed to load any audio tracks from this collection');
        }

        console.log(`[StreamingAudioContext: SUMMARY] Successfully loaded ${Object.keys(loadedLayers).length} layers with tracks`);
        console.log(`[StreamingAudioContext: SUMMARY] Loaded layers: ${JSON.stringify(loadedLayers)}`);
        console.log(`[StreamingAudioContext: SUMMARY] Final volumes: ${JSON.stringify(volumes)}`);

        // Only auto-start playback if specifically requested
        const shouldAutoPlay = options.autoPlay === true;
        console.log(`[StreamingAudioContext: handleLoadCollection] Auto-play is ${shouldAutoPlay ? 'ENABLED' : 'DISABLED'}`);

        if (shouldAutoPlay) {
          console.log('[StreamingAudioContext: handleLoadCollection] Auto-starting playback as requested');
          handleStartSession();
        } else {
          console.log('[StreamingAudioContext: handleLoadCollection] Playback not auto-started, waiting for user action');
        }

        setCollectionLoadProgress(100);

        // Set the current collection with the formatted data including any config settings
        console.log('[StreamingAudioContext: handleLoadCollection] Setting currentCollection:', {
          id: formattedCollection.id,
          name: formattedCollection.name,
          coverImage: formattedCollection.coverImage,
          sessionDuration: formattedCollection.sessionDuration,
          transitionDuration: formattedCollection.transitionDuration,
          hasPhaseMarkers: formattedCollection.phaseMarkers?.length > 0
        });

        setCurrentCollection(formattedCollection);

        console.log(`[StreamingAudioContext: handleLoadCollection] Successfully loaded collection: ${collection.name}`);
        console.log(`[StreamingAudioContext: handleLoadCollection] Cover image URL: ${formattedCollection.coverImage}`);
        return true;
      } catch (formatError) {
        console.error(`[StreamingAudioContext: handleLoadCollection] Error formatting collection: ${formatError.message}`);
        throw new Error(`Error preparing collection audio: ${formatError.message}`);
      }
    } catch (err) {
      console.error(`[StreamingAudioContext: handleLoadCollection] Error: ${err.message}`);
      setCollectionError(err.message);
      return false;
    } finally {
      setLoadingCollection(false);
    }
  }, [
    handleSetVolume,
    handleCrossfadeTo,
    handleStartSession,
    handlePauseSession,
    handleSetSessionDuration,
    handleSetTransitionDuration,
    handleUpdateTimelinePhases,
    collectionService,
    audioFileService,
    volumes // Added volumes to dependencies for logging the current state
  ]);

  const handleSwitchTrack = useCallback((layerFolder, trackId, options = {}) => {
    const { transitionDuration = 2000 } = options;

    if (!layerFolder || !trackId) {
      console.error('[StreamingAudioContext: handleSwitchTrack] Layer folder and track ID required');
      return false;
    }

    try {
      return handleCrossfadeTo(layerFolder, trackId, transitionDuration);
    } catch (err) {
      console.error(`[StreamingAudioContext: handleSwitchTrack] Error switching track: ${err.message}`);
      return false;
    }
  }, [handleCrossfadeTo]);

  // Fade volume for a specific layer
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
     // console.log(`[StreamingAudioContext] Fade progress for ${layerId}: ${Math.round(progress * 100)}% - Volume: ${Math.round(currentValue * 100)}%`);
    };

    // Call the service method with progress callback
    return serviceRef.current.volumeController.fadeVolume(layer, targetVolume, durationSec, progressCallback);
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
      activePhase,
      progress,
      timelineEvents,
      timelinePhases,
      activePhase,
      progress,
      sessionDuration,
      transitionDuration,
      timelineIsPlaying,
      resetTimelineEventIndex: handleResetTimelineEventIndex,
      registerTimelineEvent: handleRegisterTimelineEvent,
      clearTimelineEvents: handleClearTimelineEvents,
      updateTimelinePhases: handleUpdateTimelinePhases,
      seekToTime: handleSeekToTime,
      seekToPercent: handleSeekToPercent,
      setSessionDuration: handleSetSessionDuration,
      setTransitionDuration: handleSetTransitionDuration,
      startTimeline: handleStartTimeline,
      pauseTimeline: handlePauseTimeline,
      resumeTimeline: handleResumeTimeline,
      stopTimeline: handleStopTimeline,





      // Constants
      LAYERS,

      // Collection state
      collections,
      currentCollection,
      isLoadingCollections,
      collectionsError,
      collectionLoadProgress,
      collectionError,

      // Collection functions
      loadCollections,
      loadCollection: handleLoadCollection,
      switchTrack: handleSwitchTrack,
    };
  }, [
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


    // Collection state
    collections,
    currentCollection,
    isLoadingCollections,
    collectionsError,
    collectionLoadProgress,
    collectionError,
    loadCollections,
    handleLoadCollection,
    handleSwitchTrack
  ]);

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  );
};

export default AudioContext;