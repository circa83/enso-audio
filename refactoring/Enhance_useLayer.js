// src/hooks/useLayer.js
import { useCallback, useMemo, useEffect, useRef } from 'react';
import { useLayerContext, LAYER_TYPES } from '../contexts/LayerContext';
import { useCollectionContext } from '../contexts/CollectionContext';
import { useBufferContext } from '../contexts/BufferContext';
import eventBus, { EVENTS } from '../services/EventBus';

export function useLayer() {
  const layerContext = useLayerContext();
  const collectionContext = useCollectionContext();
  const bufferContext = useBufferContext();
  
  // Track collection loading state
  const collectionLoadedRef = useRef(false);
  
  // Auto-monitor URL for collection ID changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const collectionId = params.get('collection');
      
      if (collectionId && !collectionLoadedRef.current) {
        console.log(`[useLayer] Detected collection ID in URL: ${collectionId}`);
        collectionLoadedRef.current = true;
        
        // Load the collection through CollectionContext
        collectionContext.getCollection(collectionId)
          .then(collection => {
            console.log(`[useLayer] Collection loaded: ${collection.name}`);
            
            // Format if needed and register with LayerContext
            const formattedCollection = collection.layers 
              ? collection
              : collectionContext.formatForPlayer(collection);
              
            if (formattedCollection) {
              layerContext.registerCollection(formattedCollection);
              
              // Preload audio buffers
              preloadCollectionAudio(formattedCollection);
            }
          })
          .catch(error => {
            console.error(`[useLayer] Error loading collection: ${error.message}`);
            collectionLoadedRef.current = false;
          });
      }
    }
  }, [collectionContext, layerContext]);
  
  // Preload audio for a collection
  const preloadCollectionAudio = useCallback((collection) => {
    if (!collection || !collection.layers || !bufferContext) return;
    
    console.log(`[useLayer] Preloading audio for collection: ${collection.id}`);
    
    // For each layer, preload tracks
    Object.entries(collection.layers).forEach(([layerName, tracks]) => {
      if (tracks.length > 0) {
        const trackPaths = tracks.map(track => track.path);
        
        bufferContext.preloadBuffers(trackPaths, {
          onProgress: (progress) => {
            console.log(`[useLayer] Preloading ${layerName}: ${Math.round(progress * 100)}%`);
          }
        });
      }
    });
  }, [bufferContext]);
  
  // Get complete props for LayerControl components
  const getLayerControlProps = useCallback((layerName) => {
    const tracks = layerContext.availableTracks[layerName] || [];
    const activeTrackId = layerContext.activeTracks[layerName];
    const isMuted = layerContext.layerStates[layerName]?.muted || false;
    const volume = layerContext.volumeLevels?.[layerName] || 0.5;
    
    return {
      label: layerName.charAt(0).toUpperCase() + layerName.slice(1),
      layer: layerName,
      tracks,
      activeTrackId,
      volume,
      isMuted,
      onVolumeChange: (value) => layerContext.setVolume(layerName, value),
      onTrackChange: (trackId) => layerContext.changeTrack(layerName, trackId, {
        duration: layerContext.transitionDuration || 4000
      }),
      onMuteToggle: () => layerContext.toggleMute(layerName)
    };
  }, [
    layerContext.availableTracks,
    layerContext.activeTracks,
    layerContext.layerStates,
    layerContext.volumeLevels,
    layerContext.setVolume,
    layerContext.changeTrack,
    layerContext.toggleMute,
    layerContext.transitionDuration
  ]);
  
  // Render all layer controls
  const renderLayerControls = useCallback(() => {
    return layerContext.layerList.map(layer => ({
      layerName: layer,
      props: getLayerControlProps(layer)
    }));
  }, [layerContext.layerList, getLayerControlProps]);
  
  // Return an enhanced API
  return useMemo(() => ({
    // Original properties from layerContext
    ...layerContext,
    
    // Enhanced functionality
    getLayerControlProps,
    renderLayerControls,
    preloadCollectionAudio,
    
    // Collection integration
    currentCollection: collectionContext.currentCollection,
    loadCollection: collectionContext.getCollection,
    
    // Collection loading status
    isCollectionLoading: collectionContext.isLoading,
    collectionError: collectionContext.error
  }), [
    layerContext,
    getLayerControlProps,
    renderLayerControls,
    preloadCollectionAudio,
    collectionContext.currentCollection,
    collectionContext.getCollection,
    collectionContext.isLoading,
    collectionContext.error
  ]);
}
