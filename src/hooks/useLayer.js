// src/hooks/useLayer.js
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLayerContext, LAYER_TYPES } from '../contexts/LayerContext';
import { useCollectionContext } from '../contexts/CollectionContext';
import eventBus, { EVENTS } from '../services/EventBus';

/**
 * Enhanced hook for managing audio layers with comprehensive crossfade integration
 * @returns {Object} Layer management functions and state
 */
export function useLayer() {
  const layerContext = useLayerContext();
  const collectionContext = useCollectionContext();
  
  // Local state to track collection loading status from events
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionError, setCollectionError] = useState(null);
  
  // Subscribe to collection events to provide loading status
  useEffect(() => {
    const handleCollectionLoading = (data) => {
      console.log(`[useLayer] Collection loading started: ${data.collectionId}`);
      setCollectionLoading(true);
      setCollectionError(null);
    };
    
    const handleCollectionLoaded = (data) => {
      console.log(`[useLayer] Collection loaded: ${data.collectionId}`);
      setCollectionLoading(false);
    };
    
    const handleCollectionError = (data) => {
      console.error(`[useLayer] Collection error: ${data.error}`);
      setCollectionLoading(false);
      setCollectionError(data.error);
    };
    
    // Track layer registration events to know when collection is ready for playback
    const handleLayerRegistration = (data) => {
      console.log(`[useLayer] Collection registered with layers: ${data.collectionId}`);
    };
    
    // Subscribe to events
    eventBus.on(EVENTS.COLLECTION_LOADING || 'collection:loading', handleCollectionLoading);
    eventBus.on(EVENTS.COLLECTION_LOADED || 'collection:loaded', handleCollectionLoaded);
    eventBus.on(EVENTS.COLLECTION_ERROR || 'collection:error', handleCollectionError);
    eventBus.on(EVENTS.LAYER_COLLECTION_REGISTERED || 'layer:collectionRegistered', handleLayerRegistration);
    
    return () => {
      // Cleanup event subscriptions
      eventBus.off(EVENTS.COLLECTION_LOADING || 'collection:loading', handleCollectionLoading);
      eventBus.off(EVENTS.COLLECTION_LOADED || 'collection:loaded', handleCollectionLoaded);
      eventBus.off(EVENTS.COLLECTION_ERROR || 'collection:error', handleCollectionError);
      eventBus.off(EVENTS.LAYER_COLLECTION_REGISTERED || 'layer:collectionRegistered', handleLayerRegistration);
    };
  }, []);
  
  // Get tracks available for a specific layer
  const getTracksForLayer = useCallback((layerName) => {
    return layerContext.getTracksForLayer(layerName);
  }, [layerContext]);
  
  // Get active track for a layer
  const getActiveTrack = useCallback((layerName) => {
    return layerContext.getActiveTrack(layerName);
  }, [layerContext]);
  
  // Get all active tracks across all layers
  const getAllActiveTracks = useCallback(() => {
    return { ...layerContext.activeTracks };
  }, [layerContext.activeTracks]);
  
  // Check if a track is currently involved in a crossfade
  const isTrackInCrossfade = useCallback((layerName, trackId) => {
    return layerContext.isTrackInCrossfade(layerName, trackId);
  }, [layerContext]);
  
  // Check if a layer is currently crossfading
  const isLayerCrossfading = useCallback((layerName) => {
    return layerContext.isLayerCrossfading(layerName);
  }, [layerContext]);
  
  // Get crossfade progress for a specific layer (0-1)
  const getCrossfadeProgress = useCallback((layerName) => {
    return layerContext.getCrossfadeProgress(layerName);
  }, [layerContext]);
  
  // Get detailed crossfade info for a layer
  const getCrossfadeInfo = useCallback((layerName) => {
    return layerContext.getCrossfadeInfo(layerName);
  }, [layerContext]);
  
  // Get track preload progress (0-1)
  const getTrackPreloadProgress = useCallback((trackId) => {
    return layerContext.getTrackPreloadProgress(trackId);
  }, [layerContext]);
  
  // Enhanced track change with added options
  const changeTrack = useCallback((layerName, trackId, options = {}) => {
    return layerContext.changeTrack(layerName, trackId, options);
  }, [layerContext]);
  
  // Cancel an active crossfade
  const cancelCrossfade = useCallback((layerName) => {
    return layerContext.cancelCrossfade(layerName);
  }, [layerContext]);
  
  // Preload a specific track
  const preloadTrack = useCallback((layerName, trackId, trackPath) => {
    return layerContext.preloadTrack(layerName, trackId, trackPath);
  }, [layerContext]);
  
  // Get comprehensive data for a single layer
  const getLayerData = useCallback((layerName) => {
    const tracks = getTracksForLayer(layerName);
    const activeTrackId = getActiveTrack(layerName);
    const activeTrack = tracks.find(track => track.id === activeTrackId);
    const layerState = layerContext.layerStates[layerName] || {};
    const isCrossfading = isLayerCrossfading(layerName);
    const crossfadeInfo = getCrossfadeInfo(layerName);
    
    return {
      name: layerName,
      tracks,
      activeTrackId,
      activeTrack,
      isMuted: layerState.muted || false,
      isSolo: layerState.solo || false,
      isCrossfading,
      crossfadeInfo,
      crossfadeProgress: getCrossfadeProgress(layerName)
    };
  }, [
    getTracksForLayer, 
    getActiveTrack, 
    layerContext.layerStates, 
    isLayerCrossfading, 
    getCrossfadeInfo, 
    getCrossfadeProgress
  ]);
  
  // Get all layer data in one call for rendering multiple controls
  const getAllLayerData = useCallback(() => {
    return layerContext.layerList.map(layerName => getLayerData(layerName));
  }, [layerContext.layerList, getLayerData]);
  
  // Get active collection data for the current layers
  const getActiveCollectionInfo = useCallback(() => {
    // Get collection info from the original collection if available
    const collection = collectionContext.currentCollection;
    
    if (!collection) return null;
    
    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      coverImage: collection.coverImage,
      trackCount: Object.values(layerContext.availableTracks)
        .reduce((sum, tracks) => sum + tracks.length, 0)
    };
  }, [collectionContext.currentCollection, layerContext.availableTracks]);
  
  // Trigger a collection to be loaded by ID (convenience method)
  const loadCollection = useCallback((collectionId) => {
    if (!collectionId) {
      console.error('[useLayer] Cannot load collection: No ID provided');
      return Promise.reject(new Error('No collection ID provided'));
    }
    
    // We don't need to do anything special here anymore since
    // LayerContext will auto-register the collection via events
    console.log(`[useLayer] Requesting collection load: ${collectionId}`);
    
    // Emit collection selection event
    eventBus.emit(EVENTS.COLLECTION_SELECTED || 'collection:selected', {
      collectionId,
      source: 'layer',
      timestamp: Date.now()
    });
    
    return collectionContext.getCollection(collectionId);
  }, [collectionContext]);
  
  // Return an organized and enhanced API with consistent explicit naming
  return useMemo(() => ({
    // Constants
    TYPES: LAYER_TYPES,
    
    // Collection integration - all explicit naming
    currentCollection: collectionContext.currentCollection,
    activeCollectionInfo: getActiveCollectionInfo(),
    isCollectionLoading: collectionLoading || collectionContext.isLoading,
    collectionError: collectionError || collectionContext.error,
    loadCollection: loadCollection,
    
    // Layer state access - all explicit naming
    availableTracks: layerContext.availableTracks,
    activeTracks: layerContext.activeTracks,
    layerStates: layerContext.layerStates,
    layerList: layerContext.layerList,
    
    // Enhanced layer data access - all explicit naming
    getLayerData: getLayerData,
    getAllLayerData: getAllLayerData,
    
    // Original layer accessors - all explicit naming
    getTracksForLayer: getTracksForLayer,
    getActiveTrack: getActiveTrack,
    getAllActiveTracks: getAllActiveTracks,
    isLayerMuted: layerContext.isLayerMuted,
    isLayerSolo: layerContext.isLayerSolo,
    
    // Layer operations - all explicit naming
    changeTrack: changeTrack,
    toggleMute: layerContext.toggleMute,
    toggleSolo: layerContext.toggleSolo,
    preloadTrack: preloadTrack,
    
    // Enhanced crossfade functionality - all explicit naming
    isCrossfading: isLayerCrossfading,
    isTrackInCrossfade: isTrackInCrossfade,
    getCrossfadeProgress: getCrossfadeProgress,
    getCrossfadeInfo: getCrossfadeInfo,
    getTrackPreloadProgress: getTrackPreloadProgress,
    cancelCrossfade: cancelCrossfade,
    
    // Add the transitions object expected by LayerControl - explicit naming
    transitions: {
      active: layerContext.crossfadeState?.activeCrossfades || {},
      progress: layerContext.crossfadeState?.progress || {},
      lastOperation: layerContext.crossfadeState?.lastOperation,
      error: layerContext.crossfadeState?.error
    },
    
    // Collection management - all explicit naming
    registerCollection: layerContext.registerCollection,
    loadTracksForCollection: layerContext.loadTracksForCollection
  }), [
    // Dependencies
    layerContext.availableTracks,
    layerContext.activeTracks,
    layerContext.layerStates,
    layerContext.layerList,
    layerContext.isLayerMuted,
    layerContext.isLayerSolo,
    layerContext.toggleMute,
    layerContext.toggleSolo,
    layerContext.registerCollection,
    layerContext.loadTracksForCollection,
    layerContext.crossfadeState,
    collectionContext.currentCollection,
    collectionContext.isLoading,
    collectionContext.error,
    collectionLoading,
    collectionError,
    getTracksForLayer,
    getActiveTrack,
    getAllActiveTracks,
    isLayerCrossfading,
    isTrackInCrossfade,
    getCrossfadeProgress,
    getCrossfadeInfo,
    getTrackPreloadProgress,
    changeTrack,
    cancelCrossfade,
    preloadTrack,
    getLayerData,
    getAllLayerData,
    getActiveCollectionInfo,
    loadCollection
  ]);
}

// Export layer types constants directly
export { LAYER_TYPES } from '../contexts/LayerContext';

// Default export
export default useLayer;
