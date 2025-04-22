/**
 * CrossfadeService.js
 * 
 * Service for managing smooth audio crossfades between tracks
 * Handles creation and coordination of gain nodes for seamless transitions
 * Tracks transition progress and provides status updates
 */

class CrossfadeService {
  /**
   * Create a new CrossfadeService instance
   * @param {Object} options - Configuration options
   * @param {AudioContext} options.audioContext - Web Audio API context
   * @param {Object} options.volumeController - VolumeService instance
   * @param {AudioNode} [options.destination] - Destination node for audio output
   * @param {Function} [options.onProgress] - Callback for progress updates: (layer, progress) => void
   * @param {boolean} [options.enableLogging=false] - Enable detailed console logging
   * @param {number} [options.defaultFadeDuration=2000] - Default crossfade duration in milliseconds
   * @param {number} [options.minFadeDuration=50] - Minimum fade duration in milliseconds
   * @param {number} [options.maxFadeDuration=30000] - Maximum fade duration in milliseconds
   */
  constructor(options = {}) {
    if (!options.audioContext) {
      throw new Error('CrossfadeService requires an AudioContext instance');
    }

    // Set destination from options or volume controller
    const destination = options.destination ||
      (options.volumeController ? options.volumeController.getMasterGain() : null);

    if (!destination) {
      throw new Error('CrossfadeService requires a destination AudioNode or volumeController');
    }

    // Dependencies
    this.audioContext = options.audioContext;
    this.destination = destination;
    this.volumeController = options.volumeController || null;

    // Configuration
    this.config = {
      enableLogging: options.enableLogging || false,
      defaultFadeDuration: options.defaultFadeDuration || 2000, // 2 seconds default
      minFadeDuration: options.minFadeDuration || 50, // Minimum fade duration (ms)
      maxFadeDuration: options.maxFadeDuration || 30000, // Maximum fade duration (ms)
      onProgress: options.onProgress || null
    };

    // State tracking
    this.activeCrossfades = new Map(); // Maps layer name to active crossfade info
    this.crossfadeProgress = new Map(); // Maps layer name to progress (0-1)
    this.crossfadeTimers = new Map(); // Maps layer name to interval timer ID

    this.log('CrossfadeService initialized');
  }

