/**
 * BufferManager.js
 * 
 * Service for loading, caching, and managing audio buffers
 * Handles the loading and decoding of audio files into AudioBuffers
 * Provides progress tracking and memory optimization
 */

class BufferManager {
    /**
     * Create a new BufferManager instance
     * @param {Object} options - Configuration options
     * @param {AudioContext} options.audioContext - Web Audio API context to use
     * @param {number} [options.maxCacheSize=50] - Maximum number of buffers to keep in cache
     * @param {boolean} [options.enableLogging=false] - Enable detailed console logging
     */
    constructor(options = {}) {
      if (!options.audioContext) {
        throw new Error('BufferManager requires an AudioContext instance');
      }
  
      // Dependencies
      this.audioContext = options.audioContext;
      
      // Configuration
      this.config = {
        maxCacheSize: options.maxCacheSize || 50,
        enableLogging: options.enableLogging || false
      };
      
      // Internal state
      this.bufferCache = new Map(); // Maps URL to AudioBuffer
      this.pendingLoads = new Map(); // Maps URL to Promise (prevents duplicate loads)
      this.loadingProgress = new Map(); // Maps URL to loading progress (0-100)
      this.errors = new Map(); // Maps URL to error message
      
      // Metadata about cached buffers
      this.bufferMetadata = new Map(); // Maps URL to metadata object
      
      // Statistics
      this.stats = {
        totalLoaded: 0,
        cacheHits: 0,
        cacheMisses: 0,
        loadErrors: 0,
        totalBytes: 0
      };
      
      this.log('BufferManager initialized');
    }
    
    /**
     * Load an audio file and decode it into an AudioBuffer
     * 
     * @param {string} url - URL or path of the audio file to load
     * @param {Object} [options] - Loading options
     * @param {boolean} [options.force=false] - Force reload even if cached
     * @param {Function} [options.onProgress] - Progress callback function(progress, url)
     * @returns {Promise<AudioBuffer>} The decoded audio buffer
     */
    async loadAudioBuffer(url, options = {}) {
      const { force = false, onProgress } = options;
      
      // Check cache first (unless force reload is requested)
      if (!force && this.bufferCache.has(url)) {
        this.stats.cacheHits++;
        this.log(`Cache hit for ${url}`);
        
        // Get cached buffer
        const cachedBuffer = this.bufferCache.get(url);
        
        // Update access timestamp in metadata
        this.updateMetadata(url, { lastAccessed: Date.now() });
        
        return cachedBuffer;
      }
      
      // Increment cache miss counter
      this.stats.cacheMisses++;
      
      // Check if this URL is already being loaded
      if (this.pendingLoads.has(url)) {
        this.log(`Already loading ${url}, returning existing promise`);
        return this.pendingLoads.get(url);
      }
      
      // Start a new load
      try {
        // Create a promise for loading this file
        const loadPromise = this._loadAndDecodeAudioFile(url, onProgress);
        
        // Store in pending loads
        this.pendingLoads.set(url, loadPromise);
        
        // Wait for loading to complete
        const buffer = await loadPromise;
        
        // Store in cache
        this.bufferCache.set(url, buffer);
        
        // Create metadata entry
        this.updateMetadata(url, {
          url,
          size: buffer.length * 4 * buffer.numberOfChannels, // Approximate size in bytes
          duration: buffer.duration,
          sampleRate: buffer.sampleRate,
          numberOfChannels: buffer.numberOfChannels,
          created: Date.now(),
          lastAccessed: Date.now()
        });
        
        // Update stats
        this.stats.totalLoaded++;
        this.stats.totalBytes += buffer.length * 4 * buffer.numberOfChannels;
        
        // Remove from pending loads
        this.pendingLoads.delete(url);
        
        // Clean up errors if previously failed
        this.errors.delete(url);
        
        // Enforce cache size limit
        this._enforceCacheLimit();
        
        return buffer;
      } catch (error) {
        // Store error information
        this.errors.set(url, error.message);
        
        // Remove from pending loads
        this.pendingLoads.delete(url);
        
        // Update stats
        this.stats.loadErrors++;
        
        // Re-throw with more information
        throw new Error(`Failed to load audio buffer (${url}): ${error.message}`);
      }
    }
    
    /**
     * Get the loading progress for a specific URL (0-100)
     * 
     * @param {string} url - URL to check progress for
     * @returns {number} Progress value between 0-100, or -1 if not loading
     */
    getLoadingProgress(url) {
      return this.loadingProgress.has(url) ? this.loadingProgress.get(url) : -1;
    }
    
    /**
     * Check if a buffer is already cached
     * 
     * @param {string} url - URL to check
     * @returns {boolean} True if the buffer is in the cache
     */
    hasBuffer(url) {
      return this.bufferCache.has(url);
    }
    
