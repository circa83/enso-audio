/**
 * CrossfadeEngine.js
 * 
 * Service for managing smooth audio crossfades between tracks
 * Handles creation and coordination of gain nodes for seamless transitions
 * Tracks transition progress and provides status updates
 * Manages phase transitions and transition queuing
 */
import logger from '../../services/LoggingService';

class CrossfadeEngine {
    /**
     * Create a new CrossfadeEngine instance
     * @param {Object} options - Configuration options
     * @param {AudioContext} options.audioContext - Web Audio API context
     * @param {AudioNode} options.destination - Destination node for audio output
     * @param {Function} [options.onProgress] - Callback for progress updates: (layer, progress) => void
     * @param {Function} [options.onTransitionStart] - Callback for transition start: (phaseId, state, duration) => void
     * @param {Function} [options.onTransitionComplete] - Callback for transition completion: (phaseId, state) => void
     * @param {number} [options.transitionDuration=4000] - Default transition duration in ms
     * @param {boolean} [options.enableLogging=false] - Enable detailed console logging
     */
    constructor(options = {}) {
      if (!options.audioContext) {
        throw new Error('CrossfadeEngine requires an AudioContext instance');
      }
      
      if (!options.destination) {
        throw new Error('CrossfadeEngine requires a destination AudioNode');
      }
      
      // Dependencies
      this.audioContext = options.audioContext;
      this.destination = options.destination;
      
      // Configuration
      this.config = {
        enableLogging: options.enableLogging || false,
        defaultFadeDuration: options.defaultFadeDuration || 2000, // 2 seconds default
        minFadeDuration: options.minFadeDuration || 50, // Minimum fade duration (ms)
        maxFadeDuration: options.maxFadeDuration || 30000, // Maximum fade duration (ms)
        onProgress: options.onProgress || null,
        onTransitionStart: options.onTransitionStart || null,
        onTransitionComplete: options.onTransitionComplete || null
      };
      
      // State tracking
      this.activeCrossfades = new Map(); // Maps layer name to active crossfade info
      this.crossfadeProgress = new Map(); // Maps layer name to progress (0-1)
      this.crossfadeTimers = new Map(); // Maps layer name to interval timer ID
      
      // Transition management
      this.transitions = {
        isActive: false,
        currentTransition: null,
        queue: [],
        duration: options.transitionDuration || 4000 // Default transition duration
      };
      this.transitionTimers = new Map();
      
      // Transition handlers
      this.volumeHandler = null;
      this.crossfadeHandler = null;
      this.updateVolumeState = null;
      this.updateAudioState = null;
      this.currentAudioState = null;
      
      this.logInfo('CrossfadeEngine initialized');
    }
    