  /**
   * Performs a crossfade transition between two audio sources
   * 
   * @param {Object} options - Crossfade options
   * @param {string} options.layer - Layer identifier (e.g., 'Layer 1', 'Layer 2')
   * @param {AudioNode} options.sourceNode - Current audio source node
   * @param {HTMLAudioElement} options.sourceElement - Current audio element (if available)
   * @param {AudioNode} options.targetNode - Target audio source node
   * @param {HTMLAudioElement} options.targetElement - Target audio element (if available)
   * @param {number} options.currentVolume - Current volume level (0-1)
   * @param {number} [options.duration] - Crossfade duration in ms (default: 2000ms)
   * @param {boolean} [options.syncPosition=false] - Try to sync playback position
   * @param {Object} [options.metadata] - Optional metadata about the crossfade
   * @returns {Promise<boolean>} - Resolves to true if crossfade completed successfully
   */
  async crossfade(options) {
    const {
      layer,
      sourceNode,
      sourceElement,
      targetNode,
      targetElement,
      currentVolume,
      duration = this.config.defaultFadeDuration,
      syncPosition = false,
      metadata = {}
    } = options;

    if (!layer || !sourceNode || !targetNode) {
      this.log(`Invalid crossfade parameters for layer ${layer}`, 'error');
      return false;
    }

    this.log(`Starting crossfade for ${layer}, duration: ${duration}ms`);

    // Cancel any existing crossfade for this layer
    this.cancelCrossfade(layer);

    try {
      // Create gain nodes for the crossfade
      const fadeOutGain = this.audioContext.createGain();
      const fadeInGain = this.audioContext.createGain();

      // Set initial gain values
      fadeOutGain.gain.value = currentVolume;
      fadeInGain.gain.value = 0.001; // Start nearly silent but not zero (prevents pop)

      // Connect gain nodes to destination
      fadeOutGain.connect(this.destination);
      fadeInGain.connect(this.destination);

      // Disconnect source nodes from their current destinations
      // and connect to their respective fade gain nodes
      try {
        sourceNode.disconnect();
        sourceNode.connect(fadeOutGain);

        targetNode.disconnect();
        targetNode.connect(fadeInGain);
      } catch (error) {
        this.log(`Error connecting audio graph: ${error.message}`, 'error');

        // Recovery - attempt to restore connections
        try {
          sourceNode.connect(this.destination);
          targetNode.connect(this.destination);
        } catch (e) {
          this.log(`Recovery failed: ${e.message}`, 'error');
        }

        return false;
      }

      // If we have audio elements and need to sync position
      if (syncPosition && sourceElement && targetElement) {
        try {
          const currentPosition = sourceElement.currentTime || 0;
          const currentDuration = sourceElement.duration || 300;
          const targetDuration = targetElement.duration || 300;

          // Calculate relative position
          const relativePosition = currentPosition / currentDuration;

          // Set target element's time position
          targetElement.currentTime = relativePosition * targetDuration;
          this.log(`Synced playback position at ${Math.round(relativePosition * 100)}%`);
        } catch (error) {
          this.log(`Error syncing playback position: ${error.message}`, 'warn');
          // Continue with crossfade anyway
        }
      }

      // Start playback of target element if provided
      if (targetElement && targetElement.paused) {
        try {
          await targetElement.play()
            .catch(e => this.log(`Error playing target: ${e.message}`, 'error'));
        } catch (error) {
          this.log(`Error starting playback: ${error.message}`, 'error');
          // Continue with crossfade despite error
        }
      }

      // Set up audio parameter curves for smooth crossfade
      const now = this.audioContext.currentTime;
      const fadeDurationSec = Math.max(
        this.config.minFadeDuration / 1000,
        Math.min(duration / 1000, this.config.maxFadeDuration / 1000)
      );
      const endTime = now + fadeDurationSec;

      try {
        // Schedule fade out
        fadeOutGain.gain.setValueAtTime(currentVolume, now);
        fadeOutGain.gain.linearRampToValueAtTime(0.001, endTime);

        // Schedule fade in
        fadeInGain.gain.setValueAtTime(0.001, now);
        fadeInGain.gain.linearRampToValueAtTime(currentVolume, endTime);
      } catch (error) {
        this.log(`Error scheduling gain ramps: ${error.message}`, 'error');

        // Recovery - immediately set final values
        fadeOutGain.gain.value = 0;
        fadeInGain.gain.value = currentVolume;
      }

      // Create a crossfade object to track this transition
      const crossfadeInfo = {
        layer,
        startTime: now,
        endTime,
        fadeOutGain,
        fadeInGain,
        sourceNode,
        targetNode,
        sourceElement,
        targetElement,
        currentVolume,
        metadata: {
          ...metadata,
          VolumeService: this.volumeController // Store for later when reconnecting
        }
      };

      // Store the crossfade information
      this.activeCrossfades.set(layer, crossfadeInfo);
      this.crossfadeProgress.set(layer, 0);

      // Create a Promise that will resolve when the crossfade is complete
      const crossfadePromise = new Promise((resolve) => {
        // Set up progress tracking timer
        const updateInterval = 50; // 50ms updates (20 updates per second)
        const totalUpdates = fadeDurationSec * 1000 / updateInterval;
        let updateCount = 0;

        const timerId = setInterval(() => {
          updateCount++;

          // Calculate progress (0-1)
          const progress = Math.min(updateCount / totalUpdates, 1);

          // Update progress tracking
          this.crossfadeProgress.set(layer, progress);

          // Call progress callback if provided
          if (this.config.onProgress) {
            this.config.onProgress(layer, progress);
          }

          // When complete, clean up and resolve
          if (updateCount >= totalUpdates) {
            // Clear the timer
            clearInterval(timerId);
            this.crossfadeTimers.delete(layer);

            // Complete the crossfade
            this._completeCrossfade(layer, crossfadeInfo);

            // Resolve the promise
            resolve(true);
          }
        }, updateInterval);

        // Store timer ID for potential cancellation
        this.crossfadeTimers.set(layer, timerId);
      });

      return crossfadePromise;

    } catch (error) {
      this.log(`Crossfade error: ${error.message}`, 'error');

      // Clean up any partial crossfade state
      this.cancelCrossfade(layer);

      return false;
    }
  }

