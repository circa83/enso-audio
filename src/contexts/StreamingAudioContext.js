// src/contexts/StreamingAudioContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AudioCore from '../services/audio/AudioCore';
import BufferManager from '../services/audio/BufferManager';
import CrossfadeEngine from '../services/audio/CrossfadeEngine';
import VolumeController from '../services/audio/VolumeController';

// Define our audio layers
const LAYERS = {
  DRONE: 'drone',
  MELODY: 'melody',
  RHYTHM: 'rhythm',
  NATURE: 'nature'
};

// Default audio files for each layer
const DEFAULT_AUDIO = {
  [LAYERS.DRONE]: '/samples/default/drone.mp3',
  [LAYERS.MELODY]: '/samples/default/melody.mp3',
  [LAYERS.RHYTHM]: '/samples/default/rhythm.mp3',
  [LAYERS.NATURE]: '/samples/default/nature.mp3'
};

// Create the context
const AudioContext = createContext();

// Custom hook for using the audio context
export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

export const AudioProvider = ({ children }) => {
  // Core services
  const audioCoreRef = useRef(null);
  const bufferManagerRef = useRef(null);
  const crossfadeEngineRef = useRef(null);
  const volumeControllerRef = useRef(null);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Track currently active audio elements for each layer
  const [activeAudio, setActiveAudio] = useState({});
  
  // Master volume control
  const [masterVolume, setMasterVolume] = useState(0.8);
  
  // Store all audio elements (active and preloaded)
  const [audioElements, setAudioElements] = useState({
    [LAYERS.DRONE]: {},
    [LAYERS.MELODY]: {},
    [LAYERS.RHYTHM]: {},
    [LAYERS.NATURE]: {}
  });
  
  // Audio library - will start with default full files
  const [audioLibrary, setAudioLibrary] = useState({
    [LAYERS.DRONE]: [],
    [LAYERS.MELODY]: [],
    [LAYERS.RHYTHM]: {},
    [LAYERS.NATURE]: {}
  });
  
  // Volume levels for each layer (0-1) - Now managed by VolumeController
  const [volumes, setVolumes] = useState({
    [LAYERS.DRONE]: 0.25,
    [LAYERS.MELODY]: 0.0,
    [LAYERS.RHYTHM]: 0.0,
    [LAYERS.NATURE]: 0.0
  });

  // Session state
  const [isPlaying, setIsPlaying] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  
  // Feature availability state
  const [hasSwitchableAudio, setHasSwitchableAudio] = useState(false);

  // Add a ref to track the actual playing state to prevent race conditions
  const isPlayingRef = useRef(false);
  
  // Crossfade state tracking for UI feedback (now managed by CrossfadeEngine)
  const [crossfadeProgress, setCrossfadeProgress] = useState({});
  const [activeCrossfades, setActiveCrossfades] = useState({});
  
  // Track metadata for all loaded tracks (duration, etc.)
  const trackData = useRef({});
  
  // Currently loaded audio files tracking
  const loadedFiles = useRef(new Set());
  
  // Track audio loading progress for preloading
  const [preloadProgress, setPreloadProgress] = useState({});
  
  // Timeline events state
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [nextEventIndex, setNextEventIndex] = useState(0);
  const timelineCheckInterval = useRef(null);

  // Presets storage
  const [presets, setPresets] = useState({});
  
  // Timeline phases tracking for presets
  const [timelinePhases, setTimelinePhases] = useState([]);
  
  // State providers for different components
  const stateProviders = useRef({});
  
  // Initialize the Audio Services
  useEffect(() => {
    const initializeAudioServices = async () => {
      if (typeof window !== 'undefined') {
        try {
          // Initialize AudioCore if it doesn't exist
          if (!audioCoreRef.current) {
            console.log('Creating new AudioCore instance');
            audioCoreRef.current = new AudioCore({ 
              initialVolume: masterVolume,
              autoResume: true
            });
          }
          
          // Initialize AudioCore
          const success = await audioCoreRef.current.initialize();
          if (!success) {
            throw new Error('Failed to initialize AudioCore');
          }
          
          // Initialize BufferManager after AudioCore is ready
          if (!bufferManagerRef.current && audioCoreRef.current.getContext()) {
            console.log('Creating new BufferManager instance');
            bufferManagerRef.current = new BufferManager({
              audioContext: audioCoreRef.current.getContext(),
              enableLogging: true
            });
          }
          
          // Initialize VolumeController
          if (!volumeControllerRef.current && audioCoreRef.current.getContext()) {
            console.log('Creating new VolumeController instance');
            volumeControllerRef.current = new VolumeController({
              audioContext: audioCoreRef.current.getContext(),
              initialVolumes: volumes,
              enableLogging: true
            });
          }
          
          // Initialize CrossfadeEngine after AudioCore is ready
          if (!crossfadeEngineRef.current && audioCoreRef.current.getContext() && audioCoreRef.current.getMasterGain()) {
            console.log('Creating new CrossfadeEngine instance');
            crossfadeEngineRef.current = new CrossfadeEngine({
              audioContext: audioCoreRef.current.getContext(),
              destination: audioCoreRef.current.getMasterGain(),
              enableLogging: true,
              onProgress: (layer, progress) => {
                // Update UI state with progress from CrossfadeEngine
                setCrossfadeProgress(prev => ({
                  ...prev,
                  [layer]: progress
                }));
              }
            });
          }
          
          // Update loading progress
          setLoadingProgress(10);
          
          // Initialize with default audio
          await initializeDefaultAudio();
          
          // Check if variation files available (in background)
          tryLoadVariationFiles();

          // Load presets from localStorage if available
          try {
            const savedPresets = localStorage.getItem('ensoAudioPresets');
            if (savedPresets) {
              setPresets(JSON.parse(savedPresets));
            }
          } catch (e) {
            console.warn('Failed to load presets from localStorage:', e);
          }
          
        } catch (error) {
          console.error("Error initializing audio system:", error);
          // Force loading to complete anyway so UI doesn't get stuck
          setLoadingProgress(100);
          setIsLoading(false);
        }
      }
    };
    
    initializeAudioServices();
    
    return () => {
      // Clean up AudioCore
      if (audioCoreRef.current) {
        audioCoreRef.current.cleanup();
        audioCoreRef.current = null;
      }
      
      // Clean up BufferManager
      if (bufferManagerRef.current) {
        bufferManagerRef.current.dispose();
        bufferManagerRef.current = null;
      }
      
      // Clean up CrossfadeEngine
      if (crossfadeEngineRef.current) {
        crossfadeEngineRef.current.dispose();
        crossfadeEngineRef.current = null;
      }
      
      // Clean up VolumeController
      if (volumeControllerRef.current) {
        volumeControllerRef.current.dispose();
        volumeControllerRef.current = null;
      }
    };
  }, []);

  // Update master volume in AudioCore when masterVolume state changes
  useEffect(() => {
    if (audioCoreRef.current) {
      audioCoreRef.current.setMasterVolume(masterVolume);
    }
  }, [masterVolume]);

  // Try to load variation files in background
  const tryLoadVariationFiles = () => {
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
    }, 1000); // Delay this check to not interfere with main loading
  };

  // Initialize audio elements with default tracks
  const initializeDefaultAudio = async () => {
    if (!audioCoreRef.current || !bufferManagerRef.current || !volumeControllerRef.current) {
      console.error('Cannot initialize audio, services not ready');
      return false;
    }

    const audioCtx = audioCoreRef.current.getContext();
    const masterGain = audioCoreRef.current.getMasterGain();
    
    const totalFiles = Object.values(LAYERS).length;
    let loadedFilesCount = 0;
    
    const newActiveAudio = {};
    const newAudioElements = { 
      [LAYERS.DRONE]: {},
      [LAYERS.MELODY]: {},
      [LAYERS.RHYTHM]: {},
      [LAYERS.NATURE]: {}
    };
    
    // Build initial basic library
    const basicLibrary = {};
    Object.values(LAYERS).forEach(layer => {
      basicLibrary[layer] = [{
        id: `${layer}1`,
        name: `${layer.charAt(0).toUpperCase() + layer.slice(1)}`,
        path: DEFAULT_AUDIO[layer]
      }];
    });
    
    // Update audio library state
    setAudioLibrary(basicLibrary);
    
    // Update progress to show we're starting to load
    setLoadingProgress(20);
    
    // For each layer, create and load the default audio element
    for (const layer of Object.values(LAYERS)) {
      // Always use the first track as default
      const defaultTrack = basicLibrary[layer][0];
      
      try {
        // Create new audio element
        const audioElement = new Audio();
        
        // Set up load handler before setting src
        const loadPromise = new Promise((resolve) => {
          // Set up handlers for this audio element
          const loadHandler = () => {
            loadedFilesCount++;
            const progress = Math.round((loadedFilesCount / totalFiles) * 80) + 20; // Start at 20%, go up to 100%
            setLoadingProgress(progress);
            console.log(`Loaded audio for ${layer}, progress: ${progress}%`);
            
            // Store metadata about the track using BufferManager
            if (audioElement.duration && audioElement.duration > 0) {
              trackData.current[defaultTrack.id] = {
                duration: audioElement.duration,
                loaded: true
              };
              // Also add to loaded files set
              loadedFiles.current.add(defaultTrack.id);
            }
            
            resolve();
          };
          
          // Set up event listeners for loading
          audioElement.addEventListener('canplaythrough', loadHandler, { once: true });
          
          // Also handle errors, still increment progress
          audioElement.addEventListener('error', (e) => {
            console.error(`Error loading audio for ${layer}:`, e);
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
        
        // Now set the source
        audioElement.src = defaultTrack.path;
        audioElement.loop = true;
        audioElement.load(); // Start loading
        
        // Create media element source
        const source = audioCtx.createMediaElementSource(audioElement);
        
        // Connect source to volume controller
        // This replaces the direct connection to gain nodes
        volumeControllerRef.current.connectToLayer(layer, source, masterGain);
        
        // Store the audio element and its source
        newAudioElements[layer][defaultTrack.id] = {
          element: audioElement,
          source: source,
          track: defaultTrack,
          isActive: true
        };
        
        // Set as active audio for this layer
        newActiveAudio[layer] = defaultTrack.id;
        
        // Wait for this layer to load
        await loadPromise;
        
      } catch (error) {
        console.error(`Error initializing audio for layer ${layer}:`, error);
        // Increment progress anyway to avoid getting stuck
        loadedFilesCount++;
        const progress = Math.round((loadedFilesCount / totalFiles) * 80) + 20;
        setLoadingProgress(progress);
      }
    }
    
    // Update state with loaded audio
    setAudioElements(newAudioElements);
    setActiveAudio(newActiveAudio);
    setIsLoading(false);
    setLoadingProgress(100);
    console.log("All audio loaded successfully");
    
    return true;
  };

  // Update master volume using AudioCore
  const setMasterVolumeLevel = useCallback((value) => {
    if (!audioCoreRef.current) return;
    
    setMasterVolume(value);
    audioCoreRef.current.setMasterVolume(value);
  }, []);

  // Function to safely set playing state
  const updatePlayingState = useCallback((newState) => {
    console.log(`Updating playing state to: ${newState}`);
    // Update the ref immediately (sync)
    isPlayingRef.current = newState;
    // Update the React state (async)
    setIsPlaying(newState);
  }, []);

  // Start the session
  const startSession = useCallback(() => {
    // Use ref for current state check to avoid race conditions
    if (!audioCoreRef.current || isPlayingRef.current) {
      console.log("Can't start: AudioCore missing or already playing");
      return;
    }
    
    try {
      console.log("Starting session...");
      
      // Resume AudioCore
      audioCoreRef.current.resume().catch(err => {
        console.error('Error resuming audio context:', err);
      });
      
      // Make sure all audio elements are reset to beginning
      Object.entries(activeAudio).forEach(([layer, trackId]) => {
        const track = audioElements[layer][trackId];
        if (track && track.element) {
          // Reset to beginning of track
          track.element.currentTime = 0;
        }
      });
      
      // Play all active audio elements
      let allPlayPromises = [];
      
      Object.entries(activeAudio).forEach(([layer, trackId]) => {
        const track = audioElements[layer][trackId];
        if (track && track.element) {
          console.log(`Playing audio for ${layer}`);
          
          // Play and collect the promise
          try {
            const playPromise = track.element.play();
            if (playPromise !== undefined) {
              allPlayPromises.push(
                playPromise.catch(err => {
                  console.error(`Error playing ${layer}:`, err);
                  return null; // Convert rejected promises to null
                })
              );
            }
          } catch (err) {
            console.error(`Error starting ${layer}:`, err);
          }
        }
      });
      
      // Wait for all play operations to complete
      Promise.all(allPlayPromises)
        .then(() => {
          // Only if we're still in a consistent state
          if (!isPlayingRef.current) {
            console.log("All tracks started, updating state");
            updatePlayingState(true);
            setSessionStartTime(Date.now());
          } else {
            console.log("State already updated to playing");
          }
        })
        .catch(error => {
          console.error('Error in play promises:', error);
          // Try to update state anyway
          updatePlayingState(true);
          setSessionStartTime(Date.now());
        });
      
      // Set state immediately as a fallback
      // This helps with UI responsiveness
      if (!isPlayingRef.current) {
        console.log("Setting playing state immediately");
        updatePlayingState(true);
        setSessionStartTime(Date.now());
      }
      
      // Reset the timeline event index when starting a new session
      resetTimelineEventIndex();
      
    } catch (error) {
      console.error('Error starting session:', error);
      // Reset state if we hit an error
      updatePlayingState(false);
    }
  }, [audioElements, activeAudio, updatePlayingState]);

  // Pause/Stop session
  const pauseSession = useCallback(() => {
    // Use ref for current state check to avoid race conditions
    if (!isPlayingRef.current && !crossfadeEngineRef.current?.getAllActiveCrossfades()) {
      console.log("Not playing, nothing to pause");
      return;
    }
    
    try {
      console.log("Pausing session (including any active crossfades)...");
      
      // First, cancel any active crossfades
      if (crossfadeEngineRef.current) {
        crossfadeEngineRef.current.cancelAllCrossfades({
          reconnectSource: true,
          reconnectTarget: true
        });
      }
      
      // Clear UI state for crossfades
      setActiveCrossfades({});
      setCrossfadeProgress({});
      
      // Pause all active audio elements
      let pauseCount = 0;
      let totalTracks = 0;
      
      Object.entries(activeAudio).forEach(([layer, trackId]) => {
        const track = audioElements[layer][trackId];
        if (track && track.element) {
          totalTracks++;
          
          try {
            track.element.pause();
            pauseCount++;
            console.log(`Paused audio for ${layer}`);
          } catch (err) {
            console.error(`Error pausing ${layer}:`, err);
          }
        }
      });
      
      console.log(`Paused ${pauseCount} of ${totalTracks} tracks`);
      
      // Suspend the AudioCore context
      if (audioCoreRef.current) {
        audioCoreRef.current.suspend().catch(err => {
          console.warn('Error suspending audio context:', err);
        });
      }
      
      // Update state immediately
      updatePlayingState(false);
      
      // Double-check state with timeout to make sure it sticks
      setTimeout(() => {
        if (isPlayingRef.current === true) {
          console.log("State reverting detected, forcing pause state");
          updatePlayingState(false);
        }
      }, 100);
    } catch (error) {
      console.error('Error pausing session:', error);
      // Still try to update state even if an error occurs
      updatePlayingState(false);
    }
  }, [activeAudio, audioElements, updatePlayingState]);

  // Update volume for a layer - Now uses VolumeController
  const setVolume = useCallback((layer, value) => {
    if (!volumeControllerRef.current) return;
    
    // Update our local state for UI
    setVolumes(prev => ({
      ...prev,
      [layer]: value
    }));
    
    // Apply volume using the VolumeController
    volumeControllerRef.current.setVolume(layer, value);
    
    // If there's an active crossfade for this layer, update its volume too
    if (crossfadeEngineRef.current && crossfadeEngineRef.current.isActive(layer)) {
      crossfadeEngineRef.current.adjustCrossfadeVolume(layer, value);
    }
  }, []);

  // Preload audio using BufferManager
  const preloadAudio = useCallback(async (layer, trackId) => {
    if (!bufferManagerRef.current) {
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
      await bufferManagerRef.current.loadAudioBuffer(track.path, {
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

  // Enhanced crossfade function using CrossfadeEngine service
  const enhancedCrossfadeTo = useCallback(async (layer, newTrackId, fadeDuration = 4000) => {
    console.log(`🎵 Starting crossfade process for ${layer}: ${newTrackId}`);
    
    // Verify we have what we need
    if (!audioCoreRef.current || !volumeControllerRef.current || !crossfadeEngineRef.current) {
      console.error("Cannot crossfade: missing required services");
      return false;
    }
    
    const audioCtx = audioCoreRef.current.getContext();
    const masterGain = audioCoreRef.current.getMasterGain();
    
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
        let trackElements = null;
        
        if (audioElements[layer]?.[newTrackId]?.element && 
            audioElements[layer][newTrackId].source) {
          trackElements = audioElements[layer][newTrackId];
        } else {
          // Create and load the track if needed
          const audioElement = new Audio();
          audioElement.preload = "auto";
          audioElement.loop = true;
          audioElement.src = track.path;
          
          // Create source node
          const source = audioCtx.createMediaElementSource(audioElement);
          
          // Connect to VolumeController instead of direct gain node
          volumeControllerRef.current.connectToLayer(layer, source, masterGain);
          
          // Store the new track
          trackElements = {
            element: audioElement,
            source: source,
            track: track,
            isActive: false
          };
          
          // Update the audio elements state
          setAudioElements(prev => ({
            ...prev,
            [layer]: {
              ...prev[layer],
              [newTrackId]: trackElements
            }
          }));
          
          // Update loaded files tracking
          trackData.current[newTrackId] = {
            duration: 300, // Default duration
            loaded: true
          };
          loadedFiles.current.add(newTrackId);
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
    let newTrackElements = null;
    
    // First check if it's already available in state
    if (audioElements[layer]?.[newTrackId]?.element && 
        audioElements[layer][newTrackId].source) {
      console.log(`Track ${newTrackId} already loaded, using existing elements`);
      newTrackElements = audioElements[layer][newTrackId];
    } else {
      console.log(`Track ${newTrackId} needs loading, preparing now...`);
      
      // Find the track in the library
      const track = audioLibrary[layer].find(t => t.id === newTrackId);
      if (!track) {
        console.error(`Track ${newTrackId} not found in library`);
        
        // Reset crossfade state
        setActiveCrossfades(prev => ({
          ...prev,
          [layer]: null
        }));
        
        return false;
      }
      
      try {
        // Use BufferManager for loading with progress tracking
        await preloadAudio(layer, newTrackId);
        
        // Create the audio element
        const audioElement = new Audio();
        audioElement.preload = "auto";
        audioElement.loop = true;
        audioElement.src = track.path;
        
        // Create the source node after loading
        const source = audioCtx.createMediaElementSource(audioElement);
        
        // Connect to VolumeController instead of direct gain node
        volumeControllerRef.current.connectToLayer(layer, source, masterGain);
        
        // Create the track elements
        newTrackElements = {
          element: audioElement,
          source: source,
          track: track,
          isActive: false
        };
        
        // Update the audio elements state
        setAudioElements(prev => ({
          ...prev,
          [layer]: {
            ...prev[layer],
            [newTrackId]: newTrackElements
          }
        }));
      } catch (error) {
        console.error(`Error preparing track ${newTrackId}: ${error.message}`);
        
        // Reset crossfade state
        setActiveCrossfades(prev => ({
          ...prev,
          [layer]: null
        }));
        
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
    const currentTrack = audioElements[layer][currentTrackId];
    
    // Get the current volume for the layer from VolumeController
    const currentVolume = volumeControllerRef.current.getVolume(layer);
    
    // Prepare crossfade options
    const crossfadeOptions = {
      layer,
      sourceNode: currentTrack.source,
      sourceElement: currentTrack.element,
      targetNode: newTrackElements.source,
      targetElement: newTrackElements.element,
      currentVolume: currentVolume, // Use volume from VolumeController
      duration: fadeDuration,
      syncPosition: true,
      metadata: {
        fromTrackId: currentTrackId,
        toTrackId: newTrackId
      }
    };
    
    try {
      // Update active track state - do this before the crossfade
      // because we want UI to show new track immediately
      setActiveAudio(prev => ({
        ...prev,
        [layer]: newTrackId
      }));
      
      // Execute the crossfade with the CrossfadeEngine
      const success = await crossfadeEngineRef.current.crossfade(crossfadeOptions);
      
      // When crossfade completes, check if successful
      if (!success) {
        console.error(`Crossfade failed for ${layer}`);
        
        // Even though it failed, we'll keep the new track as active
        // but we'll clear the UI state
        setActiveCrossfades(prev => {
          const newState = {...prev};
          delete newState[layer];
          return newState;
        });
        
        return false;
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
  }, [
    audioLibrary, 
    activeAudio, 
    audioElements, 
    isPlayingRef, 
    preloadAudio
  ]);

 // Calculate elapsed session time
 const getSessionTime = useCallback(() => {
  if (!sessionStartTime) return 0;
  return isPlayingRef.current ? Date.now() - sessionStartTime : 0;
}, [sessionStartTime]);

// Timeline event handling 
const resetTimelineEventIndex = useCallback(() => {
  setNextEventIndex(0);
}, []);

// Add function to register a timeline event
const registerTimelineEvent = useCallback((event) => {
  setTimelineEvents(prev => {
    // Add the new event and sort by time
    const updatedEvents = [...prev, event].sort((a, b) => a.time - b.time);
    return updatedEvents;
  });
}, []);

// Add function to clear timeline events
const clearTimelineEvents = useCallback(() => {
  setTimelineEvents([]);
  setNextEventIndex(0);
}, []);

// Timeline event handling effect
useEffect(() => {
  if (isPlaying && timelineEvents.length > 0) {
    // Start checking for timeline events
    timelineCheckInterval.current = setInterval(() => {
      const currentTime = getSessionTime();
      
      // Check if we need to trigger the next event
      if (nextEventIndex < timelineEvents.length) {
        const nextEvent = timelineEvents[nextEventIndex];
        
        if (currentTime >= nextEvent.time) {
          console.log(`Triggering timeline event: ${nextEvent.name}`);
          
          // Execute the event action
          if (nextEvent.action === 'crossfade' && nextEvent.layerSettings) {
            // Handle crossfade events
            Object.entries(nextEvent.layerSettings).forEach(([layer, settings]) => {
              if (settings.trackId) {
                enhancedCrossfadeTo(layer, settings.trackId, settings.duration || 4000);
              }
              
              if (settings.volume !== undefined) {
                setVolume(layer, settings.volume);
              }
            });
          }
          
          // Move to the next event
          setNextEventIndex(nextEventIndex + 1);
        }
      }
    }, 1000); // Check every second
  } else {
    // Clear interval when not playing
    if (timelineCheckInterval.current) {
      clearInterval(timelineCheckInterval.current);
    }
  }
  
  return () => {
    if (timelineCheckInterval.current) {
      clearInterval(timelineCheckInterval.current);
    }
  };
}, [isPlaying, timelineEvents, nextEventIndex, getSessionTime, enhancedCrossfadeTo, setVolume]);

// Function to update timeline phases (called from SessionTimeline)
const updateTimelinePhases = useCallback((phases) => {
  if (!phases || !Array.isArray(phases)) return;
  setTimelinePhases(phases);
}, []);

// Function to register state providers for different components
const registerPresetStateProvider = useCallback((key, providerFn) => {
  if (!key) return;
  
  if (providerFn === null) {
    // Unregister provider
    delete stateProviders.current[key];
  } else {
    // Register provider
    stateProviders.current[key] = providerFn;
  }
}, []);

// Save current state as a preset
const savePreset = useCallback((name) => {
  if (!name || name.trim() === '') return false;
  
  // Collect state from all registered providers
  const componentStates = {};
  Object.entries(stateProviders.current).forEach(([key, providerFn]) => {
    try {
      const state = providerFn();
      if (state) {
        componentStates[key] = state;
      }
    } catch (error) {
      console.error(`Error getting state from provider ${key}:`, error);
    }
  });
  
  // Create the preset with all state data
  const preset = {
    name,
    date: new Date().toISOString(),
    state: {
      volumes: { ...volumes },
      activeAudio: { ...activeAudio },
      timelineEvents: [...timelineEvents],
      components: componentStates,
      timelinePhases: [...timelinePhases]
    }
  };
  
  setPresets(prev => {
    const newPresets = {
      ...prev,
      [name]: preset
    };
    
    // Store in localStorage
    try {
      localStorage.setItem('ensoAudioPresets', JSON.stringify(newPresets));
    } catch (e) {
      console.warn('Could not save presets to localStorage:', e);
    }
    
    return newPresets;
  });
  
  return true;
}, [volumes, activeAudio, timelineEvents, timelinePhases]);

// Load a saved preset
const loadPreset = useCallback((name) => {
  const preset = presets[name];
  if (!preset) return false;
  
  // Apply the preset state
  if (preset.state.volumes) {
    Object.entries(preset.state.volumes).forEach(([layer, vol]) => {
      setVolume(layer, vol);
    });
  }
  
  if (preset.state.activeAudio) {
    // Load all track changes without crossfade (immediate)
    Object.entries(preset.state.activeAudio).forEach(([layer, trackId]) => {
      enhancedCrossfadeTo(layer, trackId, 0);
    });
  }
  
  if (preset.state.timelineEvents) {
    setTimelineEvents(preset.state.timelineEvents);
    setNextEventIndex(0);
  }
  
  // Apply timeline phases if they exist
  if (preset.state.timelinePhases && preset.state.timelinePhases.length > 0) {
    setTimelinePhases(preset.state.timelinePhases);
    
    // Dispatch event to notify the timeline component
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('timeline-update', { 
        detail: { 
          phases: preset.state.timelinePhases,
          sessionDuration: preset.state.components?.timeline?.sessionDuration
        } 
      });
      window.dispatchEvent(event);
    }
  }
  
  // Apply component-specific states
  if (preset.state.components) {
    Object.entries(preset.state.components).forEach(([componentKey, state]) => {
      // Dispatch custom events for each component to handle its own state
      if (typeof window !== 'undefined') {
        const event = new CustomEvent(`${componentKey}-update`, { detail: state });
        window.dispatchEvent(event);
      }
    });
  }
  
  return true;
}, [presets, setVolume, enhancedCrossfadeTo]);

// Delete a preset
const deletePreset = useCallback((name) => {
  setPresets(prev => {
    const newPresets = { ...prev };
    delete newPresets[name];
    
    // Update localStorage
    try {
      localStorage.setItem('ensoAudioPresets', JSON.stringify(newPresets));
    } catch (e) {
      console.warn('Could not update presets in localStorage:', e);
    }
    
    return newPresets;
  });
  
  return true;
}, []);

// Get all available presets
const getPresets = useCallback(() => {
  return Object.values(presets).sort((a, b) => 
    new Date(b.date) - new Date(a.date)
  );
}, [presets]);

// Export a preset to a JSON string
const exportPreset = useCallback((name) => {
  const preset = presets[name];
  if (!preset) return null;
  
  return JSON.stringify(preset);
}, [presets]);

// Import a preset from a JSON string
const importPreset = useCallback((jsonString) => {
  try {
    const preset = JSON.parse(jsonString);
    
    // Validate the preset format
    if (!preset.name || !preset.state) {
      return { success: false, error: 'Invalid preset format' };
    }
    
    // Add to presets
    setPresets(prev => {
      const newPresets = {
        ...prev,
        [preset.name]: {
          ...preset,
          date: new Date().toISOString() // Update the date
        }
      };
      
      // Update localStorage
      try {
        localStorage.setItem('ensoAudioPresets', JSON.stringify(newPresets));
      } catch (e) {
        console.warn('Could not save imported preset to localStorage:', e);
      }
      
      return newPresets;
    });
    
    return { success: true, name: preset.name };
  } catch (e) {
    return { success: false, error: `Error importing preset: ${e.message}` };
  }
}, []);

// Test function for crossfade
const testCrossfade = useCallback(async () => {
  if (!hasSwitchableAudio) {
    console.log("Switchable audio not available for testing");
    return false;
  }
  
  // First start playback if not already playing
  if (!isPlayingRef.current) {
    await startSession();
    // Wait for playback to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Test each layer
  for (const layer of Object.values(LAYERS)) {
    const tracks = audioLibrary[layer];
    if (!Array.isArray(tracks) || tracks.length < 2) continue;
    
    // Get current track ID
    const currentTrackId = activeAudio[layer];
    
    // Find a different track to test
    const nextTrack = tracks.find(t => t.id !== currentTrackId);
    if (!nextTrack) continue;
    
    console.log(`Testing crossfade for ${layer}: ${currentTrackId} -> ${nextTrack.id}`);
    
    // Perform crossfade
    await enhancedCrossfadeTo(layer, nextTrack.id, 3000);
    
    // Wait for crossfade to complete
    await new Promise(resolve => setTimeout(resolve, 3500));
    
    // Crossfade back
    console.log(`Crossfading back: ${nextTrack.id} -> ${currentTrackId}`);
    await enhancedCrossfadeTo(layer, currentTrackId, 3000);
    
    // Wait between layer tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log("Crossfade test complete");
  return true;
}, [audioLibrary, activeAudio, hasSwitchableAudio, startSession, enhancedCrossfadeTo, isPlayingRef]);

// Create the context value with all the functionality
const contextValue = useMemo(() => ({
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
  setMasterVolumeLevel,
  
  // Audio controls
  setVolume,
  startSession,
  pauseSession,
  crossfadeTo: enhancedCrossfadeTo, 
  preloadAudio,
  getSessionTime,
  testCrossfade,
  
  // Timeline event functions
  timelineEvents,
  registerTimelineEvent,
  clearTimelineEvents,
  resetTimelineEventIndex,
  
  // Timeline phase functions
  updateTimelinePhases,
  registerPresetStateProvider,
  timelinePhases,
  
  // Preset management
  savePreset,
  loadPreset,
  deletePreset,
  getPresets,
  exportPreset,
  importPreset,
  
  // Constants
  LAYERS
}), [
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
  setMasterVolumeLevel,
  setVolume, 
  startSession, 
  pauseSession, 
  enhancedCrossfadeTo,
  preloadAudio,
  getSessionTime,
  testCrossfade,
  timelineEvents,
  registerTimelineEvent,
  clearTimelineEvents,
  resetTimelineEventIndex,
  updateTimelinePhases,
  registerPresetStateProvider,
  timelinePhases,
  savePreset,
  loadPreset,
  deletePreset,
  getPresets,
  exportPreset,
  importPreset
]);

return (
  <AudioContext.Provider value={contextValue}>
    {children}
  </AudioContext.Provider>
);
};

export default AudioContext;