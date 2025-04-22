import AudioService from './AudioService';
import BufferService from './BufferService';
import CrossfadeService from './CrossfadeService';
import TimelineService from './TimelineService';
import VolumeService from './VolumeService';
import CollectionService from './CollectionService';
import { audioLog } from '../utils/audioUtils';

/**
 * Unified manager for all audio services in the application
 * Provides centralized initialization, management and access to all audio services
 */
class ServiceManager {
  // Class properties
  options;
  _services;
  _initialized;
  _initializing;

  /**
   * Create a new ServiceManager instance
   * @param {Object} options - Configuration options
   * @param {boolean} [options.enableLogging=false] - Enable detailed console logging
   * @param {number} [options.initialVolume=0.8] - Initial master volume (0-1)
   * @param {Object} [options.audioService={}] - AudioService-specific options
   * @param {Object} [options.bufferService={}] - BufferService-specific options
   * @param {Object} [options.volumeService={}] - VolumeService-specific options
   * @param {Object} [options.crossfadeService={}] - CrossfadeService-specific options
   * @param {Object} [options.timelineService={}] - TimelineService-specific options
   * @param {Object} [options.collectionService={}] - CollectionService-specific options
   */
  constructor(options = {}) {
    // Fix: Proper way to handle options with defaults and service-specific options
    this.options = {
      enableLogging: options.enableLogging || false,
      initialVolume: options.initialVolume || 0.8,
      // Extract service-specific options
      audioService: options.audioService || {},
      bufferService: options.bufferService || {},
      volumeService: options.volumeService || {},
      crossfadeService: options.crossfadeService || {},
      timelineService: options.timelineService || {},
      collectionService: options.collectionService || {}
    };

    // Service references
    this._services = {
      audio: null,
      buffer: null,
      crossfade: null,
      timeline: null,
      volume: null,
      collection: null
    };

    this._initialized = false;
    this._initializing = false;

    this.log('ServiceManager created');
  }

  /**
   * Log message with consistent formatting
   * @param {string} message - Message to log
   * @param {string} [level='info'] - Log level (info, warn, error)
   * @private
   */
  log(message, level = 'info') {
    if (!this.options.enableLogging) return;

    const prefix = '[ServiceManager]';
    if (typeof audioLog === 'function') {
      audioLog(message, level, prefix);
    } else {
      switch (level) {
        case 'error': console.
          error(`${prefix} ${message}`); break;
        case 'warn': console.warn(`${prefix} ${message}`); break;
        default: console.log(`${prefix} ${message}`);
      }
    }
  }

  /**
  * Initialize all audio services in the correct order
  * @param {Object} [options] - Initialization options
  * @returns {Promise<boolean>} Success status
  */
  async initialize(options = {}) {
    if (this._initialized) {
      this.log('Already initialized');
      return true;
    }

    if (this._initializing) {
      this.log('Initialization already in progress');
      return false;
    }

    this._initializing = true;

    try {
      this.log('Initializing all audio services...');

      // Step 1: Create AudioService (core service)
      this._services.audio = new AudioService({
        initialVolume: this.options.initialVolume,
        autoResume: true,
        ...this.options.audioService
      });

      // Step 2: Initialize AudioService
      const audioInitialized = await this._services.audio.initialize();
      if (!audioInitialized) {
        throw new Error('Failed to initialize AudioService');
      }
      this.log('AudioService initialized successfully');

      // Get the audio context from AudioService
      const audioContext = this._services.audio.getContext();
      const masterGain = this._services.audio.getMasterGain();

      if (!audioContext || !masterGain) {
        throw new Error('AudioService initialized but context or masterGain is not available');
      }

      // Step 3: Initialize BufferService
      this._services.buffer = new BufferService({
        audioContext: audioContext,
        enableLogging: this.options.enableLogging,
        ...this.options.bufferService
      });
      this.log('BufferService initialized successfully');

      // Step 4: Initialize VolumeService
      this._services.volume = new VolumeService({
        audioContext: audioContext,
        masterGain: masterGain,
        initialVolumes: this.options.volumeService?.initialVolumes,
        enableLogging: this.options.enableLogging,
        ...this.options.volumeService
      });
      this.log('VolumeService initialized successfully');

      // Step 5: Initialize CrossfadeService
      this._services.crossfade = new CrossfadeService({
        audioContext: audioContext,
        volumeController: this._services.volume,
        enableLogging: this.options.enableLogging,
        ...this.options.crossfadeService
      });
      this.log('CrossfadeService initialized successfully');

      // Step 6: Initialize TimelineService
      this._services.timeline = new TimelineService({
        volumeController: this._services.volume,
        crossfadeEngine: this._services.crossfade,
        enableLogging: this.options.enableLogging,
        ...this.options.timelineService
      });
      this.log('TimelineService initialized successfully');

      // Step 7: Initialize CollectionService
      this._services.collection = new CollectionService({
        enableLogging: this.options.enableLogging,
        ...this.options.collectionService
      });
      this.log('CollectionService initialized successfully');

      this._initialized = true;
      this._initializing = false;

      this.log('All audio services initialized successfully');
      return true;
    } catch (error) {
      this._initializing = false;
      this.log(`Error initializing services: ${error.message}`, 'error');
      return false;
    }
  }