  /**
   * Cancel an active crossfade
   * 
   * @param {string} layer - Layer identifier
   * @param {Object} [options] - Cancellation options
   * @param {boolean} [options.reconnectSource=true] - Reconnect source node to destination
   * @param {boolean} [options.reconnectTarget=true] - Reconnect target node to destination
   * @returns {boolean} - True if a crossfade was cancelled
   */
  cancelCrossfade(layer, options = {}) {
    const {
      reconnectSource = true,
      reconnectTarget = true
    } = options;

    // Check if we have an active crossfade for this layer
    if (!this.activeCrossfades.has(layer)) {
      return false;
    }

    this.log(`Cancelling crossfade for ${layer}`);

    // Get the crossfade info
    const crossfade = this.activeCrossfades.get(layer);

    // Clear the progress timer
    if (this.crossfadeTimers.has(layer)) {
      clearInterval(this.crossfadeTimers.get(layer));
      this.crossfadeTimers.delete(layer);
    }

    try {
      // Disconnect and clean up gain nodes
      if (crossfade.fadeOutGain) {
        crossfade.fadeOutGain.disconnect();
      }

      if (crossfade.fadeInGain) {
        crossfade.fadeInGain.disconnect();
      }

      // Reconnect nodes directly to destination if requested
      if (reconnectSource && crossfade.sourceNode) {
        try {
          crossfade.sourceNode.disconnect();

          // Use VolumeService if available
          if (this.volumeController && crossfade.metadata.VolumeService) {
            this.volumeController.connectToLayer(layer, crossfade.sourceNode, this.destination);
          } else {
            crossfade.sourceNode.connect(this.destination);
          }
        } catch (e) {
          this.log(`Error reconnecting source: ${e.message}`, 'warn');
        }
      }

      if (reconnectTarget && crossfade.targetNode) {
        try {
          crossfade.targetNode.disconnect();

          // Use VolumeService if available
          if (this.volumeController && crossfade.metadata.VolumeService) {
            this.volumeController.connectToLayer(layer, crossfade.targetNode, this.destination);
          } else {
            crossfade.targetNode.connect(this.destination);
          }
        } catch (e) {
          this.log(`Error reconnecting target: ${e.message}`, 'warn');
        }
      }
    } catch (error) {
      this.log(`Error during crossfade cancellation: ${error.message}`, 'error');
    }

    // Clean up state
    this.activeCrossfades.delete(layer);
    this.crossfadeProgress.set(layer, 0);

    return true;
  }

  /**
   * Complete a crossfade (internal method)
   * 
   * @private
   * @param {string} layer - Layer identifier
   * @param {Object} crossfade - Crossfade information
   */
  _completeCrossfade(layer, crossfade) {
    this.log(`Completing crossfade for ${layer}`);

    try {
      // Stop source element if provided
      if (crossfade.sourceElement && !crossfade.sourceElement.paused) {
        try {
          crossfade.sourceElement.pause();
        } catch (e) {
          this.log(`Error pausing source: ${e.message}`, 'warn');
        }
      }

      // Disconnect fade nodes
      if (crossfade.fadeOutGain) {
        crossfade.fadeOutGain.disconnect();
      }

      if (crossfade.fadeInGain) {
        crossfade.fadeInGain.disconnect();
      }

      // Reconnect target node directly to destination
      if (crossfade.targetNode) {
        try {
          crossfade.targetNode.disconnect();

          // If we have a volume controller reference, use it
          if (crossfade.metadata && crossfade.metadata.VolumeService) {
            crossfade.metadata
            this.volumeController.connectToLayer(layer, crossfade.targetNode, this.destination);
          } else {
            crossfade.targetNode.connect(this.destination);
          }
        } catch (e) {
          this.log(`Error reconnecting target after crossfade: ${e.message}`, 'error');
        }
      }

      // Clean up state
      this.activeCrossfades.delete(layer);

      // Set final progress
      this.crossfadeProgress.set(layer, 1);

      // Final progress callback
      if (this.config.onProgress) {
        this.config.onProgress(layer, 1);
      }

    } catch (error) {
      this.log(`Error completing crossfade: ${error.message}`, 'error');
    }
  }

