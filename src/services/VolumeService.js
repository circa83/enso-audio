/**
 * VolumeService.js
 * 
 * Service for managing volume levels across multiple audio layers
 * Handles volume state tracking and smooth volume transitions
 */

class VolumeService {
  /**
   * Create a new VolumeService instance
   * @param {Object} options - Configuration options
   * @param {AudioContext} options.audioContext - Web Audio API context
   * @param {GainNode} options.masterGain - Master gain node from AudioService
   * @param {Object} [options.initialVolumes={}] - Initial volume levels for layers
   * @param {number} [options.defaultVolume=0.8] - Default volume for new layers
   * @param {number} [options.transitionTime=0.1] - Transition time in seconds for volume changes
   * @param {boolean} [options.enableLogging=false] - Enable detailed console logging
   * @param {Function} [options.onVolumeChange] - Callback for volume changes
   */
  constructor(options = {}) {
    if (!options.audioContext) {
      throw new Error('VolumeService requires an AudioContext instance');
    }

    // Dependencies
    this.audioContext = options.audioContext;
    this.masterGain = options.masterGain;

    // If not provided, warn but continue
    if (!this.masterGain) {
      this.log('Warning: VolumeService initialized without masterGain', 'warn');
    }

    // Configuration
    this.config = {
      defaultVolume: options.defaultVolume || 0.8,
      transitionTime: options.transitionTime || 0.1,
      enableLogging: options.enableLogging || false,
      onVolumeChange: options.onVolumeChange || null
    };

    // State
    this.gainNodes = new Map(); // Maps layer IDs to GainNode instances
    this.volumeLevels = new Map(); // Maps layer IDs to current volume levels
    this.pendingTransitions = new Map(); // Track pending volume transitions
    this.mutedState = new Map(); // Track which layers are muted
    this.layerStates = new Map(); // Track state of each layer  


    // Initialize with any provided volumes
    if (options.initialVolumes) {
      Object.entries(options.initialVolumes).forEach(([layer, volume]) => {
        this.volumeLevels.set(layer, volume);
      });
      this.log(`Initialized with ${Object.keys(options.initialVolumes).length} preset volume levels`);
    }

    this.log('VolumeService initialized');
  }

