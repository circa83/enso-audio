// src/contexts/BufferContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import BufferService from '../services/BufferService';
import { useAudioContext } from './AudioContext';
import eventBus, { EVENTS } from '../services/EventBus';

// Create the context
const BufferContext = createContext(null);

/**
 * Provider component for buffer management
 * Handles loading, decoding, and caching of audio files
 */
export const BufferProvider = ({
  children,
  maxCacheSize = 50,
  enableLogging = false
}) => {
  // Get audio context from AudioContext
  const { audioContext, initialized: audioInitialized } = useAudioContext();

  // Service reference
  const [bufferService, setBufferService] = useState(null);

  // Buffer state
  const [initialized, setInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({});
  const [loadingErrors, setLoadingErrors] = useState({});
  const [cacheInfo, setCacheInfo] = useState({
    bufferCount: 0,
    totalMemory: 0,
    totalDuration: 0
  });

  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);
  const pendingLoadsRef = useRef(new Map());

  // Initialize BufferService when AudioContext is initialized
  useEffect(() => {
    if (!audioInitialized || !audioContext) return;

    console.log('[BufferContext] Initializing BufferService...');

    try {
      const service = new BufferService({
        audioContext,
        maxCacheSize,
        enableLogging
      });

      setBufferService(service);
      setInitialized(true);

      console.log('[BufferContext] BufferService initialized successfully');

      // Publish initialization event with standard payload
      eventBus.emit(EVENTS.BUFFER_INITIALIZED || 'buffer:initialized', {
        maxCacheSize,
        enableLogging,
        timestamp: Date.now()
      });

      // Update cache info immediately
      updateCacheInfo(service);

      // Clean up on unmount
      return () => {
        isMountedRef.current = false;
        if (service && typeof service.dispose === 'function') {
          console.log('[BufferContext] Cleaning up BufferService');
          
          // Emit disposal event
          eventBus.emit(EVENTS.BUFFER_DISPOSED || 'buffer:disposed', {
            timestamp: Date.now()
          });
          
          service.dispose();
        }
      };
    } catch (error) {
      console.error('[BufferContext] Error initializing BufferService:', error);
      
      // Emit error event
      eventBus.emit(EVENTS.BUFFER_ERROR || 'buffer:error', {
        operation: 'initialize',
        error: error.message,
        timestamp: Date.now()
      });
      
      return () => {
        isMountedRef.current = false;
      };
    }
  }, [audioInitialized, audioContext, maxCacheSize, enableLogging]);

  // Set mounted ref for cleanup
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Update cache info
  const updateCacheInfo = useCallback((service = bufferService) => {
    if (!service) return;

    const info = service.getCacheInfo();
    setCacheInfo({
      bufferCount: info.bufferCount || 0,
      totalMemory: info.totalMemory || 0,
      totalDuration: info.totalDuration || 0,
      pendingCount: info.pendingCount || 0,
      maxCacheSize: info.maxCacheSize || maxCacheSize
    });
    
    // Emit cache updated event
    eventBus.emit(EVENTS.BUFFER_CACHE_UPDATED || 'buffer:cacheUpdated', {
      bufferCount: info.bufferCount || 0,
      totalMemory: info.totalMemory || 0,
      totalDuration: info.totalDuration || 0,
      pendingCount: info.pendingCount || 0,
      maxCacheSize: info.maxCacheSize || maxCacheSize,
      timestamp: Date.now()
    });
  }, [bufferService, maxCacheSize]);

  // Load an audio buffer
  const loadBuffer = useCallback(async (url, options = {}) => {
    if (!bufferService || !url) {
      console.error('[BufferContext] Cannot load buffer: service unavailable or no URL provided');
      
      // Emit error event
      eventBus.emit(EVENTS.BUFFER_ERROR || 'buffer:error', {
        operation: 'loadBuffer',
        url,
        error: 'Service unavailable or no URL provided',
        timestamp: Date.now()
      });
      
      return null;
    }

    try {
      console.log(`[BufferContext] Loading buffer: ${url}`);
      setIsLoading(true);

      // Emit loading start event
      eventBus.emit(EVENTS.BUFFER_LOADING || 'buffer:loading', {
        url,
        options,
        timestamp: Date.now()
      });

      // Track this URL in the loading progress
      setLoadingProgress(prev => ({
        ...prev,
        [url]: 0
      }));

      // Create a progress handler
      const handleProgress = (progress) => {
        if (!isMountedRef.current) return;

        setLoadingProgress(prev => ({
          ...prev,
          [url]: progress
        }));

        // Emit progress event with standard payload
        eventBus.emit(EVENTS.BUFFER_LOAD_PROGRESS || 'buffer:loadProgress', { 
          url, 
          progress,
          phase: 'download',
          timestamp: Date.now()
        });
      };

      // Store the promise in pendingLoads to prevent duplicates
      let loadPromise;
      if (pendingLoadsRef.current.has(url)) {
        loadPromise = pendingLoadsRef.current.get(url);
        console.log(`[BufferContext] Reusing existing load promise for ${url}`);
      } else {
        loadPromise = bufferService.loadAudioBuffer(url, {
          force: options.force,
          onProgress: handleProgress
        });
        pendingLoadsRef.current.set(url, loadPromise);
      }

      // Wait for loading to complete
      const buffer = await loadPromise;

      // Clear from pending loads
      pendingLoadsRef.current.delete(url);

      // Clear loading progress
      setLoadingProgress(prev => {
        const updated = { ...prev };
        delete updated[url];
        return updated;
      });

      // Clear any previous errors
      setLoadingErrors(prev => {
        const updated = { ...prev };
        delete updated[url];
        return updated;
      });

      // Update cache info
      updateCacheInfo();

      // Emit loaded event with enhanced payload
      eventBus.emit(EVENTS.BUFFER_LOADED || 'buffer:loaded', { 
        url, 
        buffer,
        duration: buffer ? buffer.duration : 0,
        sampleRate: buffer ? buffer.sampleRate : 0,
        numberOfChannels: buffer ? buffer.numberOfChannels : 0,
        timestamp: Date.now()
      });

      return buffer;
    } catch (error) {
      console.error(`[BufferContext] Error loading buffer ${url}:`, error);

      // Clear from pending loads
      pendingLoadsRef.current.delete(url);

      // Store error information
      setLoadingErrors(prev => ({
        ...prev,
        [url]: error.message
      }));

      // Clear loading progress
      setLoadingProgress(prev => {
        const updated = { ...prev };
        delete updated[url];
        return updated;
      });

      // Emit error event with detailed payload
      eventBus.emit(EVENTS.BUFFER_ERROR || 'buffer:error', { 
        url, 
        operation: 'loadBuffer',
        error: error.message,
        timestamp: Date.now()
      });

      throw error;
    } finally {
      // Only set isLoading to false if no more items are loading
      if (pendingLoadsRef.current.size === 0) {
        setIsLoading(false);
      }
    }
  }, [bufferService, updateCacheInfo]);

  // Preload multiple buffers
  const preloadBuffers = useCallback(async (urls, options = {}) => {
    if (!bufferService || !Array.isArray(urls) || urls.length === 0) {
      console.error('[BufferContext] Cannot preload buffers: service unavailable or no URLs provided');
      
      // Emit error event
      eventBus.emit(EVENTS.BUFFER_PRELOAD_ERROR || 'buffer:preloadError', {
        operation: 'preloadBuffers',
        error: 'Service unavailable or no URLs provided',
        timestamp: Date.now()
      });
      
      return new Map();
    }

    try {
      console.log(`[BufferContext] Preloading ${urls.length} buffers`);
      setIsLoading(true);

      // Emit preload start event
      eventBus.emit(EVENTS.BUFFER_PRELOAD_START || 'buffer:preloadStart', {
        urls,
        count: urls.length,
        options,
        timestamp: Date.now()
      });

      // Track overall progress
      const handleProgress = (overallProgress, detailedProgress) => {
        if (!isMountedRef.current) return;

        // Update progress for each URL
        setLoadingProgress(prev => {
          const updated = { ...prev };

          // Update with detailed progress
          Object.entries(detailedProgress).forEach(([url, progress]) => {
            updated[url] = progress;
          });

          return updated;
        });

        // Emit progress event with enhanced payload
        eventBus.emit(EVENTS.BUFFER_PRELOAD_PROGRESS || 'buffer:preloadProgress', { 
          overallProgress, 
          detailedProgress,
          count: urls.length,
          timestamp: Date.now()
        });
      };

      // Preload the buffers
      const results = await bufferService.preloadBuffers(urls, {
        onProgress: handleProgress,
        concurrentLoads: options.concurrentLoads || 3
      });

      // Clean up progress state for completed items
      setLoadingProgress(prev => {
        const updated = { ...prev };
        urls.forEach(url => {
          delete updated[url];
        });
        return updated;
      });

      // Update cache info
      updateCacheInfo();

      // Emit completion event with detailed results
      eventBus.emit(EVENTS.BUFFER_PRELOAD_COMPLETE || 'buffer:preloadComplete', {
        count: results.size,
        urls: Array.from(results.keys()),
        successCount: results.size,
        failedCount: urls.length - results.size,
        timestamp: Date.now()
      });

      return results;
    } catch (error) {
      console.error('[BufferContext] Error preloading buffers:', error);

      // Emit error event
      eventBus.emit(EVENTS.BUFFER_PRELOAD_ERROR || 'buffer:preloadError', { 
        error: error.message,
        urls,
        count: urls.length,
        timestamp: Date.now()
      });

      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [bufferService, updateCacheInfo]);

  // Get a buffer from the cache
  const getBuffer = useCallback((url) => {
    if (!bufferService || !url) return null;
    
    const buffer = bufferService.getBuffer(url);
    
    // Emit cache hit event if buffer was found
    if (buffer) {
      eventBus.emit(EVENTS.BUFFER_CACHE_HIT || 'buffer:cacheHit', {
        url,
        timestamp: Date.now()
      });
    }
    
    return buffer;
  }, [bufferService]);

  // Check if a buffer is in the cache
  const hasBuffer = useCallback((url) => {
    if (!bufferService || !url) return false;
    return bufferService.hasBuffer(url);
  }, [bufferService]);

  // Release a buffer from the cache
  const releaseBuffer = useCallback((url) => {
    if (!bufferService || !url) return false;

    const result = bufferService.releaseBuffer(url);

    if (result) {
      // Update cache info after release
      updateCacheInfo();

      // Emit release event with standard payload
      eventBus.emit(EVENTS.BUFFER_RELEASED || 'buffer:released', { 
        url,
        timestamp: Date.now()
      });
    }

    return result;
  }, [bufferService, updateCacheInfo]);

  // Clear the buffer cache
  const clearCache = useCallback(() => {
    if (!bufferService) return 0;

    const count = bufferService.clearCache();

    // Update cache info after clearing
    updateCacheInfo();

    // Emit clear event with standard payload
    eventBus.emit(EVENTS.BUFFER_CACHE_CLEARED || 'buffer:cacheCleared', { 
      count,
      timestamp: Date.now()
    });

    return count;
  }, [bufferService, updateCacheInfo]);

  // Load audio for a collection track
  const loadCollectionTrack = useCallback(async (track, options = {}) => {
    if (!bufferService || !track || !track.path) {
      console.error('[BufferContext] Cannot load collection track: missing service, track, or path');
      
      // Emit error event
      eventBus.emit(EVENTS.BUFFER_COLLECTION_TRACK_ERROR || 'buffer:collectionTrackError', {
        trackId: track?.id,
        path: track?.path,
        error: 'Missing service, track, or path',
        timestamp: Date.now()
      });
      
      return null;
    }

    try {
      console.log(`[BufferContext] Loading collection track: ${track.name || track.id}`);
      
      // Emit track loading start event
      eventBus.emit(EVENTS.BUFFER_COLLECTION_TRACK_LOAD_START || 'buffer:collectionTrackLoadStart', {
        trackId: track.id,
        path: track.path,
        name: track.name,
        layer: track.layer,
        timestamp: Date.now()
      });

      // Load the audio buffer
      const buffer = await loadBuffer(track.path, options);

      // Emit track loaded event with enhanced payload
      eventBus.emit(EVENTS.BUFFER_COLLECTION_TRACK_LOADED || 'buffer:collectionTrackLoaded', { 
        trackId: track.id,
        path: track.path,
        name: track.name,
        layer: track.layer,
        buffer,
        duration: buffer ? buffer.duration : 0,
        timestamp: Date.now()
      });

      return {
        track,
        buffer,
        success: true
      };
    } catch (error) {
      console.error(`[BufferContext] Error loading collection track ${track.id}:`, error);

      // Emit error event with detailed payload
      eventBus.emit(EVENTS.BUFFER_COLLECTION_TRACK_ERROR || 'buffer:collectionTrackError', { 
        trackId: track.id,
        path: track.path,
        name: track.name,
        layer: track.layer,
        error: error.message,
        timestamp: Date.now()
      });

      return {
        track,
        buffer: null,
        success: false,
        error: error.message
      };
    }
  }, [bufferService, loadBuffer]);

  // Load audio for a collection layer
  const loadCollectionLayer = useCallback(async (layer, tracks, options = {}) => {
    if (!bufferService || !layer || !Array.isArray(tracks) || tracks.length === 0) {
      console.error('[BufferContext] Cannot load collection layer: missing service, layer, or tracks');
      
      // Emit error event
      eventBus.emit(EVENTS.BUFFER_COLLECTION_LAYER_ERROR || 'buffer:collectionLayerError', {
        layer,
        error: 'Missing service, layer, or tracks',
        timestamp: Date.now()
      });
      
      return [];
    }

    try {
      console.log(`[BufferContext] Loading collection layer "${layer}" with ${tracks.length} tracks`);

      // Emit layer loading start event
      eventBus.emit(EVENTS.BUFFER_COLLECTION_LAYER_LOAD_START || 'buffer:collectionLayerLoadStart', {
        layer,
        trackCount: tracks.length,
        tracks: tracks.map(t => ({ id: t.id, name: t.name })),
        timestamp: Date.now()
      });

      // Extract URLs from tracks
      const urls = tracks.map(track => track.path).filter(Boolean);

      // Track ID to URL mapping for later lookup
      const trackIdToUrl = new Map();
      tracks.forEach(track => {
        if (track.path) trackIdToUrl.set(track.id, track.path);
      });

      // Preload all URLs
      const buffers = await preloadBuffers(urls, options);

      // Map buffers back to tracks
      const results = tracks.map(track => {
        const url = track.path;
        const buffer = url ? buffers.get(url) : null;

        return {
          track,
          buffer,
          success: !!buffer
        };
      });

      // Count successful loads
      const successCount = results.filter(r => r.success).length;

      // Emit layer loaded event with detailed results
      eventBus.emit(EVENTS.BUFFER_COLLECTION_LAYER_LOADED || 'buffer:collectionLayerLoaded', {
        layer,
        trackCount: tracks.length,
        loadedCount: successCount,
        successRate: tracks.length > 0 ? (successCount / tracks.length) : 0,
        timestamp: Date.now()
      });

      return results;
    } catch (error) {
      console.error(`[BufferContext] Error loading collection layer ${layer}:`, error);

      // Emit error event with detailed payload
      eventBus.emit(EVENTS.BUFFER_COLLECTION_LAYER_ERROR || 'buffer:collectionLayerError', {
        layer,
        trackCount: tracks.length,
        error: error.message,
        timestamp: Date.now()
      });

      // Return partial results if any
      return tracks.map(track => ({
        track,
        buffer: null,
        success: false,
        error: error.message
      }));
    }
  }, [bufferService, preloadBuffers]);

  // Load all audio for a collection
  const loadCollectionAudio = useCallback(async (collection, options = {}) => {
    if (!bufferService || !collection || !collection.layers) {
      console.error('[BufferContext] Cannot load collection audio: missing service or invalid collection format');
      
      // Emit error event
      eventBus.emit(EVENTS.BUFFER_COLLECTION_LOAD_ERROR || 'buffer:collectionLoadError', {
        collectionId: collection?.id,
        error: 'Missing service or invalid collection format',
        timestamp: Date.now()
      });
      
      return {
        success: false,
        error: 'Missing service or invalid collection format',
        loadedTracks: 0,
        totalTracks: 0
      };
    }

    try {
      // Count total tracks across all layers
      let totalTracks = 0;
      Object.values(collection.layers).forEach(layerTracks => {
        totalTracks += layerTracks.length;
      });

      console.log(`[BufferContext] Loading audio for collection "${collection.name}" with ${totalTracks} tracks`);

      // Emit collection loading start event
      eventBus.emit(EVENTS.BUFFER_COLLECTION_LOAD_START || 'buffer:collectionLoadStart', {
        collectionId: collection.id,
        name: collection.name,
        totalTracks,
        layerCount: Object.keys(collection.layers).length,
        timestamp: Date.now()
      });

      // Track overall progress
      let loadedTracks = 0;
      let failedTracks = 0;
      const layerResults = {};

      // Process each layer
      for (const [layerName, tracks] of Object.entries(collection.layers)) {
        if (!tracks || tracks.length === 0) continue;

        // Create progress handler for this layer
        const layerProgressHandler = options.onLayerProgress ? 
          (progress) => options.onLayerProgress(layerName, progress) : null;

        // Load this layer's tracks
        const layerOptions = {
          ...options,
          onProgress: layerProgressHandler
        };

        // Load layer and track progress
        const results = await loadCollectionLayer(layerName, tracks, layerOptions);
        
        // Store results for this layer
        layerResults[layerName] = results;
        
        // Update counts
        const successfulTracks = results.filter(r => r.success).length;
        loadedTracks += successfulTracks;
        failedTracks += (tracks.length - successfulTracks);

        // Emit layer progress event
        eventBus.emit(EVENTS.BUFFER_COLLECTION_LOAD_PROGRESS || 'buffer:collectionLoadProgress', {
          collectionId: collection.id,
          layer: layerName,
          loadedTracks,
          totalTracks,
          progress: totalTracks > 0 ? (loadedTracks / totalTracks) * 100 : 0,
          timestamp: Date.now()
        });
      }

      // Determine overall success
      const allTracksLoaded = loadedTracks === totalTracks;
      
      // Emit appropriate completion event
      if (allTracksLoaded) {
        eventBus.emit(EVENTS.BUFFER_COLLECTION_LOAD_COMPLETE || 'buffer:collectionLoadComplete', {
          collectionId: collection.id,
          name: collection.name,
          loadedTracks,
          totalTracks,
          layerResults: Object.keys(layerResults).reduce((acc, layer) => {
            acc[layer] = {
              total: layerResults[layer].length,
              loaded: layerResults[layer].filter(r => r.success).length
            };
            return acc;
          }, {}),
          timestamp: Date.now()
        });
      } else {
        eventBus.emit(EVENTS.BUFFER_COLLECTION_LOAD_PARTIAL || 'buffer:collectionLoadPartial', {
          collectionId: collection.id,
          name: collection.name,
          loadedTracks,
          failedTracks,
          totalTracks,
          successRate: totalTracks > 0 ? (loadedTracks / totalTracks) : 0,
          layerResults: Object.keys(layerResults).reduce((acc, layer) => {
            acc[layer] = {
              total: layerResults[layer].length,
              loaded: layerResults[layer].filter(r => r.success).length
            };
            return acc;
          }, {}),
          timestamp: Date.now()
        });
      }

      return {
        success: true,
        loadedTracks,
        failedTracks,
        totalTracks,
        layerResults,
        complete: allTracksLoaded
      };
    } catch (error) {
      console.error(`[BufferContext] Error loading collection audio: ${error.message}`);

      // Emit error event
      eventBus.emit(EVENTS.BUFFER_COLLECTION_LOAD_ERROR || 'buffer:collectionLoadError', {
        collectionId: collection.id,
        name: collection.name,
        error: error.message,
        timestamp: Date.now()
      });

      return {
        success: false,
        error: error.message,
        loadedTracks: 0,
        totalTracks: 0
      };
    }
  }, [bufferService, loadCollectionLayer]);

  // Listen for collection selection events to auto-load buffers
  useEffect(() => {
    if (!bufferService || !initialized) return;
    
    const handleCollectionSelected = async (data) => {
      if (!data.collection) return;
      
      console.log(`[BufferContext] Collection selected event received: ${data.collection.name || data.collectionId}`);
      
      // Check if we should preload buffers
      if (data.preloadBuffers === false) {
        console.log('[BufferContext] Skipping buffer preload as requested');
        return;
      }
      
      try {
        // Auto-load collection audio
        await loadCollectionAudio(data.collection, {
          onLayerProgress: (layer, progress) => {
            console.log(`[BufferContext] Loading ${layer}: ${Math.round(progress * 100)}%`);
          }
        });
      } catch (error) {
        console.error(`[BufferContext] Error auto-loading collection audio: ${error.message}`);
      }
    };
    
    // Subscribe to collection selection events
    eventBus.on(EVENTS.COLLECTION_SELECTED || 'collection:selected', handleCollectionSelected);
    
    return () => {
      eventBus.off(EVENTS.COLLECTION_SELECTED || 'collection:selected', handleCollectionSelected);
    };
  }, [bufferService, initialized, loadCollectionAudio]);

  // Create memoized context value
  const contextValue = useMemo(() => ({
    // State
    initialized,
    isLoading,
    loadingProgress,
    loadingErrors,
    cacheInfo,

    // Buffer methods
    loadBuffer,
    preloadBuffers,
    getBuffer,
    hasBuffer,
    releaseBuffer,
    clearCache,

    // Collection integration methods
    loadCollectionTrack,
    loadCollectionLayer,
    loadCollectionAudio,

    // Service access for advanced usage
    service: bufferService
  }), [
    initialized,
    isLoading,
    loadingProgress,
    loadingErrors,
    cacheInfo,
    loadBuffer,
    preloadBuffers,
    getBuffer,
    hasBuffer,
    releaseBuffer,
    clearCache,
    loadCollectionTrack,
    loadCollectionLayer,
    loadCollectionAudio,
    bufferService
  ]);

  return (
    <BufferContext.Provider value={contextValue}>
      {children}
    </BufferContext.Provider>
  );
};

/**
 * Custom hook to use the buffer context
 * @returns {Object} Buffer context value
 */
export const useBufferContext = () => {
  const context = useContext(BufferContext);
  if (!context) {
    throw new Error('useBufferContext must be used within a BufferProvider');
  }
  return context;
};

/**
 * Access the buffer service directly (for service-to-service integration)
 * @returns {Object|null} Buffer service instance
 */
export const useBufferService = () => {
  const context = useContext(BufferContext);
  if (!context) {
    console.warn('useBufferService called outside of BufferProvider');
    return null;
  }
  return context.service;
};

export default BufferContext;

