/**
 * TimelineEngine.js
 * 
 * Manages core timeline functionality:
 * - Timeline state (playing, elapsed time)
 * - Starting/stopping/pausing/resuming
 * - Progress tracking and calculation
 * - Timer management
 * - Timeline event registration and management
 */
import logger from '../../services/LoggingService';

class TimelineEngine {
  /**
   * Create a new TimelineEngine instance
   * @param {Object} options - Configuration options
   * @param {PhaseManager} options.phaseManager - Phase management instance
   * @param {CrossfadeEngine} options.crossfadeEngine - Crossfade engine instance
   * @param {Function} options.onProgress - Callback for progress updates: (progress, time) => void
   * @param {Function} options.onScheduledEvent - Callback for scheduled events: (event) => void
   * @param {number} [options.sessionDuration=3600000] - Session duration in ms (default: 1 hour)
   * @param {boolean} [options.enableLogging=false] - Enable detailed logging
   */
  constructor(options = {}) {
    // Dependencies
    this.phaseManager = options.phaseManager;
    this.crossfadeEngine = options.crossfadeEngine;

    if (!this.phaseManager) {
      throw new Error('TimelineEngine requires a PhaseManager instance');
    }

    // Configuration
    this.config = {
      sessionDuration: options.sessionDuration || 3600000, // 1 hour default
      enableLogging: options.enableLogging || false
    };

    // Callbacks
    this.onProgress = options.onProgress || (() => {});
    this.onScheduledEvent = options.onScheduledEvent || (() => {});

    // Timeline state
    this.startTime = null;
    this.elapsedTime = 0;
    this.isPlaying = false;
    this.lastProgressUpdate = null;

    // Event management
    this.events = [];
    this.nextEventIndex = 0;

    // Timers
    this.progressTimer = null;
    this.eventCheckTimer = null;

    this.logInfo('TimelineEngine initialized');
  }

  /**
   * Start the timeline
   * @param {Object} [options] - Start options
   * @param {boolean} [options.reset=false] - Whether to reset elapsed time
   * @returns {boolean} Success state
   */
  start(options = {}) {
    const { reset = false } = options;

    try {
      if (this.isPlaying) {
        this.logWarn('Timeline is already playing');
        return true;
      }
      
      this.logInfo(`Starting timeline. Reset=${reset}`);

      // Reset elapsed time if requested
      if (reset) {
        this.logInfo('Performing full timeline reset before starting');
        this.stopProgressTimer();
        this.stopEventChecking();
        this.elapsedTime = 0;
        this.nextEventIndex = 0;
        
        // Ensure we trigger initial progress updates
        if (this.onProgress) {
          this.onProgress(0, 0);
        }
      }

      // Set start time based on current elapsed time
      this.startTime = Date.now() - this.elapsedTime;
      this.isPlaying = true;

      // Start progress timer
      this.startProgressTimer(true); // Immediate update

      // Start event checking
      this.startEventChecking();

      // Tell phase manager to check current phase
      if (this.phaseManager) {
        this.phaseManager.checkCurrentPhase();
      }
      
      // Dispatch timeline started event
      this.dispatchEvent('timeline-started', {
        timestamp: Date.now(),
        elapsedTime: this.elapsedTime,
        reset: reset
      });

      return true;
    } catch (error) {
      this.logError(`Error starting timeline: ${error.message}`);
      return false;
    }
  }

  /**
   * Stop the timeline
   * @returns {boolean} Success state
   */
  stop() {
    try {
      if (!this.isPlaying) {
        this.logInfo('Timeline already stopped');
        return true;
      }

      this.logInfo('Stopping timeline');

      // Update elapsed time before stopping
      if (this.startTime) {
        this.elapsedTime = Date.now() - this.startTime;
      }

      this.isPlaying = false;
      this.startTime = null;

      // Stop timers
      this.stopProgressTimer();
      this.stopEventChecking();
      
      // Notify crossfade engine to cancel transitions
      if (this.crossfadeEngine && this.crossfadeEngine.cancelAllTransitions) {
        this.crossfadeEngine.cancelAllTransitions();
      }
      
      // Dispatch timeline stopped event
      this.dispatchEvent('timeline-stopped', {
        timestamp: Date.now(),
        elapsedTime: this.elapsedTime
      });

      return true;
    } catch (error) {
      this.logError(`Error stopping timeline: ${error.message}`);
      return false;
    }
  }

