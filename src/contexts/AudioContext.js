import React, { createContext, useState, useEffect, useRef, useContext } from 'react';

// Initialize the context
const AudioContext = createContext();

// Default audio layers
const DEFAULT_AUDIO_LAYERS = {
  drones: '/samples/drones.mp3',
  melody: '/samples/melody.mp3',
  rhythm: '/samples/rhythm.mp3',
  nature: '/samples/nature.mp3',
};

// Default volumes
const DEFAULT_VOLUMES = {
  drones: 0.8,
  melody: 0.5,
  rhythm: 0.3,
  nature: 0.6,
};

  

  
    
export const AudioProvider = ({ children }) => {
  // State
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);
  const [isAudioActivated, setIsAudioActivated] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volumes, setVolumes] = useState(DEFAULT_VOLUMES);
  const [sessionTime, setSessionTime] = useState(0);
  const [vuMeterLevel, setVuMeterLevel] = useState(0);
  const [availableLayers, setAvailableLayers] = useState(DEFAULT_AUDIO_LAYERS);
  const [loadingProgress, setLoadingProgress] = useState(0);
  // Refs
  const timerRef = useRef(null);
  const vuMeterRef = useRef(null);
  const audioRefs = useRef({});
  const audioContextRef = useRef(null);
  const gainNodesRef = useRef({});
  const sourceNodesRef = useRef({});
  
  //activate audio for mobile
  const activateAudio = () => {
    if (!audioContextRef.current) return;
    
    try {
      // Force resume the context
      audioContextRef.current.resume().then(() => {
        console.log('Audio context activated successfully');
        setIsAudioActivated(true); // This sets the flag to hide loading screen
      }).catch(err => {
        console.error('Failed to activate audio context:', err);
        setIsAudioActivated(true); // Set it anyway
      });
    } catch (e) {
      console.error('Error activating audio:', e);
      setIsAudioActivated(true); // Set it anyway
    }
  };
  
  

  // Helper function for mobile audio
  const ensureMobileAudioWorks = () => {
    // More aggressive approach for mobile
    if (audioContextRef.current) {
      // Create a silent buffer
      const buffer = audioContextRef.current.createBuffer(1, 1, 22050);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.start(0);
      
      // Force resume with user interaction
      if (audioContextRef.current.state !== 'running') {
        audioContextRef.current.resume().then(() => {
          console.log('AudioContext resumed successfully');
        }).catch(err => {
          console.error('Failed to resume AudioContext:', err);
        });
      }
    }
  };

  // Initialize Web Audio API
  useEffect(() => {
    // Create audio context
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create gain nodes for each layer
    const layers = Object.keys(availableLayers);
    layers.forEach(layer => {
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = volumes[layer];
      gainNode.connect(audioContextRef.current.destination);
      gainNodesRef.current[layer] = gainNode;
    });
    
    // Load audio buffers
    loadAudioBuffers();
     // Try to initialize audio immediately
  ensureMobileAudioWorks();
    // Cleanup on unmount
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (vuMeterRef.current) {
        clearInterval(vuMeterRef.current);
      }
    };
  }, [availableLayers]);
  
  // Load audio buffers
  const loadAudioBuffers = async () => {
    setIsAudioLoaded(false);
    setLoadingProgress(0);
    const layers = Object.keys(availableLayers);
    const totalLayers = layers.length;
    
    try {
      let successCount = 0;
      
      for (const layer of layers) {
        if (!availableLayers[layer]) continue;
        
        try {
          // Add a timeout to prevent hanging
          const fetchPromise = fetch(availableLayers[layer]);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Loading timeout')), 15000)
          );
          
          const response = await Promise.race([fetchPromise, timeoutPromise]);
          const arrayBuffer = await response.arrayBuffer();
          
          if (arrayBuffer && arrayBuffer.byteLength > 0) {
            const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
            audioRefs.current[layer] = audioBuffer;
            successCount++;
          }
          
          // Update progress after each layer loads
          setLoadingProgress(prev => Math.min(100, prev + (100 / totalLayers)));
        } catch (layerError) {
          console.error(`Error loading audio for layer ${layer}:`, layerError);
          // Still update progress even on error
          setLoadingProgress(prev => Math.min(100, prev + (100 / totalLayers)));
        }
      }
      
      console.log(`Audio loading complete: ${successCount}/${layers.length} layers loaded`);
      
      // Auto-activate audio when loaded
      if (successCount > 0) {
        setIsAudioLoaded(true);
       // activateAudio(); // Auto-activate when loaded
      } else {
        console.error('Failed to load any audio layers');
      }
    } catch (error) {
      console.error('Error in overall audio loading process:', error);
    }
  };

  
  // Play all tracks
  const playAllTracks = () => {
    if (!audioContextRef.current) return;
    
    // Call our mobile audio fix function
    ensureMobileAudioWorks();
    // Resume audio context if suspended
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    const layers = Object.keys(availableLayers);
    
    layers.forEach(layer => {
      if (!audioRefs.current[layer]) return;
      
      // Create a new source for this layer
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioRefs.current[layer];
      source.loop = true;
      
      // Connect to the gain node
      source.connect(gainNodesRef.current[layer]);
      
      // Start playback
      source.start(0);
      sourceNodesRef.current[layer] = source;
    });
    
    setIsPlaying(true);
    
    // Start the timer
    timerRef.current = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);
    
    // Animate VU meter
    vuMeterRef.current = setInterval(() => {
      // Calculate based on all layer volumes
      const totalVolume = Object.values(volumes).reduce((sum, vol) => sum + vol, 0);
      const baseLevel = (totalVolume / Object.keys(volumes).length) * 100;
      
      // Add some randomness
      const randomFactor = Math.random() * 20 - 10; // -10 to +10
      const newLevel = Math.max(0, Math.min(100, baseLevel + randomFactor));
      

      setVuMeterLevel(newLevel);
    }, 200);
  };
  
  // Stop all tracks
  const stopAllTracks = () => {
   
    const layers = Object.keys(availableLayers);
    
    layers.forEach(layer => {
      if (sourceNodesRef.current[layer]) {
        sourceNodesRef.current[layer].stop();
        sourceNodesRef.current[layer] = null;
      }
    });
    
    setIsPlaying(false);
    
    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Stop VU meter animation
    if (vuMeterRef.current) {
      clearInterval(vuMeterRef.current);
      setVuMeterLevel(0);
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
    if (gainNodesRef.current[layer]) {
      gainNodesRef.current[layer].gain.value = value;
    }
  };
  
  // Reset timer
  const resetTimer = () => {
    setSessionTime(0);
  };
  
  // Update available layers (for future customization)
  const updateAvailableLayers = (newLayers) => {
    // Stop any currently playing audio
    if (isPlaying) {
      stopAllTracks();
    }
    
    // Update layers
    setAvailableLayers(newLayers);
  };
  
   // Update contextValue to include the new state and function
const contextValue = {
    isPlaying,
    volumes,
    sessionTime,
    vuMeterLevel,
    availableLayers,
    isAudioLoaded,
    isAudioActivated,
    togglePlayback,
    handleVolumeChange,
    resetTimer,
    updateAvailableLayers,
    activateAudio,
    loadingProgress
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