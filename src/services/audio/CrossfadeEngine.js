/**
 * CrossfadeEngine.js
 * Service for managing smooth crossfades between audio tracks
 */

class CrossfadeEngine {
    /**
     * Creates a new CrossfadeEngine instance
     * @param {AudioCore} audioCore - Reference to the AudioCore service
     * @param {BufferManager} bufferManager - Reference to the BufferManager service
     * @param {Object} config - Configuration options
     */
    constructor(audioCore, bufferManager, config = {}) {
        // Dependencies
        this.audioCore = audioCore;
        this.bufferManager = bufferManager;
        
        // Tracking active crossfades
        this.activeCrossfades = new Map();
        
        // Store current crossfade progress for UI updates
        this.progressCallbacks = new Map();
        
        // Configuration with defaults
        this.config = {
            defaultFadeDuration: 2000, // Default crossfade duration in milliseconds
            minFadeDuration: 200, // Minimum fade duration
            maxFadeDuration: 30000, // Maximum fade duration
            fadeShape: 'linear', // 'linear', 'exponential', or 'equalPower'
            preloadEnabled: true, // Whether to preload the target track
            ...config
        };
    }

    /**
     * Start a crossfade between two audio tracks
     * @param {string} sourceId - Identifier for the source track
     * @param {string} targetId - Identifier for the target track
     * @param {string} sourceUrl - URL of the source audio file
     * @param {string} targetUrl - URL of the target audio file
     * @param {Object} options - Crossfade options
     * @returns {Promise<boolean>} True if crossfade was successful
     */
    async startCrossfade(sourceId, targetId, sourceUrl, targetUrl, options = {}) {
        if (!this.audioCore.isInitialized()) {
            throw new Error('AudioCore not initialized');
        }
        
        const layerId = options.layerId || `crossfade_${Date.now()}`;
        
        // Check if already in a crossfade
        if (this.isInCrossfade(layerId)) {
            console.warn(`Crossfade already in progress for layer ${layerId}`);
            await this.cancelCrossfade(layerId);
        }
        
        // Extract options with defaults
        const {
            fadeDuration = this.config.defaultFadeDuration,
            fadeShape = this.config.fadeShape,
            preloadTarget = this.config.preloadEnabled,
            offset = 0,  // Start position in the target track (seconds)
            startDelay = 0, // Delay before starting the crossfade (milliseconds)
            onProgress = null, // Progress callback
            onComplete = null, // Completion callback
            onError = null     // Error callback
        } = options;
        
        // Validate duration
        const duration = Math.min(
            this.config.maxFadeDuration,
            Math.max(this.config.minFadeDuration, fadeDuration)
        );
        
        // Normalize to seconds for Web Audio API
        const durationSeconds = duration / 1000;
        const startDelaySeconds = startDelay / 1000;
        
        try {
            console.log(`Starting crossfade from ${sourceId} to ${targetId} (${duration}ms)`);
            
            // If progress callback provided, register it
            if (onProgress && typeof onProgress === 'function') {
                this.registerProgressCallback(layerId, onProgress);
            }
            
            // Get audio context
            const audioContext = this.audioCore.audioContext;
            const currentTime = audioContext.currentTime + startDelaySeconds;
            
            // Step 1: Create gain nodes for crossfade
            const sourceGain = audioContext.createGain();
            const targetGain = audioContext.createGain();
            
            // Step 2: Connect to master output
            sourceGain.connect(this.audioCore.masterGain);
            targetGain.connect(this.audioCore.masterGain);
            
            // Step 3: Create/get audio elements or buffer sources
            // For this implementation, we'll use buffer source nodes for precise timing
            
            // Preload target buffer if needed
            let targetBuffer;
            if (preloadTarget) {
                try {
                    // Start preloading but don't wait for completion
                    this.bufferManager.preloadBuffer(targetUrl);
                    
                    // Wait for buffer with timeout to avoid blocking too long
                    const bufferPromise = this.bufferManager.getBuffer(targetUrl);
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Buffer loading timeout')), 5000)
                    );
                    
                    // Race the promises to handle timeouts
                    targetBuffer = await Promise.race([bufferPromise, timeoutPromise]);
                } catch (error) {
                    console.warn(`Failed to preload target buffer: ${error.message}`);
                    // Continue anyway, we'll try again when needed
                }
            }
            
            // Get source buffer - this should already be loaded and playing
            const sourceBuffer = await this.bufferManager.getBuffer(sourceUrl)
                .catch(error => {
                    console.error(`Error getting source buffer: ${error.message}`);
                    throw new Error('Source buffer not available');
                });
            
            // If we don't have target buffer yet, try to get it now
            if (!targetBuffer) {
                targetBuffer = await this.bufferManager.getBuffer(targetUrl)
                    .catch(error => {
                        console.error(`Error getting target buffer: ${error.message}`);
                        throw new Error('Target buffer not available');
                    });
            }
            
            // Step 4: Create buffer source nodes
            const sourceNode = audioContext.createBufferSource();
            sourceNode.buffer = sourceBuffer;
            
            const targetNode = audioContext.createBufferSource();
            targetNode.buffer = targetBuffer;
            
            // Step 5: Connect source nodes to gain nodes
            sourceNode.connect(sourceGain);
            targetNode.connect(targetGain);
            
            // Step 6: Set up loop behavior
            sourceNode.loop = true;
            targetNode.loop = true;
            
            // Step 7: Schedule the crossfade gain changes
            
            // Set initial gain values
            sourceGain.gain.setValueAtTime(1.0, currentTime);
            targetGain.gain.setValueAtTime(0.0, currentTime);
            
            // Apply the appropriate fade curve based on fadeShape
            if (fadeShape === 'linear') {
                // Linear fade (simple but can sound abrupt)
                sourceGain.gain.linearRampToValueAtTime(0.0, currentTime + durationSeconds);
                targetGain.gain.linearRampToValueAtTime(1.0, currentTime + durationSeconds);
            } 
            else if (fadeShape === 'exponential') {
                // Exponential fade (more natural for volume perception)
                // Note: exponentialRampToValueAtTime can't reach 0, so we use a small value
                sourceGain.gain.exponentialRampToValueAtTime(0.001, currentTime + durationSeconds);
                sourceGain.gain.linearRampToValueAtTime(0.0, currentTime + durationSeconds + 0.01);
                
                targetGain.gain.exponentialRampToValueAtTime(1.0, currentTime + durationSeconds);
            }
            else if (fadeShape === 'equalPower') {
                // Equal power crossfade (maintains consistent perceived volume)
                // Uses custom curve with trigonometric functions
                const fadeSteps = 100;
                for (let i = 0; i <= fadeSteps; i++) {
                    const t = i / fadeSteps;
                    const fadeTime = currentTime + (t * durationSeconds);
                    
                    // Equal power curve: source decreases as cos, target increases as sin
                    const sourceVal = Math.cos(t * Math.PI / 2);
                    const targetVal = Math.sin(t * Math.PI / 2);
                    
                    sourceGain.gain.linearRampToValueAtTime(sourceVal, fadeTime);
                    targetGain.gain.linearRampToValueAtTime(targetVal, fadeTime);
                }
            }
            else {
                // Default to linear as fallback
                sourceGain.gain.linearRampToValueAtTime(0.0, currentTime + durationSeconds);
                targetGain.gain.linearRampToValueAtTime(1.0, currentTime + durationSeconds);
            }
            
            // Step 8: Start the source nodes
            // Start source node from its current position (if known), otherwise from beginning
            sourceNode.start(0);
            
            // Start target node with optional offset
            targetNode.start(0, offset);
            
            // Step 9: Store crossfade data for tracking
            this.activeCrossfades.set(layerId, {
                sourceId,
                targetId,
                sourceNode,
                targetNode,
                sourceGain,
                targetGain,
                startTime: currentTime,
                duration: durationSeconds,
                layerId,
                completed: false,
                onComplete
            });
            
            // Step 10: Set up progress tracking
            this._startProgressTracking(layerId);
            
            return true;
        } 
        catch (error) {
            console.error(`Crossfade error: ${error.message}`, error);
            
            // Call error callback if provided
            if (onError && typeof onError === 'function') {
                onError(error);
            }
            
            // Clean up any resources
            this._cleanupCrossfade(layerId);
            
            return false;
        }
    }

    /**
     * Cancel an active crossfade
     * @param {string} layerId - Identifier for the layer being crossfaded
     * @returns {boolean} True if a crossfade was cancelled
     */
    cancelCrossfade(layerId) {
        if (!this.activeCrossfades.has(layerId)) {
            return false;
        }
        
        try {
            const crossfade = this.activeCrossfades.get(layerId);
            
            // Stop tracking progress
            this._stopProgressTracking(layerId);
            
            // Clean up the crossfade resources
            this._cleanupCrossfade(layerId);
            
            console.log(`Cancelled crossfade for layer ${layerId}`);
            return true;
        } 
        catch (error) {
            console.error(`Error cancelling crossfade: ${error.message}`);
            
            // Attempt cleanup even if there was an error
            this.activeCrossfades.delete(layerId);
            
            return false;
        }
    }

    /**
     * Check if a layer is currently being crossfaded
     * @param {string} layerId - Identifier for the layer
     * @returns {boolean} True if the layer is in an active crossfade
     */
    isInCrossfade(layerId) {
        return this.activeCrossfades.has(layerId);
    }

    /**
     * Get the progress of an active crossfade
     * @param {string} layerId - Identifier for the layer
     * @returns {number} Progress value from 0 to 1, or -1 if no active crossfade
     */
    getCrossfadeProgress(layerId) {
        const crossfade = this.activeCrossfades.get(layerId);
        if (!crossfade) {
            return -1;
        }
        
        // Calculate progress based on start time and duration
        const elapsed = this.audioCore.getCurrentTime() - crossfade.startTime;
        return Math.min(1, Math.max(0, elapsed / crossfade.duration));
    }

    /**
     * Register a callback for crossfade progress updates
     * @param {string} layerId - Identifier for the layer
     * @param {Function} callback - Callback function receiving progress (0-1)
     * @returns {Function} Function to unregister the callback
     */
    registerProgressCallback(layerId, callback) {
        if (!this.progressCallbacks.has(layerId)) {
            this.progressCallbacks.set(layerId, new Set());
        }
        
        const callbacks = this.progressCallbacks.get(layerId);
        callbacks.add(callback);
        
        // Return a function to unregister the callback
        return () => {
            if (this.progressCallbacks.has(layerId)) {
                const callbacks = this.progressCallbacks.get(layerId);
                callbacks.delete(callback);
                
                if (callbacks.size === 0) {
                    this.progressCallbacks.delete(layerId);
                }
            }
        };
    }

    /**
     * Set the default crossfade duration
     * @param {number} duration - Duration in milliseconds
     */
    setDefaultDuration(duration) {
        const validDuration = Math.min(
            this.config.maxFadeDuration,
            Math.max(this.config.minFadeDuration, duration)
        );
        
        this.config.defaultFadeDuration = validDuration;
    }

    /**
     * Get all active crossfades
     * @returns {Array} Array of active crossfade data
     */
    getActiveCrossfades() {
        return Array.from(this.activeCrossfades.entries()).map(([layerId, data]) => ({
            layerId,
            sourceId: data.sourceId,
            targetId: data.targetId,
            progress: this.getCrossfadeProgress(layerId),
            startTime: data.startTime,
            duration: data.duration
        }));
    }
    /**
     * Start tracking progress for an active crossfade
     * @param {string} layerId - Identifier for the layer
     * @private
     */
    _startProgressTracking(layerId) {
        if (!this.activeCrossfades.has(layerId)) {
            return;
        }
        
        const crossfade = this.activeCrossfades.get(layerId);
        
        // Create a tracking interval to update progress
        const intervalId = setInterval(() => {
            if (!this.activeCrossfades.has(layerId)) {
                clearInterval(intervalId);
                return;
            }
            
            const progress = this.getCrossfadeProgress(layerId);
            
            // Notify progress callbacks
            if (this.progressCallbacks.has(layerId)) {
                const callbacks = this.progressCallbacks.get(layerId);
                callbacks.forEach(callback => {
                    try {
                        callback(progress);
                    } catch (error) {
                        console.warn(`Error in crossfade progress callback: ${error.message}`);
                    }
                });
            }
            
            // Check if crossfade is complete
            if (progress >= 1) {
                // Stop the interval
                clearInterval(intervalId);
                
                // Mark as completed
                crossfade.completed = true;
                
                // Trigger completion callback
                if (crossfade.onComplete && typeof crossfade.onComplete === 'function') {
                    try {
                        crossfade.onComplete(crossfade.targetId);
                    } catch (error) {
                        console.warn(`Error in crossfade completion callback: ${error.message}`);
                    }
                }
                
                // Clean up
                this._cleanupCrossfade(layerId);
                
                console.log(`Crossfade completed for layer ${layerId}`);
            }
        }, 100); // Update every 100ms
        
        // Store the interval ID with the crossfade data
        crossfade.progressInterval = intervalId;
    }
    
    /**
     * Stop tracking progress for a crossfade
     * @param {string} layerId - Identifier for the layer
     * @private
     */
    _stopProgressTracking(layerId) {
        if (!this.activeCrossfades.has(layerId)) {
            return;
        }
        
        const crossfade = this.activeCrossfades.get(layerId);
        
        // Clear the progress tracking interval
        if (crossfade.progressInterval) {
            clearInterval(crossfade.progressInterval);
            crossfade.progressInterval = null;
        }
    }
    
    /**
     * Clean up resources for a crossfade
     * @param {string} layerId - Identifier for the layer
     * @private
     */
    _cleanupCrossfade(layerId) {
        if (!this.activeCrossfades.has(layerId)) {
            return;
        }
        
        const crossfade = this.activeCrossfades.get(layerId);
        
        try {
            // Stop progress tracking
            this._stopProgressTracking(layerId);
            
            // Stop and disconnect source nodes if they exist
            if (crossfade.sourceNode) {
                try {
                    crossfade.sourceNode.stop();
                } catch (error) {
                    // Ignore errors from stopping already stopped nodes
                }
                crossfade.sourceNode.disconnect();
            }
            
            if (crossfade.targetNode) {
                try {
                    // Don't stop the target node if the crossfade completed successfully
                    // as it becomes the new active track
                    if (!crossfade.completed) {
                        crossfade.targetNode.stop();
                    }
                } catch (error) {
                    // Ignore errors from stopping already stopped nodes
                }
                
                // Keep the target node connected if crossfade completed
                if (!crossfade.completed) {
                    crossfade.targetNode.disconnect();
                }
            }
            
            // Disconnect gain nodes
            if (crossfade.sourceGain) {
                crossfade.sourceGain.disconnect();
            }
            
            if (crossfade.targetGain) {
                // Only disconnect if crossfade didn't complete
                if (!crossfade.completed) {
                    crossfade.targetGain.disconnect();
                }
            }
        }
        catch (error) {
            console.warn(`Error cleaning up crossfade: ${error.message}`);
        }
        finally {
            // Always remove from active crossfades
            this.activeCrossfades.delete(layerId);
            
            // Clean up progress callbacks
            this.progressCallbacks.delete(layerId);
        }
    }
}

export default CrossfadeEngine;