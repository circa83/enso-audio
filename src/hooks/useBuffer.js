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
  
  // Track collection loading state
  const [collectionLoading, setCollectionLoading] = useState({});
  const [collectionStatus, setCollectionStatus] = useState({});
  
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
  
  // NEW: Track collection loading status
  useEffect(() => {
    // Handler for collection loading start
    const handleCollectionLoadStart = (data) => {
      const { collectionId } = data;
      if (!collectionId) return;
      
      console.log(`[useBuffer] Collection loading started: ${collectionId}`);
      
      // Track collection loading state
      setCollectionLoading(prev => ({
        ...prev,
        [collectionId]: {
          isLoading: true,
          progress: 0,
          startTime: Date.now()
        }
      }));
      
      // Update collection status
      setCollectionStatus(prev => ({
        ...prev,
        [collectionId]: {
          state: 'loading',
          error: null,
          progress: 0,
          timestamp: Date.now()
        }
      }));
    };
    
    // Handler for collection loading progress
    const handleCollectionProgress = (data) => {
      const { collectionId, progress, loadedTracks, totalTracks } = data;
      if (!collectionId) return;
      
      // Update collection loading state
      setCollectionLoading(prev => ({
        ...prev,
        [collectionId]: {
          ...(prev[collectionId] || {}),
          isLoading: true,
          progress,
          loadedTracks,
          totalTracks
        }
      }));
      
      // Update collection status
      setCollectionStatus(prev => ({
        ...prev,
        [collectionId]: {
          ...(prev[collectionId] || {}),
          state: 'loading',
          error: null,
          progress,
          loadedTracks,
          totalTracks,
          timestamp: Date.now()
        }
      }));
    };
    
    // Handler for collection loading complete
    const handleCollectionComplete = (data) => {
      const { collectionId, loadedTracks, totalTracks } = data;
      if (!collectionId) return;
      
      console.log(`[useBuffer] Collection loading complete: ${collectionId}`);
      
      // Update collection loading state
      setCollectionLoading(prev => {
        const updated = { ...prev };
        delete updated[collectionId];
        return updated;
      });
      
      // Update collection status
      setCollectionStatus(prev => ({
        ...prev,
        [collectionId]: {
          state: 'loaded',
          error: null,
          progress: 100,
          loadedTracks,
          totalTracks,
          timestamp: Date.now(),
          endTime: Date.now(),
          duration: prev[collectionId]?.startTime 
            ? Date.now() - prev[collectionId].startTime 
            : undefined
        }
      }));
    };
    
    // Handler for collection loading error
    const handleCollectionError = (data) => {
      const { collectionId, error } = data;
      if (!collectionId) return;
      
      console.error(`[useBuffer] Collection loading error: ${collectionId} - ${error}`);
      
      // Update collection loading state
      setCollectionLoading(prev => {
        const updated = { ...prev };
        delete updated[collectionId];
        return updated;
      });
      
      // Update collection status
      setCollectionStatus(prev => ({
        ...prev,
        [collectionId]: {
          state: 'error',
          error,
          timestamp: Date.now(),
          endTime: Date.now(),
          duration: prev[collectionId]?.startTime 
            ? Date.now() - prev[collectionId].startTime 
            : undefined
        }
      }));
    };
    
    // Handler for partial collection loading
    const handleCollectionPartial = (data) => {
      const { collectionId, loadedTracks, totalTracks, errorCount } = data;
      if (!collectionId) return;
      
      console.warn(`[useBuffer] Collection loading partial: ${loadedTracks}/${totalTracks} loaded for ${collectionId}`);
      
      // Update collection loading state
      setCollectionLoading(prev => {
        const updated = { ...prev };
        delete updated[collectionId];
        return updated;
      });
      
      // Update collection status
      setCollectionStatus(prev => ({
        ...prev,
        [collectionId]: {
          state: 'partial',
          error: `Failed to load ${errorCount} tracks`,
          progress: Math.round((loadedTracks / totalTracks) * 100),
          loadedTracks,
          totalTracks,
          errorCount,
          timestamp: Date.now(),
          endTime: Date.now(),
          duration: prev[collectionId]?.startTime 
            ? Date.now() - prev[collectionId].startTime 
            : undefined
        }
      }));
    };
    
    // Subscribe to collection events
    eventBus.on(EVENTS.BUFFER_COLLECTION_LOAD_START || 'buffer:collectionLoadStart', handleCollectionLoadStart);
    eventBus.on(EVENTS.BUFFER_COLLECTION_LOAD_PROGRESS || 'buffer:collectionLoadProgress', handleCollectionProgress);
    eventBus.on(EVENTS.BUFFER_COLLECTION_LOAD_COMPLETE || 'buffer:collectionLoadComplete', handleCollectionComplete);
    eventBus.on(EVENTS.BUFFER_COLLECTION_LOAD_ERROR || 'buffer:collectionLoadError', handleCollectionError);
    eventBus.on(EVENTS.BUFFER_COLLECTION_LOAD_PARTIAL || 'buffer:collectionLoadPartial', handleCollectionPartial);
    
    // Cleanup subscriptions
    return () => {
      eventBus.off(EVENTS.BUFFER_COLLECTION_LOAD_START || 'buffer:collectionLoadStart', handleCollectionLoadStart);
      eventBus.off(EVENTS.BUFFER_COLLECTION_LOAD_PROGRESS || 'buffer:collectionLoadProgress', handleCollectionProgress);
      eventBus.off(EVENTS.BUFFER_COLLECTION_LOAD_COMPLETE || 'buffer:collectionLoadComplete', handleCollectionComplete);
      eventBus.off(EVENTS.BUFFER_COLLECTION_LOAD_ERROR || 'buffer:collectionLoadError', handleCollectionError);
      eventBus.off(EVENTS.BUFFER_COLLECTION_LOAD_PARTIAL || 'buffer:collectionLoadPartial', handleCollectionPartial);
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
  
  // Get loading status for a collection
  const getCollectionStatus = useCallback((collectionId) => {
    if (!collectionId) return { isLoading: false, progress: 0, state: 'unknown' };
    
    // Check if collection is currently loading
    const loading = collectionLoading[collectionId];
    
    // Get latest status
    const status = collectionStatus[collectionId] || {};
    
    return {
      isLoading: !!loading,
      progress: loading?.progress || status?.progress || 0,
      state: status?.state || 'unknown',
      error: status?.error || null,
      loadedTracks: status?.loadedTracks || 0,
      totalTracks: status?.totalTracks || 0,
      timestamp: status?.timestamp || null,
      duration: status?.duration || null
    };
  }, [collectionLoading, collectionStatus]);
  
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
  
  // Enhanced loadCollectionAudio with better error handling and tracking
  const loadCollectionAudioWithTracking = useCallback((collection, options = {}) => {
    if (!collection || !collection.id) {
      console.error('[useBuffer] Cannot load collection audio: Invalid collection');
      return Promise.resolve({ 
        success: false, 
        error: 'Invalid collection' 
      });
    }
    
    console.log(`[useBuffer] Loading audio for collection: ${collection.name || collection.id}`);
    
    // The context method already handles events
    return buffer.loadCollectionAudio(collection, options);
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
  
  // Group collection-related functionality with new methods
  const collection = useMemo(() => ({
    loadTrack: buffer.loadCollectionTrack,
    loadLayer: buffer.loadCollectionLayer,
    loadCollection: loadCollectionAudioWithTracking,  // NEW: Expose the enhanced collection loading method
    getStatus: getCollectionStatus  // NEW: Expose collection status tracking
  }), [buffer, loadCollectionAudioWithTracking, getCollectionStatus]);
  
  // Track real-time buffer system status with collection status
  const status = useMemo(() => ({
    activeOperations,
    lastOperation,
    operationCount: Object.keys(activeOperations).length,
    isActive: Object.keys(activeOperations).length > 0,
    collections: {  // NEW: Track collection loading state
      loading: collectionLoading,
      status: collectionStatus,
      isLoading: Object.keys(collectionLoading).length > 0,
      activeCount: Object.keys(collectionLoading).length
    }
  }), [activeOperations, lastOperation, collectionLoading, collectionStatus]);
  
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
    getCollectionStatus,  // NEW: Expose collection status directly
    
    // Direct access to buffer context properties with enhanced tracking
    isLoading: buffer.isLoading,
    loadingProgress: buffer.loadingProgress,
    loadingErrors: buffer.loadingErrors,
    cacheInfo: buffer.cacheInfo,
    activeOperations,
    lastOperation,
    
    // Collection loading state
    collectionLoading,  // NEW: Expose collection loading state
    collectionStatus,   // NEW: Expose collection status state
    
    // Direct access to buffer context methods with enhanced tracking
    loadBuffer: loadBufferWithTracking,
    preloadBuffers: preloadBuffersWithTracking,
    getBuffer: buffer.getBuffer,
    hasBuffer: buffer.hasBuffer,
    releaseBuffer: buffer.releaseBuffer,
    clearCache: clearCacheWithTracking,
    loadCollectionTrack: buffer.loadCollectionTrack,
    loadCollectionLayer: buffer.loadCollectionLayer,
    loadCollectionAudio: loadCollectionAudioWithTracking,  // NEW: Expose enhanced collection loading method
    
    // Service access for advanced usage
    service: buffer.service
  };
}

export default useBuffer;

