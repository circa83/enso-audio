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
      eventBus.emit(EVENTS.BUFFER_ERROR || 'buffer:error', {
        operation: 'loadCollectionTrack',
        trackId: track?.id,
        error: 'Missing service, track, or path',
        timestamp: Date.now()
      });

      return null;
    }

    try {
      console.log(`[BufferContext] Loading collection track: ${track.name || track.id}`);

      // Emit track loading event
      eventBus.emit(EVENTS.BUFFER_TRACK_LOADING || 'buffer:trackLoading', {
        trackId: track.id,
        path: track.path,
        name: track.name || track.id,
        layer: track.layer,
        timestamp: Date.now()
      });

      // Load the audio buffer
      const buffer = await loadBuffer(track.path, options);

      // Emit track loaded event with enhanced payload
      eventBus.emit(EVENTS.BUFFER_TRACK_LOADED || 'buffer:trackLoaded', {
        trackId: track.id,
        path: track.path,
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

      // Emit error event with detailed track info
      eventBus.emit(EVENTS.BUFFER_TRACK_ERROR || 'buffer:trackError', {
        trackId: track.id,
        path: track.path,
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
      eventBus.emit(EVENTS.BUFFER_ERROR || 'buffer:error', {
        operation: 'loadCollectionLayer',
        layer,
        error: 'Missing service, layer, or tracks',
        timestamp: Date.now()
      });

      return [];
    }

    try {
      console.log(`[BufferContext] Loading collection layer "${layer}" with ${tracks.length} tracks`);

      // Emit layer loading start event
      eventBus.emit(EVENTS.BUFFER_LAYER_LOADING || 'buffer:layerLoading', {
        layer,
        trackCount: tracks.length,
        timestamp: Date.now()
      });

      // Extract URLs from tracks
      const urls = tracks.map(track => track.path).filter(Boolean);

      // Track ID to URL mapping for later lookup
      const trackIdToUrl = new Map();
      tracks.forEach(track => {
        if (track.path) trackIdToUrl.set(track.id, track.path);
      });

      // Preload all URLs with progress tracking
      const buffers = await preloadBuffers(urls, {
        ...options,
        onProgress: (progress, detailedProgress) => {
          // Pass through to options.onProgress if provided
          if (options.onProgress) {
            options.onProgress(progress, detailedProgress);
          }

          // Emit layer-specific progress event
          eventBus.emit(EVENTS.BUFFER_LAYER_PROGRESS || 'buffer:layerProgress', {
            layer,
            progress,
            trackCount: tracks.length,
            timestamp: Date.now()
          });
        }
      });

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

      // Emit layer loaded event with enhanced payload
      eventBus.emit(EVENTS.BUFFER_LAYER_LOADED || 'buffer:layerLoaded', {
        layer,
        trackCount: tracks.length,
        loadedCount: results.filter(r => r.success).length,
        timestamp: Date.now()
      });

      return results;
    } catch (error) {
      console.error(`[BufferContext] Error loading collection layer ${layer}:`, error);

      // Emit error event with enhanced payload
      eventBus.emit(EVENTS.BUFFER_LAYER_ERROR || 'buffer:layerError', {
        layer,
        error: error.message,
        trackCount: tracks.length,
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

  // NEW METHOD: Load all audio for a collection
  const loadCollectionAudio = useCallback(async (collection, options = {}) => {
    if (!bufferService || !collection || !collection.layers) {
      console.error('[BufferContext] Cannot load collection audio: invalid collection or missing service');

      // Emit error event
      eventBus.emit(EVENTS.BUFFER_ERROR || 'buffer:error', {
        operation: 'loadCollectionAudio',
        collectionId: collection?.id,
        error: 'Invalid collection or missing service',
        timestamp: Date.now()
      });

      return {
        success: false,
        error: 'Invalid collection or missing service'
      };
    }

    try {
      console.log(`[BufferContext] Loading audio for collection: ${collection.name || collection.id}`);

      // Set loading state
      setIsLoading(true);

      // Emit collection loading start event
      eventBus.emit(EVENTS.BUFFER_COLLECTION_LOAD_START || 'buffer:collectionLoadStart', {
        collectionId: collection.id,
        name: collection.name,
        timestamp: Date.now()
      });

      // Calculate total tracks to load
      let totalTracks = 0;
      Object.values(collection.layers).forEach(layerTracks => {
        totalTracks += layerTracks.length;
      });

      // Track loaded count and progress
      let loadedTracks = 0;
      let layerProgress = {};

      // Create progress tracking function
      const trackLayerProgress = (layer, progress) => {
        // Store layer progress 
        layerProgress[layer] = progress;

        // Calculate overall progress based on layers
        const layerCount = Object.keys(collection.layers).length;
        const layersWithProgress = Object.keys(layerProgress).length;

        // Weight each layer equally for overall progress
        let overallProgress = 0;
        if (layersWithProgress > 0) {
          const sum = Object.values(layerProgress).reduce((total, p) => total + p, 0);
          overallProgress = Math.round((sum / layerCount) * 100);
        } else {
          // If no layers have reported progress yet, use loaded tracks ratio
          overallProgress = Math.round((loadedTracks / totalTracks) * 100);
        }

        // Emit collection-level progress event
        eventBus.emit(EVENTS.BUFFER_COLLECTION_LOAD_PROGRESS || 'buffer:collectionLoadProgress', {
          collectionId: collection.id,
          progress: overallProgress,
          loadedTracks,
          totalTracks,
          timestamp: Date.now()
        });

        // Call custom progress handler if provided
        if (options.onProgress) {
          options.onProgress(overallProgress, loadedTracks, totalTracks);
        }

        // Call layer-specific progress handler if provided
        if (options.onLayerProgress) {
          options.onLayerProgress(layer, progress);
        }
      };

      // Process each layer
      const results = {};
      let errorCount = 0;

      for (const [layerName, tracks] of Object.entries(collection.layers)) {
        // Skip empty layers
        if (!tracks || tracks.length === 0) continue;

        try {
          console.log(`[BufferContext] Loading layer "${layerName}" with ${tracks.length} tracks`);

          // Load the layer with progress tracking
          const layerResults = await loadCollectionLayer(layerName, tracks, {
            onProgress: (progress) => trackLayerProgress(layerName, progress)
          });

          // Store results
          results[layerName] = layerResults;

          // Update loaded count
          loadedTracks += layerResults.filter(r => r.success).length;

          // Add error count
          errorCount += layerResults.filter(r => !r.success).length;

        } catch (error) {
          console.error(`[BufferContext] Error loading layer "${layerName}": ${error.message}`);

          // Update error count
          errorCount += tracks.length;

          // Store error result
          results[layerName] = tracks.map(track => ({
            track,
            buffer: null,
            success: false,
            error: error.message
          }));
        }
      }

      // Calculate success rate
      const success = loadedTracks > 0 && loadedTracks >= (totalTracks * 0.5); // Consider success if at least 50% loaded

      // Emit collection loaded event with detailed results
      eventBus.emit(
        success
          ? (EVENTS.BUFFER_COLLECTION_LOAD_COMPLETE || 'buffer:collectionLoadComplete')
          : (EVENTS.BUFFER_COLLECTION_LOAD_PARTIAL || 'buffer:collectionLoadPartial'),
        {
          collectionId: collection.id,
          loadedTracks,
          totalTracks,
          errorCount,
          timestamp: Date.now()
        }
      );

      // Emit audio ready event for player to start playback
      if (success) {
        eventBus.emit(EVENTS.BUFFER_READY || 'buffer:ready', {
          collectionId: collection.id,
          timestamp: Date.now()
        });
      }

      return {
        success,
        results,
        loadedTracks,
        totalTracks,
        errorCount,
        error: errorCount > 0 ? `Failed to load ${errorCount} tracks` : null
      };
    } catch (error) {
      console.error(`[BufferContext] Error loading collection audio: ${error.message}`);

      // Emit error event
      eventBus.emit(EVENTS.BUFFER_COLLECTION_LOAD_ERROR || 'buffer:collectionLoadError', {
        collectionId: collection.id,
        error: error.message,
        timestamp: Date.now()
      });

      return {
        success: false,
        error: error.message
      };
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [bufferService, loadCollectionLayer]);

  // ADDED: New effect to listen for layer collection registration
  useEffect(() => {
    if (!initialized || !bufferService || !audioContext) return;

    console.log('[BufferContext] Setting up listener for layer collection registration');

    // Handle layer registration events to start buffer loading
    const handleLayerRegistration = (data) => {
      if (!data.collectionId) {
        console.warn('[BufferContext] Layer registration event missing collection ID');
        return;
      }

      console.log(`[BufferContext] Layer registration received for collection: ${data.collectionId}`);

      // Skip if collection data isn't included
      if (!data.collection) {
        console.warn(`[BufferContext] Layer registration missing collection data for: ${data.collectionId}`);
        return;
      }

      // Start loading audio for this collection
      loadCollectionAudio(data.collection)
        .then(result => {
          console.log(`[BufferContext] Collection audio loading ${result.success ? 'succeeded' : 'failed'}: ${data.collectionId}`);
        })
        .catch(error => {
          console.error(`[BufferContext] Error in collection audio loading: ${error.message}`);
        });
    };

    // Subscribe to layer registration events
    eventBus.on(EVENTS.LAYER_COLLECTION_REGISTERED || 'layer:collectionRegistered', handleLayerRegistration);

    return () => {
      // Unsubscribe when unmounting
      eventBus.off(EVENTS.LAYER_COLLECTION_REGISTERED || 'layer:collectionRegistered', handleLayerRegistration);
    };
  }, [initialized, bufferService, audioContext, loadCollectionAudio]);

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
    loadCollectionAudio, // ADDED: new collection method

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
    loadCollectionAudio, // ADDED: new dependency
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