    /**
     * Get a cached buffer without loading
     * 
     * @param {string} url - URL to get the buffer for
     * @returns {AudioBuffer|null} The cached buffer or null if not found
     */
    getBuffer(url) {
      if (!this.hasBuffer(url)) return null;
      
      const buffer = this.bufferCache.get(url);
      
      // Update access timestamp
      this.updateMetadata(url, { lastAccessed: Date.now() });
      
      return buffer;
    }
    
    /**
     * Remove a buffer from the cache
     * 
     * @param {string} url - URL to remove
     * @returns {boolean} True if the buffer was removed
     */
    releaseBuffer(url) {
      if (!this.hasBuffer(url)) return false;
      
      this.bufferCache.delete(url);
      this.bufferMetadata.delete(url);
      this.log(`Released buffer: ${url}`);
      
      return true;
    }
    
    /**
     * Preload multiple audio files in parallel
     * 
     * @param {string[]} urls - Array of URLs to preload
     * @param {Object} [options] - Loading options
     * @param {Function} [options.onProgress] - Progress callback function(overallProgress, detailedProgress)
     * @param {number} [options.concurrentLoads=3] - Maximum number of concurrent loads
     * @returns {Promise<Map<string, AudioBuffer>>} Map of URLs to their buffers
     */
    async preloadBuffers(urls, options = {}) {
      const { onProgress, concurrentLoads = 3 } = options;
      
      if (!Array.isArray(urls) || urls.length === 0) {
        return new Map();
      }
      
      // Track overall progress
      let completedCount = 0;
      const totalCount = urls.length;
      const results = new Map();
      const individualProgress = new Map();
      
      // Helper to update overall progress
      const updateOverallProgress = () => {
        if (!onProgress) return;
        
        // Calculate overall progress
        let sum = completedCount * 100;
        
        // Add partial progress from pending loads
        individualProgress.forEach(progress => {
          sum += progress;
        });
        
        const overallProgress = Math.floor(sum / (totalCount * 100) * 100);
        
        // Create detailed progress object
        const detailedProgress = Object.fromEntries(
          Array.from(individualProgress.entries())
        );
        
        onProgress(overallProgress, detailedProgress);
      };
      
      // Create a queue of URLs to load
      const queue = [...urls];
      
      // Helper function to load the next URL in the queue
      const loadNext = async () => {
        if (queue.length === 0) return null;
        
        const url = queue.shift();
        individualProgress.set(url, 0);
        
        try {
          // Create individual progress callback
          const trackProgress = (progress) => {
            individualProgress.set(url, progress);
            updateOverallProgress();
          };
          
          // Load the buffer
          const buffer = await this.loadAudioBuffer(url, { 
            onProgress: trackProgress 
          });
          
          // Store result
          results.set(url, buffer);
          
          // Increment completed count
          completedCount++;
          individualProgress.delete(url);
          
          // Update progress
          updateOverallProgress();
          
          // Continue with next in queue
          return loadNext();
        } catch (error) {
          this.log(`Error preloading ${url}: ${error.message}`, 'error');
          
          // Mark as complete even on failure
          completedCount++;
          individualProgress.delete(url);
          updateOverallProgress();
          
          // Continue with next in queue
          return loadNext();
        }
      };
      
      // Start initial batch of loads
      const loaders = Array(Math.min(concurrentLoads, urls.length))
        .fill(null)
        .map(() => loadNext());
      
      // Wait for all loaders to finish
      await Promise.all(loaders);
      
      return results;
    }
    
    /**
     * Clear all cached buffers
     * 
     * @returns {number} Number of buffers cleared
     */
    clearCache() {
      const count = this.bufferCache.size;
      this.bufferCache.clear();
      this.bufferMetadata.clear();
      this.log(`Cleared ${count} buffers from cache`);
      return count;
    }
    
    /**
     * Get information about current cache state
     * 
     * @returns {Object} Cache statistics and information
     */
    getCacheInfo() {
      const bufferCount = this.bufferCache.size;
      const pendingCount = this.pendingLoads.size;
      
      let totalDuration = 0;
      let totalMemory = 0;
      
      this.bufferMetadata.forEach(meta => {
        totalDuration += meta.duration || 0;
        totalMemory += meta.size || 0;
      });
      
      return {
        bufferCount,
        pendingCount,
        totalDuration,
        totalMemory,
        maxCacheSize: this.config.maxCacheSize,
        ...this.stats
      };
    }
    
    /**
     * Update metadata for a buffer
     * 
     * @private
     * @param {string} url - URL of the buffer
     * @param {Object} updates - Metadata fields to update
     */
    updateMetadata(url, updates) {
      const current = this.bufferMetadata.get(url) || {};
      this.bufferMetadata.set(url, {
        ...current,
        ...updates
      });
    }
    
