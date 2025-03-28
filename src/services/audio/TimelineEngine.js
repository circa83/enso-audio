/**
 * TimelineEngine.js
 * Service for managing session timeline and phase transitions
 */

class TimelineEngine {
    /**
     * Creates a new TimelineEngine instance
     * @param {AudioCore} audioCore - Reference to the AudioCore service
     * @param {VolumeController} volumeController - Reference to the VolumeController service
     * @param {CrossfadeEngine} crossfadeEngine - Reference to the CrossfadeEngine service
     * @param {Object} config - Configuration options
     */
    constructor(audioCore, volumeController, crossfadeEngine, config = {}) {
      // Dependencies
      this.audioCore = audioCore;
      this.volumeController = volumeController;
      this.crossfadeEngine = crossfadeEngine;
      
      // Timeline data
      this.phases = [];
      this.events = [];
      
      // State tracking
      this.activePhaseIndex = -1;
      this.nextEventIndex = 0;
      this.sessionStartTime = null;
      this.sessionDuration = 0;
      this.isPlaying = false;
      this.isTransitioning = false;
      
      // Event ID counter for generating unique IDs
      this.eventIdCounter = 0;
      
      // Track event execution history
      this.eventHistory = [];
      
      // Timer for checking event triggers
      this.eventCheckInterval = null;
      
      // Observer callbacks
      this.callbacks = {
        phaseChanged: [],
        eventTriggered: [],
        progressUpdated: [],
        transitionStarted: [],
        transitionCompleted: [],
        eventAdded: [],
        eventRemoved: [],
        eventUpdated: []
      };
      
      // Configuration with defaults
      this.config = {
        eventCheckFrequency: 250, // How often to check for events (ms)
        defaultTransitionDuration: 4000, // Default phase transition duration (ms)
        timelinePrecision: 100, // Timeline precision in ms
        autoActivateInitialPhase: true, // Automatically activate initial phase on start
        maxEventHistory: 100, // Maximum number of event executions to keep in history
        timeToleranceMs: 10, // Tolerance in ms for event timing precision
        ...config
      };
    }
  
    /**
     * Initialize the timeline with phases
     * @param {Array} phases - Array of phase objects
     * @param {number} sessionDuration - Total session duration in ms
     * @returns {boolean} True if initialization was successful
     */
    initializeTimeline(phases, sessionDuration) {
      if (!Array.isArray(phases) || phases.length === 0) {
        console.error('Invalid phases array provided to timeline');
        return false;
      }
      
      try {
        // Sort phases by position
        this.phases = [...phases].sort((a, b) => a.position - b.position);
        
        // Validate phases
        this._validatePhases();
        
        // Set session duration
        this.sessionDuration = sessionDuration > 0 ? sessionDuration : 60 * 60 * 1000; // Default 1 hour
        
        // Reset state
        this.activePhaseIndex = -1;
        this.nextEventIndex = 0;
        this.isTransitioning = false;
        
        // Clear event check interval if it exists
        if (this.eventCheckInterval) {
          clearInterval(this.eventCheckInterval);
          this.eventCheckInterval = null;
        }
        
        console.log(`Timeline initialized with ${phases.length} phases and duration ${this.sessionDuration}ms`);
        return true;
      } catch (error) {
        console.error('Error initializing timeline:', error);
        return false;
      }
    }
  
    /**
     * Start the timeline session
     * @returns {boolean} True if session started successfully
     */
    startSession() {
      if (!this.phases || this.phases.length === 0) {
        console.error('Cannot start session: no phases defined');
        return false;
      }
      
      try {
        // Set start time and playing state
        this.sessionStartTime = Date.now();
        this.isPlaying = true;
        
        // Reset event and phase tracking
        this.nextEventIndex = 0;
        
        // Start checking for events
        this._startEventChecking();
        
        // Auto-activate initial phase if configured
        if (this.config.autoActivateInitialPhase) {
          this._activatePhaseAtPosition(0);
        }
        
        console.log('Timeline session started');
        return true;
      } catch (error) {
        console.error('Error starting timeline session:', error);
        this.isPlaying = false;
        return false;
      }
    }
  
    /**
     * Pause the timeline session
     * @returns {boolean} True if session paused successfully
     */
    pauseSession() {
      try {
        // Update playing state
        this.isPlaying = false;
        
        // Stop checking for events
        if (this.eventCheckInterval) {
          clearInterval(this.eventCheckInterval);
          this.eventCheckInterval = null;
        }
        
        console.log('Timeline session paused');
        return true;
      } catch (error) {
        console.error('Error pausing timeline session:', error);
        return false;
      }
    }
  
