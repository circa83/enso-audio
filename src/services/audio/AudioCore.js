// src/services/audio/AudioCore.js - Updated with fixes

/**
 * AudioCore.js
 * 
 * Core audio functionality service for Ensō Audio.
 * Handles Web Audio API context creation, audio element initialization,
 * basic playback controls, and master volume.
 */

// Audio layer constants - duplicated here for independence
const LAYERS = {
  DRONE: 'drone',
  MELODY: 'melody',
  RHYTHM: 'rhythm',
  NATURE: 'nature'
};

class AudioCore {
  constructor() {
    // Core audio properties
    this.audioContext = null;
    this.masterGain = null;
    this.gainNodes = {};
    this.audioElements = {};
    this.sourceNodes = {}; // Added to track source nodes
    this.masterVolume = 0.8; // Default to 80%
    this.isPlaying = false;
    this.sessionStartTime = null;
    this.onStateChange = null; // Callback for state changes
    
    // Initialize empty structures for each layer
    Object.values(LAYERS).forEach(layer => {
      const layerId = layer.toLowerCase();
      this.audioElements[layerId] = {};
      this.gainNodes[layerId] = null;
      this.sourceNodes[layerId] = {};  // Initialize sourceNodes structure
    });
    
    // Debug flag for logging
    this.debug = false;
  }

  /**
   * Enable/disable debug logging
   * @param {boolean} enabled - Whether to enable logging
   */
  setDebug(enabled) {
    this.debug = enabled;
  }

  /**
   * Log debug information if debug is enabled
   * @param {string} message - Message to log
   * @param {*} data - Optional data to log
   * @private
   */
  log(message, data) {
    if (this.debug) {
      if (data) {
        console.log(`[AudioCore] ${message}`, data);
      } else {
        console.log(`[AudioCore] ${message}`);
      }
    }
  }

  /**
   * Initialize the Web Audio API context and basic audio graph
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      if (typeof window === 'undefined') return false;
      
      // Create new AudioContext
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        console.error('Web Audio API not supported in this browser');
        return false;
      }
      
      this.audioContext = new AudioContextClass();
      this.log('AudioContext created', this.audioContext);
      
      // Create master gain node
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.audioContext.destination);
      this.log('Master gain node created and connected');
      
      // Create gain nodes for each layer
      Object.values(LAYERS).forEach(layer => {
        const layerId = layer.toLowerCase();
        const gainNode = this.audioContext.createGain();
        gainNode.connect(this.masterGain);
        this.gainNodes[layerId] = gainNode;
        this.log(`Created gain node for ${layerId}`);
      });
      
      return true;
    } catch (error) {
      console.error('Error initializing audio context:', error);
      return false;
    }
  }

  /**
   * Create and set up an audio element
   * @param {string} layer - The audio layer (drone, melody, etc.)
   * @param {string} trackId - Unique identifier for the track
   * @param {string} sourcePath - Path to audio file
   * @param {number} initialVolume - Initial volume level (0-1)
   * @returns {Promise<Object|null>} The created audio element and source or null if failed
   */
  async createAudioElement(layer, trackId, sourcePath, initialVolume = 0) {
    const layerId = layer.toLowerCase();
    
    if (!this.audioContext || !this.gainNodes[layerId]) {
      console.error('Audio context not initialized or invalid layer');
      return null;
    }
    
    try {
      // Create new audio element
      const audioElement = new Audio();
      audioElement.preload = 'auto';
      audioElement.loop = true;
      audioElement.crossOrigin = 'anonymous'; // Enable CORS if needed
      audioElement.src = sourcePath;
      
      this.log(`Creating audio element for ${layerId}/${trackId}`, sourcePath);
      
      // Create a promise to track loading
      const loadPromise = new Promise((resolve, reject) => {
        const loadHandler = () => {
          this.log(`Audio loaded for ${layerId}/${trackId}`);
          resolve(true);
        };
        
        audioElement.addEventListener('canplaythrough', loadHandler, { once: true });
        
        audioElement.addEventListener('error', (e) => {
          console.error(`Error loading audio ${layerId}/${trackId}:`, e);
          reject(new Error(`Error loading audio: ${e.message || 'unknown error'}`));
        }, { once: true });
        
        // Set a timeout to avoid hanging
        setTimeout(() => {
          this.log(`Timeout reached for ${layerId}/${trackId}, continuing anyway`);
          resolve(true); // Resolve anyway after timeout to prevent hanging
        }, 10000);
      });
      
      // Start loading
      audioElement.load();
      
      // Wait for loading or timeout
      await loadPromise;
      
      // Create media element source
      const source = this.audioContext.createMediaElementSource(audioElement);
      source.connect(this.gainNodes[layerId]);
      
      this.log(`Connected audio source for ${layerId}/${trackId} to gain node`);
      
      // Store the audio element and source node
      this.audioElements[layerId][trackId] = {
        element: audioElement,
        source: source,
        isActive: false,
        track: { id: trackId, path: sourcePath }
      };
      
      // Store source node reference
      this.sourceNodes[layerId][trackId] = source;
      
      return {
        element: audioElement,
        source: source,
        track: { id: trackId, path: sourcePath }
      };
    } catch (error) {
      console.error(`Error creating audio element for ${layerId}/${trackId}:`, error);
      return null;
    }
  }

