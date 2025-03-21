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
  const [isPlaying, setIsPlaying] = useState(false);
  const [volumes, setVolumes] = useState(DEFAULT_VOLUMES);
  const [sessionTime, setSessionTime] = useState(0);
  const [vuMeterLevel, setVuMeterLevel] = useState(0);
  const [availableLayers, setAvailableLayers] = useState(DEFAULT_AUDIO_LAYERS);
  
  // Refs
  const timerRef = useRef(null);
  const vuMeterRef = useRef(null);
  const audioRefs = useRef({});
  const audioContextRef = useRef(null);
  const gainNodesRef = useRef({});
  const sourceNodesRef = useRef({});
  
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
    const layers = Object.keys(availableLayers);
    
    try {
      for (const layer of layers) {
        if (!availableLayers[layer]) continue;
        
        const response = await fetch(availableLayers[layer]);
        const arrayBuffer = await response.arrayBuffer();
        
        if (arrayBuffer.byteLength > 0) {
          const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
          audioRefs.current[layer] = audioBuffer;
        }
      }
      console.log('All audio layers loaded');
    } catch (error) {
      console.error('Error loading audio:', error);
    }
  };
  
  // Play all tracks
  const playAllTracks = () => {
    if (!audioContextRef.current) return;
    
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
  
  // Context value
  const contextValue = {
    isPlaying,
    volumes,
    sessionTime,
    vuMeterLevel,
    availableLayers,
    togglePlayback,
    handleVolumeChange,
    resetTimer,
    updateAvailableLayers
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