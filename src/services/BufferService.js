/**
 * BufferService.js
 * 
 * Service for loading, caching, and managing audio buffers
 * Handles the loading and decoding of audio files into AudioBuffers
 * Provides progress tracking and memory optimization
 */

import eventBus, { EVENTS } from './EventBus';

class BufferService {
  /**
   * Create a new BufferService instance
   * @param {Object} options - Configuration options
   * @param {AudioContext} options.audioContext - Web Audio API context to use
   * @param {number} [options.maxCacheSize=50] - Maximum number of buffers to keep in cache
   * @param {boolean} [options.enableLogging=false] - Enable detailed console logging
   */
  constructor(options = {}) {
    if (!options.audioContext) {
      throw new Error('BufferService requires an AudioContext instance');
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

    this.log('BufferService initialized');

    // Emit initialization event
    eventBus.emit(EVENTS.BUFFER_INITIALIZED || 'buffer:initialized', {
      maxCacheSize: this.config.maxCacheSize,
      timestamp: Date.now()
    });
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

      // Emit cache hit event
      eventBus.emit(EVENTS.BUFFER_CACHE_HIT || 'buffer:cacheHit', {
        url,
        buffer: cachedBuffer,
        metadata: this.bufferMetadata.get(url),
        timestamp: Date.now()
      });

      return cachedBuffer;
    }

    // Increment cache miss counter
    this.stats.cacheMisses++;

    // Check if this URL is already being loaded
    if (this.pendingLoads.has(url)) {
      this.log(`Already loading ${url}, returning existing promise`);
      return this.pendingLoads.get(url);
    }

    // Emit buffer load start event
    eventBus.emit(EVENTS.BUFFER_LOAD_START || 'buffer:loadStart', {
      url,
      timestamp: Date.now(),
      force
    });

    // Start a new load
    try {
      // Create a promise for loading this file
      const loadPromise = this._loadAndDecodeAudioFile(url, (progress) => {
        // Update internal progress tracking
        this.loadingProgress.set(url, progress);

        // Call provided progress callback if any
        if (onProgress) {
          onProgress(progress, url);
        }

        // Emit progress event
        eventBus.emit(EVENTS.BUFFER_LOAD_PROGRESS || 'buffer:loadProgress', {
          url,
          progress,
          timestamp: Date.now()
        });
      });

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

      // Emit loaded event
      eventBus.emit(EVENTS.BUFFER_LOADED || 'buffer:loaded', {
        url,
        buffer,
        metadata: this.bufferMetadata.get(url),
        timestamp: Date.now()
      });

      return buffer;
    } catch (error) {
      // Store error information
      this.errors.set(url, error.message);

      // Remove from pending loads
      this.pendingLoads.delete(url);

      // Update stats
      this.stats.loadErrors++;

      // Emit error event
      eventBus.emit(EVENTS.BUFFER_ERROR || 'buffer:error', {
        url,
        error: error.message,
        timestamp: Date.now()
      });

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

    // Get metadata before removal for event
    const metadata = this.bufferMetadata.get(url);

    this.bufferCache.delete(url);
    this.bufferMetadata.delete(url);
    this.log(`Released buffer: ${url}`);

    // Emit buffer released event
    eventBus.emit(EVENTS.BUFFER_RELEASED || 'buffer:released', {
      url,
      metadata,
      timestamp: Date.now()
    });

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

    // Emit preload start event
    eventBus.emit(EVENTS.BUFFER_PRELOAD_START || 'buffer:preloadStart', {
      urls,
      count: urls.length,
      concurrentLoads,
      timestamp: Date.now()
    });

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

      // Call callback
      onProgress(overallProgress, detailedProgress);

      // Emit preload progress event
      eventBus.emit(EVENTS.BUFFER_PRELOAD_PROGRESS || 'buffer:preloadProgress', {
        progress: overallProgress,
        detailedProgress,
        completed: completedCount,
        total: totalCount,
        timestamp: Date.now()
      });
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

    // Emit preload complete event
    eventBus.emit(EVENTS.BUFFER_PRELOAD_COMPLETE || 'buffer:preloadComplete', {
      urls,
      loadedCount: results.size,
      errorCount: urls.length - results.size,
      timestamp: Date.now(),
      buffers: results
    });

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

    // Emit cache cleared event
    eventBus.emit(EVENTS.BUFFER_CACHE_CLEARED || 'buffer:cacheCleared', {
      count,
      timestamp: Date.now()
    });

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
   * Check if a URL is a Vercel Blob URL
   * @private
   * @param {string} url - URL to check
   * @returns {boolean} True if the URL is a Vercel Blob URL
   */
  _isBlobUrl(url) {
    const blobBaseUrl = process.env.NEXT_PUBLIC_BLOB_BASE_URL;
    return url &&
      typeof url === 'string' &&
      blobBaseUrl &&
      url.includes(blobBaseUrl);
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

      // Check if it's a Blob URL and requires special handling
      const isBlobUrl = this._isBlobUrl(url);
      const isStreamingOptimized = isBlobUrl; // Use streaming optimization for Blob URLs

      if (isBlobUrl) {
        this.log(`Detected Blob URL: ${url}, using streaming fetch`);
      }

      // Use optimized fetch for Blob URLs
      const response = await this._fetchWithProgress(url, (progress) => {
        // Reserve 20% for decoding as before
        const loadProgress = Math.floor(progress * 0.8);
        this.loadingProgress.set(url, loadProgress);
        if (onProgress) onProgress(loadProgress, url);

        // Emit progress event for detailed tracking
        eventBus.emit(EVENTS.BUFFER_LOAD_PROGRESS || 'buffer:loadProgress', {
          url,
          phase: 'download',
          progress: loadProgress,
          overallProgress: loadProgress,
          timestamp: Date.now()
        });
      }, isStreamingOptimized);

      if (!response.ok) {
        const errorMsg = `HTTP error ${response.status}: ${response.statusText}`;
        throw new Error(errorMsg);
      }

      // Update progress - fetch completed
      this.loadingProgress.set(url, 80); // 80% complete after fetch
      if (onProgress) onProgress(80, url);

      // Emit progress event for fetch completion
      eventBus.emit(EVENTS.BUFFER_LOAD_PROGRESS || 'buffer:loadProgress', {
        url,
        phase: 'download_complete',
        progress: 80,
        overallProgress: 80,
        timestamp: Date.now()
      });

      // Get array buffer from response
      const arrayBuffer = await response.arrayBuffer();

      // Update progress - starting decode
      this.loadingProgress.set(url, 90); // 90% complete before decode
      if (onProgress) onProgress(90, url);

      // Emit progress event for decode start
      eventBus.emit(EVENTS.BUFFER_LOAD_PROGRESS || 'buffer:loadProgress', {
        url,
        phase: 'decode_start',
        progress: 90,
        overallProgress: 90,
        timestamp: Date.now()
      });

      // Decode the audio data
      try {
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        // Update progress - complete
        this.loadingProgress.set(url, 100);
        if (onProgress) onProgress(100, url);

        // Emit progress event for decode completion
        eventBus.emit(EVENTS.BUFFER_LOAD_PROGRESS || 'buffer:loadProgress', {
          url,
          phase: 'decode_complete',
          progress: 100,
          overallProgress: 100,
          timestamp: Date.now()
        });

        return audioBuffer;
      } catch (decodeError) {
        // Emit decode error event
        eventBus.emit(EVENTS.BUFFER_ERROR || 'buffer:error', {
          url,
          phase: 'decode',
          error: decodeError.message,
          timestamp: Date.now()
        });

        throw new Error(`Failed to decode audio data: ${decodeError.message}`);
      }
    } catch (error) {
      this.log(`Error loading audio: ${error.message}`, 'error');

      // Emit error event if we haven't already
      if (!error.message.includes('Failed to decode audio data')) {
        eventBus.emit(EVENTS.BUFFER_ERROR || 'buffer:error', {
          url,
          error: error.message,
          timestamp: Date.now()
        });
      }

      throw error; // Re-throw to be handled by caller
    }
  }

  /**
   * Fetch a file with progress monitoring
   * 
   * @private
   * @param {string} url - URL to fetch
   * @param {Function} onProgress - Progress callback(progress 0-100)
   * @param {boolean} [optimized=false] - Whether to use optimized streaming fetch
   * @returns {Promise<Response>} Fetch response
   */
  async _fetchWithProgress(url, onProgress, optimized = false) {
    // For optimized loading, use a streaming approach
    if (optimized) {
      return this._streamingFetch(url, onProgress);
    }

    // Standard fetch with progress via reader
    try {
      const response = await fetch(url);

      // If we can't get content length, just fetch normally
      const contentLength = response.headers.get('content-length');
      if (!contentLength) {
        this.log(`No content-length header for ${url}, progress unavailable`);
        if (onProgress) onProgress(50); // Arbitrary progress value
        return response;
      }

      // Convert to number and check validity
      const total = parseInt(contentLength, 10);
      if (isNaN(total) || total <= 0) {
        this.log(`Invalid content-length for ${url}: ${contentLength}`);
        if (onProgress) onProgress(50); // Arbitrary progress value
        return response;
      }

      // Create a reader to stream the response data
      const reader = response.body.getReader();
      let received = 0;

      // Create a new Response from the streaming data
      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                // We're done, close the controller
                controller.close();
                break;
              }

              // Push the next data chunk
              controller.enqueue(value);

              // Update progress
              received += value.length;
              const progress = Math.min(100, Math.floor((received / total) * 100));
              if (onProgress) onProgress(progress);
            }
          } catch (error) {
            controller.error(error);
          }
        }
      });

      // Return a new Response with the streamed data
      return new Response(stream, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText
      });
    } catch (error) {
      this.log(`Error in fetch with progress: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Optimized streaming fetch for audio files
   * 
   * @private
   * @param {string} url - URL to fetch
   * @param {Function} onProgress - Progress callback(progress 0-100)
   * @returns {Promise<Response>} Fetch response
   */
  async _streamingFetch(url, onProgress) {
    // This is a specialized version for streaming audio
    // It could include additional optimizations for specific content types
    try {
      const response = await fetch(url);

      // Get content length if possible
      const contentLength = response.headers.get('content-length');
      const total = parseInt(contentLength, 10);

      // If we have a valid content length, track progress
      if (!isNaN(total) && total > 0) {
        let received = 0;

        // Create a reader to stream the response
        const reader = response.body.getReader();

        // Create a new ReadableStream 
        const stream = new ReadableStream({
          async start(controller) {
            try {
              while (true) {
                const { done, value } = await reader.read();

                if (done) {
                  controller.close();
                  break;
                }

                // Update progress
                received += value.length;
                const progress = Math.min(100, Math.floor((received / total) * 100));
                if (onProgress) onProgress(progress);

                controller.enqueue(value);
              }
            } catch (error) {
              controller.error(error);
            }
          }
        });

        // Return a new Response with our processed stream
        return new Response(stream, {
          headers: response.headers,
          status: response.status,
          statusText: response.statusText
        });
      }

      // Fallback for when we can't determine content length
      if (onProgress) onProgress(50); // Just use an arbitrary progress value
      return response;
    } catch (error) {
      this.log(`Error in streaming fetch: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Enforce cache size limits by removing least recently used buffers
   * 
   * @private
   */
  _enforceCacheLimit() {
    if (this.bufferCache.size <= this.config.maxCacheSize) {
      return; // Cache is within limits
    }

    this.log(`Cache size ${this.bufferCache.size} exceeds limit of ${this.config.maxCacheSize}, pruning...`);

    // Get all metadata entries sorted by last accessed time (oldest first)
    const entries = Array.from(this.bufferMetadata.entries())
      .sort((a, b) => (a[1].lastAccessed || 0) - (b[1].lastAccessed || 0));

    // Calculate how many to remove
    const removeCount = this.bufferCache.size - this.config.maxCacheSize;

    // Remove oldest entries first
    let removedCount = 0;
    let removedSize = 0;

    for (let i = 0; i < removeCount && i < entries.length; i++) {
      const [url, metadata] = entries[i];

      if (this.bufferCache.has(url)) {
        // Track stats before removal
        removedSize += metadata.size || 0;

        // Remove from cache and metadata
        this.bufferCache.delete(url);
        this.bufferMetadata.delete(url);
        removedCount++;

        // Emit buffer pruned event
        eventBus.emit(EVENTS.BUFFER_PRUNED || 'buffer:pruned', {
          url,
          metadata,
          reason: 'cache_limit',
          timestamp: Date.now()
        });
      }
    }

    this.log(`Pruned ${removedCount} buffers (${Math.round(removedSize / 1024 / 1024)}MB) from cache`);

    // Emit cache pruned event
    eventBus.emit(EVENTS.BUFFER_CACHE_PRUNED || 'buffer:cachePruned', {
      removedCount,
      removedSize,
      newSize: this.bufferCache.size,
      timestamp: Date.now()
    });
  }

  /**
   * Log messages with consistent formatting
   * 
   * @param {string} message - Message to log
   * @param {string} [level='info'] - Log level
   */
  log(message, level = 'info') {
    if (!this.config.enableLogging) return;

    const prefix = '[BufferService]';

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
   * Clean up resources used by BufferService
   * This should be called when the service is no longer needed
   */
  dispose() {
    this.clearCache();
    this.pendingLoads.clear();
    this.loadingProgress.clear();
    this.errors.clear();
    this.bufferMetadata.clear();
    this.log('BufferService disposed');

    // Emit disposal event
    eventBus.emit(EVENTS.BUFFER_DISPOSED || 'buffer:disposed', {
      timestamp: Date.now()
    });
  }

  /**
   * Alias for dispose to maintain API compatibility with other services
   */
  cleanup() {
    this.dispose();
  }

  /**
   * Load collection track into buffer
   * Utility method for easier integration with collections
   * 
   * @param {Object} track - Track object from collection
   * @param {Object} [options] - Loading options
   * @returns {Promise<AudioBuffer>} The loaded buffer
   */
  async loadCollectionTrack(track, options = {}) {
    if (!track || !track.audioUrl) {
      throw new Error('Invalid track object, missing audioUrl');
    }

    try {
      this.log(`Loading collection track: ${track.title || track.id}`);

      // Emit collection load start event
      eventBus.emit(EVENTS.BUFFER_COLLECTION_TRACK_LOAD_START || 'buffer:collectionTrackLoadStart', {
        track,
        url: track.audioUrl,
        timestamp: Date.now()
      });

      // Load the buffer
      const buffer = await this.loadAudioBuffer(track.audioUrl, options);

      // Emit collection track loaded event
      eventBus.emit(EVENTS.BUFFER_COLLECTION_TRACK_LOADED || 'buffer:collectionTrackLoaded', {
        track,
        buffer,
        url: track.audioUrl,
        timestamp: Date.now()
      });

      return buffer;
    } catch (error) {
      // Emit collection track error event
      eventBus.emit(EVENTS.BUFFER_COLLECTION_TRACK_ERROR || 'buffer:collectionTrackError', {
        track,
        error: error.message,
        url: track.audioUrl,
        timestamp: Date.now()
      });

      throw error;
    }
  }

  /**
   * Load all tracks for a collection layer
   * 
   * @param {Array} tracks - Array of tracks in this layer
   * @param {Object} [options] - Loading options
   * @returns {Promise<Map<string, AudioBuffer>>} Map of track IDs to buffers
   */
  async loadCollectionLayer(tracks, options = {}) {
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return new Map();
    }

    const trackUrls = tracks.map(track => track.audioUrl).filter(Boolean);
    const trackMap = new Map(tracks.map(track => [track.audioUrl, track]));

    try {
      // Emit layer load start event
      eventBus.emit(EVENTS.BUFFER_COLLECTION_LAYER_LOAD_START || 'buffer:collectionLayerLoadStart', {
        tracks,
        count: trackUrls.length,
        timestamp: Date.now()
      });

      // Preload all track buffers
      const buffers = await this.preloadBuffers(trackUrls, options);

      // Create a map of track IDs to buffers
      const results = new Map();

      buffers.forEach((buffer, url) => {
        const track = trackMap.get(url);
        if (track && track.id) {
          results.set(track.id, buffer);
        }
      });

      // Emit layer loaded event
      eventBus.emit(EVENTS.BUFFER_COLLECTION_LAYER_LOADED || 'buffer:collectionLayerLoaded', {
        tracks,
        bufferCount: results.size,
        timestamp: Date.now()
      });

      return results;
    } catch (error) {
      // Emit layer error event
      eventBus.emit(EVENTS.BUFFER_COLLECTION_LAYER_ERROR || 'buffer:collectionLayerError', {
        tracks,
        error: error.message,
        timestamp: Date.now()
      });

      throw error;
    }
  }
}

export default BufferService;