    /**
     * Performs a crossfade transition between two audio sources
     * 
     * @param {Object} options - Crossfade options
     * @param {string} options.layer - Layer identifier (e.g., 'drone', 'melody')
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
        this.logError(`Invalid crossfade parameters for layer ${layer}`);
        return false;
      }
      
      this.logInfo(`Starting crossfade for ${layer}, duration: ${duration}ms`);
      
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
          this.logError(`Error connecting audio graph: ${error.message}`);
          
          // Recovery - attempt to restore connections
          try {
            sourceNode.connect(this.destination);
            targetNode.connect(this.destination);
          } catch (e) {
            this.logError(`Recovery failed: ${e.message}`);
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
            this.logInfo(`Synced playback position at ${Math.round(relativePosition * 100)}%`);
          } catch (error) {
            this.logWarn(`Error syncing playback position: ${error.message}`);
            // Continue with crossfade anyway
          }
        }
        
        // Start playback of target element if provided
        if (targetElement && targetElement.paused) {
          try {
            await targetElement.play()
              .catch(e => this.logError(`Error playing target: ${e.message}`));
          } catch (error) {
            this.logError(`Error starting playback: ${error.message}`);
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
          this.logError(`Error scheduling gain ramps: ${error.message}`);
          
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
          metadata
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
        this.logError(`Crossfade error: ${error.message}`);
        
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
      
      this.logInfo(`Cancelling crossfade for ${layer}`);
      
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
            crossfade.sourceNode.connect(this.destination);
          } catch (e) {
            this.logWarn(`Error reconnecting source: ${e.message}`);
          }
        }
        
        if (reconnectTarget && crossfade.targetNode) {
          try {
            crossfade.targetNode.disconnect();
            crossfade.targetNode.connect(this.destination);
          } catch (e) {
            this.logWarn(`Error reconnecting target: ${e.message}`);
          }
        }
      } catch (error) {
        this.logError(`Error during crossfade cancellation: ${error.message}`);
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
      this.logInfo(`Completing crossfade for ${layer}`);
      
      try {
        // Stop source element if provided
        if (crossfade.sourceElement && !crossfade.sourceElement.paused) {
          try {
            crossfade.sourceElement.pause();
          } catch (e) {
            this.logWarn(`Error pausing source: ${e.message}`);
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
            if (crossfade.metadata && crossfade.metadata.volumeController) {
                // If we have a volume controller reference, use it
                crossfade.metadata.volumeController.connectToLayer(
                  layer, 
                  crossfade.targetNode,
                  this.destination
                );
              } else {
                // Fallback to direct connection if no volume controller is provided
                crossfade.targetNode.connect(this.destination);
              }
            // Set gain to the correct value
            if (crossfade.targetNode.gain) {
              crossfade.targetNode.gain.value = crossfade.currentVolume;
            }
          } catch (e) {
            this.logWarn(`Error reconnecting target: ${e.message}`);
          }
        }
        
        // Clean up state
        this.activeCrossfades.delete(layer);
        this.crossfadeProgress.set(layer, 0);
        
        this.logInfo(`Crossfade complete for ${layer}`);
        
    } catch (error) {
      this.logError(`Error during crossfade completion: ${error.message}`);
    }
  }
  
  /**
   * Get the current crossfade progress for a layer
   * 
   * @param {string} layer - Layer identifier
   * @returns {number} - Progress value between 0-1, or 0 if no active crossfade
   */
  getProgress(layer) {
    return this.crossfadeProgress.get(layer) || 0;
  }
  
  /**
   * Check if a layer is currently in an active crossfade
   * 
   * @param {string} layer - Layer identifier
   * @returns {boolean} - True if the layer has an active crossfade
   */
  isActive(layer) {
    return this.activeCrossfades.has(layer);
  }
  
  /**
   * Get information about an active crossfade
   * 
   * @param {string} layer - Layer identifier
   * @returns {Object|null} - Crossfade information or null if not active
   */
  getCrossfadeInfo(layer) {
    if (!this.isActive(layer)) {
      return null;
    }
    
    const crossfade = this.activeCrossfades.get(layer);
    const progress = this.getProgress(layer);
    
    // Return a sanitized version without internal references
    return {
      layer,
      progress,
      startTime: crossfade.startTime,
      endTime: crossfade.endTime,
      metadata: crossfade.metadata,
      timeRemaining: Math.max(0, (crossfade.endTime - this.audioContext.currentTime) * 1000)
    };
  }
  
  /**
   * Get all active crossfades
   * 
   * @returns {Object} - Map of layer names to crossfade info
   */
  getAllActiveCrossfades() {
    const result = {};
    
    this.activeCrossfades.forEach((crossfade, layer) => {
      result[layer] = this.getCrossfadeInfo(layer);
    });
    
    return result;
  }
  
  /**
   * Cancel all active crossfades
   * 
   * @param {Object} [options] - Cancellation options to apply to all crossfades
   * @returns {number} - Number of cancelled crossfades
   */
  cancelAllCrossfades(options = {}) {
    let count = 0;
    
    // Get all layers with active crossfades
    const layers = Array.from(this.activeCrossfades.keys());
    
    // Cancel each one
    layers.forEach(layer => {
      if (this.cancelCrossfade(layer, options)) {
        count++;
      }
    });
    
    return count;
  }
  
