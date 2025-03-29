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
    this.masterVolume = 0.8; // Default to 80%
    this.isPlaying = false;
    this.sessionStartTime = null;
    this.onStateChange = null; // Callback for state changes
    
    // Initialize empty structures for each layer
    Object.values(LAYERS).forEach(layer => {
      this.audioElements[layer] = {};
      this.gainNodes[layer] = null;
    });
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
      
      // Create master gain node
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.audioContext.destination);
      
      // Create gain nodes for each layer
      Object.values(LAYERS).forEach(layer => {
        const gainNode = this.audioContext.createGain();
        gainNode.connect(this.masterGain);
        this.gainNodes[layer] = gainNode;
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
    if (!this.audioContext || !this.gainNodes[layer]) {
      console.error('Audio context not initialized or invalid layer');
      return null;
    }
    
    try {
      // Create new audio element
      const audioElement = new Audio();
      audioElement.preload = 'auto';
      audioElement.loop = true;
      audioElement.src = sourcePath;
      
      // Create a promise to track loading
      const loadPromise = new Promise((resolve, reject) => {
        const loadHandler = () => {
          resolve(true);
        };
        
        audioElement.addEventListener('canplaythrough', loadHandler, { once: true });
        
        audioElement.addEventListener('error', (e) => {
          reject(new Error(`Error loading audio: ${e.message || 'unknown error'}`));
        }, { once: true });
        
        // Set a timeout to avoid hanging
        setTimeout(() => {
          resolve(true); // Resolve anyway after timeout to prevent hanging
        }, 10000);
      });
      
      // Start loading
      audioElement.load();
      
      // Wait for loading or timeout
      await loadPromise;
      
      // Create media element source
      const source = this.audioContext.createMediaElementSource(audioElement);
      source.connect(this.gainNodes[layer]);
      
      // Store the audio element
      this.audioElements[layer][trackId] = {
        element: audioElement,
        source: source,
        isActive: false,
        track: { id: trackId, path: sourcePath }
      };
      
      return {
        element: audioElement,
        source: source,
        track: { id: trackId, path: sourcePath }
      };
    } catch (error) {
      console.error(`Error creating audio element for ${trackId}:`, error);
      return null;
    }
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
  }

  /**
   * Set volume for a specific layer
   * @param {string} layer - The audio layer
   * @param {number} level - Volume level (0-1)
   */
  setLayerVolume(layer, level) {
    if (!this.gainNodes[layer]) return;
    
    // Clamp volume between 0 and 1
    const volume = Math.max(0, Math.min(1, level));
    
    // Apply to gain node with smoothing
    if (this.audioContext && this.gainNodes[layer].gain) {
      const now = this.audioContext.currentTime;
      this.gainNodes[layer].gain.cancelScheduledValues(now);
      this.gainNodes[layer].gain.setValueAtTime(this.gainNodes[layer].gain.value, now);
      this.gainNodes[layer].gain.linearRampToValueAtTime(volume, now + 0.05);
    } else {
      // Fallback
      this.gainNodes[layer].gain.value = volume;
    }
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
    if (!this.gainNodes[layer]) return 0;
    return this.gainNodes[layer].gain.value;
  }

  /**
   * Start playback of specific audio elements
   * @param {Object} activeElements - Map of layer to trackId
   * @param {Object} volumes - Map of layer to volume level
   * @returns {Promise<boolean>} Success status
   */
  async startPlayback(activeElements, volumes) {
    if (!this.audioContext) return false;
    
    try {
      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Set volumes for each layer
      Object.entries(volumes).forEach(([layer, volume]) => {
        this.setLayerVolume(layer, volume);
      });
      
      // Play all active elements
      const playPromises = [];
      
      Object.entries(activeElements).forEach(([layer, trackId]) => {
        if (!trackId) return;
        
        const track = this.audioElements[layer][trackId];
        if (!track || !track.element) return;
        
        // Reset to beginning of track
        track.element.currentTime = 0;
        
        // Start playback
        const playPromise = track.element.play().catch(error => {
          console.error(`Error playing ${layer}:`, error);
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
      // Pause all audio elements
      Object.values(LAYERS).forEach(layer => {
        Object.values(this.audioElements[layer]).forEach(track => {
          if (track && track.element) {
            track.element.pause();
          }
        });
      });
      
      // Update state
      this.isPlaying = false;
      
      // Notify state change
      if (this.onStateChange) {
        this.onStateChange({ isPlaying: false });
      }
      
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
    // Pause all audio elements
    this.pausePlayback();
    
    // Disconnect all nodes
    Object.values(LAYERS).forEach(layer => {
      if (this.gainNodes[layer]) {
        this.gainNodes[layer].disconnect();
      }
      
      Object.values(this.audioElements[layer]).forEach(track => {
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
      this.masterGain.disconnect();
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
    
    // Initialize empty structures for each layer
    Object.values(LAYERS).forEach(layer => {
      this.audioElements[layer] = {};
      this.gainNodes[layer] = null;
    });
  }

  /**
   * Check if a specific track is loaded
   * @param {string} layer - The audio layer
   * @param {string} trackId - Track identifier
   * @returns {boolean} Whether the track is loaded
   */
  isTrackLoaded(layer, trackId) {
    return !!(
      this.audioElements[layer] && 
      this.audioElements[layer][trackId] && 
      this.audioElements[layer][trackId].element
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