  /**
  * Check if the ServiceManager is fully initialized
  * @returns {boolean} True if initialized
  */
  isInitialized() {
    return this._initialized;
  }

  /**
  * Get an initialized service by name
  * @param {string} serviceName - Name of the service to get
  * @returns {Object|null} The requested service or null if not available
  */
  getService(serviceName) {
    // Check if initialized
    if (!this._initialized) {
      this.log(`Cannot get service '${serviceName}': ServiceManager not initialized`, 'warn');
      return null;
    }

    // Validate service name
    if (!Object.prototype.hasOwnProperty.call(this._services, serviceName)) {
      this.log(`Unknown service name: '${serviceName}'`, 'error');
      return null;
    }

    // Return the requested service
    return this._services[serviceName];
  }

  /**
  * Get the AudioService instance
  * @returns {AudioService|null} The AudioService instance
  */
  getAudio() {
    return this.getService('audio');
  }

  /**
  * Get the BufferService instance
  * @returns {BufferService|null} The BufferService instance
  */
  getBuffer() {
    return this.getService('buffer');
  }

  /**
  * Get the VolumeService instance
  * @returns {VolumeService|null} The VolumeService instance
  */
  getVolume() {
    return this.getService('volume');
  }

  /**
  * Get the CrossfadeService instance
  * @returns {CrossfadeService|null} The CrossfadeService instance
  */
  getCrossfade() {
    return this.getService('crossfade');
  }

  /**
  * Get the TimelineService instance
  * @returns {TimelineService|null} The TimelineService instance
  */
  getTimeline() {
    return this.getService('timeline');
  }

  /**
  * Get the CollectionService instance
  * @returns {CollectionService|null} The CollectionService instance
  */
  getCollection() {
    return this.getService('collection');
  }

  // -------------------- AUDIO CONTEXT MANAGEMENT --------------------

  /**
  * Get the Web Audio API context
  * @returns {AudioContext|null} The audio context or null if not initialized
  */
  getAudioContext() {
    const audioService = this.getAudio();
    if (!audioService) {
      this.log('Cannot get audio context: AudioService not initialized', 'warn');
      return null;
    }
    return audioService.getContext();
  }

  /**
  * Check if the audio context is currently suspended
  * @returns {boolean} True if suspended, false if running, null if not initialized
  */
  isAudioContextSuspended() {
    const audioService = this.getAudio();
    if (!audioService) {
      this.log('Cannot check context state: AudioService not initialized', 'warn');
      return null;
    }
    return audioService.isSuspended();
  }

  /**
  * Get the current state of the audio context
  * @returns {string|null} Current state ('running', 'suspended', 'closed') or null if not initialized
  */
  getAudioContextState() {
    const context = this.getAudioContext();
    return context ? context.state : null;
  }

  /**
  * Set the master volume level
  * @param {number} level - Volume level between 0 and 1
  * @returns {boolean} Success status
  */
  setMasterVolume(level) {
    const audioService = this.getAudio();
    if (!audioService) {
      this.log('Cannot set master volume: AudioService not initialized', 'warn');
      return false;
    }

    return audioService.setMasterVolume(level);
  }

  /**
  * Get the current master volume level
  * @returns {number} Current volume level (0-1)
  */
  getMasterVolume() {
    const audioService = this.getAudio();
    if (!audioService) {
      this.log('Cannot get master volume: AudioService not initialized', 'warn');
      return this.options.initialVolume;
    }

    return audioService.getMasterVolume();
  }

