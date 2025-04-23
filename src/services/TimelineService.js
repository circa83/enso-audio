/**
 * TimelineService.js
 * 
 * Service for managing audio session timeline functionality
 * Handles session timing, phase transitions, event scheduling,
 * and coordinates audio changes based on timeline position
 */
import eventBus from './EventBus';

// Define event constants
export const TIMELINE_EVENTS = {
  STARTED: 'timeline:started',
  STOPPED: 'timeline:stopped',
  PAUSED: 'timeline:paused',
  RESUMED: 'timeline:resumed',
  RESET: 'timeline:reset',
  PROGRESS: 'timeline:progress',
  PHASE_CHANGED: 'timeline:phaseChanged',
  PHASE_TRANSITION: 'timeline:phaseTransition',
  EVENT_TRIGGERED: 'timeline:eventTriggered',
  PHASES_UPDATED: 'timeline:phasesUpdated',
  DURATION_CHANGED: 'timeline:durationChanged',
  TRANSITION_CHANGED: 'timeline:transitionChanged',
  SEEK: 'timeline:seek',
  EVENT_REGISTERED: 'timeline:eventRegistered',
  EVENTS_CLEARED: 'timeline:eventsCleared',
  ERROR: 'timeline:error',
  COMPLETED: 'timeline:completed',
  INITIALIZED: 'timeline:initialized'
};

class TimelineService {
  /**
   * Create a new TimelineService instance
   * @param {Object} options - Configuration options
   * @param {Object} options.volumeController - Reference to VolumeService
   * @param {Object} options.crossfadeEngine - Reference to CrossfadeService
   * @param {Function} [options.onPhaseChange] - Callback triggered when active phase changes: (phaseId, phaseData) => void
   * @param {Function} [options.onScheduledEvent] - Callback triggered when a scheduled event occurs: (event) => void
   * @param {Function} [options.onProgress] - Callback for timeline progress updates: (progress, time) => void
   * @param {Object} [options.defaultPhases] - Initial phase configuration
   * @param {number} [options.sessionDuration=3600000] - Total session duration in ms (default: 1 hour)
   * @param {number} [options.transitionDuration=4000] - Default phase transition duration in ms (default: 4 seconds)
   * @param {boolean} [options.enableLogging=false] - Enable detailed console logging
   * @param {boolean} [options.enableEventBus=true] - Enable EventBus integration
   */
  constructor(options = {}) {
    // Store service dependencies
    this.volumeController = options.volumeController;
    this.crossfadeEngine = options.crossfadeEngine;

    // Configuration
    this.config = {
      sessionDuration: options.sessionDuration || 3600000, // 1 hour default
      transitionDuration: options.transitionDuration || 4000, // 4 second default
      enableLogging: options.enableLogging || false,
      enableEventBus: options.enableEventBus !== false // Enable by default
    };

    // Validate required service dependencies
    if (!this.volumeController) {
      this.log('Warning: TimelineService initialized without volumeController', 'warn');
    }

    if (!this.crossfadeEngine) {
      this.log('Warning: TimelineService initialized without crossfadeEngine', 'warn');
    }

    // Callbacks - use default no-op functions if not provided
    this.onPhaseChange = options.onPhaseChange || ((phaseId, phaseData) => {
      this.log(`Phase changed to ${phaseId} but no handler is registered`);
    });

    this.onScheduledEvent = options.onScheduledEvent || ((event) => {
      this.log(`Event triggered: ${event.id} (${event.action}) but no handler is registered`);
    });

    this.onProgress = options.onProgress || (() => { });

    // Public state
    this.phases = options.defaultPhases || [];
    this.events = [];
    this.activePhaseId = null;
    this.activePhaseIndex = -1;
    this.isPlaying = false;
    this.isPaused = false;
    this.elapsedTime = 0;
    this.progress = 0;

    // Private state with _ prefix
    this._startTime = null;
    this._pausedTime = 0;
    this._timerHandle = null;
    this._lastUpdateTime = 0;
    this._nextEventIndex = 0;

    // Statistics
    this.stats = {
      phaseTransitions: 0,
      eventsTriggered: 0,
      timeUpdates: 0,
      started: 0,
      stopped: 0,
      paused: 0,
      resumed: 0,
      reset: 0,
      seekOperations: 0,
      errors: 0,
      lastOperation: {
        type: 'init',
        timestamp: Date.now()
      }
    };

    // Initialize default phases if none provided
    if (!this.phases || this.phases.length === 0) {
      this._initializeDefaultPhases();
    }

    this.log('TimelineService initialized');

    // Emit initialization event
    if (this.config.enableEventBus) {
      eventBus.emit(TIMELINE_EVENTS.INITIALIZED, {
        timestamp: Date.now(),
        sessionDuration: this.config.sessionDuration,
        transitionDuration: this.config.transitionDuration,
        phasesCount: this.phases.length
      });
    }
  }

