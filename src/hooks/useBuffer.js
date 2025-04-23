// src/hooks/useBuffer.js
import { useCallback, useMemo } from 'react';
import { useBufferContext } from '../contexts/BufferContext';
import { useAudio } from './useAudio';

/**
 * Hook for loading and managing audio buffers
 * Integrates with BufferContext and provides a clean API
 * 
 * @returns {Object} Buffer management functionality
 */
export function useBuffer() {
  // Get buffer functionality from context
  const buffer = useBufferContext();
  
  // Get audio functionality for integration
  const { audioContext } = useAudio();
  
  // Create source node from buffer
  const createSource = useCallback((url) => {
    if (!audioContext || !buffer.service) return null;
    
    try {
      // Get the buffer from cache
      const audioBuffer = buffer.getBuffer(url);
      if (!audioBuffer) return null;
      
      // Create source node
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      return source;
    } catch (error) {
      console.error(`[useBuffer] Error creating source for ${url}:`, error);
      return null;
    }
  }, [audioContext, buffer]);
  
  // Create and connect source node in one step
  const createAndConnectSource = useCallback((url, destination) => {
    if (!audioContext || !buffer.service || !destination) return null;
    
    try {
      const source = createSource(url);
      if (!source) return null;
      
      // Connect to destination
      source.connect(destination);
      
      return source;
    } catch (error) {
      console.error(`[useBuffer] Error connecting source for ${url}:`, error);
      return null;
    }
  }, [audioContext, buffer, createSource]);
  
  // Load and play a buffer
  const loadAndPlay = useCallback(async (url, options = {}) => {
    if (!audioContext || !buffer.service) return { success: false };
    
    try {
      // Load the buffer
      const audioBuffer = await buffer.loadBuffer(url, options);
      if (!audioBuffer) return { success: false, reason: 'Failed to load buffer' };
      
      // Create source
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // Set up options
      if (options.loop !== undefined) source.loop = options.loop;
      if (options.detune !== undefined) source.detune.value = options.detune;
      if (options.playbackRate !== undefined) source.playbackRate.value = options.playbackRate;
      
      // Connect to destination
      const destination = options.destination || audioContext.destination;
      source.connect(destination);
      
      // Start playback
      const startTime = options.startTime || audioContext.currentTime;
      const offset = options.offset || 0;
      const duration = options.duration || undefined;
      
      source.start(startTime, offset, duration);
      
      return {
        success: true,
        source,
        buffer: audioBuffer
      };
    } catch (error) {
      console.error(`[useBuffer] Error in loadAndPlay for ${url}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }, [audioContext, buffer]);
  
  // Get loading status for specific URL
  const getLoadingStatus = useCallback((url) => {
    if (!url || !buffer.loadingProgress) return { isLoading: false, progress: 0 };
    
    const isLoading = url in buffer.loadingProgress;
    const progress = isLoading ? buffer.loadingProgress[url] : 0;
    const error = buffer.loadingErrors[url] || null;
    
    return {
      isLoading,
      progress,
      error
    };
  }, [buffer.loadingProgress, buffer.loadingErrors]);
  
  // Group buffer management functionality
  const management = useMemo(() => ({
    isLoading: buffer.isLoading,
    cacheInfo: buffer.cacheInfo,
    loadBuffer: buffer.loadBuffer,
    preloadBuffers: buffer.preloadBuffers,
    getBuffer: buffer.getBuffer,
    hasBuffer: buffer.hasBuffer,
    releaseBuffer: buffer.releaseBuffer,
    clearCache: buffer.clearCache
  }), [buffer]);
  
  // Group collection-related functionality
  const collection = useMemo(() => ({
    loadTrack: buffer.loadCollectionTrack,
    loadLayer: buffer.loadCollectionLayer
  }), [buffer]);
  
  // Return all buffer functionality
  return {
    // Main functionality groups
    management,
    collection,
    
    // Playback helpers
    createSource,
    createAndConnectSource,
    loadAndPlay,
    getLoadingStatus,
    
    // Direct access to buffer context properties
    isLoading: buffer.isLoading,
    loadingProgress: buffer.loadingProgress,
    loadingErrors: buffer.loadingErrors,
    cacheInfo: buffer.cacheInfo,
    
    // Direct access to buffer context methods
    loadBuffer: buffer.loadBuffer,
    preloadBuffers: buffer.preloadBuffers,
    getBuffer: buffer.getBuffer,
    hasBuffer: buffer.hasBuffer,
    releaseBuffer: buffer.releaseBuffer,
    clearCache: buffer.clearCache,
    loadCollectionTrack: buffer.loadCollectionTrack,
    loadCollectionLayer: buffer.loadCollectionLayer,
    
    // Service access for advanced usage
    service: buffer.service
  };
}

export default useBuffer;
