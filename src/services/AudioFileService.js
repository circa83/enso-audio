/**
 * AudioFileService.js
 * 
 * Service for managing audio file URLs and access in Ensō Audio
 * Handles retrieving audio URLs from Vercel Blob and caching
 */

class AudioFileService {
    /**
     * Create a new AudioFileService instance
     * @param {Object} options - Configuration options
     * @param {string} [options.blobBaseUrl] - Base URL for Vercel Blob storage
     * @param {string} [options.fallbackBasePath='/samples'] - Fallback path for local files
     * @param {number} [options.cacheDuration=300000] - Cache duration in milliseconds (default: 5 minutes)
     * @param {boolean} [options.enableLogging=false] - Enable detailed console logging
     */
    constructor(options = {}) {
      // Configuration
      this.config = {
        blobBaseUrl: options.blobBaseUrl || process.env.NEXT_PUBLIC_BLOB_BASE_URL,
        fallbackBasePath: options.fallbackBasePath || '/samples',
        cacheDuration: options.cacheDuration || 300000, // 5 minutes default
        enableLogging: options.enableLogging || false
      };
      
      // Initialize URL cache
      this.urlCache = new Map();
      this.pendingRequests = new Map();
      
      this.log('AudioFileService initialized');
    }
    
    /**
     * Get the accessible URL for an audio file
     * @param {string} audioUrl - Original URL from collection data
     * @param {Object} [options] - Options for URL resolution
     * @param {boolean} [options.useCache=true] - Use cached URL if available
     * @param {boolean} [options.transformBlobUrls=true] - Transform Blob URLs if needed
     * @returns {Promise<string>} Resolved and accessible audio URL
     */
    async getAudioUrl(audioUrl, options = {}) {
      const {
        useCache = true,
        transformBlobUrls = true
      } = options;
      
      if (!audioUrl) {
        throw new Error('Audio URL is required');
      }
      
      this.log(`[getAudioUrl] Processing URL: ${audioUrl}`);
      
      // Check if URL is already cached
      if (useCache && this.urlCache.has(audioUrl)) {
        const cachedData = this.urlCache.get(audioUrl);
        
        // Check if cache is still valid
        if (Date.now() - cachedData.timestamp < this.config.cacheDuration) {
          this.log(`[getAudioUrl] Using cached URL for: ${audioUrl}`);
          return cachedData.resolvedUrl;
        }
      }
      
      // Check for pending request for this URL
      if (this.pendingRequests.has(audioUrl)) {
        this.log(`[getAudioUrl] Using pending request for: ${audioUrl}`);
        return this.pendingRequests.get(audioUrl);
      }
      
      // Create promise for resolving the URL
      const resolvePromise = (async () => {
        try {
          let resolvedUrl = audioUrl;
          
          // Handle different URL formats
          if (this._isRelativePath(audioUrl)) {
            // Handle relative paths from collection JSON
            resolvedUrl = this._resolveRelativePath(audioUrl);
            this.log(`[getAudioUrl] Resolved relative path to: ${resolvedUrl}`);
          } else if (transformBlobUrls && this._isBlobUrl(audioUrl)) {
            // Handle Vercel Blob URLs if needed
            resolvedUrl = await this._transformBlobUrl(audioUrl);
            this.log(`[getAudioUrl] Transformed Blob URL to: ${resolvedUrl}`);
          }
          
          // Validate URL by checking if it's accessible
          try {
            await this._validateAudioUrl(resolvedUrl);
            this.log(`[getAudioUrl] Validated URL: ${resolvedUrl}`);
          } catch (error) {
            // If URL validation fails, try fallback
            this.log(`[getAudioUrl] URL validation failed, trying fallback: ${error.message}`, 'warn');
            
            // Generate fallback URL using local paths
            const fallbackUrl = this._generateFallbackUrl(audioUrl);
            
            // Validate fallback URL
            await this._validateAudioUrl(fallbackUrl);
            this.log(`[getAudioUrl] Using fallback URL: ${fallbackUrl}`);
            
            resolvedUrl = fallbackUrl;
          }
          
          // Cache the resolved URL
          this.urlCache.set(audioUrl, {
            resolvedUrl,
            timestamp: Date.now()
          });
          
          return resolvedUrl;
        } catch (error) {
          this.log(`[getAudioUrl] Failed to resolve URL: ${error.message}`, 'error');
          
          // Return original URL as fallback if all else fails
          return audioUrl;
        } finally {
          // Remove from pending requests
          this.pendingRequests.delete(audioUrl);
        }
      })();
      
      // Store in pending requests
      this.pendingRequests.set(audioUrl, resolvePromise);
      
      return resolvePromise;
    }
    
