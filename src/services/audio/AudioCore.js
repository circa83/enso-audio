/**
 * AudioCore.js
 * Core service for managing Web Audio API context and fundamental audio operations
 */

class AudioCore {
    /**
     * Creates a new AudioCore instance
     * @param {Object} config - Configuration options
     */
    constructor(config = {}) {
      this.audioContext = null;
      this.masterGain = null;
      this.initialized = false;
      this.config = {
        // Default configuration options
        sampleRate: 44100,
        latencyHint: 'interactive',
        ...config
      };
    }
  
    /**
     * Initialize the Web Audio API context
     * @returns {Promise<AudioContext>} The initialized audio context
     */
    async initialize() {
      if (this.initialized) {
        return this.audioContext;
      }
  
      try {
        // Create new AudioContext with configuration
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: this.config.sampleRate,
          latencyHint: this.config.latencyHint
        });
        
        // Create master gain node for global volume control
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 1.0; // Default to full volume
        this.masterGain.connect(this.audioContext.destination);
        
        this.initialized = true;
        return this.audioContext;
      } catch (error) {
        console.error('Failed to initialize Audio Context:', error);
        throw new Error('Audio system initialization failed');
      }
    }
  
    /**
     * Resume the audio context (needed after user interaction)
     * @returns {Promise<void>}
     */
    async resume() {
      if (!this.audioContext) {
        throw new Error('Audio context not initialized');
      }
  
      if (this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
        } catch (error) {
          console.error('Failed to resume audio context:', error);
          throw error;
        }
      }
    }
  
    /**
     * Set the master volume level
     * @param {number} level - Volume level from 0 to 1
     */
    setMasterVolume(level) {
      if (!this.masterGain) {
        return;
      }
      
      // Clamp the volume level between 0 and 1
      const volume = Math.max(0, Math.min(1, level));
      this.masterGain.gain.value = volume;
    }
  
    /**
     * Clean up resources and close the audio context
     * @returns {Promise<void>}
     */
    async dispose() {
      if (this.audioContext && this.audioContext.state !== 'closed') {
        try {
          await this.audioContext.close();
          this.initialized = false;
          this.audioContext = null;
          this.masterGain = null;
        } catch (error) {
          console.error('Error closing audio context:', error);
          throw error;
        }
      }
    }
  }
  
  export default AudioCore;