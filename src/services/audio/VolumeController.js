/**
 * VolumeController.js
 * 
 * Service for managing volume levels for audio layers.
 * Provides smooth volume transitions, state tracking, and preset support.
 */

// Default layer volume settings
const DEFAULT_VOLUMES = {
    drone: 0.25,
    melody: 0.0,
    rhythm: 0.0, 
    nature: 0.0
  };
  
  class VolumeController {
    constructor(audioContext) {
      this.audioContext = audioContext;
      this.volumes = { ...DEFAULT_VOLUMES };
      this.masterVolume = 0.8; // Default to 80%
      this.gainNodes = new Map(); // Map of layerId -> GainNode
      this.masterGainNode = null;
      this.listeners = new Map(); // Map of event types to listener arrays
      this.transitionTimers = new Map(); // Map of layerId -> timeout ID
      
      // Volume range limits
      this.minVolume = 0;
      this.maxVolume = 1;
      
      // Default transition settings
      this.defaultTransitionDuration = 500; // in milliseconds
      this.useExponentialFade = true; // Use exponential or linear transitions
  
      // Debug flag
      this.debug = false;
    }
    
    /**
     * Set the audio context (used when context is created later)
     * @param {AudioContext} audioContext - Web Audio API context
     */
    setAudioContext(audioContext) {
      if (this.debug) console.log('VolumeController: Setting audio context', audioContext);
      this.audioContext = audioContext;
    }
    
    /**
     * Register a gain node for a layer
     * @param {string} layerId - ID of the audio layer
     * @param {GainNode} gainNode - Web Audio API GainNode for the layer
     */
    registerGainNode(layerId, gainNode) {
      if (!gainNode) {
        console.error(`Invalid gain node for layer ${layerId}`);
        return;
      }
      
      if (this.debug) console.log(`VolumeController: Registering gain node for ${layerId}`, gainNode);
      
      // Store the gain node
      this.gainNodes.set(layerId, gainNode);
      
      // Apply current volume to the node
      const volume = this.volumes[layerId] !== undefined ? this.volumes[layerId] : DEFAULT_VOLUMES[layerId] || 0;
      this.setLayerVolume(layerId, volume, 0); // Apply immediately (0ms transition)
    }
    
    /**
     * Register the master gain node
     * @param {GainNode} gainNode - Web Audio API GainNode for master volume
     */
    registerMasterGainNode(gainNode) {
      if (!gainNode) {
        console.error('Invalid master gain node');
        return;
      }
      
      if (this.debug) console.log('VolumeController: Registering master gain node', gainNode);
      
      this.masterGainNode = gainNode;
      
      // Apply current master volume
      this.setMasterVolume(this.masterVolume, 0); // Apply immediately (0ms transition)
    }
    
    /**
     * Set volume for a specific layer
     * @param {string} layerId - ID of the audio layer
     * @param {number} volume - Volume level (0-1)
     * @param {number} transitionDuration - Duration of transition in milliseconds (optional)
     * @returns {boolean} Success status
     */
    setLayerVolume(layerId, volume, transitionDuration = null) {
      // Clamp volume to valid range
      volume = Math.max(this.minVolume, Math.min(this.maxVolume, volume));
      
      // Store the volume value
      this.volumes[layerId] = volume;
      
      if (this.debug) console.log(`VolumeController: Setting ${layerId} volume to ${volume}`);
      
      // Get the gain node
      const gainNode = this.gainNodes.get(layerId);
      if (!gainNode) {
        // Still store the volume even if we don't have a gain node yet
        if (this.debug) console.log(`VolumeController: No gain node found for ${layerId}, storing volume state only`);
        return false;
      }
      
      // Clear any ongoing transition for this layer
      if (this.transitionTimers.has(layerId)) {
        clearTimeout(this.transitionTimers.get(layerId));
        this.transitionTimers.delete(layerId);
      }
      
      // Use provided transition duration or default
      const duration = transitionDuration !== null 
        ? transitionDuration 
        : this.defaultTransitionDuration;
      
      // Apply volume with transition
      this.applyVolumeTransition(gainNode.gain, volume, duration);
      
      // Emit volume change event
      this.emit('volumeChange', { layerId, volume });
      
      return true;
    }
    
    /**
     * Set master volume level
     * @param {number} volume - Volume level (0-1)
     * @param {number} transitionDuration - Duration of transition in milliseconds (optional)
     * @returns {boolean} Success status
     */
    setMasterVolume(volume, transitionDuration = null) {
      // Clamp volume to valid range
      volume = Math.max(this.minVolume, Math.min(this.maxVolume, volume));
      
      // Store the volume value
      this.masterVolume = volume;
      
      if (this.debug) console.log(`VolumeController: Setting master volume to ${volume}`);
      
      // Check if we have a master gain node
      if (!this.masterGainNode) {
        if (this.debug) console.log('VolumeController: No master gain node found, storing volume state only');
        return false;
      }
      
      // Clear any ongoing transition for master volume
      if (this.transitionTimers.has('master')) {
        clearTimeout(this.transitionTimers.get('master'));
        this.transitionTimers.delete('master');
      }
      
      // Use provided transition duration or default
      const duration = transitionDuration !== null 
        ? transitionDuration 
        : this.defaultTransitionDuration;
      
      // Apply volume with transition
      this.applyVolumeTransition(this.masterGainNode.gain, volume, duration);
      
      // Emit master volume change event
      this.emit('masterVolumeChange', { volume });
      
      return true;
    }
    
    /**
     * Apply a volume transition to an audio param
     * @param {AudioParam} audioParam - Web Audio API AudioParam to adjust
     * @param {number} targetValue - Target volume level
     * @param {number} duration - Duration of transition in milliseconds
     * @private
     */
    applyVolumeTransition(audioParam, targetValue, duration) {
      if (!this.audioContext) {
        // If no audio context, just set the value directly
        if (this.debug) console.log('VolumeController: No audio context, setting value directly', targetValue);
        audioParam.value = targetValue;
        return;
      }
      
      // For very short durations, just set the value immediately
      if (duration < 10) {
        if (this.debug) console.log('VolumeController: Short duration, setting value directly', targetValue);
        audioParam.value = targetValue;
        return;
      }
      
      try {
        const now = this.audioContext.currentTime;
        const durationSeconds = duration / 1000;
        
        if (this.debug) console.log(`VolumeController: Applying volume transition to ${targetValue} over ${durationSeconds}s`);
        
        // Cancel any scheduled changes
        audioParam.cancelScheduledValues(now);
        
        // Start from current value
        audioParam.setValueAtTime(audioParam.value, now);
        
        // Apply transition based on settings
        if (this.useExponentialFade && targetValue > 0.0001) { 
          // For exponential fades, target must be > 0
          audioParam.exponentialRampToValueAtTime(
            Math.max(0.0001, targetValue), // Ensure minimum value for exponential ramp
            now + durationSeconds
          );
        } else {
          // Linear fade for zero targets or when exponential not preferred
          audioParam.linearRampToValueAtTime(
            targetValue,
            now + durationSeconds
          );
        }
      } catch (error) {
        console.error('Error applying volume transition:', error);
        // Fallback: set value directly
        audioParam.value = targetValue;
      }
    }
    
    /**
     * Get volume for a specific layer
     * @param {string} layerId - ID of the audio layer
     * @returns {number} Volume level (0-1)
     */
    getLayerVolume(layerId) {
      return this.volumes[layerId] !== undefined 
        ? this.volumes[layerId] 
        : DEFAULT_VOLUMES[layerId] || 0;
    }
    
    /**
     * Get master volume level
     * @returns {number} Volume level (0-1)
     */
    getMasterVolume() {
      return this.masterVolume;
    }
    
    /**
     * Get all layer volumes
     * @returns {Object} Map of layerId to volume
     */
    getAllVolumes() {
      return { ...this.volumes };
    }
    
    /**
     * Reset a layer to its default volume
     * @param {string} layerId - ID of the audio layer
     * @param {number} transitionDuration - Duration of transition in milliseconds (optional)
     * @returns {boolean} Success status
     */
    resetLayerVolume(layerId, transitionDuration = null) {
      const defaultVolume = DEFAULT_VOLUMES[layerId] || 0;
      return this.setLayerVolume(layerId, defaultVolume, transitionDuration);
    }
    
    /**
     * Reset all layers to default volumes
     * @param {number} transitionDuration - Duration of transition in milliseconds (optional)
     */
    resetAllVolumes(transitionDuration = null) {
      for (const layerId in DEFAULT_VOLUMES) {
        this.resetLayerVolume(layerId, transitionDuration);
      }
      this.setMasterVolume(0.8, transitionDuration); // Reset master volume to default
    }
    
    /**
     * Gradually fade a layer to a target volume
     * @param {string} layerId - ID of the audio layer
     * @param {number} targetVolume - Target volume level (0-1)
     * @param {number} duration - Duration of fade in milliseconds
     * @param {Function} onComplete - Callback when fade completes (optional)
     * @returns {boolean} Success status
     */
    fadeLayerVolume(layerId, targetVolume, duration, onComplete = null) {
      const success = this.setLayerVolume(layerId, targetVolume, duration);
      
      if (success && onComplete) {
        // Set a timer to call the onComplete callback
        const timerId = setTimeout(() => {
          onComplete({ layerId, volume: targetVolume });
          this.transitionTimers.delete(layerId);
        }, duration);
        
        this.transitionTimers.set(layerId, timerId);
      }
      
      return success;
    }
    
    /**
     * Gradually fade master volume to a target level
     * @param {number} targetVolume - Target volume level (0-1)
     * @param {number} duration - Duration of fade in milliseconds
     * @param {Function} onComplete - Callback when fade completes (optional)
     * @returns {boolean} Success status
     */
    fadeMasterVolume(targetVolume, duration, onComplete = null) {
      const success = this.setMasterVolume(targetVolume, duration);
      
      if (success && onComplete) {
        // Set a timer to call the onComplete callback
        const timerId = setTimeout(() => {
          onComplete({ volume: targetVolume });
          this.transitionTimers.delete('master');
        }, duration);
        
        this.transitionTimers.set('master', timerId);
      }
      
      return success;
    }
    
    /**
     * Apply a volume profile to all layers
     * @param {Object} volumeProfile - Map of layerId to volume
     * @param {number} transitionDuration - Duration of transition in milliseconds (optional)
     */
    applyVolumeProfile(volumeProfile, transitionDuration = null) {
      for (const [layerId, volume] of Object.entries(volumeProfile)) {
        this.setLayerVolume(layerId, volume, transitionDuration);
      }
    }
    
    /**
     * Create a volume snapshot (current state of all volumes)
     * @returns {Object} Volume snapshot object
     */
    createVolumeSnapshot() {
      return {
        masterVolume: this.masterVolume,
        layerVolumes: { ...this.volumes },
        timestamp: Date.now()
      };
    }
    
    /**
     * Apply a volume snapshot
     * @param {Object} snapshot - Volume snapshot to apply
     * @param {number} transitionDuration - Duration of transition in milliseconds (optional)
     * @returns {boolean} Success status
     */
    applyVolumeSnapshot(snapshot, transitionDuration = null) {
      if (!snapshot || !snapshot.layerVolumes) {
        return false;
      }
      
      // Apply master volume if present
      if (snapshot.masterVolume !== undefined) {
        this.setMasterVolume(snapshot.masterVolume, transitionDuration);
      }
      
      // Apply layer volumes
      for (const [layerId, volume] of Object.entries(snapshot.layerVolumes)) {
        this.setLayerVolume(layerId, volume, transitionDuration);
      }
      
      return true;
    }
    
    /**
     * Mute a specific layer
     * @param {string} layerId - ID of the audio layer
     * @param {number} transitionDuration - Duration of transition in milliseconds (optional)
     * @returns {boolean} Success status
     */
    muteLayer(layerId, transitionDuration = null) {
      // Store previous volume for unmuting
      const previousVolume = this.getLayerVolume(layerId);
      if (previousVolume > 0) {
        // Store previous volume in a special map
        this._storeLayerPreviousVolume(layerId, previousVolume);
      }
      
      return this.setLayerVolume(layerId, 0, transitionDuration);
    }
    
    /**
     * Unmute a specific layer
     * @param {string} layerId - ID of the audio layer
     * @param {number} transitionDuration - Duration of transition in milliseconds (optional)
     * @returns {boolean} Success status
     */
    unmuteLayer(layerId, transitionDuration = null) {
      const previousVolume = this._getLayerPreviousVolume(layerId);
      if (previousVolume) {
        return this.setLayerVolume(layerId, previousVolume, transitionDuration);
      } else {
        // If no previous volume stored, use default
        return this.resetLayerVolume(layerId, transitionDuration);
      }
    }
    
    /**
     * Store previous volume for a layer (used for mute/unmute)
     * @param {string} layerId - ID of the audio layer
     * @param {number} volume - Volume level to store
     * @private
     */
    _storeLayerPreviousVolume(layerId, volume) {
      if (!this._previousVolumes) {
        this._previousVolumes = {};
      }
      this._previousVolumes[layerId] = volume;
    }
    
    /**
     * Get previous volume for a layer (used for unmute)
     * @param {string} layerId - ID of the audio layer
     * @returns {number|null} Previous volume or null if not found
     * @private
     */
    _getLayerPreviousVolume(layerId) {
      if (!this._previousVolumes) {
        return null;
      }
      return this._previousVolumes[layerId] || null;
    }
    
    /**
     * Set default transition duration
     * @param {number} duration - Duration in milliseconds
     */
    setDefaultTransitionDuration(duration) {
      this.defaultTransitionDuration = Math.max(0, duration);
    }
    
    /**
     * Set transition curve type
     * @param {boolean} useExponential - Whether to use exponential curves (true) or linear (false)
     */
    setTransitionCurveType(useExponential) {
      this.useExponentialFade = useExponential;
    }
    
    /**
     * Enable or disable debug logging
     * @param {boolean} enabled - Whether to enable debug logging
     */
    setDebug(enabled) {
      this.debug = enabled;
    }
    
    /**
     * Add an event listener
     * @param {string} event - Event name ('volumeChange', 'masterVolumeChange')
     * @param {Function} listener - Event listener
     */
    addEventListener(event, listener) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      
      this.listeners.get(event).push(listener);
    }
    
    /**
     * Remove an event listener
     * @param {string} event - Event name
     * @param {Function} listener - Event listener
     */
    removeEventListener(event, listener) {
      if (!this.listeners.has(event)) {
        return;
      }
      
      const listeners = this.listeners.get(event);
      const index = listeners.indexOf(listener);
      
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
    
    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {Object} data - Event data
     * @private
     */
    emit(event, data) {
      if (!this.listeners.has(event)) {
        return;
      }
      
      for (const listener of this.listeners.get(event)) {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      }
    }
    
    /**
     * Clean up resources
     */
    cleanup() {
      // Clear all transition timers
      for (const timerId of this.transitionTimers.values()) {
        clearTimeout(timerId);
      }
      this.transitionTimers.clear();
      
      // Clear all listeners
      this.listeners.clear();
      
      // Reset all volumes to default immediately
      for (const gainNode of this.gainNodes.values()) {
        if (gainNode && gainNode.gain) {
          try {
            gainNode.gain.cancelScheduledValues(0);
            gainNode.gain.value = 0;
          } catch (error) {
            console.error('Error resetting gain node:', error);
          }
        }
      }
      
      // Reset master volume
      if (this.masterGainNode && this.masterGainNode.gain) {
        try {
          this.masterGainNode.gain.cancelScheduledValues(0);
          this.masterGainNode.gain.value = 0.8; // Default
        } catch (error) {
          console.error('Error resetting master gain node:', error);
        }
      }
      
      // Clear gain node references
      this.gainNodes.clear();
      this.masterGainNode = null;
  
      if (this.debug) console.log('VolumeController: Cleanup complete');
    }
  }
  
  export default VolumeController;