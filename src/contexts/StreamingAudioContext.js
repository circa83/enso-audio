// src/contexts/StreamingAudioContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createAudioServices } from '../services/audio';
import CollectionService from '../services/CollectionService';
import AudioFileService from '../services/AudioFileService';
import { useCollections } from '../hooks/useCollections';
import CollectionLoader from '../services/audio/CollectionLoader';
import createplaybackManager from '../services/audio/PlaybackManager';
import useTimeline from '../hooks/useTimeline';
import createLayerManager from '../services/audio/LayerManager';
import { mapCollectionToLayers } from '../utils/collectionUtils';
import logger from '../services/LoggingService';

// Define our audio layers as a frozen object to prevent modifications
const LAYERS = Object.freeze({
  Layer_1: 'Layer 1',
  Layer_2: 'Layer 2',
  Layer_3: 'Layer 3',
  Layer_4: 'Layer 4'
});

// Default audio files for each layer
const DEFAULT_AUDIO = Object.freeze({
  [LAYERS.Layer_1]: '/samples/default/drone.mp3',
  [LAYERS.Layer_2]: '/samples/default/melody.mp3',
  [LAYERS.Layer_3]: '/samples/default/rhythm.mp3',
  [LAYERS.Layer_4]: '/samples/default/nature.mp3'
});

// Create the context
const AudioContext = createContext(null);

// AudioLibrary 