    /**
     * Resume the timeline session
     * @returns {boolean} True if session resumed successfully
     */
    resumeSession() {
      if (!this.sessionStartTime) {
        // Never started, so start fresh
        return this.startSession();
      }
      
      try {
        // Update session start time to account for pause duration
        const pauseDuration = Date.now() - (this.sessionStartTime + this.getElapsedTime());
        this.sessionStartTime = this.sessionStartTime + pauseDuration;
        
        // Update playing state
        this.isPlaying = true;
        
        // Restart event checking
        this._startEventChecking();
        
        console.log('Timeline session resumed');
        return true;
      } catch (error) {
        console.error('Error resuming timeline session:', error);
        return false;
      }
    }
  
    /**
     * Reset the timeline session
     * @returns {boolean} True if session reset successfully
     */
    resetSession() {
      try {
        // Reset state
        this.sessionStartTime = null;
        this.isPlaying = false;
        this.activePhaseIndex = -1;
        this.nextEventIndex = 0;
        this.isTransitioning = false;
        
        // Stop checking for events
        if (this.eventCheckInterval) {
          clearInterval(this.eventCheckInterval);
          this.eventCheckInterval = null;
        }
        
        console.log('Timeline session reset');
        return true;
      } catch (error) {
        console.error('Error resetting timeline session:', error);
        return false;
      }
    }
  
    /**
     * Create a new event object with defaults
     * @param {Object} eventData - Event data to use
     * @returns {Object} Complete event object with defaults
     * @private
     */
    _createEventObject(eventData) {
      // Generate a unique ID for the event
      const eventId = eventData.id || `event_${++this.eventIdCounter}_${Date.now()}`;
      
      // Create the event object with defaults
      return {
        id: eventId,
        name: eventData.name || `Event at ${eventData.time}ms`,
        time: eventData.time,
        action: eventData.action,
        executed: false,
        // Event type properties
        type: eventData.type || 'custom',
        category: eventData.category || 'general',
        // Execution control
        repeatable: !!eventData.repeatable,
        maxExecutions: eventData.maxExecutions || 1,
        executionCount: 0,
        enabled: eventData.enabled !== false, // Default to enabled
        // Timing properties
        timeOffset: eventData.timeOffset || 0,
        timeWindow: eventData.timeWindow || 0, // Time window in ms after event time when it can still be executed
        scheduledTime: eventData.time, // Original scheduled time (time property may change)
        // Condition and execution properties
        condition: eventData.condition || null, // Optional function that returns boolean
        priority: eventData.priority || 0, // Higher priority events execute first
        timeout: eventData.timeout || 0, // Maximum time in ms for execution
        // Data properties for action function
        data: eventData.data || {},
        metadata: eventData.metadata || {},
        // Override other properties with any remaining event data
        ...eventData
      };
    }
  
    /**
     * Add a scheduled event to the timeline
     * @param {Object} event - Event object with time, action, and other properties
     * @returns {string} ID of the added event, or null if failed
     */
    addEvent(event) {
      if (!event || !event.time || typeof event.time !== 'number') {
        console.error('Invalid event object: missing or invalid time property');
        return null;
      }
      
      if (!event.action || typeof event.action !== 'function') {
        console.error('Invalid event object: missing or invalid action function');
        return null;
      }
      
      try {
        // Create full event object with defaults
        const fullEvent = this._createEventObject(event);
        
        // Add to events array
        this.events.push(fullEvent);
        
        // Sort events by time, then by priority (higher priority first)
        this.events.sort((a, b) => {
          const timeDiff = a.time - b.time;
          return timeDiff === 0 ? b.priority - a.priority : timeDiff;
        });
        
        // Update nextEventIndex if needed
        if (this.isPlaying) {
          this._updateNextEventIndex();
        }
        
        // Notify observers
        this._notifyObservers('eventAdded', {
          event: fullEvent,
          index: this.events.findIndex(e => e.id === fullEvent.id)
        });
        
        console.log(`Event added to timeline: ${fullEvent.name} at ${fullEvent.time}ms`);
        return fullEvent.id;
      } catch (error) {
        console.error('Error adding event to timeline:', error);
        return null;
      }
    }
  
