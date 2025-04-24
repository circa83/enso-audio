// src/hooks/useBuffer.js
import { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import { useBufferContext } from '../contexts/BufferContext';
import { useAudio } from './useAudio';
import eventBus, { EVENTS } from '../services/EventBus';

/**
 * Hook for loading and managing audio buffers
 * Integrates with BufferContext and provides a clean API
 * Enhanced with EventBus integration for real-time updates
 * 
 * @returns {Object} Buffer management functionality
 */
export function useBuffer() {
  // Get buffer functionality from context
  const buffer = useBufferContext();
  
  // Get audio functionality for integration
  const { audioContext } = useAudio();
  
  // Local state for real-time tracking of buffer operations
  const [activeOperations, setActiveOperations] = useState({});
  const [lastOperation, setLastOperation] = useState(null);
  
  // Refs for callback stability
  const bufferRef = useRef(buffer);
  const operationsRef = useRef(activeOperations);
  
  // Update refs when dependencies change
  useEffect(() => {
    bufferRef.current = buffer;
    operationsRef.current = activeOperations;
  }, [buffer, activeOperations]);
  
  // Subscribe to buffer events from EventBus
  useEffect(() => {
    // Handler for buffer operations
    const handleBufferOperation = (data) => {
      const { url, operation, timestamp } = data;
      
      // Track the operation
      setActiveOperations(prev => ({
        ...prev,
        [url]: { operation, timestamp, ...data }
      }));
      
      // Update last operation for reactive components
      setLastOperation({
        type: operation,
        url,
        timestamp,
        details: data
      });
    };
    
    // Handler for completion events
    const handleOperationComplete = (data) => {
      const { url } = data;
      
      // Remove from active operations
      setActiveOperations(prev => {
        const updated = { ...prev };
        delete updated[url];
        return updated;
      });
      
      // Update last operation for reactive components
      setLastOperation({
        type: 'complete',
        url,
        timestamp: Date.now(),
        details: data
      });
    };
    
    // Handler for error events
    const handleBufferError = (data) => {
      const { url, error } = data;
      
      // Update last operation for reactive components
      setLastOperation({
        type: 'error',
        url,
        timestamp: Date.now(),
        error,
        details: data
      });
      
      // Remove from active operations
      setActiveOperations(prev => {
        const updated = { ...prev };
        delete updated[url];
        return updated;
      });
    };
    
    // Subscribe to events
    eventBus.on('buffer:loadStart', handleBufferOperation);
    eventBus.on('buffer:loaded', handleOperationComplete);
    eventBus.on('buffer:error', handleBufferError);
    eventBus.on('buffer:cacheHit', handleOperationComplete);
    eventBus.on('buffer:cachePruned', handleOperationComplete);
    
    // Cleanup subscriptions
    return () => {
      eventBus.off('buffer:loadStart', handleBufferOperation);
      eventBus.off('buffer:loaded', handleOperationComplete);
      eventBus.off('buffer:error', handleBufferError);
      eventBus.off('buffer:cacheHit', handleOperationComplete);
      eventBus.off('buffer:cachePruned', handleOperationComplete);
    };
  }, []);
  
  // Create source node from buffer
  const createSource = useCallback((url) => {
    if (!audioContext || !buffer.service) return null;
    
    try {
      // Get the buffer from cache
      const audioBuffer = buffer.getBuffer(url);
      if (!audioBuffer) {
        console.log(`[useBuffer] No buffer found for URL: ${url}`);
        return null;
      }
      
      // Create source node
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // Log source creation
      console.log(`[useBuffer] Created source for buffer: ${url}`);
      
      // Emit event for tracking
      eventBus.emit(EVENTS.BUFFER_SOURCE_CREATED || 'buffer:sourceCreated', {
        url,
        timestamp: Date.now()
      });
      
      return source;
    } catch (error) {
      console.error(`[useBuffer] Error creating source for ${url}:`, error);
      
      // Emit error event
      eventBus.emit(EVENTS.AUDIO_ERROR || 'audio:error', {
        type: 'buffer',
        operation: 'createSource',
        url,
        message: error.message,
        error
      });
      
      return null;
    }
  }, [audioContext, buffer]);
  
  // Create and connect source node in one step
  const createAndConnectSource = useCallback((url, destination) => {
    if (!audioContext || !buffer.service || !destination) {
      console.error(`[useBuffer] Cannot connect source: missing context, service, or destination`);
      return null;
    }
    
    try {
      const source = createSource(url);
      if (!source) return null;
      
      // Connect to destination
      source.connect(destination);
      
      // Log connection
      console.log(`[useBuffer] Connected source for ${url} to destination`);
      
      // Emit event for tracking
      eventBus.emit(EVENTS.BUFFER_SOURCE_CONNECTED || 'buffer:sourceConnected', {
        url,
        timestamp: Date.now()
      });
      
      return source;
    } catch (error) {
      console.error(`[useBuffer] Error connecting source for ${url}:`, error);
      
      // Emit error event
      eventBus.emit(EVENTS.AUDIO_ERROR || 'audio:error', {
        type: 'buffer',
        operation: 'connectSource',
        url,
        message: error.message,
        error
      });
      
      return null;
    }
  }, [audioContext, buffer, createSource]);
  
  // Load and play a buffer
  const loadAndPlay = useCallback(async (url, options = {}) => {
    if (!audioContext || !buffer.service) {
      console.error(`[useBuffer] Cannot load and play: missing context or service`);
      return { success: false };
    }
    
    try {
      console.log(`[useBuffer] Loading and playing buffer: ${url}`);
      
      // Emit start event
      eventBus.emit(EVENTS.BUFFER_PLAYBACK_ATTEMPT || 'buffer:playbackAttempt', {
        url,
        options,
        timestamp: Date.now()
      });
      
      // Load the buffer
      const audioBuffer = await buffer.loadBuffer(url, options);
      if (!audioBuffer) {
        console.error(`[useBuffer] Failed to load buffer: ${url}`);
        
        // Emit failure event
        eventBus.emit(EVENTS.BUFFER_PLAYBACK_FAILED || 'buffer:playbackFailed', {
          url,
          reason: 'Failed to load buffer',
          timestamp: Date.now()
        });
        
        return { success: false, reason: 'Failed to load buffer' };
      }
      
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
      
      // Log successful playback
      console.log(`[useBuffer] Started playback of ${url} at time ${startTime}`);
      
      // Emit success event
      eventBus.emit(EVENTS.BUFFER_PLAYBACK_STARTED || 'buffer:playbackStarted', {
        url,
        startTime,
        offset,
        duration,
        timestamp: Date.now()
      });
      
      // Set up ended event handler if requested
      if (options.onEnded) {
        source.onended = () => {
          options.onEnded();
          
          // Emit ended event
          eventBus.emit(EVENTS.BUFFER_PLAYBACK_ENDED || 'buffer:playbackEnded', {
            url,
            timestamp: Date.now()
          });
        };
      } else {
        source.onended = () => {
          // Emit ended event even without custom handler
          eventBus.emit(EVENTS.BUFFER_PLAYBACK_ENDED || 'buffer:playbackEnded', {
            url,
            timestamp: Date.now()
          });
        };
      }
      
      return {
        success: true,
        source,
        buffer: audioBuffer
      };
    } catch (error) {
      console.error(`[useBuffer] Error in loadAndPlay for ${url}:`, error);
      
      // Emit error event
      eventBus.emit(EVENTS.AUDIO_ERROR || 'audio:error', {
        type: 'buffer',
        operation: 'loadAndPlay',
        url,
        message: error.message,
        error,
        timestamp: Date.now()
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }, [audioContext, buffer]);
  
  // Get loading status for specific URL with enhanced event tracking
  const getLoadingStatus = useCallback((url) => {
    if (!url) return { isLoading: false, progress: 0 };
    
    // Check active operations from our local state first (more real-time)
    const operation = operationsRef.current[url];
    const inProgress = operation && operation.operation === 'load';
    
    // Fall back to loading progress from context
    const isLoadingFromContext = url in bufferRef.current.loadingProgress;
    const isLoading = inProgress || isLoadingFromContext;
    
    // Get progress from context
    const progress = isLoadingFromContext ? bufferRef.current.loadingProgress[url] : 0;
    
    // Check for errors
    const error = bufferRef.current.loadingErrors[url] || null;
    
    return {
      isLoading,
      progress,
      error,
      operation: operation || null
    };
  }, []);
  
  // Enhanced load buffer with EventBus integration
  const loadBufferWithTracking = useCallback((url, options = {}) => {
    console.log(`[useBuffer] Loading buffer: ${url}`);
    
    // The original method already emits events via BufferService
    return buffer.loadBuffer(url, options);
  }, [buffer]);
  
  // Enhanced preload buffers with EventBus integration
  const preloadBuffersWithTracking = useCallback((urls, options = {}) => {
    console.log(`[useBuffer] Preloading ${urls.length} buffers`);
    
    // Emit preload start event
    eventBus.emit(EVENTS.BUFFER_PRELOAD_START || 'buffer:preloadStart', {
      urls,
      count: urls.length,
      timestamp: Date.now()
    });
    
    // The original method already emits individual events via BufferService
    return buffer.preloadBuffers(urls, options);
  }, [buffer]);
  
  // Enhanced cache clearing with EventBus integration
  const clearCacheWithTracking = useCallback(() => {
    console.log('[useBuffer] Clearing buffer cache');
    
    // The original method already emits events via BufferService
    return buffer.clearCache();
  }, [buffer]);
  
  // Group buffer management functionality with enhanced methods
  const management = useMemo(() => ({
    isLoading: buffer.isLoading,
    cacheInfo: buffer.cacheInfo,
    loadBuffer: loadBufferWithTracking,
    preloadBuffers: preloadBuffersWithTracking,
    getBuffer: buffer.getBuffer,
    hasBuffer: buffer.hasBuffer,
    releaseBuffer: buffer.releaseBuffer,
    clearCache: clearCacheWithTracking,
    getLoadingStatus
  }), [buffer, loadBufferWithTracking, preloadBuffersWithTracking, clearCacheWithTracking, getLoadingStatus]);
  
  // Group collection-related functionality
  const collection = useMemo(() => ({
    loadTrack: buffer.loadCollectionTrack,
    loadLayer: buffer.loadCollectionLayer
  }), [buffer]);
  
  // Track real-time buffer system status
  const status = useMemo(() => ({
    activeOperations,
    lastOperation,
    operationCount: Object.keys(activeOperations).length,
    isActive: Object.keys(activeOperations).length > 0
  }), [activeOperations, lastOperation]);
  
  // Return all buffer functionality with enhanced organization
  return {
    // Main functionality groups
    management,
    collection,
    status,
    
    // Playback helpers
    createSource,
    createAndConnectSource,
    loadAndPlay,
    getLoadingStatus,
    
    // Direct access to buffer context properties with enhanced tracking
    isLoading: buffer.isLoading,
    loadingProgress: buffer.loadingProgress,
    loadingErrors: buffer.loadingErrors,
    cacheInfo: buffer.cacheInfo,
    activeOperations,
    lastOperation,
    
    // Direct access to buffer context methods with enhanced tracking
    loadBuffer: loadBufferWithTracking,
    preloadBuffers: preloadBuffersWithTracking,
    getBuffer: buffer.getBuffer,
    hasBuffer: buffer.hasBuffer,
    releaseBuffer: buffer.releaseBuffer,
    clearCache: clearCacheWithTracking,
    loadCollectionTrack: buffer.loadCollectionTrack,
    loadCollectionLayer: buffer.loadCollectionLayer,
    
    // Service access for advanced usage
    service: buffer.service
  };
}

export default useBuffer;
