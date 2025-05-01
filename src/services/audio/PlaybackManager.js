/**
 * PlaybackManager.js
 * 
 * Manages audio playback operations including start, pause, and timing
 * Extracted from StreamingAudioContext to improve modularity
 */

/**
 * Creates a playback manager with the provided dependencies
 * 
 * @param {Object} deps - Dependencies needed by the playback manager
 * @returns {Object} Playback operations
 */
const createplaybackManager = ({
    // Refs
    serviceRef,
    isPlayingRef,
    
    // State setters
    setIsPlaying,
    setPreloadProgress,
    
    // State values
    activeAudio,
    volumes,
    audioLibrary
}) => {
  /**
   * Safely updates the playing state
   * @param {boolean} newState - New playing state
   */
  const updatePlayingState = (newState) => {
    // Debug log before updating
    console.log(`Updating playing state from ${isPlayingRef.current} to ${newState}`);

    // Update the ref immediately (sync)
    isPlayingRef.current = newState;

    // Update the React state (async)
    setIsPlaying(newState);

    // Debug log after updating
    console.log(`Updated playing state, ref is now: ${isPlayingRef.current}`);
  };

  /**
   * Starts audio playback session
   */
  const handleStartSession = () => {
    // Use ref for current state check to avoid race conditions
    if (!serviceRef.current.audioCore || isPlayingRef.current) {
      console.log("Can't start: AudioCore missing or already playing");
      return;
    }

    try {
      console.log("[PlaybackManager: handleStartSession] Starting session...");

      // Resume AudioCore
      serviceRef.current.audioCore.resume().catch(err => {
        console.error('[PlaybackManager: handleStartSession] Error resuming audio context:', err);
      });

      // Get currently active audio elements
      const audioElements = serviceRef.current.audioCore.getElements?.() || {};

      // Force update all layer volumes from current UI state
      Object.entries(volumes).forEach(([layer, volume]) => {
        if (serviceRef.current.volumeController) {
          // Set volumes with immediate=true to ensure they're set before playback
          serviceRef.current.volumeController.setVolume(layer, volume, {
            immediate: false,
            transitionTime: 0.05
          });
          console.log(`[PlaybackManager: handleStartSession] Layer ${layer} - Set initial volume: ${volume}`);
        }
      });

      console.log("[PlaybackManager: handleStartSession] Audio Elements:",
        Object.keys(audioElements).map(layer =>
          `${layer}: ${Object.keys(audioElements[layer] || {}).join(', ')}`
        )
      );

      // Log active layer info
      Object.entries(activeAudio).forEach(([layer, trackId]) => {
        console.log(`[PlaybackManager: handleStartSession] Layer ${layer} - Active track: ${trackId}, Volume: ${volumes[layer]}`);
      });

      // Make sure all audio elements are reset to beginning
      Object.entries(activeAudio).forEach(([layer, trackId]) => {
        const track = audioElements[layer]?.[trackId];
        console.log(`[PlaybackManager: handleStartSession] Layer ${layer} - Attempting to play track ${trackId}:`, track ? 'Found' : 'Not found');

        if (track?.element) {
          // Log volume level
          console.log(`[PlaybackManager: handleStartSession] Layer ${layer} - Volume level:`, volumes[layer]);
          console.log(`[PlaybackManager: handleStartSession] Layer ${layer} - Audio element readyState:`, track.element.readyState);

          // Reset to beginning of track
          track.element.currentTime = 0;

          // Set volume to 0 for fade-in
          if (track.source && track.source.gain) {
            track.source.gain.value = 0;
          }
        }
      });

      // Play all active audio elements
      let allPlayPromises = [];

      Object.entries(activeAudio).forEach(([layer, trackId]) => {
        const track = audioElements[layer]?.[trackId];
        if (track?.element) {
          // Play and collect the promise
          try {
            console.log(`[PlaybackManager: handleStartSession] Layer ${layer} - Initiating play() for track ${trackId}`);
            const playPromise = track.element.play();
            if (playPromise !== undefined) {
              allPlayPromises.push(
                playPromise.catch(err => {
                  console.error(`[PlaybackManager: handleStartSession] Error playing ${layer}:`, err);
                  return null;
                })
              );
            }
          } catch (err) {
            console.error(`[PlaybackManager: handleStartSession] Error starting ${layer}:`, err);
          }
        } else {
          console.error(`[PlaybackManager: handleStartSession] No track found for ${layer}/${trackId}`);
        }
      });

      // Wait for all play operations to complete, then fade in
      Promise.all(allPlayPromises)
        .then(() => {
          // Fade in all layers
          Object.entries(activeAudio).forEach(([layer, trackId]) => {
            const layerKey = layer.toLowerCase();
            if (serviceRef.current.volumeController) {
              // Fade in using the volume controller with 50ms duration
              const targetVolume = volumes[layer] || 0;
              console.log(`[PlaybackManager: handleStartSession] Fading in ${layer} to ${targetVolume}`);
              serviceRef.current.volumeController.setVolume(layerKey, targetVolume, {
                immediate: false,
                transitionTime: 0.05 // 50ms
              });
            }
          });

          if (!isPlayingRef.current) {
            updatePlayingState(true);
          }
        })
        .catch(error => {
          console.error('[PlaybackManager: handleStartSession] Error in play promises:', error);
          // Try to update state anyway
          updatePlayingState(true);
        });

      // Set state immediately as a fallback
      if (!isPlayingRef.current) {
        updatePlayingState(true);
      }

    } catch (error) {
      console.error('[PlaybackManager: handleStartSession] Error starting session:', error);
      updatePlayingState(false);
    }
  };

  /**
   * Pauses audio playback session with fade out
   */
  const handlePauseSession = () => {
    if (!isPlayingRef.current) {
      console.log("[PlaybackManager: handlePauseSession] Not playing, nothing to pause");
      return;
    }

    try {
      console.log("[PlaybackManager: handlePauseSession] Fading out and pausing session...");

      // First, cancel any active crossfades
      if (serviceRef.current.crossfadeEngine) {
        serviceRef.current.crossfadeEngine.cancelAllCrossfades({
          reconnectSource: true,
          reconnectTarget: true
        });
      }

      // Get audio elements from AudioCore
      const audioElements = serviceRef.current.audioCore.getElements?.() || {};

      // Fade out all active layers first
      const fadeDuration = 50; // 50ms fade duration
      const layerFadePromises = [];

      Object.entries(activeAudio).forEach(([layer, trackId]) => {
        const track = audioElements[layer]?.[trackId];
        if (track?.element && serviceRef.current.volumeController) {
          try {
            // Use VolumeController to fade out
            const fadePromise = serviceRef.current.volumeController.setVolume(layer, 0, {
              immediate: false,
              transitionTime: fadeDuration / 1000 // Convert ms to seconds
            });

            layerFadePromises.push(fadePromise);
            console.log(`[PlaybackManager: handlePauseSession] Fading out ${layer}`);
          } catch (err) {
            console.error(`[PlaybackManager: handlePauseSession] Error fading out ${layer}:`, err);
          }
        }
      });

      // After a short delay to allow fade out, pause all audio elements
      setTimeout(() => {
        Object.entries(activeAudio).forEach(([layer, trackId]) => {
          const track = audioElements[layer]?.[trackId];
          if (track?.element) {
            try {
              track.element.pause();
              console.log(`[PlaybackManager: handlePauseSession] Paused ${layer}`);
            } catch (err) {
              console.error(`[PlaybackManager: handlePauseSession] Error pausing ${layer}:`, err);
            }
          }
        });

        // Stop the TimelineEngine
        if (serviceRef.current.timelineEngine) {
          serviceRef.current.timelineEngine.stop();
        }

        // Suspend the AudioCore context
        if (serviceRef.current.audioCore) {
          serviceRef.current.audioCore.suspend().catch(err => {
            console.warn('[PlaybackManager: handlePauseSession] Error suspending audio context:', err);
          });
        }

        // Check for proper state update
        console.log("[PlaybackManager: handlePauseSession] Before updatePlayingState, current state:", isPlayingRef.current);
        updatePlayingState(false);
        console.log("[PlaybackManager: handlePauseSession] After updatePlayingState, new state:", isPlayingRef.current);
      }, fadeDuration + 10); // Add a small buffer to ensure fade completes

    } catch (error) {
      console.error('[PlaybackManager: handlePauseSession] Error pausing session:', error);
      // Still try to update state even if an error occurs
      updatePlayingState(false);
    }
  };

  /**
   * Preload audio using BufferManager
   * @param {string} layer - Layer name
   * @param {string} trackId - Track ID to preload
   * @returns {Promise<boolean>} Success status
   */
  const handlePreloadAudio = async (layer, trackId) => {
    if (!serviceRef.current.bufferManager) {
      console.error("Cannot preload: missing BufferManager");
      return false;
    }

    try {
      // Find the track in library
      const track = audioLibrary[layer].find(t => t.id === trackId);
      console.log(`Preloading audio for ${layer}/${trackId}:`, track ? 'Found' : 'Not found', track);
      if (!track) {
        console.error(`Track ${trackId} not found in library`);
        return false;
      }

      // Update UI to show loading progress
      setPreloadProgress(prev => ({
        ...prev,
        [trackId]: 0
      }));

      // Use BufferManager to preload the audio file
      await serviceRef.current.bufferManager.loadAudioBuffer(track.path, {
        onProgress: (progress) => {
          setPreloadProgress(prev => ({
            ...prev,
            [trackId]: progress
          }));
        }
      });

      // Success - clear progress display
      setPreloadProgress(prev => {
        const newState = { ...prev };
        delete newState[trackId];
        return newState;
      });

      return true;
    } catch (error) {
      console.error(`Error preloading audio: ${error.message}`);

      // Reset progress on error
      setPreloadProgress(prev => {
        const newState = { ...prev };
        delete newState[trackId];
        return newState;
      });

      return false;
    }
  };

  /**
   * Gets the current session playback time in milliseconds
   * @returns {number} Current session time in milliseconds
   */
  const getSessionTime = () => {
    if (serviceRef.current.timelineEngine) {
      return serviceRef.current.timelineEngine.getElapsedTime();
    }
    return 0;
  };

  /**
   * Toggles playback between playing and paused states
   * @returns {boolean} New playing state
   */
  const togglePlayback = () => {
    if (isPlayingRef.current) {
      handlePauseSession();
      return false;
    } else {
      handleStartSession();
      return true;
    }
  };

  // Return the public API
  return {
    handleStartSession,
    handlePauseSession,
    handlePreloadAudio,
    getSessionTime,
    togglePlayback,
    updatePlayingState
  };
};

export default createplaybackManager;
