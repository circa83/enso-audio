// src/contexts/LayerContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAudioContext } from './AudioContext';
import { useVolumeContext } from './VolumeContext';
import { useCrossfadeContext } from './CrossfadeContext';
import eventBus from '../services/EventBus';

// Layer type constants (source of truth)
export const LAYER_TYPES = {
  LAYER1: 'Layer 1', // Drone
  LAYER2: 'Layer 2', // Melody
  LAYER3: 'Layer 3', // Rhythm
  LAYER4: 'Layer 4'  // Nature
};

// Create context
const LayerContext = createContext(null);

export const LayerProvider = ({ children }) => {
  // Get required services
  const audio = useAudioContext();
  const volume = useVolumeContext();
  const crossfade = useCrossfadeContext();
  
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
  }, []);
  
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
        eventBus.emit('layer:trackChanged', { 
          layer: layerName, 
          trackId,
          previousTrackId: prevTrackId
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
      
      return newState;
    });
  }, [volume]);
  
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
  }, [audio, setLayerTracks]);
  
  // Create value object
  const value = useMemo(() => ({
    // Constants
    TYPES: LAYER_TYPES,
    
    // State
    availableTracks,
    activeTracks,
    layerStates,
    
    // Methods
    setLayerTracks,
    changeTrack,
    toggleMute,
    registerCollection,
    
    // Derived data
    layerList: Object.values(LAYER_TYPES)
  }), [
    availableTracks,
    activeTracks,
    layerStates,
    setLayerTracks,
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
