// src/hooks/useLayer.js
import { useCallback, useMemo } from 'react';
import { useLayerContext, LAYER_TYPES } from '../contexts/LayerContext';
import eventBus, { EVENTS } from '../services/EventBus';

/**
 * Hook for managing audio layers and track selection
 * @returns {Object} Layer management functions and state
 */
export function useLayer() {
  const layerContext = useLayerContext();
  
  // Get tracks available for a specific layer
  const getTracksForLayer = useCallback((layerName) => {
    return layerContext.availableTracks[layerName] || [];
  }, [layerContext.availableTracks]);
  
  // Get active track for a layer
  const getActiveTrack = useCallback((layerName) => {
    return layerContext.activeTracks[layerName];
  }, [layerContext.activeTracks]);
  
  // Get all active tracks across all layers
  const getAllActiveTracks = useCallback(() => {
    return { ...layerContext.activeTracks };
  }, [layerContext.activeTracks]);
  
  // Change track with crossfade transition
  const changeTrack = useCallback((layerName, trackId, options = {}) => {
    const { 
      duration = 3000, // Default crossfade duration 3 seconds
      immediate = false, // Whether to skip crossfade (immediate switch)
      onComplete 
    } = options;
    
    console.log(`[useLayer] Changing ${layerName} track to ${trackId}`);
    
    // If immediate, set active track without crossfade
    if (immediate) {
      // Update directly in context
      const previousTrackId = layerContext.activeTracks[layerName];
      
      // Update in context
      layerContext.setActiveTracks(prev => ({
        ...prev,
        [layerName]: trackId
      }));
      
      // Emit event
      eventBus.emit(EVENTS.LAYER_TRACK_CHANGED || 'layer:trackChanged', { 
        layer: layerName, 
        trackId,
        previousTrackId,
        immediate: true,
        timestamp: Date.now()
      });
      
      if (onComplete) onComplete(true);
      return true;
    }
    
    // Otherwise execute with crossfade
    return layerContext.changeTrack(layerName, trackId, duration)
      .then(success => {
        if (onComplete) onComplete(success);
        return success;
      });
  }, [layerContext]);
  
  // Toggle mute for a layer
  const toggleMute = useCallback((layerName) => {
    return layerContext.toggleMute(layerName);
  }, [layerContext]);
  
  // Get layer state (muted, solo)
  const getLayerState = useCallback((layerName) => {
    return layerContext.layerStates[layerName] || { muted: false, solo: false };
  }, [layerContext.layerStates]);
  
  // Check if a layer is muted
  const isLayerMuted = useCallback((layerName) => {
    return getLayerState(layerName).muted;
  }, [getLayerState]);
  
  // Set all tracks for a layer
  const setLayerTracks = useCallback((layerName, tracks) => {
    return layerContext.setLayerTracks(layerName, tracks);
  }, [layerContext]);
  
  // Register a collection with appropriate layer tracks
  const registerCollection = useCallback((collection) => {
    return layerContext.registerCollection(collection);
  }, [layerContext]);
  
  // Preload a track for a layer
  const preloadTrack = useCallback((layerName, trackId) => {
    const tracks = getTracksForLayer(layerName);
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
      console.error(`[useLayer] Track ${trackId} not found in ${layerName}`);
      return false;
    }
    
    // Emit preload request
    eventBus.emit(EVENTS.LAYER_PRELOAD_TRACK || 'layer:preloadTrack', {
      layer: layerName,
      trackId: trackId,
      path: track.path,
      timestamp: Date.now()
    });
    
    return true;
  }, [getTracksForLayer]);
  
  // Mute all layers except the specified one (solo)
  const soloLayer = useCallback((layerName) => {
    const allLayers = Object.values(LAYER_TYPES);
    
    allLayers.forEach(layer => {
      if (layer === layerName) {
        // Unmute this layer
        if (isLayerMuted(layer)) {
          toggleMute(layer);
        }
      } else {
        // Mute all other layers
        if (!isLayerMuted(layer)) {
          toggleMute(layer);
        }
      }
    });
    
    // Update solo state in context
    layerContext.setLayerStates(prev => {
      const updated = { ...prev };
      
      // Set solo state for all layers
      allLayers.forEach(layer => {
        updated[layer] = {
          ...updated[layer],
          solo: layer === layerName
        };
      });
      
      return updated;
    });
  }, [LAYER_TYPES, isLayerMuted, toggleMute, layerContext]);
  
  // Cancel solo state (unmute all)
  const cancelSolo = useCallback(() => {
    const allLayers = Object.values(LAYER_TYPES);
    
    // Unmute all layers
    allLayers.forEach(layer => {
      if (isLayerMuted(layer)) {
        toggleMute(layer);
      }
    });
    
    // Reset solo state in context
    layerContext.setLayerStates(prev => {
      const updated = { ...prev };
      
      // Clear solo state for all layers
      allLayers.forEach(layer => {
        updated[layer] = {
          ...updated[layer],
          solo: false
        };
      });
      
      return updated;
    });
  }, [LAYER_TYPES, isLayerMuted, toggleMute, layerContext]);
  
  // Organized return value
  return useMemo(() => ({
    // Constants
    TYPES: LAYER_TYPES,
    
    // Layer state access
    availableTracks: layerContext.availableTracks,
    activeTracks: layerContext.activeTracks,
    layerStates: layerContext.layerStates,
    layerList: layerContext.layerList,
    loadTracksForCollection: layerContext.loadTracksForCollection,
    
    // Layer accessors
    getTracksForLayer,
    getActiveTrack,
    getAllActiveTracks,
    getLayerState,
    isLayerMuted,
    
    // Layer operations
    changeTrack,
    toggleMute,
    soloLayer,
    cancelSolo,
    preloadTrack,
    
    // Collection management
    setLayerTracks,
    registerCollection
  }), [
    layerContext.loadTracksForCollection, 
    layerContext.availableTracks,
    layerContext.activeTracks,
    layerContext.layerStates,
    layerContext.layerList,
    getTracksForLayer,
    getActiveTrack,
    getAllActiveTracks,
    getLayerState,
    isLayerMuted,
    changeTrack,
    toggleMute,
    soloLayer,
    cancelSolo,
    preloadTrack,
    setLayerTracks,
    registerCollection
  ]);
}

// Export layer types constants directly
export { LAYER_TYPES } from '../contexts/LayerContext';

// Default export
export default useLayer;
