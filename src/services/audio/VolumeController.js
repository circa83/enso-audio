/**
 * VolumeController.js
 * Service for managing volume levels across audio layers with advanced ramping functionality
 */

class VolumeController {
    /**
     * Creates a new VolumeController instance
     * @param {AudioCore} audioCore - Reference to the AudioCore service
     * @param {Object} config - Configuration options
     */
    constructor(audioCore, config = {}) {
      // Dependencies
      this.audioCore = audioCore;
      
      // Store gain nodes for each layer
      this.gainNodes = new Map();
      
      // Track current volumes for each layer
      this.currentVolumes = new Map();
      
      // Track volume transitions
      this.activeTransitions = new Map();
      
      // Configuration with defaults
      this.config = {
        defaultRampDuration: 500, // Default volume change duration in milliseconds
        minVolume: 0,             // Minimum volume level
        maxVolume: 1,             // Maximum volume level
        defaultVolume: 0.8,       // Default volume for new layers
        exponentialRamp: true,    // Use exponential ramp for more natural volume changes
        masterVolumeMultiplier: 1, // Multiplier for all volumes (useful for global adjustments)
        ...config
      };
    }
  
    /**
     * Initialize a layer with a gain node
     * @param {string} layerId - Identifier for the layer
     * @param {number} initialVolume - Initial volume level (0-1)
     * @returns {GainNode} The created gain node
     */
    initializeLayer(layerId, initialVolume = this.config.defaultVolume) {
      // Check for existing layer
      if (this.gainNodes.has(layerId)) {
        return this.gainNodes.get(layerId);
      }
      
      // Ensure audio core is initialized
      if (!this.audioCore || !this.audioCore.isInitialized()) {
        throw new Error('AudioCore not initialized');
      }
      
      try {
        // Create gain node through audio core
        const gainNode = this.audioCore.createGainNode(
          `volume_${layerId}`, 
          this._validateVolume(initialVolume)
        );
        
        // Store gain node
        this.gainNodes.set(layerId, gainNode);
        
        // Store initial volume
        this.currentVolumes.set(layerId, initialVolume);
        
        return gainNode;
      } catch (error) {
        console.error(`Error initializing volume for layer ${layerId}:`, error);
        throw error;
      }
    }
  
    /**
     * Set volume for a layer immediately (no ramping)
     * @param {string} layerId - Identifier for the layer
     * @param {number} volume - Volume level (0-1)
     * @returns {boolean} True if successful
     */
    setVolume(layerId, volume) {
      // Ensure the layer exists
      const gainNode = this._getOrCreateGainNode(layerId);
      
      // Cancel any active transition
      this._cancelTransition(layerId);
      
      // Validate and clamp volume
      const validVolume = this._validateVolume(volume);
      
      try {
        // Apply master volume multiplier
        const actualVolume = validVolume * this.config.masterVolumeMultiplier;
        
        // Set gain value immediately
        gainNode.gain.value = actualVolume;
        
        // Update stored volume (store the pre-multiplied value)
        this.currentVolumes.set(layerId, validVolume);
        
        return true;
      } catch (error) {
        console.error(`Error setting volume for layer ${layerId}:`, error);
        return false;
      }
    }
  
    /**
     * Get the current volume for a layer
     * @param {string} layerId - Identifier for the layer
     * @returns {number} Current volume level (0-1)
     */
    getVolume(layerId) {
      return this.currentVolumes.get(layerId) || 0;
    }
  
