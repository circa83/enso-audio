// src/hooks/useLayer.js
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLayerContext, LAYER_TYPES } from '../contexts/LayerContext';
import { useCollectionContext } from '../contexts/CollectionContext';
import eventBus, { EVENTS } from '../services/EventBus';

/**
 * Enhanced hook for managing audio layers with improved collection integration
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
  
  // Get tracks available for a specific layer (existing method)
  const getTracksForLayer = useCallback((layerName) => {
    return layerContext.availableTracks[layerName] || [];
  }, [layerContext.availableTracks]);
  
  // Get active track for a layer (existing method)
  const getActiveTrack = useCallback((layerName) => {
    return layerContext.activeTracks[layerName];
  }, [layerContext.activeTracks]);
  
  // Get all active tracks across all layers (existing method)
  const getAllActiveTracks = useCallback(() => {
    return { ...layerContext.activeTracks };
  }, [layerContext.activeTracks]);
  
  // Get comprehensive data for a single layer
  const getLayerData = useCallback((layerName) => {
    const tracks = getTracksForLayer(layerName);
    const activeTrackId = getActiveTrack(layerName);
    const activeTrack = tracks.find(track => track.id === activeTrackId);
    const layerState = layerContext.layerStates[layerName] || {};
    
    return {
      name: layerName,
      tracks,
      activeTrackId,
      activeTrack,
      isMuted: layerState.muted || false,
      isSolo: layerState.solo || false
    };
  }, [getTracksForLayer, getActiveTrack, layerContext.layerStates]);
  
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
  
  // Return an organized and enhanced API
  return useMemo(() => ({
    // Constants
    TYPES: LAYER_TYPES,
    
    // Collection integration
    currentCollection: collectionContext.currentCollection,
    activeCollectionInfo: getActiveCollectionInfo(),
    isCollectionLoading: collectionLoading || collectionContext.isLoading,
    collectionError: collectionError || collectionContext.error,
    loadCollection,
    
    // Layer state access (original API)
    availableTracks: layerContext.availableTracks,
    activeTracks: layerContext.activeTracks,
    layerStates: layerContext.layerStates,
    layerList: layerContext.layerList,
    
    // Enhanced layer data access
    getLayerData,
    getAllLayerData,
    
    // Original layer accessors
    getTracksForLayer,
    getActiveTrack,
    getAllActiveTracks,
    getLayerState: layerContext.getLayerState,
    isLayerMuted: layerContext.isLayerMuted,
    
    // Layer operations
    changeTrack: layerContext.changeTrack,
    toggleMute: layerContext.toggleMute,
    soloLayer: layerContext.soloLayer,
    cancelSolo: layerContext.cancelSolo,
    preloadTrack: layerContext.preloadTrack,
    
    // Collection management (original API)
    setLayerTracks: layerContext.setLayerTracks,
    registerCollection: layerContext.registerCollection,
    loadTracksForCollection: layerContext.loadTracksForCollection
  }), [
    // Dependencies
    layerContext.availableTracks,
    layerContext.activeTracks,
    layerContext.layerStates,
    layerContext.layerList,
    layerContext.getLayerState,
    layerContext.isLayerMuted,
    layerContext.changeTrack,
    layerContext.toggleMute, 
    layerContext.soloLayer,
    layerContext.cancelSolo,
    layerContext.preloadTrack,
    layerContext.setLayerTracks,
    layerContext.registerCollection,
    layerContext.loadTracksForCollection,
    collectionContext.currentCollection,
    collectionContext.isLoading,
    collectionContext.error,
    collectionLoading,
    collectionError,
    getTracksForLayer,
    getActiveTrack,
    getAllActiveTracks,
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
