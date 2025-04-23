/**
 * EventBus.js
 * 
 * Centralized event management system for cross-service communication
 * Enables loosely coupled communication between modules
 */

class EventBus {
    constructor(options = {}) {
      this.listeners = new Map();
      this.oneTimeListeners = new Map();
      this.debugMode = options.debug || false;
      this.eventLog = [];
      this.maxLogSize = options.maxLogSize || 100;
      this.listenerCounts = {};
    }
  
    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @param {Object} options - Options object
     * @param {Object} options.context - Context to bind to callback
     * @param {boolean} options.once - Whether to remove listener after first call
     * @returns {Function} Unsubscribe function
     */
    on(event, callback, options = {}) {
      if (typeof callback !== 'function') {
        console.error(`[EventBus] on('${event}'): Callback must be a function`);
        return () => {}; // Return no-op unsubscribe
      }
  
      if (this.debugMode) {
        console.log(`[EventBus] Subscribing to '${event}'`);
      }
  
      // Handle once option
      if (options.once === true) {
        return this.once(event, callback, options);
      }
  
      // Create listener with context if provided
      const listener = options.context ? callback.bind(options.context) : callback;
      
      // Get or create the listeners array for this event
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      
      this.listeners.get(event).push(listener);
      
      // Update listener counts for debugging
      this.listenerCounts[event] = (this.listenerCounts[event] || 0) + 1;
  
      // Return unsubscribe function
      return () => {
        this.off(event, callback);
      };
    }
  
    /**
     * Subscribe to an event for one-time execution
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @param {Object} options - Options object
     * @returns {Function} Unsubscribe function
     */
    once(event, callback, options = {}) {
      if (typeof callback !== 'function') {
        console.error(`[EventBus] once('${event}'): Callback must be a function`);
        return () => {}; // Return no-op unsubscribe
      }
  
      if (this.debugMode) {
        console.log(`[EventBus] Subscribing once to '${event}'`);
      }
  
      // Create wrapper that calls callback once then unsubscribes
      const listener = options.context ? callback.bind(options.context) : callback;
      
      // Get or create the one-time listeners array for this event
      if (!this.oneTimeListeners.has(event)) {
        this.oneTimeListeners.set(event, []);
      }
      
      this.oneTimeListeners.get(event).push(listener);
      
      // Update listener counts for debugging
      this.listenerCounts[event] = (this.listenerCounts[event] || 0) + 1;
  
      // Return unsubscribe function
      return () => {
        this.offOnce(event, callback);
      };
    }
  
    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function to remove
     */
    off(event, callback) {
      if (!this.listeners.has(event)) return;
      
      const listeners = this.listeners.get(event);
      const index = listeners.indexOf(callback);
      
      if (index !== -1) {
        listeners.splice(index, 1);
        
        // Update listener counts
        this.listenerCounts[event]--;
        
        if (this.debugMode) {
          console.log(`[EventBus] Unsubscribed from '${event}'`);
        }
      }
      
      // Clean up empty arrays
      if (listeners.length === 0) {
        this.listeners.delete(event);
      }
    }
  
    /**
     * Unsubscribe from a one-time event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function to remove
     */
    offOnce(event, callback) {
      if (!this.oneTimeListeners.has(event)) return;
      
      const listeners = this.oneTimeListeners.get(event);
      const index = listeners.indexOf(callback);
      
      if (index !== -1) {
        listeners.splice(index, 1);
        
        // Update listener counts
        this.listenerCounts[event]--;
        
        if (this.debugMode) {
          console.log(`[EventBus] Unsubscribed from once '${event}'`);
        }
      }
      
      // Clean up empty arrays
      if (listeners.length === 0) {
        this.oneTimeListeners.delete(event);
      }
    }
  