  /**
   * Adjust the volume of an in-progress crossfade
   * 
   * @param {string} layer - Layer identifier
   * @param {number} newVolume - New volume level (0-1)
   * @returns {boolean} - True if adjustment was applied
   */
  adjustCrossfadeVolume(layer, newVolume) {
    if (!this.isActive(layer)) {
      return false;
    }
    
    try {
      const crossfade = this.activeCrossfades.get(layer);
      const progress = this.getProgress(layer);
      
      // Apply volume to both fade nodes, scaled by progress
      if (crossfade.fadeOutGain) {
        crossfade.fadeOutGain.gain.value = newVolume * (1 - progress);
      }
      
      if (crossfade.fadeInGain) {
        crossfade.fadeInGain.gain.value = newVolume * progress;
      }
      
      // Update the stored current volume
      crossfade.currentVolume = newVolume;
      
      return true;
    } catch (error) {
      this.logError(`Error adjusting crossfade volume: ${error.message}`);
      return false;
    }
  }

  //=======TRANSITION MANAGEMENT=======
  //==================================

  /**
   * Check if a transition is currently in progress
   * @returns {boolean} True if transition is active
   */
  isTransitioning() {
    return this.transitions.isActive;
  }

  /**
   * Set the default transition duration
   * @param {number} duration - Duration in milliseconds
   * @returns {boolean} Success state
   */
  setTransitionDuration(duration) {
    if (isNaN(duration) || duration < 0) {
      this.logError(`Invalid transition duration: ${duration}`);
      return false;
    }
    
    this.logInfo(`Setting transition duration to ${duration}ms`);
    this.transitions.duration = duration;
    return true;
  }

  /**
   * Get the default transition duration
   * @returns {number} Duration in milliseconds
   */
  getTransitionDuration() {
    return this.transitions.duration;
  }

  /**
   * Start a phase transition
   * @param {string} phaseId - Phase identifier
   * @param {Object} phaseState - Phase state to transition to
   * @param {Object} [options] - Transition options
   * @param {number} [options.duration] - Custom transition duration
   * @returns {boolean} Success state
   */
  startTransition(phaseId, phaseState, options = {}) {
    if (!phaseState) {
      this.logError('Cannot start transition: No phase state provided');
      return false;
    }

    // If already transitioning, queue this one
    if (this.transitions.isActive) {
      this.logInfo(`Transition already in progress, queueing transition to ${phaseId}`);
      return this.queueTransition(phaseId, phaseState, options);
    }

    try {
      // Use specified duration or default
      const duration = options.duration || this.transitions.duration;
      
      this.logInfo(`Starting transition to phase: ${phaseId}, duration: ${duration}ms`);
      
      // Mark transition as active
      this.transitions.isActive = true;
      this.transitions.currentTransition = {
        phaseId,
        state: phaseState,
        startTime: Date.now(),
        duration,
        options
      };
      
      // Call transition start callback if provided
      if (this.config.onTransitionStart) {
        this.config.onTransitionStart(phaseId, phaseState, duration);
      }
      
      // Dispatch transition started event
      this.dispatchEvent('timeline-transition-started', {
        phaseId,
        state: phaseState,
        duration
      });
      
      // Track volume transitions
      let volumeTransitionsInProgress = 0;
      let completedVolumeTransitions = 0;
      
      // Handle volume transitions
      if (phaseState.volumes) {
        Object.entries(phaseState.volumes).forEach(([layer, targetVolume]) => {
          // Skip if no volume handler is available
          if (!this.volumeHandler) {
            this.logWarn(`No volume handler available, skipping ${layer} fade`);
            return;
          }
          
          volumeTransitionsInProgress++;
          
          // Use volume handler to fade the layer
          this.volumeHandler(layer, targetVolume, duration)
            .then(() => {
              completedVolumeTransitions++;
              
              // Check if all volume transitions are complete
              if (completedVolumeTransitions === volumeTransitionsInProgress) {
                this.logInfo(`All volume transitions for phase ${phaseId} completed`);
              }
            })
            .catch(error => {
              this.logError(`Error during volume transition for ${layer}: ${error.message}`);
            });
        });
      }
      
      // Track crossfade transitions
      let crossfadesInProgress = 0;
      let completedCrossfades = 0;
      
      // Handle audio track transitions
      if (phaseState.activeAudio) {
        Object.entries(phaseState.activeAudio).forEach(([layer, trackId]) => {
          // Skip if the track ID is already active
          if (this.currentAudioState && this.currentAudioState[layer] === trackId) {
            return;
          }
          
          crossfadesInProgress++;
          
          // Use track crossfade handler
          this.crossfadeHandler(layer, trackId, duration)
            .then(() => {
              completedCrossfades++;
              
              // Check if all crossfades are complete
              if (completedCrossfades === crossfadesInProgress) {
                this.logInfo(`All crossfades for phase ${phaseId} completed`);
              }
            })
            .catch(error => {
              this.logError(`Error during crossfade for ${layer}: ${error.message}`);
            });
        });
      }
      
      // Set a timer to mark the transition as complete
      const timerId = setTimeout(() => {
        this.completeTransition(phaseId, phaseState);
      }, duration + 100); // Add a small buffer
      
      this.transitionTimers.set(phaseId, timerId);
      
      return true;
    } catch (error) {
      this.logError(`Error starting transition to ${phaseId}: ${error.message}`);
      this.transitions.isActive = false;
      return false;
    }
  }