    /**
     * Internal method to load and decode an audio file
     * 
     * @private
     * @param {string} url - URL to load
     * @param {Function} [onProgress] - Progress callback
     * @returns {Promise<AudioBuffer>} The decoded audio buffer
     */
    async _loadAndDecodeAudioFile(url, onProgress) {
      try {
        this.log(`Loading audio file: ${url}`);
        
        // Initialize progress tracking for this URL
        this.loadingProgress.set(url, 0);
        
        // Create fetch request with progress tracking
        const response = await this._fetchWithProgress(url, (progress) => {
          this.loadingProgress.set(url, Math.floor(progress * 0.8)); // Reserve 20% for decoding
          if (onProgress) onProgress(Math.floor(progress * 0.8), url);
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        
        // Update progress - fetch completed
        this.loadingProgress.set(url, 80); // 80% complete after fetch
        if (onProgress) onProgress(80, url);
        
        // Get array buffer from response
        const arrayBuffer = await response.arrayBuffer();
        
        // Update progress - starting decode
        this.loadingProgress.set(url, 90); // 90% complete before decode
        if (onProgress) onProgress(90, url);
        
        // Decode the audio data
        try {
          const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
          
          // Update progress - complete
          this.loadingProgress.set(url, 100);
          if (onProgress) onProgress(100, url);
          
          return audioBuffer;
        } catch (decodeError) {
          throw new Error(`Failed to decode audio data: ${decodeError.message}`);
        }
      } catch (error) {
        this.log(`Error loading audio: ${error.message}`, 'error');
        throw error; // Re-throw to be handled by caller
      }
    }
    
    /**
     * Fetch with progress tracking
     * 
     * @private
     * @param {string} url - URL to fetch
     * @param {Function} progressCallback - Callback for progress updates
     * @returns {Promise<Response>} Fetch response
     */
    async _fetchWithProgress(url, progressCallback) {
      return new Promise((resolve, reject) => {
        // Create the request
        const xhr = new XMLHttpRequest();
        
        // Set up progress handling
        xhr.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            progressCallback(progress);
          }
        });
        
        // Set up load handling
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(new Response(xhr.response, {
              status: xhr.status,
              statusText: xhr.statusText,
              headers: this._parseXHRHeaders(xhr)
            }));
          } else {
            reject(new Error(`HTTP error ${xhr.status}: ${xhr.statusText}`));
          }
        });
        
        // Set up error handling
        xhr.addEventListener('error', () => {
          reject(new Error('Network error'));
        });
        
        xhr.addEventListener('abort', () => {
          reject(new Error('Request aborted'));
        });
        
        // Open and send the request
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.send();
      });
    }
    
    /**
     * Parse XHR headers into a Headers object
     * 
     * @private
     * @param {XMLHttpRequest} xhr - The XHR object
     * @returns {Headers} Response headers
     */
    _parseXHRHeaders(xhr) {
      const headers = new Headers();
      const headerString = xhr.getAllResponseHeaders();
      const headerPairs = headerString.trim().split(/[\r\n]+/);
      
      headerPairs.forEach(line => {
        const parts = line.split(': ');
        const header = parts.shift();
        const value = parts.join(': ');
        headers.append(header, value);
      });
      
      return headers;
    }
    
    /**
     * Enforce the cache size limit by removing least recently used buffers
     * 
     * @private
     */
    _enforceCacheLimit() {
      if (this.bufferCache.size <= this.config.maxCacheSize) {
        return; // Cache is not full
      }
      
      this.log(`Cache size ${this.bufferCache.size} exceeds limit of ${this.config.maxCacheSize}, pruning...`);
      
      // Get all metadata entries
      const entries = Array.from(this.bufferMetadata.entries())
        // Map to [url, metadata] format
        .map(([url, metadata]) => ({
          url,
          lastAccessed: metadata.lastAccessed || 0,
          size: metadata.size || 0
        }))
        // Sort by lastAccessed (oldest first)
        .sort((a, b) => a.lastAccessed - b.lastAccessed);
      
      // Calculate how many items to remove
      const removeCount = this.bufferCache.size - this.config.maxCacheSize;
      
      // Remove oldest entries
      for (let i = 0; i < removeCount; i++) {
        if (i < entries.length) {
          const url = entries[i].url;
          this.releaseBuffer(url);
        }
      }
    }
    
    /**
     * Logging helper that respects configuration
     * 
     * @private
     * @param {string} message - Message to log
     * @param {string} [level='info'] - Log level
     */
    log(message, level = 'info') {
      if (!this.config.enableLogging) return;
      
      const prefix = '[BufferManager]';
      
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
     * Clean up resources when no longer needed
     * This will clear all cache and abort any pending loads
     */
    dispose() {
      this.clearCache();
      this.pendingLoads.clear();
      this.loadingProgress.clear();
      this.errors.clear();
      this.bufferMetadata.clear();
      this.log('BufferManager disposed');
    }
  }
  
  export default BufferManager;