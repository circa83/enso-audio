/**
 * Creates a collection loading function with the provided dependencies
 * 
 * @param {Object} deps - Dependencies needed by the function
 * @returns {Function} The handleLoadCollection function
 */
export const CollectionLoader = ({
    // State setters
    setPhasesLoaded,
    setLoadingCollection,
    setCollectionError,
    setCollectionLoadProgress,
    setCurrentCollection,
    setAudioLibrary,
    
    // Handler functions
    handleStartSession,
    handlePauseSession,
    handleSetSessionDuration,
    handleSetTransitionDuration,
    handleUpdateTimelinePhases,
    
// Managers
    layerManager,

    // Services
    collectionService,
    audioFileService,
    
    // Refs
    isPlayingRef,
    audioLibraryRef,
    serviceRef,
    
    // State
    volumes
  }) => {
    /**
     * Loads an audio collection by ID and prepares it for playback
     * 
     * @param {string} collectionId - ID of the collection to load
     * @param {Object} options - Loading options
     * @param {boolean} [options.autoPlay=false] - Whether to start playback after loading
     * @param {Object} [options.initialVolumes] - Initial volumes for layers
     * @returns {Promise<boolean>} Success status
     */
    const handleLoadCollection = async (collectionId, options = {}) => {
      // Reset state before loading
      setPhasesLoaded(false);
  
      // Validate input
      if (!validateCollectionId(collectionId)) {
        return false;
      }
  
      try {
        // Initialize loading state
        setLoadingState(true);
  
        // Pause any current playback
        await pauseCurrentPlayback();
  
        // Fetch collection data
        const collection = await fetchCollectionData(collectionId, options);
        setCollectionLoadProgress(20);
  
        // Format collection for player
        const formattedCollection = await prepareFormattedCollection(collection);
        setCollectionLoadProgress(40);
  
        // Register audio with AudioCore
        await registerCollectionAudio(formattedCollection);
        setCollectionLoadProgress(60);
  
        // Apply collection configuration (session/transition duration)
        applyConfigToAudioSystem(formattedCollection);
  
        // Process and apply phase markers
        if (formattedCollection.phaseMarkers && Array.isArray(formattedCollection.phaseMarkers)) {
          processAndApplyPhaseMarkers(formattedCollection);
        } else {
          console.log('[StreamingAudioContext: PHASES] No phase markers in collection config to apply');
        }
  
        // Load initial tracks for each layer
        const loadedLayers = await loadInitialTracks(formattedCollection, options);
        setCollectionLoadProgress(90);
  
        // Check if any layers were loaded successfully
        if (Object.keys(loadedLayers).length === 0) {
          throw new Error('Failed to load any audio tracks from this collection');
        }
  
        // Log summary information
        logLoadingSummary(loadedLayers);
  
        // Handle auto-play if requested
        handleAutoPlay(options.autoPlay);
  
        // Set current collection
        setCurrentCollection(formattedCollection);
        setCollectionLoadProgress(100);
  
        console.log(`[StreamingAudioContext: handleLoadCollection] Successfully loaded collection: ${collection.name}`);
        return true;
      } catch (err) {
        console.error(`[StreamingAudioContext: handleLoadCollection] Error: ${err.message}`);
        setCollectionError(err.message);
        return false;
      } finally {
        setLoadingCollection(false);
      }
    };
  
    /**
     * Validates that a collection ID is provided
     * @param {string} collectionId - ID to validate
     * @returns {boolean} Whether the ID is valid
     */
    const validateCollectionId = (collectionId) => {
      if (!collectionId) {
        console.error('[StreamingAudioContext: handleLoadCollection] No collection ID provided');
        return false;
      }
      return true;
    };
  
    /**
     * Sets initial loading state
     * @param {boolean} isLoading - Whether collection is loading
     */
    const setLoadingState = (isLoading) => {
      setLoadingCollection(isLoading);
      setCollectionError(null);
      setCollectionLoadProgress(0);
    };
  
    /**
     * Pauses current playback if active
     * @returns {Promise<void>}
     */
    const pauseCurrentPlayback = async () => {
      if (isPlayingRef.current) {
        await handlePauseSession();
      }
    };
  
    /**
     * Fetches collection data from service
     * @param {string} collectionId - ID of collection to fetch
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Collection data
     * @throws {Error} If collection fetch fails
     */
    const fetchCollectionData = async (collectionId, options) => {
      console.log(`[StreamingAudioContext: handleLoadCollection] Loading collection: ${collectionId}, autoPlay:`,
        options.autoPlay === true ? 'true' : 'false');
  
      const result = await collectionService.getCollection(collectionId);
      console.log('[StreamingAudioContext: handleLoadCollection] Collection result:', {
        success: result.success,
        id: result.data?.id,
        idType: typeof result.data?.id,
        name: result.data?.name
      });
  
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to load collection');
      }
  
      const collection = result.data;
  
      // Validate collection has tracks
      if (!collection.tracks || !Array.isArray(collection.tracks) || collection.tracks.length === 0) {
        console.error(`[StreamingAudioContext: handleLoadCollection] Collection "${collectionId}" has no tracks`);
        throw new Error(`Collection "${collection.name || collectionId}" has no audio tracks`);
      }
  
      console.log(`[StreamingAudioContext: handleLoadCollection] Loaded collection: ${collection.name} with ${collection.tracks.length} tracks`);
  
      return collection;
    };
  
    /**
     * Formats collection data for the player
     * @param {Object} collection - Collection to format
     * @returns {Promise<Object>} Formatted collection
     * @throws {Error} If formatting fails
     */
    const prepareFormattedCollection = async (collection) => {
      console.log(`[StreamingAudioContext: handleLoadCollection] About to format collection with ID: "${collection.id}" (${typeof collection.id})`);
      // Use applyConfig parameter (defaults to true) to apply collection-specific configuration
      const formattedCollection = collectionService.formatCollectionForPlayer(collection, { applyConfig: true });
  
      // Log configuration details
      logCollectionConfig(formattedCollection);
  
      // Verify layers were properly formatted
      const hasAnyTracks = Object.values(formattedCollection.layers || {}).some(
        tracks => Array.isArray(tracks) && tracks.length > 0
      );
  
      if (!hasAnyTracks) {
        console.error('[StreamingAudioContext: handleLoadCollection] No tracks found in formatted collection');
        throw new Error('No compatible audio tracks found in this collection');
      }
  
      // Update audio library with collection tracks
      updateAudioLibrary(formattedCollection);
  
      return formattedCollection;
    };
  
    /**
     * Logs collection configuration details
     * @param {Object} collection - Collection to log
     */
    const logCollectionConfig = (collection) => {
      console.log('[StreamingAudioContext: CONFIG] Collection config details for', collection.id);
      console.log(`[StreamingAudioContext: CONFIG] - Session Duration: ${collection.sessionDuration || 'Not set'}`);
      console.log(`[StreamingAudioContext: CONFIG] - Transition Duration: ${collection.transitionDuration || 'Not set'}`);
  
      // Log phase marker details
      if (collection.phaseMarkers && collection.phaseMarkers.length > 0) {
        console.log(`[StreamingAudioContext: CONFIG] - Phase Markers: ${collection.phaseMarkers.length}`);
        collection.phaseMarkers.forEach(phase => {
          console.log(`[StreamingAudioContext: CONFIG] -- Phase "${phase.name}" (id: ${phase.id}):`);
  
          if (phase.state?.volumes) {
            console.log(`[StreamingAudioContext: CONFIG] --- Volumes: ${JSON.stringify(phase.state.volumes)}`);
          } else {
            console.log(`[StreamingAudioContext: CONFIG] --- Volumes: None defined`);
          }
  
          if (phase.state?.activeAudio) {
            console.log(`[StreamingAudioContext: CONFIG] --- Tracks: ${JSON.stringify(phase.state.activeAudio)}`);
          } else {
            console.log(`[StreamingAudioContext: CONFIG] --- Tracks: None defined`);
          }
        });
      } else {
        console.log('[StreamingAudioContext: CONFIG] - No phase markers defined in collection config');
      }
  
      // Log default volumes
      if (collection.defaultVolumes) {
        console.log(`[StreamingAudioContext: CONFIG] - Default Volumes: ${JSON.stringify(collection.defaultVolumes)}`);
      } else {
        console.log('[StreamingAudioContext: CONFIG] - No default volumes defined in collection config');
      }
    };
  
    /**
     * Updates audio library with collection tracks
     * @param {Object} formattedCollection - Formatted collection data
     */
    const updateAudioLibrary = (formattedCollection) => {
      setAudioLibrary(prevLibrary => {
        const newLibrary = { ...prevLibrary };
  
        // Replace each layer's tracks with the ones from the collection
        Object.entries(formattedCollection.layers).forEach(([layerName, tracks]) => {
          console.log(`[StreamingAudioContext: handleLoadCollection] Setting ${tracks.length} tracks for ${layerName}`);
  
          // Log the actual track IDs and names for debugging
          tracks.forEach(track => {
            console.log(`[StreamingAudioContext: handleLoadCollection] Track: ${track.id} (${track.name})`);
          });
  
          // Update this layer in the library
          newLibrary[layerName] = [...tracks];
        });
  
        // Also update the reference for immediate access
        audioLibraryRef.current = { ...newLibrary };
  
        console.log('[StreamingAudioContext: handleLoadCollection] Updated audioLibrary with collection tracks');
        return newLibrary;
      });
    };
  
    /**
     * Registers collection audio with AudioCore
     * @param {Object} formattedCollection - Formatted collection
     * @returns {Promise<boolean>} Registration success
     */
    const registerCollectionAudio = async (formattedCollection) => {
      console.log('[StreamingAudioContext: handleLoadCollection] Registering new collection audio with AudioCore');
  
      // First, get the audio context and master gain node
      const audioCtx = serviceRef.current.audioCore.getContext();
      const masterGain = serviceRef.current.audioCore.getMasterGain();
  
      // Create a new audio elements structure to register with AudioCore
      const newAudioElements = {};
  
      // Process each layer and its tracks
      Object.entries(formattedCollection.layers).forEach(([layerName, tracks]) => {
        // Initialize empty object for this layer
        newAudioElements[layerName] = {};
  
        // Process each track in the layer
        tracks.forEach(track => {
          try {
            console.log(`[StreamingAudioContext: handleLoadCollection] Creating audio element for ${layerName}/${track.id}`);
  
            // Create new audio element
            const audioElement = new Audio();
            audioElement.preload = "auto";
            audioElement.loop = true;
            audioElement.crossOrigin = "anonymous";
            audioElement.src = track.path;
  
            // Create media element source
            const source = audioCtx.createMediaElementSource(audioElement);
  
            // Connect to volume controller
            if (serviceRef.current.volumeController) {
              serviceRef.current.volumeController.connectToLayer(layerName, source, masterGain);
            }
  
            // Store audio element data
            newAudioElements[layerName][track.id] = {
              element: audioElement,
              source: source,
              track: track,
              isActive: false // Will be set to true when activated
            };
  
          } catch (error) {
            console.error(`[StreamingAudioContext: handleLoadCollection] Error creating audio element for ${track.id}: ${error.message}`);
          }
        });
      });
  
      // Register the new audio elements with AudioCore
      if (serviceRef.current.audioCore.registerElements) {
        const registered = serviceRef.current.audioCore.registerElements(newAudioElements);
        console.log('[StreamingAudioContext: handleLoadCollection] AudioCore registration result:', registered);
        return registered;
      } else {
        console.error('[StreamingAudioContext: handleLoadCollection] AudioCore.registerElements is not defined');
        return false;
      }
    };
  
    /**
     * Applies collection configuration settings
     * @param {Object} formattedCollection - Formatted collection
     */
    const applyConfigToAudioSystem = (formattedCollection) => {
      // Apply configured session and transition duration
      if (formattedCollection.sessionDuration) {
        handleSetSessionDuration(formattedCollection.sessionDuration);
        console.log(`[StreamingAudioContext: handleLoadCollection] Set session duration: ${formattedCollection.sessionDuration}ms`);
      }
  
      if (formattedCollection.transitionDuration) {
        handleSetTransitionDuration(formattedCollection.transitionDuration);
        console.log(`[StreamingAudioContext: handleLoadCollection] Set transition duration: ${formattedCollection.transitionDuration}ms`);
      }
    };
  
     /**
   * Processes and applies phase markers
   * @param {Object} formattedCollection - Formatted collection
   */
  const processAndApplyPhaseMarkers = (formattedCollection) => {
    console.log(`[StreamingAudioContext: PHASES] Processing ${formattedCollection.phaseMarkers.length} phase markers from collection config`);

    // Process each phase marker to ensure track IDs reference actual tracks in the collection
    const processedPhaseMarkers = formattedCollection.phaseMarkers.map(marker => {
      // Create a deep clone of the marker
      const processedMarker = JSON.parse(JSON.stringify(marker));
      console.log(`[StreamingAudioContext: PHASES] Processing phase "${marker.name}" (${marker.id})`);

      // If this phase has state with activeAudio, validate and possibly update track IDs
      if (processedMarker.state && processedMarker.state.activeAudio) {
        console.log(`[StreamingAudioContext: PHASES] -- Validating ${Object.keys(processedMarker.state.activeAudio).length} track references`);

        // For each layer in the phase's activeAudio
        Object.entries(processedMarker.state.activeAudio).forEach(([layer, trackId]) => {
          // Find if this track exists in the collection
          const layerTracks = formattedCollection.layers[layer];
          const trackExists = layerTracks && layerTracks.some(t => t.id === trackId);

          if (!trackExists) {
            console.warn(`[StreamingAudioContext: PHASES] Phase "${marker.name}" references non-existent track "${trackId}" for layer "${layer}"`);

            // If the track doesn't exist, use the first track from the layer instead
            if (layerTracks && layerTracks.length > 0) {
              const fallbackTrack = layerTracks[0];
              console.log(`[StreamingAudioContext: PHASES] Using fallback track "${fallbackTrack.id}" for layer "${layer}" in phase "${marker.name}"`);
              processedMarker.state.activeAudio[layer] = fallbackTrack.id;
            } else {
              // If there are no tracks in this layer, remove the entry
              delete processedMarker.state.activeAudio[layer];
              console.log(`[StreamingAudioContext: PHASES] Removed entry for layer "${layer}" in phase "${marker.name}" - no tracks available`);
            }
          } else {
            console.log(`[StreamingAudioContext: PHASES] -- Valid track reference: ${layer}/${trackId}`);
          }
        });
      } else {
        console.log(`[StreamingAudioContext: PHASES] -- No activeAudio state for phase "${marker.name}"`);
      }

      return processedMarker;
    });

    // Log processed phase markers
    logProcessedPhaseMarkers(processedPhaseMarkers);

    // Update timeline phases with the processed markers
    console.log('[StreamingAudioContext: PHASES] Calling handleUpdateTimelinePhases with processed markers');
    handleUpdateTimelinePhases(processedPhaseMarkers);
    console.log(`[StreamingAudioContext: PHASES] Timeline phases updated. Check if these appear in SessionTimeline component.`);
  };

  /**
   * Logs processed phase marker information
   * @param {Array} phaseMarkers - Processed phase markers
   */
  const logProcessedPhaseMarkers = (phaseMarkers) => {
    console.log(`[StreamingAudioContext: PHASES] Final processed phase markers (${phaseMarkers.length}):`);
    phaseMarkers.forEach(phase => {
      console.log(`[StreamingAudioContext: PHASES] - Phase "${phase.name}" (${phase.id}) at position ${phase.position}%`);
      if (phase.state) {
        if (phase.state.volumes) {
          console.log(`[StreamingAudioContext: PHASES] -- Volumes: ${JSON.stringify(phase.state.volumes)}`);
        }
        if (phase.state.activeAudio) {
          console.log(`[StreamingAudioContext: PHASES] -- Tracks: ${JSON.stringify(phase.state.activeAudio)}`);
        }
      } else {
        console.log(`[StreamingAudioContext: PHASES] -- No state data defined`);
      }
    });
  };

  /**
   * Loads initial tracks for each layer
   * @param {Object} formattedCollection - Formatted collection
   * @param {Object} options - Loading options
   * @returns {Promise<Object>} Map of loaded layers
   */
  const loadInitialTracks = async (formattedCollection, options) => {
    const loadedLayers = {};
    const initialPhaseState = getInitialPhaseState(formattedCollection);
    
    console.log('[StreamingAudioContext: LAYERS] Begin loading tracks for each layer');
    
    for (const [layerFolder, tracks] of Object.entries(formattedCollection.layers)) {
      if (!tracks || tracks.length === 0) {
        console.log(`[StreamingAudioContext: LAYERS] No tracks for layer: ${layerFolder}`);
        continue;
      }

      try {
        // Determine track to load and volume
        const { trackToLoad, trackSource, initialVolume, volumeSource } = determineTrackAndVolume(
          layerFolder, tracks, initialPhaseState, formattedCollection, options
        );

        console.log(`[StreamingAudioContext: LAYERS] Layer ${layerFolder} final setup: 
          track=${trackToLoad.id} (from ${trackSource}), 
          volume=${initialVolume} (from ${volumeSource})`);

        // Set volume for layer
        layerManager.setVolume(layerFolder, initialVolume, { immediate: true });

        // Load the track
        await layerManager.crossfadeTo(layerFolder, trackToLoad.id, 100);

        // Track successful load
        loadedLayers[layerFolder] = trackToLoad.id;
        console.log(`[StreamingAudioContext: LAYERS] Successfully loaded layer ${layerFolder}: ${trackToLoad.id} at volume ${initialVolume}`);
      } catch (layerError) {
        console.error(`[StreamingAudioContext: LAYERS] Error loading ${layerFolder}: ${layerError.message}`);
      }
    }
    
    return loadedLayers;
  };

  /**
   * Gets initial phase state if available
   * @param {Object} formattedCollection - Formatted collection
   * @returns {Object|null} Initial phase state or null
   */
  const getInitialPhaseState = (formattedCollection) => {
    if (formattedCollection.phaseMarkers && formattedCollection.phaseMarkers.length > 0) {
      // Find the pre-onset phase (usually the first one)
      const initialPhase = formattedCollection.phaseMarkers.find(p => p.id === 'pre-onset') ||
        formattedCollection.phaseMarkers[0];

      if (initialPhase && initialPhase.state) {
        console.log(`[StreamingAudioContext: INITIAL_STATE] Found initial phase state: ${initialPhase.id}`);
        console.log(`[StreamingAudioContext: INITIAL_STATE] - Phase name: ${initialPhase.name}`);

        if (initialPhase.state.volumes) {
          console.log(`[StreamingAudioContext: INITIAL_STATE] - Volumes: ${JSON.stringify(initialPhase.state.volumes)}`);
        }

        if (initialPhase.state.activeAudio) {
          console.log(`[StreamingAudioContext: INITIAL_STATE] - Tracks: ${JSON.stringify(initialPhase.state.activeAudio)}`);
        }

        return initialPhase.state;
      } else {
        console.log(`[StreamingAudioContext: INITIAL_STATE] Found phase ${initialPhase.id} but it has no state data`);
      }
    } else {
      console.log(`[StreamingAudioContext: INITIAL_STATE] No phase markers found in collection`);
    }
    return null;
  };

  /**
   * Determines which track to load and what volume to use
   * @param {string} layerFolder - Layer name
   * @param {Array} tracks - Available tracks
   * @param {Object|null} initialPhaseState - Initial phase state
   * @param {Object} formattedCollection - Formatted collection
   * @param {Object} options - Loading options
   * @returns {Object} Track and volume information
   */
  const determineTrackAndVolume = (layerFolder, tracks, initialPhaseState, formattedCollection, options) => {
    // Determine which track to load in order of precedence
    let trackToLoad;
    let trackSource = "default";

    // Check initial phase state first
    if (initialPhaseState?.activeAudio && initialPhaseState.activeAudio[layerFolder]) {
      const phaseTrackId = initialPhaseState.activeAudio[layerFolder];
      const phaseTrack = findTrackById(tracks, phaseTrackId);

      if (phaseTrack) {
        trackToLoad = phaseTrack;
        trackSource = "phase state";
        console.log(`[StreamingAudioContext: LAYERS] Using initial phase track for ${layerFolder}: ${trackToLoad.id}`);
      } else {
        console.log(`[StreamingAudioContext: LAYERS] Phase state specified track ${phaseTrackId} for ${layerFolder} but it wasn't found`);
      }
    }

    // If no track from phase state, check collection defaultActiveAudio
    if (!trackToLoad && formattedCollection.defaultActiveAudio && formattedCollection.defaultActiveAudio[layerFolder]) {
      const configTrackId = formattedCollection.defaultActiveAudio[layerFolder];
      const configTrack = findTrackById(tracks, configTrackId);

      if (configTrack) {
        trackToLoad = configTrack;
        trackSource = "collection config";
        console.log(`[StreamingAudioContext: LAYERS] Using configured track for ${layerFolder}: ${trackToLoad.id}`);
      } else {
        console.log(`[StreamingAudioContext: LAYERS] Config specified track ${configTrackId} for ${layerFolder} but it wasn't found`);
      }
    }

    // Fall back to first track if needed
    if (!trackToLoad) {
      trackToLoad = tracks[0];
      trackSource = "fallback";
      console.log(`[StreamingAudioContext: LAYERS] Using first track for ${layerFolder}: ${trackToLoad.id} (fallback)`);
    }

    // Determine volume to use in order of precedence
    let initialVolume;
    let volumeSource;

    // Use initial phase state volumes if available
    if (initialPhaseState?.volumes && initialPhaseState.volumes[layerFolder] !== undefined) {
      initialVolume = initialPhaseState.volumes[layerFolder];
      volumeSource = "phase state";
      console.log(`[StreamingAudioContext: LAYERS] Using volume from phase state for ${layerFolder}: ${initialVolume}`);
    }
    // Try collection default volumes
    else if (formattedCollection.defaultVolumes && formattedCollection.defaultVolumes[layerFolder] !== undefined) {
      initialVolume = formattedCollection.defaultVolumes[layerFolder];
      volumeSource = "collection config";
      console.log(`[StreamingAudioContext: LAYERS] Using volume from collection config for ${layerFolder}: ${initialVolume}`);
    }
    // Fall back to options or default
    else {
      initialVolume = options.initialVolumes?.[layerFolder] !== undefined
        ? options.initialVolumes[layerFolder]
        : layerFolder === 'Layer 1' ? 0.6 : 0;
      volumeSource = options.initialVolumes?.[layerFolder] !== undefined ? "options" : "fallback";
      console.log(`[StreamingAudioContext: LAYERS] Using ${volumeSource} volume for ${layerFolder}: ${initialVolume}`);
    }

    return { trackToLoad, trackSource, initialVolume, volumeSource };
  };

  /**
   * Finds a track by ID within an array of tracks
   * @param {Array} tracks - Array of tracks to search
   * @param {string} trackId - ID to find
   * @returns {Object|undefined} Found track or undefined
   */
  const findTrackById = (tracks, trackId) => {
    return tracks.find(t => t.id === trackId);
  };

  /**
   * Logs summary information about loaded layers
   * @param {Object} loadedLayers - Map of loaded layers
   */
  const logLoadingSummary = (loadedLayers) => {
    console.log(`[StreamingAudioContext: SUMMARY] Successfully loaded ${Object.keys(loadedLayers).length} layers with tracks`);
    console.log(`[StreamingAudioContext: SUMMARY] Loaded layers: ${JSON.stringify(loadedLayers)}`);
    console.log(`[StreamingAudioContext: SUMMARY] Final volumes: ${JSON.stringify(volumes)}`);
  };

  /**
   * Handles auto-play if requested
   * @param {boolean} shouldAutoPlay - Whether to auto-play
   */
  const handleAutoPlay = (shouldAutoPlay) => {
    // Only auto-start playback if specifically requested
    const autoPlay = shouldAutoPlay === true;
    console.log(`[StreamingAudioContext: handleLoadCollection] Auto-play is ${autoPlay ? 'ENABLED' : 'DISABLED'}`);

    if (autoPlay) {
      console.log('[StreamingAudioContext: handleLoadCollection] Auto-starting playback as requested');
      handleStartSession();
    } else {
      console.log('[StreamingAudioContext: handleLoadCollection] Playback not auto-started, waiting for user action');
    }
  };

  // Return the main load collection function
  return handleLoadCollection;
};

// Export the factory function
export default CollectionLoader;
