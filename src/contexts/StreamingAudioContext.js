// src/contexts/StreamingAudioContext.js - Extended with preset functionality
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
  
  // Crossfade state tracking for UI feedback
  const [crossfadeProgress, setCrossfadeProgress] = useState({});
  const [activeCrossfades, setActiveCrossfades] = useState({});
  const crossfadeTimers = useRef({});
  const activeCrossfadeNodes = useRef({});
  
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
  
  // NEW: Timeline phases tracking for presets
  const [timelinePhases, setTimelinePhases] = useState([]);
  
  // NEW: State providers for different components
  const stateProviders = useRef({});
  
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
    let loadedFilesCount = 0;
    
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
            loadedFilesCount++;
            const progress = Math.round((loadedFilesCount / totalFiles) * 80) + 20; // Start at 20%, go up to 100%
            setLoadingProgress(progress);
            console.log(`Loaded audio for ${layer}, progress: ${progress}%`);
            
            // Store metadata about the track
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
  };

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
    if (!audioCtx || isPlayingRef.current) {
      console.log("Can't start: context missing or already playing");
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
      
      // Reset the timeline event index when starting a new session
      resetTimelineEventIndex();
      
    } catch (error) {
      console.error('Error starting session:', error);
      // Reset state if we hit an error
      updatePlayingState(false);
    }
  }, [audioCtx, audioElements, activeAudio, gainNodes, volumes, updatePlayingState]);

  // Pause/Stop session function that stops ALL audio, including crossfades
  const pauseSession = useCallback(() => {
    // Use ref for current state check to avoid race conditions
    if (!isPlayingRef.current && Object.keys(activeCrossfadeNodes.current).length === 0) {
      console.log("Not playing, nothing to pause");
      return;
    }
    
    try {
      console.log("Pausing session (including any active crossfades)...");
      let pauseCount = 0;
      let totalTracks = 0;
      
      // First, cancel any active crossfades
      Object.keys(crossfadeTimers.current).forEach(layer => {
        if (crossfadeTimers.current[layer]) {
          console.log(`Cancelling active crossfade for ${layer}`);
          clearInterval(crossfadeTimers.current[layer]);
          crossfadeTimers.current[layer] = null;
          
          // Clean up UI state
          setActiveCrossfades(prev => ({
            ...prev,
            [layer]: null
          }));
          
          setCrossfadeProgress(prev => ({
            ...prev,
            [layer]: 0
          }));
        }
      });
      
      // Clean up and pause all active crossfade nodes
      Object.entries(activeCrossfadeNodes.current).forEach(([layer, nodes]) => {
        if (nodes) {
          try {
            // Get the active crossfade nodes
            const { fadeOutGain, fadeInGain } = nodes;
            
            // Find which tracks are connected to these nodes
            let crossfadeSource = null;
            let crossfadeTarget = null;
            
            // Check for active crossfade
            if (activeCrossfades[layer]) {
              crossfadeSource = activeCrossfades[layer].from;
              crossfadeTarget = activeCrossfades[layer].to;
            }
            
            // Disconnect gain nodes
            if (fadeOutGain) fadeOutGain.disconnect();
            if (fadeInGain) fadeInGain.disconnect();
            
            // Pause any audio elements connected to the crossfade
            if (crossfadeSource && audioElements[layer][crossfadeSource]?.element) {
              audioElements[layer][crossfadeSource].element.pause();
              totalTracks++;
              pauseCount++;
              console.log(`Paused crossfade source for ${layer}: ${crossfadeSource}`);
              
              // Reconnect to main gain node for future use
              try {
                audioElements[layer][crossfadeSource].source.disconnect();
                audioElements[layer][crossfadeSource].source.connect(gainNodes[layer]);
              } catch (e) {
                console.warn(`Could not reconnect source: ${e.message}`);
              }
            }
            
            if (crossfadeTarget && audioElements[layer][crossfadeTarget]?.element) {
              audioElements[layer][crossfadeTarget].element.pause();
              totalTracks++;
              pauseCount++;
              console.log(`Paused crossfade target for ${layer}: ${crossfadeTarget}`);
              
              // Reconnect to main gain node for future use
              try {
                audioElements[layer][crossfadeTarget].source.disconnect();
                audioElements[layer][crossfadeTarget].source.connect(gainNodes[layer]);
              } catch (e) {
                console.warn(`Could not reconnect target: ${e.message}`);
              }
            }
            
            // Clear the crossfade nodes
            activeCrossfadeNodes.current[layer] = null;
            
          } catch (e) {
            console.error(`Error cleaning up crossfade for ${layer}: ${e.message}`);
          }
        }
      });
      
      // Also pause all regular active audio elements
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
  }, [activeAudio, audioElements, updatePlayingState, activeCrossfades, gainNodes]);

  // Update volume for a layer - IMPROVED to handle volume during crossfades
  const setVolume = useCallback((layer, value) => {
    if (!gainNodes[layer]) return;
    
    // Update volume state
    setVolumes(prev => ({
      ...prev,
      [layer]: value
    }));
    
    // Apply to main gain node
    gainNodes[layer].gain.value = value;
    
    // Apply to any active crossfade nodes for this layer
    if (activeCrossfadeNodes.current[layer]) {
      const { fadeOutGain, fadeInGain } = activeCrossfadeNodes.current[layer];
      
      // Get the current progress of the crossfade
      const progress = crossfadeProgress[layer] || 0;
      
      if (fadeOutGain && fadeOutGain.gain) {
        // Adjust the fade-out gain based on crossfade progress
        fadeOutGain.gain.value = value * (1 - progress);
      }
      
      if (fadeInGain && fadeInGain.gain) {
        // Adjust the fade-in gain based on crossfade progress
        fadeInGain.gain.value = value * progress;
      }
    }
  }, [gainNodes, crossfadeProgress]);

  // Enhanced crossfade function with reliable first-click support
  // and immediate track switching when audio is stopped
  const enhancedCrossfadeTo = useCallback(async (layer, newTrackId, fadeDuration = 4000) => {
    console.log(`🎵 Starting crossfade process for ${layer}: ${newTrackId}`);
    
    // Verify we have what we need
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
          source.connect(gainNodes[layer]);
          
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
    
    // Don't allow overlapping crossfades for the same layer
    if (activeCrossfadeNodes.current[layer]) {
      console.warn(`Crossfade already in progress for ${layer}, cancelling it first`);
      
      // Cancel existing crossfade
      if (crossfadeTimers.current[layer]) {
        clearInterval(crossfadeTimers.current[layer]);
        crossfadeTimers.current[layer] = null;
      }
      
      try {
        const { fadeOutGain, fadeInGain } = activeCrossfadeNodes.current[layer];
        fadeOutGain.disconnect();
        fadeInGain.disconnect();
      } catch (e) {
        console.error(`Error cleaning up previous crossfade: ${e.message}`);
      }
      
      activeCrossfadeNodes.current[layer] = null;
      
      // Clear UI state
      setActiveCrossfades(prev => ({
        ...prev,
        [layer]: null
      }));
    }
    
    // Update UI to show we're loading
    setActiveCrossfades(prev => ({
      ...prev,
      [layer]: { 
        from: currentTrackId,
        to: newTrackId,
        progress: 0,
        isLoading: true 
      }
    }));
    
    // Step 1: Get or create the new track's audio elements
    // We'll track in a local variable to avoid race conditions with React state
    let newTrackElements = null;
    
    // First check if it's already available in state (for second click)
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
        // Create and set up a new audio element
        const audioElement = new Audio();
        audioElement.preload = "auto";
        audioElement.loop = true;
        
        // Track loading progress for UI
        let loadingProgress = 0;
        const updateLoadingProgress = (progress) => {
          if (progress > loadingProgress) {
            loadingProgress = progress;
            setPreloadProgress(prev => ({
              ...prev,
              [newTrackId]: progress
            }));
          }
        };
        
        // Initial progress update
        updateLoadingProgress(10);
        
        // Set up a promise to track loading
        const loadPromise = new Promise((resolve, reject) => {
          let loaded = false;
          
          // We'll resolve once we have enough data
          const finishLoading = () => {
            if (loaded) return; // Only resolve once
            loaded = true;
            
            // Create the source node
            const source = audioCtx.createMediaElementSource(audioElement);
            source.connect(gainNodes[layer]);
            
            // Store metadata
            if (audioElement.duration && audioElement.duration > 0) {
              trackData.current[newTrackId] = {
                duration: audioElement.duration,
                loaded: true
              };
            } else {
              // Use fallback duration as last resort
              trackData.current[newTrackId] = {
                duration: 300, // 5 minute default
                loaded: true,
                estimated: true
              };
            }
            
            // Mark as loaded
            loadedFiles.current.add(newTrackId);
            
            // Return the elements
            newTrackElements = {
              element: audioElement,
              source: source,
              track: track,
              isActive: false
            };
            
            // Update the state for future use
            setAudioElements(prev => ({
              ...prev,
              [layer]: {
                ...prev[layer],
                [newTrackId]: newTrackElements
              }
            }));
            
            // Final progress update
            updateLoadingProgress(100);
            
            resolve(newTrackElements);
          };
          
          // Track progress events
          audioElement.addEventListener('progress', () => {
            if (audioElement.buffered && audioElement.buffered.length > 0 && audioElement.duration) {
              const bufferedEnd = audioElement.buffered.end(audioElement.buffered.length - 1);
              const percentBuffered = Math.min(85, (bufferedEnd / audioElement.duration) * 85);
              updateLoadingProgress(Math.round(percentBuffered));
            }
          });
          
          // Set up event listeners
          audioElement.addEventListener('loadeddata', () => updateLoadingProgress(30));
          audioElement.addEventListener('loadedmetadata', () => {
            console.log(`Metadata loaded for ${newTrackId}`);
            updateLoadingProgress(40);
            
            // Store metadata immediately
            if (audioElement.duration && audioElement.duration > 0) {
              trackData.current[newTrackId] = {
                duration: audioElement.duration,
                loaded: true
              };
              console.log(`Stored metadata for ${newTrackId}: ${audioElement.duration}s`);
              updateLoadingProgress(50);
            }
          });
          
          audioElement.addEventListener('canplaythrough', () => {
            updateLoadingProgress(90);
            finishLoading();
          }, { once: true });
          
          // Error handling
          audioElement.addEventListener('error', (e) => {
            reject(new Error(`Error loading audio: ${e.message || 'unknown error'}`));
          }, { once: true });
          
          // Timeout to avoid hanging
          setTimeout(() => {
            if (!loaded) {
              console.warn("Loading taking too long, proceeding anyway");
              updateLoadingProgress(95);
              finishLoading();
            }
          }, 5000);
        });
        
        // Start loading
        audioElement.src = track.path;
        audioElement.load();
        
        // Wait for loading to complete
        await loadPromise;
        
      } catch (error) {
        console.error(`Error preparing track ${newTrackId}: ${error.message}`);
        
        // Reset crossfade state
        setActiveCrossfades(prev => ({
          ...prev,
          [layer]: null
        }));
        
        // Reset progress on error
        setPreloadProgress(prev => {
          const newState = {...prev};
          delete newState[newTrackId];
          return newState;
        });
        
        return false;
      }
    }
    
    // Step 2: Now we have the new track elements, get the current track
    const currentTrack = audioElements[layer]?.[currentTrackId];
    
    // Validate both tracks
    if (!currentTrack?.element || !currentTrack.source || 
        !newTrackElements?.element || !newTrackElements.source) {
      console.error(`Missing track elements for crossfade: current: ${!!currentTrack?.element}, new: ${!!newTrackElements?.element}`);
      
      // Reset crossfade state
      setActiveCrossfades(prev => ({
        ...prev,
        [layer]: null
      }));
      
      return false;
    }
    
    // Update UI - now loading is complete
    setActiveCrossfades(prev => ({
      ...prev,
      [layer]: { 
        ...prev[layer],
        isLoading: false 
      }
    }));
    
    // Step 3: Set up the crossfade
    console.log(`Setting up crossfade from ${currentTrackId} to ${newTrackId}`);
    
    // Get current volume
    const currentVolume = volumes[layer];
    
    // Create gain nodes for crossfade
    const fadeOutGain = audioCtx.createGain();
    const fadeInGain = audioCtx.createGain();
    
    fadeOutGain.gain.value = currentVolume;
    fadeInGain.gain.value = 0.001;  // Start nearly silent
    
    // Store nodes for cancellation and volume control
    activeCrossfadeNodes.current[layer] = { fadeOutGain, fadeInGain };
    
    // Connect to destination
    fadeOutGain.connect(audioCtx.destination);
    fadeInGain.connect(audioCtx.destination);
    
    // Disconnect and reconnect audio graphs
    try {
      // Disconnect current track from main gain and connect to fade out
      currentTrack.source.disconnect();
      currentTrack.source.connect(fadeOutGain);
      
      // Connect new track to fade in
      newTrackElements.source.disconnect();
      newTrackElements.source.connect(fadeInGain);
    } catch (error) {
      console.error(`Error connecting audio graph: ${error.message}`);
      
      // Attempt recovery - reconnect to main gain nodes
      try {
        currentTrack.source.disconnect();
        currentTrack.source.connect(gainNodes[layer]);
        
        newTrackElements.source.disconnect();
        newTrackElements.source.connect(gainNodes[layer]);
      } catch (e) {
        console.error(`Recovery failed: ${e.message}`);
      }
      
      // Reset crossfade state
      setActiveCrossfades(prev => ({
        ...prev,
        [layer]: null
      }));
      
      return false;
    }
    
    // Step 4: Start playback of new track if we're playing
    if (isPlayingRef.current) {
      try {
        // Set the position
        if (newTrackElements.element.paused) {
          const currentPosition = currentTrack.element.currentTime || 0;
          const currentDuration = trackData.current[currentTrackId]?.duration || 
                              currentTrack.element.duration || 300;
          const newDuration = trackData.current[newTrackId]?.duration || 
                            newTrackElements.element.duration || 300;
          
          // Calculate relative position
          const relativePosition = (currentPosition / currentDuration);
          newTrackElements.element.currentTime = relativePosition * newDuration;
          console.log(`Matched position at ${(relativePosition * 100).toFixed(1)}% into track`);
        }
        
        // Start playback
        await newTrackElements.element.play()
          .catch(e => console.error(`Error playing: ${e.message}`));
      } catch (error) {
        console.error(`Error starting playback: ${error.message}`);
        
        // Continue anyway - the crossfade might still work
      }
    }
    
    // Step 5: Schedule the gain curves
    const now = audioCtx.currentTime;
    const endTime = now + (fadeDuration / 1000);
    
    try {
      // Schedule fade out
      fadeOutGain.gain.setValueAtTime(currentVolume, now);
      fadeOutGain.gain.linearRampToValueAtTime(0.001, endTime);
      
      // Schedule fade in
      fadeInGain.gain.setValueAtTime(0.001, now);
      fadeInGain.gain.linearRampToValueAtTime(currentVolume, endTime);
      
      console.log(`Crossfade ramps scheduled from ${now.toFixed(2)}s to ${endTime.toFixed(2)}s`);
    } catch (error) {
      console.error(`Error scheduling gain ramps: ${error.message}`);
      
      // Try recovery
      fadeOutGain.gain.value = 0;
      fadeInGain.gain.value = currentVolume;
    }
    
    // Step 6: Update active track
    setActiveAudio(prev => ({
      ...prev,
      [layer]: newTrackId
    }));
    
    // Step 7: Setup progress tracking
    const updateInterval = 100; // 100ms updates
    const totalUpdates = fadeDuration / updateInterval;
    let updateCount = 0;
    
    crossfadeTimers.current[layer] = setInterval(() => {
      updateCount++;
      const progress = Math.min(updateCount / totalUpdates, 1);
      
      // Update progress state
      setCrossfadeProgress(prev => ({
        ...prev,
        [layer]: progress
      }));
      
      // Update UI
      setActiveCrossfades(prev => {
        if (prev[layer]) {
          return {
            ...prev,
            [layer]: {
              ...prev[layer],
              progress: progress
            }
          };
        }
        return prev;
      });
      
      // When complete, clean up
      if (updateCount >= totalUpdates) {
        // Clear interval
        clearInterval(crossfadeTimers.current[layer]);
        crossfadeTimers.current[layer] = null;
        
        // Stop old track
        if (isPlayingRef.current) {
          try {
            console.log(`Pausing old track: ${currentTrackId}`);
            currentTrack.element.pause();
          } catch (e) {
            console.error(`Error pausing old track: ${e.message}`);
          }
        }
        
        // Reconnect new track to main gain
        try {
          console.log(`Reconnecting new track to main gain node`);
          newTrackElements.source.disconnect();
          newTrackElements.source.connect(gainNodes[layer]);
          gainNodes[layer].gain.value = currentVolume;
        } catch (error) {
          console.error(`Error reconnecting: ${error.message}`);
        }
        
        // Clean up gain nodes
        try {
          fadeOutGain.disconnect();
          fadeInGain.disconnect();
          console.log(`Temporary gain nodes cleaned up`);
        } catch (error) {
          console.error(`Error cleaning up: ${error.message}`);
        }
        
        // Clear references
        activeCrossfadeNodes.current[layer] = null;
        
        // Clear UI state
        setActiveCrossfades(prev => ({
          ...prev,
          [layer]: null
        }));
        
        setCrossfadeProgress(prev => ({
          ...prev,
          [layer]: 0
        }));
        
        // Clear preload progress
        setPreloadProgress(prev => {
          const newState = {...prev};
          delete newState[newTrackId];
          return newState;
        });
        
        console.log(`Crossfade complete for ${layer}`);
      }
    }, updateInterval);
    
    return true;
  }, [audioCtx, gainNodes, volumes, activeAudio, audioLibrary, audioElements, isPlayingRef]);

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

  // Add function to reset timeline event index (e.g., when restarting a session)
  const resetTimelineEventIndex = useCallback(() => {
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

  // NEW: Function to update timeline phases (called from SessionTimeline)
  const updateTimelinePhases = useCallback((phases) => {
    if (!phases || !Array.isArray(phases)) return;
    setTimelinePhases(phases);
    console.log('Updated timeline phases in context:', phases);
  }, []);

  // NEW: Function to register state providers for different components
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

  // Preset Management Functions - ENHANCED FOR TIMELINE INTEGRATION
  
  // Save current state as a preset - ENHANCED
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
        components: componentStates,  // Include component-specific states
        timelinePhases: [...timelinePhases] // Include timeline phases
      }
    };
    
    console.log('Saving preset with complete state:', preset);
    
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
  
  // Load a saved preset - ENHANCED
  const loadPreset = useCallback((name) => {
    const preset = presets[name];
    if (!preset) return false;
    
    console.log('Loading preset:', preset);
    
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
    
    // NEW: Apply timeline phases if they exist
    if (preset.state.timelinePhases && preset.state.timelinePhases.length > 0) {
      setTimelinePhases(preset.state.timelinePhases);
      console.log('Loaded timeline phases from preset:', preset.state.timelinePhases);
      
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
    
    // NEW: Apply component-specific states
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
    crossfadeProgress,
    activeCrossfades,
    preloadProgress, // Add preload progress for UI to show loading status
    
    // Audio controls
    setVolume,
    startSession,
    pauseSession,
    crossfadeTo: enhancedCrossfadeTo,
    preloadAudio: enhancedCrossfadeTo, // Use the same function for preloading
    getSessionTime,
    testCrossfade,
    
    // Timeline event functions
    timelineEvents,
    registerTimelineEvent,
    clearTimelineEvents,
    resetTimelineEventIndex,
    
    // NEW: Timeline phase functions
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
    setVolume, 
    startSession, 
    pauseSession, 
    enhancedCrossfadeTo,
    getSessionTime,
    testCrossfade,
    timelineEvents,
    registerTimelineEvent,
    clearTimelineEvents,
    resetTimelineEventIndex,
    updateTimelinePhases,
    registerPresetStateProvider,
    savePreset,
    loadPreset,
    deletePreset,
    getPresets,
    exportPreset,
    importPreset
  ]);

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};

export default AudioContext;