  /**
  * Resume the audio context
  * @returns {Promise<boolean>} Success status
  */
  async resumeAudio() {
    const audioService = this.getAudio();
    if (!audioService) {
      this.log('Cannot resume audio: AudioService not initialized', 'warn');
      return false;
    }

    return audioService.resume();
  }

  /**
  * Suspend the audio context to save resources
  * @returns {Promise<boolean>} Success status
  */
  async suspendAudio() {
    const audioService = this.getAudio();
    if (!audioService) {
      this.log('Cannot suspend audio: AudioService not initialized', 'warn');
      return false;
    }

    return audioService.suspend();
  }

  // -------------------- AUDIO ANALYSIS SUPPORT --------------------

  /**
  * Get the analyzer node for visualizations
  * @returns {AnalyserNode|null} The analyzer node or null if not initialized
  */
  getAudioAnalyzer() {
    const audioService = this.getAudio();
    if (!audioService) {
      this.log('Cannot get analyzer: AudioService not initialized', 'warn');
      return null;
    }
    return audioService.getAnalyzer();
  }

  /**
  * Get frequency data from the analyzer
  * @param {Uint8Array} dataArray - Array to receive frequency data
  * @returns {boolean} Success status
  */
  getFrequencyData(dataArray) {
    const analyzer = this.getAudioAnalyzer();
    if (!analyzer || !dataArray) {
      return false;
    }

    try {
      analyzer.getByteFrequencyData(dataArray);
      return true;
    } catch (error) {
      this.log(`Error getting frequency data: ${error.message}`, 'error');
      return false;
    }
  }

  /**
  * Get time domain data from the analyzer
  * @param {Uint8Array} dataArray - Array to receive time domain data
  * @returns {boolean} Success status
  */
  getTimeDomainData(dataArray) {
    const analyzer = this.getAudioAnalyzer();
    if (!analyzer || !dataArray) {
      return false;
    }

    try {
      analyzer.getByteTimeDomainData(dataArray);
      return true;
    } catch (error) {
      this.log(`Error getting time domain data: ${error.message}`, 'error');
      return false;
    }
  }

  // -------------------- AUDIO ELEMENT MANAGEMENT --------------------

  /**
  * Register audio elements with the AudioService
  * @param {Object} elements - Map of layer names to audio element objects
  * @returns {boolean} Success status
  */
  registerAudioElements(elements) {
    const audioService = this.getAudio();
    if (!audioService) {
      this.log('Cannot register elements: AudioService not initialized', 'warn');
      return false;
    }

    return audioService.registerElements(elements);
  }

  /**
  * Update a single audio element
  * @param {string} layer - Layer identifier
  * @param {string} trackId - Track identifier
  * @param {Object} elementData - Audio element data
  * @returns {boolean} Success status
  */
  updateAudioElement(layer, trackId, elementData) {
    const audioService = this.getAudio();
    if (!audioService) {
      this.log('Cannot update element: AudioService not initialized', 'warn');
      return false;
    }

    return audioService.updateElement(layer, trackId, elementData);
  }

  /**
  * Get all registered audio elements
  * @returns {Object} Map of audio elements by layer and track ID
  */
  getAudioElements() {
    const audioService = this.getAudio();
    if (!audioService) {
      this.log('Cannot get elements: AudioService not initialized', 'warn');
      return {};
    }

    return audioService.getElements();
  }

  /**
  * Get an audio element for a specific layer and track
  * @param {string} layer - Layer identifier
  * @param {string} trackId - Track identifier
  * @returns {Object|null} The audio element data or null if not found
  */
  getAudioElement(layer, trackId) {
    const audioService = this.getAudio();
    if (!audioService) {
      this.log('Cannot get audio element: AudioService not initialized', 'warn');
      return null;
    }

    const elements = audioService.getElements();
    return elements?.[layer]?.[trackId] || null;
  }

  /**
  * Get all audio elements for a specific layer
  * @param {string} layer - Layer identifier
  * @returns {Object|null} Map of track IDs to audio element data or null if not found
  */
  getLayerAudioElements(layer) {
    const audioService = this.getAudio();
    if (!audioService) {
      this.log('Cannot get layer elements: AudioService not initialized', 'warn');
      return null;
    }

    const elements = audioService.getElements();
    return elements?.[layer] || null;
  }

