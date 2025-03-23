// src/contexts/StreamingAudioContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

// Define our audio layers
const LAYERS = {
  DRONE: 'drone',
  MELODY: 'melody',
  RHYTHM: 'rhythm',
  NATURE: 'nature'
};

// Default audio files for each layer - using full files as default
const DEFAULT_AUDIO = {
  [LAYERS.DRONE]: '/samples/drones.mp3',
  [LAYERS.MELODY]: '/samples/melody.mp3',
  [LAYERS.RHYTHM]: '/samples/rhythm.mp3',
  [LAYERS.NATURE]: '/samples/nature.mp3'
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
          
          // Check if chunked files available (in background)
          tryLoadChunkedFiles();
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
  
  // Try to load chunked files in background (don't block main loading)
  const tryLoadChunkedFiles = () => {
    setTimeout(async () => {
      try {
        // We're only checking if some chunked files exist
        const response = await fetch('/samples/chunks/drones_00.mp3', { method: 'HEAD' });
        
        if (response.ok) {
          // If we have chunks, we can set up the extended library
          setHasSwitchableAudio(true);
          
          // Add chunked files to the library
          setAudioLibrary(prev => {
            const extendedLibrary = { ...prev };
            
            // Just add a few samples to avoid overwhelming the system
            extendedLibrary[LAYERS.DRONE] = [
              ...extendedLibrary[LAYERS.DRONE],
              ...Array.from({ length: 3 }, (_, i) => ({
                id: `drone_chunk_${i}`,
                name: `Drone Variation ${i + 1}`,
                path: `/samples/chunks/drones_${i.toString().padStart(2, '0')}.mp3`
              }))
            ];
            
            extendedLibrary[LAYERS.MELODY] = [
              ...extendedLibrary[LAYERS.MELODY],
              ...Array.from({ length: 3 }, (_, i) => ({
                id: `melody_chunk_${i}`,
                name: `Melody Variation ${i + 1}`,
                path: `/samples/chunks/melody_${i.toString().padStart(2, '0')}.mp3`
              }))
            ];
            
            extendedLibrary[LAYERS.RHYTHM] = [
              ...extendedLibrary[LAYERS.RHYTHM],
              ...Array.from({ length: 3 }, (_, i) => ({
                id: `rhythm_chunk_${i}`,
                name: `Rhythm Variation ${i + 1}`,
                path: `/samples/chunks/rhythm_${i.toString().padStart(2, '0')}.mp3`
              }))
            ];
            
            extendedLibrary[LAYERS.NATURE] = [
              ...extendedLibrary[LAYERS.NATURE],
              ...Array.from({ length: 3 }, (_, i) => ({
                id: `nature_chunk_${i}`,
                name: `Nature Variation ${i + 1}`,
                path: `/samples/chunks/nature_${i.toString().padStart(2, '0')}.mp3`
              }))
            ];
            
            return extendedLibrary;
          });
        }
      } catch (error) {
        console.log('Chunked audio files not detected, using defaults only');
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

  // Preload an audio file for future use
  const preloadAudio = useCallback(async (layer, trackId) => {
    if (!audioCtx || !audioLibrary[layer]) return;
    
    // Find the track in the library
    const track = audioLibrary[layer].find(t => t.id === trackId);
    if (!track) return;
    
    // Skip if already loaded
    if (audioElements[layer][trackId]) return;
    
    try {
      // Create new audio element
      const audioElement = new Audio();
      
      // Set up load promise
      const loadPromise = new Promise((resolve) => {
        audioElement.addEventListener('canplaythrough', resolve, { once: true });
        audioElement.addEventListener('error', (e) => {
          console.error(`Error preloading audio: ${track.path}`, e);
          resolve(); // Resolve anyway to not block
        }, { once: true });
        
        // Timeout in case it hangs
        setTimeout(resolve, 3000);
      });
      
      // Set source and start loading
      audioElement.src = track.path;
      audioElement.loop = true;
      audioElement.load();
      
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
            gain: 0
          }
        }
      }));
      
      // Wait for loading to complete
      await loadPromise;
      
      return true;
    } catch (error) {
      console.error(`Error preloading audio: ${track.path}`, error);
      return false;
    }
  }, [audioCtx, audioElements, audioLibrary, gainNodes]);

  // Crossfade to a new audio track
  const crossfadeTo = useCallback(async (layer, newTrackId, fadeDuration = 2000) => {
    if (!audioCtx || !gainNodes[layer]) return;
    
    // Get the current active track ID
    const currentTrackId = activeAudio[layer];
    if (currentTrackId === newTrackId) return; // Already playing this track
    
    // Ensure the new track is loaded
    if (!audioElements[layer][newTrackId]) {
      try {
        const success = await preloadAudio(layer, newTrackId);
        if (!success) return; // Don't proceed if loading failed
      } catch (error) {
        console.error('Error preloading audio for crossfade:', error);
        return;
      }
    }
    
    const currentTrack = audioElements[layer][currentTrackId];
    const newTrack = audioElements[layer][newTrackId];
    
    if (!currentTrack || !newTrack) return;
    
    // Start the new track if we're playing
    if (isPlaying) {
      try {
        newTrack.element.currentTime = 0;
        const playPromise = newTrack.element.play();
        
        // Handle play promise to avoid uncaught errors
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error('Error playing new track during crossfade:', error);
          });
        }
      } catch (error) {
        console.error('Error playing new track during crossfade:', error);
        return;
      }
    }
    
    // Get the current volume for this layer
    const currentVolume = volumes[layer];
    
    // Update active audio
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
    
    // Simple crossfade with fewer steps
    const steps = 10; // Reduced number of steps
    const stepTime = fadeDuration / steps;

    // Perform the actual crossfade
    for (let i = 0; i <= steps; i++) {
      setTimeout(() => {
        try {
          if (!gainNodes[layer]) return;
          
          // Calculate current fade values
          const fadeOutVolume = currentVolume * (1 - (i / steps));
          const fadeInVolume = currentVolume * (i / steps);
          
          // First set the fade-out volume on current track
          if (currentTrack) {
            gainNodes[layer].gain.value = fadeOutVolume;
          }
          
          // After a small delay, set the fade-in volume (helps smooth transition)
          setTimeout(() => {
            try {
              if (!gainNodes[layer]) return;
              gainNodes[layer].gain.value = fadeInVolume;
              
              // When finished, clean up
              if (i === steps) {
                // Stop the old track
                if (currentTrack && isPlaying) {
                  try {
                    currentTrack.element.pause();
                  } catch (e) {
                    console.error('Error pausing old track:', e);
                  }
                }
                
                // Restore normal volume
                gainNodes[layer].gain.value = currentVolume;
              }
            } catch (e) {
              console.error('Error in crossfade inner timeout:', e);
            }
          }, 20);
        } catch (e) {
          console.error('Error in crossfade step:', e);
        }
      }, i * stepTime);
    }
  }, [audioCtx, audioElements, gainNodes, activeAudio, volumes, isPlaying, preloadAudio]);

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

  // Start the session
  const startSession = useCallback(() => {
    if (!audioCtx || isPlaying) return;
    
    try {
      // Resume audio context if suspended
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(err => {
          console.error('Error resuming audio context:', err);
        });
      }
      
      // Play all active audio elements
      Object.entries(activeAudio).forEach(([layer, trackId]) => {
        const track = audioElements[layer][trackId];
        if (track && track.element) {
          // Set correct volume
          gainNodes[layer].gain.value = volumes[layer];
          // Play the audio
          const playPromise = track.element.play();
          if (playPromise !== undefined) {
            playPromise.catch(err => {
              console.error(`Error playing audio for ${layer}:`, err);
            });
          }
        }
      });
      
      // Update state
      setIsPlaying(true);
      setSessionStartTime(Date.now());
    } catch (error) {
      console.error('Error starting session:', error);
    }
  }, [audioCtx, isPlaying, activeAudio, audioElements, gainNodes, volumes]);

  // Pause the session
  const pauseSession = useCallback(() => {
    if (!isPlaying) return;
    
    try {
      // Pause all active audio elements
      Object.entries(activeAudio).forEach(([layer, trackId]) => {
        const track = audioElements[layer][trackId];
        if (track && track.element) {
          track.element.pause();
        }
      });
      
      // Update state
      setIsPlaying(false);
    } catch (error) {
      console.error('Error pausing session:', error);
    }
  }, [isPlaying, activeAudio, audioElements]);

  // Calculate elapsed session time
  const getSessionTime = useCallback(() => {
    if (!sessionStartTime) return 0;
    return isPlaying ? Date.now() - sessionStartTime : 0;
  }, [isPlaying, sessionStartTime]);

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
    crossfadeTo,
    preloadAudio,
    getSessionTime,
    
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
    crossfadeTo, 
    preloadAudio,
    getSessionTime
  ]);

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};

export default AudioContext;