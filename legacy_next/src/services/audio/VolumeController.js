/**
 * VolumeController.js
 * 
 * Service for managing volume levels across multiple audio layers
 * Handles volume state tracking and smooth volume transitions
 */

class VolumeController {
  /**
   * Create a new VolumeController instance
   * @param {Object} options - Configuration options
   * @param {AudioContext} options.audioContext - Web Audio API context
   * @param {Object} [options.initialVolumes={}] - Initial volume levels for layers
   * @param {number} [options.defaultVolume=0.8] - Default volume for new layers
   * @param {number} [options.transitionTime=0.1] - Transition time in seconds for volume changes
   * @param {boolean} [options.enableLogging=false] - Enable detailed console logging
   */
  constructor(options = {}) {
    if (!options.audioContext) {
      throw new Error('VolumeController requires an AudioContext instance');
    }

    // Dependencies
    this.audioContext = options.audioContext;

    // Configuration
    this.config = {
      defaultVolume: options.defaultVolume || 0.8,
      transitionTime: options.transitionTime || 0.1,
      enableLogging: options.enableLogging || false
    };

    // State
    this.gainNodes = new Map(); // Maps layer IDs to GainNode instances
    this.volumeLevels = new Map(); // Maps layer IDs to current volume levels
    this.pendingTransitions = new Map(); // Track pending volume transitions

    // Initialize with any provided volumes
    if (options.initialVolumes) {
      Object.entries(options.initialVolumes).forEach(([layer, volume]) => {
        this.volumeLevels.set(layer, volume);
      });
    }

    this.log('VolumeController initialized');
  }

  /**
   * Create or retrieve a gain node for a specific layer
   * 
   * @param {string} layerId - Identifier for the audio layer
   * @param {AudioNode} [destination=null] - Destination node to connect to
   * @returns {GainNode} - The gain node for the specified layer
   */
  getGainNode(layerId, destination = null) {
    // Check if gain node already exists
    if (this.gainNodes.has(layerId)) {
      return this.gainNodes.get(layerId);
    }

    // Create a new gain node
    const gainNode = this.audioContext.createGain();

    // Set initial volume
    const initialVolume = this.volumeLevels.has(layerId)
      ? this.volumeLevels.get(layerId)
      : this.config.defaultVolume;

    gainNode.gain.value = initialVolume;

    // Connect to destination if provided
    if (destination) {
      try {
        gainNode.connect(destination);
      } catch (err) {
        this.log(`Error connecting gain node to destination: ${err.message}`, 'error');
      }
    }

    // Store and return the gain node
    this.gainNodes.set(layerId, gainNode);
    this.volumeLevels.set(layerId, initialVolume);

    this.log(`Created gain node for layer "${layerId}" with volume ${initialVolume}`);

    return gainNode;
  }

