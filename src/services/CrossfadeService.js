/**
 * CrossfadeService.js
 * 
 * Service for managing smooth audio crossfades between tracks
 * Handles creation and coordination of gain nodes for seamless transitions
 * Enhanced with explicit state management and EventBus integration
 */

import eventBus, { EVENTS } from './EventBus';

// Event constants specific to crossfades
export const CROSSFADE_EVENTS = {
  STARTED: 'crossfade:started',
  PROGRESS: 'crossfade:progress',
  COMPLETED: 'crossfade:completed',
  CANCELLED: 'crossfade:cancelled',
  ERROR: 'crossfade:error',
  VOLUME_ADJUSTED: 'crossfade:volumeAdjusted',
  ALL_CANCELLED: 'crossfade:allCancelled'
};

class CrossfadeService {
  /**
   * Create a new CrossfadeService instance
   * @param {Object} options - Configuration options
   * @param {AudioContext} options.audioContext - Web Audio API context
   * @param {Object} options.volumeController - VolumeService instance
   * @param {AudioNode} [options.destination] - Destination node for audio output
   * @param {Function} [options.onProgress] - Callback for progress updates: (layer, progress) => void
   * @param {boolean} [options.enableLogging=false] - Enable detailed console logging
   * @param {boolean} [options.enableEventBus=true] - Enable EventBus communication
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

    // Dependencies - explicitly public
    this.audioContext = options.audioContext;
    this.destination = destination;
    this.volumeController = options.volumeController || null;

    // Configuration - explicitly public
    this.config = {
      enableLogging: options.enableLogging || false,
      enableEventBus: options.enableEventBus !== false, // Enabled by default
      defaultFadeDuration: options.defaultFadeDuration || 2000, // 2 seconds default
      minFadeDuration: options.minFadeDuration || 50, // Minimum fade duration (ms)
      maxFadeDuration: options.maxFadeDuration || 30000, // Maximum fade duration (ms)
      onProgress: options.onProgress || null
    };

    // Private state with _ prefix - internal state tracking
    this._activeCrossfades = new Map(); // Maps layer name to active crossfade info
    this._crossfadeProgress = new Map(); // Maps layer name to progress (0-1)
    this._crossfadeTimers = new Map(); // Maps layer name to interval timer ID
    
    // Statistics tracking
    this._stats = {
      totalCrossfades: 0,
      completedCrossfades: 0,
      cancelledCrossfades: 0,
      errorCount: 0,
      lastOperation: {
        type: null,
        layer: null,
        timestamp: null
      }
    };

    this.log('CrossfadeService initialized');
    
    // Emit initialization event
    if (this.config.enableEventBus) {
      eventBus.emit(EVENTS.CROSSFADE_INITIALIZED || 'crossfade:initialized', {
        timestamp: Date.now(),
        config: { ...this.config, onProgress: this.config.onProgress ? 'function' : null }
      });
    }
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
      this._updateStats({ 
        errorCount: this._stats.errorCount + 1,
        lastOperation: {
          type: 'error',
          layer,
          timestamp: Date.now()
        }
      });
      
      const error = new Error(`Invalid crossfade parameters for layer ${layer}`);
      
      // Emit error event
      if (this.config.enableEventBus) {
        eventBus.emit(EVENTS.CROSSFADE_ERROR || 'crossfade:error', {
          layer,
          message: error.message,
          error,
          parameters: { layer, hasSourceNode: !!sourceNode, hasTargetNode: !!targetNode },
          timestamp: Date.now()
        });
      }
      
      this.log(`Invalid crossfade parameters for layer ${layer}`, 'error');
      return false;
    }

    this.log(`Starting crossfade for ${layer}, duration: ${duration}ms`);
    
    // Update stats
    this._updateStats({
      totalCrossfades: this._stats.totalCrossfades + 1,
      lastOperation: {
        type: 'start',
        layer,
        timestamp: Date.now()
      }
    });

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
        
        // Emit error event
        if (this.config.enableEventBus) {
          eventBus.emit(EVENTS.CROSSFADE_ERROR || 'crossfade:error', {
            layer,
            operation: 'connectNodes',
            message: error.message,
            error,
            timestamp: Date.now()
          });
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
        
        // Emit error event
        if (this.config.enableEventBus) {
          eventBus.emit(EVENTS.CROSSFADE_ERROR || 'crossfade:error', {
            layer,
            operation: 'scheduleGainRamps',
            message: error.message,
            error,
            timestamp: Date.now()
          });
        }
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

      // Store the crossfade information in private state
      this._activeCrossfades.set(layer, crossfadeInfo);
      this._crossfadeProgress.set(layer, 0);
      
      // Emit started event
      if (this.config.enableEventBus) {
        eventBus.emit(EVENTS.CROSSFADE_STARTED || 'crossfade:started', {
          layer,
          from: metadata.fromTrackId || 'unknown',
          to: metadata.toTrackId || 'unknown',
          duration: fadeDurationSec * 1000,
          timestamp: Date.now()
        });
      }

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

          // Update progress tracking in private state
          this._crossfadeProgress.set(layer, progress);

          // Call progress callback if provided
          if (this.config.onProgress) {
            this.config.onProgress(layer, progress);
          }
          
          // Emit progress event
          if (this.config.enableEventBus) {
            eventBus.emit(EVENTS.CROSSFADE_PROGRESS || 'crossfade:progress', {
              layer,
              progress,
              from: metadata.fromTrackId || 'unknown',
              to: metadata.toTrackId || 'unknown',
              updateCount,
              totalUpdates,
              timestamp: Date.now()
            });
          }

          // When complete, clean up and resolve
          if (updateCount >= totalUpdates) {
            // Clear the timer
            clearInterval(timerId);
            this._crossfadeTimers.delete(layer);

            // Complete the crossfade
            this._completeCrossfade(layer, crossfadeInfo);

            // Resolve the promise
            resolve(true);
          }
        }, updateInterval);

        // Store timer ID for potential cancellation in private state
        this._crossfadeTimers.set(layer, timerId);
      });

      return crossfadePromise;

    } catch (error) {
      this.log(`Crossfade error: ${error.message}`, 'error');
      
      // Update stats
      this._updateStats({
        errorCount: this._stats.errorCount + 1,
        lastOperation: {
          type: 'error',
          layer,
          timestamp: Date.now()
        }
      });
      
      // Emit error event
      if (this.config.enableEventBus) {
        eventBus.emit(EVENTS.CROSSFADE_ERROR || 'crossfade:error', {
          layer,
          operation: 'crossfade',
          message: error.message,
          error,
          timestamp: Date.now()
        });
      }

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
      if (!this._activeCrossfades.has(layer)) {
        return false;
      }
  
      this.log(`Cancelling crossfade for ${layer}`);
  
      // Get the crossfade info from private state
      const crossfade = this._activeCrossfades.get(layer);
      
      // Store metadata before removing it for event emission
      const metadata = crossfade.metadata || {};
  
      // Clear the progress timer
      if (this._crossfadeTimers.has(layer)) {
        clearInterval(this._crossfadeTimers.get(layer));
        this._crossfadeTimers.delete(layer);
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
        
        // Emit error event
        if (this.config.enableEventBus) {
          eventBus.emit(EVENTS.CROSSFADE_CANCELLED || 'crossfade:cancelled', {
            layer,
            operation: 'cancelCrossfade',
            message: error.message,
            error,
            timestamp: Date.now()
          });
        }
      }
  
      // Update stats
      this._updateStats({
        cancelledCrossfades: this._stats.cancelledCrossfades + 1,
        lastOperation: {
          type: 'cancel',
          layer,
          timestamp: Date.now()
        }
      });
      
      // Clean up state from private maps
      this._activeCrossfades.delete(layer);
      this._crossfadeProgress.set(layer, 0);
      
      // Emit cancelled event
      if (this.config.enableEventBus) {
        eventBus.emit(EVENTS.CROSSFADE_CANCELLED || 'crossfade:cancelled', {
          layer,
          from: metadata.fromTrackId || 'unknown',
          to: metadata.toTrackId || 'unknown',
          reconnectOptions: { reconnectSource, reconnectTarget },
          timestamp: Date.now()
        });
      }
  
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
      
      // Store metadata for event
      const metadata = crossfade.metadata || {};
  
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
              this.volumeController.connectToLayer(layer, crossfade.targetNode, this.destination);
            } else {
              crossfade.targetNode.connect(this.destination);
            }
          } catch (e) {
            this.log(`Error reconnecting target after crossfade: ${e.message}`, 'error');
          }
        }
  
        // Update stats
        this._updateStats({
          completedCrossfades: this._stats.completedCrossfades + 1,
          lastOperation: {
            type: 'complete',
            layer,
            timestamp: Date.now()
          }
        });
        
        // Clean up state from private maps
        this._activeCrossfades.delete(layer);
  
        // Set final progress
        this._crossfadeProgress.set(layer, 1);
  
        // Final progress callback
        if (this.config.onProgress) {
          this.config.onProgress(layer, 1);
        }
        
        // Emit completed event
        if (this.config.enableEventBus) {
          eventBus.emit(CROSSFADE_EVENTS.COMPLETED || 'crossfade:completed', {
            layer,
            from: metadata.fromTrackId || 'unknown',
            to: metadata.toTrackId || 'unknown',
            timestamp: Date.now()
          });
        }
  
      } catch (error) {
        this.log(`Error completing crossfade: ${error.message}`, 'error');
        
        // Emit error event
        if (this.config.enableEventBus) {
          eventBus.emit(CROSSFADE_EVENTS.ERROR || 'crossfade:error', {
            layer,
            operation: 'completeCrossfade',
            message: error.message,
            error,
            timestamp: Date.now()
          });
        }
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
      const layers = [...this._activeCrossfades.keys()];
      let cancelCount = 0;
      
      // Store canceled layers for event
      const canceledLayers = [];
  
      layers.forEach(layer => {
        const cancelled = this.cancelCrossfade(layer, options);
        if (cancelled) {
          cancelCount++;
          canceledLayers.push(layer);
        }
      });
      
      // Emit all-cancelled event
      if (cancelCount > 0 && this.config.enableEventBus) {
        eventBus.emit(CROSSFADE_EVENTS.ALL_CANCELLED || 'crossfade:allCancelled', {
          count: cancelCount,
          layers: canceledLayers,
          reconnectOptions: { 
            reconnectSource: options.reconnectSource !== false, 
            reconnectTarget: options.reconnectTarget !== false 
          },
          timestamp: Date.now()
        });
      }
  
      return cancelCount;
    }
  
    /**
     * Check if a layer has an active crossfade
     * 
     * @param {string} layer - Layer identifier
     * @returns {boolean} - True if the layer has an active crossfade
     */
    isActive(layer) {
      return this._activeCrossfades.has(layer);
    }
  
