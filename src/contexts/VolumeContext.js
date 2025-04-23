import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import VolumeService from '../services/VolumeService';
import { useAudioService } from './AudioContext';
import eventBus, { EVENTS } from '../services/EventBus';

// Create the context
const VolumeContext = createContext(null);

/**
 * Provider component for volume management
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @param {Object} props.initialVolumes - Initial volume levels
 * @param {AudioContext} [props.audioContext] - Web Audio API context (optional, can be injected)
 * @param {GainNode} [props.masterGain] - Master gain node (optional, can be injected)
 * @param {boolean} [props.initialized] - Whether audio system is initialized (optional, can be injected)
 */
export const VolumeProvider = ({ 
  children, 
  initialVolumes = {},
  // Accept audio services as props with defaults to maintain compatibility
  audioContext: injectedAudioContext = null,
  masterGain: injectedMasterGain = null,
  initialized: injectedInitialized = false
}) => {
    // Get dependencies from AudioService as fallback
    const audioService = useAudioService();
    
    // Use injected values if provided, otherwise fall back to values from useAudioService
    const audioContext = injectedAudioContext || (audioService ? audioService.audioContext : null);
    const masterGain = injectedMasterGain || (audioService ? audioService.masterGain : null);
    const initialized = injectedInitialized || (audioService ? audioService.initialized : false);

    // Service reference
    const [volumeService, setVolumeService] = useState(null);

    // State
    const [layerVolumes, setLayerVolumes] = useState(initialVolumes);
    const [mutedLayers, setMutedLayers] = useState({});
    const [pendingFades, setPendingFades] = useState({});
    const [ready, setReady] = useState(false);

    // Callback for volume change events - defined OUTSIDE useEffect
    const handleVolumeChange = useCallback((layer, value) => {
        // Update our local state when volume changes in the service
        setLayerVolumes(prev => ({
            ...prev,
            [layer]: value
        }));

        // No need to emit event here - VolumeService already does this
    }, []);

    // Initialize VolumeService when AudioService is ready
    useEffect(() => {
        if (!initialized || !audioContext || !masterGain) return;

        try {
            const service = new VolumeService({
                audioContext,
                masterGain,
                initialVolumes: layerVolumes,
                enableLogging: true,
                onVolumeChange: handleVolumeChange // Use the callback defined outside
            });

            setVolumeService(service);
            setReady(true);

            // Clean up on unmount
            return () => {
                service.dispose();
            };
        } catch (error) {
            console.error('[VolumeContext] Error initializing VolumeService:', error);
        }
    }, [initialized, audioContext, masterGain, layerVolumes, handleVolumeChange]);

    // Listen for volume events from EventBus
    useEffect(() => {
        if (!ready) return;

        // Handler for volume changes from EventBus
        const handleVolumeEvent = (data) => {
            const { layer, value } = data;
            
            // Update local state for UI
            setLayerVolumes(prev => ({
                ...prev,
                [layer]: value
            }));
        };

        // Handler for mute events from EventBus
        const handleMuteEvent = (data) => {
            const { layer, previousVolume } = data;
            
            // Update muted layers state
            setMutedLayers(prev => ({
                ...prev,
                [layer]: previousVolume || 0
            }));
        };

        // Handler for unmute events from EventBus
        const handleUnmuteEvent = (data) => {
            const { layer } = data;
            
            // Remove from muted layers
            setMutedLayers(prev => {
                const updated = { ...prev };
                delete updated[layer];
                return updated;
            });
        };

        // Handler for fade progress events
        const handleFadeProgress = (data) => {
            const { layer, currentVolume, progress, targetVolume } = data;
            
            // Update pending fades state
            setPendingFades(prev => {
                if (!prev[layer]) return prev;
                
                return {
                    ...prev,
                    [layer]: {
                        target: targetVolume,
                        progress: progress
                    }
                };
            });
            
            // Also update current volume for UI feedback
            setLayerVolumes(prev => ({
                ...prev,
                [layer]: currentVolume
            }));
        };

        // Handler for fade completion
        const handleFadeComplete = (data) => {
            const { layer } = data;
            
            // Remove from pending fades
            setPendingFades(prev => {
                const updated = { ...prev };
                delete updated[layer];
                return updated;
            });
        };

        // Subscribe to events
        eventBus.on(EVENTS.VOLUME_CHANGED, handleVolumeEvent);
        eventBus.on(EVENTS.VOLUME_MUTED, handleMuteEvent);
        eventBus.on(EVENTS.VOLUME_UNMUTED, handleUnmuteEvent);
        eventBus.on('volume:fadeProgress', handleFadeProgress);
        eventBus.on('volume:fadeComplete', handleFadeComplete);

        // Cleanup subscriptions
        return () => {
            eventBus.off(EVENTS.VOLUME_CHANGED, handleVolumeEvent);
            eventBus.off(EVENTS.VOLUME_MUTED, handleMuteEvent);
            eventBus.off(EVENTS.VOLUME_UNMUTED, handleUnmuteEvent);
            eventBus.off('volume:fadeProgress', handleFadeProgress);
            eventBus.off('volume:fadeComplete', handleFadeComplete);
        };
    }, [ready]);

    // Set volume for a specific layer
    const setLayerVolume = useCallback((layer, value, options = {}) => { 
        if (!volumeService) return false;

        try {
            // Update local state for immediate UI feedback
            setLayerVolumes(prev => ({
                ...prev,
                [layer]: value
            }));

            // Call service method
            const result = volumeService.setVolume(layer, value, options);

            // If this layer was muted, update muted state
            if (value > 0 && mutedLayers[layer]) {
                setMutedLayers(prev => {
                    const updated = { ...prev };
                    delete updated[layer];
                    return updated;
                });
            }

            return result;
        } catch (error) {
            console.error(`[VolumeContext] Error setting volume for ${layer}:`, error);
            return false;
        }
    }, [volumeService, mutedLayers]);

    // Set volumes for multiple layers at once - RENAMED to avoid conflict
    const setMultipleVolumes = useCallback((volumeMap, options = {}) => {
        if (!volumeService) return false;

        try {
            // Update local state
            setLayerVolumes(prev => ({
                ...prev,
                ...volumeMap
            }));

            // Call service method
            return volumeService.setMultipleVolumes(volumeMap, options);
        } catch (error) {
            console.error('[VolumeContext] Error setting multiple volumes:', error);
            return false;
        }
    }, [volumeService]);

    // Fade volume for a layer
    const fadeLayerVolume = useCallback((layer, targetVolume, duration) => {
        if (!volumeService) return Promise.resolve(false);

        // Convert milliseconds to seconds for VolumeService
        const durationSec = duration / 1000;

        // Track fade progress in state
        setPendingFades(prev => ({
            ...prev,
            [layer]: { target: targetVolume, progress: 0 }
        }));

        // Execute the fade - no need for progress handler here
        // EventBus handlers will update state based on events
        return volumeService.fadeVolume(layer, targetVolume, durationSec);
    }, [volumeService]);

    // Mute a layer
    const muteLayer = useCallback((layer, options = {}) => {
        if (!volumeService) return false;

        try {
            // Track muted state - will be updated by EventBus handler too
            setMutedLayers(prev => ({
                ...prev,
                [layer]: layerVolumes[layer] || 0
            }));

            // Call service method
            return volumeService.muteLayer(layer, options);
        } catch (error) {
            console.error(`[VolumeContext] Error muting layer ${layer}:`, error);
            return false;
        }
    }, [volumeService, layerVolumes]);

    // Unmute a layer
    const unmuteLayer = useCallback((layer, options = {}) => {
        if (!volumeService) return false;

        try {
            // Update muted state - will be updated by EventBus handler too
            setMutedLayers(prev => {
                const updated = { ...prev };
                delete updated[layer];
                return updated;
            });

            // Call service method
            return volumeService.unmuteLayer(layer, options);
        } catch (error) {
            console.error(`[VolumeContext] Error unmuting layer ${layer}:`, error);
            return false;
        }
    }, [volumeService]);

    // Connect an audio source to a layer
    const connectSourceToLayer = useCallback((layer, sourceNode, destination = null) => {
        if (!volumeService) return false;

        try {
            return volumeService.connectToLayer(layer, sourceNode, destination);
        } catch (error) {
            console.error(`[VolumeContext] Error connecting source to layer ${layer}:`, error);
            return false;
        }
    }, [volumeService]);

    // Create a volume snapshot
    const createVolumeSnapshot = useCallback((snapshotId = 'default') => {
        if (!volumeService) return null;

        try {
            return volumeService.createVolumeSnapshot(snapshotId);
        } catch (error) {
            console.error('[VolumeContext] Error creating volume snapshot:', error);
            return null;
        }
    }, [volumeService]);

    // Restore a volume snapshot
    const restoreVolumeSnapshot = useCallback((snapshot, options = {}) => {
        if (!volumeService) return false;

        try {
            return volumeService.restoreVolumeSnapshot(snapshot, options);
        } catch (error) {
            console.error('[VolumeContext] Error restoring volume snapshot:', error);
            return false;
        }
    }, [volumeService]);

    // Get the gain node for a layer
    const getLayerGainNode = useCallback((layer) => {
        if (!volumeService) return null;
        return volumeService.getGainNode(layer);
    }, [volumeService]);

    // Check if layer is muted
    const isLayerMuted = useCallback((layer) => {
        if (!volumeService) return false;
        return volumeService.isLayerMuted(layer);
    }, [volumeService]);

    // Create memoized context value
    const contextValue = useMemo(() => ({
        // State
        layerVolumes,
        mutedLayers,
        pendingFades,
        ready,

        // Service methods
        setLayerVolume,
        setMultipleVolumes,
        fadeLayerVolume,
        muteLayer,
        unmuteLayer,
        connectSourceToLayer,
        createVolumeSnapshot,
        restoreVolumeSnapshot,
        getLayerGainNode,
        isLayerMuted,

        // Service access for advanced usage
        service: volumeService
    }), [
        layerVolumes,
        mutedLayers,
        pendingFades,
        ready,
        volumeService,
        setLayerVolume,
        setMultipleVolumes,
        fadeLayerVolume,
        muteLayer,
        unmuteLayer,
        connectSourceToLayer,
        createVolumeSnapshot,
        restoreVolumeSnapshot,
        getLayerGainNode,
        isLayerMuted
    ]);

    return (
        <VolumeContext.Provider value={contextValue}>
            {children}
        </VolumeContext.Provider>
    );
};

/**
 * Custom hook to use the volume context
 * @returns {Object} Volume context value
 */
export const useVolumeContext = () => {
  const context = useContext(VolumeContext);
  if (!context) {
    throw new Error('useVolumeContext must be used within a VolumeProvider');
  }
  return context;
};

export default VolumeContext;
