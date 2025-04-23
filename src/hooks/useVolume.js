// src/hooks/useVolume.js
import { useContext, useMemo } from 'react';
import VolumeContext from '../contexts/VolumeContext';

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
    
    // Service access
    service
  } = context;

  // Group related functionality for a more organized API
  
  // Volume control methods
  const controls = useMemo(() => ({
    set: (layer, value, options = {}) => {
      console.log(`[useVolume] Setting volume for ${layer} to ${value}`);
      return setLayerVolume(layer, value, options);
    },
    setMultiple: (volumeMap, options = {}) => {
      console.log(`[useVolume] Setting multiple volumes for layers: ${Object.keys(volumeMap).join(', ')}`);
      return setMultipleVolumes(volumeMap, options);
    },
    fade: (layer, targetVolume, duration) => {
      console.log(`[useVolume] Fading ${layer} volume to ${targetVolume} over ${duration}ms`);
      return fadeLayerVolume(layer, targetVolume, duration);
    }
  }), [setLayerVolume, setMultipleVolumes, fadeLayerVolume]);
  
  // Layer muting
  const muting = useMemo(() => ({
    muted: mutedLayers,
    mute: (layer, options = {}) => {
      console.log(`[useVolume] Muting ${layer}`);
      return muteLayer(layer, options);
    },
    unmute: (layer, options = {}) => {
      console.log(`[useVolume] Unmuting ${layer}`);
      return unmuteLayer(layer, options);
    },
    isMuted: (layer) => {
      return isLayerMuted(layer);
    },
    toggle: (layer, options = {}) => {
      if (isLayerMuted(layer)) {
        console.log(`[useVolume] Toggling mute: Unmuting ${layer}`);
        return unmuteLayer(layer, options);
      } else {
        console.log(`[useVolume] Toggling mute: Muting ${layer}`);
        return muteLayer(layer, options);
      }
    }
  }), [mutedLayers, muteLayer, unmuteLayer, isLayerMuted]);
  
  // Audio routing
  const routing = useMemo(() => ({
    connect: (layer, sourceNode, destination = null) => {
      console.log(`[useVolume] Connecting source to ${layer}`);
      return connectSourceToLayer(layer, sourceNode, destination);
    },
    getGainNode: (layer) => {
      return getLayerGainNode(layer);
    }
  }), [connectSourceToLayer, getLayerGainNode]);
  
  // Snapshots for saving/restoring volume states
  const snapshots = useMemo(() => ({
    create: (snapshotId = 'default') => {
      console.log(`[useVolume] Creating volume snapshot: ${snapshotId}`);
      return createVolumeSnapshot(snapshotId);
    },
    restore: (snapshot, options = {}) => {
      console.log(`[useVolume] Restoring volume snapshot: ${snapshot.id || 'unnamed'}`);
      return restoreVolumeSnapshot(snapshot, options);
    }
  }), [createVolumeSnapshot, restoreVolumeSnapshot]);
  
  // State information
  const state = useMemo(() => ({
    volumes: layerVolumes,
    muted: mutedLayers,
    pendingFades,
    isReady: ready
  }), [layerVolumes, mutedLayers, pendingFades, ready]);

  // Return both grouped functionality and individual functions/values
  // to support both usage patterns:
  // const { controls, muting } = useVolume(); // Grouped
  // const { setLayerVolume, muteLayer } = useVolume(); // Individual
  return {
    // Grouped functionality
    controls,
    muting,
    routing,
    snapshots,
    state,
    
    // Individual values and functions (for backward compatibility and direct access)
    layerVolumes,
    mutedLayers,
    pendingFades,
    ready,
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
    
    // Direct service access for advanced usage
    service
  };
}

// Export as default as well for flexibility
export default useVolume;