    /**
     * Add multiple events to the timeline
     * @param {Array<Object>} events - Array of event objects
     * @returns {Array<string>} Array of added event IDs
     */
    addEvents(events) {
      if (!Array.isArray(events) || events.length === 0) {
        console.error('Invalid events array provided');
        return [];
      }
      
      try {
        const addedIds = [];
        
        // Add each event
        for (const event of events) {
          const id = this.addEvent(event);
          if (id) {
            addedIds.push(id);
          }
        }
        
        return addedIds;
      } catch (error) {
        console.error('Error adding multiple events:', error);
        return [];
      }
    }
  
    /**
     * Update an existing event
     * @param {string} eventId - ID of the event to update
     * @param {Object} updates - Object with properties to update
     * @returns {boolean} True if event was updated
     */
    updateEvent(eventId, updates) {
      const eventIndex = this.events.findIndex(e => e.id === eventId);
      if (eventIndex === -1) {
        console.error(`Event with ID ${eventId} not found`);
        return false;
      }
      
      try {
        const originalEvent = this.events[eventIndex];
        
        // Create updated event
        const updatedEvent = {
          ...originalEvent,
          ...updates
        };
        
        // Disallow changing the ID
        updatedEvent.id = originalEvent.id;
        
        // Update the event
        this.events[eventIndex] = updatedEvent;
        
        // Re-sort events if time or priority changed
        if (updates.time !== undefined || updates.priority !== undefined) {
          this.events.sort((a, b) => {
            const timeDiff = a.time - b.time;
            return timeDiff === 0 ? b.priority - a.priority : timeDiff;
          });
          
          // Update nextEventIndex if playing
          if (this.isPlaying) {
            this._updateNextEventIndex();
          }
        }
        
        // Notify observers
        this._notifyObservers('eventUpdated', {
          event: updatedEvent,
          originalEvent,
          index: this.events.findIndex(e => e.id === updatedEvent.id)
        });
        
        console.log(`Event updated: ${updatedEvent.name}`);
        return true;
      } catch (error) {
        console.error(`Error updating event ${eventId}:`, error);
        return false;
      }
    }
  
    /**
     * Remove an event from the timeline
     * @param {string} eventId - ID of the event to remove
     * @returns {boolean} True if event was removed
     */
    removeEvent(eventId) {
      const eventIndex = this.events.findIndex(e => e.id === eventId);
      if (eventIndex === -1) {
        return false;
      }
      
      // Store the removed event for notification
      const removedEvent = this.events[eventIndex];
      
      // Remove the event
      this.events.splice(eventIndex, 1);
      
      // Update nextEventIndex if needed
      if (this.isPlaying) {
        this._updateNextEventIndex();
      }
      
      // Notify observers
      this._notifyObservers('eventRemoved', {
        event: removedEvent,
        id: eventId
      });
      
      console.log(`Event removed: ${removedEvent.name}`);
      return true;
    }
    
    /**
     * Remove multiple events from the timeline
     * @param {Array<string>} eventIds - Array of event IDs to remove
     * @returns {number} Number of events removed
     */
    removeEvents(eventIds) {
      if (!Array.isArray(eventIds) || eventIds.length === 0) {
        return 0;
      }
      
      let removedCount = 0;
      
      for (const eventId of eventIds) {
        if (this.removeEvent(eventId)) {
          removedCount++;
        }
      }
      
      return removedCount;
    }
    
    /**
     * Enable or disable an event
     * @param {string} eventId - ID of the event
     * @param {boolean} enabled - Whether to enable or disable
     * @returns {boolean} True if successful
     */
    setEventEnabled(eventId, enabled) {
      return this.updateEvent(eventId, { enabled: !!enabled });
    }
    
    /**
     * Get an event by ID
     * @param {string} eventId - ID of the event
     * @returns {Object|null} The event object or null if not found
     */
    getEvent(eventId) {
      const event = this.events.find(e => e.id === eventId);
      return event ? { ...event } : null; // Return a copy
    }
    
