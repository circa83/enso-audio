// src/contexts/LayerContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAudioContext } from './AudioContext';
import { useVolumeContext } from './VolumeContext';
import { useCrossfadeContext } from './CrossfadeContext';
import { useBufferContext } from './BufferContext';
import { useCollectionContext } from './CollectionContext';
import eventBus, { EVENTS } from '../services/EventBus';
import { CROSSFADE_EVENTS } from '../services/CrossfadeService';

// Layer type constants (source of truth)
export const LAYER_TYPES = {
  LAYER1: 'Layer 1', // Drone
  LAYER2: 'Layer 2', // Melody
  LAYER3: 'Layer 3', // Rhythm
  LAYER4: 'Layer 4'  // Nature
};

// Create context
const LayerContext = createContext(null);

/**
 * Provider component for layer management
 * Handles track selection, layer control, and audio crossfading
 */
export const LayerProvider = ({ 
  children,
  dependenciesReady = false,
  isAdapterInitialized = false 
 }) => {
  // Get required services
  const audio = useAudioContext();
  const volume = useVolumeContext();
  const crossfade = useCrossfadeContext();
  const buffer = useBufferContext();
  const collection = useCollectionContext();

  // State
  const [initialized, setInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [availableTracks, setAvailableTracks] = useState({
    [LAYER_TYPES.LAYER1]: [],
    [LAYER_TYPES.LAYER2]: [],
    [LAYER_TYPES.LAYER3]: [],
    [LAYER_TYPES.LAYER4]: []
  });

  const [activeTracks, setActiveTracks] = useState({
    [LAYER_TYPES.LAYER1]: null,
    [LAYER_TYPES.LAYER2]: null,
    [LAYER_TYPES.LAYER3]: null,
    [LAYER_TYPES.LAYER4]: null
  });

  const [layerStates, setLayerStates] = useState({
    [LAYER_TYPES.LAYER1]: { muted: false, solo: false },
    [LAYER_TYPES.LAYER2]: { muted: false, solo: false },
  
    [LAYER_TYPES.LAYER3]: { muted: false, solo: false },
    [LAYER_TYPES.LAYER4]: { muted: false, solo: false }
  });

  // Enhanced state for crossfade tracking
  const [crossfadeState, setCrossfadeState] = useState({
    activeCrossfades: {},
    progress: {},
    lastOperation: null,
    preloadProgress: {},
    error: null
  });

  // Refs
  const isMountedRef = useRef(true);
  const isInitialRender = useRef(true);
  const availableTracksRef = useRef(availableTracks);
const pendingRegistrationsRef = useRef([]);



  // Initialize component and setup refs
  useEffect(() => {
    console.log('[LayerContext] Component mounted, setting isMountedRef to true');
    isMountedRef.current = true;

  // Use the dependenciesReady prop instead of checking each dependency
  if (!dependenciesReady) {
    console.log('[LayerContext] Waiting for dependencies (via prop)...');
    return;
  }
    console.log('[LayerContext] All dependencies initialized, setting context as initialized');
    
    setInitialized(true);
    
     
   // Process any pending registrations
   if (pendingRegistrationsRef.current.length > 0) {
    console.log(`[LayerContext] Processing ${pendingRegistrationsRef.current.length} pending collection registrations`);
    
    // Use setTimeout to ensure state update has completed
    setTimeout(() => {
      // Create a copy of the queue to avoid mutation issues during processing
      const pendingRegistrations = [...pendingRegistrationsRef.current];
      
      // Clear the queue before processing to avoid duplicates
      pendingRegistrationsRef.current = [];
      
      // Process each pending registration
      pendingRegistrations.forEach(collection => {
        console.log(`[LayerContext] Processing queued collection: ${collection.name || collection.id}`);
        
        // Call registerCollection directly with initialized set to true
        try {
          const success = registerCollection(collection);
          console.log(`[LayerContext] Queued collection processed ${success ? 'successfully' : 'with errors'}`);
        } catch (err) {
          console.error(`[LayerContext] Error processing queued collection:`, err);
        }
      });
    }, 0);
  }

    // Publish initialization event
    eventBus.emit(EVENTS.LAYER_INITIALIZED || 'layer:initialized', {
      timestamp: Date.now()
    });

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
    };
  }, [audio, volume, crossfade, buffer]);



  // Update ref when tracks change
  useEffect(() => {
    availableTracksRef.current = availableTracks;
  }, [availableTracks]);

  // Initial render effect
  useEffect(() => {
    // Skip the initial render
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    // Emit event when activeTracks changes
    eventBus.emit(EVENTS.LAYER_ACTIVE_TRACKS_CHANGED || 'layer:activeTracksChanged', {
      activeTracks: { ...activeTracks },
      timestamp: Date.now()
    });
  }, [activeTracks]);

  // Subscribe to crossfade events to track progress
  useEffect(() => {
    // Handler for crossfade started event
    const handleCrossfadeStarted = (data) => {
      if (!isMountedRef.current) return;

      const { layer, from, to, timestamp } = data;

      // Update crossfade state
      setCrossfadeState(prev => ({
        ...prev,
        activeCrossfades: {
          ...prev.activeCrossfades,
          [layer]: { from, to, isLoading: false }
        },
        lastOperation: 'started',
        error: null
      }));

      console.log(`[LayerContext] Crossfade started for ${layer}: ${from} → ${to}`);
    };

    // Handler for crossfade progress event
    const handleCrossfadeProgress = (data) => {
      if (!isMountedRef.current) return;

      const { layer, progress } = data;

      // Update crossfade progress
      setCrossfadeState(prev => ({
        ...prev,
        progress: {
          ...prev.progress,
          [layer]: progress
        }
      }));
    };

    // Handler for crossfade completed event
    const handleCrossfadeCompleted = (data) => {
      if (!isMountedRef.current) return;

      const { layer, timestamp } = data;

      // Remove from active crossfades
      setCrossfadeState(prev => {
        const newActiveCrossfades = { ...prev.activeCrossfades };
        delete newActiveCrossfades[layer];

        const newProgress = { ...prev.progress };
        delete newProgress[layer];

        return {
          ...prev,
          activeCrossfades: newActiveCrossfades,
          progress: newProgress,
          lastOperation: 'completed'
        };
      });

      console.log(`[LayerContext] Crossfade completed for ${layer}`);
    };

    // Handler for crossfade cancelled event
    const handleCrossfadeCancelled = (data) => {
      if (!isMountedRef.current) return;

      const { layer, timestamp } = data;

      // Remove from active crossfades
      setCrossfadeState(prev => {
        const newActiveCrossfades = { ...prev.activeCrossfades };
        delete newActiveCrossfades[layer];

        const newProgress = { ...prev.progress };
        delete newProgress[layer];

        return {
          ...prev,
          activeCrossfades: newActiveCrossfades,
          progress: newProgress,
          lastOperation: 'cancelled'
        };
      });

      console.log(`[LayerContext] Crossfade cancelled for ${layer}`);
    };

    // Handler for crossfade error event
    const handleCrossfadeError = (data) => {
      if (!isMountedRef.current) return;

      const { layer, message, timestamp } = data;

      // Update error state and remove active crossfade
      setCrossfadeState(prev => {
        const newActiveCrossfades = { ...prev.activeCrossfades };
        if (layer) delete newActiveCrossfades[layer];

        const newProgress = { ...prev.progress };
        if (layer) delete newProgress[layer];

        return {
          ...prev,
          activeCrossfades: newActiveCrossfades,
          progress: newProgress,
          lastOperation: 'error',
          error: message
        };
      });

      console.error(`[LayerContext] Crossfade error for ${layer || 'unknown layer'}: ${message}`);
    };

    // Handler for buffer load progress
    const handleBufferLoadProgress = (data) => {
      if (!isMountedRef.current) return;

      const { url, progress, phase } = data;

      // Only track download phase
      if (phase === 'download') {
        // Extract trackId from URL - this might need to be adjusted based on your URL structure
        const trackId = url.split('/').pop().replace(/\.[^/.]+$/, "");

        setCrossfadeState(prev => ({
          ...prev,
          preloadProgress: {
            ...prev.preloadProgress,
            [trackId]: progress
          }
        }));
      }
    };

    // Subscribe to events
    eventBus.on(CROSSFADE_EVENTS.STARTED, handleCrossfadeStarted);
    eventBus.on(CROSSFADE_EVENTS.PROGRESS, handleCrossfadeProgress);
    eventBus.on(CROSSFADE_EVENTS.COMPLETED, handleCrossfadeCompleted);
    eventBus.on(CROSSFADE_EVENTS.CANCELLED, handleCrossfadeCancelled);
    eventBus.on(CROSSFADE_EVENTS.ERROR, handleCrossfadeError);
    eventBus.on(EVENTS.BUFFER_LOAD_PROGRESS || 'buffer:loadProgress', handleBufferLoadProgress);

    return () => {
      // Unsubscribe from events
      eventBus.off(CROSSFADE_EVENTS.STARTED, handleCrossfadeStarted);
      eventBus.off(CROSSFADE_EVENTS.PROGRESS, handleCrossfadeProgress);
      eventBus.off(CROSSFADE_EVENTS.COMPLETED, handleCrossfadeCompleted);
      eventBus.off(CROSSFADE_EVENTS.CANCELLED, handleCrossfadeCancelled);
      eventBus.off(CROSSFADE_EVENTS.ERROR, handleCrossfadeError);
      eventBus.off(EVENTS.BUFFER_LOAD_PROGRESS || 'buffer:loadProgress', handleBufferLoadProgress);
    };
  }, []);

  // Set tracks available for each layer
  const setLayerTracks = useCallback((layerName, tracks) => {
    if (!isMountedRef.current) return;

    console.log(`[LayerContext] Setting ${tracks.length} tracks for ${layerName}`);

    setAvailableTracks(prev => ({
      ...prev,
      [layerName]: tracks
    }));

    // If there's no active track but we have tracks available, set the first as active
    setActiveTracks(prev => {
      if (!prev[layerName] && tracks.length > 0) {
        return {
          ...prev,
          [layerName]: tracks[0].id
        };
      }
      return prev;
    });

    // Preload tracks if buffer service is available
    if (buffer && tracks.length > 0) {
      // Start preloading in the background
      tracks.forEach(track => {
        if (track.path) {
          preloadTrack(layerName, track.id, track.path).catch(err => {
            console.warn(`[LayerContext] Failed to preload track ${track.id}: ${err.message}`);
          });
        }
      });
    }

    // Event emission
    eventBus.emit(EVENTS.LAYER_TRACKS_SET || 'layer:tracksSet', {
      layer: layerName,
      trackCount: tracks.length,
      tracks: tracks.map(t => ({ id: t.id, name: t.name })),
      timestamp: Date.now()
    });
  }, [buffer]);

  // Preload a specific track
  const preloadTrack = useCallback(async (layerName, trackId, trackPath) => {
    if (!isMountedRef.current || !buffer || !trackPath) return false;

    try {
      console.log(`[LayerContext] Preloading track ${trackId} for ${layerName}`);

      // Use CrossfadeContext's preloadAudio method
      if (crossfade && crossfade.preloadAudio) {
        // Update UI to show preloading
        setCrossfadeState(prev => ({
          ...prev,
          preloadProgress: {
            ...prev.preloadProgress,
            [trackId]: 0
          }
        }));

        // Use the preloadAudio method from CrossfadeContext
        const success = await crossfade.preloadAudio(trackPath);

        if (success) {
          console.log(`[LayerContext] Successfully preloaded track ${trackId}`);

          // Clear preload progress indicator
          setCrossfadeState(prev => {
            const newProgress = { ...prev.preloadProgress };
            delete newProgress[trackId];

            return {
              ...prev,
              preloadProgress: newProgress
            };
          });
        }

        return success;
      } else {
        // Fallback to BufferContext's loadAudioBuffer method
        return await buffer.loadAudioBuffer(trackPath);
      }
    } catch (error) {
      console.error(`[LayerContext] Error preloading track ${trackId}: ${error.message}`);
      return false;
    }
  }, [buffer, crossfade]);

  // Load tracks for a collection with progress tracking and buffer preloading
  const loadTracksForCollection = useCallback(async (collection) => {
    if (!isMountedRef.current) return false;

    if (!collection || !collection.layers) {
      const errorMsg = 'Cannot load tracks: Invalid collection format';
      console.error(`[LayerContext] ${errorMsg}`);
      setError(errorMsg);
      return false;
    }

    try {
      console.log(`[LayerContext] Loading tracks for collection: ${collection.id}`);
      setIsLoading(true);
      setError(null);

      // Track loading progress
      let loadedCount = 0;
      let totalTracks = 0;

      // Count total tracks first
      Object.values(collection.layers).forEach(layerTracks => {
        totalTracks += layerTracks.length;
      });

      if (totalTracks === 0) {
        const errorMsg = 'No tracks found in collection';
        console.error(`[LayerContext] ${errorMsg}`);
        setError(errorMsg);
        return false;
      }

      console.log(`[LayerContext] Preparing to load ${totalTracks} tracks`);

      // Process each layer
      for (const [layerName, tracks] of Object.entries(collection.layers)) {
        // Skip empty layers
        if (!tracks || tracks.length === 0) continue;

        console.log(`[LayerContext] Loading ${tracks.length} tracks for ${layerName}`);

        // First register tracks with layer manager
        setLayerTracks(layerName, tracks);

        // Pre-load buffers using CrossfadeContext's preloadCollection method if available
        if (crossfade && crossfade.preloadCollection) {
          try {
            // Use enhanced preloading from CrossfadeContext
            await crossfade.preloadCollection(tracks, {
              onProgress: (progress, trackId) => {
                if (!isMountedRef.current) return;

                // Emit progress event for UI feedback
                eventBus.emit(EVENTS.LAYER_LOAD_PROGRESS || 'layer:loadProgress', {
                  layer: layerName,
                  trackId: trackId,
                  progress,
                  loaded: loadedCount,
                  total: totalTracks,
                  timestamp: Date.now()
                });
              }
            });
          } catch (error) {
            console.warn(`[LayerContext] Error preloading with CrossfadeContext for ${layerName}: ${error.message}`);
          }
        }
        // Fallback to BufferContext preloading
        else if (buffer) {
          try {
            await buffer.preloadBuffers(
              tracks.map(track => track.path),
              {
                onProgress: (progress) => {
                  if (!isMountedRef.current) return;

                  // Emit progress event for UI feedback
                  eventBus.emit(EVENTS.LAYER_LOAD_PROGRESS || 'layer:loadProgress', {
                    layer: layerName,
                    progress,
                    loaded: loadedCount,
                    total: totalTracks,
                    timestamp: Date.now()
                  });
                }
              }
            );
          } catch (error) {
            console.warn(`[LayerContext] Error preloading buffers for ${layerName}: ${error.message}`);
          }
        }

        // Update loaded count
        loadedCount += tracks.length;

        // If this is the first track loaded, initialize audio elements
        if (tracks.length > 0) {
          const firstTrack = tracks[0];

          // Check if we already have an active track for this layer
          if (!activeTracks[layerName]) {
            // Initialize with audio context first
            audio.getOrCreateAudioElement(layerName, firstTrack.id, {
              path: firstTrack.path,
              name: firstTrack.name,
              loop: true,
              isActive: true,
              preload: true
            });

            // Set as active track
            setActiveTracks(prev => ({
              ...prev,
              [layerName]: firstTrack.id
            }));
          }
        }
      }

      console.log(`[LayerContext] Successfully loaded ${loadedCount}/${totalTracks} tracks`);

      // Emit completed event
      eventBus.emit(EVENTS.LAYER_LOAD_COMPLETE || 'layer:loadComplete', {
        collectionId: collection.id,
        trackCount: loadedCount,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      if (!isMountedRef.current) return false;

      console.error(`[LayerContext] Error loading tracks: ${error.message}`);
      setError(error.message);

      // Emit error event
      eventBus.emit(EVENTS.LAYER_ERROR || 'layer:error', {
        operation: 'loadTracksForCollection',
        error: error.message,
        timestamp: Date.now()
      });

      return false;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [audio, buffer, crossfade, setLayerTracks, activeTracks]);

  // Is a track currently in a crossfade operation
  const isTrackInCrossfade = useCallback((layerName, trackId) => {
    const activeCrossfade = crossfadeState.activeCrossfades[layerName];
    if (!activeCrossfade) return false;

    return activeCrossfade.from === trackId || activeCrossfade.to === trackId;
  }, [crossfadeState.activeCrossfades]);

  // Get crossfade progress for a specific layer
  const getCrossfadeProgress = useCallback((layerName) => {
    return crossfadeState.progress[layerName] || 0;
  }, [crossfadeState.progress]);

  // Check if a layer is currently crossfading
  const isLayerCrossfading = useCallback((layerName) => {
    return layerName in crossfadeState.activeCrossfades;
  }, [crossfadeState.activeCrossfades]);

  // Get detailed crossfade info for a layer
  const getCrossfadeInfo = useCallback((layerName) => {
    const activeCrossfade = crossfadeState.activeCrossfades[layerName];
    if (!activeCrossfade) return null;

    return {
      from: activeCrossfade.from,
      to: activeCrossfade.to,
      progress: crossfadeState.progress[layerName] || 0,
      isLoading: activeCrossfade.isLoading || false
    };
  }, [crossfadeState.activeCrossfades, crossfadeState.progress]);

  // Get track preload progress
  const getTrackPreloadProgress = useCallback((trackId) => {
    return crossfadeState.preloadProgress[trackId] || 0;
  }, [crossfadeState.preloadProgress]);

  // Change active track with crossfade - Enhanced with CrossfadeContext integration
  const changeTrack = useCallback(async (layerName, trackId, options = {}) => {
    if (!isMountedRef.current) return false;

    // Extract options with defaults
    const {
      duration = 3000,
      onComplete,
      fadeOutOnly = false,
      fadeInOnly = false,
      syncPosition = true,
      stopPrevious = false
    } = typeof options === 'object' ? options : { duration: options };

    // Skip if it's already the active track
    if (activeTracks[layerName] === trackId) {
      console.log(`[LayerContext] Track ${trackId} is already active in ${layerName}`);
      return true;
    }

    // Skip if layer is already in a crossfade
    if (isLayerCrossfading(layerName)) {
      console.log(`[LayerContext] Layer ${layerName} is already in a crossfade operation`);
      return false;
    }

    console.log(`[LayerContext] Changing ${layerName} track from ${activeTracks[layerName]} to ${trackId}`);

    try {
      // 1. Find track information
      const tracks = availableTracksRef.current[layerName] || [];
      const track = tracks.find(t => t.id === trackId);

      if (!track) {
        throw new Error(`Track ${trackId} not found in ${layerName}`);
      }

      // 2. Mark as loading in crossfade state
      setCrossfadeState(prev => ({
        ...prev,
        activeCrossfades: {
          ...prev.activeCrossfades,
          [layerName]: {
            from: activeTracks[layerName],
            to: trackId,
            isLoading: true
          }
        },
        lastOperation: 'loading'
      }));

      // 3. Preload the track if needed using CrossfadeContext
      let needsPreload = true;

      if (crossfade && crossfade.preloadAudio) {
        try {
          // Use the enhanced preloading from CrossfadeContext
          needsPreload = !(await crossfade.preloadAudio(track.path));
        } catch (error) {
          console.warn(`[LayerContext] Failed to preload with CrossfadeContext: ${error.message}`);
        }
      }

      // 4. If we still need to preload and have a buffer service, use it
      if (needsPreload && buffer) {
        try {
          await buffer.loadAudioBuffer(track.path);
        } catch (error) {
          console.warn(`[LayerContext] Failed to preload with BufferContext: ${error.message}`);
          // Continue anyway, the CrossfadeContext will handle loading
        }
      }

      // 5. Update loading status in crossfade state
      setCrossfadeState(prev => {
        // Skip if this layer is no longer in active crossfades
        if (!prev.activeCrossfades[layerName]) return prev;

        return {
          ...prev,
          activeCrossfades: {
            ...prev.activeCrossfades,
            [layerName]: {
              ...prev.activeCrossfades[layerName],
              isLoading: false
            }
          }
        };
      });

      // 6. Execute crossfade using preferred method
      let success = false;

      // 6.1 First try to use CrossfadeContext's crossfadeToTrack method if available
      if (crossfade && crossfade.crossfadeToTrack) {
        console.log(`[LayerContext] Using CrossfadeContext.crossfadeToTrack for ${layerName}`);

        success = await crossfade.crossfadeToTrack(layerName, {
          fromTrackId: activeTracks[layerName],
          toTrackId: trackId,
          toTrackPath: track.path,
          duration,
          fadeOutOnly,
          fadeInOnly,
          syncPosition,
          stopPrevious
        });
      }
      // 6.2 Fall back to basic executeCrossfade method
      else if (crossfade && crossfade.executeCrossfade) {
        console.log(`[LayerContext] Using CrossfadeContext.executeCrossfade for ${layerName}`);

        // Get previous track's audio element
        const prevTrackId = activeTracks[layerName];
        const sourceElement = audio.getAudioElement(layerName, prevTrackId);
        const sourceNode = audio.getSourceNode(layerName, prevTrackId);

        // Create new audio element and source
        const targetElement = audio.getOrCreateAudioElement(layerName, trackId, {
          path: track.path,
          name: track.name,
          loop: true,
          isActive: false // Will become active after crossfade
        });

        const targetNode = audio.getOrCreateSourceNode(layerName, trackId);

        if (!sourceElement || !targetElement) {
          throw new Error('Failed to get audio elements for crossfade');
        }

        success = await crossfade.executeCrossfade({
          layer: layerName,
          sourceNode,
          sourceElement,
          targetNode,
          targetElement,
          fromTrackId: prevTrackId,
          toTrackId: trackId,
          duration,
          syncPosition
        });
      }
      // 6.3 If all else fails, perform a basic transition
      else {
        console.log(`[LayerContext] No CrossfadeContext methods available, using basic transition for ${layerName}`);

        // Get previous track's audio element
        const prevTrackId = activeTracks[layerName];

        // Create new audio element
        audio.getOrCreateAudioElement(layerName, trackId, {
          path: track.path,
          name: track.name,
          loop: true,
          isActive: true,
          volume: 0
        });

        // Fade out old track
        if (prevTrackId) {
          volume.fadeOut(layerName, prevTrackId, duration / 2);
        }

        // Fade in new track with delay
        setTimeout(() => {
          volume.fadeIn(layerName, trackId, duration / 2);

          // Clean up old track after fade completes
          if (prevTrackId) {
            setTimeout(() => {
              audio.cleanupAudioElement(layerName, prevTrackId);
            }, duration / 2 + 100);
          }
        }, duration / 2);

        success = true;
      }

      // 7. If successful, update active track 
      if (success) {
        // Update active track
        setActiveTracks(prev => ({
          ...prev,
          [layerName]: trackId
        }));

        // Emit track changed event
        eventBus.emit(EVENTS.LAYER_TRACK_CHANGED || 'layer:trackChanged', {
          layer: layerName,
          trackId,
          previousTrackId: activeTracks[layerName],
          duration,
          timestamp: Date.now()
        });

        // Call onComplete callback if provided
        if (onComplete && typeof onComplete === 'function') {
          onComplete(success);
        }

        return true;
      } else {
        throw new Error('Crossfade failed');
      }
    } catch (error) {
      console.error(`[LayerContext] Error changing track: ${error.message}`);

      // Emit error event
      eventBus.emit(EVENTS.LAYER_ERROR || 'layer:error', {
        operation: 'changeTrack',
        layer: layerName,
        trackId,
        error: error.message,
        timestamp: Date.now()
      });

      // Call onComplete callback with failure if provided
      if (onComplete && typeof onComplete === 'function') {
        onComplete(false, error.message);
      }

      // Clear the crossfade state
      setCrossfadeState(prev => {
        const newActiveCrossfades = { ...prev.activeCrossfades };
        delete newActiveCrossfades[layerName];

        const newProgress = { ...prev.progress };
        delete newProgress[layerName];

        return {
          ...prev,
          activeCrossfades: newActiveCrossfades,
          progress: newProgress,
          lastOperation: 'error',
          error: error.message
        };
      });

      return false;
    }
  }, [activeTracks, audio, buffer, crossfade, volume, isLayerCrossfading]);

  // Cancel an active crossfade
  const cancelCrossfade = useCallback((layerName) => {
    if (!isMountedRef.current || !isLayerCrossfading(layerName)) return false;

    console.log(`[LayerContext] Cancelling crossfade for ${layerName}`);

    try {
      // 1. First try to use CrossfadeContext's cancelCrossfade method
      if (crossfade && crossfade.cancelCrossfade) {
        crossfade.cancelCrossfade(layerName);
        return true;
      }

      // 2. If not available, emit a cancellation event that CrossfadeService might be listening for
      eventBus.emit(CROSSFADE_EVENTS.CANCEL || 'crossfade:cancel', {
        layer: layerName,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      console.error(`[LayerContext] Error cancelling crossfade: ${error.message}`);
      return false;
    }
  }, [crossfade, isLayerCrossfading]);

  // Toggle layer mute
  const toggleMute = useCallback((layerName) => {
    if (!isMountedRef.current) return;

    // Update layer state
    setLayerStates(prev => {
      const newState = {
        ...prev,
        [layerName]: {
          ...prev[layerName],
          muted: !prev[layerName].muted
        }
      };

      // Apply to volume
      if (newState[layerName].muted) {
        // If layer is currently in a crossfade, cancel it
        if (isLayerCrossfading(layerName)) {
          cancelCrossfade(layerName);
        }

        volume.muteLayer(layerName);
      } else {
        volume.unmuteLayer(layerName);
      }

      // Emit event
      const isMuted = newState[layerName].muted;
      eventBus.emit(EVENTS.LAYER_MUTE_TOGGLED || 'layer:muteToggled', {
        layer: layerName,
        muted: isMuted,
        timestamp: Date.now()
      });

      return newState;
    });
  }, [volume, isLayerCrossfading, cancelCrossfade]);

  // Toggle solo mode for a layer 
  const toggleSolo = useCallback((layerName) => {
    if (!isMountedRef.current) return;

    setLayerStates(prev => {
      // Get current solo state for this layer
      const currentSolo = prev[layerName].solo;

      // Create new state with updated solo value
      const newState = {
        ...prev,
        [layerName]: {
          ...prev[layerName],
          solo: !currentSolo
        }
      };

      // When enabling solo, mute all other layers
      // When disabling solo, restore all layers
      Object.keys(newState).forEach(layer => {
        if (layer !== layerName) {
          if (!currentSolo) {
            // Enabling solo - mute other layers
            newState[layer].muted = true;

            // Cancel any crossfades on layers being muted
            if (isLayerCrossfading(layer)) {
              cancelCrossfade(layer);
            }

            volume.muteLayer(layer);
          } else {
            // Disabling solo - unmute other layers if they weren't already muted
            if (!prev[layer].muted && newState[layer].muted) {
              newState[layer].muted = false;
              volume.unmuteLayer(layer);
            }
          }
        }
      });

      // Emit event
      eventBus.emit(EVENTS.LAYER_SOLO_TOGGLED || 'layer:soloToggled', {
        layer: layerName,
        solo: !currentSolo,
        timestamp: Date.now()
      });

      return newState;
    });
  }, [volume, isLayerCrossfading, cancelCrossfade]);

  // Get active track for a layer
  const getActiveTrack = useCallback((layerName) => {
    return activeTracks[layerName] || null;
  }, [activeTracks]);

  // Get tracks for a specific layer
  const getTracksForLayer = useCallback((layerName) => {
    return availableTracks[layerName] || [];
  }, [availableTracks]);

  // Check if a layer is muted
  const isLayerMuted = useCallback((layerName) => {
    return layerStates[layerName]?.muted || false;
  }, [layerStates]);

  // Check if a layer is in solo mode
  const isLayerSolo = useCallback((layerName) => {
    return layerStates[layerName]?.solo || false;
  }, [layerStates]);

// Register collection with layers - ENHANCED WITH BETTER LOGGING AND ERROR HANDLING
const registerCollection = useCallback((collection) => {
    // This check helps with queued collections being processed after initialization
    if (!isMountedRef.current) {
      console.error('[LayerContext] Cannot register collection: component unmounted');
      return false;
    }
    
    // When processing from the queue, we're already initialized, so skip this check
    if (!initialized && !pendingRegistrationsRef.current.includes(collection)) {
      console.error('[LayerContext] Cannot register collection: context not initialized');
      
      // Queue the collection for later registration
      if (collection && collection.layers) {
        console.log(`[LayerContext] Queuing collection for registration: ${collection.name || collection.id}`);
        pendingRegistrationsRef.current.push(collection);
        return true; // Return true to indicate successful queuing
      }
      
      return false;
    }

  if (!collection || !collection.layers) {
    console.error('[LayerContext] Invalid collection format', collection);
    setError('Invalid collection format');
    
    // Emit error event
    eventBus.emit(EVENTS.LAYER_ERROR || 'layer:error', {
      operation: 'registerCollection',
      error: 'Invalid collection format',
      timestamp: Date.now()
    });
    
    return false;
  }

  console.log('[LayerContext] Registering collection tracks to layers');
  setIsLoading(true);
  setError(null);

  try {
    // Log detailed information about the collection
    console.log(`[LayerContext] Registering collection "${collection.name}" (${collection.id}) with ${Object.keys(collection.layers).length} layers`);
    
    // Log layers and track counts for diagnostics
    Object.entries(collection.layers).forEach(([layerName, tracks]) => {
      console.log(`[LayerContext] Layer ${layerName}: ${tracks.length} tracks`);
    });

  

    // Then load all the tracks for buffer preloading
    if (buffer && buffer.initialized) {
      loadTracksForCollection(collection)
        .then(success => {
          if (success) {
            console.log('[LayerContext] Successfully loaded tracks for collection');
            eventBus.emit(EVENTS.LAYER_COLLECTION_REGISTERED || 'layer:collectionRegistered', {
              collectionId: collection.id,
              layerCount: Object.keys(collection.layers).length,
              timestamp: Date.now()
            });
          }
        })
        .catch(error => {
          console.error('[LayerContext] Error loading tracks for collection:', error);
          setError(error.message);
        })
        .finally(() => {
          if (isMountedRef.current) {
            setIsLoading(false);
          }
        });
    } else {
      setIsLoading(false);
    }
    
    return true;
  } catch (error) {
    console.error('[LayerContext] Error registering collection:', error);
    setError(error.message);
    setIsLoading(false);
    
    // Emit error event
    eventBus.emit(EVENTS.LAYER_ERROR || 'layer:error', {
      operation: 'registerCollection',
      error: error.message,
      timestamp: Date.now()
    });
    
    return false;
  }
}, [initialized, audio, buffer, setLayerTracks, loadTracksForCollection]);


  // Listen for collection selection events - SIMPLIFIED TO FOCUS ON LAYER REGISTRATION
  useEffect(() => {
    if (!initialized) return;
    
    const handleCollectionSelected = (data) => {
      console.log(`[LayerContext] Debug collection event:`, {
        isMounted: isMountedRef.current, 
        hasData: !!data,
        hasCollection: data && !!data.collection,
        collectionId: data?.collection?.id || 'undefined',
        initialized: initialized
      });
      
      // If component unmounted but data valid, queue for later instead of dropping
      if (!isMountedRef.current && data && data.collection) {
        console.log(`[LayerContext] Component unmounted, queueing collection: ${data.collection.id}`);
        
        // Don't add duplicates
        if (!pendingRegistrationsRef.current.some(c => c.id === data.collection.id)) {
          pendingRegistrationsRef.current.push(data.collection);
          
          // Emit event about the queuing
          eventBus.emit(EVENTS.LAYER_COLLECTION_QUEUED || 'layer:collectionQueued', {
            collectionId: data.collection.id,
            reason: 'component_unmounted',
            timestamp: Date.now()
          });
        }
        return;
      }
      
      // Early exit if invalid data
      if (!data || !data.collection) {
        console.log('[LayerContext] ISSUE IDENTIFIED: Invalid data structure', data);
        return;
      }

// Rest of the handler remains the same...
const collection = data.collection;
console.log(`[LayerContext] Collection selected event received: ${collection.name || collection.id}`);
    // Validate collection structure
    if (!collection.id || !collection.layers) {
      console.error('[LayerContext] Invalid collection format received:', 
        collection.id ? `ID: ${collection.id}` : 'Missing ID');
      
      // Emit error event
      eventBus.emit(EVENTS.LAYER_ERROR || 'layer:error', {
        operation: 'handleCollectionSelected',
        error: 'Invalid collection format',
        details: collection.id ? `Collection ID: ${collection.id}` : 'Missing collection ID',
        timestamp: Date.now()
      });
      return;
    }
  
    // If not initialized, queue this registration for later
    if (!initialized) {
      console.log(`[LayerContext] Context not initialized, queuing collection for later: ${collection.id}`);
      
      // Safely add to queue if not already queued
      if (!pendingRegistrationsRef.current.some(c => c.id === collection.id)) {
        pendingRegistrationsRef.current.push(collection);
        
        // Emit event to notify other systems that processing is pending
        eventBus.emit(EVENTS.LAYER_REGISTRATION_PENDING || 'layer:registrationPending', {
          collectionId: collection.id,
          collectionName: collection.name,
          timestamp: Date.now()
        });
      } else {
        console.log(`[LayerContext] Collection ${collection.id} already queued, skipping duplicate`);
      }
      return;
    }
  
    // Register the collection with layers (this is the core responsibility)
    try {
      const success = registerCollection(collection);
      
      if (success) {
        // Emit registration event with FULL collection object for downstream consumers
        eventBus.emit(EVENTS.LAYER_COLLECTION_REGISTERED || 'layer:collectionRegistered', {
          collectionId: collection.id,
          collection: collection, // Include the full collection object for other contexts
          layerCount: Object.keys(collection.layers || {}).length,
          trackCounts: Object.entries(collection.layers || {}).reduce((counts, [layer, tracks]) => {
            counts[layer] = tracks.length;
            return counts;
          }, {}),
          timestamp: Date.now()
        });
      } else {
        console.error(`[LayerContext] Failed to register collection: ${collection.id}`);
        
        // Emit error event
        eventBus.emit(EVENTS.LAYER_ERROR || 'layer:error', {
          operation: 'registerCollection',
          collectionId: collection.id,
          error: 'Registration failed',
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error(`[LayerContext] Error during collection registration: ${error.message}`, error);
      
      // Emit detailed error event
      eventBus.emit(EVENTS.LAYER_ERROR || 'layer:error', {
        operation: 'registerCollection',
        collectionId: collection.id,
        error: error.message,
        timestamp: Date.now()
      });
    }
  };

  // Subscribe only to collection selection event
  eventBus.on(EVENTS.COLLECTION_SELECTED || 'collection:selected', handleCollectionSelected);

  return () => {
    eventBus.off(EVENTS.COLLECTION_SELECTED || 'collection:selected', handleCollectionSelected);
  };
}, [initialized, registerCollection]);


  // Create memoized context value
  const value = useMemo(() => ({
    // Status
    initialized,
    isLoading,
    error,

    // Constants
    TYPES: LAYER_TYPES,

    // State
    availableTracks,
    activeTracks,
    layerStates,

    // Enhanced crossfade tracking
    crossfadeState: {
      activeCrossfades: crossfadeState.activeCrossfades,
      progress: crossfadeState.progress,
      lastOperation: crossfadeState.lastOperation,
      error: crossfadeState.error
    },

    // Track methods
    setLayerTracks,
    loadTracksForCollection,
    preloadTrack,
    getActiveTrack,
    getTracksForLayer,

    // Layer control methods
    changeTrack,
    toggleMute,
    toggleSolo,
    isLayerMuted,
    isLayerSolo,

    // Crossfade methods
    cancelCrossfade,
    isLayerCrossfading,
    isTrackInCrossfade,
    getCrossfadeProgress,
    getCrossfadeInfo,
    getTrackPreloadProgress,

    // Collection integration
    registerCollection,

    // Derived data
    layerList: Object.values(LAYER_TYPES)
  }), [
    // Dependencies
    initialized,
    isLoading,
    error,
    availableTracks,
    activeTracks,
    layerStates,
    crossfadeState,
    setLayerTracks,
    loadTracksForCollection,
    preloadTrack,
    changeTrack,
    toggleMute,
    toggleSolo,
    isLayerMuted,
    isLayerSolo,
    cancelCrossfade,
    isLayerCrossfading,
    isTrackInCrossfade,
    getCrossfadeProgress,
    getCrossfadeInfo,
    getTrackPreloadProgress,
    registerCollection,
    getActiveTrack,
    getTracksForLayer
  ]);

  return (
    <LayerContext.Provider value={value}>
      {children}
    </LayerContext.Provider>
  );
};

/**
 * Custom hook to use the layer context
 * @returns {Object} Layer context value
 */
export const useLayerContext = () => {
  const context = useContext(LayerContext);
  if (!context) {
    throw new Error('useLayerContext must be used within a LayerProvider');
  }
  return context;
};

/**
 * Enhanced hook for layer functionality with CrossfadeContext integration
 * @returns {Object} Layer management functions and state
 */
export const useLayer = () => {
  const context = useLayerContext();

  // Return a clean API
  return {
    // Status
    initialized: context.initialized,
    isLoading: context.isLoading,
    error: context.error,

    // Layers
    layerList: context.layerList,

    // State accessors
    availableTracks: context.availableTracks,
    activeTracks: context.activeTracks,
    layerStates: context.layerStates,

    // Track access methods
    getTracksForLayer: context.getTracksForLayer,
    getActiveTrack: context.getActiveTrack,

    // Layer control methods
    changeTrack: context.changeTrack,
    toggleMute: context.toggleMute,
    toggleSolo: context.toggleSolo,
    isLayerMuted: context.isLayerMuted,
    isLayerSolo: context.isLayerSolo,

    // Crossfade methods and tracking
    isCrossfading: context.isLayerCrossfading,
    isTrackInCrossfade: context.isTrackInCrossfade,
    getCrossfadeProgress: context.getCrossfadeProgress,
    getCrossfadeInfo: context.getCrossfadeInfo,
    getTrackPreloadProgress: context.getTrackPreloadProgress,
    cancelCrossfade: context.cancelCrossfade,

    // Collection integration
    registerCollection: context.registerCollection,
    loadTracksForCollection: context.loadTracksForCollection,
    preloadTrack: context.preloadTrack,

    // Constants for convenience
    LAYER_TYPES
  };
};

export default LayerContext;
