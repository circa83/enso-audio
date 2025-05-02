/**
 * TimelineEngine.js
 * 
 * Service for managing audio session timeline functionality
 * Handles session timing, phase transitions, event scheduling,
 * and coordinates audio changes based on timeline position
 */
import logger from '../../services/LoggingService';

class TimelineEngine {
  /**
   * Create a new TimelineEngine instance
   * @param {Object} options - Configuration options
   * @param {Function} options.onPhaseChange - Callback triggered when active phase changes: (phaseId, phaseData) => void
   * @param {Function} options.onScheduledEvent - Callback triggered when a scheduled event occurs: (event) => void
   * @param {Function} options.onProgress - Callback for timeline progress updates: (progress, time) => void
   * @param {Object} [options.defaultPhases] - Initial phase configuration
   * @param {number} [options.sessionDuration=60000] - Total session duration in ms (default: 1 hour)
   * @param {number} [options.transitionDuration=4000] - Default phase transition duration in ms (default: 4 seconds)
   * @param {boolean} [options.enableLogging=false] - Enable detailed console logging
   */
  constructor(options = {}) {
    // Validation
    if (!options.onPhaseChange) {
      throw new Error('TimelineEngine requires an onPhaseChange callback');
    }

    if (!options.onScheduledEvent) {
      throw new Error('TimelineEngine requires an onScheduledEvent callback');
    }

    // Configuration
    this.config = {
      sessionDuration: options.sessionDuration || 3600000, // 1 hour default
      transitionDuration: options.transitionDuration || 4000, // 4 second default
      enableLogging: options.enableLogging || false
    };

    // Callbacks
    this.onPhaseChange = options.onPhaseChange;
    this.onScheduledEvent = options.onScheduledEvent;
    this.onProgress = options.onProgress || (() => { });

    // Session state
    this.startTime = null;
    this.elapsedTime = 0;
    this.isPlaying = false;

    // Timeline data
    this.phases = [];
    this.events = [];
    this.currentPhase = null;
    this.nextEventIndex = 0;

    // Initialize with default phases if provided
    if (options.defaultPhases && Array.isArray(options.defaultPhases)) {
      this.setPhases(options.defaultPhases);
    } else {
      this.initializeDefaultPhases();
    }

    // Timers
    this.progressTimer = null;
    this.eventCheckTimer = null;

    this.logInfo('TimelineEngine initialized');
  }

  /**
   * Initialize default phases if none provided
   * @private
   */
  initializeDefaultPhases() {
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
    this.logInfo('Default phases initialized');
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

      this.logInfo('Starting timeline. Reset=' + reset);

      // Reset elapsed time if requested
      if (reset) {
        this.logInfo('Performing full timeline reset before starting');
        // Stop any existing timers
        this.stopProgressTimer();
        this.stopEventChecking();
        this.elapsedTime = 0;
        this.nextEventIndex = 0;
        // Ensure we trigger initial progress updates
        if (this.onProgress) {
          this.onProgress(0, 0);
        }

        this.logInfo('Timeline reset to beginning');
      }

      // Set start time based on current elapsed time
      this.startTime = Date.now() - this.elapsedTime;
      this.isPlaying = true;

      // Start progress timer
      this.startProgressTimer(true); // Added parameter for immediate update

      // Start event checking
      this.startEventChecking();

      // Check for initial phase
      this.checkCurrentPhase();

      this.logInfo(`Timeline started successfully. Current elapsed time: ${this.elapsedTime}ms`);
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
        this.logInfo(`Elapsed time updated to ${this.elapsedTime}ms`);
      }

      this.isPlaying = false;
      this.startTime = null;

      // Stop timers
      this.stopProgressTimer();
      this.stopEventChecking();