  /**
   * Initialize default phases if none provided
   * @private
   */
  _initializeDefaultPhases() {
    const defaultPhases = [
      {
        id: 'pre-onset',
        name: 'Pre-Onset',
        position: 0,
        color: '#4A6670',
        state: null,
        locked: true
      },
      {
        id: 'onset',
        name: 'Onset & Buildup',
        position: 20,
        color: '#6E7A8A',
        state: null,
        locked: false
      },
      {
        id: 'peak',
        name: 'Peak',
        position: 40,
        color: '#8A8A8A',
        state: null,
        locked: false
      },
      {
        id: 'return',
        name: 'Return & Integration',
        position: 60,
        color: '#A98467',
        state: null,
        locked: false
      }
    ];

    this.phases = defaultPhases;
    this.log('Default phases initialized');
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
        this.log('Timeline is already playing', 'warn');
        return true;
      }

      this.log('Starting timeline. Reset=' + reset);

      // Reset elapsed time if requested
      if (reset) {
        this.log('Performing full timeline reset before starting');
        this.elapsedTime = 0;
        this.progress = 0;
        this._nextEventIndex = 0;
      }

      // Set start time based on current elapsed time
      this._startTime = Date.now() - this.elapsedTime;
      this.isPlaying = true;
      this.isPaused = false;

      // Start update loop using requestAnimationFrame
      this._updateLoop();

      // Update stats
      this.stats.started++;
      this.stats.lastOperation = {
        type: 'start',
        reset,
        timestamp: Date.now()
      };

