// src/contexts/AudioContext.js
import React, { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';

// Import service factories
import { getAudioCore } from '../services/audio/AudioCoreFactory';
import { getBufferManager } from '../services/audio/BufferManagerFactory';
import { getCrossfadeEngine } from '../services/audio/CrossfadeEngineFactory';
import { getVolumeController } from '../services/audio/VolumeControllerFactory';
import { getTimelineEngine } from '../services/audio/TimelineEngineFactory';
import { getPresetStorage } from '../services/storage/PresetStorage';

/* Helper function to safely resume an AudioContext
 * @param {AudioContext} context - The audio context to resume
 * @returns {Promise<boolean>} Success status
 */
const safelyResumeAudioContext = async (context) => {
  if (!context) return false;
  
  try {
    // Check if context needs resuming
    if (context.state === 'suspended') {
      console.log('Resuming suspended audio context');
      
      // Try to resume the context
      await context.resume();
      
      // Verify it actually resumed
      if (context.state === 'running') {
        console.log('Audio context successfully resumed');
        return true;
      } else {
        console.warn(`Audio context still in ${context.state} state after resume attempt`);
        return false;
      }
    } else if (context.state === 'running') {
      console.log('Audio context already running');
      return true;
    } else {
      console.warn(`Audio context in unexpected state: ${context.state}`);
      return false;
    }
  } catch (error) {
    console.error('Error resuming audio context:', error);
    return false;
  }
};


// Constants
export const LAYERS = {
  DRONE: 'drone',
  MELODY: 'melody',
  RHYTHM: 'rhythm',
  NATURE: 'nature'
};

// Default audio tracks
const DEFAULT_AUDIO = {
  [LAYERS.DRONE]: '/samples/default/drone.mp3',
  [LAYERS.MELODY]: '/samples/default/melody.mp3',
  [LAYERS.RHYTHM]: '/samples/default/rhythm.mp3',
  [LAYERS.NATURE]: '/samples/default/nature.mp3'
};

// Create the context
const AudioContext = createContext(null);

/**
 * AudioProvider - Main provider for audio functionality
 * Manages audio services and exposes controlled interface to components
 */
export const AudioProvider = ({ children }) => {
  // Service instances (lazy initialized by factories)
  const [audioCore] = useState(() => getAudioCore());
  const [bufferManager, setBufferManager] = useState(null);
  const [volumeController, setVolumeController] = useState(null);
  const [crossfadeEngine, setCrossfadeEngine] = useState(null);
  const [timelineEngine, setTimelineEngine] = useState(null);
  const [presetStorage, setPresetStorage] = useState(null);
  
  // Initialization state
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isAudioActivated, setIsAudioActivated] = useState(false);
  
  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [volumes, setVolumes] = useState({
    [LAYERS.DRONE.toLowerCase()]: 0.25,
    [LAYERS.MELODY.toLowerCase()]: 0.0,
    [LAYERS.RHYTHM.toLowerCase()]: 0.0,
    [LAYERS.NATURE.toLowerCase()]: 0.0
  });
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [activeAudio, setActiveAudio] = useState({});
  const [audioLibrary, setAudioLibrary] = useState({});
  const [hasSwitchableAudio, setHasSwitchableAudio] = useState(false);
  
  // Tracking states
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [crossfadeProgress, setCrossfadeProgress] = useState({});
  const [activeCrossfades, setActiveCrossfades] = useState({});
  const [preloadProgress, setPreloadProgress] = useState({});
  
  // Timeline state
  const [timelinePhases, setTimelinePhases] = useState([]);
  const [presetStateProviders, setPresetStateProviders] = useState({});

  // Initialize audio core and services
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        setLoadingProgress(10);
        
        // Initialize audio core
        const initialized = await audioCore.initialize();
        
        if (!initialized) {
          console.error('Failed to initialize AudioCore');
          setIsLoading(false);
          return;
        }
        
        setLoadingProgress(20);
        
        // Initialize services with the audio context
        const bufferMgr = getBufferManager(audioCore.audioContext);
        setBufferManager(bufferMgr);
        
        setLoadingProgress(30);
        
        const volumeCtrl = getVolumeController(audioCore.audioContext);
        setVolumeController(volumeCtrl);
        
        setLoadingProgress(40);
        
        const crossfadeEng = getCrossfadeEngine(audioCore.audioContext);
        setCrossfadeEngine(crossfadeEng);
        
        setLoadingProgress(50);
        
        const timelineEng = getTimelineEngine();
        setTimelineEngine(timelineEng);
        
        setLoadingProgress(60);
        
        const presetStore = getPresetStorage();
        setPresetStorage(presetStore);
        
        setLoadingProgress(70);
        
        // Connect services
        connectServices(audioCore, volumeCtrl);
        
        setLoadingProgress(80);
        
        // Set up initial audio library
        await setupAudioLibrary();
        
        setLoadingProgress(90);
        
        // Initialize with default tracks
        await initializeDefaultTracks();
        
        setLoadingProgress(100);
        setIsLoading(false);
        setIsInitialized(true);
        
        // Try to load variation files in background
        setTimeout(() => tryLoadVariationFiles(), 1000);
      } catch (error) {
        console.error('Error initializing audio services:', error);
        setIsLoading(false);
      }
    };
    
    if (!isInitialized) {
      initializeAudio();
    }
    
    return () => {
      // Cleanup function
      if (audioCore) {
        audioCore.cleanup();
      }
    };
  }, [audioCore, isInitialized]);
  
  /**
   * Connect audio services together
   */
  const connectServices = (audioCore, volumeCtrl) => {
    // Register gain nodes with volume controller
    Object.values(LAYERS).forEach(layer => {
      const layerId = layer.toLowerCase();
      if (audioCore.gainNodes[layerId]) {
        volumeCtrl.registerGainNode(layerId, audioCore.gainNodes[layerId]);
      }
    });
    
    // Register master gain node
    if (audioCore.masterGain) {
      volumeCtrl.registerMasterGainNode(audioCore.masterGain);
    }
    
    // Initialize volume values
    Object.values(LAYERS).forEach(layer => {
      const layerId = layer.toLowerCase();
      volumeCtrl.setLayerVolume(layerId, volumes[layerId] || 0);
    });
  };
  
  /**
   * Set up basic audio library structure
   */
  const setupAudioLibrary = async () => {
    const basicLibrary = {};
    
    Object.values(LAYERS).forEach(layer => {
      const layerId = layer.toLowerCase();
      basicLibrary[layerId] = [{
        id: `${layerId}1`,
        name: `${layer.charAt(0).toUpperCase() + layer.slice(1)}`,
        path: DEFAULT_AUDIO[layer]
      }];
    });
    
    setAudioLibrary(basicLibrary);
  };
  
  /**
   * Initialize default audio tracks
   */
  const initializeDefaultTracks = async () => {
    const newActiveAudio = {};
    
    // For each layer, create and load the default audio element
    for (const layer of Object.values(LAYERS)) {
      try {
        const layerId = layer.toLowerCase();
        const defaultTrack = audioLibrary[layerId]?.[0];
        
        if (defaultTrack) {
          // Create audio element through AudioCore
          await audioCore.createAudioElement(
            layerId, 
            defaultTrack.id, 
            defaultTrack.path, 
            volumes[layerId] || 0
          );
          
          // Set as active audio for this layer
          newActiveAudio[layerId] = defaultTrack.id;
        }
      } catch (error) {
        console.error(`Error initializing audio for layer ${layer}:`, error);
      }
    }
    
    // Update state with loaded audio
    setActiveAudio(newActiveAudio);
  };
  
  /**
   * Try to load variation files in background
   */
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
            const layerId = layer.toLowerCase();
            extendedLibrary[layerId] = [
              ...extendedLibrary[layerId],
              ...[1, 2, 3].map(i => ({
                id: `${layerId}_variation_${i}`,
                name: `${layer.charAt(0).toUpperCase() + layer.slice(1)} Variation ${i}`,
                path: `/samples/${layerId}/${layerId}_0${i}.mp3`
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
  
  /**
   * Activate audio - call after user interaction to initialize audio context
   * Required by browsers to enable audio playback
   */
  const activateAudio = useCallback(async () => {
    if (!audioCore || isAudioActivated) return false;
    
    try {
      // Resume audio context (browser policy requires user interaction)
      if (audioCore.audioContext && audioCore.audioContext.state === 'suspended') {
        await audioCore.audioContext.resume();
      }
      
      setIsAudioActivated(true);
      return true;
    } catch (error) {
      console.error('Error activating audio:', error);
      return false;
    }
  }, [audioCore, isAudioActivated]);
  
  /**
   * Start audio session
   */
  const startSession = useCallback(() => {
    if (!audioCore || isPlaying || !isInitialized) return false;
    
    try {
      // Start playback
      audioCore.startPlayback(activeAudio, volumes);
      setIsPlaying(true);
      setSessionStartTime(Date.now());
      
      // Start timeline if available and enabled
      if (timelineEngine && timelineEngine.isTimelineEnabled()) {
        timelineEngine.start();
      }
      
      return true;
    } catch (error) {
      console.error('Error starting session:', error);
      setIsPlaying(false);
      return false;
    }
  }, [audioCore, activeAudio, volumes, isPlaying, isInitialized, timelineEngine]);
  
  /**
   * Pause audio session
   */
  const pauseSession = useCallback(() => {
    if (!audioCore || !isPlaying) return false;
    
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
  
  /**
   * Get elapsed session time
   */
  const getSessionTime = useCallback(() => {
    if (!audioCore) return 0;
    return audioCore.getSessionTime();
  }, [audioCore]);
  
  /**
   * Set volume for a specific layer
   */
  const setVolume = useCallback((layer, value) => {
    if (!volumeController) return false;
    
    // Update volume in controller
    volumeController.setLayerVolume(layer, value);
    
    // Update state
    setVolumes(prev => ({
      ...prev,
      [layer]: value
    }));
    
    return true;
  }, [volumeController]);
  
  /**
   * Set master volume
   */
  const setMasterVolumeLevel = useCallback((value) => {
    if (!volumeController) return false;
    
    // Update master volume in controller
    volumeController.setMasterVolume(value);
    
    // Update state
    setMasterVolume(value);
    
    return true;
  }, [volumeController]);
  
  /**
   * Crossfade to a new audio track for a layer
   */
  const crossfadeTo = useCallback(async (layer, newTrackId, fadeDuration = 4000) => {
    if (!audioCore || !crossfadeEngine || !bufferManager) return false;
    
    // Get current track ID
    const currentTrackId = activeAudio[layer];
    
    // Skip if already playing requested track
    if (currentTrackId === newTrackId) return true;
    
    // If audio is not playing, do an immediate switch without crossfade
    if (!isPlaying) {
      try {
        // Find track in library
        const track = audioLibrary[layer]?.find(t => t.id === newTrackId);
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
      const track = audioLibrary[layer]?.find(t => t.id === newTrackId);
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
      
      // Get source and target audio elements
      const sourceElement = audioCore.getAudioElement(layer, currentTrackId);
      const targetElement = audioCore.getAudioElement(layer, newTrackId);
      
      // Start crossfade
      const result = await crossfadeEngine.startCrossfade(
        layer,
        { element: sourceElement, source: { connect: () => {} }, gain: {} }, // Simplified for interface
        { element: targetElement, source: { connect: () => {} }, gain: {} }, // Simplified for interface
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
  
  /**
   * Preload an audio track without playing it
   */
  const preloadAudio = useCallback(async (layer, trackId) => {
    if (!bufferManager || !audioCore) return false;
    
    try {
      // Find track in library
      const track = audioLibrary[layer]?.find(t => t.id === trackId);
      if (!track) return false;
      
      // Skip if already loaded
      if (audioCore.isTrackLoaded(layer, trackId)) return true;
      
      // Start tracking preload progress
      setPreloadProgress(prev => ({
        ...prev,
        [trackId]: 0
      }));
      
      // Create audio element
      const result = await audioCore.createAudioElement(
        layer, 
        trackId, 
        track.path, 
        0, // Initial volume 0
        (progress) => {
          // Update preload progress
          setPreloadProgress(prev => ({
            ...prev,
            [trackId]: progress
          }));
        }
      );
      
      // Clear preload progress when complete
      setPreloadProgress(prev => {
        const newState = {...prev};
        delete newState[trackId];
        return newState;
      });
      
      return !!result;
    } catch (error) {
      console.error(`Error preloading audio: ${error.message}`);
      
      // Clear preload progress on error
      setPreloadProgress(prev => {
        const newState = {...prev};
        delete newState[trackId];
        return newState;
      });
      
      return false;
    }
  }, [audioCore, bufferManager, audioLibrary]);
  
  /**
   * Reset timeline event index
   */
  const resetTimelineEventIndex = useCallback(() => {
    if (timelineEngine) {
      timelineEngine.resetTimelineEventIndex();
    }
  }, [timelineEngine]);
  
  /**
   * Update timeline phases
   */
  const updateTimelinePhases = useCallback((phases) => {
    if (!phases || !Array.isArray(phases)) return;
    
    setTimelinePhases(phases);
    
    if (timelineEngine) {
      timelineEngine.setPhases(phases);
    }
    
    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('timeline-update', { 
      detail: { phases }
    }));
  }, [timelineEngine]);
  
  /**
   * Register a state provider for presets
   */
  const registerPresetStateProvider = useCallback((key, providerFn) => {
    if (!key) return;
    
    if (providerFn) {
      // Add or update provider
      setPresetStateProviders(prev => ({
        ...prev,
        [key]: providerFn
      }));
    } else {
      // Remove provider if null function
      setPresetStateProviders(prev => {
        const newProviders = {...prev};
        delete newProviders[key];
        return newProviders;
      });
    }
  }, []);
  
  /**
   * Save current preset
   */
  const savePreset = useCallback((name) => {
    if (!presetStorage || !name || name.trim() === '') return false;
    
    // Collect state from all registered providers
    const state = {};
    
    Object.entries(presetStateProviders).forEach(([key, providerFn]) => {
      if (typeof providerFn === 'function') {
        state[key] = providerFn();
      }
    });
    
    // Always save current volumes and active audio
    state.volumes = {...volumes};
    state.activeAudio = {...activeAudio};
    state.timelinePhases = [...timelinePhases];
    
    // Save using the preset storage service
    return presetStorage.savePreset(name, state);
  }, [presetStorage, volumes, activeAudio, timelinePhases, presetStateProviders]);
  
  /**
   * Load a preset
   */
  const loadPreset = useCallback((name) => {
    if (!presetStorage) return false;
    
    // Load the preset data
    const preset = presetStorage.loadPreset(name);
    if (!preset || !preset.state) {
      return false;
    }
    
    // Apply volumes if present
    if (preset.state.volumes) {
      setVolumes(preset.state.volumes);
      
      // Apply to volume controller
      if (volumeController) {
        Object.entries(preset.state.volumes).forEach(([layer, value]) => {
          volumeController.setLayerVolume(layer, value);
        });
      }
    }
    
    // Apply active audio if present
    if (preset.state.activeAudio) {
      setActiveAudio(preset.state.activeAudio);
    }
    
    // Apply timeline phases if present
    if (preset.state.timelinePhases) {
      setTimelinePhases(preset.state.timelinePhases);
      
      // Update timeline engine
      if (timelineEngine) {
        timelineEngine.setPhases(preset.state.timelinePhases);
      }
      
      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent('timeline-update', { 
        detail: { phases: preset.state.timelinePhases }
      }));
    }
    
    // Dispatch events for other state providers to handle
    Object.entries(preset.state).forEach(([key, value]) => {
      if (key !== 'volumes' && key !== 'activeAudio' && key !== 'timelinePhases') {
        window.dispatchEvent(new CustomEvent(`${key}-update`, { 
          detail: value
        }));
      }
    });
    
    return true;
  }, [presetStorage, volumeController, timelineEngine]);
  
  /**
   * Delete a preset
   */
  const deletePreset = useCallback((name) => {
    if (!presetStorage) return false;
    return presetStorage.deletePreset(name);
  }, [presetStorage]);
  
  /**
   * Get all presets
   */
  const getPresets = useCallback(() => {
    if (!presetStorage) return [];
    return presetStorage.getPresets();
  }, [presetStorage]);
  
  /**
   * Export preset to JSON
   */
  const exportPreset = useCallback((name) => {
    if (!presetStorage) return null;
    return presetStorage.exportPreset(name);
  }, [presetStorage]);
  
  /**
   * Import preset from JSON
   */
  const importPreset = useCallback((jsonString) => {
    if (!presetStorage) return { success: false, error: 'Preset storage not available' };
    return presetStorage.importPreset(jsonString);
  }, [presetStorage]);
  
  // Create memoized context value to reduce unnecessary renders
  const contextValue = useMemo(() => ({
    // Audio Layer Constants
    LAYERS,
    
    // State
    isLoading,
    loadingProgress,
    isPlaying,
    volumes,
    masterVolume,
    activeAudio,
    audioLibrary,
    hasSwitchableAudio,
    isAudioActivated,
    
    // Timeline
    timelinePhases,
    
    // Tracking
    crossfadeProgress,
    activeCrossfades,
    preloadProgress,
    
    // Methods
    activateAudio,
    startSession,
    pauseSession,
    getSessionTime,
    setVolume,
    setMasterVolumeLevel,
    crossfadeTo,
    preloadAudio,
    resetTimelineEventIndex,
    updateTimelinePhases,
    registerPresetStateProvider,
    
    // Preset Management
    savePreset,
    loadPreset,
    deletePreset,
    getPresets,
    exportPreset,
    importPreset
  }), [
    isLoading, loadingProgress, isPlaying, volumes, masterVolume,
    activeAudio, audioLibrary, hasSwitchableAudio, isAudioActivated,
    timelinePhases, crossfadeProgress, activeCrossfades, preloadProgress,
    activateAudio, startSession, pauseSession, getSessionTime,
    setVolume, setMasterVolumeLevel, crossfadeTo, preloadAudio,
    resetTimelineEventIndex, updateTimelinePhases, registerPresetStateProvider,
    savePreset, loadPreset, deletePreset, getPresets, exportPreset, importPreset
  ]);

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  );
};

/**
 * Custom hook to use the audio context
 */
export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

export default AudioContext;