    /**
     * Get all events
     * @param {Object} options - Options for filtering events
     * @returns {Array<Object>} Array of event objects
     */
    getEvents(options = {}) {
      const {
        type = null,
        category = null,
        timeRange = null,
        executed = null,
        enabled = null,
        includeHistory = false
      } = options;
      
      // Filter events based on options
      let filteredEvents = [...this.events];
      
      if (type) {
        filteredEvents = filteredEvents.filter(e => e.type === type);
      }
      
      if (category) {
        filteredEvents = filteredEvents.filter(e => e.category === category);
      }
      
      if (timeRange) {
        const { start, end } = timeRange;
        if (start !== undefined) {
          filteredEvents = filteredEvents.filter(e => e.time >= start);
        }
        if (end !== undefined) {
          filteredEvents = filteredEvents.filter(e => e.time <= end);
        }
      }
      
      if (executed !== null) {
        filteredEvents = filteredEvents.filter(e => !!e.executed === !!executed);
      }
      
      if (enabled !== null) {
        filteredEvents = filteredEvents.filter(e => !!e.enabled === !!enabled);
      }
      
      // Create copies to avoid external modification
      const result = filteredEvents.map(e => ({ ...e }));
      
      // Include event history if requested
      if (includeHistory) {
        return {
          events: result,
          history: [...this.eventHistory]
        };
      }
      
      return result;
    }
    
    /**
     * Clear all events from the timeline
     * @param {Object} options - Options for clearing events
     * @returns {number} Number of events cleared
     */
    clearEvents(options = {}) {
      const {
        type = null,
        category = null,
        timeRange = null,
        executed = null,
        clearHistory = false
      } = options;
      
      const initialCount = this.events.length;
      
      // Apply filters if specified
      if (type || category || timeRange || executed !== null) {
        // Get IDs of events to remove based on filters
        const eventIds = this.getEvents({ type, category, timeRange, executed })
          .map(e => e.id);
        
        // Remove the filtered events
        this.removeEvents(eventIds);
      } else {
        // Clear all events
        this.events = [];
        
        // Reset next event index
        this.nextEventIndex = 0;
      }
      
      // Clear history if requested
      if (clearHistory) {
        this.eventHistory = [];
      }
      
      return initialCount - this.events.length;
    }
  
    /**
     * Update a phase in the timeline
     * @param {number} index - Index of the phase to update
     * @param {Object} phaseData - New phase data
     * @returns {boolean} True if phase was updated
     */
    updatePhase(index, phaseData) {
      if (index < 0 || index >= this.phases.length) {
        console.error(`Invalid phase index: ${index}`);
        return false;
      }
      
      try {
        // Create updated phase
        const updatedPhase = {
          ...this.phases[index],
          ...phaseData
        };
        
        // Validate position constraints
        if (phaseData.position !== undefined) {
          // Cannot move past adjacent phases
          if (index > 0 && updatedPhase.position < this.phases[index - 1].position) {
            updatedPhase.position = this.phases[index - 1].position + 0.1;
          }
          
          if (index < this.phases.length - 1 && updatedPhase.position > this.phases[index + 1].position) {
            updatedPhase.position = this.phases[index + 1].position - 0.1;
          }
        }
        
        // Update phase
        this.phases[index] = updatedPhase;
        
        // Re-sort phases if position changed
        if (phaseData.position !== undefined) {
          this.phases.sort((a, b) => a.position - b.position);
          
          // Find new index of the updated phase
          const newIndex = this.phases.findIndex(p => p.id === updatedPhase.id);
          
          // Update active phase index if necessary
          if (this.activePhaseIndex === index) {
            this.activePhaseIndex = newIndex;
          }
        }
        
        console.log(`Phase updated: ${updatedPhase.name}`);
        return true;
      } catch (error) {
        console.error('Error updating phase:', error);
        return false;
      }
    }
  
    /**
     * Get the current active phase
     * @returns {Object|null} The active phase or null if none
     */
    getActivePhase() {
      if (this.activePhaseIndex < 0 || this.activePhaseIndex >= this.phases.length) {
        return null;
      }
      
      return this.phases[this.activePhaseIndex];
    }
  
    /**
     * Get all phases in the timeline
     * @returns {Array} Array of all phases
     */
    getAllPhases() {
      return [...this.phases];
    }
  
    /**
     * Get the elapsed time in the session
     * @returns {number} Elapsed time in ms, or 0 if not started
     */
    getElapsedTime() {
      if (!this.sessionStartTime || !this.isPlaying) {
        return 0;
      }
      
      return Date.now() - this.sessionStartTime;
    }
  
    /**
     * Get the current progress of the session
     * @returns {number} Progress from 0 to 1
     */
    getProgress() {
      if (!this.sessionStartTime || this.sessionDuration <= 0) {
        return 0;
      }
      
      return Math.min(1, this.getElapsedTime() / this.sessionDuration);
    }
  