  /**
   * Get an audio element for a layer and track
   * @param {string} layer - The audio layer
   * @param {string} trackId - The track ID
   * @returns {HTMLAudioElement|null} The audio element or null if not found
   */
  getAudioElement(layer, trackId) {
    const layerId = layer.toLowerCase();
    return this.audioElements[layerId]?.[trackId]?.element || null;
  }

  /**
   * Set master volume level
   * @param {number} level - Volume level (0-1)
   */
  setMasterVolume(level) {
    if (!this.masterGain) return;
    
    // Clamp volume between 0 and 1
    const volume = Math.max(0, Math.min(1, level));
    this.masterVolume = volume;
    
    // Apply to master gain node with slight smoothing
    if (this.audioContext && this.masterGain.gain) {
      const now = this.audioContext.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(volume, now + 0.05);
    } else {
      // Fallback if no audio context
      this.masterGain.gain.value = volume;
    }
    
    this.log(`Master volume set to ${volume}`);
  }

  /**
   * Set volume for a specific layer
   * @param {string} layer - The audio layer
   * @param {number} level - Volume level (0-1)
   */
  setLayerVolume(layer, level) {
    const layerId = layer.toLowerCase();
    if (!this.gainNodes[layerId]) return;
    
    // Clamp volume between 0 and 1
    const volume = Math.max(0, Math.min(1, level));
    
    // Apply to gain node with smoothing
    if (this.audioContext && this.gainNodes[layerId].gain) {
      const now = this.audioContext.currentTime;
      this.gainNodes[layerId].gain.cancelScheduledValues(now);
      this.gainNodes[layerId].gain.setValueAtTime(this.gainNodes[layerId].gain.value, now);
      this.gainNodes[layerId].gain.linearRampToValueAtTime(volume, now + 0.05);
    } else {
      // Fallback
      this.gainNodes[layerId].gain.value = volume;
    }
    
    this.log(`Volume for ${layerId} set to ${volume}`);
  }

  /**
   * Get current master volume level
   * @returns {number} Volume level (0-1)
   */
  getMasterVolume() {
    return this.masterVolume;
  }

  /**
   * Get volume level for a specific layer
   * @param {string} layer - The audio layer
   * @returns {number} Volume level (0-1)
   */
  getLayerVolume(layer) {
    const layerId = layer.toLowerCase();
    if (!this.gainNodes[layerId]) return 0;
    return this.gainNodes[layerId].gain.value;
  }