    /**
     * Resolve multiple audio URLs in parallel
     * @param {string[]} audioUrls - Array of audio URLs to resolve
     * @param {Object} [options] - Options for batch resolution
     * @param {number} [options.concurrentLimit=5] - Maximum concurrent requests
     * @returns {Promise<Map<string, string>>} Map of original URLs to resolved URLs
     */
    async batchResolveUrls(audioUrls, options = {}) {
      const { 
        concurrentLimit = 5,
        ...urlOptions 
      } = options;
      
      if (!audioUrls || !Array.isArray(audioUrls) || audioUrls.length === 0) {
        return new Map();
      }
      
      this.log(`[batchResolveUrls] Resolving ${audioUrls.length} URLs`);
      
      const results = new Map();
      const queue = [...audioUrls];
      
      // Process URLs in batches to limit concurrent requests
      while (queue.length > 0) {
        const batch = queue.splice(0, concurrentLimit);
        this.log(`[batchResolveUrls] Processing batch of ${batch.length} URLs`);
        
        const batchPromises = batch.map(async (url) => {
          try {
            const resolvedUrl = await this.getAudioUrl(url, urlOptions);
            results.set(url, resolvedUrl);
          } catch (error) {
            this.log(`[batchResolveUrls] Error resolving URL ${url}: ${error.message}`, 'error');
            // Set original URL as fallback
            results.set(url, url);
          }
        });
        
        // Wait for batch to complete
        await Promise.all(batchPromises);
      }
      
      this.log(`[batchResolveUrls] Completed resolving ${results.size} URLs`);
      return results;
    }
    
    /**
     * Convert collection tracks to use resolved URLs
     * @param {Object} collection - Collection data with tracks
     * @returns {Promise<Object>} Collection with resolved audio URLs
     */
    async resolveCollectionUrls(collection) {
      if (!collection || !collection.tracks) {
        throw new Error('Valid collection with tracks is required');
      }
      
      try {
        this.log(`[resolveCollectionUrls] Processing collection: ${collection.name || collection.id}`);
        
        // Gather all URLs that need resolving
        const allUrls = [];
        
        // Extract URLs from tracks
        collection.tracks.forEach(track => {
          if (track.audioUrl) {
            allUrls.push(track.audioUrl);
          }
          
          // Extract URLs from variations
          if (track.variations && Array.isArray(track.variations)) {
            track.variations.forEach(variation => {
              if (variation.audioUrl) {
                allUrls.push(variation.audioUrl);
              }
            });
          }
        });
        
        // Resolve all URLs in batch
        const resolvedUrls = await this.batchResolveUrls(allUrls);
        
        // Create deep copy of collection to avoid mutations
        const resolvedCollection = JSON.parse(JSON.stringify(collection));
        
        // Update tracks with resolved URLs
        resolvedCollection.tracks = resolvedCollection.tracks.map(track => {
          // Update main track URL
          if (track.audioUrl && resolvedUrls.has(track.audioUrl)) {
            track.audioUrl = resolvedUrls.get(track.audioUrl);
          }
          
          // Update variation URLs
          if (track.variations && Array.isArray(track.variations)) {
            track.variations = track.variations.map(variation => {
              if (variation.audioUrl && resolvedUrls.has(variation.audioUrl)) {
                variation.audioUrl = resolvedUrls.get(variation.audioUrl);
              }
              return variation;
            });
          }
          
          return track;
        });
        
        this.log(`[resolveCollectionUrls] Resolved ${allUrls.length} URLs for collection`);
        return resolvedCollection;
      } catch (error) {
        this.log(`[resolveCollectionUrls] Error: ${error.message}`, 'error');
        // Return original collection as fallback
        return collection;
      }
    }
    