  /**
   * Pause the timeline without resetting elapsed time
   * @returns {boolean} Success state
   */
  pauseTimeline() {
    try {
      if (!this.isPlaying) {
        this.logInfo('Timeline already paused');
        return true;
      }

      this.logInfo('Pausing timeline (preserving position)');

      // Update elapsed time before pausing
      if (this.startTime) {
        this.elapsedTime = Date.now() - this.startTime;
      }

      this.isPlaying = false;
      this.startTime = null;

      // Stop timers
      this.stopProgressTimer();
      this.stopEventChecking();
      
      // Notify crossfade engine to pause transitions
      if (this.crossfadeEngine && this.crossfadeEngine.pauseAllTransitions) {
        this.crossfadeEngine.pauseAllTransitions();
      }
      
      // Dispatch timeline paused event
      this.dispatchEvent('timeline-paused', {
        timestamp: Date.now(),
        elapsedTime: this.elapsedTime
      });

      return true;
    } catch (error) {
      this.logError(`Error pausing timeline: ${error.message}`);
      return false;
    }
  }

  /**
   * Resume the timeline from the current position
   * @returns {boolean} Success state
   */
  resumeTimeline() {
    try {
      if (this.isPlaying) {
        this.logInfo('Timeline already playing');
        return true;
      }

      this.logInfo(`Resuming timeline from ${this.elapsedTime}ms`);

      // Set start time based on current elapsed time
      this.startTime = Date.now() - this.elapsedTime;
      this.isPlaying = true;

      // Start progress timer
      this.startProgressTimer(true);

      // Start event checking
      this.startEventChecking();

      // Tell phase manager to check current phase
      if (this.phaseManager) {
        this.phaseManager.checkCurrentPhase();
      }
      
      // Notify crossfade engine to resume transitions
      if (this.crossfadeEngine && this.crossfadeEngine.resumeAllTransitions) {
        this.crossfadeEngine.resumeAllTransitions();
      }
      
      // Dispatch timeline resumed event
      this.dispatchEvent('timeline-resumed', {
        timestamp: Date.now(),
        elapsedTime: this.elapsedTime
      });

      return true;
    } catch (error) {
      this.logError(`Error resuming timeline: ${error.message}`);
      return false;
    }
  }

