// src/hooks/useCollectionLoader.js
import { useState, useCallback, useEffect } from 'react';
import { useAudio } from './useAudio';
import CollectionService from '../services/CollectionService';
import AudioFileService from '../services/AudioFileService';

/**
 * Hook for loading collections into the audio engine
 * 
 * @param {Object} options - Configuration options
 * @returns {Object} Collection loading functions and state
 */
export function useCollectionLoader(options = {}) {
  const { autoResolveUrls = true } = options;
  
  // Get the grouped API from useAudio
  const {
    playback,
    volume,
    layers,
    transitions
  } = useAudio();
  
  const [currentCollection, setCurrentCollection] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState(null);
  
  const collectionService = new CollectionService({
    enableLogging: true
  });
  
  const audioFileService = new AudioFileService({
    enableLogging: true
  });
  
  // Load a collection by ID
  const loadCollection = useCallback(async (collectionId, options = {}) => {
    const { 
      autoPlay = false,
      fadeInDuration = 2000,
      initialVolumes = {
        // Updated to use Layer folders instead of types
        Layer_1: 0.6,
        Layer_2: 0,
        Layer_3: 0,
        Layer_4: 0
      }
    } = options;
    
    if (!collectionId) {
      console.error('[useCollectionLoader] No collection ID provided');
      return false;
    }
    
    try {
      setIsLoading(true);
      setLoadingProgress(0);
      setError(null);
      
      console.log(`[useCollectionLoader] Loading collection: ${collectionId}`);
      
      // Pause if currently playing
      if (playback.isPlaying) {
        await playback.pause();
      }
      
      // Load collection data
      const result = await collectionService.getCollection(collectionId);
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to load collection');
      }
      
      const collection = result.data;
      setLoadingProgress(20);
      
      console.log(`[useCollectionLoader] Loaded collection: ${collection.name}`);
      
      // Resolve audio URLs if enabled
      let resolvedCollection = collection;
      if (autoResolveUrls) {
        resolvedCollection = await audioFileService.resolveCollectionUrls(collection);
        setLoadingProgress(40);
      }
      
      // Format collection for player consumption
      const formattedCollection = collectionService.formatCollectionForPlayer(resolvedCollection);
      setLoadingProgress(50);
      
      // Track successful layer loads
      const loadedLayers = {};
      
      // For each layer folder, load the first track
      for (const [layerFolder, tracks] of Object.entries(formattedCollection.layers)) {
        if (!tracks || tracks.length === 0) {
          console.log(`[useCollectionLoader] No tracks for layer: ${layerFolder}`);
          continue;
        }
        
        try {
          // Get first track for this layer
          const track = tracks[0];
          
          // Get desired volume for this layer
          const layerVolume = initialVolumes[layerFolder] !== undefined 
            ? initialVolumes[layerFolder]
            : layerFolder === 'Layer_1' ? 0.6 : 0; // Default: Layer_1 on, others off
          
          console.log(`[useCollectionLoader] Loading ${layerFolder}: ${track.id} at volume ${layerVolume}`);
          
          // Set volume for layer using the grouped API
          volume.setLayer(layerFolder, layerVolume, { immediate: true });
          
          // Use crossfade engine to load the track with very short duration
          await layers.crossfadeTo(layerFolder, track.id, 100);
          
          // Track successful load
          loadedLayers[layerFolder] = track.id;
        } catch (layerError) {
          console.error(`[useCollectionLoader] Error loading ${layerFolder}: ${layerError.message}`);
        }
      }
      
      setLoadingProgress(90);
      
      // Start playback if requested
      if (autoPlay && Object.keys(loadedLayers).length > 0) {
        playback.start();
      }
      
      setLoadingProgress(100);
      setCurrentCollection(collection);
      
      console.log(`[useCollectionLoader] Successfully loaded collection: ${collection.name}`);
      return true;
    } catch (err) {
      console.error(`[useCollectionLoader] Error: ${err.message}`);
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [
    collectionService, 
    audioFileService, 
    autoResolveUrls, 
    layers,
    volume,
    playback
  ]);
  
  // Change track for a specific layer
  const switchTrack = useCallback((layerFolder, trackId, options = {}) => {
    const { transitionDuration = 2000 } = options;
    
    if (!layerFolder || !trackId) {
      console.error('[useCollectionLoader] Layer folder and track ID required');
      return false;
    }
    
    try {
      return layers.crossfadeTo(layerFolder, trackId, transitionDuration);
    } catch (err) {
      console.error(`[useCollectionLoader] Error switching track: ${err.message}`);
      return false;
    }
  }, [layers]);
  
  return {
    currentCollection,
    isLoading,
    loadingProgress,
    error,
    loadCollection,
    switchTrack
  };
}

export default useCollectionLoader;