  /**
   * Queue a transition to be performed after the current one
   * @param {string} phaseId - Phase identifier
   * @param {Object} phaseState - Phase state to transition to
   * @param {Object} [options] - Transition options
   * @returns {boolean} Success state
   */
  queueTransition(phaseId, phaseState, options = {}) {
    try {
      this.logInfo(`Queueing transition to phase: ${phaseId}`);
      
      // Add to queue
      this.transitions.queue.push({
        phaseId,
        state: phaseState,
        options
      });
      
      return true;
    } catch (error) {
      this.logError(`Error queueing transition to ${phaseId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Mark a transition as complete and process queue
   * @param {string} phaseId - Phase identifier
   * @param {Object} phaseState - Phase state
   * @private
   */
  completeTransition(phaseId, phaseState) {
    if (!this.transitions.isActive) {
      return;
    }
    
    this.logInfo(`Completing transition to phase: ${phaseId}`);
    
    // Clear the timer
    if (this.transitionTimers.has(phaseId)) {
      clearTimeout(this.transitionTimers.get(phaseId));
      this.transitionTimers.delete(phaseId);
    }
    
    // Mark transition as complete
    this.transitions.isActive = false;
    this.transitions.currentTransition = null;
    
    // Update current state references if available
    if (phaseState) {
      if (phaseState.volumes && this.updateVolumeState) {
        this.updateVolumeState(phaseState.volumes);
      }
      
      if (phaseState.activeAudio && this.updateAudioState) {
        this.updateAudioState(phaseState.activeAudio);
      }
    }
    
    // Call the transition complete callback if provided
    if (this.config.onTransitionComplete) {
      this.config.onTransitionComplete(phaseId, phaseState);
    }
    
    // Dispatch transition completed event
    this.dispatchEvent('timeline-transition-completed', {
      phaseId,
      state: phaseState
    });
    
    // Process next transition in queue if any
    this.processTransitionQueue();
  }

  /**
   * Process the next transition in the queue
   * @private
   */
  processTransitionQueue() {
    if (this.transitions.queue.length === 0) {
      return;
    }
    
    // Get the next queued transition
    const nextTransition = this.transitions.queue.shift();
    
    this.logInfo(`Processing queued transition to phase: ${nextTransition.phaseId}`);
    
    // Start the transition
    this.startTransition(
      nextTransition.phaseId,
      nextTransition.state,
      nextTransition.options
    );
  }

  /**
   * Cancel the current transition
   * @returns {boolean} Success state
   */
  cancelTransition() {
    if (!this.transitions.isActive) {
      return false;
    }
    
    try {
      const currentTransition = this.transitions.currentTransition;
      
      this.logInfo(`Canceling transition to phase: ${currentTransition.phaseId}`);
      
      // Clear the completion timer
      if (currentTransition && this.transitionTimers.has(currentTransition.phaseId)) {
        clearTimeout(this.transitionTimers.get(currentTransition.phaseId));
        this.transitionTimers.delete(currentTransition.phaseId);
      }
      
      // Dispatch transition canceled event
      this.dispatchEvent('timeline-transition-canceled', {
        phaseId: currentTransition.phaseId
      });
      
      // Reset transition state
      this.transitions.isActive = false;
      this.transitions.currentTransition = null;
      
      return true;
    } catch (error) {
      this.logError(`Error canceling transition: ${error.message}`);
      return false;
    }
  }

  /**
   * Cancel all transitions (current and queued)
   * @returns {boolean} Success state
   */
  cancelAllTransitions() {
    try {
      this.logInfo('Canceling all transitions');
      
      // Cancel current transition if active
      if (this.transitions.isActive) {
        this.cancelTransition();
      }
      
      // Clear queue
      const queueLength = this.transitions.queue.length;
      this.transitions.queue = [];
      
      // Clear all timers
      for (const [phaseId, timerId] of this.transitionTimers.entries()) {
        clearTimeout(timerId);
      }
      this.transitionTimers.clear();
      
      this.logInfo(`Canceled current transition and cleared queue (${queueLength} transitions)`);
      
      return true;
    } catch (error) {
      this.logError(`Error canceling all transitions: ${error.message}`);
      return false;
    }
  }

  /**
   * Pause all active transitions
   * Useful when timeline is paused
   * @returns {boolean} Success state
   */
  pauseAllTransitions() {
    if (!this.transitions.isActive) {
      return false;
    }
    
    try {
      this.logInfo('Pausing all transitions');
      
      // Capture current state
      const currentTransition = this.transitions.currentTransition;
      
      if (currentTransition) {
        // Calculate elapsed time
        const elapsedTime = Date.now() - currentTransition.startTime;
        currentTransition.elapsedTime = elapsedTime;
        
        // Clear the timer
        if (this.transitionTimers.has(currentTransition.phaseId)) {
            clearTimeout(this.transitionTimers.get(currentTransition.phaseId));
            this.transitionTimers.delete(currentTransition.phaseId);
          }
        }
        
        // Dispatch transition paused event
        this.dispatchEvent('timeline-transitions-paused', {
          timestamp: Date.now()
        });
        
        return true;
      } catch (error) {
        this.logError(`Error pausing transitions: ${error.message}`);
        return false;
      }
    }

    /**
     * Resume all paused transitions
     * @returns {boolean} Success state
     */
    resumeAllTransitions() {
      try {
        this.logInfo('Resuming all transitions');
        
        // Resume current transition if paused
        const currentTransition = this.transitions.currentTransition;
        
        if (currentTransition && currentTransition.elapsedTime !== undefined) {
          // Calculate remaining time
          const remainingTime = currentTransition.duration - currentTransition.elapsedTime;
          
          // Only resume if there's time remaining
          if (remainingTime > 0) {
            // Update start time to maintain continuity
            currentTransition.startTime = Date.now() - currentTransition.elapsedTime;
            
            // Set new timer for remaining time
            const timerId = setTimeout(() => {
              this.completeTransition(currentTransition.phaseId, currentTransition.state);
            }, remainingTime + 100);
            
            this.transitionTimers.set(currentTransition.phaseId, timerId);
          } else {
            // If no time remaining, complete immediately
            this.completeTransition(currentTransition.phaseId, currentTransition.state);
          }
        }
        
        // Dispatch transition resumed event
        this.dispatchEvent('timeline-transitions-resumed', {
          timestamp: Date.now()
        });
        
        return true;
      } catch (error) {
        this.logError(`Error resuming transitions: ${error.message}`);
        return false;
      }
    }

    /**
     * Set callback handlers for transition actions
     * @param {Object} handlers - Handler functions
     * @param {Function} handlers.volumeHandler - Function to handle volume transitions: (layer, targetVolume, duration) => Promise
     * @param {Function} handlers.crossfadeHandler - Function to handle track crossfades: (layer, trackId, duration) => Promise
     * @param {Function} handlers.updateVolumeState - Function to update volume state: (volumes) => void
     * @param {Function} handlers.updateAudioState - Function to update audio state: (tracks) => void
     * @param {Object} handlers.currentAudioState - Current audio track state
     */
    setTransitionHandlers(handlers) {
      this.volumeHandler = handlers.volumeHandler;
      this.crossfadeHandler = handlers.crossfadeHandler;
      this.updateVolumeState = handlers.updateVolumeState;
      this.updateAudioState = handlers.updateAudioState;
      this.currentAudioState = handlers.currentAudioState;
      
      this.logInfo('Transition handlers configured');
    }

    /**
     * Update the current audio state reference
     * @param {Object} audioState - Map of layer IDs to track IDs
     */
    updateCurrentAudioState(audioState) {
      this.currentAudioState = { ...audioState };
    }

    /**
     * Ensure continuous progress tracking during transitions
     * @param {boolean} enabled - Whether to ensure continuous tracking
     */
    ensureContinuousProgressTracking(enabled) {
      // This method would integrate with TimelineEngine
      // to ensure progress updates continue during transitions
      this.logDebug(`Continuous progress tracking ${enabled ? 'enabled' : 'disabled'}`);
      
      // Dispatch event for TimelineEngine to listen to
      this.dispatchEvent('timeline-continuous-tracking', {
        enabled
      });
    }

    /**
     * Dispatch a custom event
     * @param {string} eventName - Name of the event
     * @param {Object} detail - Event details
     * @private
     */
    dispatchEvent(eventName, detail) {
      if (typeof window !== 'undefined') {
        const event = new CustomEvent(eventName, { detail });
        window.dispatchEvent(event);
      }
    }
    
    /**
     * Log a debug message
     * @private
     * @param {string} message - Message to log
     */
    logDebug(message) {
      if (this.config.enableLogging) {
        logger.debug('CrossfadeEngine', message);
      }
    }
    
    /**
     * Log an info message
     * @private
     * @param {string} message - Message to log
     */
    logInfo(message) {
      if (this.config.enableLogging) {
        logger.info('CrossfadeEngine', message);
      }
    }
    
    /**
     * Log a warning message
     * @private
     * @param {string} message - Message to log
     */
    logWarn(message) {
      if (this.config.enableLogging) {
        logger.warn('CrossfadeEngine', message);
      }
    }
    
    /**
     * Log an error message
     * @private
     * @param {string} message - Message to log
     */
    logError(message) {
      if (this.config.enableLogging) {
        logger.error('CrossfadeEngine', message);
      }
    }
    
    /**
     * Clean up resources when no longer needed
     * This will cancel all active crossfades and transitions
     */
    dispose() {
      this.cancelAllCrossfades();
      this.cancelAllTransitions();
      
      // Clear all timers
      for (const timerId of this.crossfadeTimers.values()) {
        clearInterval(timerId);
      }
      this.crossfadeTimers.clear();
      
      for (const timerId of this.transitionTimers.values()) {
        clearTimeout(timerId);
      }
      this.transitionTimers.clear();
      
      this.logInfo('CrossfadeEngine disposed');
    }
  }
  
  export default CrossfadeEngine;