  /**
   * Reset the timeline state
   * @returns {boolean} Success state
   */
  reset() {
    try {
      // Stop if playing
      if (this.isPlaying) {
        this.stop();
      }

      this.logInfo('Resetting timeline');

      // Reset state
      this.elapsedTime = 0;
      this.startTime = null;
      this.nextEventIndex = 0;
      
      // Cancel any active transitions
      if (this.crossfadeEngine && this.crossfadeEngine.cancelAllTransitions) {
        this.crossfadeEngine.cancelAllTransitions();
      }
      
      // Apply pre-onset phase if available
      if (this.phaseManager) {
        this.phaseManager.applyPreOnsetPhase();
      }

      // Force a progress update to reflect reset
      if (this.onProgress) {
        this.onProgress(0, 0);
      }
      
      // Dispatch timeline reset event
      this.dispatchEvent('timeline-reset', {
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      this.logError(`Error resetting timeline: ${error.message}`);
      return false;
    }
  }

  /**
   * Get the current elapsed time of the session
   * @returns {number} Elapsed time in milliseconds
   */
  getElapsedTime() {
    if (!this.isPlaying) {
      return this.elapsedTime;
    }

    // If playing, calculate based on startTime
    return this.startTime ? Date.now() - this.startTime : 0;
  }

  /**
   * Set the session duration
   * @param {number} duration - Duration in milliseconds
   * @returns {boolean} Success state
   */
  setSessionDuration(duration) {
    if (isNaN(duration) || duration <= 0) {
      this.logError(`Invalid session duration: ${duration}`);
      return false;
    }
    
    this.logInfo(`Setting session duration to ${duration}ms`);
    this.config.sessionDuration = duration;

    // Check if this affects current phase
    if (this.phaseManager) {
      this.phaseManager.checkCurrentPhase();
    }
    
    // Dispatch duration change event
    this.dispatchEvent('timeline-duration-set', {
      duration: duration
    });

    return true;
  }

  /**
   * Get the session duration
   * @returns {number} Duration in milliseconds
   */
  getSessionDuration() {
    return this.config.sessionDuration;
  }

  /**
   * Get the current session progress as percentage
   * @returns {number} Progress percentage (0-100)
   */
  getProgress() {
    const elapsed = this.getElapsedTime();
    const percentage = (elapsed / this.config.sessionDuration) * 100;
    return Math.min(100, Math.max(0, percentage));
  }

  /**
   * Seek to a specific time in the timeline
   * @param {number} timeMs - Time position in milliseconds
   * @returns {boolean} Success state
   */
  seekToTime(timeMs) {
    try {
      if (isNaN(timeMs) || timeMs < 0) {
        this.logError(`Invalid seek time: ${timeMs}`);
        return false;
      }

      // Ensure we don't seek past the end
      const clampedTime = Math.min(timeMs, this.config.sessionDuration);
      
      this.logInfo(`Seeking to time: ${clampedTime}ms`);
      
      // Update elapsed time
      this.elapsedTime = clampedTime;
      
      // If currently playing, adjust start time for continuity
      if (this.isPlaying) {
        this.startTime = Date.now() - this.elapsedTime;
      }

      // Check current phase for the new position
      if (this.phaseManager) {
        this.phaseManager.checkCurrentPhase();
      }
      
      // Update progress immediately
      this.updateProgress(true);
      
      // Dispatch timeline seeked event
      this.dispatchEvent('timeline-seeked', {
        timestamp: Date.now(),
        position: clampedTime,
        progress: this.getProgress()
      });

      return true;
    } catch (error) {
      this.logError(`Error seeking to time: ${error.message}`);
      return false;
    }
  }

  /**
   * Seek to a percentage position in the timeline
   * @param {number} percent - Position as percentage (0-100)
   * @returns {boolean} Success state
   */
  seekToPercent(percent) {
    if (isNaN(percent) || percent < 0 || percent > 100) {
      this.logError(`Invalid seek percentage: ${percent}`);
      return false;
    }

    const timeMs = (percent / 100) * this.config.sessionDuration;
    return this.seekToTime(timeMs);
  }

  /**
   * Update progress tracking
   * @param {boolean} [forceUpdate=false] - Force update regardless of timing
   */
  updateProgress(forceUpdate = false) {
    const now = Date.now();
    
    if (!this.lastProgressUpdate) {
      this.lastProgressUpdate = now;
    }
    
    // Check if we need to update (at most every 250ms)
    const timeSinceLastUpdate = now - this.lastProgressUpdate;
    if (!forceUpdate && timeSinceLastUpdate < 250) {
      return;
    }
    
    // Update the last update time
    this.lastProgressUpdate = now;
   
    if (!this.isPlaying && !forceUpdate) {
      return;
    }

    // Calculate current time and progress
    const currentTime = this.getElapsedTime();
    const progress = this.getProgress();
    const isTransitioning = this.crossfadeEngine && 
                            typeof this.crossfadeEngine.isTransitioning === 'function' && 
                            this.crossfadeEngine.isTransitioning();

    // Get current phase from phase manager
    const currentPhase = this.phaseManager ? this.phaseManager.getCurrentPhase() : null;
    const phaseId = currentPhase ? currentPhase.id : null;

    // Trigger the callback
    if (this.onProgress) {
      this.onProgress(progress, currentTime);

      // Broadcast progress update to all components
      this.dispatchEvent('timeline-progress-update', {
        progress: progress,
        time: currentTime,
        isTransitioning: isTransitioning,
        phase: phaseId
      });
    }

       // Check if we've reached the end of the session
       if (progress >= 100) {
        this.logInfo('Session completed (100% progress reached)');
        this.stop();
      }
    }
  
    /**
     * Start progress tracking timer
     * @param {boolean} [immediate=false] - Whether to trigger an immediate update
     * @private
     */
    startProgressTimer(immediate = false) {
      // Clear any existing timer first
      this.stopProgressTimer();
  
      // If immediate update requested, do it now
      if (immediate) {
        this.updateProgress(true);
      }
  
      // Set up timer for regular updates
      this.progressTimer = setInterval(() => {
        this.updateProgress();
      }, 250);
    }
  
    /**
     * Stop the progress tracking timer
     * @private
     */
    stopProgressTimer() {
      if (this.progressTimer) {
        clearInterval(this.progressTimer);
        this.progressTimer = null;
      }
    }
  
    /**
     * Force continuous progress tracking even during transitions
     * Useful for ensuring smooth updates during phase transitions
     * @param {boolean} enabled - Whether to enable continuous updates
     */
    ensureContinuousProgressTracking(enabled) {
      if (enabled) {
        // If we already have a timer, clear it
        this.stopProgressTimer();
        
        // Start a more frequent update timer
        this.progressTimer = setInterval(() => {
          this.updateProgress(true); // Force updates
        }, 50); // More frequent updates
      } else {
        // Return to normal update frequency
        this.stopProgressTimer();
        
        if (this.isPlaying) {
          this.startProgressTimer();
        }
      }
    }
  
    /**
     * Check and trigger scheduled events
     * @private
     */
    checkEvents() {
      if (!this.isPlaying || this.events.length === 0 || this.nextEventIndex >= this.events.length) {
        return;
      }
  
      const currentTime = this.getElapsedTime();
      
      // Check all remaining events in order
      while (this.nextEventIndex < this.events.length) {
        const event = this.events[this.nextEventIndex];
        
        // Skip invalid events
        if (!event || !event.time) {
          this.nextEventIndex++;
          continue;
        }
        
        // If this event's time has passed, trigger it
        if (currentTime >= event.time) {
          this.logInfo(`Triggering scheduled event: ${event.id} at ${event.time}ms`);
          
          if (this.onScheduledEvent) {
            this.onScheduledEvent(event);
          }
          
          // Dispatch event triggered event
          this.dispatchEvent('timeline-event-triggered', {
            event: event
          });
          
          // Move to next event
          this.nextEventIndex++;
        } else {
          // If this event hasn't happened yet, stop checking
          break;
        }
      }
    }
  
    /**
     * Start event checking timer
     * @private
     */
    startEventChecking() {
      // Clear any existing timer
      this.stopEventChecking();
      
      // Set up timer for checking events
      this.eventCheckTimer = setInterval(() => {
        this.checkEvents();
      }, 100); // Check for events more frequently than progress
    }
  
    /**
     * Stop the event checking timer
     * @private
     */
    stopEventChecking() {
      if (this.eventCheckTimer) {
        clearInterval(this.eventCheckTimer);
        this.eventCheckTimer = null;
      }
    }
  
    /**
     * Add a scheduled event to the timeline
     * @param {Object} event - Event configuration
     * @param {string} event.id - Unique event identifier
     * @param {number} event.time - Time to trigger event (ms from start)
     * @param {Object} [event.data] - Custom event data
     * @returns {boolean} Success state
     */
    addEvent(event) {
      if (!event || !event.id || event.time === undefined) {
        this.logError('Invalid event data', event);
        return false;
      }
  
      try {
        this.logInfo(`Adding event: ${event.id} at ${event.time}ms`);
        
        // Add the event
        this.events.push(event);
        
        // Re-sort events by time
        this.events.sort((a, b) => a.time - b.time);
        
        // If the event is before our next event index, adjust the index
        if (this.events.length > 1 && 
            this.nextEventIndex < this.events.length - 1 &&
            event.time < this.events[this.nextEventIndex].time) {
          
          // Find the correct position for nextEventIndex
          while (this.nextEventIndex > 0 && 
                 this.events[this.nextEventIndex - 1].time > this.getElapsedTime()) {
            this.nextEventIndex--;
          }
        }
        
        return true;
      } catch (error) {
        this.logError(`Error adding event: ${error.message}`);
        return false;
      }
    }
  
    /**
     * Get all scheduled events
     * @returns {Array} Scheduled events
     */
    getEvents() {
      return [...this.events];
    }
  
    /**
     * Remove a specific event by ID
     * @param {string} eventId - Event identifier
     * @returns {boolean} Success state
     */
    removeEvent(eventId) {
      const initialLength = this.events.length;
      
      // Find and remove the event
      this.events = this.events.filter(event => event.id !== eventId);
      
      const removed = this.events.length < initialLength;
      
      if (removed) {
        this.logInfo(`Removed event: ${eventId}`);
        
        // If we've already passed some events, we may need to adjust nextEventIndex
        if (this.nextEventIndex > 0) {
          // Count how many events before the current index were removed
          const removedBefore = initialLength - this.events.length - 
                                (initialLength - this.nextEventIndex) + 
                                (this.events.length - this.nextEventIndex);
          
          // Adjust the index accordingly
          this.nextEventIndex = Math.max(0, this.nextEventIndex - removedBefore);
        }
      } else {
        this.logWarn(`Event not found: ${eventId}`);
      }
      
      return removed;
    }
  
    /**
     * Clear all scheduled events
     * @returns {boolean} Success state
     */
    clearEvents() {
      this.logInfo(`Clearing all events (${this.events.length} total)`);
      this.events = [];
      this.nextEventIndex = 0;
      return true;
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
     * Clean up resources when the engine is no longer needed
     */
    dispose() {
      this.logInfo('Disposing TimelineEngine');
      
      // Stop any active timers
      this.stopProgressTimer();
      this.stopEventChecking();
      
      // Reset state
      this.isPlaying = false;
      this.startTime = null;
      
      // Dispatch disposal event
      this.dispatchEvent('timeline-engine-disposed', {
        timestamp: Date.now()
      });
    }
  
    //=======LOGGING METHODS=======
    //============================
  
    /**
     * Log an info message
     * @param {string} message - Log message
     * @param {*} [data] - Optional data to log
     * @private
     */
    logInfo(message, data) {
      if (this.config.enableLogging) {
        if (data !== undefined) {
          logger.info('TimelineEngine', message, data);
        } else {
          logger.info('TimelineEngine', message);
        }
      }
    }
  
    /**
     * Log a debug message
     * @param {string} message - Log message
     * @param {*} [data] - Optional data to log
     * @private
     */
    logDebug(message, data) {
      if (this.config.enableLogging) {
        if (data !== undefined) {
          logger.debug('TimelineEngine', message, data);
        } else {
          logger.debug('TimelineEngine', message);
        }
      }
    }
  
    /**
     * Log a warning message
     * @param {string} message - Log message
     * @param {*} [data] - Optional data to log
     * @private
     */
    logWarn(message, data) {
      if (this.config.enableLogging) {
        if (data !== undefined) {
          logger.warn('TimelineEngine', message, data);
        } else {
          logger.warn('TimelineEngine', message);
        }
      }
    }
  
    /**
     * Log an error message
     * @param {string} message - Log message
     * @param {*} [data] - Optional data to log
     * @private
     */
    logError(message, data) {
      // Always log errors regardless of enableLogging setting
      if (data !== undefined) {
        logger.error('TimelineEngine', message, data);
      } else {
        logger.error('TimelineEngine', message);
      }
    }
  }
  
  export default TimelineEngine;
  