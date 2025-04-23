// src/hooks/useVolume.js
import { useContext, useMemo, useCallback } from 'react';
import VolumeContext from '../contexts/VolumeContext';
import eventBus, { EVENTS } from '../services/EventBus';

/**
 * Custom hook to provide easy access to volume control functionality
 * Follows the modular service > context > hook architecture pattern
 * 
 * @returns {Object} Volume control functionality and state
 */
export function useVolume() {
  const context = useContext(VolumeContext);
  
  if (!context) {
    throw new Error('useVolume must be used within a VolumeProvider');
  }

  // Extract values from context for cleaner access
  const {
    // State
    layerVolumes,
    mutedLayers,
    pendingFades,
    ready,

    // Methods
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
    
    // Direct service access
    service
  } = context;

  // Enhanced volume control with additional logging
  const setVolume = useCallback((layer, value, options = {}) => {
    console.log(`[useVolume] Setting ${layer} volume to ${value}`);
    return setLayerVolume(layer, value, options);
  }, [setLayerVolume]);

  // Batch volume operation with logging
  const setBatchVolumes = useCallback((volumeMap, options = {}) => {
    console.log(`[useVolume] Setting batch volumes for layers: ${Object.keys(volumeMap).join(', ')}`);
    return setMultipleVolumes(volumeMap, options);
  }, [setMultipleVolumes]);

  // Enhanced fade with ms duration and logging
  const fadeVolume = useCallback((layer, targetVolume, durationMs) => {
    console.log(`[useVolume] Fading ${layer} to ${targetVolume} over ${durationMs}ms`);
    return fadeLayerVolume(layer, targetVolume, durationMs);
  }, [fadeLayerVolume]);

  // Mute with enhanced logging
  const mute = useCallback((layer, options = {}) => {
    console.log(`[useVolume] Muting ${layer}`);
    return muteLayer(layer, options);
  }, [muteLayer]);

  // Unmute with enhanced logging
  const unmute = useCallback((layer, options = {}) => {
    console.log(`[useVolume] Unmuting ${layer}`);
    return unmuteLayer(layer, options);
  }, [unmuteLayer]);

  // Toggle mute state
  const toggleMute = useCallback((layer, options = {}) => {
    const isMuted = mutedLayers[layer] !== undefined;
    console.log(`[useVolume] Toggling mute for ${layer}, current state: ${isMuted ? 'muted' : 'unmuted'}`);
    return isMuted ? unmuteLayer(layer, options) : muteLayer(layer, options);
  }, [mutedLayers, muteLayer, unmuteLayer]);

  // Get volume level for a layer with fallback
  const getVolume = useCallback((layer) => {
    return layerVolumes[layer] !== undefined ? layerVolumes[layer] : 0;
  }, [layerVolumes]);

  // Enhanced snapshot methods with logging
const createSnapshot = useCallback((snapshotId = 'default') => {
    console.log(`[useVolume] Creating volume snapshot: ${snapshotId}`);
    return createVolumeSnapshot(snapshotId);
  }, [createVolumeSnapshot]);
  
  const restoreSnapshot = useCallback((snapshot, options = {}) => {
    console.log(`[useVolume] Restoring volume snapshot: ${snapshot.id || 'unnamed'}`);
    return restoreVolumeSnapshot(snapshot, options);
  }, [restoreVolumeSnapshot]);

  // Organized return object with both direct API and organized groups
  return {
    // State
    volumes: layerVolumes,
    mutedLayers,
    pendingFades,
    ready,

    // Direct API (for simpler usage)
    setVolume,
    setBatchVolumes,
    fadeVolume,
    mute,
    unmute,
    toggleMute,
    getVolume,
    createSnapshot, 
    restoreSnapshot,
    isLayerMuted,
    connectSourceToLayer,
    
    // Organized controls for more structured access
    controls: {
      set: setVolume,
      setBatch: setBatchVolumes,
      fade: fadeVolume,
      mute,
      unmute,
      toggle: toggleMute,
      get: getVolume,
      isMuted: isLayerMuted,
      connect: connectSourceToLayer
    },
    
    // Snapshot functionality
    snapshots: {
      create: createVolumeSnapshot,
      restore: restoreVolumeSnapshot
    },
    
    // Low-level access
    getGainNode: getLayerGainNode,
    service
  };
}

// Export as default as well for flexibility
export default useVolume;
