import React, { createContext, useState, useEffect, useRef, useContext } from 'react';

// Initialize the context
const AudioContext = createContext();

// Check if we're in the browser environment
const isBrowser = typeof window !== 'undefined';
// Only define AudioContextClass if in browser
const AudioContextClass = isBrowser ? (window.AudioContext || window.webkitAudioContext) : null;

// Default audio layers (could be full files or playlists)
const DEFAULT_AUDIO_LAYERS = {
  drones: '/samples/drones.mp3',     // Note: paths relative to public folder
  melody: '/samples/melody.mp3',
  rhythm: '/samples/rhythm.mp3',
  nature: '/samples/nature.mp3',
};

// Default volumes
const DEFAULT_VOLUMES = {
  drones: 0.18,
  melody: 0.0,
  rhythm: 0.0,
  nature: 0.0,
};

export const AudioProvider = ({ children }) => {
  // Prevent state updates during rendering
  const [preventStateUpdates, setPreventStateUpdates] = useState(false);
  
  // State
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);
  const [isAudioActivated, setIsAudioActivated] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volumes, setVolumes] = useState(DEFAULT_VOLUMES);
  const [sessionTime, setSessionTime] = useState(0);
  const [vuMeterLevel, setVuMeterLevel] = useState(50); // Static value for now
  const [availableLayers, setAvailableLayers] = useState(DEFAULT_AUDIO_LAYERS);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingError, setLoadingError] = useState(null);
  
  // Refs
  const audioContextRef = useRef(null);
  const audioElementsRef = useRef({});
  const gainNodesRef = useRef({});
  const analyzerNodesRef = useRef({});
  const mediaSourcesRef = useRef({});
  const sourceNodesRef = useRef({});
  const timerRef = useRef(null);
  const vuMeterRef = useRef(null);
  const isInitializedRef = useRef(false);
  
  // Creating a simple envelope to handle fades
  const createEnvelope = (value, time, audioParam) => {
    if (!audioContextRef.current) return;
    
    audioParam.setValueAtTime(audioParam.value, audioContextRef.current.currentTime);
    audioParam.exponentialRampToValueAtTime(
      Math.max(value, 0.0001), // Avoid zero for exponentialRamp
      audioContextRef.current.currentTime + time
    );
  };
  
  // Activate audio
  const activateAudio = async () => {
    // Skip if not in browser
    if (!isBrowser || !audioContextRef.current) return;
    
    try {
      // Make sure audio context is running
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Play a silent sound to unlock audio on iOS
      const buffer = audioContextRef.current.createBuffer(1, 1, 22050);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.start(0);
      
      setIsAudioActivated(true);
    } catch (err) {
      setIsAudioActivated(true); // Continue anyway
    }
  };
  
  // Simplified VU meter animation - just keep a static value for now
  const animateVuMeter = () => {
    // Using a static value instead of animation to prevent rendering loops
    setVuMeterLevel(50);
  };
  
  // Initialize Web Audio API
  useEffect(() => {
    // Set a flag to prevent updates during mount
    setPreventStateUpdates(true);
    
    // Skip if not in browser
    if (!isBrowser || !AudioContextClass) {
      return;
    }
    
    // Prevent re-initialization
    if (isInitializedRef.current || audioContextRef.current) {
      return;
    }
    
    isInitializedRef.current = true;
    
    // Create audio context
    audioContextRef.current = new AudioContextClass();
    
    // Create analyzer for VU meter
    const analyzer = audioContextRef.current.createAnalyser();
    analyzer.fftSize = 32;
    analyzer.connect(audioContextRef.current.destination);
    analyzerNodesRef.current = { master: analyzer };
    
    // Initialize audio elements and nodes for each layer
    const layers = Object.keys(DEFAULT_AUDIO_LAYERS);
    
    // Set initial loading state
    setIsAudioLoaded(false);
    setLoadingProgress(0);
    
    // Keep track of loaded layers
    let loadedCount = 0;
    const totalLayers = layers.length;
    
    layers.forEach(layer => {
      try {
        // Create gain node for this layer
        const gainNode = audioContextRef.current.createGain();
        gainNode.gain.value = volumes[layer];
        gainNode.connect(analyzer);
        gainNode.connect(audioContextRef.current.destination);
        gainNodesRef.current[layer] = gainNode;
        
        // Create audio element
        const audioElement = new Audio();
        audioElement.crossOrigin = 'anonymous';
        audioElement.preload = 'auto';
        audioElement.loop = true;
        
        // Set up event listeners
        audioElement.addEventListener('canplaythrough', () => {
          loadedCount++;
          setLoadingProgress(Math.floor((loadedCount / totalLayers) * 100));
          
          if (loadedCount === totalLayers) {
            setIsAudioLoaded(true);
          }
        });
        
        audioElement.addEventListener('error', () => {
          setLoadingError(`Error loading audio. Please check your files.`);
          
          // Still count this layer
          loadedCount++;
          setLoadingProgress(Math.floor((loadedCount / totalLayers) * 100));
        });
        
        // Set source
        audioElement.src = DEFAULT_AUDIO_LAYERS[layer];
        
        // Store element
        audioElementsRef.current[layer] = audioElement;
        
        // Create media source for this element
        const mediaSource = audioContextRef.current.createMediaElementSource(audioElement);
        mediaSource.connect(gainNode);
        mediaSourcesRef.current[layer] = mediaSource;
        
        // Start loading
        audioElement.load();
      } catch (error) {
        // Don't log errors to console in production
      }
    });
    
    // Re-enable state updates after initialization
    setTimeout(() => {
      setPreventStateUpdates(false);
    }, 1000);
    
    // Cleanup on unmount
    return () => {
      // Prevent updates during unmount
      setPreventStateUpdates(true);
      
      // Stop all playback
      if (isPlaying) {
        Object.entries(audioElementsRef.current).forEach(([, element]) => {
          element.pause();
        });
      }
      
      // Clear timers
      if (timerRef.current) clearInterval(timerRef.current);
      if (vuMeterRef.current) cancelAnimationFrame(vuMeterRef.current);
      
      // Disconnect and close audio elements
      Object.entries(audioElementsRef.current).forEach(([, element]) => {
        element.pause();
        element.removeAttribute('src');
        element.load();
      });
      
      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      
      // Reset initialization flag
      isInitializedRef.current = false;
    };
  }, []);
  
  // Play all tracks
  const playAllTracks = async () => {
    // Skip if not in browser
    if (!isBrowser || !audioContextRef.current) return;
    
    try {
      // Activate audio context if needed
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Play each audio element
      Object.entries(audioElementsRef.current).forEach(([layer, element]) => {
        try {
          // Set volume
          gainNodesRef.current[layer].gain.value = volumes[layer];
          
          // Start playback if ready
          if (element.readyState >= 2) {
            element.currentTime = 0;
            element.play().catch(() => {});
          }
        } catch (error) {
          // Silent error
        }
      });
      
      setIsPlaying(true);
      
      // Start the timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      timerRef.current = setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      setLoadingError('Failed to start audio. Please try again.');
    }
  };
  
  // Stop all tracks
  const stopAllTracks = () => {
    // Skip if not in browser
    if (!isBrowser) return;
    
    // Pause all audio elements
    Object.entries(audioElementsRef.current).forEach(([, element]) => {
      try {
        element.pause();
      } catch (error) {
        // Silent error
      }
    });
    
    setIsPlaying(false);
    
    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
  
  // Toggle playback
  const togglePlayback = () => {
    if (isPlaying) {
      stopAllTracks();
    } else {
      playAllTracks();
    }
  };
  
  // Handle volume change
  const handleVolumeChange = (layer, value) => {
    // Update state
    setVolumes(prev => ({
      ...prev,
      [layer]: value
    }));
    
    // Update gain node
    if (isBrowser && gainNodesRef.current[layer]) {
      // Create a smooth transition
      createEnvelope(value, 0.1, gainNodesRef.current[layer].gain);
    }
  };
  
  // Reset timer
  const resetTimer = () => {
    setSessionTime(0);
  };
  
  // Update available layers (for future customization)
  const updateAvailableLayers = (newLayers) => {
    setAvailableLayers(newLayers);
  };
  
  // Force loading complete (for debugging)
  const forceLoadingComplete = () => {
    setIsAudioLoaded(true);
    setLoadingProgress(100);
  };
  
  // Context value
  const contextValue = {
    isPlaying,
    volumes,
    sessionTime,
    vuMeterLevel,
    availableLayers,
    isAudioLoaded,
    isAudioActivated,
    loadingProgress,
    loadingError,
    togglePlayback,
    handleVolumeChange,
    resetTimer,
    updateAvailableLayers,
    activateAudio,
    forceLoadingComplete,
  };
  
  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  );
};

// Custom hook for using the audio context
export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
};