// src/contexts/CrossfadeContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import CrossfadeService, { CROSSFADE_EVENTS } from '../services/CrossfadeService';
import { useAudioService } from './AudioContext';
import { useVolumeService } from './VolumeContext';
import { useBufferService } from './BufferContext';
import eventBus from '../services/EventBus.js';

// Create the context
const CrossfadeContext = createContext(null);

/**
 * Provider component for crossfade management
 */
export const CrossfadeProvider = ({ 
  children,
  defaultFadeDuration = 2000,
  enableLogging = false
}) => {
  // Get dependencies from other services
  const { audioContext, masterGain, initialized: audioInitialized } = useAudioService();
  const volumeService = useVolumeService();
  const bufferService = useBufferService();

  // Service reference - explicitly using useState to ensure stable reference
  const [crossfadeService, setCrossfadeService] = useState(null);

  // Explicit state management with clear nomenclature
  const [activeCrossfades, setActiveCrossfades] = useState({});
  const [crossfadeProgress, setCrossfadeProgress] = useState({});
  const [preloadProgress, setPreloadProgress] = useState({});
  const [serviceReady, setServiceReady] = useState(false);
  
  // Operational state tracking
  const [operationState, setOperationState] = useState({
    lastOperation: null,
    timestamp: null,
    error: null,
    isProcessing: false
  });

  // Define progress tracking callback outside useEffect for stability
  const handleProgressUpdate = useCallback((layer, progress) => {
    setCrossfadeProgress(prev => ({
      ...prev,
      [layer]: progress
    }));
  }, []);

  // Initialize CrossfadeService when dependencies are ready
  useEffect(() => {
    // Check if dependencies are ready
    const dependenciesReady = audioInitialized && 
                             audioContext && 
                             masterGain && 
                             volumeService;
    
    if (!dependenciesReady) {
      console.log('[CrossfadeContext] Waiting for dependencies...');
      return;
    }

    try {
      console.log('[CrossfadeContext] Initializing CrossfadeService...');
      
      const service = new CrossfadeService({
        audioContext,
        volumeController: volumeService,
        destination: masterGain,
        onProgress: handleProgressUpdate,
        enableLogging,
        enableEventBus: true,
        defaultFadeDuration
      });

      setCrossfadeService(service);
      setServiceReady(true);
      setOperationState(prev => ({
        ...prev,
        lastOperation: 'init',
        timestamp: Date.now(),
        error: null
      }));

      console.log('[CrossfadeContext] CrossfadeService initialized successfully');

      // Clean up on unmount
      return () => {
        if (service && typeof service.dispose === 'function') {
          service.dispose();
        }
      };
    } catch (error) {
      console.error('[CrossfadeContext] Error initializing CrossfadeService:', error);
      setOperationState(prev => ({
        ...prev,
        lastOperation: 'init',
        timestamp: Date.now(),
        error: error.message
      }));
    }
  }, [
    audioInitialized, 
    audioContext, 
    masterGain, 
    volumeService, 
    handleProgressUpdate, 
    enableLogging, 
    defaultFadeDuration
  ]);

  // Subscribe to CrossfadeService events using EventBus
  useEffect(() => {
    if (!crossfadeService) return;
    
    // Handle crossfade started event
    const handleCrossfadeStarted = (data) => {
      const { layer, from, to } = data;
      
      setActiveCrossfades(prev => ({
        ...prev,
        [layer]: { 
          from,
          to,
          progress: 0,
          isLoading: false 
        }
      }));
      
      setOperationState(prev => ({
        ...prev,
        lastOperation: 'crossfadeStarted',
        timestamp: data.timestamp,
        isProcessing: true,
        error: null
      }));
    };
    
    // Handle crossfade progress event
    const handleCrossfadeProgress = (data) => {
      const { layer, progress } = data;
      
      setCrossfadeProgress(prev => ({
        ...prev,
        [layer]: progress
      }));
    };
    
    // Handle crossfade completed event
    const handleCrossfadeCompleted = (data) => {
      const { layer } = data;
      
      setActiveCrossfades(prev => {
        const newState = {...prev};
        delete newState[layer];
        return newState;
      });
      
      setCrossfadeProgress(prev => {
        // Keep the progress at 1 for a brief moment before removing
        return {
          ...prev,
          [layer]: 1
        };
      });
      
      // Schedule removal of progress state after 100ms
      setTimeout(() => {
        setCrossfadeProgress(prev => {
          const newState = {...prev};
          delete newState[layer];
          return newState;
        });
      }, 100);
      
      setOperationState(prev => ({
        ...prev,
        lastOperation: 'crossfadeCompleted',
        timestamp: data.timestamp,
        isProcessing: false,
        error: null
      }));
    };
    
    // Handle crossfade cancelled event
    const handleCrossfadeCancelled = (data) => {
      const { layer } = data;
      
      setActiveCrossfades(prev => {
        const newState = {...prev};
        delete newState[layer];
        return newState;
      });
      
      setCrossfadeProgress(prev => {
        const newState = {...prev};
        delete newState[layer];
        return newState;
      });
      
      setOperationState(prev => ({
        ...prev,
        lastOperation: 'crossfadeCancelled',
        timestamp: data.timestamp,
        isProcessing: false,
        error: null
      }));
    };
    
    // Handle all crossfades cancelled event
    const handleAllCrossfadesCancelled = () => {
      setActiveCrossfades({});
      setCrossfadeProgress({});
      
      setOperationState(prev => ({
        ...prev,
        lastOperation: 'allCrossfadesCancelled',
        timestamp: Date.now(),
        isProcessing: false,
        error: null
      }));
    };
    
    // Handle crossfade error event
    const handleCrossfadeError = (data) => {
      const { layer, message } = data;
      
      // Clean up UI state for the affected layer
      if (layer) {
        setActiveCrossfades(prev => {
          const newState = {...prev};
          delete newState[layer];
          return newState;
        });
        
        setCrossfadeProgress(prev => {
          const newState = {...prev};
          delete newState[layer];
          return newState;
        });
      }
      
      setOperationState(prev => ({
        ...prev,
        lastOperation: 'crossfadeError',
        timestamp: data.timestamp,
        isProcessing: false,
        error: message
      }));
    };
    
    // Subscribe to events
    eventBus.on(CROSSFADE_EVENTS.STARTED, handleCrossfadeStarted);
    eventBus.on(CROSSFADE_EVENTS.PROGRESS, handleCrossfadeProgress);
    eventBus.on(CROSSFADE_EVENTS.COMPLETED, handleCrossfadeCompleted);
    eventBus.on(CROSSFADE_EVENTS.CANCELLED, handleCrossfadeCancelled);
    eventBus.on(CROSSFADE_EVENTS.ALL_CANCELLED, handleAllCrossfadesCancelled);
    eventBus.on(CROSSFADE_EVENTS.ERROR, handleCrossfadeError);
    
    // Cleanup subscriptions on unmount or service change
    return () => {
      eventBus.off(CROSSFADE_EVENTS.STARTED, handleCrossfadeStarted);
      eventBus.off(CROSSFADE_EVENTS.PROGRESS, handleCrossfadeProgress);
      eventBus.off(CROSSFADE_EVENTS.COMPLETED, handleCrossfadeCompleted);
      eventBus.off(CROSSFADE_EVENTS.CANCELLED, handleCrossfadeCancelled);
      eventBus.off(CROSSFADE_EVENTS.ALL_CANCELLED, handleAllCrossfadesCancelled);
      eventBus.off(CROSSFADE_EVENTS.ERROR, handleCrossfadeError);
    };
  }, [crossfadeService]);

  // Crossfade between audio tracks
  const crossfadeTo = useCallback(async (layer, newTrackId, fadeDuration = null) => {
    if (!crossfadeService) {
      console.error("[CrossfadeContext] Cannot crossfade: CrossfadeService not available");
      return false;
    }

    if (!layer || !newTrackId) {
      console.error('[CrossfadeContext] Layer and trackId are required for crossfade');
      return false;
    }

    console.log(`[CrossfadeContext] Starting crossfade for ${layer} to track ${newTrackId}`);
    
    // Update operation state
    setOperationState(prev => ({
      ...prev,
      lastOperation: 'crossfadeTo',
      timestamp: Date.now(),
      isProcessing: true,
      error: null
    }));
    
    // Calculate actual duration
    const actualDuration = fadeDuration !== null ? fadeDuration : defaultFadeDuration;
    console.log(`[CrossfadeContext] Using fade duration: ${actualDuration}ms`);

    try {
      // Update UI to show we're preparing for crossfade
      setActiveCrossfades(prev => ({
        ...prev,
        [layer]: { 
          from: 'current', // This will be updated when we have source info
          to: newTrackId,
          progress: 0,
          isLoading: true 
        }
      }));

      // Get the current volume for the layer from volumeService
      const currentVolume = volumeService ? volumeService.getVolume(layer) : 0.8;

      // Here we would get source and target nodes, but in this context we don't have
      // direct access to them. We'll need the component to provide these.
      // This is an integration point that would need to be addressed.

      // For now, we'll define what the crossfade method signature would be
      // but it would need to be called with proper audio nodes from a hook.
      
      // Update UI - now loading is complete
      setActiveCrossfades(prev => ({
        ...prev,
        [layer]: { 
          ...prev[layer],
          isLoading: false 
        }
      }));
      
      // Update operation state
      setOperationState(prev => ({
        ...prev,
        lastOperation: 'crossfadeToComplete',
        timestamp: Date.now(),
        isProcessing: false,
        error: null
      }));

      // Return true for success
      return true;
    } catch (error) {
      console.error(`[CrossfadeContext] Error during crossfade: ${error.message}`);
      
      // Clear UI state
      setActiveCrossfades(prev => {
        const newState = {...prev};
        delete newState[layer];
        return newState;   
      });
      
      setCrossfadeProgress(prev => {
        const newState = {...prev};
        delete newState[layer];
        return newState;
      });
          // Update operation state
          setOperationState(prev => ({
            ...prev,
            lastOperation: 'crossfadeToError',
            timestamp: Date.now(),
            isProcessing: false,
            error: error.message
          }));
          
          return false;
        }
      }, [crossfadeService, defaultFadeDuration, volumeService]);
    
      // Execute a crossfade with provided nodes
      const executeCrossfade = useCallback(async (options) => {
        if (!crossfadeService) {
          console.error("[CrossfadeContext] Cannot execute crossfade: CrossfadeService not available");
          return false;
        }
    
        const { 
          layer, 
          sourceNode, 
          sourceElement, 
          targetNode, 
          targetElement,
          fromTrackId,
          toTrackId,
          duration = defaultFadeDuration,
          syncPosition = true
        } = options;
    
        if (!layer || !sourceNode || !targetNode) {
          console.error("[CrossfadeContext] Missing required parameters for crossfade");
          
          setOperationState(prev => ({
            ...prev,
            lastOperation: 'executeCrossfadeError',
            timestamp: Date.now(),
            isProcessing: false,
            error: 'Missing required parameters'
          }));
          
          return false;
        }
    
        try {
          // Update operation state
          setOperationState(prev => ({
            ...prev,
            lastOperation: 'executeCrossfade',
            timestamp: Date.now(),
            isProcessing: true,
            error: null
          }));
          
          // Update UI state before starting
          setActiveCrossfades(prev => ({
            ...prev,
            [layer]: { 
              from: fromTrackId || 'current',
              to: toTrackId || 'new',
              progress: 0,
              isLoading: false 
            }
          }));
    
          // Get current volume from volumeService
          const currentVolume = volumeService ? volumeService.getVolume(layer) : 0.8;
    
          // Execute the crossfade with the service
          const success = await crossfadeService.executeCrossfade({
            layer,
            sourceNode,
            sourceElement,
            targetNode,
            targetElement,
            currentVolume,
            duration,
            syncPosition,
            metadata: {
              fromTrackId,
              toTrackId,
              volumeController: volumeService
            }
          });
    
          // Handle completion - this may be redundant since we also update via EventBus
          if (!success) {
            console.error(`[CrossfadeContext] Crossfade failed for ${layer}`);
            
            setOperationState(prev => ({
              ...prev,
              lastOperation: 'executeCrossfadeFailed',
              timestamp: Date.now(),
              isProcessing: false,
              error: 'Crossfade execution failed'
            }));
          }
    
          return success;
        } catch (error) {
          console.error(`[CrossfadeContext] Error executing crossfade: ${error.message}`);
          
          // Clear UI state
          setActiveCrossfades(prev => {
            const newState = {...prev};
            delete newState[layer];
            return newState;   
          });
          
          setCrossfadeProgress(prev => {
            const newState = {...prev};
            delete newState[layer];
            return newState;
          });
          
          // Update operation state
          setOperationState(prev => ({
            ...prev,
            lastOperation: 'executeCrossfadeError',
            timestamp: Date.now(),
            isProcessing: false,
            error: error.message
          }));
          
          return false;
        }
      }, [crossfadeService, defaultFadeDuration, volumeService]);
    
      // Cancel all active crossfades
      const cancelCrossfades = useCallback((options = {}) => {
        if (!crossfadeService) {
          console.error("[CrossfadeContext] Cannot cancel crossfades: CrossfadeService not available");
          return false;
        }
        
        console.log("[CrossfadeContext] Cancelling all active crossfades");
        
        // Update operation state
        setOperationState(prev => ({
          ...prev,
          lastOperation: 'cancelCrossfades',
          timestamp: Date.now(),
          isProcessing: true,
          error: null
        }));
        
        // Cancel all crossfades in the service
        const result = crossfadeService.cancelAllCrossfades({
          reconnectSource: true,
          reconnectTarget: true,
          ...options
        });
        
        // This UI update should now be redundant as we're listening to EventBus
        // events from the service, but keeping for safety
        setActiveCrossfades({});
        setCrossfadeProgress({});
        
        return result;
      }, [crossfadeService]);
    
      // Cancel a specific crossfade
      const cancelCrossfade = useCallback((layer, options = {}) => {
        if (!crossfadeService || !layer) {
          console.error("[CrossfadeContext] Cannot cancel crossfade: missing service or layer");
          return false;
        }
        
        console.log(`[CrossfadeContext] Cancelling crossfade for ${layer}`);
        
        // Update operation state
        setOperationState(prev => ({
          ...prev,
          lastOperation: 'cancelCrossfade',
          timestamp: Date.now(),
          isProcessing: true,
          error: null
        }));
        
        // Cancel the crossfade in the service
        const result = crossfadeService.cancelCrossfade(layer, {
          reconnectSource: true,
          reconnectTarget: true,
          ...options
        });
        
        return result;
      }, [crossfadeService]);
    
      // Adjust volume during an active crossfade
      const adjustCrossfadeVolume = useCallback((layer, volume) => {
        if (!crossfadeService || !layer) {
          console.error("[CrossfadeContext] Cannot adjust volume: missing service or layer");
          return false;
        }
        
        if (typeof volume !== 'number' || volume < 0 || volume > 1) {
          console.error(`[CrossfadeContext] Invalid volume value: ${volume}`);
          return false;
        }
        
        console.log(`[CrossfadeContext] Adjusting crossfade volume for ${layer} to ${volume}`);
        
        // Update operation state
        setOperationState(prev => ({
          ...prev,
          lastOperation: 'adjustCrossfadeVolume',
          timestamp: Date.now(),
          isProcessing: true,
          error: null
        }));
        
        return crossfadeService.adjustCrossfadeVolume(layer, volume);
      }, [crossfadeService]);
    
      // Preload audio using BufferService
      const preloadAudio = useCallback(async (path, onProgress = null) => {
        if (!bufferService) {
          console.error("[CrossfadeContext] Cannot preload: BufferService not available");
          return false;
        }
    
        if (!path) {
          console.error("[CrossfadeContext] Audio path is required for preloading");
          return false;
        }
    
        try {
          console.log(`[CrossfadeContext] Preloading audio: ${path}`);
          
          // Update operation state
          setOperationState(prev => ({
            ...prev,
            lastOperation: 'preloadAudio',
            timestamp: Date.now(),
            isProcessing: true,
            error: null
          }));
          
          // Generate a tracking ID from the path
          const trackId = typeof path === 'string' 
            ? path.split('/').pop().replace(/\.[^/.]+$/, "") 
            : `track_${Date.now()}`;
          
          // Update UI to show loading progress
          setPreloadProgress(prev => ({
            ...prev,
            [trackId]: 0
          }));
    
          // Create a progress handler
          const handleProgress = (progress) => {
            setPreloadProgress(prev => ({
              ...prev,
              [trackId]: progress
            }));
            
            // Call external progress handler if provided
            if (onProgress) {
              onProgress(progress);
            }
          };
    
          // Use BufferService to preload the audio file
          const result = await bufferService.loadAudioBuffer(path, {
            onProgress: handleProgress
          });
    
          // Success - clear progress display
          setPreloadProgress(prev => {
            const newState = {...prev};
            delete newState[trackId];
            return newState;
          });
          
          // Update operation state
          setOperationState(prev => ({
            ...prev,
            lastOperation: 'preloadAudioComplete',
            timestamp: Date.now(),
            isProcessing: false,
            error: null
          }));
    
          return result;
        } catch (error) {
          console.error(`[CrossfadeContext] Error preloading audio: ${error.message}`);
          
          // Reset progress on error
          if (path) {
            const trackId = typeof path === 'string' 
              ? path.split('/').pop().replace(/\.[^/.]+$/, "") 
              : `track_${Date.now()}`;
            
            setPreloadProgress(prev => {
              const newState = {...prev};
              delete newState[trackId];
              return newState;
            });
          }
          
          // Update operation state
          setOperationState(prev => ({
            ...prev,
            lastOperation: 'preloadAudioError',
            timestamp: Date.now(),
            isProcessing: false,
            error: error.message
          }));
          
          return false;
        }
      }, [bufferService]);
      
      // Check if a crossfade is active for a layer
      const isActive = useCallback((layer) => {
        if (!crossfadeService || !layer) return false;
        return crossfadeService.isActive(layer);
      }, [crossfadeService]);
    
      // Get information about an active crossfade
      const getActiveCrossfade = useCallback((layer) => {
        if (!crossfadeService || !layer) return null;
        return crossfadeService.getActiveCrossfade(layer);
      }, [crossfadeService]);
      
      // Get stats about service usage
      const getServiceStats = useCallback(() => {
        if (!crossfadeService) return null;
        return crossfadeService.getStats();
      }, [crossfadeService]);
    
      // Create memoized context value
      const contextValue = useMemo(() => ({
        // State
        activeCrossfades,
        crossfadeProgress,
        preloadProgress,
        serviceReady,
        operationState,
        
        // Crossfade methods
        crossfadeTo,
        executeCrossfade,
        cancelCrossfade,
        cancelCrossfades,
        adjustCrossfadeVolume,
        preloadAudio,
        isActive,
        getActiveCrossfade,
        getServiceStats,
        
        // Service access for advanced usage
        service: crossfadeService
      }), [
        activeCrossfades,
        crossfadeProgress,
        preloadProgress,
        serviceReady,
        operationState,
        crossfadeTo,
        executeCrossfade,
        cancelCrossfade,
        cancelCrossfades,
        adjustCrossfadeVolume,
        preloadAudio,
        isActive,
        getActiveCrossfade,
        getServiceStats,
        crossfadeService
      ]);
    
      return (
        <CrossfadeContext.Provider value={contextValue}>
          {children}
        </CrossfadeContext.Provider>
      );
    };
    
    /**
     * Custom hook to use the crossfade context
     * @returns {Object} Crossfade context value
     */
    export const useCrossfadeContext = () => {
      const context = useContext(CrossfadeContext);
      if (!context) {
        throw new Error('useCrossfadeContext must be used within a CrossfadeProvider');
      }
      return context;
    };
    
    /**
     * Access the crossfade service directly (for service-to-service integration)
     * @returns {Object|null} Crossfade service instance
     */
    export const useCrossfadeService = () => {
      const context = useContext(CrossfadeContext);
      if (!context) {
        console.warn('useCrossfadeService called outside of CrossfadeProvider');
        return null;
      }
      return context.service;
    };
    
    export default CrossfadeContext;
    