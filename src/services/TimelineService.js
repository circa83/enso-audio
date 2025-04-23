/**
 * TimelineService.js
 * 
 * Service for managing audio session timeline functionality
 * Handles session timing, phase transitions, event scheduling,
 * and coordinates audio changes based on timeline position
 */
import eventBus from '../services/EventBus';

// Define event constants
export const TIMELINE_EVENTS = {
  STARTED: 'timeline:started',
  STOPPED: 'timeline:stopped',
  PAUSED: 'timeline:paused',
  RESUMED: 'timeline:resumed',
  RESET: 'timeline:reset',
  PROGRESS: 'timeline:progress',
  PHASE_CHANGED: 'timeline:phaseChanged',
  EVENT_TRIGGERED: 'timeline:eventTriggered',
  PHASES_UPDATED: 'timeline:phasesUpdated',
  DURATION_CHANGED: 'timeline:durationChanged',
  TRANSITION_CHANGED: 'timeline:transitionChanged',
  SEEK: 'timeline:seek',
  EVENT_REGISTERED: 'timeline:eventRegistered',
  EVENTS_CLEARED: 'timeline:eventsCleared',
  ERROR: 'timeline:error'
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

    // Private session state with _ prefix
    this._startTime = null;
    this._elapsedTime = 0;
    this._isPlaying = false;

    // Private timeline data with _ prefix
    this._phases = [];
    this._events = [];
    this._currentPhase = null;
    this._nextEventIndex = 0;

    // Private timers with _ prefix
    this._progressTimer = null;
    this._eventCheckTimer = null;

    // Add service statistics
    this._stats = {
      started: 0,
      stopped: 0,
      paused: 0,
      resumed: 0,
      reset: 0,
      phaseChanges: 0,
      eventsTriggered: 0,
      seekOperations: 0,
      errors: 0,
      lastOperation: {
        type: 'init',
        timestamp: Date.now()
      }
    };

    // Initialize with default phases if provided
    if (options.defaultPhases && Array.isArray(options.defaultPhases)) {
      this.setPhases(options.defaultPhases);
    } else {
      this._initializeDefaultPhases();
    }

    this.log('TimelineService initialized');

    // Emit initialization event
    if (this.config.enableEventBus) {
      eventBus.emit('timeline:initialized', {
        timestamp: Date.now(),
        sessionDuration: this.config.sessionDuration,
        transitionDuration: this.config.transitionDuration,
        phasesCount: this._phases.length
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

    this._phases = defaultPhases;
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
      if (this._isPlaying) {
        this.log('Timeline is already playing', 'warn');
        return true;
      }

      this.log('Starting timeline. Reset=' + reset);

      // Reset elapsed time if requested
      if (reset) {
        this.log('Performing full timeline reset before starting');
        // Stop any existing timers
        this._stopProgressTimer();
        this._stopEventChecking();
        this._elapsedTime = 0;
        this._nextEventIndex = 0;

        // Ensure we trigger initial progress updates
        if (this.onProgress) {
          this.onProgress(0, 0);
        }

        // Emit progress event via EventBus
        if (this.config.enableEventBus) {
          eventBus.emit(TIMELINE_EVENTS.PROGRESS, {
            progress: 0,
            elapsedTime: 0,
            timestamp: Date.now()
          });
        }

        this.log('Timeline reset to beginning');
      }

      // Set start time based on current elapsed time
      this._startTime = Date.now() - this._elapsedTime;
      this._isPlaying = true;

      // Start progress timer
      this._startProgressTimer(true); // Added parameter for immediate update

      // Start event checking
      this._startEventChecking();

      // Check for initial phase
      this._checkCurrentPhase();

      // Update stats
      this._updateStats({
        started: this._stats.started + 1,
        lastOperation: {
          type: 'start',
          reset,
          timestamp: Date.now()
        }
      });

      // Emit started event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.STARTED, {
          reset,
          elapsedTime: this._elapsedTime,
          timestamp: Date.now()
        });
      }

      this.log(`Timeline started successfully. Current elapsed time: ${this._elapsedTime}ms`);
      return true;
    } catch (error) {
      this.log(`Error starting timeline: ${error.message}`, 'error');

      // Update stats
      this._updateStats({
        errors: this._stats.errors + 1,
        lastOperation: {
          type: 'error',
          action: 'start',
          message: error.message,
          timestamp: Date.now()
        }
      });

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
      if (!this._isPlaying) {
        this.log('Timeline already stopped', 'info');
        return true;
      }

      this.log('Stopping timeline');

      // Update elapsed time before stopping
      if (this._startTime) {
        this._elapsedTime = Date.now() - this._startTime;
        this.log(`Elapsed time updated to ${this._elapsedTime}ms`);
      }

      this._isPlaying = false;
      this._startTime = null;

      // Stop timers
      this._stopProgressTimer();
      this._stopEventChecking();

      // Update stats
      this._updateStats({
        stopped: this._stats.stopped + 1,
        lastOperation: {
          type: 'stop',
          elapsedTime: this._elapsedTime,
          timestamp: Date.now()
        }
      });

      // Emit stopped event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.STOPPED, {
          elapsedTime: this._elapsedTime,
          timestamp: Date.now()
        });
      }

      this.log('Timeline stopped successfully');
      return true;
    } catch (error) {
      this.log(`Error stopping timeline: ${error.message}`, 'error');

      // Update stats
      this._updateStats({
        errors: this._stats.errors + 1,
        lastOperation: {
          type: 'error',
          action: 'stop',
          message: error.message,
          timestamp: Date.now()
        }
      });

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
      if (!this._isPlaying) {
        this.log('Timeline already paused', 'info');
        return true;
      }

      this.log('Pausing timeline (preserving position)');

      // Update elapsed time before pausing
      if (this._startTime) {
        this._elapsedTime = Date.now() - this._startTime;
        this.log(`Elapsed time updated to ${this._elapsedTime}ms`);
      }

      this._isPlaying = false;
      this._startTime = null;

      // Stop timers
      this._stopProgressTimer();
      this._stopEventChecking();

      // Update stats
      this._updateStats({
        paused: this._stats.paused + 1,
        lastOperation: {
          type: 'pause',
          elapsedTime: this._elapsedTime,
          timestamp: Date.now()
        }
      });

      // Emit paused event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.PAUSED, {
          elapsedTime: this._elapsedTime,
          timestamp: Date.now()
        });
      }

      this.log('Timeline paused successfully');
      return true;
    } catch (error) {
      this.log(`Error pausing timeline: ${error.message}`, 'error');

      // Update stats
      this._updateStats({
        errors: this._stats.errors + 1,
        lastOperation: {
          type: 'error',
          action: 'pause',
          message: error.message,
          timestamp: Date.now()
        }
      });

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
      if (this._isPlaying) {
        this.log('Timeline already playing', 'info');
        return true;
      }

      this.log(`Resuming timeline from ${this._elapsedTime}ms`);

      // Set start time based on current elapsed time to ensure continuity
      this._startTime = Date.now() - this._elapsedTime;
      this._isPlaying = true;

      // Start progress timer 
      this._startProgressTimer(true); // Force immediate update

      // Start event checking
      this._startEventChecking();

      // Check for current phase
      this._checkCurrentPhase();

      // Update stats
      this._updateStats({
        resumed: this._stats.resumed + 1,
        lastOperation: {
          type: 'resume',
          elapsedTime: this._elapsedTime,
          timestamp: Date.now()
        }
      });

      // Emit resumed event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.RESUMED, {
          elapsedTime: this._elapsedTime,
          timestamp: Date.now()
        });
      }

      this.log(`Timeline resumed successfully from ${this._elapsedTime}ms`);
      return true;
    } catch (error) {
      this.log(`Error resuming timeline: ${error.message}`, 'error');

      // Update stats
      this._updateStats({
        errors: this._stats.errors + 1,
        lastOperation: {
          type: 'error',
          action: 'resume',
          message: error.message,
          timestamp: Date.now()
        }
      });

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
   * Reset the timeline state
   * @returns {boolean} Success state
   */
  reset() {
    try {
      // Stop if playing
      if (this._isPlaying) {
        this.stop();
      }

      this.log('Resetting timeline');

      // Reset state
      this._elapsedTime = 0;
      this._startTime = null;
      this._currentPhase = null;
      this._nextEventIndex = 0;

      // Force a progress update to reflect reset
      if (this.onProgress) {
        this.onProgress(0, 0);
      }

      // Emit progress event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.PROGRESS, {
          progress: 0,
          elapsedTime: 0,
          timestamp: Date.now()
        });
      }

      // Update stats
      this._updateStats({
        reset: this._stats.reset + 1,
        lastOperation: {
          type: 'reset',
          timestamp: Date.now()
        }
      });

      // Emit reset event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.RESET, {
          timestamp: Date.now()
        });
      }

      this.log('Timeline reset complete');
      return true;
    } catch (error) {
      this.log(`Error resetting timeline: ${error.message}`, 'error');

      // Update stats
      this._updateStats({
        errors: this._stats.errors + 1,
        lastOperation: {
          type: 'error',
          action: 'reset',
          message: error.message,
          timestamp: Date.now()
        }
      });

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
   * Get the current elapsed time of the session
   * @returns {number} Elapsed time in milliseconds
   */
  getElapsedTime() {
    if (!this._isPlaying) {
      return this._elapsedTime;
    }

    // If playing, calculate based on startTime
    return this._startTime ? Date.now() - this._startTime : 0;
  }

  /**
   * Set the session duration
   * @param {number} duration - Duration in milliseconds
   * @returns {boolean} Success state
   */
  setSessionDuration(duration) {
    try {
      if (isNaN(duration) || duration <= 0) {
        this.log('Invalid session duration', 'error');
        throw new Error('Invalid session duration');
      }

      const oldDuration = this.config.sessionDuration;
      this.log(`Changing session duration from ${oldDuration}ms to ${duration}ms`);
      this.config.sessionDuration = duration;
      this.log(`Session duration set to ${duration}ms`);

      // Check if this affects current phase
      this._checkCurrentPhase();

      // Update stats
      this._updateStats({
        lastOperation: {
          type: 'setSessionDuration',
          oldDuration,
          newDuration: duration,
          timestamp: Date.now()
        }
      });

      // Emit duration changed event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.DURATION_CHANGED, {
          oldDuration,
          newDuration: duration,
          timestamp: Date.now()
        });
      }

      return true;
    } catch (error) {
      this.log(`Error setting session duration: ${error.message}`, 'error');

      // Update stats
      this._updateStats({
        errors: this._stats.errors + 1,
        lastOperation: {
          type: 'error',
          action: 'setSessionDuration',
          message: error.message,
          timestamp: Date.now()
        }
      });

      // Emit error event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.ERROR, {
          operation: 'setSessionDuration',
          message: error.message,
          timestamp: Date.now()
        });
      }

      return false;
    }
  }

  /**
   * Set the default transition duration
   * @param {number} duration - Duration in milliseconds
   * @returns {boolean} Success state
   */
  setTransitionDuration(duration) {
    try {
      if (isNaN(duration) || duration < 0) {
        this.log('Invalid transition duration', 'error');
        throw new Error('Invalid transition duration');
      }

      const oldDuration = this.config.transitionDuration;
      this.config.transitionDuration = duration;
      this.log(`Transition duration set to ${duration}ms`);

      // Update stats
      this._updateStats({
        lastOperation: {
          type: 'setTransitionDuration',
          oldDuration,
          newDuration: duration,
          timestamp: Date.now()
        }
      });

      // Emit transition duration changed event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.TRANSITION_CHANGED, {
          oldDuration,
          newDuration: duration,
          timestamp: Date.now()
        });
      }

      return true;
    } catch (error) {
      this.log(`Error setting transition duration: ${error.message}`, 'error');

      // Update stats
      this._updateStats({
        errors: this._stats.errors + 1,
        lastOperation: {
          type: 'error',
          action: 'setTransitionDuration',
          message: error.message,
          timestamp: Date.now()
        }
      });

      // Emit error event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.ERROR, {
          operation: 'setTransitionDuration',
          message: error.message,
          timestamp: Date.now()
        });
      }

      return false;
    }
  }

  /**
   * Get the current timeline progress as a percentage
   * @returns {number} Progress from 0-100
   */
  getProgress() {
    const elapsedTime = this.getElapsedTime();
    return Math.min(100, (elapsedTime / this.config.sessionDuration) * 100);
  }

  /**
   * Replace all timeline phases
   * @param {Array} phases - Array of phase objects
   * @returns {boolean} Success state
   */
  setPhases(phases) {
    try {
      if (!Array.isArray(phases)) {
        this.log('Invalid phases data (not an array)', 'error');
        throw new Error('Invalid phases data (not an array)');
      }

      // Basic validation
      const validPhases = phases.filter(phase =>
        phase &&
        typeof phase.id === 'string' &&
        typeof phase.position === 'number' &&
        phase.position >= 0 &&
        phase.position <= 100
      );

      if (validPhases.length === 0) {
        this.log('No valid phases found', 'error');
        throw new Error('No valid phases found');
      }

      // Sort phases by position
      const sortedPhases = [...validPhases].sort((a, b) => a.position - b.position);

      // Ensure the first phase is at position 0
      if (sortedPhases[0].position !== 0) {
        this.log('First phase must be at position 0, adjusting', 'warn');
        sortedPhases[0].position = 0;
      }

      // Update phases
      this._phases = sortedPhases;
      this.log(`Set ${this._phases.length} timeline phases`);

      // Check if this affects current phase
      this._checkCurrentPhase();

      // Update stats
      this._updateStats({
        lastOperation: {
          type: 'setPhases',
          phasesCount: sortedPhases.length,
          timestamp: Date.now()
        }
      });

      // Emit phases updated event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.PHASES_UPDATED, {
          phases: sortedPhases,
          count: sortedPhases.length,
          timestamp: Date.now()
        });
      }

      return true;
    } catch (error) {
      this.log(`Error setting phases: ${error.message}`, 'error');

      // Update stats
      this._updateStats({
        errors: this._stats.errors + 1,
        lastOperation: {
          type: 'error',
          action: 'setPhases',
          message: error.message,
          timestamp: Date.now()
        }
      });

      // Emit error event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.ERROR, {
          operation: 'setPhases',
          message: error.message,
          timestamp: Date.now()
        });
      }

      return false;
    }
  }

  /**
   * Get all timeline phases
   * @returns {Array} Array of phase objects
   */
  getPhases() {
    return [...this._phases];
  }

  /**
   * Get the current active phase
   * @returns {Object|null} Current phase or null if none active
   */
  getCurrentPhase() {
    return this._currentPhase;
  }

  /**
   * Add a scheduled event to the timeline
   * @param {Object} event - Event object
   * @param {string} event.id - Unique event identifier
   * @param {number} event.time - Time in ms when event should trigger
   * @param {string} event.action - Action type
   * @param {Object} event.data - Event data
   * @returns {boolean} Success state
   */
  addEvent(event) {
    try {
      if (!event || !event.id || typeof event.time !== 'number' || !event.action) {
        this.log('Invalid event data', 'error');
        throw new Error('Invalid event data');
      }

      // Check for duplicate ID
      if (this._events.some(e => e.id === event.id)) {
        this.log(`Event with ID ${event.id} already exists`, 'warn');
        throw new Error(`Event with ID ${event.id} already exists`);
      }

      // Add event and sort by time
      this._events.push(event);
      this._events.sort((a, b) => a.time - b.time);

      // Reset next event index if currently playing
      if (this._isPlaying) {
        this._nextEventIndex = this._findNextEventIndex();
      }

      this.log(`Added event: ${event.id} at ${event.time}ms (${event.action})`);

      // Update stats
      this._updateStats({
        lastOperation: {
          type: 'addEvent',
          eventId: event.id,
          timestamp: Date.now()
        }
      });

      // Emit event registered event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.EVENT_REGISTERED, {
          event: {
            id: event.id,
            time: event.time,
            action: event.action
          },
          eventsCount: this._events.length,
          timestamp: Date.now()
        });
      }

      return true;
    } catch (error) {
      this.log(`Error adding event: ${error.message}`, 'error');

      // Update stats
      this._updateStats({
        errors: this._stats.errors + 1,
        lastOperation: {
          type: 'error',
          action: 'addEvent',
          message: error.message,
          timestamp: Date.now()
        }
      });

      // Emit error event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.ERROR, {
          operation: 'addEvent',
          message: error.message,
          timestamp: Date.now()
        });
      }

      return false;
    }
  }

  /**
   * Remove an event by ID
   * @param {string} eventId - Event ID to remove
   * @returns {boolean} Success state
   */
  removeEvent(eventId) {
    try {
      const initialCount = this._events.length;
      this._events = this._events.filter(e => e.id !== eventId);

      // Check if anything was removed
      if (this._events.length === initialCount) {
        this.log(`No event found with ID ${eventId}`, 'warn');
        return false;
      }

      // Reset next event index if currently playing
      if (this._isPlaying) {
        this._nextEventIndex = this._findNextEventIndex();
      }

      this.log(`Removed event: ${eventId}`);

      // Update stats
      this._updateStats({
        lastOperation: {
          type: 'removeEvent',
          eventId,
          timestamp: Date.now()
        }
      });

      // Emit event removed via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit('timeline:eventRemoved', {
          eventId,
          eventsCount: this._events.length,
          timestamp: Date.now()
        });
      }

      return true;
    } catch (error) {
      this.log(`Error removing event: ${error.message}`, 'error');

      // Update stats
      this._updateStats({
        errors: this._stats.errors + 1,
        lastOperation: {
          type: 'error',
          action: 'removeEvent',
          message: error.message,
          timestamp: Date.now()
        }
      });

      // Emit error event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.ERROR, {
          operation: 'removeEvent',
          message: error.message,
          timestamp: Date.now()
        });
      }

      return false;
    }
  }

  /**
   * Clear all scheduled events
   * @returns {boolean} Success state
   */
  clearEvents() {
    try {
      const initialCount = this._events.length;
      this._events = [];
      this._nextEventIndex = 0;

      this.log(`Cleared ${initialCount} events from timeline`);

      // Update stats
      this._updateStats({
        lastOperation: {
          type: 'clearEvents',
          clearedCount: initialCount,
          timestamp: Date.now()
        }
      });

      // Emit events cleared event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.EVENTS_CLEARED, {
          count: initialCount,
          timestamp: Date.now()
        });
      }

      return true;
    } catch (error) {
      this.log(`Error clearing events: ${error.message}`, 'error');

      // Update stats
      this._updateStats({
        errors: this._stats.errors + 1,
        lastOperation: {
          type: 'error',
          action: 'clearEvents',
          message: error.message,
          timestamp: Date.now()
        }
      });

      // Emit error event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.ERROR, {
          operation: 'clearEvents',
          message: error.message,
          timestamp: Date.now()
        });
      }

      return false;
    }
  }

  /**
   * Get all scheduled events
   * @returns {Array} Array of event objects
   */
  getEvents() {
    return [...this._events];
  }

  /**
   * Seek to a specific time in the timeline
   * @param {number} timeMs - Time to seek to in milliseconds
   * @returns {boolean} Success state
   */
  seekTo(timeMs) {
    try {
      if (isNaN(timeMs) || timeMs < 0) {
        this.log('Invalid seek time', 'error');
        throw new Error('Invalid seek time');
      }

      // Clamp to session duration
      const clampedTime = Math.min(timeMs, this.config.sessionDuration);

      this.log(`Seeking to ${clampedTime}ms`);

      // Update elapsed time
      this._elapsedTime = clampedTime;

      // If playing, update start time to maintain correct timing
      if (this._isPlaying) {
        this._startTime = Date.now() - this._elapsedTime;
      }

      // Update next event index
      this._nextEventIndex = this._findNextEventIndex();

      // Check for phase change
      this._checkCurrentPhase();

      // Trigger progress update
      if (this.onProgress) {
        const progress = (this._elapsedTime / this.config.sessionDuration) * 100;
        this.onProgress(progress, this._elapsedTime);
      }

      // Emit progress event via EventBus
      if (this.config.enableEventBus) {
        const progress = (this._elapsedTime / this.config.sessionDuration) * 100;
        eventBus.emit(TIMELINE_EVENTS.PROGRESS, {
          progress,
          elapsedTime: this._elapsedTime,
          timestamp: Date.now()
        });
      }

      // Update stats
      this._updateStats({
        seekOperations: this._stats.seekOperations + 1,
        lastOperation: {
          type: 'seekTo',
          timeMs: clampedTime,
          timestamp: Date.now()
        }
      });

      // Emit seek event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.SEEK, {
          timeMs: clampedTime,
          progress: (clampedTime / this.config.sessionDuration) * 100,
          timestamp: Date.now()
        });
      }

      return true;
    } catch (error) {
      this.log(`Error seeking: ${error.message}`, 'error');

      // Update stats
      this._updateStats({
        errors: this._stats.errors + 1,
        lastOperation: {
          type: 'error',
          action: 'seekTo',
          message: error.message,
          timestamp: Date.now()
        }
      });

      // Emit error event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.ERROR, {
          operation: 'seekTo',
          message: error.message,
          timestamp: Date.now()
        });
      }

      return false;
    }
  }

  /**
   * Seek to a percentage of the total session duration
   * @param {number} percent - Percentage to seek to (0-100)
   * @returns {boolean} Success state
   */
  seekToPercent(percent) {
    try {
      if (isNaN(percent) || percent < 0 || percent > 100) {
        this.log('Invalid seek percentage', 'error');
        throw new Error('Invalid seek percentage');
      }

      const timeMs = Math.floor((percent / 100) * this.config.sessionDuration);
      this.log(`Seeking to ${percent}% (${timeMs}ms)`);

      return this.seekTo(timeMs);
    } catch (error) {
      this.log(`Error seeking to percent: ${error.message}`, 'error');

      // Update stats
      this._updateStats({
        errors: this._stats.errors + 1,
        lastOperation: {
          type: 'error',
          action: 'seekToPercent',
          message: error.message,
          timestamp: Date.now()
        }
      });

      // Emit error event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.ERROR, {
          operation: 'seekToPercent',
          message: error.message,
          timestamp: Date.now()
        });
      }

      return false;
    }
  }

  /**
   * Get service statistics
   * @returns {Object} Stats object
   */
  getStats() {
    return { ...this._stats };
  }

  /**
   * Update service statistics
   * @param {Object} updates - Fields to update
   * @private
   */
  _updateStats(updates) {
    this._stats = {
      ...this._stats,
      ...updates
    };
  }

  /**
   * Start the progress timer to track timeline position
   * @param {boolean} [immediate=false] - Whether to trigger an update immediately
   * @private
   */
  _startProgressTimer(immediate = false) {
    // Clear any existing timer
    this._stopProgressTimer();

    // Optionally trigger an immediate update
    if (immediate) {
      this._updateProgress();
    }

    // Set interval for regular updates
    this._progressTimer = setInterval(() => {
      this._updateProgress();
    }, 100); // Update every 100ms
  }

  /**
   * Stop the progress timer
   * @private
   */
  _stopProgressTimer() {
    if (this._progressTimer) {
      clearInterval(this._progressTimer);
      this._progressTimer = null;
    }
  }

  /**
   * Update the current progress
   * @private
   */
  _updateProgress() {
    if (!this._isPlaying) return;

    // Calculate elapsed time
    const now = Date.now();
    this._elapsedTime = now - this._startTime;

    // Calculate progress percentage
    const progress = (this._elapsedTime / this.config.sessionDuration) * 100;

    // Call progress callback
    if (this.onProgress) {
      this.onProgress(Math.min(100, progress), this._elapsedTime);
    }

    // Emit progress event via EventBus
    if (this.config.enableEventBus) {
      eventBus.emit(TIMELINE_EVENTS.PROGRESS, {
        progress: Math.min(100, progress),
        elapsedTime: this._elapsedTime,
        timestamp: now
      });
    }

    // Check if we've reached the end of the timeline
    if (this._elapsedTime >= this.config.sessionDuration) {
      this.log('Timeline completed');
      this.stop();

      // Emit timeline completed event
      if (this.config.enableEventBus) {
        eventBus.emit('timeline:completed', {
          duration: this.config.sessionDuration,
          timestamp: now
        });
      }
    }
  }

  /**
   * Start the event checking timer
   * @private
   */
  _startEventChecking() {
    // Clear any existing timer
    this._stopEventChecking();

    // Set the current event index
    this._nextEventIndex = this._findNextEventIndex();

    // Set interval for checking events
    this._eventCheckTimer = setInterval(() => {
      this._checkEvents();
    }, 100); // Check every 100ms
  }

  /**
   * Stop the event checking timer
   * @private
   */
  _stopEventChecking() {
    if (this._eventCheckTimer) {
      clearInterval(this._eventCheckTimer);
      this._eventCheckTimer = null;
    }
  }

  /**
   * Check if any events should be triggered
   * @private
   */
  _checkEvents() {
    if (!this._isPlaying || this._events.length === 0) return;

    const currentTime = this.getElapsedTime();

    // Check events from nextEventIndex onwards
    while (
      this._nextEventIndex < this._events.length &&
      this._events[this._nextEventIndex].time <= currentTime
    ) {
      const event = this._events[this._nextEventIndex];
      this._nextEventIndex++;

      this.log(`Triggering event: ${event.id} at ${event.time}ms`);

      // Call event handler
      if (this.onScheduledEvent) {
        this.onScheduledEvent(event);
      }

      // Emit event triggered via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.EVENT_TRIGGERED, {
          event: {
            id: event.id,
            time: event.time,
            action: event.action,
            data: event.data
          },
          timestamp: Date.now()
        });
      }

      // Update stats
      this._updateStats({
        eventsTriggered: this._stats.eventsTriggered + 1,
        lastOperation: {
          type: 'eventTriggered',
          eventId: event.id,
          timestamp: Date.now()
        }
      });
    }
  }

  /**
   * Find the next event index based on current time
   * @returns {number} Next event index
   * @private
   */
  _findNextEventIndex() {
    const currentTime = this.getElapsedTime();

    // Find the first event that occurs after the current time
    const index = this._events.findIndex(event => event.time > currentTime);

    // Return the found index, or events.length if all events have already occurred
    return index >= 0 ? index : this._events.length;
  }

  /**
   * Check the current phase based on elapsed time
   * @private
   */
  _checkCurrentPhase() {
    if (this._phases.length === 0) return;

    const currentProgress = (this.getElapsedTime() / this.config.sessionDuration) * 100;
    let newPhase = null;

    // Find the last phase whose position is <= current progress
    for (let i = this._phases.length - 1; i >= 0; i--) {
      if (this._phases[i].position <= currentProgress) {
        newPhase = this._phases[i];
        break;
      }
    }

    // If no phase found, use the first phase
    if (!newPhase) {
      newPhase = this._phases[0];
    }

    // Check if phase has changed
    if (!this._currentPhase || this._currentPhase.id !== newPhase.id) {
      const previousPhase = this._currentPhase;
      this._currentPhase = newPhase;

      this.log(`Phase changed to: ${newPhase.id}`);

      // Call phase change handler
      if (this.onPhaseChange) {
        this.onPhaseChange(newPhase.id, { ...newPhase });
      }

      // Update stats
      this._updateStats({
        phaseChanges: this._stats.phaseChanges + 1,
        lastOperation: {
          type: 'phaseChanged',
          fromPhase: previousPhase ? previousPhase.id : null,
          toPhase: newPhase.id,
          timestamp: Date.now()
        }
      });

      // Emit phase changed event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit(TIMELINE_EVENTS.PHASE_CHANGED, {
          phaseId: newPhase.id,
          phaseData: { ...newPhase },
          previousPhaseId: previousPhase ? previousPhase.id : null,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Handle volume changes during phase transitions
   * This logic is removed from the TimelineService to be handled by application code
   * Only log a message to indicate this should be implemented externally
   */
  _handlePhaseVolumeChanges() {
    this.log('Volume changes during phase transitions should be implemented externally', 'info');
  }

  /**
   * Logging helper that respects configuration
   * @param {string} message - Message to log
   * @param {string} [level='info'] - Log level
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

  /**
* Dispose of resources used by the timeline service
* Clean up any timers and reset state
*/
  dispose() {
    try {
      // Stop if currently playing
      if (this._isPlaying) {
        this.stop();
      }

      // Stop all timers
      this._stopProgressTimer();
      this._stopEventChecking();

      // Reset state
      this._isPlaying = false;
      this._startTime = null;
      this._elapsedTime = 0;
      this._nextEventIndex = 0;

      // Log cleanup
      this.log('TimelineService disposed');

      // Emit disposed event via EventBus
      if (this.config.enableEventBus) {
        eventBus.emit('timeline:disposed', {
          timestamp: Date.now()
        });
      }
    } catch (error) {
      this.log(`Error during disposal: ${error.message}`, 'error');

      // Final attempt to clean up timers
      try {
        if (this._progressTimer) clearInterval(this._progressTimer);
        if (this._eventCheckTimer) clearInterval(this._eventCheckTimer);
      } catch (e) {
        // Swallow any errors in last-ditch cleanup
      }
    }
  }

  /**
   * Alias for dispose for API consistency with other services
   */
  cleanup() {
    this.dispose();
  }

  /**
   * Check if the timeline is currently playing
   * @returns {boolean} Playing state
   */
  isTimelinePlaying() {
    return this._isPlaying;
  }

  /**
   * Get the service configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }
}

export default TimelineService;
