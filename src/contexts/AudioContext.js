// src/contexts/AudioContext.js
import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getAudioCore, createAudioCore } from '../services/audio/AudioCoreFactory';
import { getBufferManager } from '../services/audio/BufferManagerFactory';
import { getCrossfadeEngine } from '../services/audio/CrossfadeEngineFactory';
import { getVolumeController } from '../services/audio/VolumeControllerFactory';
import { getTimelineEngine } from '../services/audio/TimelineEngineFactory';
import { getPresetStorage } from '../services/storage/PresetStorage';

// Define our audio layers
const LAYERS = {
  DRONE: 'drone',
  MELODY: 'melody',
  RHYTHM: 'rhythm',
  NATURE: 'nature'
};

// Default audio files paths - verify these paths are correct
const DEFAULT_AUDIO = {
  [LAYERS.DRONE]: '../samples/default/drone.mp3',
  [LAYERS.MELODY]: '../samples/default/melody.mp3',
  [LAYERS.RHYTHM]: '../samples/default/rhythm.mp3',
  [LAYERS.NATURE]: '../samples/default/nature.mp3'
};

// Create the context
const AudioContext = createContext(null);

export const AudioProvider = ({ children }) => {
  // Service instances
  const [audioCore, setAudioCore] = useState(null);
  const [bufferManager, setBufferManager] = useState(null);
  const [crossfadeEngine, setCrossfadeEngine] = useState(null);
  const [volumeController, setVolumeController] = useState(null);
  const [timelineEngine, setTimelineEngine] = useState(null);
  const [presetStorage, setPresetStorage] = useState(null);
  
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
  const [loadingErrors, setLoadingErrors] = useState([]);
  
  const [isAudioActivated, setIsAudioActivated] = useState(false);
  
  // Tracking states
  const [crossfadeProgress, setCrossfadeProgress] = useState({});
  const [activeCrossfades, setActiveCrossfades] = useState({});
  const [preloadProgress, setPreloadProgress] = useState({});
  const [timelinePhases, setTimelinePhases] = useState([]);
  
  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        setLoadingProgress(10);
        
        // Create AudioCore
        const core = createAudioCore();
        await core.initialize();
        setAudioCore(core);
        console.log("AudioCore initialized successfully");
        setLoadingProgress(20);
        
        // Initialize other services once AudioCore is ready
        const bufferMgr = getBufferManager(core.audioContext);
        setBufferManager(bufferMgr);
        console.log("BufferManager initialized successfully");
        
        setLoadingProgress(30);
        
        const volumeCtrl = getVolumeController(core.audioContext);
        setVolumeController(volumeCtrl);
        console.log("VolumeController initialized successfully");
        
        setLoadingProgress(40);
        
        const crossfadeEng = getCrossfadeEngine(core.audioContext);
        setCrossfadeEngine(crossfadeEng);
        console.log("CrossfadeEngine initialized successfully");
        
        setLoadingProgress(50);
        
        const timelineEng = getTimelineEngine();
        setTimelineEngine(timelineEng);
        console.log("TimelineEngine initialized successfully");
        
        setLoadingProgress(60);
        
        const presetStore = getPresetStorage();
        setPresetStorage(presetStore);
        console.log("PresetStorage initialized successfully");
        
        setLoadingProgress(70);

        // Register gain nodes with volume controller
        Object.values(LAYERS).forEach(layer => {
          const layerId = layer.toLowerCase();
          if (core.gainNodes[layerId]) {
            volumeCtrl.registerGainNode(layerId, core.gainNodes[layerId]);
             console.log(`Registered gain node for ${layerId}`);
          }else {
            console.warn(`No gain node found for ${layerId}`);
          }
        });
        
        // Register master gain node
        if (core.masterGain) {
          volumeCtrl.registerMasterGainNode(core.masterGain);
          console.log('Registered master gain node');
        } else {
          console.warn('No master gain node found');
        }
        
        
        setLoadingProgress(80);
        
        // Set initial volume state
        const initialVolumes = {
          [LAYERS.DRONE]: 0.25,
          [LAYERS.MELODY]: 0.0,
          [LAYERS.RHYTHM]: 0.0,
          [LAYERS.NATURE]: 0.0
        };
        
        // Apply initial volumes
        Object.entries(initialVolumes).forEach(([layer, volume]) => {
          volumeCtrl.setLayerVolume(layer, volume);
        });
        setVolumes(initialVolumes);
        console.log("Initial volumes set:", initialVolumes);
        
        setLoadingProgress(90);
        
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
        console.log("Basic audio library initialized:", basicLibrary);
        
        // Initialize with default audio
        await initializeDefaultAudio(basicLibrary, core);
        
        // Try to load variation files in background
        setTimeout(() => tryLoadVariationFiles(), 1000);
        
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
      
      if (volumeController) {
        volumeController.cleanup();
      }
      
      if (crossfadeEngine) {
        crossfadeEngine.cleanup();
      }
    };
  }, []);
  
  // Initialize default audio elements
  const initializeDefaultAudio = async (library, core) => {
    const totalFiles = Object.values(LAYERS).length;
    let loadedFilesCount = 0;
    const newActiveAudio = {};
    
    console.log('Starting to load default audio files...');
    
    // For each layer, create and load the default audio element
    for (const layer of Object.values(LAYERS)) {
      try {
        const defaultTrack = library[layer][0];
        console.log(`Loading ${layer} track: ${defaultTrack.path}`);
        
        // Verify file exists before loading
        try {
          const response = await fetch(defaultTrack.path, { method: 'HEAD' });
          if (!response.ok) {
            console.error(`File not found: ${defaultTrack.path}`);
            throw new Error(`File not found: ${defaultTrack.path}`);
          }
          console.log(`${defaultTrack.path} verified OK`);
        } catch (fetchError) {
          console.error(`File verification error: ${fetchError.message}`);
          throw fetchError;
        }
        
         // Create audio element through AudioCore
         const result = await core.createAudioElement(
          layer, 
          defaultTrack.id, 
          defaultTrack.path, 
          volumes[layer] || 0
        );
        
        if (!result) {
          console.error(`Failed to create audio element for ${layer}`);
          loadErrors.push(`${layer}: Failed to create audio element`);
          loadedFilesCount++;
          continue;
        }

        console.log(`Successfully loaded ${layer} audio`);
        
        // Set as active audio for this layer
        newActiveAudio[layer] = defaultTrack.id;
        
        // Update progress
        loadedFilesCount++;
        const progress = Math.round((loadedFilesCount / totalFiles) * 20) + 80;
        setLoadingProgress(progress);
        
      } catch (error) {
        console.error(`Error initializing audio for layer ${layer}:`, error);
        // Increment progress anyway to avoid getting stuck
        loadedFilesCount++;
        const progress = Math.round((loadedFilesCount / totalFiles) * 20) + 80;
        setLoadingProgress(progress);
      }
    }
    
    // Update state with loaded audio
    setActiveAudio(newActiveAudio);
    console.log('Active audio set:', newActiveAudio);
    setIsLoading(false);
    setLoadingProgress(100);
  };
   // Activate audio context (for browsers with autoplay policy)
   const activateAudio = useCallback(async () => {
    try {
      if (!audioCore) {
        console.error('Cannot activate audio: AudioCore not initialized');
        return false;
      }
      
      const success = await audioCore.ensureAudioContextResumed();
      if (success) {
        setIsAudioActivated(true);
        console.log('Audio context activated successfully');
      } else {
        console.error('Failed to activate audio context');
      }
      
      return success;
    } catch (error) {
      console.error('Error activating audio:', error);
      return false;
    }
  }, [audioCore]);
  
  // Try to load variation files in background
  const tryLoadVariationFiles = async () => {
    try {
      // Check if variation files exist
      console.log('Checking for variation audio files...');
      const variationPath = 'public/samples/drone/drone_01.mp3';
      console.log(`Testing variation path: ${variationPath}`);

      const response = await fetch('/samples/drone/drone_01.mp3', { method: 'HEAD' });
      
      if (response.ok) {
        console.log('Variation audio files found!');
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
          console.log('Extended library created with variations', extendedLibrary);
          return extendedLibrary;
        });
      }
    } catch (error) {
      console.log('Variation audio files not detected, using defaults only');
    }
  };
  
   // Start session with browser autoplay policy handling
   const startSession = useCallback(async () => {
    if (!audioCore || isPlaying) return false;
    
    try {
      console.log('Attempting to start audio playback...');
      
      // Resume AudioContext if it's suspended (browser autoplay policy)
      if (audioCore.audioContext.state === 'suspended') {
        console.log('AudioContext is suspended, attempting to resume...');
        const resumed = await audioCore.audioContext.resume();
        if (resumed) {
          console.log('AudioContext resumed successfully');
          setIsAudioActivated(true);
        } else {
          console.error('Failed to resume AudioContext');
          return false;
        }
      }
      
      // Check for missing tracks
      if (Object.keys(activeAudio).length === 0) {
        console.error('No active audio tracks available');
        return false;
      }
      
      // Start playback
      const success = await audioCore.startPlayback(activeAudio, volumes);
      
      if (success) {
        setIsPlaying(true);
        setSessionStartTime(Date.now());
        
        // Start timeline if enabled
        if (timelineEngine && timelineEngine.isTimelineEnabled()) {
          timelineEngine.start();
        }
        
        console.log('Audio playback started successfully');
        return true;
      } else {
        console.error('Failed to start audio playback');
        return false;
      }
    } catch (error) {
      console.error('Error starting session:', error);
      return false;
    }
  }, [audioCore, isPlaying, activeAudio, volumes, timelineEngine]);
  
   // Pause session
   const pauseSession = useCallback(() => {
    if (!audioCore || !isPlaying) return false;
    
    try {
      // Pause all audio
      const success = audioCore.pausePlayback();
      
      if (success) {
        setIsPlaying(false);
        
        // Pause timeline
        if (timelineEngine) {
          timelineEngine.pause();
        }
        
        console.log('Audio playback paused successfully');
        return true;
      } else {
        console.error('Failed to pause audio playback');
        return false;
      }
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
    if (!presetStorage || !name || name.trim() === '') return false;
    
    // Create the preset state data
    const state = {
      volumes: { ...volumes },
      activeAudio: { ...activeAudio },
      timelinePhases: [...timelinePhases]
    };
    
    // Save using the preset storage service
    return presetStorage.savePreset(name, state);
  }, [presetStorage, volumes, activeAudio, timelinePhases]);
  
  // Load preset
  const loadPreset = useCallback((name) => {
    if (!presetStorage) return false;
    
    // Load the preset data
    const preset = presetStorage.loadPreset(name);
    if (!preset || !preset.state) {
      return false;
    }
    setVolumes(preset.state.volumes);
    setActiveAudio(preset.state.activeAudio);
    setTimelinePhases(preset.state.timelinePhases);
    return true;
  }, [presetStorage, volumes, activeAudio, timelinePhases]);

    // Provide all necessary values and functions to consumers
    const contextValue = useMemo(() => ({
      // Core audio state
      isLoading,
      loadingProgress,
      loadingErrors,
      isPlaying,
      isAudioActivated,
      
      // Core audio controls
      startSession,
      pauseSession,
      activateAudio,
      
      // Volume controls
      volumes,
      setVolume,
      masterVolume,
      setMasterVolumeLevel,
      
      // Audio content
      audioLibrary,
      activeAudio,
      hasSwitchableAudio,
      
      // Timeline
      timelinePhases,
      getSessionTime: () => audioCore?.getSessionTime() || 0,
      resetTimelineEventIndex,
      updateTimelinePhases,
      
      // Preset management
      savePreset,
      loadPreset,
      deletePreset: () => {}, // Placeholder
      getPresets: () => presetStorage?.getPresets() || [],
      exportPreset: () => {}, // Placeholder 
      importPreset: () => {}, // Placeholder
      
      // Advanced audio management
      crossfadeTo: () => {}, // Will be replaced with actual implementation
      preloadAudio: () => {}, // Placeholder
      enhancedCrossfadeTo, // Enhanced crossfade
      
      // Constants
      LAYERS
    }), [
      isLoading, loadingProgress, loadingErrors, isPlaying, isAudioActivated,
      volumes, masterVolume, audioLibrary, activeAudio, hasSwitchableAudio, 
      timelinePhases, startSession, pauseSession, activateAudio, audioCore
    ]);
  
    return (
      <AudioContext.Provider value={contextValue}>
        {children}
      </AudioContext.Provider>
    );
  };
  
  export const useAudio = () => {
    const context = React.useContext(AudioContext);
    if (!context) {
      throw new Error('useAudio must be used within an AudioProvider');
    }
    return context;
  };
  
  export default AudioContext;