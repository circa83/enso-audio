/**
 * AudioService.js
 * Core service for managing Web Audio API context and master output
 */

class AudioService {
  /**
   * Create a new AudioService instance
   * @param {Object} options - Configuration options
   * @param {number} [options.initialVolume=0.8] - Initial master volume (0-1)
   * @param {boolean} [options.autoResume=true] - Auto-resume context on user interaction
   * @param {boolean} [options.enableLogging=false] - Enable detailed logging
   */
  constructor(options = {}) {
    // Configuration
    this.options = {
      initialVolume: options.initialVolume ?? 0.8,
      autoResume: options.autoResume ?? true,
      enableLogging: options.enableLogging ?? false
    };

    // Internal state
    this._context = null;
    this._masterGain = null;
    this._analyzer = null;
    this._initialized = false;
    this._suspended = true;
    this._eventListeners = [];
    this._audioElements = {}; // Track audio elements by layer/track

    // Bound methods to maintain context
    this._handleUserInteraction = this._handleUserInteraction.bind(this);

    // Log creation
    this.log('AudioService created');
  }

  /**
   * Log messages with consistent formatting
   * @param {string} message - Message to log
   * @param {string} [level='info'] - Log level
   * @private
   */
  log(message, level = 'info') {
    if (!this.options.enableLogging) return;

    const prefix = '[AudioService]';

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
   * Initialize the AudioService system and Web Audio context
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      if (this._initialized) {
        this.log('AudioService already initialized');
        return true;
      }

      this.log('Initializing AudioService...');

      if (typeof window === 'undefined') {
        this.log('Window is not defined (server-side rendering)', 'error');
        return false;
      }

      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;

      if (!AudioContext) {
        this.log('Web Audio API not supported in this browser', 'error');
        return false;
      }

      this._context = new AudioContext();

      // Create master gain node
      this._masterGain = this._context.createGain();
      this._masterGain.gain.value = this.options.initialVolume;
      this._masterGain.connect(this._context.destination);

      // Create analyzer for visualizations
      this._analyzer = this._context.createAnalyser();
      this._analyzer.fftSize = 64;
      this._analyzer.smoothingTimeConstant = 0.8;
      this._masterGain.connect(this._analyzer);

      // Set up auto-resume 
      if (this.options.autoResume) {
        this._setupAutoResume();
      }

      this._initialized = true;
      this._suspended = this._context.state === 'suspended';

      this.log(`AudioService initialized. Context state: ${this._context.state}`);
      return true;
    } catch (error) {
      this.log(`Initialization failed: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Get the audio context instance
   * @returns {AudioContext|null} The Web Audio context or null if not initialized
   */
  getContext() {
    return this._context;
  }

  /**
   * Get the master gain node
   * @returns {GainNode|null} The master gain node or null if not initialized
   */
  getMasterGain() {
    return this._masterGain;
  }

  /**
   * Get the analyzer node
   * @returns {AnalyserNode|null} The analyzer node or null if not initialized
   */
  getAnalyzer() {
    return this._analyzer;
  }

  /**
   * Set the master volume level
   * @param {number} level - Volume level between 0 and 1
   * @returns {boolean} Success status
   */
  setMasterVolume(level) {
    if (!this._initialized || !this._masterGain) {
      this.log('Cannot set volume, not initialized', 'error');
      return false;
    }

    // Clamp volume between 0 and 1
    const safeLevel = Math.max(0, Math.min(1, level));

    try {
      // Use a small time constant for smooth transition
      const now = this._context.currentTime;
      this._masterGain.gain.setTargetAtTime(safeLevel, now, 0.01);
      return true;
    } catch (error) {
      this.log(`Error setting master volume: ${error.message}`, 'error');

      // Fallback to immediate value change
      try {
        this._masterGain.gain.value = safeLevel;
        return true;
      } catch (e) {
        this.log(`Fallback volume setting failed: ${e.message}`, 'error');
        return false;
      }
    }
  }

  /**
   * Get the current master volume level
   * @returns {number} Current volume level (0-1)
   */
  getMasterVolume() {
    if (!this._initialized || !this._masterGain) {
      return this.options.initialVolume;
    }
    return this._masterGain.gain.value;
  }

  /**
   * Resume the audio context
   * @returns {Promise<boolean>} Success status
   */
  async resume() {
    if (!this._initialized || !this._context) {
      this.log('Cannot resume, not initialized', 'error');
      return false;
    }

    // Only attempt resume if suspended
    if (this._context.state === 'suspended') {
      try {
        this.log(`Attempting to resume context from state: ${this._context.state}`);
        await this._context.resume();
        this._suspended = false;
        this.log(`Context resumed successfully, new state: ${this._context.state}`);
        return true;
      } catch (error) {
        this.log(`Failed to resume context: ${error.message}`, 'error');
        return false;
      }
    } else {
      this.log(`Context already running, state: ${this._context.state}`);
    }

    return true;
  }

  /**
   * Suspend the audio context to save resources
   * @returns {Promise<boolean>} Success status
   */
  async suspend() {
    if (!this._initialized || !this._context) {
      this.log('Cannot suspend, not initialized', 'error');
      return false;
    }

    // Only attempt suspend if running
    if (this._context.state === 'running') {
      try {
        await this._context.suspend();
        this._suspended = true;
        this.log('Context suspended');
        return true;
      } catch (error) {
        this.log(`Failed to suspend context: ${error.message}`, 'error');
        return false;
      }
    }

    return true;
  }

  /**
   * Check if the audio context is currently suspended
   * @returns {boolean} True if suspended, false otherwise
   */
  isSuspended() {
    if (!this._initialized || !this._context) {
      return true;
    }
    return this._context.state === 'suspended';
  }

  /**
   * Register audio elements for tracking
   * @param {Object} elements - Map of layer names to audio element objects
   * @returns {boolean} Success status
   */
  registerElements(elements) {
    if (!elements || typeof elements !== 'object') {
      this.log('Invalid elements provided to registerElements', 'error');
      return false;
    }

    this.log('Registering audio elements: ' +
      Object.keys(elements).map(layer => {
        const trackIds = Object.keys(elements[layer] || {});
        return `${layer}: ${trackIds.join(', ')}`;
      })
    );

    // Store the elements directly without modifying their structure
    this._audioElements = { ...elements };
    return true;
  }

  /**
   * Update a single audio element
   * @param {string} layer - Layer identifier
   * @param {string} trackId - Track identifier
   * @param {Object} elementData - Audio element data
   * @returns {boolean} Success status
   */
  updateElement(layer, trackId, elementData) {
    if (!layer || !trackId || !elementData) {
      this.log('Invalid parameters for updateElement', 'error');
      return false;
    }

    this.log(`Updating element for ${layer}/${trackId}`);

    // Initialize layer if it doesn't exist
    if (!this._audioElements[layer]) {
      this._audioElements[layer] = {};
    }

    // Store the element
    this._audioElements[layer][trackId] = elementData;

    // Log current state after update for debugging
    this.log('Current audio elements after update: ' +
      Object.keys(this._audioElements).map(layer => {
        const trackIds = Object.keys(this._audioElements[layer] || {});
        return `${layer}: ${trackIds.join(', ')}`;
      })
    );

    return true;
  }

  /**
   * Get all registered audio elements
   * @returns {Object} Map of audio elements by layer and track ID
   */
  getElements() {
    this.log('getElements called, returning: ' +
      Object.keys(this._audioElements).map(layer =>
        `${layer}: ${Object.keys(this._audioElements[layer] || {}).join(', ')}`
      )
    );
    return this._audioElements;
  }

  /**
   * Set up event listeners to auto-resume context on user interaction
   * @private
   */
  _setupAutoResume() {
    if (typeof window === 'undefined') return;

    // List of events that can be used to resume audio context
    const events = ['click', 'touchstart', 'keydown'];

    const handleEvent = this._handleUserInteraction;

    // Add event listeners
    events.forEach(eventType => {
      window.addEventListener(eventType, handleEvent, { once: false, passive: true });
      this._eventListeners.push({ type: eventType, handler: handleEvent });
    });

    this.log('Auto-resume event listeners set up');
  }

  /**
   * Handle user interaction events to resume audio context
   * @param {Event} event - The DOM event
   * @private
   */
  _handleUserInteraction(event) {
    if (this._suspended && this._context) {
      this.log('User interaction detected, attempting to resume');
      this.resume().catch(err => {
        this.log(`Could not resume on user interaction: ${err.message}`, 'warn');
      });
    }
  }

  /**
   * Clean up resources used by AudioService
   * This should be called when the service is no longer needed
   */
  cleanup() {
    // Remove all event listeners
    this._eventListeners.forEach(({ type, handler }) => {
      window.removeEventListener(type, handler);
    });
    this._eventListeners = [];

    // Close the audio context if it exists
    if (this._context && typeof this._context.close === 'function') {
      this._context.close().catch(err => {
        this.log(`Error closing audio context: ${err.message}`, 'warn');
      });
    }

    // Reset state
    this._context = null;
    this._masterGain = null;
    this._analyzer = null;
    this._initialized = false;
    this._suspended = true;
    this._audioElements = {};

    this.log('Cleanup complete');
  }
}

export default AudioService;