export const AudioProvider = ({ children }) => {
  // Service references
  const serviceRef = useRef({
    audioCore: null,
    bufferManager: null,
    volumeController: null,
    layerController: null,
    crossfadeEngine: null,
    timelineEngine: null,

  });

  // Collection services
  const collectionService = useMemo(() => new CollectionService({
    enableLogging: true
  }), []);

  const audioFileService = useMemo(() => new AudioFileService({
    enableLogging: true
  }), []);

  //========STATE MANAGMENT=================
  //========================================

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false); // For race condition prevention

  // Master volume control
  const [masterVolume, setMasterVolume] = useState(0.8);

  // Layer volumes
  const [volumes, setVolumes] = useState({
    [LAYERS.Layer_1]: 0.25,
    [LAYERS.Layer_2]: 0.0,
    [LAYERS.Layer_3]: 0.0,
    [LAYERS.Layer_4]: 0.0
  });

  // Track currently active audio elements for each layer
  const [activeAudio, setActiveAudio] = useState({});
  const activeAudioRef = useRef({});

  // Audio library - will store available tracks for each layer
  const [audioLibrary, setAudioLibrary] = useState({
    [LAYERS.Layer_1]: [],
    [LAYERS.Layer_2]: [],
    [LAYERS.Layer_3]: [],
    [LAYERS.Layer_4]: []
  });

  const audioLibraryRef = useRef({
    [LAYERS.Layer_1]: [{
      id: `${LAYERS.Layer_1}1`,
      name: `${LAYERS.Layer_1.charAt(0).toUpperCase() + LAYERS.Layer_1.slice(1)}`,
      path: DEFAULT_AUDIO[LAYERS.Layer_1]
    }],
    [LAYERS.Layer_2]: [{
      id: `${LAYERS.Layer_2}1`,
      name: `${LAYERS.Layer_2.charAt(0).toUpperCase() + LAYERS.Layer_2.slice(1)}`,
      path: DEFAULT_AUDIO[LAYERS.Layer_2]
    }],
    [LAYERS.Layer_3]: [{
      id: `${LAYERS.Layer_3}1`,
      name: `${LAYERS.Layer_3.charAt(0).toUpperCase() + LAYERS.Layer_3.slice(1)}`,
      path: DEFAULT_AUDIO[LAYERS.Layer_3]
    }],
    [LAYERS.Layer_4]: [{
      id: `${LAYERS.Layer_4}1`,
      name: `${LAYERS.Layer_4.charAt(0).toUpperCase() + LAYERS.Layer_4.slice(1)}`,
      path: DEFAULT_AUDIO[LAYERS.Layer_4]
    }]
  });

  // Feature availability
  const [hasSwitchableAudio, setHasSwitchableAudio] = useState(false);

  // Crossfade state tracking for UI feedback
  const [crossfadeProgress, setCrossfadeProgress] = useState({});
  const [activeCrossfades, setActiveCrossfades] = useState({});

  // Track preloading progress
  const [preloadProgress, setPreloadProgress] = useState({});

  // Timeline progress 
  const progressTimerRef = useRef(null);

  // Collection state
  const [currentCollection, setCurrentCollection] = useState(null);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [collectionError, setCollectionError] = useState(null);
  const [collectionLoadProgress, setCollectionLoadProgress] = useState(0);







  //======================
  //  Create PlaybackManager instance
  //======================

  const playbackManager = useMemo(() => createplaybackManager({
    serviceRef,
    isPlayingRef,
    setIsPlaying,
    setPreloadProgress,
    activeAudio,
    volumes,
    audioLibrary
  }), [activeAudio, volumes, audioLibrary]);


 //======================
  // Use the Timeline Hook 
  
  // Use our timeline hook with the timelineEngine from serviceRef
  const timeline = useTimeline({
    timelineEngine: serviceRef.current.timelineEngine,
    isPlaying,
    onPhaseChange: (phaseId, phaseData) => {
      logger.info('StreamingAudioContext', `PhaseId changed to: ${phaseId}`);
      
      // Instead of directly applying volume changes here, we'll defer to the SessionTimeline
      // component which should handle transitions via the audio services

      // Broadcast a phase change event that SessionTimeline will listen for
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('timeline-phase-changed', {
          detail: { phaseId, phaseData }
        });
        window.dispatchEvent(event);
      }
    },
    // Pass the current duration values
    sessionDuration: serviceRef.current.timeline?.getSessionDuration() || (1 * 60 * 1000),
    transitionDuration: serviceRef.current.timeline?.getTransitionDuration() || 4000,
    enableLogging: true
  });

  //======================
  //  Create LayerManager instance
  //======================

  const layerManager = useMemo(() => createLayerManager({
    // Refs
    serviceRef,
    audioLibraryRef,
    activeAudioRef,
    isPlayingRef,

    // State
    audioLibrary,
    activeAudio,
    volumes,

    // State setters
    setAudioLibrary,
    setActiveAudio,
    setVolumes,
    setHasSwitchableAudio,
    setActiveCrossfades,
    setCrossfadeProgress,
    setMasterVolume,

    // Constants
    LAYERS,
    DEFAULT_AUDIO
  }), [
    // Dependencies
    audioLibrary,
    activeAudio,
    volumes,
    
  ]);


  //======================
  // Collection Loader
  //======================

  const handleLoadCollection = useCallback(
    CollectionLoader({
      // State setters
      setPhasesLoaded : timeline.setPhasesLoaded, 
      setActivePhase : timeline.setActivePhase,
      setLoadingCollection,
      setCollectionError,
      setCollectionLoadProgress,
      setCurrentCollection,
      setAudioLibrary,

      //Managers
      layerManager,
      timeline,

      // Handler functions
      handleStartSession: playbackManager.handleStartSession,
      handlePauseSession: playbackManager.handlePauseSession,
      handleSetSessionDuration: timeline.setSessionDuration,
      handleSetTransitionDuration: timeline.setTransitionDuration,
      handleUpdateTimelinePhases: timeline.updatePhases,

      // Services
      collectionService,
      audioFileService,

      // Refs
      isPlayingRef,
      audioLibraryRef,
      serviceRef,

      // State
      volumes
    }),
    [
      // Dependencies that should trigger recreation
      layerManager,
      timeline,
      collectionService,
      audioFileService,
      volumes,
      playbackManager
    ]
  );



  //==========INITIALIZE============
  //================================


  // Initialize collection hooks
  const {
    collections,
    isLoading: isLoadingCollections,
    error: collectionsError,
    loadCollections,
    getCollection: fetchCollection
  } = useCollections({
    loadOnMount: false // Change to false to prevent automatic loading
  });

  // Use a ref to track if collections have been loaded
  const collectionsLoadedRef = useRef(false);

  // Initialize services - Only run once on mount
  useEffect(() => {
    let isMounted = true; // For preventing state updates after unmount
    logger.info('StreamingAudioContext', "AudioProvider mounted, initializing services...");

    const initializeServices = async () => {
      if (typeof window === 'undefined') return;

      try {
        if (isMounted) setLoadingProgress(5);

        // Initialize all audio services
        const services = await createAudioServices({
          audioCore: {
            initialVolume: masterVolume,
            autoResume: true
          },
          volumeController: {
            initialVolumes: volumes
          },
          crossfadeEngine: {
            onProgress: (layer, progress) => {
              if (isMounted) {
                setCrossfadeProgress(prev => ({
                  ...prev,
                  [layer]: progress
                }));
              }
            }
          },
          timelineEngine: {
            sessionDuration: timeline.sessionDuration,
            transitionDuration: timeline.transitionDuration,
            onPhaseChange: (phaseId, phaseData) => {
              if (!isMounted) return;
          
              logger.info('StreamingAudioContext', `PhaseId changed to: ${phaseId}`);
              
              // Update active phase in timeline hook state
              if (timeline && timeline.setActivePhase) {
                timeline.setActivePhase(phaseId);
              }
          
              // Broadcast phase change event
              if (typeof window !== 'undefined') {
                const event = new CustomEvent('timeline-phase-changed', {
                  detail: { phaseId, phaseData }
                });
                window.dispatchEvent(event);
              }
            },
            onScheduledEvent: (event) => {
              if (!isMounted) return;
              logger.info('StreamingAudioContext', 'Timeline event triggered:', event);
            },
            onProgress: (progress, elapsedTime) => {
              if (!isMounted) return;
              
              // Limit logging frequency to avoid console spam
              if (Math.floor(progress * 10) % 10 === 0) { // Log at approximately 10% intervals
                logger.debug('StreamingAudioContext', `Timeline progress: ${progress.toFixed(2)}% at ${elapsedTime}ms`);
              }
              
              // Safely update progress in timeline state if available
              if (timeline && typeof timeline.setProgress === 'function') {
                timeline.setProgress(progress);
              }
            },
            enableLogging: true
          }
        });

        // Store services in ref
        serviceRef.current = services;

        if (isMounted) setLoadingProgress(10);

        // // Initialize audio
        // if (isMounted) await initializeDefaultAudio();

        // You can replace 'your-collection-id' with any collection ID you want to load by default
        if (isMounted) {
          logger.info('StreamingAudioContext', "Loading initial collection...");
          // Don't auto-play since this is the initial load
          handleLoadCollection('Stillness', { autoPlay: false })
            .then(success => {
              logger.info('StreamingAudioContext', `Initial collection load ${success ? 'succeeded' : 'failed'}`);
            })
            .catch(err => {
              logger.error('StreamingAudioContext', "Error loading initial collection:", err);
            });
        }


        // Check for variation files
        if (isMounted) layerManager.tryLoadVariationFiles();

      } catch (error) {
        logger.error('StreamingAudioContext', "Error initializing audio system:", error);
        if (isMounted) {
          setLoadingProgress(100);
          setIsLoading(false);
        }
      }
    };

    initializeServices();

    // Cleanup function
    return () => {
      isMounted = false;

      // Clean up all services
      Object.values(serviceRef.current).forEach(service => {
        if (service && typeof service.dispose === 'function') {
          service.dispose();
        }
      });
    };
  }, []); // Empty dependency array - only run on mount

  //=========EFFECTS===========
  //=========================== 

  // Load collections on mount using useEffect with error handling
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    const loadInitialCollections = async () => {
      if (!isMounted || collectionsLoadedRef.current) return;

      try {
        await loadCollections();
        collectionsLoadedRef.current = true;
      } catch (error) {
        logger.error('StreamingAudioContext', 'Error loading initial collections:', error);

        // Retry with exponential backoff
        if (retryCount < maxRetries) {
          retryCount++;
          const delay = retryDelay * Math.pow(2, retryCount - 1);
          logger.info('StreamingAudioContext', `Retrying collection load in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
          setTimeout(loadInitialCollections, delay);
        } else {
          logger.error('StreamingAudioContext', 'Max retries reached for loading collections');
        }
      }
    };

    loadInitialCollections();

    return () => {
      isMounted = false;
    };
  }, [loadCollections]); // Only run once on mount

  // Sync activeAudioRef with activeAudio state
  useEffect(() => {
    activeAudioRef.current = { ...activeAudio };
  }, [activeAudio]);

  // Then sync the ref with state using an effect
  useEffect(() => {
    audioLibraryRef.current = audioLibrary;
  }, [audioLibrary]);

  // Recover Audio From AudioLibrary if needed
  useEffect(() => {
    if (Object.values(audioLibrary).some(
      layer => Array.isArray(layer) && layer.length > 0
    )) {
      setHasSwitchableAudio(true);
      logger.info('StreamingAudioContext', 'Audio library contains switchable tracks');
    } else {
      setHasSwitchableAudio(false);
      logger.info('StreamingAudioContext', 'Audio library does not contain switchable tracks');
    }
  }, [audioLibrary]);

    // Log when volumes change for debugging
    useEffect(() => {
      logger.debug('StreamingAudioContext', 'Volume state changed:', volumes);
  
      // If we have a volume controller, update its values
      if (serviceRef.current.volumeController) {
        Object.entries(volumes).forEach(([layer, volume]) => {
          serviceRef.current.volumeController.setVolume(layer, volume);
        });
        logger.debug('StreamingAudioContext', 'Applied volume changes to VolumeController');
      }
    }, [volumes]);

  // Update master volume when state changes
  useEffect(() => {
    logger.debug('StreamingAudioContext', `Master volume changed to ${masterVolume}`);
    if (serviceRef.current.audioCore) {
      serviceRef.current.audioCore.setMasterVolume(masterVolume);
      logger.debug('StreamingAudioContext', 'Applied master volume to AudioCore');
    }
  }, [masterVolume]);

 





  // Create a memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => {
    // console.log("Creating memoized context value with volumes:", volumes);
    return {
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




      // Audio controls - USE PLAYBACK MANAGER HERE

      startSession: playbackManager.handleStartSession,
      pauseSession: playbackManager.handlePauseSession,
      preloadAudio: playbackManager.handlePreloadAudio,
      getSessionTime: playbackManager.getSessionTime,
      togglePlayback: playbackManager.togglePlayback,

      // Layer and Volume - USE LAYER MANAGER HERE
      masterVolume,
      setMasterVolumeLevel: layerManager.setMasterVolume,
      setVolume: layerManager.setVolume,
      crossfadeTo: layerManager.crossfadeTo,
      fadeLayerVolume: layerManager.fadeVolume,
      switchTrack: layerManager.switchTrack,


     // Timeline state - Use timeline hook properties
     activePhase: timeline.activePhase,
     progress: timeline.progress,
     timelineEvents: timeline.timelineEvents,
     timelinePhases: timeline.timelinePhases,
     sessionDuration: timeline.sessionDuration,
     transitionDuration: timeline.transitionDuration,
     timelineIsPlaying: timeline.isPlaying,
     phasesLoaded: timeline.phasesLoaded,

 // Timeline control methods - Use timeline hook methods
 startTimeline: timeline.start,
 pauseTimeline: timeline.pause,
 resumeTimeline: timeline.resume,
 stopTimeline: timeline.stop,
 resetTimeline: timeline.reset,
 toggleTimeline: timeline.toggle,

        // Timeline content methods - Use timeline hook methods
        resetTimelineEventIndex: timeline.resetEventIndex,
        registerTimelineEvent: timeline.registerEvent,
        clearTimelineEvents: timeline.clearEvents,
        updateTimelinePhases: timeline.updatePhases,
  
        // Timeline navigation methods - Use timeline hook methods
        seekToTime: timeline.seekToTime,
        seekToPercent: timeline.seekToPercent,
  
        // Timeline configuration methods - Use timeline hook methods
        setSessionDuration: timeline.setSessionDuration,
        setTransitionDuration: timeline.setTransitionDuration,

       // Timeline utility methods - Use timeline hook methods
       checkPhaseTransitions: timeline.checkPhaseTransitions,
       updateProgressAndCheckPhases: timeline.updateProgressAndCheckPhases,



      // Constants
      LAYERS,

      // Collection state
      collections,
      currentCollection,
      isLoadingCollections,
      collectionsError,
      collectionLoadProgress,
      collectionError,

      // Collection functions
      loadCollections,
      loadCollection: handleLoadCollection,
      switchTrack: layerManager.switchTrack,

  // Track preloading state
  preloadProgress,

  // Keep the timeline object for direct access if needed
  timeline,

  // Layer API for direct layer operations
  layers: {
    setLayerVolume: layerManager.setVolume,
    fadeLayer: layerManager.fadeVolume,
    switchLayerTrack: layerManager.switchTrack,
    getLayerVolume: (layer) => volumes[layer] || 0,
    getActiveTrack: (layer) => activeAudio[layer] || null,
    getLayerTracks: (layer) => audioLibrary[layer] || []
  },


    };
  }, [
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

    playbackManager,


    // Function dependencies
    layerManager,
    layerManager.setMasterVolume,
    layerManager.setVolume,
    layerManager.crossfadeTo,
    layerManager.switchTrack,



     // Timeline dependencies - use the timeline hook
     timeline.activePhase,
     timeline.progress,
     timeline.timelineEvents,
     timeline.timelinePhases,
     timeline.sessionDuration,
     timeline.transitionDuration,
     timeline.isPlaying,
     timeline.phasesLoaded,
     timeline,

    // Collection state
    collections,
    currentCollection,
    isLoadingCollections,
    collectionsError,
    collectionLoadProgress,
    collectionError,
    loadCollections,
    handleLoadCollection,
    preloadProgress



  ]);

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  );
};

// Export the context hook for component use
export function useAudioContext() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}



export default AudioContext;