  /**
  * Check if an audio element exists
  * @param {string} layer - Layer identifier
  * @param {string} trackId - Track identifier
  * @returns {boolean} True if element exists
  */
  hasAudioElement(layer, trackId) {
    const element = this.getAudioElement(layer, trackId);
    return element !== null;
  }

  // -------------------- PLAYBACK CONTROL SUPPORT --------------------

  /**
  * Play an audio element
  * @param {string} layer - Layer identifier
  * @param {string} trackId - Track identifier
  * @returns {Promise<boolean>} Success status
  */
  async playAudioElement(layer, trackId) {
    const element = this.getAudioElement(layer, trackId);
    if (!element || !element.element) {
      this.log(`Cannot play: Audio element not found for ${layer}/${trackId}`, 'warn');
      return false;
    }

    try {
      // First ensure audio context is resumed
      await this.resumeAudio();

      // Then play the element
      await element.element.play();
      return true;
    } catch (error) {
      this.log(`Error playing audio element ${layer}/${trackId}: ${error.message}`, 'error');
      return false;
    }
  }

  /**
  * Pause an audio element
  * @param {string} layer - Layer identifier
  * @param {string} trackId - Track identifier
  * @returns {boolean} Success status
  */
  pauseAudioElement(layer, trackId) {
    const element = this.getAudioElement(layer, trackId);
    if (!element || !element.element) {
      this.log(`Cannot pause: Audio element not found for ${layer}/${trackId}`, 'warn');

      return false;
    }

    try {
      element.element.pause();
      return true;
    } catch (error) {
      this.log(`Error pausing audio element ${layer}/${trackId}: ${error.message}`, 'error');
      return false;
    }
  }

  /**
  * Set the current time of an audio element
  * @param {string} layer - Layer identifier
  * @param {string} trackId - Track identifier
  * @param {number} time - Time in seconds
  * @returns {boolean} Success status
  */
  setAudioElementTime(layer, trackId, time) {
    const element = this.getAudioElement(layer, trackId);
    if (!element || !element.element) {
      this.log(`Cannot set time: Audio element not found for ${layer}/${trackId}`, 'warn');
      return false;
    }

    try {
      element.element.currentTime = time;
      return true;
    } catch (error) {
      this.log(`Error setting time for ${layer}/${trackId}: ${error.message}`, 'error');
      return false;
    }
  }

  /**
  * Set loop status for an audio element
  * @param {string} layer - Layer identifier
  * @param {string} trackId - Track identifier
  * @param {boolean} shouldLoop - Whether the audio should loop
  * @returns {boolean} Success status
  */
  setAudioElementLoop(layer, trackId, shouldLoop) {
    const element = this.getAudioElement(layer, trackId);
    if (!element || !element.element) {
      this.log(`Cannot set loop: Audio element not found for ${layer}/${trackId}`, 'warn');
      return false;
    }

    try {
      element.element.loop = Boolean(shouldLoop);
      return true;
    } catch (error) {
      this.log(`Error setting loop for ${layer}/${trackId}: ${error.message}`, 'error');
      return false;
    }
  }

  // -------------------- CONNECTION AND ROUTING METHODS --------------------

  /**
  * Get the master gain node
  * @returns {GainNode|null} The master gain node or null if not initialized
  */
  getMasterGainNode() {
    const audioService = this.getAudio();
    if (!audioService) {
      this.log('Cannot get master gain: AudioService not initialized', 'warn');
      return null;
    }
    return audioService.getMasterGain();
  }

  /**
  * Connect an audio node to the master output
  * @param {AudioNode} sourceNode - The audio node to connect
  * @returns {boolean} Success status
  */
  connectToMaster(sourceNode) {
    const masterGain = this.getMasterGainNode();
    if (!masterGain || !sourceNode) {
      this.log('Cannot connect to master: Missing node or master gain', 'warn');
      return false;
    }

    try {
      sourceNode.connect(masterGain);
      return true;
    } catch (error) {
      this.log(`Error connecting to master: ${error.message}`, 'error');
      return false;
    }
  }

