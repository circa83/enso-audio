/**
 * BufferManager.js
 * Service for loading, caching, and managing audio buffers
 */

class BufferManager {
    /**
     * Creates a new BufferManager instance
     * @param {AudioCore} audioCore - Reference to the AudioCore service
     * @param {Object} config - Configuration options
     */
    constructor(audioCore, config = {}) {
      // Dependency on AudioCore
      this.audioCore = audioCore;
      
      // Buffer cache storage
      this.bufferCache = new Map();
      
      // Tracking for loading status
      this.loadingStatus = new Map();
      
      // Configuration with defaults
      this.config = {
        maxCacheSize: 50, // Maximum number of buffers to keep in cache
        preloadThreshold: 0.3, // Start playback when this percentage is loaded
        retryAttempts: 3, // Number of retry attempts for failed loads
        retryDelay: 1000, // Delay between retries in milliseconds
        ...config
      };
    }
  
    /**
     * Load an audio file and convert to an AudioBuffer
     * @param {string} url - URL of the audio file to load
     * @param {Object} options - Loading options
     * @returns {Promise<AudioBuffer>} The loaded audio buffer
     */
    async loadBuffer(url, options = {}) {
      if (!this.audioCore || !this.audioCore.isInitialized()) {
        throw new Error('AudioCore not initialized');
      }
      
      // Extract options with defaults
      const { 
        retryAttempts = this.config.retryAttempts,
        retryDelay = this.config.retryDelay,
        onProgress = null // Optional progress callback
      } = options;
      
      // Check if buffer is already in cache
      if (this.bufferCache.has(url)) {
        return this.bufferCache.get(url);
      }
      
      // Create a new loading status entry
      this.loadingStatus.set(url, {
        progress: 0,
        started: Date.now(),
        error: null
      });
      
      let attempts = 0;
      
      while (attempts < retryAttempts) {
        try {
          attempts++;
          
          // Fetch the audio file
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch audio file: ${response.status} ${response.statusText}`);
          }
          
          // Check if response has Content-Length for progress tracking
          const contentLength = response.headers.get('Content-Length');
          let received = 0;
          
          // Get the audio data as array buffer with progress tracking
          const arrayBuffer = await new Promise((resolve, reject) => {
            const reader = response.body.getReader();
            const chunks = [];
            
            // Function to read chunks
            const read = () => {
              reader.read().then(({ value, done }) => {
                if (done) {
                  // Combine all chunks into a single array buffer
                  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                  const result = new Uint8Array(totalLength);
                  let offset = 0;
                  
                  for (const chunk of chunks) {
                    result.set(chunk, offset);
                    offset += chunk.length;
                  }
                  
                  resolve(result.buffer);
                  return;
                }
                
                // Add the chunk to our array
                chunks.push(value);
                
                // Update progress if we know the content length
                if (contentLength) {
                  received += value.length;
                  const progress = Math.min(0.95, received / parseInt(contentLength, 10));
                  
                  // Update the loading status
                  this.loadingStatus.set(url, {
                    ...this.loadingStatus.get(url),
                    progress
                  });
                  
                  // Call progress callback if provided
                  if (onProgress && typeof onProgress === 'function') {
                    onProgress(progress);
                  }
                } else {
                  // If no content length, use a simple progress heuristic
                  const currentProgress = this.loadingStatus.get(url).progress;
                  const newProgress = Math.min(0.9, currentProgress + 0.05);
                  
                  this.loadingStatus.set(url, {
                    ...this.loadingStatus.get(url),
                    progress: newProgress
                  });
                  
                  if (onProgress && typeof onProgress === 'function') {
                    onProgress(newProgress);
                  }
                }
                
                // Continue reading
                read();
              }).catch(error => {
                reject(error);
              });
            };
            
            // Start reading
            read();
          });
          
          // Set progress to 0.95 before decoding (decoding is the final 5%)
          this.loadingStatus.set(url, {
            ...this.loadingStatus.get(url),
            progress: 0.95
          });
          
          if (onProgress && typeof onProgress === 'function') {
            onProgress(0.95);
          }
          
          // Decode the audio data
          const audioBuffer = await this.audioCore.audioContext.decodeAudioData(arrayBuffer);
          
          // Update the loading status to completed
          this.loadingStatus.set(url, {
            ...this.loadingStatus.get(url),
            progress: 1,
            completed: Date.now()
          });
          
          if (onProgress && typeof onProgress === 'function') {
            onProgress(1);
          }
          
          // Add to cache
          this.bufferCache.set(url, audioBuffer);
          
          // Manage cache size
          this._manageCache();
          
          console.log(`Audio buffer loaded: ${url}`);
          return audioBuffer;
          
        } catch (error) {
          console.error(`Error loading audio (attempt ${attempts}):`, error);
          
          // Update error status
          this.loadingStatus.set(url, {
            ...this.loadingStatus.get(url),
            error: error.message
          });
          
          // If we've reached max attempts, throw the error
          if (attempts >= retryAttempts) {
            this.loadingStatus.delete(url);
            throw error;
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
      
      // This should never be reached because of the throw in the loop
      throw new Error(`Failed to load audio after ${retryAttempts} attempts`);
    }
  
    /**
     * Get a buffer from cache if available, otherwise load it
     * @param {string} url - URL of the audio file
     * @param {Object} options - Loading options
     * @returns {Promise<AudioBuffer>} The audio buffer
     */
    async getBuffer(url, options = {}) {
      // Check if the buffer is already in the cache
      if (this.bufferCache.has(url)) {
        return this.bufferCache.get(url);
      }
      
      // Check if the buffer is already loading
      if (this.loadingStatus.has(url)) {
        // Wait for the loading to complete by polling the status
        return new Promise((resolve, reject) => {
          const checkInterval = setInterval(() => {
            if (!this.loadingStatus.has(url)) {
              // Loading failed or was cancelled
              clearInterval(checkInterval);
              reject(new Error('Buffer loading failed or was cancelled'));
              return;
            }
            
            const status = this.loadingStatus.get(url);
            
            if (status.progress >= 1) {
              // Loading completed
              clearInterval(checkInterval);
              
              if (this.bufferCache.has(url)) {
                resolve(this.bufferCache.get(url));
              } else {
                reject(new Error('Buffer loading completed but buffer not found in cache'));
              }
            } else if (status.error) {
              // Loading encountered an error
              clearInterval(checkInterval);
              reject(new Error(`Buffer loading error: ${status.error}`));
            }
          }, 100); // Check every 100ms
        });
      }
      
      // Load the buffer
      return this.loadBuffer(url, options);
    }
  
    /**
     * Preload a buffer without waiting for it to fully load
     * @param {string} url - URL of the audio file
     * @param {Object} options - Loading options
     * @returns {Promise<{started: boolean, progress: number}>} Loading status
     */
    async preloadBuffer(url, options = {}) {
      // If already cached, return immediately
      if (this.bufferCache.has(url)) {
        return { started: true, progress: 1, completed: true };
      }
      
      // If already loading, return current status
      if (this.loadingStatus.has(url)) {
        const status = this.loadingStatus.get(url);
        return { 
          started: true, 
          progress: status.progress,
          completed: status.progress >= 1
        };
      }
      
      // Start loading in the background
      this.loadBuffer(url, options).catch(error => {
        console.warn(`Preload error for ${url}:`, error);
      });
      
      // Return immediately with started status
      return { started: true, progress: 0, completed: false };
    }
  
    /**
     * Check if a buffer is currently loading
     * @param {string} url - URL of the audio file
     * @returns {boolean} True if the buffer is currently loading
     */
    isLoading(url) {
      return this.loadingStatus.has(url);
    }
  
    /**
     * Get the loading progress for a specific buffer
     * @param {string} url - URL of the audio file
     * @returns {number} Loading progress from 0 to 1, or -1 if not loading
     */
    getLoadingProgress(url) {
      const status = this.loadingStatus.get(url);
      return status ? status.progress : -1;
    }
  
    /**
     * Clear a specific buffer from the cache
     * @param {string} url - URL of the audio file to remove
     * @returns {boolean} True if the buffer was removed
     */
    clearBuffer(url) {
      const removed = this.bufferCache.delete(url);
      
      // Also clear any loading status
      if (this.loadingStatus.has(url)) {
        this.loadingStatus.delete(url);
      }
      
      return removed;
    }
  
    /**
     * Clear all buffers from the cache
     */
    clearAllBuffers() {
      this.bufferCache.clear();
      this.loadingStatus.clear();
      console.log('All audio buffers cleared from cache');
    }
  
    /**
     * Get statistics about the buffer cache
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
      const totalSize = Array.from(this.bufferCache.values()).reduce((total, buffer) => {
        // Estimate buffer size: channels * samples * 4 bytes per sample (32-bit float)
        const bufferSize = buffer.numberOfChannels * buffer.length * 4;
        return total + bufferSize;
      }, 0);
      
      return {
        bufferCount: this.bufferCache.size,
        totalSizeBytes: totalSize,
        totalSizeMB: totalSize / (1024 * 1024),
        loadingCount: this.loadingStatus.size,
        urls: Array.from(this.bufferCache.keys())
      };
    }
    
    /**
     * Private method to manage cache size
     * @private
     */
    _manageCache() {
      if (this.bufferCache.size <= this.config.maxCacheSize) {
        return;
      }
      
      // Simple LRU-like cache pruning - remove oldest entries
      // In a more advanced implementation, we'd track access time and usage frequency
      const entries = Array.from(this.bufferCache.entries());
      const toRemove = entries.slice(0, entries.length - this.config.maxCacheSize);
      
      for (const [url, _] of toRemove) {
        this.bufferCache.delete(url);
        console.log(`Removed buffer from cache: ${url}`);
      }
    }
  }
  
  export default BufferManager;