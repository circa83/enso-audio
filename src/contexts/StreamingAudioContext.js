// src/contexts/StreamingAudioContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createAudioServices } from '../services/audio';
import CollectionService from '../services/CollectionService';
import AudioFileService from '../services/AudioFileService';
import { useCollections } from '../hooks/useCollections';
import CollectionLoader from '../services/audio/CollectionLoader';
import createplaybackManager from '../services/audio/PlaybackManager';
import createTimelineManager from '../services/audio/TimelineManager';
import createLayerManager from '../services/audio/LayerManager';
import { mapCollectionToLayers } from '../utils/collectionUtils';

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

// Custom hook for using the audio context
export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

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


 // Timeline features
 const [timelineEvents, setTimelineEvents] = useState([]);
 const [timelinePhases, setTimelinePhases] = useState([]);
 const [activePhase, setActivePhase] = useState(null);
 const [progress, setProgress] = useState(0);
 const [sessionDuration, setSessionDuration] = useState(1 * 60 * 1000); // 1 min
 const [transitionDuration, setTransitionDuration] = useState(4000); // 4 seconds
 const [timelineIsPlaying, setTimelineIsPlaying] = useState(false);

 // Phase loading
 const [phasesLoaded, setPhasesLoaded] = useState(false);


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
  //  Create TimelineManager instance
  //======================

const timelineManager = useMemo(() => createTimelineManager({
  // Refs
  serviceRef,
  
  // State setters
  setTimelineIsPlaying,
  setProgress,
  setActivePhase,
  setTimelineEvents,
  setTimelinePhases,
  setSessionDuration,
  setTransitionDuration,
  
  // State values
  sessionDuration,
  transitionDuration,
  timelineEvents,
  timelinePhases,
  
  // Additional refs/state
  isPlayingRef,
  phasesLoaded,
  setPhasesLoaded
}), [
  // Dependencies
  timelineEvents,
  timelinePhases,
  sessionDuration,
  transitionDuration,
  serviceRef, // Note: If serviceRef is a useRef, you typically don't include it
  setTimelineIsPlaying, // State setters typically don't change, but for consistency
  setProgress,
  setActivePhase,
  setTimelineEvents,
  setTimelinePhases,
  setSessionDuration,
  setTransitionDuration,
  phasesLoaded,
]);


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
  transitionDuration,
  
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
  transitionDuration
]);


 //======================
// Collection Loader
//======================

  const handleLoadCollection = useCallback(
    CollectionLoader({
      // State setters
      setPhasesLoaded,
      setLoadingCollection,
      setCollectionError,
      setCollectionLoadProgress,
      setCurrentCollection,
      setAudioLibrary,

      //Managers
      layerManager,
      timelineManager,

      // Handler functions
      handleStartSession: playbackManager.handleStartSession,
      handlePauseSession: playbackManager.handlePauseSession,
      handleSetSessionDuration: timelineManager.handleSetSessionDuration,
      handleSetTransitionDuration: timelineManager.handleSetTransitionDuration,
      handleUpdateTimelinePhases: timelineManager.handleUpdateTimelinePhases,

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
      timelineManager,
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
    console.log("AudioProvider mounted, initializing services...");

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
            sessionDuration,
            transitionDuration,
            onPhaseChange: (phaseId, phaseData) => {
              if (!isMounted) return;

              console.log(`[STREAMINGSUDIOCONTEXT: intitialize services] PhaseId changed to: ${phaseId}`);
              setActivePhase(phaseId);

              // Instead of directly applying volume changes here, we'll defer to the SessionTimeline
              // component which should handle transitions via the audio services

              // Just broadcast a phase change event that SessionTimeline will listen for
              if (typeof window !== 'undefined') {
                const event = new CustomEvent('timeline-phase-changed', {
                  detail: { phaseId, phaseData }
                });
                window.dispatchEvent(event);
              }
            },
            onScheduledEvent: (event) => {
              if (!isMounted) return;

              console.log('Timeline event triggered:', event);


            },
            onProgress: (progress, elapsedTime) => {
              if (isMounted) setProgress(progress);
            }
          }

        });

        // Store services in ref
        serviceRef.current = services;

        if (isMounted) setLoadingProgress(10);

        // // Initialize audio
        // if (isMounted) await initializeDefaultAudio();

        // You can replace 'your-collection-id' with any collection ID you want to load by default
        if (isMounted) {
          console.log("Loading initial collection...");
          // Don't auto-play since this is the initial load
          handleLoadCollection('Stillness', { autoPlay: false })
            .then(success => {
              console.log(`Initial collection load ${success ? 'succeeded' : 'failed'}`);
            })
            .catch(err => {
              console.error("Error loading initial collection:", err);
            });
        }


        // Check for variation files
        if (isMounted) layerManager.tryLoadVariationFiles();

      } catch (error) {
        console.error("Error initializing audio system:", error);
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
        console.error('Error loading initial collections:', error);

        // Retry with exponential backoff
        if (retryCount < maxRetries) {
          retryCount++;
          const delay = retryDelay * Math.pow(2, retryCount - 1);
          console.log(`Retrying collection load in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
          setTimeout(loadInitialCollections, delay);
        } else {
          console.error('Max retries reached for loading collections');
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
    if (Object.values(audioLibrary).some(layerTracks => layerTracks.length === 0)) {
      console.warn('Detected empty audio library, recovering from ref...');
      setAudioLibrary(audioLibraryRef.current);
    }
  }, [audioLibrary]);

  // Update master volume when state changes
  useEffect(() => {
    if (serviceRef.current.audioCore) {
      serviceRef.current.audioCore.setMasterVolume(masterVolume);
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


      // Timeline functions
      activePhase,
      progress,
      timelineEvents,
      timelinePhases,
      sessionDuration,
      transitionDuration,
      timelineIsPlaying,
      resetTimelineEventIndex: timelineManager.handleResetTimelineEventIndex,
      registerTimelineEvent: timelineManager.handleRegisterTimelineEvent,
      clearTimelineEvents: timelineManager.handleClearTimelineEvents,
      updateTimelinePhases: timelineManager.handleUpdateTimelinePhases,
      seekToTime: timelineManager.handleSeekToTime,
      seekToPercent: timelineManager.handleSeekToPercent,
      setSessionDuration: timelineManager.handleSetSessionDuration,
      setTransitionDuration: timelineManager.handleSetTransitionDuration,
      startTimeline: timelineManager.handleStartTimeline,
      pauseTimeline: timelineManager.handlePauseTimeline,
      resumeTimeline: timelineManager.handleResumeTimeline,
      stopTimeline: timelineManager.handleStopTimeline,
      toggleTimeline: timelineManager.toggleTimeline, 





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
    timelineManager,
    playbackManager,
    layerManager,

    // Function dependencies
    layerManager.setMasterVolume,
    layerManager.setVolume,
    layerManager.crossfadeTo,
    layerManager.switchTrack,

    // Timeline state
    timelineEvents,
    timelinePhases,
    activePhase,
    progress,
    sessionDuration,
    transitionDuration,

    // Timeline functions
    timelineEvents,
    timelinePhases,
    activePhase,
    progress,
    sessionDuration,
    transitionDuration,
    timelineIsPlaying,


    // Collection state
    collections,
    currentCollection,
    isLoadingCollections,
    collectionsError,
    collectionLoadProgress,
    collectionError,
    loadCollections,
    handleLoadCollection,
    
    
    //layer
    layerManager,
  ]);

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  );
};

export default AudioContext;