    /**
     * Get the current progress of a crossfade
     * 
     * @param {string} layer - Layer identifier
     * @returns {number} - Progress value between 0-1, or -1 if no active crossfade
     */
    getProgress(layer) {
      if (!this._crossfadeProgress.has(layer)) {
        return -1;
      }
      return this._crossfadeProgress.get(layer);
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
  
      const crossfade = this._activeCrossfades.get(layer);
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
        
        // Emit volume adjusted event
        if (this.config.enableEventBus) {
          eventBus.emit(CROSSFADE_EVENTS.VOLUME_ADJUSTED || 'crossfade:volumeAdjusted', {
            layer,
            volume,
            progress,
            fadeOutVolume,
            fadeInVolume,
            timestamp: Date.now()
          });
        }
  
        return true;
      } catch (error) {
        this.log(`Error adjusting crossfade volume: ${error.message}`, 'error');
        
        // Emit error event
        if (this.config.enableEventBus) {
          eventBus.emit(CROSSFADE_EVENTS.VOLUME_ADJUSTED || 'crossfade:volumeAdjusted', {
            layer,
            operation: 'adjustCrossfadeVolume',
            volume,
            message: error.message,
            error,
            timestamp: Date.now()
          });
        }
        
        return false;
      }
    }
  
    /**
     * Get a list of all layers with active crossfades
     * 
     * @returns {string[]} - Array of layer identifiers
     */
    getActiveLayers() {
      return [...this._activeCrossfades.keys()];
    }
    
    /**
     * Get information about all active crossfades
     * 
     * @returns {Object} - Object with layer keys and crossfade info
     */
    getActiveCrossfadesInfo() {
      const info = {};
      
      this._activeCrossfades.forEach((crossfade, layer) => {
        info[layer] = {
          from: crossfade.metadata?.fromTrackId || 'unknown',
          to: crossfade.metadata?.toTrackId || 'unknown',
          progress: this.getProgress(layer),
          startTime: crossfade.startTime,
          endTime: crossfade.endTime,
          currentVolume: crossfade.currentVolume
        };
      });
      
      return info;
    }
  
    /**
     * Get service statistics
     * 
     * @returns {Object} - Service statistics
     */
    getStats() {
      return { ...this._stats };
    }
    
    /**
     * Update service statistics in a controlled manner
     * 
     * @private
     * @param {Object} updates - The stat updates to apply
     */
    _updateStats(updates) {
      this._stats = {
        ...this._stats,
        ...updates
      };
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
     * Preload audio for later crossfades
     * 
     * @param {string} audioUrl - URL of audio to preload
     * @returns {Promise<boolean>} - Resolves to true if preloading succeeded
     */
    async preloadAudio(audioUrl) {
      if (!audioUrl) {
        this.log('No audio URL provided for preloading', 'error');
        return false;
      }
      
      try {
        this.log(`Preloading audio: ${audioUrl}`);
        
        // Create audio element for preloading
        const audio = new Audio();
        audio.preload = "auto";
        
        // Return a promise that resolves when the audio is loaded
        return new Promise((resolve) => {
          // Track success
          audio.addEventListener('canplaythrough', () => {
            this.log(`Successfully preloaded: ${audioUrl}`);
            resolve(true);
          }, { once: true });
          
          // Track failure
          audio.addEventListener('error', (e) => {
            this.log(`Error preloading audio ${audioUrl}: ${audio.error?.message || 'Unknown error'}`, 'error');
            resolve(false);
          }, { once: true });
          
          // Set timeout in case loading stalls
          const timeout = setTimeout(() => {
            this.log(`Preloading timed out for: ${audioUrl}`, 'warn');
            resolve(false);
          }, 30000); // 30 second timeout
          
          // Start loading
          audio.src = audioUrl;
          
          // Clean up timeout if audio loads or errors
          audio.addEventListener('canplaythrough', () => clearTimeout(timeout), { once: true });
          audio.addEventListener('error', () => clearTimeout(timeout), { once: true });
        });
      } catch (error) {
        this.log(`Error in preloadAudio: ${error.message}`, 'error');
        return false;
      }
    }
  
     /**
   * Execute a crossfade using provided parameters
   * Public method that maps to internal crossfade method
   * 
   * @param {Object} options - Crossfade parameters 
   * @returns {Promise<boolean>} - Resolves to true if crossfade completed successfully
   */
  async executeCrossfade(options) {
    return this.crossfade(options);
  }

  /**
   * Get information about an active crossfade
   * 
   * @param {string} layer - Layer identifier
   * @returns {Object|null} - Crossfade information or null if not active
   */
  getActiveCrossfade(layer) {
    if (!this.isActive(layer)) {
      return null;
    }
    
    const crossfade = this._activeCrossfades.get(layer);
    
    // Return only safe, serializable properties
    return {
      layer,
      from: crossfade.metadata?.fromTrackId || 'unknown',
      to: crossfade.metadata?.toTrackId || 'unknown',
      progress: this.getProgress(layer),
      startTime: crossfade.startTime,
      endTime: crossfade.endTime,
      elapsed: this.audioContext.currentTime - crossfade.startTime,
      currentVolume: crossfade.currentVolume
    };
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
    this._crossfadeTimers.forEach(timerId => {
      clearInterval(timerId);
    });

    // Reset internal state
    this._activeCrossfades.clear();
    this._crossfadeProgress.clear();
    this._crossfadeTimers.clear();
    
    // Emit disposal event
    if (this.config.enableEventBus) {
      eventBus.emit(EVENTS.CROSSFADE_DISPOSED || 'crossfade:disposed', {
        timestamp: Date.now(),
        stats: { ...this._stats }
      });
    }

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