  /**
  * Create a media element source for an HTML audio element
  * @param {HTMLAudioElement} audioElement - The audio element
  * @returns {MediaElementAudioSourceNode|null} The source node or null if failed
  */
  createMediaElementSource(audioElement) {
    const audioContext = this.getAudioContext();
    if (!audioContext || !audioElement) {
      this.log('Cannot create media source: Missing context or audio element', 'warn');
      return null;
    }

    try {
      return audioContext.createMediaElementSource(audioElement);
    } catch (error) {
      this.log(`Error creating media source: ${error.message}`, 'error');
      return null;
    }
  }

  /**
  * Create a new AudioNode of the specified type
  * @param {string} nodeType - Type of node to create (e.g., 'gain', 'analyser')
  * @param {Object} [options] - Options for the node
  * @returns {AudioNode|null} The created node or null if failed
  */
  createAudioNode(nodeType, options = {}) {
    const audioContext = this.getAudioContext();
    if (!audioContext) {
      this.log('Cannot create node: AudioContext not initialized', 'warn');
      return null;
    }

    try {
      switch (nodeType.toLowerCase()) {
        case 'gain':
          return audioContext.createGain();
        case 'analyser':
        case 'analyzer':
          const analyzer = audioContext.createAnalyser();
          if (options.fftSize) analyzer.fftSize = options.fftSize;
          if (options.smoothingTimeConstant) analyzer.smoothingTimeConstant = options.smoothingTimeConstant;
          return analyzer;
        case 'panner':
          return audioContext.createPanner();
        case 'delay':
          return audioContext.createDelay(options.maxDelayTime || 1.0);
        case 'biquadfilter':
        case 'filter':
          return audioContext.createBiquadFilter();
        case 'compressor':
          return audioContext.createDynamicsCompressor();
        default:
          this.log(`Unknown node type: ${nodeType}`, 'warn');
          return null;
      }
    } catch (error) {
      this.log(`Error creating ${nodeType} node: ${error.message}`, 'error');
      return null;
    }
  }

  /**
  * Check audio autoplay capabilities of the browser
  * @returns {Promise<Object>} Object with autoplay capability information
  */
  async checkAutoplayCapabilities() {
    try {
      const audioContext = this.getAudioContext();
      if (!audioContext) {
        return {
          supported: false,
          withUserInteraction: false,
          withoutUserInteraction: false,
          message: 'AudioContext not initialized'
        };
      }

      // Check if context can be resumed without user interaction
      const contextState = audioContext.state;
      let canResumeContext = contextState === 'running';

      if (contextState === 'suspended') {
        try {
          await audioContext.resume();
          canResumeContext = audioContext.state === 'running';

          // Suspend it again if we managed to resume it
          if (canResumeContext) {
            await audioContext.suspend();
          }
        } catch (e) {
          canResumeContext = false;
        }
      }

      // Create a test audio element
      const audioElement = new Audio();
      audioElement.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAAEA2AABAPgAA';
      audioElement.volume = 0;

      // Try to play without user interaction
      let canPlayWithoutInteraction = false;
      try {
        await audioElement.play();
        canPlayWithoutInteraction = true;
        audioElement.pause();
      } catch (e) {
        canPlayWithoutInteraction = false;
      }

      return {
        supported: true,
        withUserInteraction: true, // We assume play() works with user interaction
        withoutUserInteraction: canPlayWithoutInteraction,
        contextResume: canResumeContext,
        message: canPlayWithoutInteraction ?
          'Full autoplay supported' :
          'Autoplay requires user interaction'
      };
    } catch (error) {
      this.log(`Error checking autoplay capabilities: ${error.message}`, 'error');
      return {
        supported: false,
        withUserInteraction: false,
        withoutUserInteraction: false,
        message: `Error: ${error.message}`
      };
    }
  }

  /**
  * Clean up resources used by all services
  * This should be called when the services are no longer needed
  */
  dispose() {
    this.log('Disposing all services...');

    // Dispose each service that has a cleanup/dispose method
    Object.entries(this._services).forEach(([name, service]) => {
      if (service) {
        if (typeof service.cleanup === 'function') {
          service.cleanup();
          this.log(`Service '${name}' cleaned up`);
        } else if (typeof service.dispose === 'function') {
          service.dispose();
          this.log(`Service '${name}' disposed`);
        }
      }
    });

    // Reset internal state
    this._services = {
      audio: null,
      buffer: null,
      crossfade: null,
      timeline: null,
      volume: null,
      collection: null
    };

    this._initialized = false;
    this.log('All services disposed');
  }
}

export default ServiceManager;