  /**
   * Set the volume level for a specific layer with improved handling
   * 
   * @param {string} layerId - Identifier for the audio layer
   * @param {number} volume - Volume level (0-1)
   * @param {Object} [options] - Set volume options
   * @param {boolean} [options.immediate=false] - Skip transition and set immediately
   * @param {number} [options.transitionTime] - Custom transition time (seconds)
   * @returns {boolean} - Success status
   */
  setVolume(layerId, volume, options = {}) {
    // Clamp volume to valid range
    const safeVolume = Math.max(0, Math.min(1, volume));

    // Parse options with proper defaults
    const immediate = options.immediate === true;
    const transitionTime = options.transitionTime || this.config.transitionTime;

    try {
      // Get the gain node (create if doesn't exist)
      const gainNode = this.getGainNode(layerId);
      if (!gainNode) {
        this.log(`Failed to get gain node for "${layerId}"`, 'error');
        return false;
      }

      // Get the current volume
      const currentVolume = this.volumeLevels.get(layerId);

      // Skip if volume hasn't changed significantly
      if (Math.abs(currentVolume - safeVolume) < 0.001) {
        return true;
      }

      // Cancel any pending transitions for this layer
      if (this.pendingTransitions.has(layerId)) {
        const pendingId = this.pendingTransitions.get(layerId);
        clearTimeout(pendingId);
        this.pendingTransitions.delete(layerId);
      }

      // Set gain value
      if (immediate) {
        this.log(`Setting volume for "${layerId}" immediately to ${safeVolume}`);

        // Cancel any scheduled changes
        const now = this.audioContext.currentTime;
        gainNode.gain.cancelScheduledValues(now);

        // Set immediately
        gainNode.gain.setValueAtTime(safeVolume, now);

        // Update stored volume right away
        this.volumeLevels.set(layerId, safeVolume);
      } else {
        // Smooth transition with proper cancellation
        const now = this.audioContext.currentTime;

        // Cancel any previously scheduled automation
        gainNode.gain.cancelScheduledValues(now);

        // Start from current value
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);

        // Linear ramp to target value
        gainNode.gain.linearRampToValueAtTime(
          safeVolume,
          now + transitionTime
        );

        // Set a timeout to update the stored volume after transition completes
        const timeoutId = setTimeout(() => {
          this.volumeLevels.set(layerId, safeVolume);
          this.pendingTransitions.delete(layerId);
          this.log(`Volume transition for "${layerId}" complete: ${safeVolume}`, 'info');
        }, transitionTime * 1000 + 50); // Add a small buffer to ensure transition completes

        // Store the timeout ID to allow cancellation
        this.pendingTransitions.set(layerId, timeoutId);

        // Update stored volume now for UI consistency
        this.volumeLevels.set(layerId, safeVolume);
      }

      return true;
    } catch (error) {
      this.log(`Error setting volume for "${layerId}": ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Get the current volume for a specific layer
   * 
   * @param {string} layerId - Identifier for the audio layer
   * @returns {number} - Current volume (0-1) or default if not set
   */
  getVolume(layerId) {
    // If we have a gain node, get the actual current value from it
    if (this.gainNodes.has(layerId)) {
      const gainNode = this.gainNodes.get(layerId);
      const currentValue = gainNode.gain.value;

      // Update our stored value to match the actual value
      this.volumeLevels.set(layerId, currentValue);
      return currentValue;
    }

    // Otherwise return from our volume levels map
    return this.volumeLevels.has(layerId)
      ? this.volumeLevels.get(layerId)
      : this.config.defaultVolume;
  }

  /**
   * Get all current volume levels
   * 
   * @returns {Object} - Map of layer IDs to volume levels
   */
  getAllVolumes() {
    const volumes = {};

    // For each gain node, get the actual current value
    this.gainNodes.forEach((gainNode, layerId) => {
      volumes[layerId] = gainNode.gain.value;
      // Update our stored value to match
      this.volumeLevels.set(layerId, gainNode.gain.value);
    });

    // Add any layers without gain nodes
    this.volumeLevels.forEach((volume, layerId) => {
      if (!volumes[layerId]) {
        volumes[layerId] = volume;
      }
    });

    return volumes;
  }

  /**
   * Set volume levels for multiple layers at once
   * 
   * @param {Object} volumeMap - Object mapping layer IDs to volume levels
   * @param {Object} [options] - Set volume options
   * @param {boolean} [options.immediate=false] - Skip transition and set immediately
   * @param {number} [options.transitionTime] - Custom transition time (seconds)
   * @returns {boolean} - Success status
   */
  setMultipleVolumes(volumeMap, options = {}) {
    try {
      let success = true;

      Object.entries(volumeMap).forEach(([layerId, volume]) => {
        const result = this.setVolume(layerId, volume, options);
        if (!result) success = false;
      });

      return success;
    } catch (error) {
      this.log(`Error setting multiple volumes: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Connect a node to a layer's gain node
   * 
   * @param {string} layerId - Identifier for the audio layer
   * @param {AudioNode} sourceNode - Audio node to connect
   * @param {AudioNode} [destination=null] - Destination node (if null, use existing connection)
   * @returns {boolean} - Success status
   */
  connectToLayer(layerId, sourceNode, destination = null) {
    try {
      // Get or create gain node
      const gainNode = this.getGainNode(layerId, destination);

      // Try to disconnect first to prevent duplicate connections
      try {
        sourceNode.disconnect(gainNode);
      } catch (e) {
        // Ignore disconnect errors - likely not connected yet
      }

      // Connect source to gain node
      sourceNode.connect(gainNode);

      this.log(`Connected source to layer "${layerId}" with volume ${gainNode.gain.value}`);

      return true;
    } catch (error) {
      this.log(`Error connecting to layer "${layerId}": ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Mute a specific layer
   * 
   * @param {string} layerId - Identifier for the audio layer
   * @param {Object} [options] - Mute options
   * @param {boolean} [options.immediate=false] - Skip transition and mute immediately
   * @param {number} [options.transitionTime] - Custom transition time (seconds)
   * @returns {boolean} - Success status
   */
  muteLayer(layerId, options = {}) {
    // Store current volume for un-mute
    if (!this.volumeLevels.has(`${layerId}_premute`)) {
      const currentVolume = this.getVolume(layerId);
      this.volumeLevels.set(`${layerId}_premute`, currentVolume);
    }

    // Set volume to 0
    return this.setVolume(layerId, 0, options);
  }

  /**
   * Unmute a specific layer, restoring previous volume
   * 
   * @param {string} layerId - Identifier for the audio layer
   * @param {Object} [options] - Unmute options
   * @param {boolean} [options.immediate=false] - Skip transition and unmute immediately
   * @param {number} [options.transitionTime] - Custom transition time (seconds)
   * @returns {boolean} - Success status
   */
  unmuteLayer(layerId, options = {}) {
    // Get pre-mute volume or use default
    const premuteKey = `${layerId}_premute`;
    const volume = this.volumeLevels.has(premuteKey)
      ? this.volumeLevels.get(premuteKey)
      : this.config.defaultVolume;

    // Clear pre-mute storage
    this.volumeLevels.delete(premuteKey);

    // Restore volume
    return this.setVolume(layerId, volume, options);
  }

  /**
   * Check if a layer is muted (volume is 0)
   * 
   * @param {string} layerId - Identifier for the audio layer
   * @returns {boolean} - True if the layer is muted
   */
  isLayerMuted(layerId) {
    return this.getVolume(layerId) === 0;
  }

  /**
   * Fade volume over time from current to target value
   * 
   * @param {string} layerId - Identifier for the audio layer
   * @param {number} targetVolume - Target volume level (0-1)
   * @param {number} duration - Fade duration in seconds
   * @returns {Promise<boolean>} - Resolves to success status when fade completes
   */
  // In src/services/audio/VolumeController.js
  // Updated VolumeController.fadeVolume method
  /**
   * Fade volume over time from current to target value with improved UI updates
   * 
   * @param {string} layerId - Identifier for the audio layer
   * @param {number} targetVolume - Target volume level (0-1)
   * @param {number} duration - Fade duration in seconds
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Promise<boolean>} - Resolves to success status when fade completes
   */
  fadeVolume(layerId, targetVolume, duration, progressCallback) {
    return new Promise((resolve) => {
      try {
        // Log start of fade with duration
        this.log(`Starting volume fade for "${layerId}" from ${this.getVolume(layerId)} to ${targetVolume} over ${duration}s`);

        // Get the gain node
        const gainNode = this.getGainNode(layerId);

        // Get current volume
        const currentVolume = this.getVolume(layerId);

        // Clamp target volume
        const safeTarget = Math.max(0, Math.min(1, targetVolume));

        // Calculate volume difference
        const volumeDiff = safeTarget - currentVolume;

        // Set up the fade with Web Audio API
        const now = this.audioContext.currentTime;

        // Cancel any scheduled values
        gainNode.gain.cancelScheduledValues(now);

        // Start from current value
        gainNode.gain.setValueAtTime(currentVolume, now);

        // Linear ramp to target
        gainNode.gain.linearRampToValueAtTime(safeTarget, now + duration);

        // Calculate appropriate update interval based on duration
        // Longer durations should have more frequent updates
        // For long transitions (>5s), update every 16ms (60fps)
        // For medium transitions (1-5s), update every 30ms
        // For short transitions (<1s), update every 50ms
        let updateInterval = 30; // Default: 30ms

        if (duration > 5) {
          updateInterval = 16; // ~60fps for long transitions
        } else if (duration < 1) {
          updateInterval = 50; // Less frequent for very short transitions
        }

        this.log(`Using UI update interval of ${updateInterval}ms for ${duration}s transition`);

        const totalUpdates = Math.floor((duration * 1000) / updateInterval);
        let updateCount = 0;

        const updateIntervalId = setInterval(() => {
          updateCount++;

          // Calculate elapsed ratio (0-1)
          const progress = updateCount / totalUpdates;

          // Instead of linear interpolation, calculate actual current value
          // based on the Web Audio API's timing curve
          // This more closely matches what the user actually hears
          const currentIntermediate = currentVolume + (volumeDiff * progress);

          // Every 10th update, log the progress to help with debugging
          if (updateCount % 10 === 0 || updateCount === 1) {
            this.log(`Volume fade progress for "${layerId}": ${Math.round(progress * 100)}% - Volume: ${currentIntermediate.toFixed(3)}`, 'info');
          }

          // Update stored volume level for UI consistency
          this.volumeLevels.set(layerId, currentIntermediate);

          // Call progress callback if provided
          if (progressCallback && typeof progressCallback === 'function') {
            progressCallback(layerId, currentIntermediate, progress);
          }

          // Clear interval when done
          if (updateCount >= totalUpdates) {
            clearInterval(updateIntervalId);

            // Make sure the final value is exactly what was requested
            this.volumeLevels.set(layerId, safeTarget);

            // One final callback with exact target
            if (progressCallback) {
              progressCallback(layerId, safeTarget, 1);
            }

            this.log(`Volume fade complete for "${layerId}": final volume ${safeTarget}`, 'info');

            // Resolve the promise
            resolve(true);
          }
        }, updateInterval);

      } catch (error) {
        this.log(`Error fading volume for "${layerId}": ${error.message}`, 'error');
        resolve(false);
      }
    });
  }


  /**
   * Get a snapshot of the current volume state for all layers
   * 
   * @returns {Object} - Object with layer IDs as keys and volume levels as values
   */
  getVolumeSnapshot() {
    return this.getAllVolumes();
  }

  /**
   * Apply a volume snapshot to restore previous state
   * 
   * @param {Object} snapshot - Volume snapshot to apply
   * @param {Object} [options] - Apply options
   * @param {boolean} [options.immediate=false] - Apply immediately without transitions
   * @returns {boolean} - Success status
   */
  applyVolumeSnapshot(snapshot, options = {}) {
    if (!snapshot || typeof snapshot !== 'object') {
      this.log('Invalid volume snapshot', 'error');
      return false;
    }

    return this.setMultipleVolumes(snapshot, options);
  }

  /**
   * Logging helper that respects configuration
   * 
   * @private
   * @param {string} message - Message to log
   * @param {string} [level='info'] - Log level
   */
  log(message, level = 'info') {
    if (!this.config.enableLogging) return;

    const prefix = '[VolumeController]';

    switch (level) {
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      case 'info':
      default:
        console.log(`${prefix} ${message}`);
        break;
    }
  }

  /**
   * Clean up resources when no longer needed
   */
  dispose() {
    // Disconnect all gain nodes
    this.gainNodes.forEach((gainNode) => {
      try {
        gainNode.disconnect();
      } catch (e) {
        // Ignore errors during cleanup
      }
    });

    // Clear all pending transitions
    this.pendingTransitions.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });

    // Clear maps
    this.gainNodes.clear();
    this.volumeLevels.clear();
    this.pendingTransitions.clear();

    this.log('VolumeController disposed');
  }
}

export default VolumeController;