    /**
     * Get the remaining time in the session
     * @returns {number} Remaining time in ms
     */
    getRemainingTime() {
      if (!this.sessionStartTime || !this.isPlaying) {
        return this.sessionDuration;
      }
      
      const remaining = this.sessionDuration - this.getElapsedTime();
      return Math.max(0, remaining);
    }
  
    /**
     * Manually activate a specific phase
     * @param {number} phaseIndex - Index of the phase to activate
     * @param {Object} options - Activation options
     * @returns {Promise<boolean>} Promise resolving to true if successful
     */
    async activatePhase(phaseIndex, options = {}) {
      if (phaseIndex < 0 || phaseIndex >= this.phases.length) {
        console.error(`Invalid phase index: ${phaseIndex}`);
        return false;
      }
      
      // Extract options with defaults
      const {
        transitionDuration = this.config.defaultTransitionDuration,
        force = false // Force activation even if already active or transitioning
      } = options;
      
      // Skip if already active and not forced
      if (phaseIndex === this.activePhaseIndex && !force) {
        return true;
      }
      
      // Skip if transitioning and not forced
      if (this.isTransitioning && !force) {
        console.warn('Phase transition already in progress, skipping new activation');
        return false;
      }
      
      const phase = this.phases[phaseIndex];
      
      // Skip if phase has no state data
      if (!phase.state) {
        console.warn(`Phase ${phase.name} has no state data, cannot activate`);
        return false;
      }
      
      try {
        // Mark transition as started
        this.isTransitioning = true;
        const prevPhase = this.getActivePhase();
        
        // Notify transition started
        this._notifyObservers('transitionStarted', {
          fromPhase: prevPhase,
          toPhase: phase,
          duration: transitionDuration
        });
        
        // Perform transition
        console.log(`Activating phase ${phase.name} with transition duration ${transitionDuration}ms`);
        
        // Track successful transitions
        let successfulTransitions = 0;
        const totalTransitions = Object.keys(phase.state.volumes || {}).length + 
                                 Object.keys(phase.state.activeAudio || {}).length;
        
        // Apply volume changes using VolumeController
        const volumePromises = [];
        if (phase.state.volumes) {
          for (const [layer, volume] of Object.entries(phase.state.volumes)) {
            volumePromises.push(
              this.volumeController.fadeVolume(layer, volume, {
                duration: transitionDuration,
                onComplete: () => successfulTransitions++
              })
            );
          }
        }
        
        // Apply track changes using CrossfadeEngine
        const crossfadePromises = [];
        if (phase.state.activeAudio) {
          for (const [layer, trackId] of Object.entries(phase.state.activeAudio)) {
            // Only crossfade if not already playing the track
            if (prevPhase?.state?.activeAudio?.[layer] !== trackId) {
              crossfadePromises.push(
                this.crossfadeEngine.startCrossfade(
                  prevPhase?.state?.activeAudio?.[layer] || null, 
                  trackId,
                  prevPhase?.state?.audioUrls?.[layer] || null,
                  phase.state.audioUrls?.[layer] || null,
                  {
                    layerId: layer,
                    duration: transitionDuration,
                    onComplete: () => successfulTransitions++
                  }
                )
              );
            } else {
              // Track already active, count as successful
              successfulTransitions++;
            }
          }
        }
        
        // Wait for all transitions to complete
        await Promise.all([...volumePromises, ...crossfadePromises]);
        
        // Update active phase index
        this.activePhaseIndex = phaseIndex;
        
        // Mark transition as completed
        this.isTransitioning = false;
        
        // Notify transition completed
        this._notifyObservers('transitionCompleted', {
          phase: phase,
          success: successfulTransitions === totalTransitions,
          activeTransitions: successfulTransitions
        });
        
        // Notify phase changed
        this._notifyObservers('phaseChanged', {
          prevPhase,
          newPhase: phase,
          index: phaseIndex
        });
        
        console.log(`Phase ${phase.name} activated successfully`);
        return true;
      } catch (error) {
        console.error(`Error activating phase ${phase.name}:`, error);
        this.isTransitioning = false;
        return false;
      }
    }
  
    /**
     * Set the session duration
     * @param {number} duration - Duration in ms
     */
    setSessionDuration(duration) {
      if (duration <= 0) {
        console.error('Session duration must be positive');
        return;
      }
      
      this.sessionDuration = duration;
    }
  