    /**
     * Fade volume to a target level over time
     * @param {string} layerId - Identifier for the layer
     * @param {number} targetVolume - Target volume level (0-1)
     * @param {Object} options - Fade options
     * @returns {Promise<boolean>} Promise resolving to true when fade completes
     */
    async fadeVolume(layerId, targetVolume, options = {}) {
      // Extract options with defaults
      const {
        duration = this.config.defaultRampDuration,
        exponential = this.config.exponentialRamp,
        onProgress = null,
        onComplete = null
      } = options;
      
      // Ensure the layer exists
      const gainNode = this._getOrCreateGainNode(layerId);
      
      // Cancel any active transition
      this._cancelTransition(layerId);
      
      // Validate volumes
      const validTarget = this._validateVolume(targetVolume);
      const startVolume = this.currentVolumes.get(layerId) || 0;
      
      // Apply master volume multiplier
      const actualTarget = validTarget * this.config.masterVolumeMultiplier;
      
      // If start and target are virtually the same, set immediately
      if (Math.abs(startVolume - validTarget) < 0.001) {
        this.setVolume(layerId, validTarget);
        if (onComplete) onComplete(validTarget);
        return true;
      }
      
      return new Promise((resolve) => {
        try {
          // Get current audio context time
          const audioContext = this.audioCore.audioContext;
          const startTime = audioContext.currentTime;
          const endTime = startTime + (duration / 1000); // Convert ms to seconds
          
          // Choose ramp type based on options and volume direction
          if (exponential && validTarget > 0.001 && startVolume > 0.001) {
            // Exponential ramp (more natural for volume changes)
            gainNode.gain.exponentialRampToValueAtTime(actualTarget, endTime);
          } else {
            // Linear ramp (works for any values including zero)
            gainNode.gain.linearRampToValueAtTime(actualTarget, endTime);
          }
          
          // Create transition entry
          const transition = {
            layerId,
            startVolume,
            targetVolume: validTarget,
            startTime,
            endTime,
            duration: duration / 1000, // in seconds
            onProgress,
            onComplete,
            intervalId: null
          };
          
          // Set up progress tracking
          const intervalId = setInterval(() => {
            const now = audioContext.currentTime;
            const elapsed = now - startTime;
            const progress = Math.min(1, Math.max(0, elapsed / (duration / 1000)));
            
            // Call progress callback if provided
            if (onProgress) {
              onProgress(progress, startVolume + (validTarget - startVolume) * progress);
            }
            
            // Check if transition is complete
            if (progress >= 1) {
              // Clean up
              clearInterval(intervalId);
              this.activeTransitions.delete(layerId);
              
              // Update stored volume (pre-multiplied value)
              this.currentVolumes.set(layerId, validTarget);
              
              // Call completion callback
              if (onComplete) {
                onComplete(validTarget);
              }
              
              resolve(true);
            }
          }, 50); // Update every 50ms
          
          // Store interval ID for cleanup
          transition.intervalId = intervalId;
          
          // Store transition
          this.activeTransitions.set(layerId, transition);
        } catch (error) {
          console.error(`Error fading volume for layer ${layerId}:`, error);
          
          // Still update stored volume in case of error
          this.currentVolumes.set(layerId, validTarget);
          
          resolve(false);
        }
      });
    }
  
    /**
     * Mute a layer (fade to zero)
     * @param {string} layerId - Identifier for the layer
     * @param {Object} options - Fade options
     * @returns {Promise<boolean>} Promise resolving to true when mute completes
     */
    async muteLayer(layerId, options = {}) {
      // Store original volume if not already muted
      const currentVolume = this.getVolume(layerId);
      if (currentVolume > 0) {
        // Store original volume for later unMute
        this._storeOriginalVolume(layerId, currentVolume);
      }
      
      // Fade to zero
      return this.fadeVolume(layerId, 0, options);
    }
  
    /**
     * Unmute a layer (restore to previous volume)
     * @param {string} layerId - Identifier for the layer
     * @param {Object} options - Fade options
     * @returns {Promise<boolean>} Promise resolving to true when unmute completes
     */
    async unmuteLayer(layerId, options = {}) {
      // Get original volume
      const originalVolume = this._getOriginalVolume(layerId) || this.config.defaultVolume;
      
      // Fade to original volume
      return this.fadeVolume(layerId, originalVolume, options);
    }
  
    /**
     * Set master volume multiplier (affects all layers)
     * @param {number} multiplier - Volume multiplier (typically 0-1)
     */
    setMasterVolumeMultiplier(multiplier) {
      // Validate multiplier
      const validMultiplier = Math.max(0, multiplier);
      this.config.masterVolumeMultiplier = validMultiplier;
      
      // Update all layer volumes
      for (const [layerId, volume] of this.currentVolumes.entries()) {
        try {
          const gainNode = this.gainNodes.get(layerId);
          if (gainNode) {
            // Apply new multiplier
            gainNode.gain.value = volume * validMultiplier;
          }
        } catch (error) {
          console.warn(`Error updating multiplier for layer ${layerId}:`, error);
        }
      }
    }
  
