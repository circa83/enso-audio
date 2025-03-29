/**
 * TimelineEngine.js
 * 
 * Service for managing session timeline functionality.
 * Handles phases, transitions, event scheduling, and timeline state.
 */

// Default phases configuration
const DEFAULT_PHASES = [
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
  
  class TimelineEngine {
    constructor() {
      // Timeline configuration
      this.phases = [...DEFAULT_PHASES];
      this.sessionDuration = 60 * 60 * 1000; // Default 1 hour in milliseconds
      this.transitionDuration = 4000; // Default 4 seconds for transitions
      this.timelineEnabled = true;
      
      // Runtime state
      this.isRunning = false;
      this.startTime = null;
      this.currentTime = 0;
      this.activePhaseId = null;
      this.lastActivePhaseId = null;
      this.nextEventIndex = 0;
      this.timelineEvents = [];
      this.checkInterval = null;
      this.transitionInProgress = false;
      
      // Callbacks
      this.onPhaseChange = null;
      this.onTransition = null;
      this.onTimeUpdate = null;
      this.onTransitionComplete = null;
      
      // Event listeners
      this.listeners = new Map();
    }
    
    /**
     * Initialize the timeline with configuration
     * @param {Object} config - Timeline configuration
     * @param {Array} config.phases - Phase configuration (optional)
     * @param {number} config.sessionDuration - Session duration in milliseconds (optional)
     * @param {number} config.transitionDuration - Transition duration in milliseconds (optional)
     * @param {boolean} config.timelineEnabled - Whether timeline is enabled (optional)
     */
    initialize(config = {}) {
      // Apply configuration if provided
      if (config.phases) {
        this.phases = [...config.phases];
      }
      
      if (config.sessionDuration !== undefined) {
        this.sessionDuration = config.sessionDuration;
      }
      
      if (config.transitionDuration !== undefined) {
        this.transitionDuration = config.transitionDuration;
      }
      
      if (config.timelineEnabled !== undefined) {
        this.timelineEnabled = config.timelineEnabled;
      }
      
      // Sort phases by position
      this.sortPhases();
      
      // Emit initialization event
      this.emit('initialized', {
        phases: this.phases,
        sessionDuration: this.sessionDuration,
        transitionDuration: this.transitionDuration,
        timelineEnabled: this.timelineEnabled
      });
    }
    
    /**
     * Sort phases by position
     * @private
     */
    sortPhases() {
      this.phases.sort((a, b) => a.position - b.position);
    }
    
    /**
     * Start the timeline
     * @returns {boolean} Success status
     */
    start() {
      if (this.isRunning) {
        return false;
      }
      
      this.isRunning = true;
      this.startTime = Date.now();
      this.currentTime = 0;
      this.activePhaseId = null;
      this.lastActivePhaseId = null;
      this.nextEventIndex = 0;
      this.transitionInProgress = false;
      
      // Start the check interval
      this.startCheckInterval();
      
      // Initialize with first phase
      this.checkPhase();
      
      // Emit start event
      this.emit('started', {
        startTime: this.startTime
      });
      
      return true;
    }
    
    /**
     * Stop the timeline
     * @returns {boolean} Success status
     */
    stop() {
      if (!this.isRunning) {
        return false;
      }
      
      this.isRunning = false;
      this.currentTime = 0;
      
      // Clear check interval
      this.clearCheckInterval();
      
      // Emit stop event
      this.emit('stopped', {
        elapsedTime: Date.now() - this.startTime
      });
      
      return true;
    }
    
    /**
     * Pause the timeline
     * @returns {boolean} Success status
     */
    pause() {
      if (!this.isRunning) {
        return false;
      }
      
      this.isRunning = false;
      
      // Clear check interval
      this.clearCheckInterval();
      
      // Emit pause event
      this.emit('paused', {
        currentTime: this.currentTime
      });
      
      return true;
    }
    
    /**
     * Resume the timeline
     * @returns {boolean} Success status
     */
    resume() {
      if (this.isRunning) {
        return false;
      }
      
      this.isRunning = true;
      
      // Adjust start time to account for elapsed time
      if (this.startTime) {
        this.startTime = Date.now() - this.currentTime;
      } else {
        this.startTime = Date.now();
      }
      
      // Start check interval
      this.startCheckInterval();
      
      // Emit resume event
      this.emit('resumed', {
        currentTime: this.currentTime
      });
      
      return true;
    }
    
    /**
     * Start the check interval for timeline processing
     * @private
     */
    startCheckInterval() {
      // Clear any existing interval
      this.clearCheckInterval();
      
      // Start a new interval
      this.checkInterval = setInterval(() => {
        // Update current time
        this.updateCurrentTime();
        
        // Check for phase changes and events
        this.checkPhase();
        this.checkEvents();
        
        // Emit time update event (at lower frequency to avoid performance issues)
        if (this.currentTime % 1000 < 100) {
          this.emit('timeUpdate', {
            currentTime: this.currentTime,
            progress: this.getProgress()
          });
        }
      }, 100); // Check every 100ms for smooth updates
    }
    
    /**
     * Clear the check interval
     * @private
     */
    clearCheckInterval() {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
    }
    
    /**
     * Update the current time based on start time
     * @private
     */
    updateCurrentTime() {
      if (this.isRunning && this.startTime) {
        this.currentTime = Date.now() - this.startTime;
        
        // If we've reached the session duration, trigger completion
        if (this.currentTime >= this.sessionDuration) {
          this.completeSession();
        }
        
        // Call onTimeUpdate callback if provided
        if (typeof this.onTimeUpdate === 'function') {
          this.onTimeUpdate(this.currentTime);
        }
      }
    }
    
    /**
     * Complete the session
     * @private
     */
    completeSession() {
      this.isRunning = false;
      this.clearCheckInterval();
      
      // Emit complete event
      this.emit('completed', {
        elapsedTime: this.currentTime
      });
    }
    
    /**
     * Check for phase changes
     * @private
     */
    checkPhase() {
      if (!this.isRunning || !this.timelineEnabled || this.transitionInProgress) {
        return;
      }
      
      const progress = this.getProgress();
      let newActivePhaseId = null;
      
      // Find the current phase based on progress
      // Use reverse order to find the last phase whose position is <= progress
      for (let i = this.phases.length - 1; i >= 0; i--) {
        const phase = this.phases[i];
        if (progress >= phase.position) {
          newActivePhaseId = phase.id;
          break;
        }
      }
      
      // Check if phase has changed
      if (newActivePhaseId !== this.activePhaseId) {
        const previousPhaseId = this.activePhaseId;
        this.activePhaseId = newActivePhaseId;
        
        // Find the new active phase
        const newActivePhase = this.phases.find(phase => phase.id === newActivePhaseId);
        
        // Emit phase change event
        this.emit('phaseChange', {
          previousPhaseId,
          activePhaseId: newActivePhaseId,
          progress
        });
        
        // Call onPhaseChange callback if provided
        if (typeof this.onPhaseChange === 'function') {
          this.onPhaseChange(previousPhaseId, newActivePhaseId, newActivePhase);
        }
        
        // If the new phase has a state, trigger a transition
        if (newActivePhase && newActivePhase.state) {
          this.triggerPhaseTransition(newActivePhase);
        }
        
        // Store last active phase ID
        this.lastActivePhaseId = newActivePhaseId;
      }
    }
    
    /**
     * Trigger a phase transition
     * @param {Object} phase - The phase to transition to
     * @private
     */
    triggerPhaseTransition(phase) {
      if (!phase || !phase.state || this.transitionInProgress) {
        return;
      }
      
      // Mark transition as in progress
      this.transitionInProgress = true;
      
      // Emit transition start event
      this.emit('transitionStart', {
        phaseId: phase.id,
        state: phase.state,
        transitionDuration: this.transitionDuration
      });
      
      // Call onTransition callback if provided
      if (typeof this.onTransition === 'function') {
        this.onTransition(phase.id, phase.state, this.transitionDuration);
      }
      
      // Set a timeout to mark transition as complete
      setTimeout(() => {
        this.transitionInProgress = false;
        
        // Emit transition complete event
        this.emit('transitionComplete', {
          phaseId: phase.id
        });
        
        // Call onTransitionComplete callback if provided
        if (typeof this.onTransitionComplete === 'function') {
          this.onTransitionComplete(phase.id);
        }
      }, this.transitionDuration);
    }
    
    /**
     * Check for timeline events
     * @private
     */
    checkEvents() {
      if (!this.isRunning || this.timelineEvents.length === 0 || this.nextEventIndex >= this.timelineEvents.length) {
        return;
      }
      
      // Check if it's time to trigger the next event
      const nextEvent = this.timelineEvents[this.nextEventIndex];
      if (this.currentTime >= nextEvent.time) {
        // Emit event triggered event
        this.emit('eventTriggered', {
          event: nextEvent,
          currentTime: this.currentTime
        });
        
        // Move to next event
        this.nextEventIndex++;
      }
    }
    
    /**
     * Get the current progress as a percentage (0-100)
     * @returns {number} Progress percentage
     */
    getProgress() {
      return Math.min(100, (this.currentTime / this.sessionDuration) * 100);
    }
    
    /**
     * Get the current time in milliseconds
     * @returns {number} Current time in milliseconds
     */
    getCurrentTime() {
      return this.currentTime;
    }
    
    /**
     * Get the active phase ID
     * @returns {string|null} Active phase ID or null if none
     */
    getActivePhaseId() {
      return this.activePhaseId;
    }
    
    /**
     * Get the active phase
     * @returns {Object|null} Active phase or null if none
     */
    getActivePhase() {
      if (!this.activePhaseId) {
        return null;
      }
      
      return this.phases.find(phase => phase.id === this.activePhaseId) || null;
    }
    
    /**
     * Set the timeline phases
     * @param {Array} phases - Array of phase objects
     */
    setPhases(phases) {
      if (!Array.isArray(phases) || phases.length === 0) {
        return;
      }
      
      this.phases = [...phases];
      this.sortPhases();
      
      // Emit phases updated event
      this.emit('phasesUpdated', {
        phases: this.phases
      });
    }
    
    /**
     * Get all phases
     * @returns {Array} Array of phase objects
     */
    getPhases() {
      return [...this.phases];
    }
    
    /**
     * Update a specific phase
     * @param {string} phaseId - ID of the phase to update
     * @param {Object} updates - Updates to apply
     * @returns {boolean} Success status
     */
    updatePhase(phaseId, updates) {
      const phaseIndex = this.phases.findIndex(phase => phase.id === phaseId);
      if (phaseIndex === -1) {
        return false;
      }
      
      // Apply updates
      this.phases[phaseIndex] = {
        ...this.phases[phaseIndex],
        ...updates
      };
      
      // If position changed, re-sort phases
      if (updates.position !== undefined) {
        this.sortPhases();
      }
      
      // Emit phase updated event
      this.emit('phaseUpdated', {
        phaseId,
        phase: this.phases[phaseIndex]
      });
      
      return true;
    }
    
    /**
     * Set the session duration
     * @param {number} duration - Duration in milliseconds
     */
    setSessionDuration(duration) {
      if (duration <= 0) {
        return;
      }
      
      this.sessionDuration = duration;
      
      // Emit duration updated event
      this.emit('durationUpdated', {
        sessionDuration: this.sessionDuration
      });
    }
    
    /**
     * Get the session duration
     * @returns {number} Session duration in milliseconds
     */
    getSessionDuration() {
      return this.sessionDuration;
    }
    
    /**
     * Set the transition duration
     * @param {number} duration - Duration in milliseconds
     */
    setTransitionDuration(duration) {
      if (duration <= 0) {
        return;
      }
      
      this.transitionDuration = duration;
      
      // Emit transition duration updated event
      this.emit('transitionDurationUpdated', {
        transitionDuration: this.transitionDuration
      });
    }
    
    /**
     * Get the transition duration
     * @returns {number} Transition duration in milliseconds
     */
    getTransitionDuration() {
      return this.transitionDuration;
    }
    
    /**
     * Enable or disable the timeline
     * @param {boolean} enabled - Whether the timeline is enabled
     */
    setTimelineEnabled(enabled) {
      this.timelineEnabled = enabled;
      
      // Emit timeline enabled updated event
      this.emit('timelineEnabledUpdated', {
        timelineEnabled: this.timelineEnabled
      });
    }
    
    /**
     * Check if the timeline is enabled
     * @returns {boolean} Whether the timeline is enabled
     */
    isTimelineEnabled() {
      return this.timelineEnabled;
    }
    
    /**
     * Register callbacks
     * @param {Object} callbacks - Callback functions
     * @param {Function} callbacks.onPhaseChange - Called when phase changes
     * @param {Function} callbacks.onTransition - Called when transition starts
     * @param {Function} callbacks.onTimeUpdate - Called when time updates
     * @param {Function} callbacks.onTransitionComplete - Called when transition completes
     */
    registerCallbacks(callbacks) {
      if (callbacks.onPhaseChange) {
        this.onPhaseChange = callbacks.onPhaseChange;
      }
      
      if (callbacks.onTransition) {
        this.onTransition = callbacks.onTransition;
      }
      
      if (callbacks.onTimeUpdate) {
        this.onTimeUpdate = callbacks.onTimeUpdate;
      }
      
      if (callbacks.onTransitionComplete) {
        this.onTransitionComplete = callbacks.onTransitionComplete;
      }
    }
    
    /**
     * Reset the timeline events index
     */
    resetTimelineEventIndex() {
      this.nextEventIndex = 0;
    }
    
    /**
     * Add a timeline event
     * @param {Object} event - Timeline event
     * @param {number} event.time - Time in milliseconds to trigger the event
     * @param {string} event.name - Name of the event
     * @param {string} event.action - Action to perform
     * @param {Object} event.params - Parameters for the action
     */
    addTimelineEvent(event) {
      if (!event || !event.time || !event.name) {
        return;
      }
      
      this.timelineEvents.push(event);
      
      // Sort events by time
      this.timelineEvents.sort((a, b) => a.time - b.time);
      
      // If we've added an event before the next event index, adjust it
      if (this.nextEventIndex > 0 && event.time < this.timelineEvents[this.nextEventIndex - 1].time) {
        this.resetTimelineEventIndex();
      }
      
      // Emit event added event
      this.emit('eventAdded', {
        event
      });
    }
    
    /**
     * Clear all timeline events
     */
    clearTimelineEvents() {
      this.timelineEvents = [];
      this.nextEventIndex = 0;
      
      // Emit events cleared event
      this.emit('eventsCleared');
    }
    
    /**
     * Get all timeline events
     * @returns {Array} Array of timeline events
     */
    getTimelineEvents() {
      return [...this.timelineEvents];
    }
    
    /**
     * Add an event listener
     * @param {string} event - Event name
     * @param {Function} listener - Event listener
     */
    addEventListener(event, listener) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      
      this.listeners.get(event).push(listener);
    }
    
    /**
     * Remove an event listener
     * @param {string} event - Event name
     * @param {Function} listener - Event listener
     */
    removeEventListener(event, listener) {
      if (!this.listeners.has(event)) {
        return;
      }
      
      const listeners = this.listeners.get(event);
      const index = listeners.indexOf(listener);
      
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
    
    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {Object} data - Event data
     * @private
     */
    emit(event, data) {
      if (!this.listeners.has(event)) {
        return;
      }
      
      for (const listener of this.listeners.get(event)) {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      }
    }
    
    /**
     * Capture the current state of the timeline
     * @returns {Object} Timeline state
     */
    captureState() {
      return {
        phases: this.phases,
        sessionDuration: this.sessionDuration,
        transitionDuration: this.transitionDuration,
        timelineEnabled: this.timelineEnabled,
        isRunning: this.isRunning,
        currentTime: this.currentTime,
        activePhaseId: this.activePhaseId,
        timelineEvents: this.timelineEvents,
        nextEventIndex: this.nextEventIndex
      };
    }
    
    /**
     * Restore timeline state
     * @param {Object} state - Timeline state to restore
     * @returns {boolean} Success status
     */
    restoreState(state) {
      if (!state) {
        return false;
      }
      
      // Restore configuration
      if (state.phases) {
        this.phases = [...state.phases];
      }
      
      if (state.sessionDuration !== undefined) {
        this.sessionDuration = state.sessionDuration;
      }
      
      if (state.transitionDuration !== undefined) {
        this.transitionDuration = state.transitionDuration;
      }
      
      if (state.timelineEnabled !== undefined) {
        this.timelineEnabled = state.timelineEnabled;
      }
      
      // Restore events
      if (state.timelineEvents) {
        this.timelineEvents = [...state.timelineEvents];
      }
      
      if (state.nextEventIndex !== undefined) {
        this.nextEventIndex = state.nextEventIndex;
      }
      
      // Restore runtime state if running
      if (state.isRunning) {
        this.isRunning = true;
        this.currentTime = state.currentTime || 0;
        this.startTime = Date.now() - this.currentTime;
        this.activePhaseId = state.activePhaseId;
        
        // Start check interval
        this.startCheckInterval();
      } else {
        this.isRunning = false;
        this.currentTime = state.currentTime || 0;
        this.activePhaseId = state.activePhaseId;
        this.clearCheckInterval();
      }
      
      // Emit state restored event
      this.emit('stateRestored', {
        state
      });
      
      return true;
    }
    
    /**
     * Reset the timeline to default state
     */
    reset() {
      this.phases = [...DEFAULT_PHASES];
      this.sessionDuration = 60 * 60 * 1000;
      this.transitionDuration = 4000;
      this.timelineEnabled = true;
      
      this.isRunning = false;
      this.startTime = null;
      this.currentTime = 0;
      this.activePhaseId = null;
      this.lastActivePhaseId = null;
      this.nextEventIndex = 0;
      this.timelineEvents = [];
      this.transitionInProgress = false;
      
      this.clearCheckInterval();
      
      // Emit reset event
      this.emit('reset');
    }
    
    /**
     * Clean up resources
     */
    cleanup() {
      this.clearCheckInterval();
      this.listeners.clear();
      this.onPhaseChange = null;
      this.onTransition = null;
      this.onTimeUpdate = null;
      this.onTransitionComplete = null;
    }
  }
  
  export default TimelineEngine;