    /**
     * Register a callback for timeline events
     * @param {string} event - Event type to listen for
     * @param {Function} callback - Callback function
     * @returns {Function} Function to unregister the callback
     */
    on(event, callback) {
      if (!this.callbacks[event]) {
        console.warn(`Unknown event type: ${event}`);
        return () => {};
      }
      
      this.callbacks[event].push(callback);
      
      // Return unsubscribe function
      return () => {
        this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
      };
    }
  
    /**
     * Get the phase at a specific progress point
     * @param {number} progress - Progress value from 0 to 1
     * @returns {Object|null} The phase at the progress point or null
     */
    getPhaseAtProgress(progress) {
      if (!this.phases || this.phases.length === 0) {
        return null;
      }
      
      // Find the last phase that starts before or at the progress point
      for (let i = this.phases.length - 1; i >= 0; i--) {
        if (this.phases[i].position / 100 <= progress) {
          return this.phases[i];
        }
      }
      
      // If no phase found, return the first phase
      return this.phases[0];
    }
    
    /**
     * Create an event based on a phase transition
     * @param {Object} phase - The phase to create an event for
     * @param {Object} options - Options for the event
     * @returns {string|null} ID of the created event, or null if failed
     */
    createPhaseTransitionEvent(phase, options = {}) {
      if (!phase || !phase.id || !phase.position) {
        console.error('Invalid phase object provided');
        return null;
      }
      
      // Calculate event time based on phase position and session duration
      const eventTime = (phase.position / 100) * this.sessionDuration;
      
      // Extract options with defaults
      const {
        transitionDuration = this.config.defaultTransitionDuration,
        priority = 10, // Higher priority than regular events
        name = `Transition to ${phase.name}`,
        category = 'phase_transition',
        data = {}
      } = options;
      
      // Create the event
      const event = {
        name,
        time: eventTime,
        type: 'phase_transition',
        category,
        priority,
        phaseId: phase.id,
        data: {
          phaseId: phase.id,
          phaseName: phase.name,
          phasePosition: phase.position,
          transitionDuration,
          ...data
        },
        // Action function to activate the phase
        action: (event) => {
          const phaseIndex = this.phases.findIndex(p => p.id === event.phaseId);
          if (phaseIndex !== -1) {
            return this.activatePhase(phaseIndex, { 
              transitionDuration: event.data.transitionDuration 
            });
          }
          return Promise.resolve(false);
        }
      };
      
      // Add the event
      return this.addEvent(event);
    }
    
    /**
     * Create events for all phase
  
    /**
     * Start checking for triggered events
     * @private
     */
    _startEventChecking() {
      // Clear existing interval if any
      if (this.eventCheckInterval) {
        clearInterval(this.eventCheckInterval);
      }
      
      // Initialize event checking
      this._updateNextEventIndex();
      
      // Set up interval for checking events
      this.eventCheckInterval = setInterval(() => {
        this._checkEvents();
        this._checkPhases();
        this._updateProgress();
      }, this.config.eventCheckFrequency);
    }
  
    /**
     * Check and trigger any due events
     * @private
     */
    _checkEvents() {
      if (!this.isPlaying || this.events.length === 0 || this.nextEventIndex >= this.events.length) {
        return;
      }
      
      const currentTime = this.getElapsedTime();
      
      // Create a list of events that should be executed at this time
      const eventsToExecute = [];
      
      // Identify events that should be executed
      while (this.nextEventIndex < this.events.length) {
        const event = this.events[this.nextEventIndex];
        const eventTime = event.time + (event.timeOffset || 0);
        
        // Check if the event is due to be executed
        if (currentTime >= eventTime) {
          // If the event is outside its time window, skip it
          if (event.timeWindow > 0 && currentTime > eventTime + event.timeWindow) {
            console.log(`Event ${event.name} outside time window, skipping`);
            this.nextEventIndex++;
            continue;
          }
          
          // Skip if already executed maximum times
          if (event.executionCount >= event.maxExecutions && !event.repeatable) {
            this.nextEventIndex++;
            continue;
          }
          
          // Skip if disabled
          if (!event.enabled) {
            this.nextEventIndex++;
            continue;
          }
          
          // If the event has a condition, check it
          if (event.condition && typeof event.condition === 'function') {
            try {
              const shouldExecute = event.condition(event, currentTime);
              if (!shouldExecute) {
                // Skip this event but don't increment index yet
                // We'll check again next time
                this.nextEventIndex++;
                continue;
              }
            } catch (error) {
              console.error(`Error evaluating condition for event ${event.name}:`, error);
              this.nextEventIndex++;
              continue;
            }
          }
          
          // Add to execution queue
          eventsToExecute.push({
            event,
            index: this.nextEventIndex
          });
          
          this.nextEventIndex++;
        } else {
          // This event is in the future, stop checking
          break;
        }
      }
      
      // Sort events by priority (higher priority first)
      eventsToExecute.sort((a, b) => b.event.priority - a.event.priority);
      
      // Execute events
      for (const { event, index } of eventsToExecute) {
        this._executeEvent(event, currentTime, index);
      }
    }
    
