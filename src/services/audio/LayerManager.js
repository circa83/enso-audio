/**
 * LayerManager.js
 * 
 * Manages audio layers, crossfading, volume control, and track switching
 * Factory function returns methods to control layer operations
 */

const createLayerManager = ({
    // Refs
    serviceRef,
    audioLibraryRef,
    activeAudioRef,
    isPlayingRef,

    // State
    audioLibrary,
    activeAudio,
    volumes,
    transitionDuration,

    // State setters
    setAudioLibrary,
    setActiveAudio,
    setVolumes,
    setHasSwitchableAudio,
    setActiveCrossfades,
    setCrossfadeProgress,
    setMasterVolume,

    // Constants
    LAYERS,
    DEFAULT_AUDIO
}) => {
    /**
     * Try to load variation audio files in the background
     * Checks for existence of variation files and adds them to the library if found
     */
    const tryLoadVariationFiles = () => {
        setTimeout(async () => {
            try {
                // Check if variation files exist
                const response = await fetch('/samples/drone/drone_01.mp3', { method: 'HEAD' });

                if (response.ok) {
                    // If we have variations, we can set up the extended library
                    setHasSwitchableAudio(true);

                    // Add variation files to the library
                    setAudioLibrary(prev => {
                        const extendedLibrary = { ...prev };

                        // Add variations for all layers
                        Object.values(LAYERS).forEach(layer => {
                            extendedLibrary[layer] = [
                                ...(Array.isArray(extendedLibrary[layer]) ? extendedLibrary[layer] : []),
                                ...[1, 2, 3].map(i => ({
                                    id: `${layer}_variation_${i}`,
                                    name: `${layer.charAt(0).toUpperCase() + layer.slice(1)} Variation ${i}`,
                                    path: `/samples/${layer}/${layer}_0${i}.mp3`
                                }))
                            ];
                        });
                        console.log("Extended audio library Variations:", extendedLibrary);
                        return extendedLibrary;
                    });
                }
            } catch (error) {
                console.log('Variation audio files not detected, using defaults only');
            }
        }, 1000);
    };

    /**
     * Crossfade between audio tracks on the specified layer
     * 
     * @param {string} layer - Layer name
     * @param {string} newTrackId - ID of the track to fade to
     * @param {number} [fadeDuration=null] - Duration of crossfade in ms
     * @returns {Promise<boolean>} Success status
     */
    const handleCrossfadeTo = async (layer, newTrackId, fadeDuration = null) => {
        console.log(`Starting crossfade process for ${layer}: ${newTrackId}`);
        const actualDuration = fadeDuration !== null ? fadeDuration : transitionDuration;

        // Verify we have what we need
        if (!serviceRef.current.audioCore ||
            !serviceRef.current.volumeController ||
            !serviceRef.current.crossfadeEngine) {
            console.error("Cannot crossfade: missing required services");
            return false;
        }

        const audioCtx = serviceRef.current.audioCore.getContext();
        const masterGain = serviceRef.current.audioCore.getMasterGain();

        // Get the audio elements
        const audioElements = serviceRef.current.audioCore.getElements?.() || {};
        console.log("Audio elements retrieved:", audioElements);

        // Get the current active track ID with improved reliability
        const currentTrackId = (() => {
            // First try from activeAudio state
            const stateTrackId = activeAudio[layer];

            // Second try from activeAudioRef (more up-to-date than state during transitions)
            const refTrackId = activeAudioRef.current[layer];

            // If either is valid, use it
            if (stateTrackId) {
                console.log(`Using current track for ${layer} from state: ${stateTrackId}`);
                return stateTrackId;
            }

            if (refTrackId) {
                console.log(`Using current track for ${layer} from ref: ${refTrackId}`);
                return refTrackId;
            }

            // If neither is valid, try to recover from audio elements
            const layerElements = audioElements[layer] || {};
            const activeTrackEntry = Object.entries(layerElements).find(([id, data]) => data?.isActive);

            if (activeTrackEntry) {
                console.log(`Recovered current track for ${layer} from audio elements: ${activeTrackEntry[0]}`);
                return activeTrackEntry[0];
            }

            // Last resort - use the first track from the library or default pattern
            if (audioLibrary[layer]?.length > 0) {
                const defaultTrackId = audioLibrary[layer][0].id;
                console.log(`No active track found for ${layer}, using first from library: ${defaultTrackId}`);
                return defaultTrackId;
            }

            // Absolute fallback
            const fallbackId = `${layer}1`;
            console.log(`No tracks found in library for ${layer}, using fallback ID: ${fallbackId}`);
            return fallbackId;
        })();

        console.log(`Current track for ${layer}: ${currentTrackId}`);

        // CRITICAL: Ensure the audio library is populated - sync from ref if needed
        if (!audioLibrary[layer] || audioLibrary[layer].length === 0) {
            console.log(`Proactively syncing audio library for ${layer} from reference`);
            if (audioLibraryRef.current[layer] && audioLibraryRef.current[layer].length > 0) {
                // Update the audio library state
                setAudioLibrary(prevLibrary => {
                    const updated = { ...prevLibrary };
                    updated[layer] = [...audioLibraryRef.current[layer]];
                    console.log(`Synchronized audio library for ${layer}:`, updated[layer]);
                    return updated;
                });
            }
        }

        // Skip if already playing requested track
        if (currentTrackId === newTrackId) {
            console.log(`Already playing ${newTrackId} on ${layer}`);
            return true;
        }

        // Find the target track in library
        let libraryTrack = null;

        // Try to find in current library state
        if (audioLibrary[layer]) {
            libraryTrack = audioLibrary[layer].find(t => t.id === newTrackId);
        }

        // If not found, try ref backup
        if (!libraryTrack && audioLibraryRef.current[layer]) {
            libraryTrack = audioLibraryRef.current[layer].find(t => t.id === newTrackId);

            // If found in ref but not in state, update state
            if (libraryTrack) {
                console.log(`Found track ${newTrackId} in backup library reference but not in state, updating state`);
                setAudioLibrary(prevLibrary => {
                    const updated = { ...prevLibrary };
                    if (!updated[layer]) updated[layer] = [];
                    if (!updated[layer].some(t => t.id === newTrackId)) {
                        updated[layer] = [...updated[layer], libraryTrack];
                    }
                    return updated;
                });
            }
        }

        // If still not found, create a fallback
        if (!libraryTrack) {
            console.log(`Track ${newTrackId} not found in any library source for layer ${layer}, creating fallback`);

            // Create a fallback track
            libraryTrack = {
                id: newTrackId,
                name: newTrackId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                path: DEFAULT_AUDIO[layer] // Use the default audio path
            };

            // Add to audio library
            setAudioLibrary(prev => {
                const updated = { ...prev };
                if (!updated[layer]) updated[layer] = [];

                // Add track if it doesn't exist
                if (!updated[layer].some(t => t.id === newTrackId)) {
                    updated[layer] = [...updated[layer], libraryTrack];
                }

                return updated;
            });
        }

        console.log(`[LayerManager: handleCrossfadeTo] Starting crossfade for ${layer} to track ${newTrackId}`);
        console.log(`[LayerManager: handleCrossfadeTo] Available tracks in audioLibrary for ${layer}:`,
            audioLibrary[layer] ? audioLibrary[layer].map(t => `${t.id} (${t.name})`).join(', ') : 'None'
        );

        // Get or create the target track's audio elements
        let newTrackElements = audioElements[layer]?.[newTrackId];

        // Create the new track if it doesn't exist yet
        if (!newTrackElements) {
            console.log(`[LayerManager: handleCrossfadeTo] Creating new audio element for ${layer}/${newTrackId} with path ${libraryTrack.path}`);
            const audioElement = new Audio();
            audioElement.preload = "auto";
            audioElement.loop = true;
            audioElement.src = libraryTrack.path;
            audioElement.crossOrigin = "anonymous"; // Ensure CORS is set for remote files

            // Create source node
            const source = audioCtx.createMediaElementSource(audioElement);

            // Connect to VolumeController
            serviceRef.current.volumeController.connectToLayer(layer, source, masterGain);

            // Store the new track
            newTrackElements = {
                element: audioElement,
                source: source,
                track: libraryTrack,
                isActive: false
            };

            // Update audio elements in AudioCore if it supports it
            if (serviceRef.current.audioCore.updateElement) {
                console.log(`[LayerManager: handleCrossfadeTo] Registering new element with AudioCore: ${layer}/${newTrackId}`);
                serviceRef.current.audioCore.updateElement(layer, newTrackId, newTrackElements);
            }
        }

        // If we're not playing or have no current track, do an immediate switch
        if (!isPlayingRef.current || !currentTrackId) {
            console.log(`Not currently playing or no current track, using immediate switch instead of crossfade`);

            // Update active audio state immediately
            setActiveAudio(prev => {
                const updated = {
                    ...prev,
                    [layer]: newTrackId
                };
                // Also update the ref for immediate access
                activeAudioRef.current = {
                    ...activeAudioRef.current,
                    [layer]: newTrackId
                };
                return updated;
            });

            console.log(`Immediate switch to ${newTrackId} successful for ${layer}`);
            return true;
        }

        // Get the current track elements with improved error handling
        let currentTrack = audioElements[layer]?.[currentTrackId];

        // Handle case where current track elements are missing but should exist
        if (!currentTrack) {
            console.log(`Current track ${currentTrackId} not found in audio elements, attempting recovery`);

            // Try to find any active element for this layer as a fallback
            const activeElement = Object.values(audioElements[layer] || {}).find(elem => elem.isActive);

            if (activeElement) {
                console.log(`Found active element for ${layer}, using as current track`);
                currentTrack = activeElement;
            } else {
                // If no active element found, create one for immediate switch
                console.log(`No active elements found for ${layer}, switching immediately to new track`);

                // Update active audio state
                setActiveAudio(prev => {
                    const updated = {
                        ...prev,
                        [layer]: newTrackId
                    };
                    // Also update the ref for immediate access
                    activeAudioRef.current = {
                        ...activeAudioRef.current,
                        [layer]: newTrackId
                    };
                    return updated;
                });

                // Play the new track directly if we're playing
                if (isPlayingRef.current && newTrackElements?.element) {
                    newTrackElements.element.currentTime = 0;
                    try {
                        await newTrackElements.element.play();
                    } catch (e) {
                        console.error(`Error playing new track: ${e.message}`);
                    }
                }

                return true;
            }
        }

        // Start a crossfade using the CrossfadeEngine

        // First, update UI to show we're preparing for crossfade
        setActiveCrossfades(prev => ({
            ...prev,
            [layer]: {
                from: currentTrackId,
                to: newTrackId,
                progress: 0,
                isLoading: true
            }
        }));

        // Update active track state - do this before the crossfade
        setActiveAudio(prev => {
            const updated = {
                ...prev,
                [layer]: newTrackId
            };
            // Also update the ref for immediate access
            activeAudioRef.current = {
                ...activeAudioRef.current,
                [layer]: newTrackId
            };
            return updated;
        });

        // Update UI - now loading is complete
        setActiveCrossfades(prev => ({
            ...prev,
            [layer]: {
                ...prev[layer],
                isLoading: false
            }
        }));

        // Get the current volume for the layer
        const currentVolume = serviceRef.current.volumeController.getVolume(layer);

        // Prepare crossfade options
        const crossfadeOptions = {
            layer,
            sourceNode: currentTrack.source,
            sourceElement: currentTrack.element,
            targetNode: newTrackElements.source,
            targetElement: newTrackElements.element,
            currentVolume: currentVolume,
            duration: actualDuration,
            syncPosition: true,
            metadata: {
                fromTrackId: currentTrackId,
                toTrackId: newTrackId,
                volumeController: serviceRef.current.volumeController
            }
        };

        try {
            // Execute the crossfade with the CrossfadeEngine
            const success = await serviceRef.current.crossfadeEngine.crossfade(crossfadeOptions);

            // When crossfade completes, check if successful
            if (!success) {
                console.error(`Crossfade failed for ${layer}`);
                // Clear the UI state
                setActiveCrossfades(prev => {
                    const newState = { ...prev };
                    delete newState[layer];
                    return newState;
                });
                return false;
            }

            // After successful crossfade, ensure the node is properly connected
            if (serviceRef.current.volumeController && newTrackElements && newTrackElements.source) {
                serviceRef.current.volumeController.connectToLayer(
                    layer,
                    newTrackElements.source,
                    serviceRef.current.audioCore.getMasterGain()
                );
            }

            // Clear the crossfade UI state when complete
            setActiveCrossfades(prev => {
                const newState = { ...prev };
                delete newState[layer];
                return newState;
            });

            setCrossfadeProgress(prev => {
                const newState = { ...prev };
                delete newState[layer];
                return newState;
            });

            console.log(`Crossfade complete for ${layer}: ${currentTrackId} -> ${newTrackId}`);
            return true;
        } catch (error) {
            console.error(`Error during crossfade: ${error.message}`);

            // Clear UI state
            setActiveCrossfades(prev => {
                const newState = { ...prev };
                delete newState[layer];
                return newState;
            });

            setCrossfadeProgress(prev => {
                const newState = { ...prev };
                delete newState[layer];
                return newState;
            });

            return false;
        }
    };

    /**
     * Simplified interface for switching tracks
     * 
     * @param {string} layerFolder - Layer name
     * @param {string} trackId - ID of the track to switch to
     * @param {Object} options - Options object
     * @param {number} [options.transitionDuration=2000] - Transition duration in ms
     * @returns {boolean} Success status
     */
    const handleSwitchTrack = (layerFolder, trackId, options = {}) => {
        const { transitionDuration = 2000 } = options;

        if (!layerFolder || !trackId) {
            console.error('[LayerManager: handleSwitchTrack] Layer folder and track ID required');
            return false;
        }

        try {
            return handleCrossfadeTo(layerFolder, trackId, transitionDuration);
        } catch (err) {
            console.error(`[LayerManager: handleSwitchTrack] Error switching track: ${err.message}`);
            return false;
        }
    };

    /**
     * Fade volume for a specific layer
     * 
     * @param {string} layer - Layer name
     * @param {number} targetVolume - Target volume (0-1)
     * @param {number} durationMs - Duration in milliseconds
     * @returns {Promise<boolean>} Success status
     */
    const handleFadeVolume = (layer, targetVolume, durationMs) => {
        if (!serviceRef.current.volumeController) {
            console.error("[LayerManager] Cannot fade volume: VolumeController not available");
            return Promise.resolve(false);
        }

        console.log(`[LayerManager] Fading ${layer} volume to ${targetVolume} over ${durationMs}ms`);

        // Convert milliseconds to seconds for VolumeController
        const durationSec = durationMs / 1000;

        // Create a progress callback to update the volumes state
        const progressCallback = (layerId, currentValue, progress) => {
            // Update the volumes state to reflect current fade position
            setVolumes(prev => ({
                ...prev,
                [layerId]: currentValue
            }));
            // Log progress for debugging
            // console.log(`[LayerManager] Fade progress for ${layerId}: ${Math.round(progress * 100)}% - Volume: ${Math.round(currentValue * 100)}%`);
        };

        // Call the service method with progress callback
        return serviceRef.current.volumeController.fadeVolume(layer, targetVolume, durationSec, progressCallback);
    };

    /**
     * Set master volume level
     * 
     * @param {number} value - Volume level (0-1)
     */
    const handleSetMasterVolume = (value) => {
        if (!serviceRef.current.audioCore) return;
        setMasterVolume(value);
        serviceRef.current.audioCore.setMasterVolume(value);
    };

    /**
     * Set volume for a specific layer
     * 
     * @param {string} layer - Layer name
     * @param {number} value - Volume level (0-1)
     * @param {Object} options - Additional options
     * @returns {boolean} Success status
     */
    const handleSetVolume = (layer, value, options = {}) => {
        console.log(`[LayerManager: handleSetVolume] Setting volume for ${layer} to ${value}`);

        if (!serviceRef.current.volumeController) {
            console.error("Cannot set volume: VolumeController not available");
            return false;
        }

        // Update our local state for UI
        setVolumes(prev => {
            const newVolumes = {
                ...prev,
                [layer]: value
            };
            return newVolumes;
        });

        // Apply volume using the VolumeController
        const result = serviceRef.current.volumeController.setVolume(layer, value, options);
        console.log(`[LayerManager: handleSetVolume] Volume controller result: ${result}`);

        // If there's an active crossfade for this layer, update its volume too
        if (serviceRef.current.crossfadeEngine?.isActive(layer)) {
            const result = serviceRef.current.crossfadeEngine.adjustCrossfadeVolume(layer, value);
            console.log(`CrossfadeEngine.adjustCrossfadeVolume result for ${layer}: ${result}`);
        }

        return result;
    };

    // Return public methods
    return {
        // Layer initialization
        tryLoadVariationFiles,

        // Track switching
        crossfadeTo: handleCrossfadeTo,
        switchTrack: handleSwitchTrack,

        // Volume control
        fadeVolume: handleFadeVolume,
        setMasterVolume: handleSetMasterVolume,
        setVolume: handleSetVolume
    };
};

export default createLayerManager;