      this.logInfo('Timeline stopped successfully');
      return true;
    } catch (error) {
      this.logError(`Error stopping timeline: ${error.message}`);
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
        this.logInfo('Timeline already paused');
        return true;
      }

      this.logInfo('Pausing timeline (preserving position)');

      // Update elapsed time before pausing
      if (this.startTime) {
        this.elapsedTime = Date.now() - this.startTime;
        this.logInfo(`Elapsed time updated to ${this.elapsedTime}ms`);
      }

      this.isPlaying = false;
      this.startTime = null;

      // Stop timers
      this.stopProgressTimer();
      this.stopEventChecking();

      this.logInfo('Timeline paused successfully');
      return true;
    } catch (error) {
      this.logError(`Error pausing timeline: ${error.message}`);
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
        this.logInfo('Timeline already playing');
        return true;
      }


      this.logInfo(`Resuming timeline from ${this.elapsedTime}ms`);

      // Set start time based on current elapsed time to ensure continuity
      this.startTime = Date.now() - this.elapsedTime;
      this.isPlaying = true;

      // Start progress timer 
      this.startProgressTimer(true); // Force immediate update

      // Start event checking
      this.startEventChecking();

      // Check for current phase
      this.checkCurrentPhase();

      this.logInfo(`Timeline resumed successfully from ${this.elapsedTime}ms`);
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
      this.currentPhase = null;
      this.nextEventIndex = 0;

      // Force a progress update to reflect reset
      if (this.onProgress) {
        this.onProgress(0, 0);
      }

      this.logInfo('Timeline reset complete');
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
      this.logError('Invalid session duration');
      return false;
    }
    this.logInfo(`Changing session duration from ${this.config.sessionDuration}ms to ${duration}ms`);
    this.config.sessionDuration = duration;
    this.logInfo(`Session duration set to ${duration}ms`);

    // Check if this affects current phase
    this.checkCurrentPhase();

    return true;
  }

  /**
   * Set the default transition duration
   * @param {number} duration - Duration in milliseconds
   * @returns {boolean} Success state
   */
  setTransitionDuration(duration) {
    if (isNaN(duration) || duration < 0) {
      this.logError('Invalid transition duration');
      return false;
    }

    this.config.transitionDuration = duration;
    this.logInfo(`Transition duration set to ${duration}ms`);
    return true;
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
    if (!Array.isArray(phases)) {
      this.logError('Invalid phases data (not an array)');
      return false;
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
      this.logError('No valid phases found');
      return false;
    }

    // Sort phases by position
    const sortedPhases = [...validPhases].sort((a, b) => a.position - b.position);

    // Ensure the first phase is at position 0
    if (sortedPhases[0].position !== 0) {
      this.logWarn('First phase must be at position 0, adjusting');
      sortedPhases[0].position = 0;
    }

    // Update phases
    this.phases = sortedPhases;
    this.logInfo(`Set ${this.phases.length} timeline phases`);

    // Check if this affects current phase
    this.checkCurrentPhase();

    return true;
  }

  /**
   * Update a single phase
   * @param {string} phaseId - ID of the phase to update
   * @param {Object} updates - Properties to update
   * @returns {boolean} Success state
   */
  updatePhase(phaseId, updates) {
    const phaseIndex = this.phases.findIndex(p => p.id === phaseId);

    if (phaseIndex === -1) {
      this.logError(`Phase ${phaseId} not found`);
      return false;
    }

    // Create updated phase
    const updatedPhase = {
      ...this.phases[phaseIndex],
      ...updates
    };

    // Ensure position stays between bounds (previous phase + 1% and next phase - 1%)
    if (updates.position !== undefined) {
      let minPosition = 0;
      let maxPosition = 100;

      if (phaseIndex > 0) {
        minPosition = this.phases[phaseIndex - 1].position + 1;
      }

      if (phaseIndex < this.phases.length - 1) {
        maxPosition = this.phases[phaseIndex + 1].position - 1;
      }

      updatedPhase.position = Math.max(minPosition, Math.min(maxPosition, updatedPhase.position));
    }

    // Update the phase
    const newPhases = [...this.phases];
    newPhases[phaseIndex] = updatedPhase;

    // Sort phases by position
    const sortedPhases = newPhases.sort((a, b) => a.position - b.position);

    // Update phases
    this.phases = sortedPhases;
    this.logDebug(`Updated phase ${phaseId}`);

    // Check if this affects current phase
    this.checkCurrentPhase();

    return true;
  }

  /**
   * Set the state data for a specific phase
   * @param {string} phaseId - ID of the phase
   * @param {Object} state - State data to save
   * @returns {boolean} Success state
   */
  setPhaseState(phaseId, state) {
    const phaseIndex = this.phases.findIndex(p => p.id === phaseId);

    if (phaseIndex === -1) {
      this.logError(`Phase ${phaseId} not found`);
      return false;
    }

    // Update the state
    this.phases[phaseIndex].state = state;
    this.logDebug(`Set state for phase ${phaseId}`);

    // If this is the current phase, trigger the callback
    if (this.currentPhase && this.currentPhase.id === phaseId) {
      this.logInfo(`Updating current phase (${phaseId}) state`);
      this.onPhaseChange(phaseId, state);
    }

    return true;
  }

  /**
   * Get all timeline phases
   * @returns {Array} Array of phase objects
   */
  getPhases() {
    return [...this.phases];
  }

  /**
   * Get a specific phase by ID
   * @param {string} phaseId - ID of the phase to retrieve
   * @returns {Object|null} Phase object or null if not found
   */
  getPhase(phaseId) {
    return this.phases.find(p => p.id === phaseId) || null;
  }

  /**
   * Set scheduled events for the timeline
   * @param {Array} events - Array of event objects
   * @returns {boolean} Success state
   */
  setEvents(events) {
    if (!Array.isArray(events)) {
      this.logError('Invalid events data (not an array)');
      return false;
    }

    // Basic validation
    const validEvents = events.filter(event =>
      event &&
      typeof event.id === 'string' &&
      (typeof event.time === 'number' || typeof event.position === 'number')
    );

    // Convert position-based events to time-based
    const processedEvents = validEvents.map(event => {
      if (typeof event.position === 'number' && typeof event.time !== 'number') {
        const eventTime = (event.position / 100) * this.config.sessionDuration;
        return { ...event, time: eventTime };
      }
      return event;
    });

    // Sort by time
    const sortedEvents = [...processedEvents].sort((a, b) => a.time - b.time);

    // Update events
    this.events = sortedEvents;
    this.nextEventIndex = 0; // Reset event index
    this.logInfo(`Set ${this.events.length} timeline events`);

    return true;
  }

  /**
   * Add a single event to the timeline
   * @param {Object} event - Event object
   * @returns {boolean} Success state
   */
  addEvent(event) {
    if (!event || typeof event.id !== 'string') {
      this.logError('Invalid event data');
      return false;
    }

    // Process position if provided
    let processedEvent = { ...event };
    if (typeof event.position === 'number' && typeof event.time !== 'number') {
      const eventTime = (event.position / 100) * this.config.sessionDuration;
      processedEvent.time = eventTime;
    }

    // Add the event
    this.events.push(processedEvent);

    // Sort by time
    this.events.sort((a, b) => a.time - b.time);

    // Reset event index if the added event comes before the next event
    if (this.nextEventIndex < this.events.length &&
      processedEvent.time < this.events[this.nextEventIndex].time) {
      this.nextEventIndex = Math.max(0, this.events.findIndex(e => e.id === processedEvent.id));
    }

    this.logInfo(`Added event: ${event.id}`);
    return true;
  }

  /**
   * Remove an event from the timeline
   * @param {string} eventId - ID of the event to remove
   * @returns {boolean} Success state
   */
  removeEvent(eventId) {
    const initialLength = this.events.length;
    this.events = this.events.filter(e => e.id !== eventId);

    if (this.events.length === initialLength) {
      this.logWarn(`Event ${eventId} not found`);
      return false;
    }

    // Reset event index to be safe
    this.nextEventIndex = 0;

    this.logInfo(`Removed event: ${eventId}`);
    return true;
  }

  /**
   * Get all timeline events
   * @returns {Array} Array of event objects
   */
  getEvents() {
    return [...this.events];
  }

  /**
   * Manual check for the current phase based on the current time
   * Returns the active phase based on position
   * @returns {Object|null} The current phase or null
   */
  checkCurrentPhase() {
    if (this.phases.length === 0) {
      return null;
    }

    const currentProgress = this.getProgress();
    const currentTimeMs = this.getElapsedTime();

    this.logDebug(`Checking current phase at progress ${currentProgress.toFixed(2)}% (${currentTimeMs}ms)`);

    // This assumes phases are sorted by position (which they should be)
    let activePhaseIndex = 0;

    // Find the appropriate phase for the current position
    for (let i = this.phases.length - 1; i >= 0; i--) {
      if (currentProgress >= this.phases[i].position) {
        activePhaseIndex = i;
        break;
      }
    }

    const newActivePhase = this.phases[activePhaseIndex];

    // Check if the phase has changed
    if (!this.currentPhase || this.currentPhase.id !== newActivePhase.id) {
      this.logInfo(`Phase changed to ${newActivePhase.id} at progress ${currentProgress.toFixed(2)}%`);
      this.currentPhase = newActivePhase;
      // Notify listeners
      this.onPhaseChange(this.currentPhase.id, this.currentPhase.state);
    } else {
      this.logDebug(`Still in phase ${this.currentPhase.id}`);
    }

    return this.currentPhase;
  }

  /**
   * Get the current active phase
   * @returns {Object|null} The current phase or null
   */
  getCurrentPhase() {
    return this.currentPhase;
  }

  /**
   * Check for events that should trigger based on current time
   * @private
   */
  checkEvents() {
    if (!this.isPlaying || this.events.length === 0) {
      return;
    }

    const currentTime = this.getElapsedTime();

    // Check for events from next index to the end
    for (let i = this.nextEventIndex; i < this.events.length; i++) {
      const event = this.events[i];

      // If the current time has passed the event time, trigger it
      if (currentTime >= event.time) {
        this.logInfo(`Triggering event: ${event.id} at ${currentTime}ms`);
        // Update the next index for next check
        this.nextEventIndex = i + 1;
        // Notify listeners
        this.onScheduledEvent(event);
      } else {
        // No need to check events that come later
        break;
      }
    }
  }

  /**
   * Update the play timer and trigger progress callbacks
   * @param {boolean} [forceUpdate=false] - Force an immediate update
   * @private
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
    
    if (!this.isPlaying) {
      return;
    }

    // Calculate current time and progress
    const currentTime = this.getElapsedTime();
    const progress = this.getProgress();

    // Trigger the callback
    if (this.onProgress) {
      this.onProgress(progress, currentTime);
    }

    // Check if we've reached the end of the session
    if (progress >= 100) {
      this.logInfo('Session completed (100% progress reached)');
      this.stop();
    }
  }

  /**
   * Start the progress timer
   * @param {boolean} [immediate=false] - Whether to trigger an immediate update
   * @private
   */
  startProgressTimer(immediate = false) {
    this.stopProgressTimer(); // Clear any existing timer
    
    // Trigger immediate update if requested
    if (immediate) {
      this.updateProgress(true);
    }
    
    // Schedule regular updates
    this.progressTimer = setInterval(() => {
      this.updateProgress();
    }, 250); // Update every 250ms
  }

  /**
   * Stop the progress timer
   * @private
   */
  stopProgressTimer() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  /**
   * Start the event checking timer
   * @private
   */
  startEventChecking() {
    this.stopEventChecking(); // Clear any existing timer
    
    // Schedule regular checks
    this.eventCheckTimer = setInterval(() => {
      this.checkEvents();
    }, 100); // Check every 100ms
    
    // Also check immediately
    this.checkEvents();
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
   * Log a debug message
   * @private
   * @param {string} message - Message to log
   */
  logDebug(message) {
    if (this.config.enableLogging) {
      logger.debug('TimelineEngine', message);
    }
  }
  
  /**
   * Log an info message
   * @private
   * @param {string} message - Message to log
   */
  logInfo(message) {
    if (this.config.enableLogging) {
      logger.info('TimelineEngine', message);
    }
  }
  
  /**
   * Log a warning message
   * @private
   * @param {string} message - Message to log
   */
  logWarn(message) {
    if (this.config.enableLogging) {
      logger.warn('TimelineEngine', message);
    }
  }
  
  /**
   * Log an error message
   * @private
   * @param {string} message - Message to log
   */
  logError(message) {
    if (this.config.enableLogging) {
      logger.error('TimelineEngine', message);
    }
  }

  /**
   * Dispose and clean up resources
   */
  dispose() {
    this.logInfo('Disposing TimelineEngine');
    this.stop();
    this.phases = [];
    this.events = [];
    this.currentPhase = null;
    this.logInfo('TimelineEngine disposed');
  }
}

export default TimelineEngine;

