// src/contexts/StreamingAudioContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';

// Define our audio layers
const LAYERS = {
  DRONE: 'drone',
  MELODY: 'melody',
  RHYTHM: 'rhythm',
  NATURE: 'nature'
};

// Default audio files for each layer - using the new default folder structure
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
  // Web Audio API context
  const [audioCtx, setAudioCtx] = useState(null);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Track currently active audio elements for each layer
  const [activeAudio, setActiveAudio] = useState({});
  
  // Store gain nodes for each layer
  const [gainNodes, setGainNodes] = useState({});
  
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
    [LAYERS.RHYTHM]: [],
    [LAYERS.NATURE]: []
  });
  
  // Volume levels for each layer (0-1)
  const [volumes, setVolumes] = useState({
    [LAYERS.DRONE]: 0.7,
    [LAYERS.MELODY]: 0.5,
    [LAYERS.RHYTHM]: 0.4,
    [LAYERS.NATURE]: 0.6
  });

  // Session state
  const [isPlaying, setIsPlaying] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  
  // Feature availability state
  const [hasSwitchableAudio, setHasSwitchableAudio] = useState(false);

  // Add a ref to track the actual playing state to prevent race conditions
  const isPlayingRef = useRef(false);
  
  // Initialize the Web Audio API context
  useEffect(() => {
    const initAudioContext = async () => {
      if (typeof window !== 'undefined') {
        try {
          // Create new AudioContext
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          setAudioCtx(ctx);
          
          // Create gain nodes for each layer
          const nodes = {};
          Object.values(LAYERS).forEach(layer => {
            nodes[layer] = ctx.createGain();
            nodes[layer].connect(ctx.destination);
          });
          setGainNodes(nodes);
          
          // Initialize audio library with basic version
          const basicLibrary = {};
          
          Object.values(LAYERS).forEach(layer => {
            basicLibrary[layer] = [{
              id: `${layer}1`,
              name: `${layer.charAt(0).toUpperCase() + layer.slice(1)}`,
              path: DEFAULT_AUDIO[layer]
            }];
          });
          
          setAudioLibrary(basicLibrary);
          
          // Force progress update
          setLoadingProgress(10);
          
          // Initialize with default audio (this always works)
          await initializeDefaultAudio(basicLibrary, ctx, nodes);
          
          // Check if variation files available (in background)
          tryLoadVariationFiles();
        } catch (error) {
          console.error("Error initializing audio context:", error);
          // Force loading to complete anyway so UI doesn't get stuck
          setLoadingProgress(100);
          setIsLoading(false);
        }
      }
    };
    
    initAudioContext();
    
    return () => {
      // Cleanup function to close audio context when component unmounts
      if (audioCtx) {
        audioCtx.close();
      }
    };
  }, []);
  
  // Try to load variation files in background (don't block main loading)
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
            
            // Add drone variations
            extendedLibrary[LAYERS.DRONE] = [
              ...extendedLibrary[LAYERS.DRONE],
              ...[1, 2, 3].map(i => ({
                id: `drone_variation_${i}`,
                name: `Drone Variation ${i}`,
                path: `/samples/drone/drone_0${i}.mp3`
              }))
            ];
            
            // Add melody variations
            extendedLibrary[LAYERS.MELODY] = [
              ...extendedLibrary[LAYERS.MELODY],
              ...[1, 2, 3].map(i => ({
                id: `melody_variation_${i}`,
                name: `Melody Variation ${i}`,
                path: `/samples/melody/melody_0${i}.mp3`
              }))
            ];
            
            // Add rhythm variations
            extendedLibrary[LAYERS.RHYTHM] = [
              ...extendedLibrary[LAYERS.RHYTHM],
              ...[1, 2, 3].map(i => ({
                id: `rhythm_variation_${i}`,
                name: `Rhythm Variation ${i}`,
                path: `/samples/rhythm/rhythm_0${i}.mp3`
              }))
            ];
            
            // Add nature variations
            extendedLibrary[LAYERS.NATURE] = [
              ...extendedLibrary[LAYERS.NATURE],
              ...[1, 2, 3].map(i => ({
                id: `nature_variation_${i}`,
                name: `Nature Variation ${i}`,
                path: `/samples/nature/nature_0${i}.mp3`
              }))
            ];
            
            return extendedLibrary;
          });
        }
      } catch (error) {
        console.log('Variation audio files not detected, using defaults only');
      }
    }, 1000); // Delay this check to not interfere with main loading
  };

  // Initialize audio elements with default tracks
  const initializeDefaultAudio = async (library, ctx, nodes) => {
    if (!ctx) return;
    
    const totalFiles = Object.values(LAYERS).length;
    let loadedFiles = 0;
    
    const newActiveAudio = {};
    const newAudioElements = { 
      [LAYERS.DRONE]: {},
      [LAYERS.MELODY]: {},
      [LAYERS.RHYTHM]: {},
      [LAYERS.NATURE]: {}
    };
    
    // Update progress to show we're starting to load
    setLoadingProgress(20);
    
    // For each layer, create and load the default audio element
    for (const layer of Object.values(LAYERS)) {
      // Always use the first track as default
      const defaultTrack = library[layer][0];
      
      try {
        // Create new audio element
        const audioElement = new Audio();
        
        // Set up load handler before setting src
        const loadPromise = new Promise((resolve) => {
          // Set up handlers for this audio element
          const loadHandler = () => {
            loadedFiles++;
            const progress = Math.round((loadedFiles / totalFiles) * 80) + 20; // Start at 20%, go up to 100%
            setLoadingProgress(progress);
            console.log(`Loaded audio for ${layer}, progress: ${progress}%`);
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
        const source = ctx.createMediaElementSource(audioElement);
        source.connect(nodes[layer]);
        
        // Store the audio element and its source
        newAudioElements[layer][defaultTrack.id] = {
          element: audioElement,
          source: source,
          track: defaultTrack,
          isActive: true,
          gain: volumes[layer] // Start with default volume
        };
        
        // Set as active audio for this layer
        newActiveAudio[layer] = defaultTrack.id;
        
        // Wait for this layer to load
        await loadPromise;
        
      } catch (error) {
        console.error(`Error initializing audio for layer ${layer}:`, error);
        // Increment progress anyway to avoid getting stuck
        loadedFiles++;
        const progress = Math.round((loadedFiles / totalFiles) * 80) + 20;
        setLoadingProgress(progress);
      }
    }
    
    // Update state with loaded audio
    setAudioElements(newAudioElements);
    setActiveAudio(newActiveAudio);
    setIsLoading(false);
    setLoadingProgress(100);
    console.log("All audio loaded successfully");
  };

  // Function to safely set playing state - define this FIRST
  const updatePlayingState = useCallback((newState) => {
    console.log(`Updating playing state to: ${newState}`);
    // Update the ref immediately (sync)
    isPlayingRef.current = newState;
    // Update the React state (async)
    setIsPlaying(newState);
  }, []);

  // Start the session - define SECOND
  const startSession = useCallback(() => {
    // Use ref for current state check to avoid race conditions
    if (!audioCtx || isPlayingRef.current) {
      console.log("Can't start: context missing or already playing", {
        hasContext: !!audioCtx,
        isPlayingRef: isPlayingRef.current
      });
      return;
    }
    
    try {
      console.log("Starting session...");
      
      // Resume audio context if suspended
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(err => {
          console.error('Error resuming audio context:', err);
        });
      }
      
      // Play all active audio elements
      let allPlayPromises = [];
      
      Object.entries(activeAudio).forEach(([layer, trackId]) => {
        const track = audioElements[layer][trackId];
        if (track && track.element) {
          console.log(`Playing audio for ${layer}`);
          
          // Set correct volume
          if (gainNodes[layer]) {
            gainNodes[layer].gain.value = volumes[layer];
          }
          
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
    } catch (error) {
      console.error('Error starting session:', error);
      // Reset state if we hit an error
      updatePlayingState(false);
    }
  }, [audioCtx, audioElements, activeAudio, gainNodes, volumes, updatePlayingState]);

  // Pause the session - define THIRD
  const pauseSession = useCallback(() => {
    // Use ref for current state check to avoid race conditions
    if (!isPlayingRef.current) {
      console.log("Not playing, nothing to pause");
      return;
    }
    
    try {
      console.log("Pausing session...");
      let pauseCount = 0;
      let totalTracks = 0;
      
      // Pause all active audio elements
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

  // Update volume for a layer
  const setVolume = useCallback((layer, value) => {
    if (!gainNodes[layer]) return;
    
    // Update volume state
    setVolumes(prev => ({
      ...prev,
      [layer]: value
    }));
    
    // Apply to gain node
    gainNodes[layer].gain.value = value;
  }, [gainNodes]);

  // Optimized preloadAudio function for large files
  const preloadAudio = useCallback(async (layer, trackId) => {
    if (!audioCtx || !audioLibrary[layer]) {
      console.error("Cannot preload: audio context or library missing");
      return false;
    }
    
    // Find the track in the library
    const track = audioLibrary[layer].find(t => t.id === trackId);
    if (!track) {
      console.error(`Track ${trackId} not found in library`);
      return false;
    }
    
    // Skip if already loaded
    if (audioElements[layer][trackId]) {
      console.log(`Track ${trackId} already loaded, skipping preload`);
      return true;
    }
    
    try {
      console.log(`Starting preload for ${layer}: ${trackId} (${track.path})`);
      
      // Create new audio element with optimized settings
      const audioElement = new Audio();
      
      // Set options for large file handling
      audioElement.preload = "auto";       // Use automatic preloading
      audioElement.autobuffer = true;      // Enable auto buffering
      
      // For longer files, we want to make sure we can start playing as soon as enough
      // has been buffered, even if the entire file isn't loaded
      
      // Set up a more comprehensive loading system with progress tracking
      let loadingProgress = 0;
      
      // This promise will resolve when enough data is loaded to begin playback
      const loadPromise = new Promise((resolve, reject) => {
        // Several events to track loading progress
        
        // canplay - enough data is loaded to begin playback
        audioElement.addEventListener('canplay', () => {
          console.log(`Track ${trackId} can begin playing (partially loaded)`);
          loadingProgress = 0.6; // 60% progress when playback can begin
          // Don't resolve yet, keep loading more
        }, { once: false });
        
        // canplaythrough - enough data loaded for continuous playback
        audioElement.addEventListener('canplaythrough', () => {
          console.log(`Track ${trackId} loaded enough for continuous playback`);
          loadingProgress = 0.9; // 90% when enough is loaded for continuous playback
          resolve(true); // Now we can resolve - this is enough for our purposes
        }, { once: true });
        
        // progress - fired periodically as data loads
        audioElement.addEventListener('progress', (e) => {
          // Try to get buffered data
          if (audioElement.buffered && audioElement.buffered.length > 0 && audioElement.duration) {
            // Calculate how much has been buffered
            const bufferedEnd = audioElement.buffered.end(audioElement.buffered.length - 1);
            const percentBuffered = (bufferedEnd / audioElement.duration) * 100;
            console.log(`Loading progress for ${trackId}: ${percentBuffered.toFixed(1)}%`);
          }
        }, { once: false });
        
        // loadeddata - basic data is loaded
        audioElement.addEventListener('loadeddata', () => {
          console.log(`Basic data loaded for ${trackId}`);
          loadingProgress = 0.4; // 40% when basic data is loaded
        }, { once: true });
        
        // Handle errors during loading
        audioElement.addEventListener('error', (e) => {
          const errorMessage = audioElement.error ? 
            `Error code: ${audioElement.error.code}, message: ${audioElement.error.message}` : 
            'Unknown error';
          console.error(`Error loading audio ${track.path}: ${errorMessage}`);
          reject(new Error(`Audio loading error: ${errorMessage}`));
        }, { once: true });
        
        // Set a timeout in case loading stalls
        const timeout = setTimeout(() => {
          if (loadingProgress < 0.8) {  // If we're not at least 80% loaded
            console.warn(`Loading of ${trackId} taking too long, but continuing in background`);
            resolve(true); // Resolve anyway to prevent UI from hanging
          }
        }, 30000); // 30 second timeout for initial loading
        
        // Clean up timeout if we resolve or reject
        audioElement.addEventListener('canplaythrough', () => clearTimeout(timeout), { once: true });
        audioElement.addEventListener('error', () => clearTimeout(timeout), { once: true });
      });
      
      // Now set the source and start loading
      audioElement.src = track.path;
      audioElement.loop = true;
      audioElement.load(); // Start loading
      
      // Create media element source
      const source = audioCtx.createMediaElementSource(audioElement);
      source.connect(gainNodes[layer]);
      
      // Store the audio element with initial gain of 0
      setAudioElements(prev => ({
        ...prev,
        [layer]: {
          ...prev[layer],
          [trackId]: {
            element: audioElement,
            source: source,
            track: track,
            isActive: false,
            gain: 0,
            loading: true // Mark as still loading
          }
        }
      }));
      
      // Wait for loading to reach a playable state
      try {
        await loadPromise;
        
        // Update the audio element to mark loading as complete
        setAudioElements(prev => ({
          ...prev,
          [layer]: {
            ...prev[layer],
            [trackId]: {
              ...prev[layer][trackId],
              loading: false // Mark loading as complete
            }
          }
        }));
        
        console.log(`Track ${trackId} preloaded successfully`);
        return true;
      } catch (error) {
        console.error(`Failed to preload ${trackId}: ${error.message}`);
        
        // Clean up the failed audio element
        try {
          audioElement.pause();
          audioElement.src = '';
          source.disconnect();
        } catch (cleanupError) {
          console.error(`Error during cleanup: ${cleanupError.message}`);
        }
        
        // Remove from audio elements
        setAudioElements(prev => {
          const newElements = { ...prev };
          if (newElements[layer] && newElements[layer][trackId]) {
            delete newElements[layer][trackId];
          }
          return newElements;
        });
        
        return false;
      }
    } catch (error) {
      console.error(`Error in preload process for ${track.path}: ${error.message}`);
      return false;
    }
  }, [audioCtx, audioElements, audioLibrary, gainNodes]);

  // Enhanced crossfade function with smoother transitions for long files
  const enhancedCrossfadeTo = useCallback(async (layer, newTrackId, fadeDuration = 15000) => {
    if (!audioCtx || !gainNodes[layer]) {
      console.error("Cannot crossfade: missing audio context or gain node");
      return false;
    }
    
    // Get the current active track ID
    const currentTrackId = activeAudio[layer];
    
    // Skip if already playing requested track
    if (currentTrackId === newTrackId) {
      console.log(`Already playing ${newTrackId} on ${layer}`);
      return true;
    }
    
    console.log(`Crossfading ${layer} from ${currentTrackId} to ${newTrackId} over ${fadeDuration/1000}s`);
    
    // Ensure the new track is loaded
    if (!audioElements[layer][newTrackId]) {
      console.log(`Preloading track ${newTrackId} for crossfade`);
      try {
        const success = await preloadAudio(layer, newTrackId);
        if (!success) {
          console.error(`Failed to preload ${newTrackId}`);
          return false;
        }
      } catch (error) {
        console.error(`Error preloading audio for crossfade: ${error.message}`);
        return false;
      }
    }
    
    const currentTrack = audioElements[layer][currentTrackId];
    const newTrack = audioElements[layer][newTrackId];
    
    if (!currentTrack || !newTrack) {
      console.error(`Missing track data for crossfade`);
      return false;
    }
    
    // Get the current volume for this layer
    const currentVolume = volumes[layer];
    
    // Create dedicated gain nodes for this crossfade operation
    // This prevents interference with the main gain nodes
    const fadeOutGain = audioCtx.createGain();
    const fadeInGain = audioCtx.createGain();
    
    fadeOutGain.gain.value = currentVolume;
    fadeInGain.gain.value = 0.001;  // Start nearly silent but not zero (to avoid errors)
    
    // Connect to destination
    fadeOutGain.connect(audioCtx.destination);
    fadeInGain.connect(audioCtx.destination);
    
    // Temporarily disconnect current track from main gain node and connect to fade node
    try {
      currentTrack.source.disconnect();
      currentTrack.source.connect(fadeOutGain);
    } catch (error) {
      console.error(`Error disconnecting current track: ${error.message}`);
      // Attempt recovery by reconnecting to main gain node
      try {
        currentTrack.source.connect(gainNodes[layer]);
      } catch (innerError) {
        console.error(`Error reconnecting track: ${innerError.message}`);
      }
      return false;
    }
    
    // Connect new track to fade-in gain
    try {
      newTrack.source.disconnect();
      newTrack.source.connect(fadeInGain);
    } catch (error) {
      console.error(`Error connecting new track: ${error.message}`);
      // Attempt recovery
      try {
        currentTrack.source.disconnect();
        currentTrack.source.connect(gainNodes[layer]);
      } catch (innerError) {
        console.error(`Error in recovery: ${innerError.message}`);
      }
      return false;
    }
    
    // Start the new track if we're playing
    let playPromise = Promise.resolve();
    if (isPlayingRef.current) {
      try {
        // Don't reset currentTime for longer tracks - we want to fade between tracks at their current positions
        // Only reset time if the new track is not currently playing
        if (newTrack.element.paused) {
          console.log("Starting new track from beginning");
          newTrack.element.currentTime = 0;
        } else {
          console.log("New track already playing, continuing from current position");
        }
        
        playPromise = newTrack.element.play()
          .catch(error => {
            console.error(`Error playing new track during crossfade: ${error.message}`);
            return null;
          });
      } catch (error) {
        console.error(`Error starting new track for crossfade: ${error.message}`);
        return false;
      }
    }
    
    // Wait for play to start
    await playPromise;
    
    // Use Web Audio API's precision timing for smooth crossfade
    const now = audioCtx.currentTime;
    const fadeEnd = now + (fadeDuration / 1000);  // Convert ms to seconds
    
    // For longer fades, linear ramps may sound more natural than exponential
    // Schedule the volume changes using linear ramps for smoother long transitions
    try {
      // Schedule fade out - start at current volume
      fadeOutGain.gain.setValueAtTime(currentVolume, now);
      fadeOutGain.gain.linearRampToValueAtTime(0.001, fadeEnd); // Avoid zero for exponential
      
      // Schedule fade in - start from near-zero
      fadeInGain.gain.setValueAtTime(0.001, now);
      fadeInGain.gain.linearRampToValueAtTime(currentVolume, fadeEnd);
      
      console.log(`Crossfade ramps scheduled from ${now.toFixed(2)}s to ${fadeEnd.toFixed(2)}s`);
    } catch (error) {
      console.error(`Error scheduling gain ramps: ${error.message}`);
      // Attempt recovery
      try {
        fadeOutGain.gain.value = 0;
        fadeInGain.gain.value = currentVolume;
      } catch (innerError) {
        console.error(`Error in gain recovery: ${innerError.message}`);
      }
    }
    
    // Update active audio state immediately
    setActiveAudio(prev => ({
      ...prev,
      [layer]: newTrackId
    }));
    
    // Update isActive status in audioElements
    setAudioElements(prev => ({
      ...prev,
      [layer]: {
        ...prev[layer],
        [currentTrackId]: {
          ...prev[layer][currentTrackId],
          isActive: false
        },
        [newTrackId]: {
          ...prev[layer][newTrackId],
          isActive: true
        }
      }
    }));
    
    // Wait for the crossfade to complete
    // Use a setTimeout to avoid blocking
    console.log(`Waiting for ${fadeDuration + 200}ms for crossfade to complete`);
    await new Promise(resolve => setTimeout(resolve, fadeDuration + 200));
    
    // Stop the old track if we're playing
    if (isPlayingRef.current) {
      try {
        console.log(`Pausing old track: ${currentTrackId}`);
        currentTrack.element.pause();
      } catch (e) {
        console.error(`Error pausing old track: ${e.message}`);
      }
    }
    
    // Reconnect new track to main gain node with correct volume
    try {
      console.log(`Reconnecting new track to main gain node`);
      newTrack.source.disconnect();
      newTrack.source.connect(gainNodes[layer]);
      gainNodes[layer].gain.value = currentVolume;
    } catch (error) {
      console.error(`Error reconnecting to main gain: ${error.message}`);
    }
    
    // Clean up temporary gain nodes
    setTimeout(() => {
      try {
        fadeOutGain.disconnect();
        fadeInGain.disconnect();
        console.log(`Temporary gain nodes cleaned up`);
      } catch (error) {
        console.error(`Error cleaning up gain nodes: ${error.message}`);
      }
    }, 250);
    
    console.log(`Crossfade complete for ${layer}`);
    return true;
  }, [audioCtx, audioElements, gainNodes, activeAudio, volumes, preloadAudio]);

  // Calculate elapsed session time
  const getSessionTime = useCallback(() => {
    if (!sessionStartTime) return 0;
    return isPlayingRef.current ? Date.now() - sessionStartTime : 0;
  }, [sessionStartTime]);

  // Test function for crossfade - define this AFTER all the functions it depends on
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
      if (tracks.length < 2) continue;
      
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
  }, [audioLibrary, activeAudio, hasSwitchableAudio, startSession, enhancedCrossfadeTo]);

  // Exposed context value
  const value = useMemo(() => ({
    // Audio state
    isLoading,
    loadingProgress,
    isPlaying,
    volumes,
    activeAudio,
    audioLibrary,
    hasSwitchableAudio,
    
    // Audio controls
    setVolume,
    startSession,
    pauseSession,
    enhancedCrossfadeTo,
    preloadAudio,
    getSessionTime,
    testCrossfade,
    
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
    setVolume, 
    startSession, 
    pauseSession, 
    enhancedCrossfadeTo,
    preloadAudio,
    getSessionTime,
    testCrossfade
  ]);

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};

export default AudioContext;