    /**
     * Reset the URL cache
     */
    resetCache() {
      this.urlCache.clear();
      this.log('[resetCache] URL cache cleared');
    }
    
    /**
     * Check if a URL is a relative path
     * @private
     * @param {string} url - URL to check
     * @returns {boolean} True if URL is a relative path
     */
    _isRelativePath(url) {
      return url && 
             typeof url === 'string' && 
             !url.startsWith('http') && 
             !url.startsWith('blob:') && 
             !url.startsWith('data:');
    }
    
    /**
     * Check if a URL is a Vercel Blob URL
     * @private
     * @param {string} url - URL to check
     * @returns {boolean} True if URL is a Vercel Blob URL
     */
    _isBlobUrl(url) {
      return url && 
             typeof url === 'string' && 
             this.config.blobBaseUrl && 
             url.includes(this.config.blobBaseUrl);
    }
    
    /**
     * Resolve a relative path to a full URL
     * @private
     * @param {string} path - Relative path
     * @returns {string} Fully resolved URL
     */
    _resolveRelativePath(path) {
      // Handle edge cases
      if (!path) return '';
      
      // For absolute URLs, return as is
      if (path.startsWith('http')) {
        return path;
      }
      
      // For paths that already start with slash, use as is
      if (path.startsWith('/')) {
        return path;
      }
      
      // Otherwise, prepend base path
      return `${this.config.fallbackBasePath}/${path}`;
    }
    
    /**
     * Transform a Vercel Blob URL if needed
     * @private
     * @param {string} blobUrl - Vercel Blob URL
     * @returns {Promise<string>} Transformed URL
     */
    async _transformBlobUrl(blobUrl) {
      // For now, just return the blob URL directly
      // In the future, this could handle token generation or URL transformation
      return blobUrl;
    }
    
    /**
     * Generate a fallback URL for local files
     * @private
     * @param {string} originalUrl - Original URL
     * @returns {string} Fallback URL
     */
    _generateFallbackUrl(originalUrl) {
      // For blob URLs, extract the path part
      if (this._isBlobUrl(originalUrl) && this.config.blobBaseUrl) {
        const pathPart = originalUrl.replace(this.config.blobBaseUrl, '');
        return `${this.config.fallbackBasePath}${pathPart}`;
      }
      
      // For HTTP URLs that aren't blob URLs, use the pathname
      if (originalUrl.startsWith('http')) {
        try {
          const url = new URL(originalUrl);
          return `${this.config.fallbackBasePath}${url.pathname}`;
        } catch (error) {
          // If URL parsing fails, use a simple fallback
          return `${this.config.fallbackBasePath}/fallback.mp3`;
        }
      }
      
      // For relative paths, ensure they have the fallback base path
      return this._resolveRelativePath(originalUrl);
    }
    
    /**
     * Validate if an audio URL is accessible
     * @private
     * @param {string} url - URL to validate
     * @returns {Promise<boolean>} True if URL is valid and accessible
     */
    async _validateAudioUrl(url) {
      // Skip validation for data URLs
      if (url.startsWith('data:')) {
        return true;
      }
      
      // For relative URLs, assume they're valid (they'll be loaded by Audio element)
      if (url.startsWith('/')) {
        return true;
      }
      
      // For HTTP URLs, check with a HEAD request
      if (url.startsWith('http')) {
        try {
          const response = await fetch(url, { 
            method: 'HEAD', 
            mode: 'no-cors' // Use no-cors for cross-origin URLs
          });
          
          // If we're here, the request didn't throw, so it's somewhat valid
          return true;
        } catch (error) {
          throw new Error(`URL not accessible: ${error.message}`);
        }
      }
      
      // If we can't validate, assume it's valid
      return true;
    }
    
    /**
     * Logging helper that respects configuration
     * @private
     * @param {string} message - Message to log
     * @param {string} [level='info'] - Log level
     */
    log(message, level = 'info') {
      if (!this.config.enableLogging) return;
      
      const prefix = '[AudioFileService]';
      
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
  }
  
  export default AudioFileService;