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
      // Core audio properties
      this.audioContext = null;
      this.masterGain = null;
      this.analyzer = null;
      
      // State tracking
      this.initialized = false;
      this.suspended = true;
      this.volumeLevel = 1.0;
      
      // Node registry for tracking all created nodes
      this.nodes = new Map();
      
      // Configuration with defaults
      this.config = {
        sampleRate: 44100,
        latencyHint: 'interactive',
        fftSize: 1024,  // For analyzer node
        masterVolume: 0.8,
        ...config
      };
      
      // Bound methods to preserve "this" context
      this.handleStateChange = this.handleStateChange.bind(this);
      this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    }
  
    /**
     * Initialize the Web Audio API context
     * @returns {Promise<AudioContext>} The initialized audio context
     */
    async initialize() {
      if (this.initialized && this.audioContext) {
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
        this.masterGain.gain.value = this.config.masterVolume;
        this.masterGain.connect(this.audioContext.destination);
        this.registerNode('masterGain', this.masterGain);
        
        // Create analyzer node for visualizations
        this.analyzer = this.audioContext.createAnalyser();
        this.analyzer.fftSize = this.config.fftSize;
        this.analyzer.smoothingTimeConstant = 0.85;
        this.masterGain.connect(this.analyzer);
        this.registerNode('analyzer', this.analyzer);
        
        // Set up event listeners for audio context state changes
        this.audioContext.addEventListener('statechange', this.handleStateChange);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Store the initial state
        this.suspended = this.audioContext.state === 'suspended';
        this.volumeLevel = this.config.masterVolume;
        this.initialized = true;
        
        console.log(`Audio context initialized: ${this.audioContext.state}`);
        return this.audioContext;
      } catch (error) {
        console.error('Failed to initialize Audio Context:', error);
        throw new Error(`Audio system initialization failed: ${error.message}`);
      }
    }
  
    /**
     * Resume the audio context (needed after user interaction)
     * @returns {Promise<void>}
     */
    async resume() {
      if (!this.audioContext) {
        await this.initialize();
      }
  
      if (this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
          this.suspended = false;
          console.log('Audio context resumed');
        } catch (error) {
          console.error('Failed to resume audio context:', error);
          throw error;
        }
      }
    }
    
    /**
     * Suspend the audio context to save resources
     * @returns {Promise<void>}
     */
    async suspend() {
      if (!this.audioContext || this.audioContext.state !== 'running') {
        return;
      }
      
      try {
        await this.audioContext.suspend();
        this.suspended = true;
        console.log('Audio context suspended');
      } catch (error) {
        console.error('Failed to suspend audio context:', error);
        throw error;
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
      
      // Apply value to gain node and store current level
      this.masterGain.gain.value = volume;
      this.volumeLevel = volume;
    }
  
    /**
     * Get the current master volume level
     * @returns {number} Volume level from 0 to 1
     */
    getMasterVolume() {
      return this.volumeLevel;
    }
    
    /**
     * Create a gain node for individual volume control
     * @param {string} id - Unique identifier for the node
     * @param {number} initialVolume - Initial volume level (0-1)
     * @returns {GainNode} The created gain node
     */
    createGainNode(id, initialVolume = 1.0) {
      if (!this.audioContext) {
        throw new Error('Audio context not initialized');
      }
      
      try {
        // Create and configure gain node
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = Math.max(0, Math.min(1, initialVolume));
        
        // Connect to master gain by default
        gainNode.connect(this.masterGain);
        
        // Register node for later reference
        this.registerNode(id, gainNode);
        
        return gainNode;
      } catch (error) {
        console.error(`Failed to create gain node ${id}:`, error);
        throw error;
      }
    }
    
    /**
     * Get audio time data for visualization
     * @returns {Uint8Array} Array of time domain data
     */
    getTimeData() {
      if (!this.analyzer) {
        return new Uint8Array(0);
      }
      
      const dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
      this.analyzer.getByteTimeDomainData(dataArray);
      return dataArray;
    }
    
    /**
     * Get audio frequency data for visualization
     * @returns {Uint8Array} Array of frequency data
     */
    getFrequencyData() {
      if (!this.analyzer) {
        return new Uint8Array(0);
      }
      
      const dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
      this.analyzer.getByteFrequencyData(dataArray);
      return dataArray;
    }
    
    /**
     * Get a registered audio node by ID
     * @param {string} id - The node identifier
     * @returns {AudioNode|null} The audio node or null if not found
     */
    getNode(id) {
      return this.nodes.get(id) || null;
    }
    
    /**
     * Register an audio node for tracking
     * @param {string} id - Unique identifier for the node
     * @param {AudioNode} node - The audio node to register
     */
    registerNode(id, node) {
      if (this.nodes.has(id)) {
        console.warn(`Node with ID ${id} already exists, overwriting`);
      }
      this.nodes.set(id, node);
    }
    
    /**
     * Unregister and disconnect an audio node
     * @param {string} id - The node identifier
     * @returns {boolean} True if node was found and removed
     */
    removeNode(id) {
      const node = this.nodes.get(id);
      if (!node) {
        return false;
      }
      
      try {
        // Disconnect the node
        node.disconnect();
        // Remove from registry
        this.nodes.delete(id);
        return true;
      } catch (error) {
        console.error(`Error removing node ${id}:`, error);
        return false;
      }
    }
    
    /**
     * Get the current audio context time
     * @returns {number} Current audio context time in seconds
     */
    getCurrentTime() {
      if (!this.audioContext) {
        return 0;
      }
      return this.audioContext.currentTime;
    }
    
    /**
     * Handle audio context state changes
     * @param {Event} event - The state change event
     * @private
     */
    handleStateChange(event) {
      const state = this.audioContext.state;
      console.log(`Audio context state changed: ${state}`);
      this.suspended = state === 'suspended';
      
      // Dispatch custom event for the app to react to state changes
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('audio-state-change', { 
          detail: { state: state }
        }));
      }
    }
    
    /**
     * Handle document visibility changes to manage audio context
     * @param {Event} event - The visibility change event
     * @private
     */
    handleVisibilityChange(event) {
      if (document.hidden && this.audioContext?.state === 'running') {
        // Auto-suspend when page is hidden to save resources
        this.suspend().catch(err => console.warn('Failed to auto-suspend:', err));
      }
    }
  
    /**
     * Clean up resources and close the audio context
     * @returns {Promise<void>}
     */
    async dispose() {
      // Remove event listeners first
      if (this.audioContext) {
        this.audioContext.removeEventListener('statechange', this.handleStateChange);
      }
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      
      // Disconnect and unregister all nodes
      for (const [id, node] of this.nodes.entries()) {
        try {
          node.disconnect();
        } catch (error) {
          console.warn(`Failed to disconnect node ${id}:`, error);
        }
      }
      this.nodes.clear();
      
      // Close the audio context
      if (this.audioContext && this.audioContext.state !== 'closed') {
        try {
          await this.audioContext.close();
          this.initialized = false;
          this.audioContext = null;
          this.masterGain = null;
          this.analyzer = null;
          console.log('Audio context closed and resources released');
        } catch (error) {
          console.error('Error closing audio context:', error);
          throw error;
        }
      }
    }
    
    /**
     * Check if the audio system is fully initialized
     * @returns {boolean} True if initialized
     */
    isInitialized() {
      return this.initialized && this.audioContext !== null;
    }
    
    /**
     * Check if the audio context is currently suspended
     * @returns {boolean} True if suspended
     */
    isSuspended() {
      return this.suspended;
    }
  }
  
  export default AudioCore;