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
        gainNode.connect(destination);
      }
      
      // Store and return the gain node
      this.gainNodes.set(layerId, gainNode);
      this.volumeLevels.set(layerId, initialVolume);
      
      this.log(`Created gain node for layer "${layerId}" with volume ${initialVolume}`);
      
      return gainNode;
    }
    
    /**
     * Set the volume level for a specific layer
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
        
        // Get options - default to immediate for UI-driven changes
        const immediate = options.immediate !== undefined ? options.immediate : true;
        const transitionTime = options.transitionTime || this.config.transitionTime;
        
        try {
          // Get the gain node (create if doesn't exist)
          const gainNode = this.getGainNode(layerId);
          
          // Get the current volume
          const currentVolume = this.volumeLevels.get(layerId);
          
          // Skip if volume hasn't changed
          if (currentVolume === safeVolume) {
            return true;
          }
          
          // Set gain value
          if (immediate) {
            // Cancel any scheduled changes
            const now = this.audioContext.currentTime;
            gainNode.gain.cancelScheduledValues(now);
            
            // Set immediately
            gainNode.gain.value = safeVolume;
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
          }
          
          // Update stored volume
          this.volumeLevels.set(layerId, safeVolume);
          
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
      this.volumeLevels.forEach((volume, layerId) => {
        volumes[layerId] = volume;
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
        
        // Connect source to gain node
        sourceNode.connect(gainNode);

        console.log(`VolumeController: Connected source to layer "${layerId}" with volume ${gainNode.gain.value}`);
        
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
    fadeVolume(layerId, targetVolume, duration) {
      return new Promise((resolve) => {
        try {
          // Get the gain node
          const gainNode = this.getGainNode(layerId);
          
          // Get current volume
          const currentVolume = this.getVolume(layerId);
          
          // Clamp target volume
          const safeTarget = Math.max(0, Math.min(1, targetVolume));
          
          // Set up the fade
          const now = this.audioContext.currentTime;
          
          // Cancel any scheduled values
          gainNode.gain.cancelScheduledValues(now);
          
          // Start from current value
          gainNode.gain.setValueAtTime(currentVolume, now);
          
          // Linear ramp to target
          gainNode.gain.linearRampToValueAtTime(safeTarget, now + duration);
          
          // Update stored volume
          this.volumeLevels.set(layerId, safeTarget);
          
          this.log(`Fading volume for "${layerId}" from ${currentVolume} to ${safeTarget} over ${duration}s`);
          
          // Set a timeout to resolve the promise when fade completes
          setTimeout(() => {
            resolve(true);
          }, duration * 1000);
        } catch (error) {
          this.log(`Error fading volume for "${layerId}": ${error.message}`, 'error');
          resolve(false);
        }
      });
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
      
      // Clear maps
      this.gainNodes.clear();
      this.volumeLevels.clear();
      
      this.log('VolumeController disposed');
    }
  }
  
  export default VolumeController;