    /**
     * Execute a specific event
     * @param {Object} event - The event to execute
     * @param {number} currentTime - Current session time in ms
     * @param {number} index - Index of the event in the events array
     * @private
     */
    _executeEvent(event, currentTime, index) {
      // Create execution record
      const executionRecord = {
        eventId: event.id,
        eventName: event.name,
        scheduledTime: event.scheduledTime,
        executionTime: currentTime,
        timeDelta: currentTime - event.scheduledTime,
        success: false,
        error: null,
        executionIndex: event.executionCount + 1,
        timestamp: new Date().toISOString()
      };
      
      try {
        // Set timeout for execution if specified
        let timeoutId = null;
        let timedOut = false;
        
        if (event.timeout > 0) {
          timeoutId = setTimeout(() => {
            timedOut = true;
            executionRecord.error = 'Execution timed out';
            executionRecord.success = false;
            
            // Add to history
            this._addToEventHistory(executionRecord);
            
            console.warn(`Event execution timed out: ${event.name}`);
          }, event.timeout);
        }
        
        // Execute action
        const result = event.action(event, {
          currentTime,
          sessionProgress: this.getProgress(),
          activePhase: this.getActivePhase(),
          context: this
        });
        
        // Clear timeout if set
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        
        // Skip further processing if timed out
        if (timedOut) {
          return;
        }
        
        // Mark as executed
        event.executed = true;
        event.executionCount++;
        event.lastExecutionTime = currentTime;
        executionRecord.success = true;
        
        // Handle promises from event actions
        if (result instanceof Promise) {
          result.catch(error => {
            console.error(`Promise error in event ${event.name}:`, error);
            executionRecord.success = false;
            executionRecord.error = error.message;
            
            // Update history entry
            const historyIndex = this.eventHistory.findIndex(
              h => h.eventId === event.id && h.executionTime === currentTime
            );
            
            if (historyIndex !== -1) {
              this.eventHistory[historyIndex] = executionRecord;
            }
          });
        }
        
        // Add to history
        this._addToEventHistory(executionRecord);
        
        // Notify observers
        this._notifyObservers('eventTriggered', {
          event,
          time: currentTime,
          index,
          success: true,
          executionRecord
        });
        
        console.log(`Event triggered: ${event.name} at ${currentTime}ms`);
      } catch (error) {
        console.error(`Error executing event ${event.name}:`, error);
        
        // Record error details
        executionRecord.success = false;
        executionRecord.error = error.message;
        
        // Add to history
        this._addToEventHistory(executionRecord);
        
        // Notify observers about failed execution
        this._notifyObservers('eventTriggered', {
          event,
          time: currentTime,
          index,
          success: false,
          error: error.message,
          executionRecord
        });
      }
    }
    
    /**
     * Add an execution record to the event history
     * @param {Object} record - The execution record
     * @private
     */
    _addToEventHistory(record) {
      // Add to history
      this.eventHistory.unshift(record);
      
      // Limit history size
      if (this.eventHistory.length > this.config.maxEventHistory) {
        this.eventHistory.pop();
      }
    }
    
