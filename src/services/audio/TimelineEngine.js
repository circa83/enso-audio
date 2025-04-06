/**
 * TimelineEngine.js
 * 
 * Service for managing audio session timeline functionality
 * Handles session timing, phase transitions, event scheduling,
 * and coordinates audio changes based on timeline position
 */

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
      this.onProgress = options.onProgress || (() => {});
      
      // Session state
      this.startTime = null;
      this.elapsedTime = 0;
      this.isPlaying = false;
      this.isEnabled = true;
      
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
      
      this.log('TimelineEngine initialized');
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
        if (!this.isEnabled) {
          this.log('Timeline is disabled, cannot start', 'warn');
          return false;
        }
        
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
        this.startProgressTimer(true); // Added parameter for immediate updat
        
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
     * Enable or disable the timeline
     * @param {boolean} enabled - Whether timeline should be enabled
     * @returns {boolean} New enabled state
     */
    setEnabled(enabled) {
      const wasEnabled = this.isEnabled;
      this.isEnabled = Boolean(enabled);
      
      this.log(`Timeline ${this.isEnabled ? 'enabled' : 'disabled'}`);
      
      // If disabling while playing, stop the timeline
      if (wasEnabled && !this.isEnabled && this.isPlaying) {
        this.stop();
      }
      
      return this.isEnabled;
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
     * Update a single phase
     * @param {string} phaseId - ID of the phase to update
     * @param {Object} updates - Properties to update
     * @returns {boolean} Success state
     */
    updatePhase(phaseId, updates) {
      const phaseIndex = this.phases.findIndex(p => p.id === phaseId);
      
      if (phaseIndex === -1) {
        this.log(`Phase ${phaseId} not found`, 'error');
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
      this.log(`Updated phase ${phaseId}`);
      
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
        this.log(`Phase ${phaseId} not found`, 'error');
        return false;
      }
      
      // Update the phase state
      const newPhases = [...this.phases];
      newPhases[phaseIndex] = {
        ...newPhases[phaseIndex],
        state
      };
      
      this.phases = newPhases;
      this.log(`Updated state for phase ${phaseId}`);
      
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
     * Get the currently active phase
     * @returns {Object|null} Current phase or null
     */
    getCurrentPhase() {
      return this.currentPhase;
    }
    
    /**
     * Find the phase that should be active at a specific progress point
     * @param {number} progress - Progress percentage (0-100)
     * @returns {Object|null} The phase or null if none match
     */
    getPhaseAtProgress(progress) {
      // Sort phases by position in descending order (to find the highest position that's <= progress)
      const sortedPhases = [...this.phases].sort((a, b) => b.position - a.position);
      
      // Find the first phase with position <= progress
      return sortedPhases.find(phase => phase.position <= progress) || null;
    }
    
    //SCHEDULED EVENTS
    /**
     * Add a scheduled event to the timeline
     * @param {Object} event - Event object
     * @param {string} event.id - Unique ID for the event
     * @param {number} event.time - Time in ms when event should trigger
     * @param {string} event.action - Action type (e.g., 'crossfade', 'volume')
     * @param {Object} [event.data] - Data related to the event
     * @returns {boolean} Success state
     */
    addEvent(event) {
      if (!event || !event.id || typeof event.time !== 'number' || !event.action) {
        this.log('Invalid event data', 'error');
        return false;
      }
      
      // Check for duplicate ID
      if (this.events.some(e => e.id === event.id)) {
        this.log(`Event with ID ${event.id} already exists`, 'error');
        return false;
      }
      
      // Add the event
      this.events.push(event);
      
      // Sort events by time
      this.events.sort((a, b) => a.time - b.time);
      
      // Reset next event index if this is earlier than current next event
      if (this.nextEventIndex > 0 && event.time < this.events[this.nextEventIndex].time) {
        this.nextEventIndex = this.events.findIndex(e => e.time > this.getElapsedTime());
        if (this.nextEventIndex === -1) this.nextEventIndex = this.events.length;
      }
      
      this.log(`Added event ${event.id} at ${event.time}ms`);
      return true;
    }
    
    /**
     * Remove a scheduled event from the timeline
     * @param {string} eventId - ID of the event to remove
     * @returns {boolean} Success state
     */
    removeEvent(eventId) {
      const initialLength = this.events.length;
      this.events = this.events.filter(e => e.id !== eventId);
      
      // Check if we removed anything
      if (this.events.length === initialLength) {
        this.log(`Event ${eventId} not found`, 'warn');
        return false;
      }
      
      // Reset next event index
      this.nextEventIndex = this.events.findIndex(e => e.time > this.getElapsedTime());
      if (this.nextEventIndex === -1) this.nextEventIndex = this.events.length;
      
      this.log(`Removed event ${eventId}`);
      return true;
    }
    
    /**
     * Clear all scheduled events
     * @returns {boolean} Success state
     */
    clearEvents() {
      this.events = [];
      this.nextEventIndex = 0;
      this.log('All events cleared');
      return true;
    }
    
    /**
     * Get all scheduled events
     * @returns {Array} Array of event objects
     */
    getEvents() {
      return [...this.events];
    }
    
    /**
     * Seek to a specific time in the timeline
     * @param {number} time - Time in milliseconds
     * @returns {boolean} Success state
     */
    seekTo(time) {
      if (isNaN(time) || time < 0 || time > this.config.sessionDuration) {
        this.log(`Invalid seek time: ${time}`, 'error');
        return false;
      }
      
      this.log(`Seeking to ${time}ms`);
      
      // Update time tracking
      this.elapsedTime = time;
      
      if (this.isPlaying) {
        this.startTime = Date.now() - time;
      }
      
      // Update next event index
      this.nextEventIndex = this.events.findIndex(e => e.time > time);
      if (this.nextEventIndex === -1) this.nextEventIndex = this.events.length;
      
      // Check for phase change
      this.checkCurrentPhase();
      
      // Trigger progress update
      const progress = Math.min(100, (time / this.config.sessionDuration) * 100);
      if (this.onProgress) {
        this.onProgress(progress, time);
      }
      
      return true;
    }
    
    /**
     * Seek to a specific percentage in the timeline
     * @param {number} percent - Progress percentage (0-100)
     * @returns {boolean} Success state
     */
    seekToPercent(percent) {
      if (isNaN(percent) || percent < 0 || percent > 100) {
        this.log(`Invalid seek percentage: ${percent}`, 'error');
        return false;
      }
      
      const time = (percent / 100) * this.config.sessionDuration;
      return this.seekTo(Math.round(time));
    }
    
    /**
     * Check and update the current active phase
     * @private
     */
    checkCurrentPhase() {
      const progress = this.getProgress();
      const activePhase = this.getPhaseAtProgress(progress);
      
      // Check if phase changed
      if (activePhase && (!this.currentPhase || activePhase.id !== this.currentPhase.id)) {
        this.log(`Phase changed to: ${activePhase.name} (${activePhase.id}) at progress ${progress.toFixed(2)}%`);
        this.currentPhase = activePhase;
        
        // Trigger callback
        if (this.onPhaseChange) {
          this.onPhaseChange(activePhase.id, activePhase);
        }
      }
    }
    
    /**
     * Start checking for scheduled events
     * @private
     */
    startEventChecking() {
      if (this.eventCheckTimer) {
        clearInterval(this.eventCheckTimer);
      }
      
      // Find the next event to check
      this.nextEventIndex = this.events.findIndex(e => e.time > this.getElapsedTime());
      if (this.nextEventIndex === -1) this.nextEventIndex = this.events.length;
      
      // Start checking for events every 250ms for more responsive event triggering
      this.eventCheckTimer = setInterval(() => {
        this.checkScheduledEvents();
      }, 250);
    }
    
    /**
     * Stop checking for scheduled events
     * @private
     */
    stopEventChecking() {
      if (this.eventCheckTimer) {
        clearInterval(this.eventCheckTimer);
        this.eventCheckTimer = null;
      }
    }
    
    /**
     * Check if any scheduled events need to be triggered
     * @private
     */
    checkScheduledEvents() {
      if (!this.isPlaying || this.events.length === 0 || this.nextEventIndex >= this.events.length) {
        return;
      }
      
      const currentTime = this.getElapsedTime();
      
      // Check next events that might need to be triggered
      while (this.nextEventIndex < this.events.length && 
             currentTime >= this.events[this.nextEventIndex].time) {
        
        const event = this.events[this.nextEventIndex];
        this.log(`Triggering event: ${event.id} (${event.action}) at ${currentTime}ms`);
        
        // Trigger event callback
        if (this.onScheduledEvent) {
          this.onScheduledEvent(event);
        }
        
        // Move to next event
        this.nextEventIndex++;
      }
    }
    
    /**
     * Start the progress update timer
     * @private
     */
    startProgressTimer(immediate = false) {
      if (this.progressTimer) {
        clearInterval(this.progressTimer);
      }
      
      // Trigger an immediate update if requested
      if (immediate && this.onProgress) {
        const elapsedTime = this.getElapsedTime();
        const progress = this.getProgress();
        this.onProgress(progress, elapsedTime);
        
        // Check for phase changes
        this.checkCurrentPhase();
      }
      
      // Update progress every 100ms for smoother UI updates
      this.progressTimer = setInterval(() => {
        const elapsedTime = this.getElapsedTime();
        const progress = this.getProgress();
        
        // Call progress callback
        if (this.onProgress) {
          this.onProgress(progress, elapsedTime);
        }
        
        // Check for phase changes
        this.checkCurrentPhase();
        
      }, 100); // 10 updates per second
    }
    
    /**
     * Stop the progress update timer
     * @private
     */
    stopProgressTimer() {
      if (this.progressTimer) {
        clearInterval(this.progressTimer);
        this.progressTimer = null;
      }
    }
    
    /**
     * Export the timeline configuration as JSON
     * @returns {Object} Timeline configuration object
     */
    exportConfig() {
      return {
        sessionDuration: this.config.sessionDuration,
        transitionDuration: this.config.transitionDuration,
        phases: this.phases,
        events: this.events
      };
    }
    
    /**
     * Import a timeline configuration
     * @param {Object} config - Timeline configuration object
     * @returns {boolean} Success state
     */
    importConfig(config) {
      if (!config) {
        this.log('Invalid configuration data', 'error');
        return false;
      }
      
      try {
        // Update session duration if provided
        if (typeof config.sessionDuration === 'number' && config.sessionDuration > 0) {
          this.config.sessionDuration = config.sessionDuration;
        }
        
        // Update transition duration if provided
        if (typeof config.transitionDuration === 'number' && config.transitionDuration >= 0) {
          this.config.transitionDuration = config.transitionDuration;
        }
        
        // Import phases if provided
        if (Array.isArray(config.phases)) {
          this.setPhases(config.phases);
        }
        
        // Import events if provided
        if (Array.isArray(config.events)) {
          this.events = [];
          config.events.forEach(event => this.addEvent(event));
        }
        
        this.log('Timeline configuration imported successfully');
        return true;
      } catch (error) {
        this.log(`Error importing configuration: ${error.message}`, 'error');
        return false;
      }
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
      
      const prefix = '[TimelineEngine]';
      
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
      this.stop();
      this.log('TimelineEngine disposed');
    }
  }
  
  export default TimelineEngine;