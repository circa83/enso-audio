/**
 * BufferManager.js
 * 
 * Service for loading, caching, and managing audio buffers.
 * Handles audio file loading with progress tracking and memory optimization.
 */

class BufferManager {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.buffers = new Map(); // Map of trackId -> {buffer, metadata}
    this.loadingTasks = new Map(); // Map of trackId -> {promise, progress}
    this.listeners = new Map(); // Map of event types to listener arrays
    
    // Track basic statistics about buffer usage
    this.stats = {
      totalBytesLoaded: 0,
      bufferCount: 0,
      averageLoadTime: 0,
      totalLoadTime: 0
    };
  }
  
  /**
   * Set the audio context (used when context is created later)
   * @param {AudioContext} audioContext - Web Audio API context
   */
  setAudioContext(audioContext) {
    this.audioContext = audioContext;
  }
  
  /**
   * Load an audio file and store it in the buffer cache
   * @param {string} trackId - Unique identifier for the track
   * @param {string} url - URL of the audio file to load
   * @param {boolean} forceReload - Whether to force reload even if cached
   * @returns {Promise<AudioBuffer>} The loaded audio buffer
   */
  async loadAudioFile(trackId, url, forceReload = false) {
    // Check if this file is already loading
    if (this.loadingTasks.has(trackId)) {
      return this.loadingTasks.get(trackId).promise;
    }
    
    // Check if we already have this buffer cached
    if (!forceReload && this.buffers.has(trackId)) {
      return this.buffers.get(trackId).buffer;
    }
    
    // Validate parameters
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }
    
    if (!trackId || !url) {
      throw new Error('Invalid trackId or URL');
    }
    
    // Create a loading task with progress tracking
    const loadingTask = {};
    
    // Create a promise to track progress and completion
    loadingTask.promise = new Promise(async (resolve, reject) => {
      const startTime = performance.now();
      
      try {
        // Emit loading started event
        this.emit('loadingStarted', { trackId, url });
        
        // Fetch the file with progress tracking
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
        }
        
        // Get content length for progress calculation
        const contentLength = response.headers.get('content-length');
        let bytesTotal = contentLength ? parseInt(contentLength, 10) : 0;
        let bytesLoaded = 0;
        
        // Create a reader to stream the response
        const reader = response.body.getReader();
        const chunks = [];
        
        // Process chunks as they arrive
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          chunks.push(value);
          bytesLoaded += value.length;
          
          // Update progress
          if (bytesTotal > 0) {
            const progress = Math.min(99, Math.round((bytesLoaded / bytesTotal) * 100));
            loadingTask.progress = progress;
            
            // Emit progress event
            this.emit('loadingProgress', { trackId, url, progress, bytesLoaded, bytesTotal });
          }
        }
        
        // Combine chunks into a single array buffer
        const allChunks = new Uint8Array(bytesLoaded);
        let position = 0;
        
        for (const chunk of chunks) {
          allChunks.set(chunk, position);
          position += chunk.length;
        }
        
        // Record total bytes loaded
        this.stats.totalBytesLoaded += bytesLoaded;
        
        // Decode audio data
        // Update progress to indicate we're decoding
        loadingTask.progress = 99;
        this.emit('loadingProgress', { 
          trackId, url, progress: 99, 
          bytesLoaded, bytesTotal, status: 'decoding' 
        });
        
        const audioBuffer = await this.audioContext.decodeAudioData(allChunks.buffer);
        
        // Calculate load time
        const loadTime = performance.now() - startTime;
        
        // Update stats
        this.stats.bufferCount++;
        this.stats.totalLoadTime += loadTime;
        this.stats.averageLoadTime = this.stats.totalLoadTime / this.stats.bufferCount;
        
        // Store buffer in cache with metadata
        this.buffers.set(trackId, {
          buffer: audioBuffer,
          metadata: {
            url,
            duration: audioBuffer.duration,
            channels: audioBuffer.numberOfChannels,
            sampleRate: audioBuffer.sampleRate,
            bytesLoaded,
            loadTime,
            createdAt: Date.now()
          }
        });
        
        // Update progress to 100%
        loadingTask.progress = 100;
        this.emit('loadingComplete', { 
          trackId, url, buffer: audioBuffer,
          metadata: this.buffers.get(trackId).metadata
        });
        
        // Resolve with the buffer
        resolve(audioBuffer);
      } catch (error) {
        // Emit error event
        this.emit('loadingError', { trackId, url, error });
        
        // Remove from loading tasks
        this.loadingTasks.delete(trackId);
        
        reject(error);
      } finally {
        // Clean up loading task after a short delay
        setTimeout(() => {
          this.loadingTasks.delete(trackId);
        }, 500);
      }
    });
    
    // Initialize progress
    loadingTask.progress = 0;
    
    // Store loading task
    this.loadingTasks.set(trackId, loadingTask);
    
    return loadingTask.promise;
  }
  
  /**
   * Get loading progress for a track
   * @param {string} trackId - Unique identifier for the track
   * @returns {number} Progress percentage (0-100) or -1 if not loading
   */
  getLoadingProgress(trackId) {
    if (this.loadingTasks.has(trackId)) {
      return this.loadingTasks.get(trackId).progress;
    }
    
    // Check if already loaded
    if (this.buffers.has(trackId)) {
      return 100;
    }
    
    return -1;
  }
  
  /**
   * Get all loading progress
   * @returns {Object} Map of trackId to progress percentage
   */
  getAllLoadingProgress() {
    const progress = {};
    
    for (const [trackId, task] of this.loadingTasks.entries()) {
      progress[trackId] = task.progress;
    }
    
    return progress;
  }
  
  /**
   * Check if a buffer is loaded and cached
   * @param {string} trackId - Unique identifier for the track
   * @returns {boolean} Whether the buffer is loaded
   */
  isBufferLoaded(trackId) {
    return this.buffers.has(trackId);
  }
  
  /**
   * Get a cached buffer
   * @param {string} trackId - Unique identifier for the track
   * @returns {AudioBuffer|null} The audio buffer or null if not found
   */
  getBuffer(trackId) {
    if (this.buffers.has(trackId)) {
      return this.buffers.get(trackId).buffer;
    }
    return null;
  }
  
  /**
   * Get metadata for a loaded buffer
   * @param {string} trackId - Unique identifier for the track
   * @returns {Object|null} Buffer metadata or null if not found
   */
  getBufferMetadata(trackId) {
    if (this.buffers.has(trackId)) {
      return this.buffers.get(trackId).metadata;
    }
    return null;
  }
  
  /**
   * Get the duration of a loaded buffer in seconds
   * @param {string} trackId - Unique identifier for the track
   * @returns {number} Duration in seconds or 0 if not found
   */
  getBufferDuration(trackId) {
    if (this.buffers.has(trackId)) {
      return this.buffers.get(trackId).metadata.duration;
    }
    return 0;
  }
  
  /**
   * Clear a buffer from the cache
   * @param {string} trackId - Unique identifier for the track
   * @returns {boolean} Whether the buffer was removed
   */
  clearBuffer(trackId) {
    if (this.buffers.has(trackId)) {
      this.buffers.delete(trackId);
      return true;
    }
    return false;
  }
  
  /**
   * Preload a list of audio files
   * @param {Array} files - Array of {trackId, url} objects
   * @param {boolean} lowPriority - Whether to load at low priority
   * @returns {Promise<Array>} Array of loaded buffers
   */
  async preloadAudioFiles(files, lowPriority = false) {
    const loadPromises = [];
    
    for (const file of files) {
      if (!this.buffers.has(file.trackId) && !this.loadingTasks.has(file.trackId)) {
        // Add a small delay between requests if low priority
        if (lowPriority && loadPromises.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        loadPromises.push(this.loadAudioFile(file.trackId, file.url));
      }
    }
    
    return Promise.all(loadPromises);
  }
  
  /**
   * Optimize memory usage by clearing unused buffers
   * @param {Array} activeTrackIds - Array of track IDs that should be kept
   * @param {number} maxAgeMs - Maximum age of unused buffers in milliseconds
   * @returns {number} Number of buffers cleared
   */
  optimizeMemoryUsage(activeTrackIds = [], maxAgeMs = 5 * 60 * 1000) {
    const now = Date.now();
    let cleared = 0;
    
    for (const [trackId, bufferData] of this.buffers.entries()) {
      // Keep active tracks
      if (activeTrackIds.includes(trackId)) {
        continue;
      }
      
      // Keep recently loaded tracks
      const age = now - bufferData.metadata.createdAt;
      if (age < maxAgeMs) {
        continue;
      }
      
      // Clear unused buffer
      this.buffers.delete(trackId);
      cleared++;
    }
    
    return cleared;
  }
  
  /**
   * Get memory usage statistics
   * @returns {Object} Memory usage statistics
   */
  getMemoryUsage() {
    let totalBytes = 0;
    let totalDuration = 0;
    
    for (const [_, bufferData] of this.buffers.entries()) {
      const buffer = bufferData.buffer;
      // Estimate memory usage: bytes per sample × channels × number of samples
      const bufferBytes = buffer.length * buffer.numberOfChannels * 4; // 4 bytes for float32
      totalBytes += bufferBytes;
      totalDuration += buffer.duration;
    }
    
    return {
      bufferCount: this.buffers.size,
      loadingCount: this.loadingTasks.size,
      totalMemoryMB: totalBytes / (1024 * 1024),
      totalDurationSeconds: totalDuration,
      ...this.stats
    };
  }
  
  /**
   * Clear all buffers from the cache
   */
  clearAllBuffers() {
    this.buffers.clear();
    this.stats.bufferCount = 0;
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
}

export default BufferManager;