// src/contexts/BufferContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import BufferService from '../services/BufferService';
import { useAudioContext } from './AudioContext';
import eventBus from '../services/EventBus.js';

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
      
      // Publish initialization event
      eventBus.emit('buffer:initialized', {});
      
      // Update cache info immediately
      updateCacheInfo(service);
      
      // Clean up on unmount
      return () => {
        isMountedRef.current = false;
        if (service && typeof service.dispose === 'function') {
          console.log('[BufferContext] Cleaning up BufferService');
          service.dispose();
        }
      };
    } catch (error) {
      console.error('[BufferContext] Error initializing BufferService:', error);
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
  }, [bufferService, maxCacheSize]);
  
  // Load an audio buffer
  const loadBuffer = useCallback(async (url, options = {}) => {
    if (!bufferService || !url) {
      console.error('[BufferContext] Cannot load buffer: service unavailable or no URL provided');
      return null;
    }
    
    try {
      console.log(`[BufferContext] Loading buffer: ${url}`);
      setIsLoading(true);
      
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
        
        // Emit progress event
        eventBus.emit('buffer:loadProgress', { url, progress });
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
      
      // Emit loaded event
      eventBus.emit('buffer:loaded', { url, buffer });
      
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
      
      // Emit error event
      eventBus.emit('buffer:error', { url, error: error.message });
      
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
      return new Map();
    }
    
    try {
      console.log(`[BufferContext] Preloading ${urls.length} buffers`);
      setIsLoading(true);
      
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
        
        // Emit progress event
        eventBus.emit('buffer:preloadProgress', { overallProgress, detailedProgress });
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
      
      // Emit completion event
      eventBus.emit('buffer:preloadComplete', { 
        count: results.size,
        urls: Array.from(results.keys())
      });
      
      return results;
    } catch (error) {
      console.error('[BufferContext] Error preloading buffers:', error);
      
      // Emit error event
      eventBus.emit('buffer:preloadError', { error: error.message });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [bufferService, updateCacheInfo]);
  
  // Get a buffer from the cache
  const getBuffer = useCallback((url) => {
    if (!bufferService || !url) return null;
    return bufferService.getBuffer(url);
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
      
      // Emit release event
      eventBus.emit('buffer:released', { url });
    }
    
    return result;
  }, [bufferService, updateCacheInfo]);
  
  // Clear the buffer cache
  const clearCache = useCallback(() => {
    if (!bufferService) return 0;
    
    const count = bufferService.clearCache();
    
    // Update cache info after clearing
    updateCacheInfo();
    
    // Emit clear event
    eventBus.emit('buffer:cacheCleared', { count });
    
    return count;
  }, [bufferService, updateCacheInfo]);
  
  // Load audio for a collection track
  const loadCollectionTrack = useCallback(async (track, options = {}) => {
    if (!bufferService || !track || !track.path) {
      console.error('[BufferContext] Cannot load collection track: missing service, track, or path');
      return null;
    }
    
    try {
      console.log(`[BufferContext] Loading collection track: ${track.name || track.id}`);
      
      // Load the audio buffer
      const buffer = await loadBuffer(track.path, options);
      
      // Emit track loaded event
      eventBus.emit('buffer:trackLoaded', { 
        trackId: track.id,
        path: track.path,
        buffer 
      });
      
      return {
        track,
        buffer,
        success: true
      };
    } catch (error) {
      console.error(`[BufferContext] Error loading collection track ${track.id}:`, error);
      
      // Emit error event
      eventBus.emit('buffer:trackError', { 
        trackId: track.id,
        path: track.path,
        error: error.message
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
      return [];
    }
    
    try {
      console.log(`[BufferContext] Loading collection layer "${layer}" with ${tracks.length} tracks`);
      
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
      
      // Emit layer loaded event
      eventBus.emit('buffer:layerLoaded', {
        layer,
        trackCount: tracks.length,
        loadedCount: results.filter(r => r.success).length
      });
      
      return results;
    } catch (error) {
      console.error(`[BufferContext] Error loading collection layer ${layer}:`, error);
      
      // Emit error event
      eventBus.emit('buffer:layerError', {
        layer,
        error: error.message
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