    /**
     * Create a volume envelope with multiple points
     * @param {string} layerId - Identifier for the layer
     * @param {Array<{volume: number, time: number}>} points - Array of volume points
     * @param {Object} options - Envelope options
     * @returns {Promise<boolean>} Promise resolving when envelope completes
     */
    async createVolumeEnvelope(layerId, points, options = {}) {
      if (!Array.isArray(points) || points.length < 2) {
        throw new Error('Envelope must have at least 2 points');
      }
      
      // Extract options
      const {
        startDelay = 0,      // Delay before starting envelope (ms)
        rampType = 'linear',  // 'linear', 'exponential', or 'step'
        loop = false,         // Whether to loop the envelope
        loopCount = 1,        // Number of times to loop (if loop is true)
        onProgress = null,    // Progress callback
        onComplete = null     // Completion callback
      } = options;
      
      // Sort points by time
      const sortedPoints = [...points].sort((a, b) => a.time - b.time);
      
      // Ensure layer exists
      const gainNode = this._getOrCreateGainNode(layerId);
      
      // Cancel any active transition
      this._cancelTransition(layerId);
      
      try {
        const audioContext = this.audioCore.audioContext;
        const startTime = audioContext.currentTime + (startDelay / 1000);
        
        // Setup initial envelope
        for (let i = 0; i < sortedPoints.length; i++) {
          const point = sortedPoints[i];
          const volume = this._validateVolume(point.volume) * this.config.masterVolumeMultiplier;
          const pointTime = startTime + (point.time / 1000);
          
          // Set initial value for first point
          if (i === 0) {
            gainNode.gain.setValueAtTime(volume, pointTime);
          } else {
            // Apply ramp to next point
            const prevPoint = sortedPoints[i - 1];
            const prevVolume = this._validateVolume(prevPoint.volume) * this.config.masterVolumeMultiplier;
            
            switch (rampType) {
              case 'exponential':
                // Cannot do exponential ramp to/from zero
                if (volume > 0.001 && prevVolume > 0.001) {
                  gainNode.gain.exponentialRampToValueAtTime(volume, pointTime);
                } else {
                  gainNode.gain.linearRampToValueAtTime(volume, pointTime);
                }
                break;
                
              case 'step':
                gainNode.gain.setValueAtTime(volume, pointTime);
                break;
                
              case 'linear':
              default:
                gainNode.gain.linearRampToValueAtTime(volume, pointTime);
                break;
            }
          }
        }
        
        // Calculate total envelope duration
        const duration = sortedPoints[sortedPoints.length - 1].time;
        
        // Handle looping
        if (loop && loopCount > 1) {
          let currentLoop = 1;
          
          const loopEnvelope = () => {
            // Only schedule another loop if we haven't reached the count
            if (currentLoop < loopCount) {
              currentLoop++;
              
              // Calculate new start time
              const loopStartTime = startTime + (currentLoop * duration / 1000);
              
              // Schedule next loop
              for (let i = 0; i < sortedPoints.length; i++) {
                const point = sortedPoints[i];
                const volume = this._validateVolume(point.volume) * this.config.masterVolumeMultiplier;
                const pointTime = loopStartTime + (point.time / 1000);
                
                // Apply appropriate ramp
                if (i === 0) {
                  gainNode.gain.setValueAtTime(volume, pointTime);
                } else {
                  switch (rampType) {
                    case 'exponential':
                      // Cannot do exponential ramp to/from zero
                      if (volume > 0.001) {
                        gainNode.gain.exponentialRampToValueAtTime(volume, pointTime);
                      } else {
                        gainNode.gain.linearRampToValueAtTime(volume, pointTime);
                      }
                      break;
                      
                    case 'step':
                      gainNode.gain.setValueAtTime(volume, pointTime);
                      break;
                      
                    case 'linear':
                    default:
                      gainNode.gain.linearRampToValueAtTime(volume, pointTime);
                      break;
                  }
                }
              }
              
              // Schedule next loop
              setTimeout(loopEnvelope, duration);
            }
          };
          
          // Schedule first loop
          setTimeout(loopEnvelope, duration);
        }
        
        // Setup progress tracking
        const totalDuration = duration * (loop ? loopCount : 1);
        const startTimestamp = Date.now() + startDelay;
        
        const intervalId = setInterval(() => {
          const elapsed = Date.now() - startTimestamp;
          const progress = Math.min(1, Math.max(0, elapsed / totalDuration));
          
          // Call progress callback
          if (onProgress) {
            onProgress(progress);
          }
          
          // Check if complete
          if (progress >= 1) {
            clearInterval(intervalId);
            
            // Update stored volume to final value
            const finalVolume = this._validateVolume(sortedPoints[sortedPoints.length - 1].volume);
            this.currentVolumes.set(layerId, finalVolume);
            
            // Call completion callback
            if (onComplete) {
              onComplete();
            }
          }
        }, 50);
        
        // Return promise that resolves when envelope completes
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(true);
          }, totalDuration + startDelay);
        });
      } catch (error) {
        console.error(`Error creating volume envelope for layer ${layerId}:`, error);
        return false;
      }
    }
  
    /**
     * Group multiple layers for synchronized volume control
     * @param {string} groupId - Identifier for the group
     * @param {Array<string>} layerIds - Array of layer identifiers
     * @returns {Object} Group controller object
     */
    createVolumeGroup(groupId, layerIds) {
      if (!Array.isArray(layerIds) || layerIds.length === 0) {
        throw new Error('Layer IDs must be a non-empty array');
      }
      
      // Ensure all layers exist
      for (const layerId of layerIds) {
        this._getOrCreateGainNode(layerId);
      }
      
      // Create group controller
      const controller = {
        groupId,
        layerIds: [...layerIds],
        
        // Set volume for all layers in group
        setVolume: (volume) => {
          const promises = layerIds.map(layerId => {
            return this.setVolume(layerId, volume);
          });
          return Promise.all(promises).then(results => {
            return results.every(result => result === true);
          });
        },
        
        // Fade volume for all layers in group
        fadeVolume: (targetVolume, options = {}) => {
          const promises = layerIds.map(layerId => {
            return this.fadeVolume(layerId, targetVolume, options);
          });
          return Promise.all(promises).then(results => {
            return results.every(result => result === true);
          });
        },
        
        // Mute all layers in group
        mute: (options = {}) => {
          const promises = layerIds.map(layerId => {
            return this.muteLayer(layerId, options);
          });
          return Promise.all(promises).then(results => {
            return results.every(result => result === true);
          });
        },
        
        // Unmute all layers in group
        unmute: (options = {}) => {
          const promises = layerIds.map(layerId => {
            return this.unmuteLayer(layerId, options);
          });
          return Promise.all(promises).then(results => {
            return results.every(result => result === true);
          });
        },
        
        // Add layer to group
        addLayer: (layerId) => {
          if (!layerIds.includes(layerId)) {
            layerIds.push(layerId);
            this._getOrCreateGainNode(layerId);
          }
        },
        
        // Remove layer from group
        removeLayer: (layerId) => {
          const index = layerIds.indexOf(layerId);
          if (index !== -1) {
            layerIds.splice(index, 1);
            return true;
          }
          return false;
        },
        
        // Get average volume of group
        getAverageVolume: () => {
          const volumes = layerIds.map(layerId => this.getVolume(layerId));
          const sum = volumes.reduce((acc, vol) => acc + vol, 0);
          return sum / volumes.length;
        }
      };
      
      return controller;
    }
  
    /**
     * Validate and clamp volume to valid range
     * @param {number} volume - Volume level to validate
     * @returns {number} Clamped volume level
     * @private
     */
    _validateVolume(volume) {
      if (typeof volume !== 'number' || isNaN(volume)) {
        return this.config.defaultVolume;
      }
      
      return Math.min(this.config.maxVolume, Math.max(this.config.minVolume, volume));
    }
  
    /**
     * Get or create gain node for a layer
     * @param {string} layerId - Identifier for the layer
     * @returns {GainNode} The gain node
     * @private
     */
    _getOrCreateGainNode(layerId) {
      if (!this.gainNodes.has(layerId)) {
        return this.initializeLayer(layerId);
      }
      
      return this.gainNodes.get(layerId);
    }
  
    /**
     * Cancel an active volume transition
     * @param {string} layerId - Identifier for the layer
     * @private
     */
    _cancelTransition(layerId) {
      if (this.activeTransitions.has(layerId)) {
        const transition = this.activeTransitions.get(layerId);
        
        if (transition.intervalId) {
          clearInterval(transition.intervalId);
        }
        
        this.activeTransitions.delete(layerId);
      }
    }
  
    /**
     * Store original volume for a layer (for mute/unmute)
     * @param {string} layerId - Identifier for the layer
     * @param {number} volume - Volume to store
     * @private
     */
    _storeOriginalVolume(layerId, volume) {
      this._originalVolumes = this._originalVolumes || new Map();
      this._originalVolumes.set(layerId, volume);
    }
  
    /**
     * Get original volume for a layer (for unmute)
     * @param {string} layerId - Identifier for the layer
     * @returns {number|null} Original volume or null if not stored
     * @private
     */
    _getOriginalVolume(layerId) {
      this._originalVolumes = this._originalVolumes || new Map();
      return this._originalVolumes.get(layerId) || null;
    }
  }
  
  export default VolumeController;