  /**
   * Get the master gain node for connections
   * @returns {GainNode|null} The master gain node
   */
  getMasterGain() {
    return this.masterGain;
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

    // Connect to destination if provided, otherwise use masterGain if available
    if (destination) {
      try {
        gainNode.connect(destination);
      } catch (err) {
        this.log(`Error connecting gain node to destination: ${err.message}`, 'error');
      }
    } else if (this.masterGain) {
      try {
        gainNode.connect(this.masterGain);
      } catch (err) {
        this.log(`Error connecting gain node to master gain: ${err.message}`, 'error');
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
   * Set callback for volume changes
   * @param {Function} callback - Function to call when volume changes
   */
 setVolumeChangeCallback(callback) {
  if (typeof callback === 'function') {
    this.config.onVolumeChange = callback;
  }
}

/**
 * Trigger the volume change callback if set
 * @param {string} layer - Layer ID that changed
 * @param {number} value - New volume value
 * @private
 */
_triggerVolumeChangeCallback(layer, value) {
  if (typeof this.config.onVolumeChange === 'function') {
    this.config.onVolumeChange(layer, value);
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
    const volume = this.getVolume(layerId);
    return volume <= 0.001; // Consider effectively zero as muted
  }

  /**
   * Fade volume from current level to target level over time
   * 
   * @param {string} layerId - Identifier for the audio layer
   * @param {number} targetVolume - Target volume level (0-1)
   * @param {number} duration - Fade duration in seconds
   * @param {Function} [progressCallback] - Optional callback for fade progress: (layerId, currentValue, progress) => void
   * @returns {Promise<boolean>} - Resolves to success status when fade completes
   */
  fadeVolume(layerId, targetVolume, duration, progressCallback = null) {
    return new Promise((resolve) => {
      // Clamp volume to valid range
      const safeTarget = Math.max(0, Math.min(1, targetVolume));

      // Get current volume
      const currentVolume = this.getVolume(layerId);

      // Skip fade if already at target (or very close)
      if (Math.abs(currentVolume - safeTarget) < 0.001) {
        this.log(`Skipping fade for "${layerId}": already at target volume`, 'info');
        if (progressCallback) progressCallback(layerId, safeTarget, 1);
        resolve(true);
        return;
      }

      // Cancel any pending transitions
      if (this.pendingTransitions.has(layerId)) {
        const pendingId = this.pendingTransitions.get(layerId);
        clearTimeout(pendingId);
        this.pendingTransitions.delete(layerId);
      }

      try {
        // Get gain node
        const gainNode = this.getGainNode(layerId);

        // Set up the fade using Web Audio API scheduled values
        const now = this.audioContext.currentTime;
        const endTime = now + duration;

        // Cancel any scheduled values
        gainNode.gain.cancelScheduledValues(now);

        // Set current value
        gainNode.gain.setValueAtTime(currentVolume, now);

        // Schedule linear ramp to target
        gainNode.gain.linearRampToValueAtTime(safeTarget, endTime);

        this.log(`Fading "${layerId}" from ${currentVolume} to ${safeTarget} over ${duration}s`);

        // If we have a progress callback, set up intermediate updates
        if (progressCallback) {
          // Update immediately with starting value
          progressCallback(layerId, currentVolume, 0);

          // Use a timer to provide progress updates
          const updateInterval = Math.min(50, duration * 1000 / 10); // Max 10 updates per fade or every 50ms
          const totalUpdates = Math.ceil(duration * 1000 / updateInterval);
          let updateCount = 0;

          const intervalId = setInterval(() => {
            updateCount++;
            const progress = Math.min(1, updateCount / totalUpdates);

            // Calculate interpolated current value
            const currentValue = currentVolume + (safeTarget - currentVolume) * progress;

            // Call progress callback
            progressCallback(layerId, currentValue, progress);

            // Final update - clear interval and resolve
            if (progress >= 1) {
              clearInterval(intervalId);
              resolve(true);
            }
          }, updateInterval);

          // Store interval ID for potential cleanup
          this.pendingTransitions.set(layerId, intervalId);
        } else {
          // Without progress callback, just set a timeout for completion
          const timeoutId = setTimeout(() => {
            this.pendingTransitions.delete(layerId);
            this.volumeLevels.set(layerId, safeTarget);
            resolve(true);
          }, duration * 1000 + 50); // Add small buffer

          this.pendingTransitions.set(layerId, timeoutId);
        }

        // Update volume level immediately for consistency
        this.volumeLevels.set(layerId, safeTarget);
      } catch (error) {
        this.log(`Error during volume fade for "${layerId}": ${error.message}`, 'error');
        resolve(false);
      }
    });
  }

  /**
   * Fade multiple layers simultaneously
   * 
   * @param {Object} volumeMap - Object mapping layer IDs to target volumes
   * @param {number} duration - Fade duration in seconds
   * @returns {Promise<boolean>} - Resolves when all fades complete
   */
  fadeMultipleVolumes(volumeMap, duration) {
    try {
      const fadePromises = Object.entries(volumeMap).map(([layerId, targetVolume]) =>
        this.fadeVolume(layerId, targetVolume, duration)
      );

      return Promise.all(fadePromises)
        .then(() => true)
        .catch(err => {
          this.log(`Error in multiple fade: ${err.message}`, 'error');
          return false;
        });
    } catch (error) {
      this.log(`Error setting up multiple fades: ${error.message}`, 'error');
      return Promise.resolve(false);
    }
  }

  /**
   * Create a volume snapshot for later restoration
   * 
   * @param {string} [snapshotId='default'] - Identifier for the snapshot
   * @returns {Object} - The volume snapshot data
   */
  createVolumeSnapshot(snapshotId = 'default') {
    const snapshot = {
      id: snapshotId,
      timestamp: Date.now(),
      volumes: this.getAllVolumes()
    };

    this.log(`Created volume snapshot "${snapshotId}" with ${Object.keys(snapshot.volumes).length} layers`);
    return snapshot;
  }

  /**
   * Restore volumes from a snapshot
   * 
   * @param {Object} snapshot - The snapshot to restore
   * @param {Object} [options] - Restore options
   * @param {boolean} [options.immediate=false] - Skip transition
   * @param {number} [options.transitionTime] - Custom transition time (seconds)
   * @returns {boolean} - Success status
   */
  restoreVolumeSnapshot(snapshot, options = {}) {
    if (!snapshot || !snapshot.volumes) {
      this.log('Invalid snapshot data', 'error');
      return false;
    }

    return this.setMultipleVolumes(snapshot.volumes, options);
  }

  /**
   * Get all layer IDs with active gain nodes
   * 
   * @returns {Array<string>} - Array of layer IDs
   */
  getActiveLayers() {
    return Array.from(this.gainNodes.keys());
  }


  /**
   * Check if any layer is active (volume > 0)
   * @returns {boolean} True if any layer has volume
   */
  hasActiveLayer() {
    for (const volume of this.volumeLevels.values()) {
      if (volume > 0) return true;
    }
    return false;
  }


  

  /**
   * Reset volume for a specific layer
   * 
   * @param {string} layerId - Identifier for the audio layer
   * @param {Object} [options] - Reset options
   * @returns {boolean} - Success status
   */
  resetLayer(layerId, options = {}) {
    try {
      // Remove any stored pre-mute volume
      this.volumeLevels.delete(`${layerId}_premute`);

      // Set volume to default
      return this.setVolume(layerId, this.config.defaultVolume, options);
    } catch (error) {
      this.log(`Error resetting layer "${layerId}": ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Logging helper that respects configuration
   * 
   * @param {string} message - Message to log
   * @param {string} [level='info'] - Log level
   */
  log(message, level = 'info') {
    if (!this.config.enableLogging) return;

    const prefix = '[VolumeService]';

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
   * Clean up resources used by VolumeService
   * This should be called when the service is no longer needed
   */
  dispose() {
    try {
      // Clear any pending transitions
      this.pendingTransitions.forEach((timerId) => {
        clearTimeout(timerId);
      });
      this.pendingTransitions.clear();

      // Disconnect all gain nodes
      this.gainNodes.forEach((gainNode) => {
        try {
          gainNode.disconnect();
        } catch (e) {
          // Ignore errors from already disconnected nodes
        }
      });

      // Clear all maps
      this.gainNodes.clear();
      this.volumeLevels.clear();

      this.log('VolumeService disposed');
    } catch (error) {
      this.log(`Error during disposal: ${error.message}`, 'error');
    }
  }

  /**
   * Alias for dispose to maintain API compatibility with other services
   */
  cleanup() {
    this.dispose();
  }
}

export default VolumeService;