  /**
   * Start playback of specific audio elements
   * @param {Object} activeElements - Map of layer to trackId
   * @param {Object} volumes - Map of layer to volume level
   * @returns {Promise<boolean>} Success status
   */
  async startPlayback(activeElements, volumes) {
    if (!this.audioContext) {
      console.error('Audio context not initialized');
      return false;
    }
    
    try {
      this.log('Starting playback', { activeElements, volumes });
      
      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        this.log('Resuming suspended audio context');
        await this.audioContext.resume();
      }
      
      // Log the audio context state
      this.log(`Audio context state: ${this.audioContext.state}`);
      
      // Set volumes for each layer
      Object.entries(volumes).forEach(([layer, volume]) => {
        this.setLayerVolume(layer, volume);
      });
      
      // Play all active elements
      const playPromises = [];
      
      Object.entries(activeElements).forEach(([layer, trackId]) => {
        if (!trackId) {
          this.log(`No track ID for layer ${layer}, skipping`);
          return;
        }
        
        const layerId = layer.toLowerCase();
        const track = this.audioElements[layerId][trackId];
        
        if (!track || !track.element) {
          this.log(`No track found for ${layerId}/${trackId}`);
          return;
        }
        
        this.log(`Starting playback of ${layerId}/${trackId}`);
        
        // Reset to beginning of track
        track.element.currentTime = 0;
        
        // Make sure the source is properly connected
        if (track.source && !track.isActive) {
          // Reconnect if needed
          try {
            track.source.disconnect();
          } catch (e) {
            // Ignore disconnection errors
          }
          track.source.connect(this.gainNodes[layerId]);
          track.isActive = true;
        }
        
        // Start playback
        const playPromise = track.element.play().catch(error => {
          console.error(`Error playing ${layerId}/${trackId}:`, error);
          return null;
        });
        
        playPromises.push(playPromise);
      });
      
      // Wait for all play operations to complete
      await Promise.all(playPromises);
      
      // Update state
      this.isPlaying = true;
      this.sessionStartTime = Date.now();
      
      // Notify state change
      if (this.onStateChange) {
        this.onStateChange({ isPlaying: true });
      }
      
      this.log('Playback started successfully');
      return true;
    } catch (error) {
      console.error('Error starting playback:', error);
      return false;
    }
  }

  /**
   * Pause all active audio elements
   * @returns {boolean} Success status
   */
  pausePlayback() {
    try {
      this.log('Pausing playback');
      
      // Pause all audio elements
      Object.values(LAYERS).forEach(layer => {
        const layerId = layer.toLowerCase();
        Object.values(this.audioElements[layerId]).forEach(track => {
          if (track && track.element) {
            track.element.pause();
            this.log(`Paused ${layerId}/${track.track.id}`);
          }
        });
      });
      
      // Update state
      this.isPlaying = false;
      
      // Notify state change
      if (this.onStateChange) {
        this.onStateChange({ isPlaying: false });
      }
      
      this.log('Playback paused successfully');
      return true;
    } catch (error) {
      console.error('Error pausing playback:', error);
      return false;
    }
  }

  /**
   * Get current session time in milliseconds
   * @returns {number} Elapsed time in milliseconds
   */
  getSessionTime() {
    if (!this.isPlaying || !this.sessionStartTime) return 0;
    return Date.now() - this.sessionStartTime;
  }

  /**
   * Register a callback for state changes
   * @param {Function} callback - Function to call when state changes
   */
  registerStateChangeCallback(callback) {
    this.onStateChange = callback;
  }

  /**
   * Clean up audio resources
   */
  cleanup() {
    this.log('Cleaning up audio resources');
    
    // Pause all audio elements
    this.pausePlayback();
    
    // Disconnect all nodes
    Object.values(LAYERS).forEach(layer => {
      const layerId = layer.toLowerCase();
      if (this.gainNodes[layerId]) {
        try {
          this.gainNodes[layerId].disconnect();
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
      
      Object.values(this.audioElements[layerId]).forEach(track => {
        if (track && track.source) {
          try {
            track.source.disconnect();
          } catch (e) {
            // Ignore errors during cleanup
          }
        }
      });
    });
    
    // Disconnect master gain
    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
    
    // Close audio context
    if (this.audioContext && this.audioContext.close) {
      this.audioContext.close().catch(e => {
        console.error('Error closing audio context:', e);
      });
    }
    
    // Reset state
    this.isPlaying = false;
    this.sessionStartTime = null;
    
    // Clear references
    this.audioContext = null;
    this.masterGain = null;
    this.gainNodes = {};
    this.audioElements = {};
    this.sourceNodes = {};
    
    // Initialize empty structures for each layer
    Object.values(LAYERS).forEach(layer => {
      const layerId = layer.toLowerCase();
      this.audioElements[layerId] = {};
      this.gainNodes[layerId] = null;
      this.sourceNodes[layerId] = {};
    });
    
    this.log('Cleanup complete');
  }

  /**
   * Check if a specific track is loaded
   * @param {string} layer - The audio layer
   * @param {string} trackId - Track identifier
   * @returns {boolean} Whether the track is loaded
   */
  isTrackLoaded(layer, trackId) {
    const layerId = layer.toLowerCase();
    return !!(
      this.audioElements[layerId] && 
      this.audioElements[layerId][trackId] && 
      this.audioElements[layerId][trackId].element
    );
  }

  /**
   * Get currently playing status
   * @returns {boolean} Whether audio is currently playing
   */
  getPlayingStatus() {
    return this.isPlaying;
  }
}

// Export the service
export default AudioCore;