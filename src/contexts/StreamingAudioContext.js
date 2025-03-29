// src/contexts/StreamingAudioContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getAudioCore, createAudioCore } from '../services/audio/AudioCoreFactory';
import { getBufferManager } from '../services/audio/BufferManagerFactory';
import { getCrossfadeEngine } from '../services/audio/CrossfadeEngineFactory';
import { getVolumeController } from '../services/audio/VolumeControllerFactory';
import { getTimelineEngine } from '../services/audio/TimelineEngineFactory';

// Define our audio layers
const LAYERS = {
  DRONE: 'drone',
  MELODY: 'melody',
  RHYTHM: 'rhythm',
  NATURE: 'nature'
};

// Default audio files paths
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
  // Service instances
  const [audioCore, setAudioCore] = useState(null);
  const [bufferManager, setBufferManager] = useState(null);
  const [crossfadeEngine, setCrossfadeEngine] = useState(null);
  const [volumeController, setVolumeController] = useState(null);
  const [timelineEngine, setTimelineEngine] = useState(null);
  
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volumes, setVolumes] = useState({}); 
  const [activeAudio, setActiveAudio] = useState({});
  const [audioLibrary, setAudioLibrary] = useState({});
  const [hasSwitchableAudio, setHasSwitchableAudio] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  
  // Tracking states
  const [crossfadeProgress, setCrossfadeProgress] = useState({});
  const [activeCrossfades, setActiveCrossfades] = useState({});
  const [preloadProgress, setPreloadProgress] = useState({});
  const [timelinePhases, setTimelinePhases] = useState([]);
  
  // Preset management
  const [presets, setPresets] = useState({});

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Create AudioCore
        const core = createAudioCore();
        await core.initialize();
        setAudioCore(core);
        
        // Initialize other services once AudioCore is ready
        const bufferMgr = getBufferManager(core.audioContext);
        setBufferManager(bufferMgr);
        
        const volumeCtrl = getVolumeController(core.audioContext);
        setVolumeController(volumeCtrl);
        
        const crossfadeEng = getCrossfadeEngine(core.audioContext);
        setCrossfadeEngine(crossfadeEng);
        
        const timelineEng = getTimelineEngine();
        setTimelineEngine(timelineEng);
        
        // Set initial volume state
        const initialVolumes = {
          [LAYERS.DRONE]: 0.25,
          [LAYERS.MELODY]: 0.0,
          [LAYERS.RHYTHM]: 0.0,
          [LAYERS.NATURE]: 0.0
        };
        setVolumes(initialVolumes);
        
        // Set up basic library
        const basicLibrary = {};
        Object.values(LAYERS).forEach(layer => {
          basicLibrary[layer] = [{
            id: `${layer}1`,
            name: `${layer.charAt(0).toUpperCase() + layer.slice(1)}`,
            path: DEFAULT_AUDIO[layer]
          }];
        });
        setAudioLibrary(basicLibrary);
        
        // Initialize with default audio
        await initializeDefaultAudio(basicLibrary, core);
        
        // Try to load variation files in background
        setTimeout(() => tryLoadVariationFiles(), 1000);
        
        // Load presets if available
        try {
          const savedPresets = localStorage.getItem('ensoAudioPresets');
          if (savedPresets) {
            setPresets(JSON.parse(savedPresets));
          }
        } catch (e) {
          console.warn('Failed to load presets:', e);
        }
        
      } catch (error) {
        console.error("Error initializing audio services:", error);
        // Force loading to complete anyway so UI doesn't get stuck
        setLoadingProgress(100);
        setIsLoading(false);
      }
    };
    
    initializeServices();
    
    // Cleanup function
    return () => {
      if (audioCore) {
        audioCore.cleanup();
      }
    };
  }, []);
  
  // Initialize default audio elements
  const initializeDefaultAudio = async (library, core) => {
    setLoadingProgress(20);
    
    const totalFiles = Object.values(LAYERS).length;
    let loadedFilesCount = 0;
    const newActiveAudio = {};
    
    // For each layer, create and load the default audio element
    for (const layer of Object.values(LAYERS)) {
      try {
        const defaultTrack = library[layer][0];
        
        // Create audio element through AudioCore
        await core.createAudioElement(
          layer, 
          defaultTrack.id, 
          defaultTrack.path, 
          volumes[layer] || 0
        );
        
        // Set as active audio for this layer
        newActiveAudio[layer] = defaultTrack.id;
        
        // Update progress
        loadedFilesCount++;
        const progress = Math.round((loadedFilesCount / totalFiles) * 80) + 20;
        setLoadingProgress(progress);
        
      } catch (error) {
        console.error(`Error initializing audio for layer ${layer}:`, error);
        // Increment progress anyway to avoid getting stuck
        loadedFilesCount++;
        const progress = Math.round((loadedFilesCount / totalFiles) * 80) + 20;
        setLoadingProgress(progress);
      }
    }
    
    // Update state with loaded audio
    setActiveAudio(newActiveAudio);
    setIsLoading(false);
    setLoadingProgress(100);
  };
  
  // Try to load variation files in background
  const tryLoadVariationFiles = async () => {
    try {
      // Check if variation files exist
      const response = await fetch('/samples/drone/drone_01.mp3', { method: 'HEAD' });
      
      if (response.ok) {
        // If we have variations, set up the extended library
        setHasSwitchableAudio(true);
        
        // Add variation files to the library
        setAudioLibrary(prev => {
          const extendedLibrary = { ...prev };
          
          // Add variations for each layer
          for (const layer of Object.values(LAYERS)) {
            extendedLibrary[layer] = [
              ...extendedLibrary[layer],
              ...[1, 2, 3].map(i => ({
                id: `${layer}_variation_${i}`,
                name: `${layer.charAt(0).toUpperCase() + layer.slice(1)} Variation ${i}`,
                path: `/samples/${layer}/${layer}_0${i}.mp3`
              }))
            ];
          }
          
          return extendedLibrary;
        });
      }
    } catch (error) {
      console.log('Variation audio files not detected, using defaults only');
    }
  };
  
  // Start session
  const startSession = useCallback(() => {
    if (!audioCore || isPlaying) return;
    
    try {
      // Start playback
      audioCore.startPlayback(activeAudio, volumes);
      setIsPlaying(true);
      setSessionStartTime(Date.now());
      
      // Start timeline if enabled
      if (timelineEngine && timelineEngine.isTimelineEnabled()) {
        timelineEngine.start();
      }
      
      return true;
    } catch (error) {
      console.error('Error starting session:', error);
      setIsPlaying(false);
      return false;
    }
  }, [audioCore, isPlaying, activeAudio, volumes, timelineEngine]);
  
  // Pause session
  const pauseSession = useCallback(() => {
    if (!audioCore || !isPlaying) return;
    
    try {
      // Pause all audio
      audioCore.pausePlayback();
      setIsPlaying(false);
      
      // Pause timeline
      if (timelineEngine) {
        timelineEngine.pause();
      }
      
      return true;
    } catch (error) {
      console.error('Error pausing session:', error);
      return false;
    }
  }, [audioCore, isPlaying, timelineEngine]);
  
  // Update volume for a layer
  const setVolume = useCallback((layer, value) => {
    if (!volumeController) return;
    
    // Update volume in controller
    volumeController.setLayerVolume(layer, value);
    
    // Update state
    setVolumes(prev => ({
      ...prev,
      [layer]: value
    }));
  }, [volumeController]);
  
  // Set master volume
  const setMasterVolumeLevel = useCallback((value) => {
    if (!volumeController) return;
    
    // Update master volume in controller
    volumeController.setMasterVolume(value);
    
    // Update state
    setMasterVolume(value);
  }, [volumeController]);
  
  // Enhanced crossfade function
  const enhancedCrossfadeTo = useCallback(async (layer, newTrackId, fadeDuration = 4000) => {
    if (!audioCore || !crossfadeEngine || !bufferManager) return false;
    
    // Get current track ID
    const currentTrackId = activeAudio[layer];
    
    // Skip if already playing requested track
    if (currentTrackId === newTrackId) return true;
    
    // If audio is not playing, do an immediate switch without crossfade
    if (!isPlaying) {
      try {
        // Find track in library
        const track = audioLibrary[layer].find(t => t.id === newTrackId);
        if (!track) return false;
        
        // Check if we already have this track loaded
        if (!audioCore.isTrackLoaded(layer, newTrackId)) {
          // Create and load the track
          await audioCore.createAudioElement(layer, newTrackId, track.path, volumes[layer]);
        }
        
        // Update active audio state
        setActiveAudio(prev => ({
          ...prev,
          [layer]: newTrackId
        }));
        
        return true;
      } catch (error) {
        console.error(`Error during immediate track switch: ${error.message}`);
        return false;
      }
    }
    
    // Don't allow overlapping crossfades for the same layer
    if (activeCrossfades[layer]) return false;
    
    // Update UI to show loading
    setActiveCrossfades(prev => ({
      ...prev,
      [layer]: { 
        from: currentTrackId,
        to: newTrackId,
        progress: 0,
        isLoading: true 
      }
    }));
    
    try {
      // Find track in library
      const track = audioLibrary[layer].find(t => t.id === newTrackId);
      if (!track) throw new Error(`Track ${newTrackId} not found`);
      
      // Create the new track if needed
      if (!audioCore.isTrackLoaded(layer, newTrackId)) {
        await audioCore.createAudioElement(layer, newTrackId, track.path, 0);
      }
      
      // Update UI - loading complete
      setActiveCrossfades(prev => ({
        ...prev,
        [layer]: { 
          ...prev[layer],
          isLoading: false 
        }
      }));
      
      // Start crossfade with progress tracking
      const onProgress = (progress) => {
        setCrossfadeProgress(prev => ({
          ...prev,
          [layer]: progress
        }));
        
        setActiveCrossfades(prev => {
          if (prev[layer]) {
            return {
              ...prev,
              [layer]: {
                ...prev[layer],
                progress
              }
            };
          }
          return prev;
        });
      };
      
      const onComplete = () => {
        // Update active audio
        setActiveAudio(prev => ({
          ...prev,
          [layer]: newTrackId
        }));
        
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
      };
      
      // Start crossfade
      const result = await crossfadeEngine.startCrossfade(
        layer,
        { element: audioCore.getAudioElement(layer, currentTrackId) },
        { element: audioCore.getAudioElement(layer, newTrackId) },
        fadeDuration,
        volumes[layer],
        onProgress,
        onComplete
      );
      
      return result;
    } catch (error) {
      console.error(`Error in crossfade: ${error.message}`);
      
      // Reset crossfade state
      setActiveCrossfades(prev => ({
        ...prev,
        [layer]: null
      }));
      
      return false;
    }
  }, [audioCore, crossfadeEngine, bufferManager, activeAudio, audioLibrary, volumes, isPlaying, activeCrossfades]);
  
  // Get elapsed session time
  const getSessionTime = useCallback(() => {
    if (!audioCore) return 0;
    return audioCore.getSessionTime();
  }, [audioCore]);
  
  // Reset timeline event index
  const resetTimelineEventIndex = useCallback(() => {
    if (timelineEngine) {
      timelineEngine.resetTimelineEventIndex();
    }
  }, [timelineEngine]);
  
  // Update timeline phases
  const updateTimelinePhases = useCallback((phases) => {
    if (!phases || !Array.isArray(phases)) return;
    
    setTimelinePhases(phases);
    
    if (timelineEngine) {
      timelineEngine.setPhases(phases);
    }
  }, [timelineEngine]);
  
  // Save preset
  const savePreset = useCallback((name) => {
    if (!name || name.trim() === '') return false;
    
    // Create the preset with state data
    const preset = {
      name,
      date: new Date().toISOString(),
      state: {
        volumes: { ...volumes },
        activeAudio: { ...activeAudio },
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
  }, [volumes, activeAudio, timelinePhases]);
  
  // Load preset
  const loadPreset = useCallback((name) => {
    const preset = presets[name];
    if (!preset) return false;
    
    // Apply volumes
    if (preset.state.volumes) {
      Object.entries(preset.state.volumes).forEach(([layer, vol]) => {
        setVolume(layer, vol);
      });
    }
    
    // Apply tracks
    if (preset.state.activeAudio) {
      Object.entries(preset.state.activeAudio).forEach(([layer, trackId]) => {
        enhancedCrossfadeTo(layer, trackId, 0);
      });
    }
    
    // Apply timeline phases
    if (preset.state.timelinePhases && preset.state.timelinePhases.length > 0) {
      updateTimelinePhases(preset.state.timelinePhases);
      
      // Dispatch event to notify timeline component
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('timeline-update', { 
          detail: { phases: preset.state.timelinePhases } 
        });
        window.dispatchEvent(event);
      }
    }
    
    return true;
  }, [presets, setVolume, enhancedCrossfadeTo, updateTimelinePhases]);
  
  // Delete preset
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

  // Context value
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
    preloadProgress,
    masterVolume,
    
    // Audio controls
    setVolume,
    setMasterVolumeLevel,
    startSession,
    pauseSession,
    crossfadeTo: enhancedCrossfadeTo,
    preloadAudio: enhancedCrossfadeTo,
    getSessionTime,
    
    // Timeline functions
    updateTimelinePhases,
    resetTimelineEventIndex,
    timelinePhases,
    
    // Preset management
    savePreset,
    loadPreset,
    deletePreset,
    getPresets,
    
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
    setVolume,
    setMasterVolumeLevel,
    startSession,
    pauseSession,
    enhancedCrossfadeTo,
    getSessionTime,
    updateTimelinePhases,
    resetTimelineEventIndex,
    timelinePhases,
    savePreset,
    loadPreset,
    deletePreset,
    getPresets
  ]);

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};

export default AudioContext;