    /**
     * Emit an event to all subscribers
     * @param {string} event - Event name
     * @param {any} payload - Event data
     * @returns {boolean} Whether the event had listeners
     */
    emit(event, payload = {}) {
      const hasRegularListeners = this.listeners.has(event);
      const hasOneTimeListeners = this.oneTimeListeners.has(event);
      
      if (!hasRegularListeners && !hasOneTimeListeners) {
        if (this.debugMode) {
          console.log(`[EventBus] Event '${event}' emitted but no listeners`);
        }
        
        // Log the event
        this._addToEventLog({
          event,
          payload,
          time: Date.now(),
          hasListeners: false
        });
        
        return false;
      }
      
      if (this.debugMode) {
        console.log(`[EventBus] Emitting '${event}'`, payload);
      }
      
      // Log the event before calling listeners
      this._addToEventLog({
        event,
        payload,
        time: Date.now(),
        hasListeners: true, 
        listenerCount: (this.listeners.get(event)?.length || 0) + 
                      (this.oneTimeListeners.get(event)?.length || 0)
      });
      
      // Call regular listeners
      if (hasRegularListeners) {
        try {
          this.listeners.get(event).forEach((callback) => {
            try {
              callback(payload);
            } catch (err) {
              console.error(`[EventBus] Error in '${event}' listener:`, err);
            }
          });
        } catch (err) {
          console.error(`[EventBus] Error processing '${event}' listeners:`, err);
        }
      }
      
      // Call one-time listeners
      if (hasOneTimeListeners) {
        try {
          // Get listeners and clear the array immediately to prevent issues
          // if a listener calls emit again during execution
          const oneTimeCallbacks = [...this.oneTimeListeners.get(event)];
          this.oneTimeListeners.delete(event);
          
          // Update count
          this.listenerCounts[event] -= oneTimeCallbacks.length;
          
          // Call each one-time listener
          oneTimeCallbacks.forEach((callback) => {
            try {
              callback(payload);
            } catch (err) {
              console.error(`[EventBus] Error in one-time '${event}' listener:`, err);
            }
          });
        } catch (err) {
          console.error(`[EventBus] Error processing one-time '${event}' listeners:`, err);
        }
      }
      
      return true;
    }
  
    /**
     * Add an event to the event log for debugging
     * @private
     * @param {Object} eventData - Event data to log
     */
    _addToEventLog(eventData) {
      this.eventLog.push(eventData);
      
      // Maintain max log size
      if (this.eventLog.length > this.maxLogSize) {
        this.eventLog.shift();
      }
    }
  
    /**
     * Get the event log
     * @returns {Array} Event log
     */
    getEventLog() {
      return [...this.eventLog];
    }
  
    /**
     * Clear the event log
     */
    clearEventLog() {
      this.eventLog = [];
    }
  
    /**
     * Get statistics about event listeners
     * @returns {Object} Listener statistics
     */
    getStats() {
      return {
        events: this.listeners.size + this.oneTimeListeners.size,
        totalListeners: Object.values(this.listenerCounts).reduce((a, b) => a + b, 0),
        listenerCounts: {...this.listenerCounts}
      };
    }
  
    /**
     * Remove all listeners for an event
     * @param {string} event - Event name
     */
    clearEvent(event) {
      if (this.listeners.has(event)) {
        this.listeners.delete(event);
      }
      
      if (this.oneTimeListeners.has(event)) {
        this.oneTimeListeners.delete(event);
      }
      
      delete this.listenerCounts[event];
      
      if (this.debugMode) {
        console.log(`[EventBus] Cleared all listeners for '${event}'`);
      }
    }
  
    /**
     * Enable or disable debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebug(enabled) {
      this.debugMode = !!enabled;
    }
  }
  
  // Create a singleton instance
  const eventBus = new EventBus({ 
    debug: process.env.NODE_ENV === 'development',
    maxLogSize: 200
  });
  
  export default eventBus;
  
  // Export event name constants for better type safety
  export const EVENTS = {
    // Audio events
    AUDIO_INITIALIZED: 'audio:initialized',
    AUDIO_PLAY_STARTED: 'audio:playStarted',
    AUDIO_PLAY_STOPPED: 'audio:playStopped',
    AUDIO_ERROR: 'audio:error',
    
    // Volume events
    VOLUME_CHANGED: 'volume:changed',
    VOLUME_MUTED: 'volume:muted',
    VOLUME_UNMUTED: 'volume:unmuted',
    
    // Buffer events
    BUFFER_LOADED: 'buffer:loaded',
    BUFFER_LOAD_PROGRESS: 'buffer:loadProgress',
    BUFFER_ERROR: 'buffer:error',
    BUFFER_CACHE_CLEARED: 'buffer:cacheCleared',
    
    // Collection events
    COLLECTIONS_LOADED: 'collections:loaded',
    COLLECTION_SELECTED: 'collection:selected',
    COLLECTION_FORMATTED: 'collection:formatted', 
    COLLECTION_ERROR: 'collection:error',
    
    // Timeline events
    TIMELINE_STARTED: 'timeline:started',
    TIMELINE_STOPPED: 'timeline:stopped',
    TIMELINE_PAUSED: 'timeline:paused',
    TIMELINE_RESUMED: 'timeline:resumed',
    TIMELINE_PHASE_CHANGED: 'timeline:phaseChanged',
    TIMELINE_PROGRESS: 'timeline:progress',
    TIMELINE_EVENT_TRIGGERED: 'timeline:eventTriggered'
  };
  