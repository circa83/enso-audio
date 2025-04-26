// src/contexts/LayerContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAudioContext } from './AudioContext';
import { useVolumeContext } from './VolumeContext';
import { useCrossfadeContext } from './CrossfadeContext';
import { useBufferContext } from './BufferContext';
import { useCollectionContext } from './CollectionContext';
import eventBus, { EVENTS } from '../services/EventBus';

// Layer type constants (source of truth)
export const LAYER_TYPES = {
  LAYER1: 'Layer 1', // Drone
  LAYER2: 'Layer 2', // Melody
  LAYER3: 'Layer 3', // Rhythm
  LAYER4: 'Layer 4'  // Nature
};

// Create context
const LayerContext = createContext(null);
// const collectionContext = useCollectionContext();

export const LayerProvider = ({ children }) => {
  // Get required services
  const audio = useAudioContext();
  const volume = useVolumeContext();
  const crossfade = useCrossfadeContext();
  const buffer = useBufferContext();
  const collection = useCollectionContext();

  // State
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


  // Initial render flag
  const isInitialRender = useRef(true);

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

  // Add this effect after the other useEffects:
useEffect(() => {
  // Function to handle collection loaded events
  const handleCollectionLoaded = (data) => {
    if (!data.collection) return;
    
    console.log(`[LayerContext] Collection loaded event received for: ${data.collectionId}`);
    
    // Format collection if needed before registration
    const formattedCollection = data.collection.layers 
      ? data.collection 
      : useCollectionContext.formatForPlayer(data.collection);
    
    if (formattedCollection) {
      console.log(`[LayerContext] Auto-registering collection: ${formattedCollection.id}`);
      registerCollection(formattedCollection);
    }
  };

  // Set tracks available for each layer
  const setLayerTracks = useCallback((layerName, tracks) => {
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

    // Log for debugging
    console.log(`[LayerContext] Set ${tracks.length} tracks for ${layerName}`);

    // event emission
    eventBus.emit(EVENTS.LAYER_TRACKS_SET || 'layer:tracksSet', {
      layer: layerName,
      trackCount: tracks.length,
      tracks: tracks.map(t => ({ id: t.id, name: t.name })),
      timestamp: Date.now()
    });
  }, []);

  // Load tracks for a collection with progress tracking and buffer preloading
  const loadTracksForCollection = useCallback(async (collection) => {
    if (!collection || !collection.layers) {
      console.error('[LayerContext] Cannot load tracks: Invalid collection format');
      return false;
    }

    console.log(`[LayerContext] Loading tracks for collection: ${collection.id}`);

    try {
      // Track loading progress
      let loadedCount = 0;
      let totalTracks = 0;

      // Count total tracks first
      Object.values(collection.layers).forEach(layerTracks => {
        totalTracks += layerTracks.length;
      });

      if (totalTracks === 0) {
        console.error('[LayerContext] No tracks found in collection');
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

        // Pre-load buffers for this layer if buffer service is available
        if (buffer) {
          try {
            await buffer.preloadBuffers(
              tracks.map(track => track.path),
              {
                onProgress: (progress) => {
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
            // Continue with other layers even if preloading fails for one
          }
        }

        // Update loaded count
        loadedCount += tracks.length;

        // If this is the first track loaded, initialize audio elements
        if (tracks.length > 0 && !activeTracks[layerName]) {
          const firstTrack = tracks[0];
          // Initialize audio element but don't play yet
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

      console.log(`[LayerContext] Successfully loaded ${loadedCount}/${totalTracks} tracks`);

      // Emit completed event
      eventBus.emit(EVENTS.LAYER_LOAD_COMPLETE || 'layer:loadComplete', {
        collectionId: collection.id,
        trackCount: loadedCount,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      console.error(`[LayerContext] Error loading tracks: ${error.message}`);
      return false;
    }
  }, [audio, buffer, setLayerTracks, activeTracks]);

  // Change active track with crossfade
  const changeTrack = useCallback(async (layerName, trackId, transitionDuration = 3000) => {
    // Skip if it's already the active track
    if (activeTracks[layerName] === trackId) {
      console.log(`[LayerContext] Track ${trackId} is already active in ${layerName}`);
      return true;
    }

    console.log(`[LayerContext] Changing ${layerName} track from ${activeTracks[layerName]} to ${trackId}`);

    try {
      // 1. Get previous track's audio element
      const prevTrackId = activeTracks[layerName];
      const sourceElement = audio.getActiveAudioElement(layerName, prevTrackId);
      const sourceNode = audio.getActiveSourceNode(layerName, prevTrackId);

      // 2. Create/get the new track's audio element
      const track = availableTracks[layerName].find(t => t.id === trackId);
      if (!track) {
        throw new Error(`Track ${trackId} not found in ${layerName}`);
      }

      // 3. Create new audio element and source
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

      // 4. Execute crossfade
      const success = await crossfade.executeCrossfade({
        layer: layerName,
        sourceNode,
        sourceElement,
        targetNode,
        targetElement,
        fromTrackId: prevTrackId,
        toTrackId: trackId,
        duration: transitionDuration,
        syncPosition: true
      });

      if (success) {
        // 5. Update active track
        setActiveTracks(prev => ({
          ...prev,
          [layerName]: trackId
        }));

        // 6. Emit event
        eventBus.emit(EVENTS.LAYER_TRACK_CHANGED || 'layer:trackChanged', {
          layer: layerName,
          trackId,
          previousTrackId: prevTrackId,
          timestamp: Date.now()
        });

        return true;
      } else {
        throw new Error('Crossfade failed');
      }
    } catch (error) {
      console.error(`[LayerContext] Error changing track: ${error.message}`);
      return false;
    }
  }, [activeTracks, availableTracks, audio, crossfade]);

  // Toggle layer mute
  const toggleMute = useCallback((layerName) => {
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
        volume.muteLayer(layerName);
      } else {
        volume.unmuteLayer(layerName);
      }

      // Add this event emission (inside setState callback to access new state)
      const isMuted = newState[layerName].muted;
      eventBus.emit(EVENTS.LAYER_MUTE_TOGGLED || 'layer:muteToggled', {
        layer: layerName,
        muted: isMuted,
        timestamp: Date.now()
      });

      return newState;
    });
  }, [volume]);

   // handle collection selected events (in case they don't come with full collection data)
   const handleCollectionSelected = (data) => {
    if (!data.collectionId) return;
    
    console.log(`[LayerContext] Collection selection event received for: ${data.collectionId}`);
    
    // If we already have the collection data in the collection context, use it
    if (collectionContext.currentCollection && 
        collectionContext.currentCollection.id === data.collectionId) {
      
      handleCollectionLoaded({
        collectionId: data.collectionId,
        collection: collectionContext.currentCollection
      });
    }
    // Otherwise we rely on collection context to load it and emit a COLLECTION_LOADED event
  };
  
  // Subscribe to collection events
  eventBus.on(EVENTS.COLLECTION_LOADED || 'collection:loaded', handleCollectionLoaded);
  eventBus.on(EVENTS.COLLECTION_SELECTED || 'collection:selected', handleCollectionSelected);
  
  // Cleanup
  return () => {
    eventBus.off(EVENTS.COLLECTION_LOADED || 'collection:loaded', handleCollectionLoaded);
    eventBus.off(EVENTS.COLLECTION_SELECTED || 'collection:selected', handleCollectionSelected);
  };
}, [useCollectionContext, registerCollection]);

  // Register collection with layers
  const registerCollection = useCallback((collection) => {
    if (!collection || !collection.layers) {
      console.error('[LayerContext] Invalid collection', collection);
      return;
    }

    console.log('[LayerContext] Registering collection tracks to layers');

    // Set tracks for each layer
    Object.entries(collection.layers).forEach(([layerName, tracks]) => {
      setLayerTracks(layerName, tracks);
    });

    // Initialize audio elements for first track in each layer
    Object.entries(collection.layers).forEach(([layerName, tracks]) => {
      if (tracks.length > 0) {
        const firstTrack = tracks[0];
        // Initialize audio element but don't play yet
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
    });

    // Then load all the tracks for buffer preloading
    if (buffer) {
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
        });
    }
  }, [audio, setLayerTracks, buffer, loadTracksForCollection, setActiveTracks]);

  // Create memoized context value - THIS IS THE IMPORTANT ADDITION
  const value = useMemo(() => ({
    // Constants
    TYPES: LAYER_TYPES,

    // State
    availableTracks,
    activeTracks,
    layerStates,

    // Methods
    setLayerTracks,
    loadTracksForCollection,
    changeTrack,
    toggleMute,
    registerCollection,

    // Derived data
    layerList: Object.values(LAYER_TYPES)
  }), [
    // Dependencies - include all values used in the above object
    availableTracks,
    activeTracks,
    layerStates,
    setLayerTracks,
    loadTracksForCollection,
    changeTrack,
    toggleMute,
    registerCollection
  ]);

  return (
    <LayerContext.Provider value={value}>
      {children}
    </LayerContext.Provider>
  );
};

// Hook
export const useLayerContext = () => {
  const context = useContext(LayerContext);
  if (!context) {
    throw new Error('useLayerContext must be used within a LayerProvider');
  }
  return context;
};

export default LayerContext;