      // Emit started event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.STARTED, {
          reset,
          elapsedTime: this.elapsedTime,
          timestamp: Date.now()
        });
      }

      this.log(`Timeline started successfully. Current elapsed time: ${this.elapsedTime}ms`);
      return true;
    } catch (error) {
      this.log(`Error starting timeline: ${error.message}`, 'error');

      // Update stats
      this.stats.errors++;
      this.stats.lastOperation = {
        type: 'error',
        action: 'start',
        message: error.message,
        timestamp: Date.now()
      };

      // Emit error event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.ERROR, {
          operation: 'start',
          message: error.message,
          timestamp: Date.now()
        });
      }

      return false;
    }
  }

  /**
   * Stop the timeline
   * @returns {boolean} Success state
   */
  stop() {
    try {
      if (!this.isPlaying && !this.isPaused) {
        this.log('Timeline already stopped', 'info');
        return true;
      }

      this.log('Stopping timeline');

      // Stop the update loop
      if (this._timerHandle) {
        cancelAnimationFrame(this._timerHandle);
        this._timerHandle = null;
      }

      // Reset state
      this.isPlaying = false;
      this.isPaused = false;
      this._startTime = null;

      // Update stats
      this.stats.stopped++;
      this.stats.lastOperation = {
        type: 'stop',
        elapsedTime: this.elapsedTime,
        timestamp: Date.now()
      };

      // Emit stopped event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.STOPPED, {
          elapsedTime: this.elapsedTime,
          timestamp: Date.now()
        });
      }

      this.log('Timeline stopped successfully');
      return true;
    } catch (error) {
      this.log(`Error stopping timeline: ${error.message}`, 'error');

      // Update stats
      this.stats.errors++;
      this.stats.lastOperation = {
        type: 'error',
        action: 'stop',
        message: error.message,
        timestamp: Date.now()
      };

      // Emit error event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.ERROR, {
          operation: 'stop',
          message: error.message,
          timestamp: Date.now()
        });
      }

      return false;
    }
  }

  /**
   * Pause the timeline without resetting elapsed time
   * This is different from stop() as it preserves position for later resuming
   * @returns {boolean} Success state
   */
  pauseTimeline() {
    try {
      if (!this.isPlaying) {
        this.log('Timeline already paused', 'info');
        return true;
      }

      this.log('Pausing timeline (preserving position)');

      // Stop the update loop
      if (this._timerHandle) {
        cancelAnimationFrame(this._timerHandle);
        this._timerHandle = null;
      }

      // Update state
      this.isPlaying = false;
      this.isPaused = true;
      this._pausedTime = this.elapsedTime;

      // Update stats
      this.stats.paused++;
      this.stats.lastOperation = {
        type: 'pause',
        elapsedTime: this.elapsedTime,
        timestamp: Date.now()
      };

      // Emit paused event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.PAUSED, {
          elapsedTime: this.elapsedTime,
          progress: this.progress,
          timestamp: Date.now()
        });
      }

      this.log('Timeline paused successfully');
      return true;
    } catch (error) {
      this.log(`Error pausing timeline: ${error.message}`, 'error');

      // Update stats
      this.stats.errors++;
      this.stats.lastOperation = {
        type: 'error',
        action: 'pause',
        message: error.message,
        timestamp: Date.now()
      };

      // Emit error event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.ERROR, {
          operation: 'pause',
          message: error.message,
          timestamp: Date.now()
        });
      }

      return false;
    }
  }

  /**
   * Resume the timeline from the current position
   * This continues from the current elapsed time without resetting
   * @returns {boolean} Success state
   */
  resumeTimeline() {
    try {
      if (this.isPlaying) {
        this.log('Timeline already playing', 'info');
        return true;
      }

      if (!this.isPaused) {
        this.log('Timeline was not paused, starting fresh');
        return this.start({ reset: false });
      }

      this.log(`Resuming timeline from ${this.elapsedTime}ms`);

      // Set start time based on current elapsed time to ensure continuity
      this._startTime = Date.now() - this._pausedTime;
      this.isPlaying = true;
      this.isPaused = false;

      // Start the update loop
      this._updateLoop();

      // Update stats
      this.stats.resumed++;
      this.stats.lastOperation = {
        type: 'resume',
        elapsedTime: this.elapsedTime,
        timestamp: Date.now()
      };

      // Emit resumed event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.RESUMED, {
          elapsedTime: this.elapsedTime,
          progress: this.progress,
          timestamp: Date.now()
        });
      }

      this.log('Timeline resumed successfully');
      return true;
    } catch (error) {
      this.log(`Error resuming timeline: ${error.message}`, 'error');

      // Update stats
      this.stats.errors++;
      this.stats.lastOperation = {
        type: 'error',
        action: 'resume',
        message: error.message,
        timestamp: Date.now()
      };

      // Emit error event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.ERROR, {
          operation: 'resume',
          message: error.message,
          timestamp: Date.now()
        });
      }

      return false;
    }
  }

  /**
   * Reset the timeline to initial state
   * Stops playback and resets elapsed time to zero
   * @returns {boolean} Success state
   */
  reset() {
    try {
      // Stop the timeline first
      this.stop();

      this.log('Resetting timeline to initial state');

      // Reset state
      this.elapsedTime = 0;
      this.progress = 0;
      this._pausedTime = 0;
      this._startTime = null;
      this._nextEventIndex = 0;
      this.activePhaseId = null;
      this.activePhaseIndex = -1;

      // Reset all events' triggered state
      this.events.forEach(event => {
        event.triggered = false;
      });

      // Update stats
      this.stats.reset++;
      this.stats.lastOperation = {
        type: 'reset',
        timestamp: Date.now()
      };

      // Emit reset event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.RESET, {
          timestamp: Date.now()
        });
      }

      this.log('Timeline reset successfully');
      return true;
    } catch (error) {
      this.log(`Error resetting timeline: ${error.message}`, 'error');

      // Update stats
      this.stats.errors++;
      this.stats.lastOperation = {
        type: 'error',
        action: 'reset',
        message: error.message,
        timestamp: Date.now()
      };

      // Emit error event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.ERROR, {
          operation: 'reset',
          message: error.message,
          timestamp: Date.now()
        });
      }

      return false;
    }
  }

  /**
   * Main update loop for the timeline
   * Uses requestAnimationFrame for efficient updates
   * @private
   */
  _updateLoop() {
    if (!this.isPlaying) return;

    // Calculate current elapsed time and progress
    const now = Date.now();
    this.elapsedTime = now - this._startTime;
    
    // Calculate progress (0-1)
    this.progress = Math.min(1, this.elapsedTime / this.config.sessionDuration);

    // Only update state and trigger callbacks if enough time has passed
    // This reduces CPU usage by avoiding too frequent updates
    if (now - this._lastUpdateTime >= 30) {  // Update at most every 30ms
      this._lastUpdateTime = now;
      this.stats.timeUpdates++;

      // Call the progress callback
      if (this.onProgress) {
        this.onProgress(this.progress, this.elapsedTime);
      }

      // Emit progress event (throttled)
      if (this.config.enableEventBus && this.stats.timeUpdates % 3 === 0) { // Further throttle events
        eventBus.emit(TIMELINE_EVENTS.PROGRESS, {
          progress: this.progress,
          elapsedTime: this.elapsedTime,
          timestamp: now
        });
      }

      // Check for phase transitions
      this._checkPhaseTransitions();

      // Check for scheduled events
      this._checkEvents();

      // Check for session completion
      if (this.progress >= 1) {
        this._handleSessionCompletion();
        return; // Stop the update loop
      }
    }

    // Continue the update loop
    this._timerHandle = requestAnimationFrame(() => this._updateLoop());
  }

  /**
   * Handle session completion
   * @private
   */
  _handleSessionCompletion() {
    if (!this.isPlaying) return;

    this.log('Session completed');

    // Stop the timeline
    this.stop();

    // Emit completed event via EventBus
    if (this.config.enableEventBus) {
      eventBus.emit(TIMELINE_EVENTS.COMPLETED, {
        elapsedTime: this.elapsedTime,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Check for phase transitions based on current progress
   * @private
   */
  _checkPhaseTransitions() {
    // Skip if no phases defined
    if (!this.phases || this.phases.length === 0) return;

    // Sort phases by position
    const sortedPhases = [...this.phases].sort((a, b) => a.position - b.position);

    // Find the current phase based on progress
    let activeIndex = -1;
    const progressPercent = this.progress * 100;

    // Find the latest phase we've passed
    for (let i = sortedPhases.length - 1; i >= 0; i--) {
      if (progressPercent >= sortedPhases[i].position) {
        activeIndex = i;
        break;
      }
    }

    // If we're before the first phase, use the first one
    if (activeIndex === -1 && sortedPhases.length > 0) {
      activeIndex = 0;
    }

    // If phase has changed, trigger transition
    if (activeIndex !== -1 && sortedPhases[activeIndex].id !== this.activePhaseId) {
      const previousPhaseId = this.activePhaseId;
      const newPhaseId = sortedPhases[activeIndex].id;
      const phaseData = sortedPhases[activeIndex];

      this.log(`Phase transition: ${previousPhaseId || 'none'} → ${newPhaseId}`);

      // Update state
      this.activePhaseId = newPhaseId;
      this.activePhaseIndex = activeIndex;

      // Update stats
      this.stats.phaseTransitions++;
      this.stats.lastOperation = {
        type: 'phaseChange',
        from: previousPhaseId,
        to: newPhaseId,
        timestamp: Date.now()
      };

      // Call the callback
      if (this.onPhaseChange) {
        this.onPhaseChange(newPhaseId, phaseData);
      }

      // Emit phase transition event via EventBus
      if (this.config.enableEventBus) {
        // Emit new event type with full details for SessionTimeline
        eventBus.emit(TIMELINE_EVENTS.PHASE_TRANSITION, {
          phaseId: newPhaseId,
          phaseData,
          previousPhaseId,
          progress: this.progress,
          elapsedTime: this.elapsedTime,
          transitionDuration: this.config.transitionDuration,
          timestamp: Date.now()
        });

        // Also emit legacy event type for backward compatibility
        eventBus.emit(TIMELINE_EVENTS.PHASE_CHANGED, {
          phaseId: newPhaseId,
          phaseData,
          previousPhaseId,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Check for scheduled events that should be triggered
   * @private
   */
  _checkEvents() {
    // Skip if no events or we're past all events
    if (!this.events || this.events.length === 0 || this._nextEventIndex >= this.events.length) {
      return;
    }

    // Sort events by time if not already sorted
    const sortedEvents = [...this.events].sort((a, b) => a.time - b.time);

    // Check each event starting from the next one
    for (let i = this._nextEventIndex; i < sortedEvents.length; i++) {
      const event = sortedEvents[i];
      
      // Skip events that were triggered already
      if (event.triggered) continue;

      // If we've reached an event that should trigger
      if (this.elapsedTime >= event.time) {
        this.log(`Triggering event: ${event.id || 'unnamed'} (${event.action || 'no action'})`);

        // Mark as triggered
        event.triggered = true;
        event.triggeredAt = Date.now();

        // Call the callback
        if (this.onScheduledEvent) {
          this.onScheduledEvent(event);
        }

        // Execute event handler if provided
        if (typeof event.handler === 'function') {
          try {
            event.handler(event);
          } catch (error) {
            this.log(`Error in event handler: ${error.message}`, 'error');
          }
        }

        // Emit event triggered via EventBus
        if (this.config.enableEventBus) {
          eventBus.emit(TIMELINE_EVENTS.EVENT_TRIGGERED, {
            event,
            elapsedTime: this.elapsedTime,
            timestamp: Date.now()
          });
        }

        // Update stats
        this.stats.eventsTriggered++;
      } else {
        // If this event is in the future, set next event index and exit
        this._nextEventIndex = i;
        break;
      }
    }
  }

  /**
   * Add an event to the timeline
   * @param {Object} event - Event object
   * @param {string} event.id - Unique identifier for the event
   * @param {number} event.time - When the event should trigger (ms from start)
   * @param {string} [event.action] - Action to perform
   * @param {Function} [event.handler] - Function to call when event triggers
   * @param {Object} [event.data] - Additional data for the event
   * @returns {boolean} Success state
   */
  addEvent(event) {
    if (!event || typeof event.time !== 'number') {
      this.log('Cannot add event: Missing required properties', 'error');
      return false;
    }

    this.log(`Adding event at ${event.time}ms: ${event.id || 'unnamed'}`);

    // Add event to the collection
    this.events.push({
      ...event,
      triggered: false
    });

    // Sort events by time
    this.events.sort((a, b) => a.time - b.time);

    // Reset next event index if needed
    this._nextEventIndex = 0;

    // Emit event registered via EventBus
    if (this.config.enableEventBus) {
      eventBus.emit(TIMELINE_EVENTS.EVENT_REGISTERED, {
        event,
        timestamp: Date.now()
      });
    }

    return true;
  }

  /**
   * Clear all events from the timeline
   * @returns {number} Number of events cleared
   */
  clearEvents() {
    const count = this.events.length;
    this.log(`Clearing ${count} events`);

    this.events = [];
    this._nextEventIndex = 0;

    // Emit events cleared via EventBus
    if (this.config.enableEventBus) {
      eventBus.emit(TIMELINE_EVENTS.EVENTS_CLEARED, {
        count,
        timestamp: Date.now()
      });
    }

    return count;
  }

  /**
   * Set the phases for the timeline
   * @param {Array} phases - Array of phase objects
   * @returns {boolean} Success state
   */
  setPhases(phases) {
    if (!phases || !Array.isArray(phases)) {
      this.log('Invalid phases data', 'error');
      return false;
    }

    this.log(`Setting ${phases.length} phases`);

    this.phases = [...phases];

    // Check if current active phase is still valid
    if (this.activePhaseId) {
      const phaseStillExists = this.phases.some(p => p.id === this.activePhaseId);
      
      if (!phaseStillExists) {
        this.log(`Active phase ${this.activePhaseId} no longer exists, resetting active phase`);
        this.activePhaseId = null;
        this.activePhaseIndex = -1;
      }
    }

    // Emit phases updated via EventBus
    if (this.config.enableEventBus) {
      eventBus.emit(TIMELINE_EVENTS.PHASES_UPDATED, {
        phases: this.phases,
        count: this.phases.length,
        timestamp: Date.now()
      });
    }

    return true;
  }

  /**
   * Set the session duration
   * @param {number} duration - Duration in milliseconds
   * @returns {boolean} Success state
   */
  setSessionDuration(duration) {
    if (typeof duration !== 'number' || duration <= 0) {
      this.log('Invalid session duration', 'error');
      return false;
    }

    this.log(`Setting session duration to ${duration}ms`);

    this.config.sessionDuration = duration;
    
    // Recalculate progress with new duration
    if (this.elapsedTime > 0) {
      this.progress = Math.min(1, this.elapsedTime / this.config.sessionDuration);
    }

    // Emit duration changed via EventBus
    if (this.config.enableEventBus) {
      eventBus.emit(TIMELINE_EVENTS.DURATION_CHANGED, {
        duration,
        timestamp: Date.now()
      });
    }

    return true;
  }

  /**
   * Set the transition duration
   * @param {number} duration - Duration in milliseconds
   * @returns {boolean} Success state
   */
  setTransitionDuration(duration) {
    if (typeof duration !== 'number' || duration < 0) {
      this.log('Invalid transition duration', 'error');
      return false;
    }

    this.log(`Setting transition duration to ${duration}ms`);

    this.config.transitionDuration = duration;

    // Emit transition duration changed via EventBus
    if (this.config.enableEventBus) {
      eventBus.emit(TIMELINE_EVENTS.TRANSITION_CHANGED, {
        duration,
        timestamp: Date.now()
      });
    }

    return true;
  }

  /**
   * Seek to a specific time
   * @param {number} timeMs - Time in milliseconds
   * @returns {boolean} Success state
   */
  seekTo(timeMs) {
    if (typeof timeMs !== 'number' || timeMs < 0) {
      this.log('Invalid seek time', 'error');
      return false;
    }

    this.log(`Seeking to ${timeMs}ms`);

    // Clamp to session duration
    const clampedTime = Math.min(timeMs, this.config.sessionDuration);
    
       // Update start time if playing
       if (this.isPlaying) {
        this._startTime = Date.now() - clampedTime;
      } else if (this.isPaused) {
        this._pausedTime = clampedTime;
      }
  
      // Reset event triggered state for events after new position
      this.events.forEach(event => {
        if (event.time > clampedTime) {
          event.triggered = false;
        }
      });
  
      // Reset next event index to ensure we check all relevant events
      this._nextEventIndex = 0;
  
      // Check for phase transitions immediately
      this._checkPhaseTransitions();
  
      // Call progress callback
      if (this.onProgress) {
        this.onProgress(this.progress, this.elapsedTime);
      }
  
      // Update stats
      this.stats.seekOperations++;
      this.stats.lastOperation = {
        type: 'seek',
        position: clampedTime,
        timestamp: Date.now()
      };
  
      // Emit seek event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.SEEK, {
          time: clampedTime,
          progress: this.progress,
          type: 'absolute',
          timestamp: Date.now()
        });
      }
  
      return true;
    }
  
    /**
     * Seek to a percentage of the session duration
     * @param {number} percent - Percentage (0-100)
     * @returns {boolean} Success state
     */
    seekToPercent(percent) {
      if (typeof percent !== 'number' || percent < 0 || percent > 100) {
        this.log('Invalid seek percentage', 'error');
        return false;
      }
  
      this.log(`Seeking to ${percent}%`);
  
      // Convert percent to time
      const timeMs = (percent / 100) * this.config.sessionDuration;
  
      // Use the seekTo method for the actual seeking
      const result = this.seekTo(timeMs);
  
      // Emit percent-specific seek event via EventBus
      if (result && this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.SEEK, {
          percent,
          time: timeMs,
          progress: this.progress,
          type: 'percent',
          timestamp: Date.now()
        });
      }
  
      return result;
    }
  
    /**
     * Get the current elapsed time
     * @returns {number} Elapsed time in milliseconds
     */
    getElapsedTime() {
      return this.elapsedTime;
    }
  
    /**
     * Get the current progress (0-1)
     * @returns {number} Progress value
     */
    getProgress() {
      return this.progress;
    }
  
    /**
     * Get the active phase ID
     * @returns {string|null} Active phase ID or null if no active phase
     */
    getActivePhaseId() {
      return this.activePhaseId;
    }
  
    /**
     * Get the active phase data
     * @returns {Object|null} Active phase data or null if no active phase
     */
    getActivePhase() {
      if (!this.activePhaseId) return null;
      return this.phases.find(p => p.id === this.activePhaseId) || null;
    }
  
    /**
     * Get all phase data
     * @returns {Array} Array of all phases
     */
    getPhases() {
      return [...this.phases];
    }
  
    /**
     * Get data for a specific phase
     * @param {string} phaseId - Phase ID to get
     * @returns {Object|null} Phase data or null if not found
     */
    getPhase(phaseId) {
      if (!phaseId) return null;
      return this.phases.find(p => p.id === phaseId) || null;
    }
  
    /**
     * Get all pending events
     * @returns {Array} Array of events that haven't triggered yet
     */
    getPendingEvents() {
      return this.events.filter(e => !e.triggered);
    }
  
    /**
     * Get all triggered events
     * @returns {Array} Array of events that have already triggered
     */
    getTriggeredEvents() {
      return this.events.filter(e => e.triggered);
    }
  
    /**
     * Get service statistics
     * @returns {Object} Statistics object
     */
    getStats() {
      return {
        ...this.stats,
        isPlaying: this.isPlaying,
        isPaused: this.isPaused,
        sessionDuration: this.config.sessionDuration,
        transitionDuration: this.config.transitionDuration,
        elapsedTime: this.elapsedTime,
        progress: this.progress,
        activePhase: this.activePhaseId,
        phaseCount: this.phases.length,
        eventCount: this.events.length,
        pendingEventCount: this.events.filter(e => !e.triggered).length,
        triggeredEventCount: this.events.filter(e => e.triggered).length
      };
    }
  
    /**
     * Apply phase changes according to the phase data
     * This method can be used to manually apply a phase's state
     * @param {string} phaseId - Phase ID to apply
     * @param {Object} [options] - Options for applying the phase
     * @param {boolean} [options.immediate=false] - Apply without transition
     * @param {number} [options.duration] - Custom transition duration
     * @returns {Promise<boolean>} Promise resolving to success state
     */
    applyPhase(phaseId, options = {}) {
      return new Promise(async (resolve) => {
        try {
          if (!phaseId) {
            this.log('Cannot apply phase: Missing phase ID', 'error');
            resolve(false);
            return;
          }
  
          const phase = this.phases.find(p => p.id === phaseId);
          if (!phase) {
            this.log(`Phase not found: ${phaseId}`, 'error');
            resolve(false);
            return;
          }
  
          this.log(`Applying phase ${phaseId}`);
  
          // Skip if no state to apply
          if (!phase.state) {
            this.log(`Phase ${phaseId} has no saved state to apply`, 'warn');
            resolve(true);
            return;
          }
  
          // Default options
          const transitionDuration = options.duration || this.config.transitionDuration;
          const immediate = options.immediate === true;
  
          // Apply volume changes if defined
          const volumeChanges = phase.state.volumes;
          if (volumeChanges && this.volumeController) {
            const durationsInSeconds = immediate ? 0 : transitionDuration / 1000;
            
            // Apply volumes using VolumeController
            for (const [layer, volume] of Object.entries(volumeChanges)) {
              this.log(`Setting volume for ${layer} to ${volume} with ${durationsInSeconds}s transition`);
              
              // For immediate changes, use setVolume
              if (immediate) {
                this.volumeController.setVolume(layer, volume, { immediate: true });
              } 
              // For transitions, use fadeVolume
              else if (durationsInSeconds > 0) {
                try {
                  await this.volumeController.fadeVolume(layer, volume, durationsInSeconds);
                } catch (err) {
                  this.log(`Error fading volume for ${layer}: ${err.message}`, 'error');
                }
              }
            }
          }
  
          // Apply audio track changes if defined and we have crossfade engine
          const audioChanges = phase.state.activeAudio;
          if (audioChanges && this.crossfadeEngine) {
            for (const [layer, trackId] of Object.entries(audioChanges)) {
              this.log(`Crossfading ${layer} to track ${trackId}`);
              
              // Use crossfade engine to change tracks
              try {
                await this.crossfadeEngine.crossfade({
                  layer,
                  targetTrackId: trackId,
                  duration: immediate ? 100 : transitionDuration
                });
              } catch (err) {
                this.log(`Error crossfading ${layer} to ${trackId}: ${err.message}`, 'error');
              }
            }
          }
  
          this.log(`Phase ${phaseId} applied successfully`);
          resolve(true);
        } catch (error) {
          this.log(`Error applying phase ${phaseId}: ${error.message}`, 'error');
          
          // Update stats
          this.stats.errors++;
          this.stats.lastOperation = {
            type: 'error',
            action: 'applyPhase',
            phaseId,
            message: error.message,
            timestamp: Date.now()
          };
          
          resolve(false);
        }
      });
    }
  
    /**
     * Enable or disable event bus integration
     * @param {boolean} enabled - Whether to enable event bus
     */
    setEventBusEnabled(enabled) {
      this.config.enableEventBus = enabled === true;
      this.log(`EventBus integration ${enabled ? 'enabled' : 'disabled'}`);
    }
  
    /**
     * Enable or disable logging
     * @param {boolean} enabled - Whether to enable logging
     */
    setLoggingEnabled(enabled) {
      this.config.enableLogging = enabled === true;
      this.log(`Logging ${enabled ? 'enabled' : 'disabled'}`);
    }
  
    /**
     * Clean up resources used by TimelineService
     * Should be called when the service is no longer needed
     */
    dispose() {
      this.log('Disposing TimelineService');
  
      // Stop the timeline
      this.stop();
  
      // Clean up callbacks
      this.onPhaseChange = null;
      this.onProgress = null;
      this.onScheduledEvent = null;
  
      // Clear references to other services
      this.volumeController = null;
      this.crossfadeEngine = null;
  
      // Clear data
      this.events = [];
      this.phases = [];
    }
  
    /**
     * Alias for dispose to maintain API compatibility
     */
    cleanup() {
      this.dispose();
    }
  
    /**
     * Logging helper that respects configuration
     * @param {string} message - Message to log
     * @param {string} [level='info'] - Log level (info, warn, error)
     */
    log(message, level = 'info') {
      if (!this.config.enableLogging) return;
  
      const prefix = '[TimelineService]';
  
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
  }
  
  export default TimelineService;
  