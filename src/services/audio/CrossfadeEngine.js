/**
 * CrossfadeEngine.js
 * 
 * Service for handling crossfades between audio tracks.
 * Manages transitions between different audio sources with
 * smooth volume curves and progress tracking.
 */

class CrossfadeEngine {
    constructor(audioContext) {
      this.audioContext = audioContext;
      this.activeCrossfades = new Map(); // Map of layerId -> crossfade info
      this.progressCallbacks = new Map(); // Map of layerId -> progress callback
      this.crossfadeCompleteCallbacks = new Map(); // Map of layerId -> complete callback
      
      // Default fade curve parameters
      this.defaultFadeDuration = 4000; // 4 seconds
      this.useEqualPowerCurve = true; // Whether to use equal power curve instead of linear
    }
    
    /**
     * Set the audio context (used when context is created later)
     * @param {AudioContext} audioContext - Web Audio API context
     */
    setAudioContext(audioContext) {
      this.audioContext = audioContext;
    }
    
    /**
     * Start a crossfade between two audio elements
     * @param {string} layerId - ID of the audio layer being crossfaded
     * @param {Object} sourceTrack - The source track {element, source, gain}
     * @param {Object} targetTrack - The target track {element, source, gain}
     * @param {number} duration - Duration of crossfade in milliseconds
     * @param {number} initialVolume - The initial volume level (0-1)
     * @param {Function} onProgress - Callback for progress updates
     * @param {Function} onComplete - Callback when crossfade completes
     * @returns {Promise<boolean>} Success status
     */
    async startCrossfade(layerId, sourceTrack, targetTrack, duration = null, initialVolume = 1, onProgress = null, onComplete = null) {
      if (!this.audioContext) {
        console.error('Audio context not initialized');
        return false;
      }
      
      // Cancel any active crossfade for this layer
      this.cancelCrossfade(layerId);
      
      // Use default duration if not specified
      const fadeDuration = duration || this.defaultFadeDuration;
      
      try {
        // Create gain nodes for crossfade
        const fadeOutGain = this.audioContext.createGain();
        const fadeInGain = this.audioContext.createGain();
        
        // Initialize gain values
        fadeOutGain.gain.value = initialVolume;
        fadeInGain.gain.value = 0.001; // Start almost silent
        
        // Connect gain nodes to destination
        fadeOutGain.connect(this.audioContext.destination);
        fadeInGain.connect(this.audioContext.destination);
        
        // Disconnect and reconnect audio graphs
        sourceTrack.source.disconnect();
        sourceTrack.source.connect(fadeOutGain);
        
        targetTrack.source.disconnect();
        targetTrack.source.connect(fadeInGain);
        
        // Get current position of source track
        const currentPosition = sourceTrack.element.currentTime || 0;
        const sourceDuration = sourceTrack.element.duration || 300;
        const targetDuration = targetTrack.element.duration || 300;
        
        // Calculate relative position
        const relativePosition = currentPosition / sourceDuration;
        
        // Position the target track at the same relative position
        targetTrack.element.currentTime = relativePosition * targetDuration;
        
        // Start playing the target track
        try {
          await targetTrack.element.play();
        } catch (error) {
          console.error('Error starting target track playback:', error);
          
          // Attempt recovery
          this.recoverFromFailedCrossfade(layerId, sourceTrack, targetTrack);
          return false;
        }
        
        // Now schedule the gain curves
        const now = this.audioContext.currentTime;
        const endTime = now + (fadeDuration / 1000);
        
        // Schedule the gain ramps
        if (this.useEqualPowerCurve) {
          // Equal-power crossfade curve (better for most audio material)
          this.scheduleEqualPowerFade(fadeOutGain.gain, fadeInGain.gain, now, endTime, initialVolume);
        } else {
          // Linear crossfade
          this.scheduleLinearFade(fadeOutGain.gain, fadeInGain.gain, now, endTime, initialVolume);
        }
        
        // Store callbacks
        if (onProgress) {
          this.progressCallbacks.set(layerId, onProgress);
        }
        
        if (onComplete) {
          this.crossfadeCompleteCallbacks.set(layerId, onComplete);
        }
        
        // Store crossfade information
        this.activeCrossfades.set(layerId, {
          sourceTrack,
          targetTrack,
          fadeOutGain,
          fadeInGain,
          startTime: now,
          endTime,
          duration: fadeDuration,
          initialVolume,
          interval: this.startProgressTracking(layerId, now, endTime)
        });
        
        return true;
      } catch (error) {
        console.error('Error starting crossfade:', error);
        this.recoverFromFailedCrossfade(layerId, sourceTrack, targetTrack);
        return false;
      }
    }
    