  /**
   * Cancel all active crossfades
   * 
   * @param {Object} [options] - Cancellation options
   * @param {boolean} [options.reconnectSource=true] - Reconnect source nodes
   * @param {boolean} [options.reconnectTarget=true] - Reconnect target nodes
   * @returns {number} - Number of crossfades cancelled
   */
  cancelAllCrossfades(options = {}) {
    const layers = [...this.activeCrossfades.keys()];
    let cancelCount = 0;

    layers.forEach(layer => {
      const cancelled = this.cancelCrossfade(layer, options);
      if (cancelled) cancelCount++;
    });

    return cancelCount;
  }

  /**
   * Check if a layer has an active crossfade
   * 
   * @param {string} layer - Layer identifier
   * @returns {boolean} - True if the layer has an active crossfade
   */
  isActive(layer) {
    return this.activeCrossfades.has(layer);
  }

  /**
   * Get the current progress of a crossfade
   * 
   * @param {string} layer - Layer identifier
   * @returns {number} - Progress value between 0-1, or -1 if no active crossfade
   */
  getProgress(layer) {
    if (!this.crossfadeProgress.has(layer)) {
      return -1;
    }
    return this.crossfadeProgress.get(layer);
  }

  /**
   * Adjust volume of an active crossfade
   * 
   * @param {string} layer - Layer identifier
   * @param {number} volume - New volume level (0-1)
   * @returns {boolean} - True if volume was adjusted
   */
  adjustCrossfadeVolume(layer, volume) {
    if (!this.isActive(layer)) {
      return false;
    }

    const crossfade = this.activeCrossfades.get(layer);
    const progress = this.getProgress(layer);

    if (progress < 0) {
      return false;
    }

    try {
      const fadeOutVolume = volume * (1 - progress);
      const fadeInVolume = volume * progress;

      // Only set if the gain nodes still exist
      if (crossfade.fadeOutGain) {
        crossfade.fadeOutGain.gain.value = Math.max(0.001, fadeOutVolume);
      }

      if (crossfade.fadeInGain) {
        crossfade.fadeInGain.gain.value = Math.max(0.001, fadeInVolume);
      }

      // Update stored current volume
      crossfade.currentVolume = volume;

      return true;
    } catch (error) {
      this.log(`Error adjusting crossfade volume: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Get a list of all layers with active crossfades
   * 
   * @returns {string[]} - Array of layer identifiers
   */
  getActiveLayers() {
    return [...this.activeCrossfades.keys()];
  }

  /**
   * Set a new progress callback function
   * 
   * @param {Function} callback - Callback function: (layer, progress) => void
   */
  setProgressCallback(callback) {
    if (typeof callback === 'function') {
      this.config.onProgress = callback;
    } else {
      this.config.onProgress = null;
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

    const prefix = '[CrossfadeService]';

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
   * Clean up resources used by CrossfadeService
   * This should be called when the service is no longer needed
   */
  dispose() {
    // Cancel all active crossfades
    this.cancelAllCrossfades();

    // Clear all timers
    this.crossfadeTimers.forEach(timerId => {
      clearInterval(timerId);
    });

    // Reset internal state
    this.activeCrossfades.clear();
    this.crossfadeProgress.clear();
    this.crossfadeTimers.clear();

    this.log('CrossfadeService disposed');
  }

  /**
   * Alias for dispose to maintain API compatibility with other services
   */
  cleanup() {
    this.dispose();
  }
}

export default CrossfadeService;
