/**
 * AudioCore.js
 * Core service for managing Web Audio API context and master output
 */
import logger from '../../services/LoggingService';

class AudioCore {
  /**
   * Create a new AudioCore instance
   * @param {Object} options - Configuration options
   * @param {number} [options.initialVolume=0.8] - Initial master volume (0-1)
   * @param {boolean} [options.autoResume=true] - Auto-resume context on user interaction
   */
  constructor(options = {}) {
    // Configuration
    this.options = {
      initialVolume: options.initialVolume ?? 0.8,
      autoResume: options.autoResume ?? true
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

    logger.debug('AudioCore', 'Instance created with options:', this.options);
  }

  /**
   * Initialize the AudioCore system and Web Audio context
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      if (this._initialized) {
        logger.info('AudioCore', 'Already initialized');
        return true;
      }

      logger.info('AudioCore', 'Initializing audio system...');

      if (typeof window === 'undefined') {
        logger.error('AudioCore', 'Window is not defined (server-side rendering)');
        return false;
      }

      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;

      if (!AudioContext) {
        logger.error('AudioCore', 'Web Audio API not supported in this browser');
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

      logger.info('AudioCore', `Initialized. Context state: ${this._context.state}`);
      return true;
    } catch (error) {
      logger.error('AudioCore', 'Initialization failed:', error);
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
      logger.error('AudioCore', 'Cannot set volume, not initialized');
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
      logger.error('AudioCore', 'Error setting master volume:', error);

      // Fallback to immediate value change
      try {
        this._masterGain.gain.value = safeLevel;
        return true;
      } catch (e) {
        logger.error('AudioCore', 'Fallback volume setting failed:', e);
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
      logger.error('AudioCore', 'Cannot resume, not initialized');
      return false;
    }

    // Only attempt resume if suspended
    if (this._context.state === 'suspended') {
      try {
        logger.debug('AudioCore', 'Attempting to resume context from state:', this._context.state);
        await this._context.resume();
        this._suspended = false;
        logger.info('AudioCore', 'Context resumed successfully, new state:', this._context.state);
        return true;
      } catch (error) {
        logger.error('AudioCore', 'Failed to resume context:', error);
        return false;
      }
    } else {
      logger.debug('AudioCore', 'Context already running, state:', this._context.state);
    }

    return true;
  }

  /**
   * Suspend the audio context to save resources
   * @returns {Promise<boolean>} Success status
   */
  async suspend() {
    if (!this._initialized || !this._context) {
      logger.error('AudioCore', 'Cannot suspend, not initialized');
      return false;
    }

    // Only attempt suspend if running
    if (this._context.state === 'running') {
      try {
        await this._context.suspend();
        this._suspended = true;
        logger.info('AudioCore', 'Context suspended');
        return true;
      } catch (error) {
        logger.error('AudioCore', 'Failed to suspend context:', error);
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
      logger.error('AudioCore', 'Invalid elements provided to registerElements');
      return false;
    }

    logger.info('AudioCore', 'Registering audio elements:',
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
      logger.error('AudioCore', 'Invalid parameters for updateElement');
      return false;
    }

    logger.debug('AudioCore', `Updating element for ${layer}/${trackId}`);

    // Initialize layer if it doesn't exist
    if (!this._audioElements[layer]) {
      this._audioElements[layer] = {};
    }

    // Store the element
    this._audioElements[layer][trackId] = elementData;

    // Log current state after update for debugging
    logger.trace('AudioCore', 'Current audio elements after update:',
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
    logger.debug('AudioCore', 'getElements called, returning:',
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
  }

  /**
   * Handle user interaction events to resume audio context
   * @param {Event} event - The DOM event
   * @private
   */
  _handleUserInteraction(event) {
    if (this._suspended && this._context) {
      logger.debug('AudioCore', 'User interaction detected, attempting to resume');
      this.resume().catch(err => {
        logger.warn('AudioCore', 'Could not resume on user interaction:', err);
      });
    }
  }

  /**
   * Clean up resources used by AudioCore
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
        logger.warn('AudioCore', 'Error closing audio context:', err);
      });
    }

    // Reset state
    this._context = null;
    this._masterGain = null;
    this._analyzer = null;
    this._initialized = false;
    this._suspended = true;
    this._audioElements = {};

    logger.info('AudioCore', 'Cleanup complete');
  }
}

export default AudioCore;
