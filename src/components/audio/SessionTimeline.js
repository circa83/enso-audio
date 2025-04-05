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

  // Set transition state helper function
  const setTransitionState = useCallback((isTransitioning) => {
    console.log(`Setting transition state: ${isTransitioning ? 'START' : 'END'}`);
    
    // Update all transition state flags atomically to ensure consistency
    transitionInProgress.current = isTransitioning;
    transitionCompletedRef.current = !isTransitioning;
    
    // Set the React state last to ensure the UI updates correctly
    setTransitioning(isTransitioning);
  }, []);

  // Initialize and register with timeline service
  useEffect(() => {
    console.log("SessionTimeline mounting check");
    
    // Only run the setup operations once on first mount
    if (initialMount.current) {
      console.log("SessionTimeline - initial setup");
      
      // Initialize transition state
      setTransitionState(false);
      
      // Register initial phases with timeline service
      if (timeline.updatePhases) {
        console.log("Registering initial phases with timeline service");
        timeline.updatePhases(phases);
      }
      
      // Register session duration
      if (timeline.setDuration) {
        console.log("Setting initial session duration");
        timeline.setDuration(timeline.duration);
      }
      
      // Register transition duration
      if (timeline.setTransitionDuration) {
        console.log("Setting initial transition duration");
        timeline.setTransitionDuration(timeline.transitionDuration);
      }

      // Only reset timeline if playback is not active
      if (!playback.isPlaying && timeline.reset) {
        console.log("Timeline reset on mount (playback not active)");
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
  
  // Toggle timeline playback state
  setTimelineIsPlaying(prev => !prev);
  
  if (!timelineIsPlaying) {
    console.log("Starting timeline progression");
    // Reset progress tracking to start fresh
    setProgress(0);
    setCurrentTime(0);
    
    // Reset timeline in the service
    if (timeline.reset) {
      timeline.reset();
    }
    
    // Start timeline in the service
    if (timeline.enabled && timeline.start) {
      timeline.start({ reset: true });
    }
  } else {
    console.log("Stopping timeline progression");
    // Stop timeline in the service
    if (timeline.enabled && timeline.stop) {
      timeline.stop();
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
}, [timelineIsPlaying, playback.isPlaying, timeline]);

  
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
  const refreshVolumeStateReference = useCallback(() => {
    // Update internal volume state reference from the actual current volumes
    if (volume && volume.layers) {
      // Force different object reference to ensure change detection
      const newVolumeState = {};
      Object.entries(volume.layers).forEach(([layer, val]) => {
        // Round to 2 decimal places to avoid floating point comparison issues
        newVolumeState[layer] = Math.round(val * 100) / 100;
      });
      
      // Update reference
      currentVolumeState.current = newVolumeState;
    }
    
    // Also ensure audio state is up to date
    if (layers && layers.active) {
      currentAudioState.current = {...layers.active};
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
  const finishTransition = useCallback((phase) => {
    console.log('Finishing transition to phase:', phase.name);
    
    // Update current state references - deep clone to avoid reference issues
    currentVolumeState.current = JSON.parse(JSON.stringify(phase.state.volumes));
    currentAudioState.current = JSON.parse(JSON.stringify(phase.state.activeAudio));
    
    // Reset transition flags
    transitionCompletedRef.current = true;
    transitionInProgress.current = false;
    
    // Set React state
    setTransitioning(false);
    
    console.log('Transition complete - flags reset, phase detection unblocked');
  }, []);

  // Full transition function that coordinates track changes and volume changes
  const startFullTransition = useCallback((phase, transitionState = null) => {
    console.log(`Starting full transition to phase: ${phase.name}`);
    if (!enabled || !phase.state) {
      console.log('Skipping transition - either disabled or no state');
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
    
    // Initialize state if needed
    if (Object.keys(currentAudioState.current).length === 0 && layers && layers.active) {
      console.log('Initializing currentAudioState from active layers');
      Object.entries(layers.active).forEach(([layer, trackId]) => {
        if (trackId) {
          currentAudioState.current[layer] = trackId;
        }
      });
    }

    // Always refresh current volume state
    if (volume && volume.layers) {
      console.log('Refreshing currentVolumeState from active volumes');
      Object.entries(volume.layers).forEach(([layer, vol]) => {
        currentVolumeState.current[layer] = vol;
      });
    }
    
    // Use the duration from session settings
    const duration = timeline.transitionDuration;
    console.log(`Starting full transition with duration: ${duration}ms`);
    
    // Step 1: Identify track changes needed
    const trackChanges = [];
    
    Object.entries(phase.state.activeAudio).forEach(([layer, targetTrackId]) => {
      // Get current track ID with fallbacks
      const currentTrackId = currentAudioState.current[layer] !== undefined ? 
        currentAudioState.current[layer] : 
        layers.active[layer] || `${layer}1`;
        
      if (currentTrackId && targetTrackId && targetTrackId !== currentTrackId) {
        console.log(`Need to crossfade ${layer}: ${currentTrackId} → ${targetTrackId}`);
        
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
      return transitions.crossfade(change.layer, change.to, duration)
        .catch(err => {
          console.error(`Error in crossfade for ${change.layer}:`, err);
          return false;
        });
    });
    
    // Step 3: Handle volume changes with smooth transitions
    const volumeChanges = [];

    // Create a snapshot of the current volume state BEFORE we make any changes
    const volumeSnapshot = transitionState?.originalVolumes || {};

    // If we don't have originalVolumes from transitionState, create a snapshot
    if (!transitionState?.originalVolumes) {
      Object.entries(volume.layers).forEach(([layer, vol]) => {
        volumeSnapshot[layer] = vol;
      });
    }
    
    Object.entries(phase.state.volumes).forEach(([layer, targetVolume]) => {
      // Use our snapshot for current volume
      const currentVolume = volumeSnapshot[layer] !== undefined ? volumeSnapshot[layer] : 0;
      
      // Only transition if there's a meaningful difference
      if (Math.abs(targetVolume - currentVolume) > 0.02) {
        volumeChanges.push({
          layer,
          from: currentVolume,
          to: targetVolume
        });
      }
    });
    
    // If we have volume changes to make, set up the transition timer
    if (volumeChanges.length > 0) {
      const updateInterval = 50; // ms between volume updates
      const totalSteps = Math.max(1, duration / updateInterval);
      let currentStep = 0;
  
      volumeTransitionTimer.current = setInterval(() => {
        currentStep++;
        
        // Update all volume changes with eased transitions
        volumeChanges.forEach(change => {
          // Calculate progress with easing for smoother transitions
          const progress = currentStep / totalSteps;
          const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI); // Cosine easing
          const newVolume = change.from + (change.to - change.from) * easedProgress;
          
          // Update volume (but not if this layer is in an active crossfade)
          const isInCrossfade = trackChanges.some(tc => tc.layer === change.layer);
          if (!isInCrossfade) {
            volume.setLayer(change.layer, newVolume, { immediate: false });
          }
        });
        
        // Check if volume transition is complete
        if (currentStep >= totalSteps) {
          // Clear the interval
          clearInterval(volumeTransitionTimer.current);
          volumeTransitionTimer.current = null;
          
          // Make sure target volumes are exactly set
          volumeChanges.forEach(change => {
            const isInCrossfade = trackChanges.some(tc => tc.layer === change.layer);
            if (!isInCrossfade) {
              volume.setLayer(change.layer, change.to, { immediate: false });
            }
          });
          
          // If no track changes, finish transition now
          if (trackChanges.length === 0) {
            finishTransition(phase);
          }
        }
      }, updateInterval);
    }
    
    // Step 4: If we have track changes, wait for them to complete
    if (trackChanges.length > 0) {
      // Set a failsafe timeout
      transitionTimeoutRef.current = setTimeout(() => {
        console.log("Failsafe: Forcing transition completion after timeout");
        if (volumeTransitionTimer.current) {
          clearInterval(volumeTransitionTimer.current);
          volumeTransitionTimer.current = null;
        }
        finishTransition(phase);
      }, duration + 2000); // Duration plus buffer
      
      // Wait for all crossfades to complete
      Promise.all(crossfadePromises)
        .then(() => {
          console.log(`All track crossfades complete`);
          
          if (transitionTimeoutRef.current) {
            clearTimeout(transitionTimeoutRef.current);
            transitionTimeoutRef.current = null;
          }
          
          // Check if volume transition is still running
          if (volumeTransitionTimer.current) {
            // Let it finish naturally
            console.log('Volume transition still in progress, letting it complete');
          } else {
            // Volume transition already done
            finishTransition(phase);
          }
        });
    } else if (volumeChanges.length === 0) {
      // No track changes or volume changes needed
      console.log('No transitions needed for this phase');
      finishTransition(phase);
    }
  }, [enabled, timeline, layers, volume, transitions, setTransitionState, finishTransition]);

  // Track play state changes to detect stops and restarts
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
  useEffect(() => {
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
  
 
// This effect handles updating time and progress bar 
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
    let phaseCheckInterval;
    
    if (enabled && playback.isPlaying && localTimelineIsPlaying) {
      phaseCheckInterval = setInterval(() => {
        // Skip phase checks during active transitions
        if (transitioning || !transitionCompletedRef.current || transitionInProgress.current) {
          return;
        }
        
        // Refresh volume state reference to ensure it's current
        refreshVolumeStateReference();

        const time = playback.getTime();
        const progressPercent = Math.min(100, (time / timeline.duration) * 100);
        
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
        if (newActivePhase && newActivePhase.id !== lastActivePhaseId.current) {
          console.log(`New active phase detected: ${newActivePhase.name} at ${progressPercent.toFixed(1)}%`);
          
          // First save current state BEFORE changing anything
          const originalVolumeState = { ...volume.layers };
          const originalAudioState = { ...layers.active };
          
          // Update phase tracking
          lastActivePhaseId.current = newActivePhase.id;
          setActivePhase(newActivePhase.id);
          
          if (newActivePhase.state) {
            console.log(`Starting transition to ${newActivePhase.name} phase`);
            
            // Store the original state we captured
            currentVolumeState.current = originalVolumeState;
            currentAudioState.current = originalAudioState;
            
            // Begin transition
            transitionCompletedRef.current = false;
            transitionInProgress.current = true;
            
            // Pass a copy of the original state to the transition function
            const transitionState = {
              originalVolumes: {...originalVolumeState},
              phaseData: newActivePhase
            };
            
            // Start full transition with state information
            startFullTransition(newActivePhase, transitionState);
          }
        }
      }, 250);
    }
    
    return () => {
      if (phaseCheckInterval) {
        clearInterval(phaseCheckInterval);
      }
    };
  }, [enabled, playback.isPlaying, localTimelineIsPlaying, transitioning, phases, volume.layers, layers.active, 
      timeline.duration, refreshVolumeStateReference, startFullTransition, playback]);
  
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
    setLocalTimelineIsPlaying(false);
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
  <button 
    className={`${styles.controlButton} ${editMode ? styles.active : ''}`}
    onClick={toggleEditMode}
  >
    {editMode ? 'Done' : 'Edit Timeline'}
  </button>
  
  {/* Add timeline playback controls */}
  <button 
    className={`${styles.controlButton} ${timelineIsPlaying ? styles.active : ''}`}
    onClick={toggleTimelinePlayback}
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