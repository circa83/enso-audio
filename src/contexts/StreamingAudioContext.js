import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import * as Tone from 'tone';

// Initialize the context
const AudioContext = createContext();

// Use native Web Audio API alongside Tone.js
const AudioContextClass = window.AudioContext || window.webkitAudioContext;

// Default audio layers (could be full files or playlists)
const DEFAULT_AUDIO_LAYERS = {
  drones: '/samples/drones.mp3',
  melody: '/samples/melody.mp3',
  rhythm: '/samples/rhythm.mp3',
  nature: '/samples/nature.mp3',
};

// Default volumes
const DEFAULT_VOLUMES = {
  drones: 0.17,
  melody: 0.0,
  rhythm: 0.0,
  nature: 0.0,
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
  const [loadingError, setLoadingError] = useState(null);
  
  // Refs
  const timerRef = useRef(null);
  const vuMeterRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioElementsRef = useRef({});
  const gainNodesRef = useRef({});
  const analyzerNodesRef = useRef({});
  const mediaSourcesRef = useRef({});
  const audioBuffersRef = useRef({});
  const sourceNodesRef = useRef({});
  
  // Creating a simple envelope to handle fades
  const createEnvelope = (value, time, audioParam) => {
    audioParam.setValueAtTime(audioParam.value, audioContextRef.current.currentTime);
    audioParam.exponentialRampToValueAtTime(
      Math.max(value, 0.0001), // Avoid zero for exponentialRamp
      audioContextRef.current.currentTime + time
    );
  };
  
  // Activate audio
  const activateAudio = async () => {
    try {
      console.log('Activating audio...');
      
      // Make sure audio context is running
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log('Audio context resumed');
      }
      
      // Play a silent sound to unlock audio on iOS
      const buffer = audioContextRef.current.createBuffer(1, 1, 22050);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.start(0);
      
      console.log('Audio context activated successfully');
      setIsAudioActivated(true);
    } catch (err) {
      console.error('Failed to activate audio:', err);
      setIsAudioActivated(true); // Continue anyway
    }
  };
  
  // Initialize Web Audio API
  useEffect(() => {
    console.log('Initializing Web Audio API...');
    
    // Create audio context
    audioContextRef.current = new AudioContextClass();
    
    // Create analyzer for VU meter
    const analyzer = audioContextRef.current.createAnalyser();
    analyzer.fftSize = 32;
    analyzer.connect(audioContextRef.current.destination);
    analyzerNodesRef.current.master = analyzer;
    
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
        audioElement.loop = true; // We'll handle more complex looping if needed
        
        // Set up event listeners
        audioElement.addEventListener('canplaythrough', () => {
          console.log(`Audio for ${layer} ready to play`);
          loadedCount++;
          setLoadingProgress(Math.floor((loadedCount / totalLayers) * 100));
          
          if (loadedCount === totalLayers) {
            console.log('All audio loaded, ready to play');
            setIsAudioLoaded(true);
          }
        });
        
        audioElement.addEventListener('error', (err) => {
          console.error(`Error loading audio for ${layer}:`, err);
          setLoadingError(`Error loading ${layer}. Please check your audio files.`);
          
          // Still count this layer to allow playback of others
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
        console.error(`Error initializing audio for ${layer}:`, error);
      }
    });
    
    // Start VU meter animation
    animateVuMeter();
    
    // Cleanup on unmount
    return () => {
      console.log('Cleaning up audio resources...');
      
      // Stop all playback
      stopAllTracks();
      
      // Clear timers
      if (timerRef.current) clearInterval(timerRef.current);
      if (vuMeterRef.current) cancelAnimationFrame(vuMeterRef.current);
      
      // Disconnect and close audio elements
      Object.entries(audioElementsRef.current).forEach(([layer, element]) => {
        element.pause();
        element.removeAttribute('src');
        element.load(); // Reset and release memory
      });
      
      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);
  
  // Animate VU meter using analyzer
  const animateVuMeter = () => {
    const updateMeter = () => {
      if (!analyzerNodesRef.current.master) return;
      
      const analyzer = analyzerNodesRef.current.master;
      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      analyzer.getByteFrequencyData(dataArray);
      
      // Calculate average level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      
      // Scale to 0-100 and add randomness for visual interest
      const scaledValue = (average / 256) * 100;
      const randomFactor = Math.random() * 10 - 5; // -5 to +5
      const newLevel = Math.max(0, Math.min(100, scaledValue + randomFactor));
      
      setVuMeterLevel(newLevel);
      
      // Continue animation
      vuMeterRef.current = requestAnimationFrame(updateMeter);
    };
    
    // Start animation
    vuMeterRef.current = requestAnimationFrame(updateMeter);
  };
  
  // Handle buffer loading for more complex scenarios
  const loadAudioBuffer = async (url) => {
    try {
      // Fetch the audio file
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      
      // Decode the audio data
      const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      return buffer;
    } catch (error) {
      console.error(`Error loading audio buffer from ${url}:`, error);
      return null;
    }
  };
  
  // Play buffer with precise timing and fades
  const playBuffer = (buffer, layer, options = {}) => {
    if (!buffer) return null;
    
    // Create a new buffer source
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    
    // Create a gain node for this source (for fading)
    const fadeGain = audioContextRef.current.createGain();
    fadeGain.gain.value = 0; // Start silent for fade-in
    
    // Connect source → fadeGain → layerGain → destination
    source.connect(fadeGain);
    fadeGain.connect(gainNodesRef.current[layer]);
    
    // Start playback
    const startTime = audioContextRef.current.currentTime;
    source.start(startTime);
    
    // Fade in
    const fadeInTime = options.fadeInTime || 0.1;
    createEnvelope(1, fadeInTime, fadeGain.gain);
    
    // Schedule fade out and stop if not looping
    if (!options.loop && buffer.duration) {
      const fadeOutTime = options.fadeOutTime || 0.1;
      const stopTime = startTime + buffer.duration - fadeOutTime;
      
      // Schedule fade out
      setTimeout(() => {
        if (fadeGain) {
          createEnvelope(0, fadeOutTime, fadeGain.gain);
        }
      }, (buffer.duration - fadeOutTime) * 1000);
      
      // Schedule stop
      source.stop(startTime + buffer.duration);
    }
    
    // Store source for later stopping
    sourceNodesRef.current[layer] = {
      source,
      fadeGain,
      startTime,
      buffer
    };
    
    return source;
  };
  
  // Advanced buffer sequencing for custom patterns
  const scheduleBufferSequence = (buffers, layer, fadeTime = 0.1, interval = 0) => {
    if (!buffers || buffers.length === 0) return;
    
    let currentIndex = 0;
    let nextStartTime = audioContextRef.current.currentTime;
    
    const scheduleNext = () => {
      if (!isPlaying) return;
      
      const buffer = buffers[currentIndex];
      
      // Create source and gain nodes
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      
      const fadeGain = audioContextRef.current.createGain();
      fadeGain.gain.value = 0; // Start silent
      
      // Connect
      source.connect(fadeGain);
      fadeGain.connect(gainNodesRef.current[layer]);
      
      // Calculate timing
      const duration = buffer.duration;
      const startTime = nextStartTime;
      const fadeInEnd = startTime + fadeTime;
      const fadeOutStart = startTime + duration - fadeTime;
      nextStartTime = startTime + duration + interval;
      
      // Schedule start
      source.start(startTime);
      
      // Schedule fade in
      fadeGain.gain.setValueAtTime(0, startTime);
      fadeGain.gain.linearRampToValueAtTime(1, fadeInEnd);
      
      // Schedule fade out
      fadeGain.gain.setValueAtTime(1, fadeOutStart);
      fadeGain.gain.linearRampToValueAtTime(0, startTime + duration);
      
      // Schedule stop
      source.stop(startTime + duration);
      
      // Schedule next chunk
      source.onended = () => {
        currentIndex = (currentIndex + 1) % buffers.length;
        scheduleNext();
      };
    };
    
    // Start the sequence
    scheduleNext();
  };
  
  // Play all tracks
  const playAllTracks = async () => {
    try {
      console.log('Starting playback...');
      
      // Activate audio context if needed
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Play each audio element
      Object.entries(audioElementsRef.current).forEach(([layer, element]) => {
        try {
          // Set volume
          gainNodesRef.current[layer].gain.value = volumes[layer];
          
          // Start playback
          if (element.readyState >= 2) { // HAVE_CURRENT_DATA or better
            element.currentTime = 0; // Reset to beginning
            element.play().catch(err => {
              console.error(`Error playing audio for ${layer}:`, err);
            });
          } else {
            console.warn(`Audio for ${layer} not ready yet`);
          }
        } catch (error) {
          console.error(`Error playing ${layer}:`, error);
        }
      });
      
      setIsPlaying(true);
      
      // Start the timer
      timerRef.current = setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting playback:', error);
      setLoadingError('Failed to start audio. Please try again.');
    }
  };
  
  // Stop all tracks
  const stopAllTracks = () => {
    console.log('Stopping all tracks...');
    
    // Pause all audio elements
    Object.entries(audioElementsRef.current).forEach(([layer, element]) => {
      try {
        element.pause();
      } catch (error) {
        console.error(`Error stopping ${layer}:`, error);
      }
    });
    
    // Stop any buffer sources
    Object.entries(sourceNodesRef.current).forEach(([layer, sourceInfo]) => {
      if (sourceInfo && sourceInfo.source) {
        try {
          // Fade out quickly
          if (sourceInfo.fadeGain) {
            createEnvelope(0, 0.1, sourceInfo.fadeGain.gain);
          }
          
          // Schedule stop after fade
          setTimeout(() => {
            try {
              sourceInfo.source.stop();
            } catch (e) {
              // Already stopped
            }
          }, 100);
        } catch (error) {
          console.error(`Error stopping buffer source for ${layer}:`, error);
        }
      }
    });
    
    setIsPlaying(false);
    
    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };
  
  // Crossfade between two layers
  const crossfade = (fromLayer, toLayer, duration = 2) => {
    if (!gainNodesRef.current[fromLayer] || !gainNodesRef.current[toLayer]) {
      return;
    }
    
    const fromGain = gainNodesRef.current[fromLayer].gain;
    const toGain = gainNodesRef.current[toLayer].gain;
    
    const now = audioContextRef.current.currentTime;
    const fromValue = volumes[fromLayer];
    const toValue = volumes[toLayer];
    
    // Fade out the from layer
    fromGain.setValueAtTime(fromValue, now);
    fromGain.linearRampToValueAtTime(0, now + duration);
    
    // Fade in the to layer
    toGain.setValueAtTime(0, now);
    toGain.linearRampToValueAtTime(toValue, now + duration);
    
    // Update state after crossfade completes
    setTimeout(() => {
      setVolumes(prev => ({
        ...prev,
        [fromLayer]: 0,
        [toLayer]: toValue
      }));
    }, duration * 1000);
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
    
    // Implementation would depend on how dynamic you want this to be
    // For now, this would require a restart
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
    crossfade, // New API for crossfading between tracks
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