    /**
     * Schedule an equal-power crossfade (smoother for most audio content)
     * @param {AudioParam} fadeOutParam - The parameter to fade out
     * @param {AudioParam} fadeInParam - The parameter to fade in
     * @param {number} startTime - Start time in seconds
     * @param {number} endTime - End time in seconds
     * @param {number} initialVolume - The initial volume level
     * @private
     */
    scheduleEqualPowerFade(fadeOutParam, fadeInParam, startTime, endTime, initialVolume) {
      // For equal-power crossfade, we use more curve points for smoother transition
      const duration = endTime - startTime;
      const steps = 12; // More steps for smoother curve
      
      // Set initial values
      fadeOutParam.setValueAtTime(initialVolume, startTime);
      fadeInParam.setValueAtTime(0.001, startTime);
      
      // Schedule curve points
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const time = startTime + (t * duration);
        
        // Equal-power curve based on trigonometric functions
        // These curves maintain constant power throughout the transition
        const fadeOutValue = initialVolume * Math.cos(t * Math.PI / 2);
        const fadeInValue = initialVolume * Math.sin(t * Math.PI / 2);
        
        // Add curve points
        fadeOutParam.linearRampToValueAtTime(Math.max(0.001, fadeOutValue), time);
        fadeInParam.linearRampToValueAtTime(Math.max(0.001, fadeInValue), time);
      }
    }
    
    /**
     * Schedule a linear crossfade (simpler but can cause dips in perceived volume)
     * @param {AudioParam} fadeOutParam - The parameter to fade out
     * @param {AudioParam} fadeInParam - The parameter to fade in
     * @param {number} startTime - Start time in seconds
     * @param {number} endTime - End time in seconds
     * @param {number} initialVolume - The initial volume level
     * @private
     */
    scheduleLinearFade(fadeOutParam, fadeInParam, startTime, endTime, initialVolume) {
      // Simple linear ramps
      fadeOutParam.setValueAtTime(initialVolume, startTime);
      fadeOutParam.linearRampToValueAtTime(0.001, endTime);
      
      fadeInParam.setValueAtTime(0.001, startTime);
      fadeInParam.linearRampToValueAtTime(initialVolume, endTime);
    }
    
    /**
     * Start progress tracking for a crossfade
     * @param {string} layerId - ID of the layer being crossfaded
     * @param {number} startTime - Start time in seconds
     * @param {number} endTime - End time in seconds
     * @returns {number} Interval ID for the progress tracking
     * @private
     */
    startProgressTracking(layerId, startTime, endTime) {
      const duration = endTime - startTime;
      const updateInterval = Math.min(100, duration * 100); // Update at most every 100ms
      
      return setInterval(() => {
        const currentTime = this.audioContext.currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(1, elapsed / duration);
        
        // Call progress callback if available
        if (this.progressCallbacks.has(layerId)) {
          this.progressCallbacks.get(layerId)(progress);
        }
        
        // Check if complete
        if (progress >= 1) {
          this.completeCrossfade(layerId);
        }
      }, updateInterval);
    }
    
    /**
     * Complete a crossfade
     * @param {string} layerId - ID of the layer being crossfaded
     * @private
     */
    completeCrossfade(layerId) {
      if (!this.activeCrossfades.has(layerId)) {
        return;
      }
      
      const crossfade = this.activeCrossfades.get(layerId);
      
      // Clear interval
      clearInterval(crossfade.interval);
      
      // Call complete callback if available
      if (this.crossfadeCompleteCallbacks.has(layerId)) {
        this.crossfadeCompleteCallbacks.get(layerId)({
          sourceTrack: crossfade.sourceTrack,
          targetTrack: crossfade.targetTrack
        });
        this.crossfadeCompleteCallbacks.delete(layerId);
      }
      
      try {
        // Pause the source track if not needed
        crossfade.sourceTrack.element.pause();
        
        // Reconnect target track to original destination
        crossfade.targetTrack.source.disconnect();
        if (crossfade.targetTrack.originalDestination) {
          crossfade.targetTrack.source.connect(crossfade.targetTrack.originalDestination);
        } else {
          // Connect to context destination as fallback
          crossfade.targetTrack.source.connect(this.audioContext.destination);
        }
        
        // Disconnect gain nodes
        crossfade.fadeOutGain.disconnect();
        crossfade.fadeInGain.disconnect();
      } catch (error) {
        console.error('Error completing crossfade:', error);
      }
      
      // Remove from active crossfades
      this.activeCrossfades.delete(layerId);
      
      // Remove progress callback
      this.progressCallbacks.delete(layerId);
    }
    
    /**
     * Cancel an active crossfade
     * @param {string} layerId - ID of the layer being crossfaded
     * @returns {boolean} Whether a crossfade was cancelled
     */
    cancelCrossfade(layerId) {
      if (!this.activeCrossfades.has(layerId)) {
        return false;
      }
      
      const crossfade = this.activeCrossfades.get(layerId);
      
      // Clear interval
      clearInterval(crossfade.interval);
      
      try {
        // Quickly fade out the source track
        const now = this.audioContext.currentTime;
        crossfade.fadeOutGain.gain.cancelScheduledValues(now);
        crossfade.fadeOutGain.gain.setValueAtTime(crossfade.fadeOutGain.gain.value, now);
        crossfade.fadeOutGain.gain.linearRampToValueAtTime(0, now + 0.1);
        
        // Quickly fade in the target track
        crossfade.fadeInGain.gain.cancelScheduledValues(now);
        crossfade.fadeInGain.gain.setValueAtTime(crossfade.fadeInGain.gain.value, now);
        crossfade.fadeInGain.gain.linearRampToValueAtTime(crossfade.initialVolume, now + 0.1);
        
        // Reconnect tracks after a short delay
        setTimeout(() => {
          // Pause the source track
          crossfade.sourceTrack.element.pause();
          
          // Reconnect target track to original destination
          crossfade.targetTrack.source.disconnect();
          if (crossfade.targetTrack.originalDestination) {
            crossfade.targetTrack.source.connect(crossfade.targetTrack.originalDestination);
          } else {
            // Connect to context destination as fallback
            crossfade.targetTrack.source.connect(this.audioContext.destination);
          }
          
          // Disconnect gain nodes
          crossfade.fadeOutGain.disconnect();
          crossfade.fadeInGain.disconnect();
        }, 200);
      } catch (error) {
        console.error('Error cancelling crossfade:', error);
      }
      
      // Remove from active crossfades
      this.activeCrossfades.delete(layerId);
      
      // Remove callbacks
      this.progressCallbacks.delete(layerId);
      this.crossfadeCompleteCallbacks.delete(layerId);
      
      return true;
    }
    
    /**
     * Recover from a failed crossfade by reconnecting the source track
     * @param {string} layerId - ID of the layer being crossfaded
     * @param {Object} sourceTrack - The source track
     * @param {Object} targetTrack - The target track
     * @private
     */
    recoverFromFailedCrossfade(layerId, sourceTrack, targetTrack) {
      try {
        // Reconnect source track to original destination
        sourceTrack.source.disconnect();
        if (sourceTrack.originalDestination) {
          sourceTrack.source.connect(sourceTrack.originalDestination);
        } else {
          // Connect to context destination as fallback
          sourceTrack.source.connect(this.audioContext.destination);
        }
      } catch (error) {
        console.error('Error recovering from failed crossfade:', error);
      }
      
      // Remove from active crossfades if present
      if (this.activeCrossfades.has(layerId)) {
        const crossfade = this.activeCrossfades.get(layerId);
        clearInterval(crossfade.interval);
        this.activeCrossfades.delete(layerId);
      }
      
      // Remove callbacks
      this.progressCallbacks.delete(layerId);
      this.crossfadeCompleteCallbacks.delete(layerId);
    }
    
    /**
     * Update a crossfade's volume during the transition
     * @param {string} layerId - ID of the layer being crossfaded
     * @param {number} newVolume - New volume level (0-1)
     * @returns {boolean} Success status
     */
    updateCrossfadeVolume(layerId, newVolume) {
      if (!this.activeCrossfades.has(layerId)) {
        return false;
      }
      
      const crossfade = this.activeCrossfades.get(layerId);
      const now = this.audioContext.currentTime;
      
      // Calculate current progress
      const elapsed = now - crossfade.startTime;
      const duration = crossfade.endTime - crossfade.startTime;
      const progress = Math.min(1, elapsed / duration);
      
      try {
        // Update gain values based on current progress
        // For fade-out track, apply (1-progress) * newVolume
        // For fade-in track, apply progress * newVolume
        if (progress < 1) {
          const fadeOutValue = (1 - progress) * newVolume;
          const fadeInValue = progress * newVolume;
          
          // Cancel scheduled values and set new values
          crossfade.fadeOutGain.gain.cancelScheduledValues(now);
          crossfade.fadeInGain.gain.cancelScheduledValues(now);
          
          crossfade.fadeOutGain.gain.setValueAtTime(fadeOutValue, now);
          crossfade.fadeInGain.gain.setValueAtTime(fadeInValue, now);
          
          // Re-schedule remaining fade
          const remainingTime = crossfade.endTime - now;
          if (remainingTime > 0.1) {
            crossfade.fadeOutGain.gain.linearRampToValueAtTime(0.001, crossfade.endTime);
            crossfade.fadeInGain.gain.linearRampToValueAtTime(newVolume, crossfade.endTime);
            
            // Update initialVolume for when crossfade completes
            crossfade.initialVolume = newVolume;
          }
        } else {
          // Crossfade is already complete, just set target track volume
          crossfade.fadeInGain.gain.setValueAtTime(newVolume, now);
        }
        
        return true;
      } catch (error) {
        console.error('Error updating crossfade volume:', error);
        return false;
      }
    }
    
    /**
     * Get the active crossfades
     * @returns {Map} Map of active crossfades
     */
    getActiveCrossfades() {
      // Return a simplified version for public consumption
      const simplified = {};
      
      for (const [layerId, crossfade] of this.activeCrossfades.entries()) {
        const elapsed = this.audioContext.currentTime - crossfade.startTime;
        const duration = crossfade.endTime - crossfade.startTime;
        const progress = Math.min(1, elapsed / duration);
        
        simplified[layerId] = {
          from: crossfade.sourceTrack.track.id,
          to: crossfade.targetTrack.track.id,
          progress,
          startTime: crossfade.startTime,
          endTime: crossfade.endTime,
          initialVolume: crossfade.initialVolume
        };
      }
      
      return simplified;
    }
    
    /**
     * Check if a layer has an active crossfade
     * @param {string} layerId - ID of the layer to check
     * @returns {boolean} Whether the layer has an active crossfade
     */
    hasActiveCrossfade(layerId) {
      return this.activeCrossfades.has(layerId);
    }
    
    /**
     * Get progress information for a specific crossfade
     * @param {string} layerId - ID of the layer to check
     * @returns {Object|null} Progress information or null if not found
     */
    getCrossfadeProgress(layerId) {
      if (!this.activeCrossfades.has(layerId)) {
        return null;
      }
      
      const crossfade = this.activeCrossfades.get(layerId);
      const elapsed = this.audioContext.currentTime - crossfade.startTime;
      const duration = crossfade.endTime - crossfade.startTime;
      const progress = Math.min(1, elapsed / duration);
      
      return {
        progress,
        elapsed,
        duration,
        from: crossfade.sourceTrack.track.id,
        to: crossfade.targetTrack.track.id
      };
    }
    
    /**
     * Set default fade duration
     * @param {number} duration - Duration in milliseconds
     */
    setDefaultFadeDuration(duration) {
      this.defaultFadeDuration = duration;
    }
    
    /**
     * Set fade curve type
     * @param {boolean} useEqualPower - Whether to use equal power curve
     */
    setFadeCurveType(useEqualPower) {
      this.useEqualPowerCurve = useEqualPower;
    }
    
    /**
     * Get all crossfade progress
     * @returns {Object} Map of layerId to progress (0-1)
     */
    getAllCrossfadeProgress() {
      const progress = {};
      
      for (const [layerId, crossfade] of this.activeCrossfades.entries()) {
        const elapsed = this.audioContext.currentTime - crossfade.startTime;
        const duration = crossfade.endTime - crossfade.startTime;
        progress[layerId] = Math.min(1, elapsed / duration);
      }
      
      return progress;
    }
    
    /**
     * Clean up all crossfades
     */
    cleanup() {
      // Cancel all active crossfades
      for (const layerId of this.activeCrossfades.keys()) {
        this.cancelCrossfade(layerId);
      }
      
      // Clear all maps
      this.activeCrossfades.clear();
      this.progressCallbacks.clear();
      this.crossfadeCompleteCallbacks.clear();
    }
  }
  
  export default CrossfadeEngine;