    /**
     * Manually trigger an event by ID
     * @param {string} eventId - ID of the event to trigger
     * @param {Object} options - Trigger options
     * @returns {boolean} True if event was triggered
     */
    triggerEvent(eventId, options = {}) {
      const event = this.events.find(e => e.id === eventId);
      if (!event) {
        console.error(`Event with ID ${eventId} not found`);
        return false;
      }
      
      // Extract options
      const {
        ignoreCondition = false,
        ignoreEnabled = false,
        ignoreExecutionCount = false,
        customData = null
      } = options;
      
      // Check if event can be triggered
      if (!ignoreEnabled && !event.enabled) {
        console.warn(`Cannot trigger disabled event: ${event.name}`);
        return false;
      }
      
      if (!ignoreExecutionCount && 
          event.executionCount >= event.maxExecutions && 
          !event.repeatable) {
        console.warn(`Event ${event.name} has reached maximum executions`);
        return false;
      }
      
      // Check condition if required
      if (!ignoreCondition && event.condition && typeof event.condition === 'function') {
        try {
          const shouldExecute = event.condition(event, this.getElapsedTime());
          if (!shouldExecute) {
            console.warn(`Event ${event.name} condition not met, not triggering`);
            return false;
          }
        } catch (error) {
          console.error(`Error evaluating condition for event ${event.name}:`, error);
          return false;
        }
      }
      
      // If custom data provided, create a copy of the event with the custom data
      const eventToExecute = customData ? { ...event, data: { ...event.data, ...customData } } : event;
      
      // Execute the event
      this._executeEvent(eventToExecute, this.getElapsedTime(), this.events.indexOf(event));
      
      return true;
    }
  
    /**
     * Check for phase changes based on current progress
     * @private
     */
    _checkPhases() {
      if (!this.isPlaying || this.phases.length === 0 || this.isTransitioning) {
        return;
      }
      
      const progress = this.getProgress();
      
      // Find the appropriate phase for the current progress
      for (let i = this.phases.length - 1; i >= 0; i--) {
        if (this.phases[i].position / 100 <= progress) {
          // Skip if already active
          if (i === this.activePhaseIndex) {
            return;
          }
          
          // Activate the phase
          this.activatePhase(i).catch(error => {
            console.error(`Error during automatic phase activation:`, error);
          });
          
          return;
        }
      }
    }
  
    /**
     * Update progress and notify observers
     * @private
     */
    _updateProgress() {
      if (!this.isPlaying) {
        return;
      }
      
      const progress = this.getProgress();
      
      this._notifyObservers('progressUpdated', {
        progress,
        elapsedTime: this.getElapsedTime(),
        remainingTime: this.getRemainingTime()
      });
    }
  
    /**
     * Update the index of the next event to trigger
     * @private
     */
    _updateNextEventIndex() {
      if (!this.isPlaying || this.events.length === 0) {
        this.nextEventIndex = 0;
        return;
      }
      
      const currentTime = this.getElapsedTime();
      
      // Find the first event that is due after the current time
      for (let i = 0; i < this.events.length; i++) {
        if (this.events[i].time > currentTime || 
            (this.events[i].repeatable && !this.events[i].executed)) {
          this.nextEventIndex = i;
          return;
        }
      }
      
      // If all events are in the past, set to length
      this.nextEventIndex = this.events.length;
    }
  
    /**
     * Activate the phase at a specific position
     * @param {number} position - Position value from 0 to 100
     * @private
     */
    _activatePhaseAtPosition(position) {
      // Find the phase at or closest to the position
      let closestIndex = -1;
      let closestDistance = Infinity;
      
      for (let i = 0; i < this.phases.length; i++) {
        const distance = Math.abs(this.phases[i].position - position);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = i;
        }
      }
      
      if (closestIndex >= 0) {
        this.activatePhase(closestIndex).catch(error => {
          console.error(`Error activating initial phase:`, error);
        });
      }
    }
  
    /**
     * Notify all registered observers for an event
     * @param {string} event - Event type
     * @param {Object} data - Event data
     * @private
     */
    _notifyObservers(event, data) {
      if (!this.callbacks[event]) {
        return;
      }
      
      for (const callback of this.callbacks[event]) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} callback:`, error);
        }
      }
    }
  
    /**
     * Validate phases for consistency
     * @private
     */
    _validatePhases() {
      if (this.phases.length === 0) {
        throw new Error('Timeline requires at least one phase');
      }
      
      // Ensure all phases have unique IDs
      const ids = new Set();
      for (const phase of this.phases) {
        if (!phase.id) {
          throw new Error('All phases must have an ID');
        }
        
        if (ids.has(phase.id)) {
          throw new Error(`Duplicate phase ID: ${phase.id}`);
        }
        
        ids.add(phase.id);
      }
      
      // Ensure positions are within valid range
      for (const phase of this.phases) {
        if (phase.position < 0 || phase.position > 100) {
          throw new Error(`Phase position must be between 0 and 100: ${phase.name}`);
        }
      }
    }
  }
  
  export default TimelineEngine;