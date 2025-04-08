// src/components/audio/SessionTimeline.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudio } from '../../hooks/useAudio';
import PhaseMarker from './PhaseMarker';
import styles from '../../styles/components/SessionTimeline.module.css';

const DEFAULT_PHASES = [
  { id: 'pre-onset', name: 'Pre-Onset', position: 0, color: '#4A6670', state: null, locked: true },
  { id: 'onset', name: 'Onset & Buildup', position: 20, color: '#6E7A8A', state: null, locked: false },
  { id: 'peak', name: 'Peak', position: 40, color: '#8A8A8A', state: null, locked: false },
  { id: 'return', name: 'Return & Integration', position: 60, color: '#A98467', state: null, locked: false }
];

const SessionTimeline = React.forwardRef(({ 
  enabled = true, 
  onDurationChange 
}, ref) => {
  
  // Use our hook with grouped functionality
  const { 
    playback,
    volume,
    layers,
    transitions,
    timeline,
  } = useAudio();
  
  // Local state
  const [currentTime, setCurrentTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [phases, setPhases] = useState(DEFAULT_PHASES);
  const [activePhase, setActivePhase] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [timelineIsPlaying, setTimelineIsPlaying] = useState(false);
  const [localTimelineIsPlaying, setLocalTimelineIsPlaying] = useState(false);
  
  // Refs
  const timelineRef = useRef(null);
  const volumeTransitionTimer = useRef(null);
  const startingPhaseApplied = useRef(false);
  const lastActivePhaseId = useRef(null);
  const wasPlayingBeforeStop = useRef(false);
  const transitionCompletedRef = useRef(true);
  const currentVolumeState = useRef({});
  const currentAudioState = useRef({});
  const previousEditMode = useRef(editMode);
  const transitionInProgress = useRef(false);
  const componentHasRendered = useRef(false);
  const isFirstRender = useRef(true);
  const initialMount = useRef(true);
  const transitionTimeoutRef = useRef(null);

//   //simple test
//   useEffect(() => {
//     console.log('SessionTimeline component mounted');
//   }, []);

// //Provide Volume Data from useAudio
//   useEffect(() => {
//     console.log('Volume in SessionTimeline component:', {
//       volumeObject: volume,
//       hasVolumeLayers: volume && !!volume.layers,
//       volumeLayerCount: volume && volume.layers ? Object.keys(volume.layers).length : 0
//     });
//   }, [volume]);

  // Set transition state helper function
  const setTransitionState = useCallback((isTransitioning, force = false) => {
    // Skip unnecessary state updates if state is already set correctly
    // But allow forcing an update if needed for sync purposes
    if (!force && isTransitioning === transitioning && 
        isTransitioning === transitionInProgress.current && 
        !isTransitioning === transitionCompletedRef.current) {
      console.log(`[setTransitionState] Transition state already set to: ${isTransitioning ? 'START' : 'END'}, skipping update`);
      return;
    }
    
    console.log(`[setTransitionState] Setting transition state: ${isTransitioning ? 'START' : 'END'}`);
    
    // Update all transition state flags atomically to ensure consistency
    transitionInProgress.current = isTransitioning;
    transitionCompletedRef.current = !isTransitioning;
    
    // Set the React state last to ensure the UI updates correctly
    setTransitioning(isTransitioning);
  }, [transitioning]);

  // Initialize and register with timeline service
  useEffect(() => {
    //console.log("SessionTimeline mounting check");
    
    // Only run the setup operations once on first mount
    if (initialMount.current) {
      console.log("[INITIALIZE] SessionTimeline - initial setup");
      
      // Initialize transition state
      setTransitionState(false);
      
      // Register initial phases with timeline service
      if (timeline.updatePhases) {
        console.log("[INITIALIZE] Registering initial phases with timeline service");
        timeline.updatePhases(phases);
      }
      
      // Register session duration
      if (timeline.setDuration) {
        console.log("[INITIALIZE] Setting initial session duration");
        timeline.setDuration(timeline.duration);
      }
      
      // Register transition duration
      if (timeline.setTransitionDuration) {
        console.log("[INITIALIZE] Setting initial transition duration");
        timeline.setTransitionDuration(timeline.transitionDuration);
      }

      // Only reset timeline if playback is not active
      if (!playback.isPlaying && timeline.reset) {
        console.log("[INITIALIZE] Timeline reset on mount (playback not active)");
        timeline.reset();
      }
      
      // Mark initial setup as complete
      initialMount.current = false; 
    }
    
    componentHasRendered.current = true;
    
    // Clean up
    return () => {
      if (volumeTransitionTimer.current) {
        clearInterval(volumeTransitionTimer.current);
      }
      
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [phases, timeline, playback.isPlaying, setTransitionState]);
  
  // Update phases when they change
  useEffect(() => {
    if (!initialMount.current && timeline.updatePhases) {
      timeline.updatePhases(phases);
    }
  }, [phases, timeline]);

  // Listen for timeline setting changes
  useEffect(() => {
    // Handle duration change events
    const handleDurationChange = (event) => {
      console.log('Timeline received duration change event:', event.detail.duration);
      
      // Force an update of the timeline
      if (timeline.setDuration) {
        timeline.setDuration(event.detail.duration);
      }
      
      // Update local state if needed
      if (onDurationChange) {
        onDurationChange(event.detail.duration);
      }
    };
    
    // Handle transition duration change events
    const handleTransitionChange = (event) => {
      console.log('Timeline received transition change event:', event.detail.duration);
      
      if (timeline.setTransitionDuration) {
        timeline.setTransitionDuration(event.detail.duration);
      }
    };
    
    // Add event listeners
    window.addEventListener('timeline-duration-changed', handleDurationChange);
    window.addEventListener('timeline-transition-changed', handleTransitionChange);

    return () => {
      // Clean up event listeners
      window.removeEventListener('timeline-duration-changed', handleDurationChange);
      window.removeEventListener('timeline-transition-changed', handleTransitionChange);
    };
  }, [timeline, onDurationChange]);

  // Register the state provider for presets
  useEffect(() => {
    // This function will be called when saving a preset
    const getTimelineState = () => {
      return {
        phases: phases.map(phase => ({
          id: phase.id,
          name: phase.name,
          position: phase.position,
          color: phase.color,
          state: phase.state,
          locked: phase.locked
        })),
        sessionDuration: timeline.duration,
        transitionDuration: timeline.transitionDuration
      };
    };

    // Register the function with the preset system
    if (timeline.registerPresetStateProvider) {
      timeline.registerPresetStateProvider('timeline', getTimelineState);
      
      // Clean up when component unmounts
      return () => timeline.registerPresetStateProvider('timeline', null);
    }
  }, [phases, timeline]);

  // Handle when timeline phases are updated from a preset
  useEffect(() => {
    // Custom event listener for timeline phase updates
    const handleTimelineUpdate = (eventData) => {
      if (eventData.detail && eventData.detail.phases) {
        console.log('Updating timeline phases from preset:', eventData.detail.phases);
        
        // Update phases
        setPhases(eventData.detail.phases);
        
        // Update session duration if provided
        if (eventData.detail.sessionDuration && onDurationChange) {
          onDurationChange(eventData.detail.sessionDuration);
        }
      }
    };

    // Add event listener
    window.addEventListener('timeline-update', handleTimelineUpdate);
    
    // Clean up
    return () => {
      window.removeEventListener('timeline-update', handleTimelineUpdate);
    };
  }, [onDurationChange]);
  
  // Handle enabling/disabling timeline
  useEffect(() => {
    if (!enabled && volumeTransitionTimer.current) {
      clearInterval(volumeTransitionTimer.current);
      volumeTransitionTimer.current = null;
      setTransitionState(false);
    }
  }, [enabled, setTransitionState]);
  
  // Effect to track edit mode changes and ensure deselection
  useEffect(() => {
    if (previousEditMode.current !== editMode) {
      // If exiting edit mode, deselect all markers
      if (!editMode && previousEditMode.current) {
        deselectAllMarkers();
      }
      
      // Update the previous value
      previousEditMode.current = editMode;
    }
  }, [editMode]);
 
  //Toggle timeline playback
  const toggleTimelinePlayback = useCallback(() => {
    // Only allow starting timeline if audio is playing
    if (!playback.isPlaying && !timelineIsPlaying) {
      console.log("Cannot start timeline when audio is not playing");
      return;
    }
    
    console.log("Timeline toggle button clicked, current state:", timelineIsPlaying);
    
    // Toggle the local timeline state
    const newTimelineState = !timelineIsPlaying;
    console.log("Setting new timeline state to:", newTimelineState);
    
    setTimelineIsPlaying(newTimelineState);
    setLocalTimelineIsPlaying(newTimelineState);
  
    if (newTimelineState) {
      console.log("Starting timeline progression");
      // Reset progress tracking to start fresh
      setProgress(0);
      setCurrentTime(0);
      
      // Reset timeline in the service
      if (timeline.reset) {
        console.log("Calling timeline.reset()");
        timeline.reset();
      }
      
      // Start timeline in the service - try different method names
      console.log("About to start timeline, available methods:", Object.keys(timeline));
      
      if (timeline.startTimeline) {
        console.log("Calling timeline.startTimeline()");
        timeline.startTimeline();
      } 
    } else {
      console.log("Stopping timeline progression");
      // Stop timeline in the service - try different method names
      if (timeline.stopTimeline) {
        console.log("Calling timeline.stopTimeline()");
        timeline.stopTimeline();
      } 
      
      // Reset phase tracking
      lastActivePhaseId.current = null;
      setActivePhase(null);
      
      
      // Cancel active transitions
      if (volumeTransitionTimer.current) {
        clearInterval(volumeTransitionTimer.current);
        volumeTransitionTimer.current = null;
      }
      setTransitionState(false);
    }
  }, [timelineIsPlaying, playback.isPlaying, timeline, setTransitionState]);
  
// Reset all timeline state for a clean restart
  const resetTimeline = useCallback(() => {
    // Don't reset if playback is active - this prevents disruption
    if (playback.isPlaying) {
      console.log("Skipping timeline reset - playback is active");
      return;
    }
    
    console.log("Performing full timeline reset");
    setProgress(0);
    setCurrentTime(0);
    
    lastActivePhaseId.current = null;
    setActivePhase(null);
    
    if (volumeTransitionTimer.current) {
      clearInterval(volumeTransitionTimer.current);
      volumeTransitionTimer.current = null;
    }
    
    setTransitionState(false);
    
    if (timeline.reset) {
      console.log("Calling timeline.reset()");
      timeline.reset();
    }
  }, [timeline, playback.isPlaying, setTransitionState]);

  // Refresh volume state reference
  // Update refreshVolumeStateReference function
  const refreshVolumeStateReference = useCallback(() => {
    // Get the ACTUAL current volumes directly from the volume controller
    if (volume && volume.layers) {
      // Create a new object to ensure it's a different reference
      const actualCurrentVolumes = {};
      Object.entries(volume.layers).forEach(([layer, vol]) => {
        // Round to avoid floating point issues
        actualCurrentVolumes[layer] = Math.round(vol * 100) / 100;
      });
      
      // Replace the current state reference
      currentVolumeState.current = actualCurrentVolumes;
     // console.log('Refreshed volume state with ACTUAL current values:', actualCurrentVolumes);
    }
    
    // Get the ACTUAL current audio tracks
    if (layers && layers.active) {
      const actualCurrentAudio = {};
      Object.entries(layers.active).forEach(([layer, trackId]) => {
        if (trackId) {
          actualCurrentAudio[layer] = trackId;
        }
      });
      
      currentAudioState.current = actualCurrentAudio;
     // console.log('Refreshed audio state with ACTUAL current tracks:', actualCurrentAudio);
    }
  }, [volume, layers]);

  // Define default pre-onset phase state - used if no saved state exists
  const DEFAULT_PRE_ONSET_STATE = {
    volumes: {
      [layers.TYPES.DRONE.toLowerCase()]: 0.25,
      [layers.TYPES.MELODY.toLowerCase()]: 0.0,
      [layers.TYPES.RHYTHM.toLowerCase()]: 0.0,
      [layers.TYPES.NATURE.toLowerCase()]: 0.0
    },
    // We'll use whatever tracks are currently active
    activeAudio: {}
  };

    // Helper function to finish the transition and update state
  // Update the finishTransition function
// Update the finishTransition function
const finishTransition = useCallback((phase) => {
  console.log('[finishTransision] Finishing transition to phase:', phase.name);
  
  // NOW is when we update the current state references to the target values
  // This ensures we only update after the transition is complete
  
  // Update volume state reference
  if (phase.state?.volumes) {
    currentVolumeState.current = {};
    Object.entries(phase.state.volumes).forEach(([layer, vol]) => {
      currentVolumeState.current[layer] = vol;
    });
    console.log('[finishTransition] Updated volume state reference to target values:', currentVolumeState.current);
  }
  
  // Update audio state reference
  if (phase.state?.activeAudio) {
    currentAudioState.current = {};
    Object.entries(phase.state.activeAudio).forEach(([layer, trackId]) => {
      currentAudioState.current[layer] = trackId;
    });
    console.log('[finishTransition] Updated audio state reference to target values:', currentAudioState.current);
  }
  
  // Reset transition flags
  transitionCompletedRef.current = true;
  transitionInProgress.current = false;
  
  // Set React state
  setTransitioning(false);
  
  console.log('[finishTransition] Transition complete - flags reset, phase detection unblocked');
}, []);
  
  // Full transition function that coordinates track changes and volume changes
 // Update the startFullTransition function in SessionTimeline.js
 // Update the startFullTransition function with focus on preserving original state
const startFullTransition = useCallback((phase, transitionState = null) => {
  console.log(`[startFullTransition] Starting full transition to phase: ${phase.name}`);
 
  // Skip transition if already in progress or not enabled
  if (!enabled || !phase.state) {
    console.log('[startFullTransition] Skipping transition - either disabled or no state');
    return;
  }
  
  // Clean up any existing volume transition timer
  if (volumeTransitionTimer.current) {
    clearInterval(volumeTransitionTimer.current);
    volumeTransitionTimer.current = null;
  }
  
  // Cancel any existing transition timeout
  if (transitionTimeoutRef.current) {
    clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = null;
  }
  
  // Signal that transition is starting
  setTransitionState(true);
  
  // Use the duration from session settings
  const duration = timeline.transitionDuration;
  console.log(`[startFullTransition] Starting full transition with duration: ${duration}ms`);
  
  // CRITICAL: Create a snapshot of the current state before starting any transitions
  // We'll use this as the starting point for all transitions
  

// First for volume state
const originalVolumeState = {};

// If we have a state snapshot with original volumes, use that EXCLUSIVELY
if (transitionState && transitionState.originalVolumes) {
  console.log('[startFullTransition] Using provided transitionState volume state:', transitionState.originalVolumes);
  Object.assign(originalVolumeState, transitionState.originalVolumes);
  console.log('[startFullTransition] Using provided original volume state:', originalVolumeState);
}
// Otherwise get directly from the volume controller
else if (volume && volume.layers) {
  Object.entries(volume.layers).forEach(([layer, vol]) => {
    originalVolumeState[layer] = vol;
  });
  console.log('[startFullTransition] Captured original volume state from controller:', originalVolumeState);
}
  
  // Then for audio state
  const originalAudioState = {};
  
  // Use current active audio or fallback
  Object.values(layers.TYPES).forEach(layerType => {
    const layer = layerType.toLowerCase();
    // First try current reference, then active layers, then fallback
    if (currentAudioState.current && currentAudioState.current[layer]) {
      originalAudioState[layer] = currentAudioState.current[layer];
    } else if (layers && layers.active && layers.active[layer]) {
      originalAudioState[layer] = layers.active[layer];
    } else {
      // Last resort fallback
      originalAudioState[layer] = `${layer}1`;
    }
  });
  
  console.log('[startFullTransition] Original audio state:', originalAudioState);
  
  // Step 1: Identify track changes needed
  const trackChanges = [];
  
  // Compare original audio state to the target phase state
  Object.entries(phase.state.activeAudio || {}).forEach(([layer, targetTrackId]) => {
    const currentTrackId = originalAudioState[layer];
      
    if (currentTrackId && targetTrackId && targetTrackId !== currentTrackId) {
      console.log(`[startFullTransition] Need to crossfade ${layer}: ${currentTrackId} → ${targetTrackId}`);
      
      // Add to our list of needed track changes
      trackChanges.push({
        layer,
        from: currentTrackId,
        to: targetTrackId
      });
    }
  });
  
  // Step 2: Execute all track crossfades with the same duration
  const crossfadePromises = trackChanges.map(change => {
    console.log(`[startFullTransition] Starting crossfade for ${change.layer} from ${change.from} to ${change.to}`);
    return transitions.crossfade(change.layer, change.to, duration)
      .catch(err => {
        console.error(`[startFullTransition] Error in crossfade for ${change.layer}:`, err);
        return false;
      });
  });
  
  // Step 3: Handle volume changes with volume controller
  // =============== START OF THE HELPER FUNCTION ===============
  // Helper function to find the best way to fade volume based on available API
  const fadeVolume = async (layer, targetValue, durationSec) => {
    // Option 1: Try volume.fadeVolume if it exists
    if (typeof volume.fadeVolume === 'function') {
      console.log(`[startFullTransition] Using volume.fadeVolume for ${layer}`);
      return volume.fadeVolume(layer, targetValue, durationSec);
    }
    // Option 2: Try setLayer with transition options
    else if (typeof volume.setLayer === 'function') {
      console.log(`U[startFullTransition] sing volume.setLayer with options for ${layer}`);
      return volume.setLayer(layer, targetValue, { 
        immediate: false, 
        transitionTime: durationSec 
      });
    }
    // Option 3: Fallback to basic setLayer
    else {
      console.log(`[startFullTransition] Using fallback for ${layer}`);
      volume.setLayer(layer, targetValue, { immediate: false });
      return new Promise(resolve => setTimeout(resolve, durationSec * 1000));
    }
  };
  // =============== END OF THE HELPER FUNCTION ===============
const volumeFadePromises = [];

// Compare original volume state to the target phase state
Object.entries(phase.state.volumes || {}).forEach(([layer, targetVolume]) => {
  const currentVolume = originalVolumeState[layer] !== undefined ? 
    originalVolumeState[layer] : 0;
  
  // Only transition if there's a meaningful difference
  if (Math.abs(targetVolume - currentVolume) > 0.01) {
    console.log(`[startFullTransition] Volume change for ${layer}: ${currentVolume} → ${targetVolume}`);
    
    // Skip volume transition for layers that are in an active crossfade
    const isInCrossfade = trackChanges.some(tc => tc.layer === layer);
    if (!isInCrossfade) {
      // Use the VolumeController.fadeVolume method directly
      // This returns a promise we can track
      // Note: volume.fadeVolume is accessible through volume.layers in the hooks API
      const fadePromise = volume.fadeVolume ? 
        volume.fadeVolume(layer, targetVolume, duration / 1000) : // If direct access to fadeVolume
        serviceRef.current.volumeController.fadeVolume(layer, targetVolume, duration / 1000); // Fallback if using service ref
      
      volumeFadePromises.push(fadePromise);
    }
  }
});
    // Step 4: Set up a combined Promise to track all transitions
    Promise.all([...crossfadePromises, ...volumeFadePromises])
    .then(() => {
      console.log('[startFullTransition] All transitions (crossfades and volume fades) complete');
      
      // Clear any failsafe timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
      
      // Finish the transition
      finishTransition(phase);
    })
    .catch(error => {
      console.error('[startFullTransition] Error during transition:', error);
      
      // Still finish transition on error, for resilience
      finishTransition(phase);
    });
  
  // Set a failsafe timeout in case promises don't resolve
  transitionTimeoutRef.current = setTimeout(() => {
    console.log("[startFullTransition] Failsafe: Forcing transition completion after timeout");
    
    if (volumeTransitionTimer.current) {
      clearInterval(volumeTransitionTimer.current);
      volumeTransitionTimer.current = null;
    }
    
    finishTransition(phase);
  }, duration + 2000); // Duration plus buffer
}, [enabled, timeline, layers, volume, transitions, setTransitionState, finishTransition]);


  // Restart Playing
  useEffect(() => {
    if (playback.isPlaying) {
      if (!wasPlayingBeforeStop.current && componentHasRendered.current) {
        resetTimeline();
        setTransitionState(false);
        
        // Ensure current audio state is synchronized with active audio
        if (layers && layers.active) {
          Object.entries(layers.active).forEach(([layer, trackId]) => {
            if (trackId) {
              currentAudioState.current[layer] = trackId;
            }
          });
        }
      }
      wasPlayingBeforeStop.current = true;
    } else {
      wasPlayingBeforeStop.current = false;
      startingPhaseApplied.current = false;
      setTransitionState(false);
    }
  }, [playback.isPlaying, resetTimeline, layers, setTransitionState]);

// Stop Playback and reset timeline
  useEffect(() => {
  // If audio playback stops, also stop the timeline
  if (!playback.isPlaying && timelineIsPlaying) {
    console.log("Audio stopped - stopping timeline automatically");
    setTimelineIsPlaying(false);
    setLocalTimelineIsPlaying(false);
    
    // Reset phase tracking
    lastActivePhaseId.current = null;
    setActivePhase(null);
    
    // Cancel active transitions
    if (volumeTransitionTimer.current) {
      clearInterval(volumeTransitionTimer.current);
      volumeTransitionTimer.current = null;
    }
    setTransitionState(false);
    
    // Stop timeline in the service
    if (timeline.stopTimeline) {
      timeline.stopTimeline();
    }
  }
  }, [playback.isPlaying, timelineIsPlaying, timeline, setTransitionState]);

  // Watch for active crossfades to update transition state
  useEffect(() => {
    const hasActiveCrossfades = Object.keys(transitions.active).length > 0;
    
    // If any layer is in transition, mark as transitioning
    if (hasActiveCrossfades) {
      transitionInProgress.current = true;
      setTransitionState(true);
    } else if (transitionInProgress.current) {
      // If was transitioning but now no crossfades are active
      transitionInProgress.current = false;
      
      // Short delay before allowing new transitions
      setTimeout(() => {
        setTransitionState(false);
        transitionCompletedRef.current = true;
      }, 200);
    }
  }, [transitions.active, setTransitionState]);

  // Apply pre-onset phase IMMEDIATELY when play is pressed (no transition)
 /* useEffect(() => {
    // Skip the effect on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    if (enabled && playback.isPlaying && !startingPhaseApplied.current && wasPlayingBeforeStop.current === false) {
      const preOnsetPhase = phases.find(p => p.id === 'pre-onset');
      
      // Ensure we have valid current state data
      refreshVolumeStateReference();
      if (timelineRef.current) {
      
        // Determine the state to apply - either the saved state or the default
        const stateToApply = preOnsetPhase?.state || DEFAULT_PRE_ONSET_STATE;
        
        // If using default state, fill in current active audio
        if (!preOnsetPhase?.state) {
          Object.values(layers.TYPES).forEach(layer => {
            const layerKey = layer.toLowerCase();
            stateToApply.activeAudio[layerKey] = layers.active[layerKey];
          });
          console.log('Using DEFAULT pre-onset state (no saved state found)', stateToApply);
        } else {
          console.log('Applying SAVED pre-onset phase state', stateToApply);
        }
        
        // Apply the state only if we're actively starting playback
        if (playback.isPlaying) {
          console.log('Applying pre-onset phase immediately at start of playback (no transition)');
          
          // Immediately set volumes
          Object.entries(stateToApply.volumes).forEach(([layer, vol]) => {
            volume.setLayer(layer, vol, { immediate: true });
          });
          
          // Handle track changes immediately (with a nearly instant 50ms crossfade)
          Object.entries(stateToApply.activeAudio).forEach(([layer, trackId]) => {
            if (trackId !== layers.active[layer]) {
              transitions.crossfade(layer, trackId, 50); // 50ms is practically instant but avoids pops
            }
          });
          
          // Mark as applied and update state refs
          startingPhaseApplied.current = true;
          lastActivePhaseId.current = 'pre-onset';
          setActivePhase('pre-onset');
          
          // Update current state refs
          currentVolumeState.current = { ...stateToApply.volumes };
          currentAudioState.current = { ...stateToApply.activeAudio };
        }
      }
    }
  }, [enabled, playback.isPlaying, phases, volume, transitions, layers, refreshVolumeStateReference, DEFAULT_PRE_ONSET_STATE]);
  */
 
// updating time and progress bar 
  useEffect(() => {
  let interval;
  
  // Only run progress tracking when BOTH audio is playing AND timeline is enabled AND timeline is playing
  if (enabled && playback.isPlaying && localTimelineIsPlaying) {
    console.log("Starting SessionTimeline progress tracking");
    
    // Start with fresh time - clear any old state
    const time = playback.getTime();
    setCurrentTime(time);
    const progressPercent = Math.min(100, (time / timeline.duration) * 100);
    setProgress(progressPercent);
    
    interval = setInterval(() => {
      // Get current time directly from the timeline service
      const time = playback.getTime();
      setCurrentTime(time);
      
      const progressPercent = Math.min(100, (time / timeline.duration) * 100);
      setProgress(progressPercent);
    }, 50); // Update more frequently for smoother animation
  }
  
  return () => {
    if (interval) {
      clearInterval(interval);
    }
  };
}, [enabled, playback.isPlaying, localTimelineIsPlaying, timeline.duration, playback]);
  
  // Phase detection effect
  useEffect(() => {
    // Add debug logging to see if this effect is running
    // console.log("Phase detection effect triggered with state:", { 
    //   enabled, 
    //   isPlaying: playback.isPlaying, 
    //   timelinePlaying: localTimelineIsPlaying 
    // });
    
    let timeoutId = null;
    let isRunning = false;
    const runPhaseCheck = () => {
      // Only continue if conditions are still met
      if (!enabled || !playback.isPlaying || !localTimelineIsPlaying) {
       // console.log("Stopping phase checks as conditions no longer met");
        isRunning = false;
        return;
      }

      //console.log("Phase check running");
        // Skip phase checks during active transitions
        if (transitioning || !transitionCompletedRef.current || transitionInProgress.current) {
          return;
        }
        
        // Refresh volume state reference to ensure it's current
       // refreshVolumeStateReference();

        const time = playback.getTime();
        const progressPercent = Math.min(100, (time / timeline.duration) * 100);
        //console.log(`Current progress: ${progressPercent.toFixed(2)}%`);
        // Find the current phase based on progress
        const sortedPhases = [...phases].sort((a, b) => b.position - a.position);
        let newActivePhase = null;
        
        for (const phase of sortedPhases) {
          if (progressPercent >= phase.position) {
            newActivePhase = phase;
            break;
          }
        }
        
        // If we've reached a new phase and it has state data
       // In the phase detection useEffect, enhance this section:
        if (newActivePhase && newActivePhase.id !== lastActivePhaseId.current) {
          console.log(`[PHASEDETECT] New active phase detected: ${newActivePhase.name} at ${progressPercent.toFixed(1)}%`);
          
        
  // IMPORTANT: Capture the ACTUAL current state directly from volume controller
  // This is critical - don't use our possibly stale references
  const actualCurrentVolumes = {};

  // Get the real current volumes directly from the volume controller
  if (volume && volume.layers) {
    Object.entries(volume.layers).forEach(([layer, vol]) => {
      actualCurrentVolumes[layer] = vol;
    });
  }
  
  console.log('[PHASEDETECT] Actual current volumes captured from system:', actualCurrentVolumes);
  
  // Get the actual current audio tracks
  const actualCurrentAudio = {};
  if (layers && layers.active) {
    Object.entries(layers.active).forEach(([layer, trackId]) => {
      actualCurrentAudio[layer] = trackId;
    });
  }
  
  console.log('[PHASEDETECT] Actual current audio tracks captured from system:', actualCurrentAudio);
  
          // Update phase tracking
          lastActivePhaseId.current = newActivePhase.id;
          setActivePhase(newActivePhase.id);
          
          if (newActivePhase.state) {
            console.log(`[PHASEDETECT] Starting transition to ${newActivePhase.name} phase`);
            console.log('[PHASEDETECT] Target state:', {
              volumes: newActivePhase.state.volumes,
              tracks: newActivePhase.state.activeAudio
            });
            
            // Store the original state we captured
            const stateSnapshot = {
              originalVolumes: actualCurrentVolumes,
              phaseData: newActivePhase
            };
            
            // Begin transition
            transitionCompletedRef.current = false;
            transitionInProgress.current = true;
            
            // Start full transition with state information
            startFullTransition(newActivePhase, stateSnapshot);
          }

    
          // Schedule next check
          timeoutId = setTimeout(runPhaseCheck, 250);
        };
        
        // Start the checks if conditions are met
        if (enabled && playback.isPlaying && localTimelineIsPlaying && !isRunning) {
          console.log("[PHASEDETECT] Starting phase detection checks");
          isRunning = true;
          runPhaseCheck();
        }
        
        return () => {
          console.log("[PHASEDETECT] Cleaning up phase detection");
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          isRunning = false;
        };
      }; 
      if (enabled && playback.isPlaying && localTimelineIsPlaying && !isRunning) {
        // console.log("Starting phase detection checks");
        isRunning = true;
        runPhaseCheck();
      }
    }, [
  // Make sure ALL dependencies are listed here
  enabled, 
  playback.isPlaying, 
  localTimelineIsPlaying, 
  transitioning, 
  timeline.duration, 
  refreshVolumeStateReference, 
  playback.getTime,
  // Make sure you include ALL other dependencies that are used inside
  phases,
  volume.layers,
  layers.active,
  startFullTransition
]);
 
  // Cleanup transitions when playback stops
  useEffect(() => {
    // Force reset all transition state when playback stops
    if (!playback.isPlaying) {
      console.log("Playback stopped, forcing transition state reset");
      
      // Ensure all transition state is reset
      transitionInProgress.current = false;
      transitionCompletedRef.current = true;
      setTransitioning(false);
      
      // Clear any volume transition timers
      if (volumeTransitionTimer.current) {
        clearInterval(volumeTransitionTimer.current);
        volumeTransitionTimer.current = null;
      }
      
      // Clear any transition timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
    }
    
    return () => {
      if (volumeTransitionTimer.current) {
        clearInterval(volumeTransitionTimer.current);
        volumeTransitionTimer.current = null;
      }
      
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
    };
  }, [playback.isPlaying]);

  // Format time display (HH:MM:SS)
  const formatTime = useCallback((ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);
  
  // Format estimated time remaining
  const formatTimeRemaining = useCallback(() => {
    const remainingMs = timeline.duration - currentTime;
    if (remainingMs <= 0) return '00:00:00';
    return formatTime(remainingMs);
  }, [formatTime, currentTime, timeline.duration]);
  
  // Handle phase marker position change
  const handlePhaseMarkerDrag = useCallback((index, newPosition) => {
    if (phases[index].locked) {
      console.log('Cannot move Pre-Onset marker as it is locked to position 0');
      return;
    }
    
    const lowerBound = index > 0 ? phases[index - 1].position + 1 : 0;
    const upperBound = index < phases.length - 1 ? phases[index + 1].position - 1 : 100;
    
    const clampedPosition = Math.max(lowerBound, Math.min(upperBound, newPosition));
    
    const newPhases = [...phases];
    newPhases[index].position = clampedPosition;
    setPhases(newPhases);
    
    // Notify the timeline service that phases have been updated
    if (timeline.updatePhases) {
      timeline.updatePhases(newPhases);
    }
  }, [phases, timeline]);
  
  // Deselect all markers
  const deselectAllMarkers = useCallback(() => {
    if (selectedPhase !== null) {
      console.log('Deselecting all markers');
      setSelectedPhase(null);
    }
  }, [selectedPhase]);
  
  // Toggle edit mode
  const toggleEditMode = useCallback(() => {
    // If currently in edit mode and about to exit, deselect all markers first
    if (editMode) {
      deselectAllMarkers();
    }
    
    // Toggle edit mode state
    setEditMode(!editMode);
  }, [editMode, deselectAllMarkers]);

  // Select a marker
  const handleSelectMarker = useCallback((index) => {
    // If the same marker is already selected
    if (selectedPhase === index) {
      // In edit mode, don't deselect (keep selected for capture)
      if (!editMode) {
        // In view mode, toggle selection
        setSelectedPhase(null);
      }
    } else {
      // Different marker selected, or no marker was selected before
      setSelectedPhase(index);
    }
  }, [selectedPhase, editMode]);
  
  // Deselect a specific marker
  const handleDeselectMarker = useCallback((index) => {
    if (selectedPhase === index) {
      setSelectedPhase(null);
    }
  }, [selectedPhase]);
  
  // Capture current player state for a phase
  const capturePhaseState = useCallback((index) => {
    const state = {
      volumes: { ...volume.layers },
      activeAudio: { ...layers.active }
    };
    
    const newPhases = [...phases];
    newPhases[index].state = state;
    setPhases(newPhases);
    
    // Notify the timeline service of updated phases
    if (timeline.updatePhases) {
      timeline.updatePhases(newPhases);
    }
    
    if (phases[index].id === 'pre-onset' && lastActivePhaseId.current === 'pre-onset') {
      currentVolumeState.current = { ...volume.layers };
      currentAudioState.current = { ...layers.active };
    }
    
    // After capturing state, deselect all markers
    deselectAllMarkers();
  }, [phases, volume.layers, layers.active, timeline, deselectAllMarkers]);

  // Handle click away from markers - deselect the current marker
  const handleBackgroundClick = useCallback((e) => {
    // Make sure we're clicking on the timeline background, not a marker
    if (e.target === timelineRef.current) {
      deselectAllMarkers();
    }
  }, [deselectAllMarkers]);

  // useImperativeHandle hook
React.useImperativeHandle(ref, () => ({
  resetTimelinePlayback: () => {
    console.log("Timeline playback reset by parent component");
    setTimelineIsPlaying(false);
    setLocalTimelineIsPlaying(false);
   // Also reset phase tracking
   lastActivePhaseId.current = null;
   setActivePhase(null);
   
   // Stop any running transitions
   if (volumeTransitionTimer.current) {
     clearInterval(volumeTransitionTimer.current);
     volumeTransitionTimer.current = null;
   }
   setTransitionState(false);
   
   // Stop timeline in the service
   if (timeline.stopTimeline) {
     timeline.stopTimeline();
   }
 }
}));
  
  if (!enabled) return null;

  return (
    <div className={styles.timelineContainer}>
      <div className={styles.timelineHeader}>
        <h2 className={styles.timelineTitle}>Session Timeline</h2>
        
        <div className={styles.timelineControls}>
          <button 
            className={`${styles.controlButton} ${editMode ? styles.active : ''}`}
            onClick={toggleEditMode}
          >
            {editMode ? 'Done' : 'Edit Timeline'}
          </button>
        </div>
      </div>
      
      {activePhase && (
        <div className={styles.phaseIndicator}>
          Current Phase: <span className={styles.activePhase}>
            {phases.find(p => p.id === activePhase)?.name}
          </span>
          {transitioning && <span className={styles.transitioningLabel}> (Transitioning)</span>}
        </div>
      )}
      
      <div 
        className={styles.timelineWrapper}
      >
        <div 
          className={styles.timeline} 
          ref={timelineRef}
          onClick={handleBackgroundClick}
        >
          <div 
            className={styles.progressBar} 
            style={{ width: `${progress}%` }}
          />
          
          {/* Map phase markers */}
          {phases.map((phase, index) => (
            <PhaseMarker
              key={phase.id || index}
              name={phase.name}
              color={phase.color}
              position={phase.position}
              isActive={activePhase === phase.id}
              isSelected={selectedPhase === index}
              isDraggable={editMode && !phase.locked}
              onDrag={(newPosition) => handlePhaseMarkerDrag(index, newPosition)}
              onSelect={() => handleSelectMarker(index)}
              onDeselect={() => handleDeselectMarker(index)}
              onStateCapture={() => capturePhaseState(index)}
              storedState={phase.state}
              editMode={editMode}
              sessionDuration={timeline.duration}
              hasStateCaptured={!!phase.state}
            />
          ))}
        </div>
      </div>
      <div className={styles.timelineControls}>
  
  
  {/* Add timeline playback controls */}
 {/* Add debug info to the button */}
<button 
  className={`${styles.controlButton} ${timelineIsPlaying ? styles.active : ''}`}
  onClick={() => {
    console.log("Timeline button clicked!");
    toggleTimelinePlayback();
  }}
  disabled={!playback.isPlaying}
>
  {timelineIsPlaying ? 'Stop Timeline' : 'Start Timeline'}
</button>
</div>
      {/* Time info below the timeline */}
      <div className={styles.timeInfo}>
        <span>{formatTime(currentTime)}</span>
        <span className={styles.remainingTime}>-{formatTimeRemaining()}</span>
      </div>
      
      <div className={styles.timelineLabels}>
        <span>Start</span>
        <span>End</span>
      </div>
      
      {editMode && (
        <div className={styles.editInstructions}>
          Press and hold a marker to drag it. Tap a marker to select it, then tap "Capture State" to save current audio settings.
        </div>
      )}
    </div>
  );
});

export default React.memo(SessionTimeline);