/**
 * TimelineService.js
 * 
 * Service for managing audio session timeline functionality
 * Handles session timing, phase transitions, event scheduling,
 * and coordinates audio changes based on timeline position
 */

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
   */
  constructor(options = {}) {
    // Store service dependencies
    this.volumeController = options.volumeController;
    this.crossfadeEngine = options.crossfadeEngine;

    // Configuration
    this.config = {
      sessionDuration: options.sessionDuration || 3600000, // 1 hour default
      transitionDuration: options.transitionDuration || 4000, // 4 second default
      enableLogging: options.enableLogging || false
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

    this.log('TimelineService initialized');
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
        // Stop any existing timers
        this.stopProgressTimer();
        this.stopEventChecking();
        this.elapsedTime = 0;
        this.nextEventIndex = 0;

        // Ensure we trigger initial progress updates
        if (this.onProgress) {
          this.onProgress(0, 0);
        }

        this.log('Timeline reset to beginning');
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

      this.log(`Timeline started successfully. Current elapsed time: ${this.elapsedTime}ms`);
      return true;
    } catch (error) {
      this.log(`Error starting timeline: ${error.message}`, 'error');
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
        this.log('Timeline already stopped', 'info');
        return true;
      }

      this.log('Stopping timeline');

      // Update elapsed time before stopping
      if (this.startTime) {
        this.elapsedTime = Date.now() - this.startTime;
        this.log(`Elapsed time updated to ${this.elapsedTime}ms`);
      }

      this.isPlaying = false;
      this.startTime = null;

      // Stop timers
      this.stopProgressTimer();
      this.stopEventChecking();

      this.log('Timeline stopped successfully');
      return true;
    } catch (error) {
      this.log(`Error stopping timeline: ${error.message}`, 'error');
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

      // Update elapsed time before pausing
      if (this.startTime) {
        this.elapsedTime = Date.now() - this.startTime;
        this.log(`Elapsed time updated to ${this.elapsedTime}ms`);
      }

      this.isPlaying = false;
      this.startTime = null;

      // Stop timers
      this.stopProgressTimer();
      this.stopEventChecking();

      this.log('Timeline paused successfully');
      return true;
    } catch (error) {
      this.log(`Error pausing timeline: ${error.message}`, 'error');
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

      this.log(`Resuming timeline from ${this.elapsedTime}ms`);

      // Set start time based on current elapsed time to ensure continuity
      this.startTime = Date.now() - this.elapsedTime;
      this.isPlaying = true;

      // Start progress timer 
      this.startProgressTimer(true); // Force immediate update

      // Start event checking
      this.startEventChecking();

      // Check for current phase
      this.checkCurrentPhase();

      this.log(`Timeline resumed successfully from ${this.elapsedTime}ms`);
      return true;
    } catch (error) {
      this.log(`Error resuming timeline: ${error.message}`, 'error');
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

      this.log('Resetting timeline');

      // Reset state
      this.elapsedTime = 0;
      this.startTime = null;
      this.currentPhase = null;
      this.nextEventIndex = 0;

      // Force a progress update to reflect reset
      if (this.onProgress) {
        this.onProgress(0, 0);
      }

      this.log('Timeline reset complete');
      return true;
    } catch (error) {
      this.log(`Error resetting timeline: ${error.message}`, 'error');
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
      this.log('Invalid session duration', 'error');
      return false;
    }
    this.log(`Changing session duration from ${this.config.sessionDuration}ms to ${duration}ms`);
    this.config.sessionDuration = duration;
    this.log(`Session duration set to ${duration}ms`);

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
      this.log('Invalid transition duration', 'error');
      return false;
    }

    this.config.transitionDuration = duration;
    this.log(`Transition duration set to ${duration}ms`);
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
      this.log('Invalid phases data (not an array)', 'error');
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
      this.log('No valid phases found', 'error');
      return false;
    }

    // Sort phases by position
    const sortedPhases = [...validPhases].sort((a, b) => a.position - b.position);

    // Ensure the first phase is at position 0
    if (sortedPhases[0].position !== 0) {
      this.log('First phase must be at position 0, adjusting', 'warn');
      sortedPhases[0].position = 0;
    }

    // Update phases
    this.phases = sortedPhases;
    this.log(`Set ${this.phases.length} timeline phases`);

    // Check if this affects current phase
    this.checkCurrentPhase();

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
   * Get the current active phase
   * @returns {Object|null} Current phase or null if none active
   */
  getCurrentPhase() {
    return this.currentPhase;
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
    if (!event || !event.id || typeof event.time !== 'number' || !event.action) {
      this.log('Invalid event data', 'error');
      return false;
    }

    // Check for duplicate ID
    if (this.events.some(e => e.id === event.id)) {
      this.log(`Event with ID ${event.id} already exists`, 'warn');
      return false;
    }

    // Add event and sort by time
    this.events.push(event);
    this.events.sort((a, b) => a.time - b.time);

    // Reset next event index if currently playing
    if (this.isPlaying) {
      this.nextEventIndex = this.findNextEventIndex();
    }

    this.log(`Added event: ${event.id} at ${event.time}ms (${event.action})`);
    return true;
  }

  /**
   * Remove an event by ID
   * @param {string} eventId - Event ID to remove
   * @returns {boolean} Success state
   */
  removeEvent(eventId) {
    const initialCount = this.events.length;
    this.events = this.events.filter(e => e.id !== eventId);

    // Check if anything was removed
    if (this.events.length === initialCount) {
      this.log(`No event found with ID ${eventId}`, 'warn');
      return false;
    }

    // Reset next event index if currently playing
    if (this.isPlaying) {
      this.nextEventIndex = this.findNextEventIndex();
    }

    this.log(`Removed event: ${eventId}`);
    return true;
  }

  /**
   * Clear all scheduled events
   * @returns {boolean} Success state
   */
  clearEvents() {
    const count = this.events.length;
    this.events = [];
    this.nextEventIndex = 0;

    this.log(`Cleared ${count} events`);
    return true;
  }

  /**
   * Seek to a specific time in the timeline
   * @param {number} timeMs - Time position in milliseconds
   * @returns {boolean} Success state
   */
  seekTo(timeMs) {
    try {
      if (typeof timeMs !== 'number' || timeMs < 0) {
        this.log('Invalid seek time', 'error');
        return false;
      }

      // Ensure we don't seek past the end
      const safeTime = Math.min(timeMs, this.config.sessionDuration);

      this.log(`Seeking to ${safeTime}ms`);

      // Update elapsed time
      this.elapsedTime = safeTime;

      // If playing, adjust start time to maintain continuity
      if (this.isPlaying) {
        this.startTime = Date.now() - this.elapsedTime;
      }

      // Update next event index
      this.nextEventIndex = this.findNextEventIndex();

      // Check if phase changed
      this.checkCurrentPhase();

      // Force progress update
      if (this.onProgress) {
        const progress = (this.elapsedTime / this.config.sessionDuration) * 100;
        this.onProgress(progress, this.elapsedTime);
      }

      return true;
    } catch (error) {
      this.log(`Error during seek: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Seek to a percentage position in the timeline
   * @param {number} percent - Percentage position (0-100)
   * @returns {boolean} Success state
   */
  seekToPercent(percent) {
    try {
      if (typeof percent !== 'number' || percent < 0 || percent > 100) {
        this.log('Invalid seek percentage', 'error');
        return false;
      }

      // Convert percentage to time
      const timeMs = (percent / 100) * this.config.sessionDuration;

      return this.seekTo(timeMs);
    } catch (error) {
      this.log(`Error during percentage seek: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Find the index of the next event based on current elapsed time
   * @private
   * @returns {number} Index of the next event to trigger
   */
  findNextEventIndex() {
    const currentTime = this.getElapsedTime();

    // Find the first event that hasn't triggered yet
    for (let i = 0; i < this.events.length; i++) {
      if (this.events[i].time > currentTime) {
        return i;
      }
    }

    // If all events have passed
    return this.events.length;
  }

  /**
   * Check and update the current phase based on elapsed time
   * @private
   */
  checkCurrentPhase() {
    if (this.phases.length === 0) {
      this.log('No phases defined, skipping phase check', 'warn');
      return;
    }

    const currentTime = this.getElapsedTime();
    const progress = (currentTime / this.config.sessionDuration) * 100;

    // Find the current phase based on position (percentage)
    let newPhase = null;

    // Start from the end to find the latest phase that's before current progress
    for (let i = this.phases.length - 1; i >= 0; i--) {
      if (this.phases[i].position <= progress) {
        newPhase = this.phases[i];
        break;
      }
    }

    // If no phase found, use first phase
    if (!newPhase && this.phases.length > 0) {
      newPhase = this.phases[0];
    }

    // Check if phase changed
    if (newPhase && (!this.currentPhase || newPhase.id !== this.currentPhase.id)) {
      const previousPhase = this.currentPhase;
      this.currentPhase = newPhase;

      this.log(`Phase changed: ${previousPhase ? previousPhase.id : 'none'} -> ${newPhase.id}`);

      // Trigger phase change callback
      if (this.onPhaseChange) {
        this.onPhaseChange(newPhase.id, newPhase);
      }
    }
  }

  /**
   * Check for events that should be triggered based on current time
   * @private
   */
  checkEvents() {
    if (!this.isPlaying || this.events.length === 0) {
      return;
    }

    const currentTime = this.getElapsedTime();

    // Check all pending events
    while (this.nextEventIndex < this.events.length) {
      const event = this.events[this.nextEventIndex];

      // If the event time is reached, trigger it
      if (event.time <= currentTime) {
        this.log(`Triggering event: ${event.id} (${event.action})`);

        // Call the event handler
        if (this.onScheduledEvent) {
          this.onScheduledEvent(event);
        }

        // Move to next event
        this.nextEventIndex++;
      } else {
        // Future event, stop checking
        break;
      }
    }
  }

  /**
   * Start the progress timer
   * @private
   * @param {boolean} [immediate=false] - Whether to trigger an immediate update
   */
  startProgressTimer(immediate = false) {
    // Clear any existing timer
    this.stopProgressTimer();

    // Set up timer for progress updates (every 100ms = 10 updates per second)
    this.progressTimer = setInterval(() => {
      if (!this.isPlaying) return;

      // Get current progress
      const elapsed = this.getElapsedTime();
      const progress = (elapsed / this.config.sessionDuration) * 100;

      // Trigger progress update
      if (this.onProgress) {
        this.onProgress(progress, elapsed);
      }

      // Check if session complete
      if (elapsed >= this.config.sessionDuration) {
        this.log('Session complete');
        this.stop();
      }
    }, 100);

    // Trigger immediate update if requested
    if (immediate && this.onProgress) {
      const elapsed = this.getElapsedTime();
      const progress = (elapsed / this.config.sessionDuration) * 100;
      this.onProgress(progress, elapsed);
    }
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
    // Clear any existing timer
    this.stopEventChecking();

    // Initialize the next event index
    this.nextEventIndex = this.findNextEventIndex();

    // Set up timer for checking events (every 100ms)
    this.eventCheckTimer = setInterval(() => {
      if (!this.isPlaying) return;

      // Check for events
      this.checkEvents();

      // Check for phase changes
      this.checkCurrentPhase();
    }, 100);
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
   * Clean up resources used by TimelineService
   * This should be called when the service is no longer needed
   */
  dispose() {
    // Stop all timers
    this.stopProgressTimer();
    this.stopEventChecking();

    // Reset state
    this.isPlaying = false;
    this.startTime = null;
    this.elapsedTime = 0;
    this.events = [];
    this.nextEventIndex = 0;

    this.log('TimelineService disposed');
  }

  /**
   * Alias for dispose to maintain API compatibility with other services
   */
  cleanup() {
    this.dispose();
  }
}

export default TimelineService;
