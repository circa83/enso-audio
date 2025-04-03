// src/components/audio/SessionTimeline.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudio } from '../../hooks/useAudio'; // Using our refactored hook
import PhaseMarker from './PhaseMarker';
import styles from '../../styles/components/SessionTimeline.module.css';

const DEFAULT_PHASES = [
  { id: 'pre-onset', name: 'Pre-Onset', position: 0, color: '#4A6670', state: null, locked: true },
  { id: 'onset', name: 'Onset & Buildup', position: 20, color: '#6E7A8A', state: null, locked: false },
  { id: 'peak', name: 'Peak', position: 40, color: '#8A8A8A', state: null, locked: false },
  { id: 'return', name: 'Return & Integration', position: 60, color: '#A98467', state: null, locked: false }
];

const SessionTimeline = ({ 
  enabled = true, 
  onDurationChange 
}) => {
  // Use our new hook with grouped functionality
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
  
  // Initialize and register with timeline service - FIXED version
  useEffect(() => {
    console.log("SessionTimeline mounting check");
    
    // Only run the setup operations once on first mount
    if (initialMount.current) {
      console.log("SessionTimeline - initial setup");
      
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

      // IMPORTANT: Only reset timeline if playback is not active
      // This prevents resetting when the component mounts during playback
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
    };
  }, []);
  
  // Add a separate effect to update phases when they change
useEffect(() => {
  if (!initialMount.current && timeline.updatePhases) {
    timeline.updatePhases(phases);
  }
}, [phases]);

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
      setTransitioning(false);
    }
    
    // if (!enabled) {
    //   startingPhaseApplied.current = false;
    // }
  }, [enabled]);
  
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
    
    if (!enabled && volumeTransitionTimer.current) {
      clearInterval(volumeTransitionTimer.current);
      volumeTransitionTimer.current = null;
    }
    setTransitioning(false);
    transitionCompletedRef.current = true;
    transitionInProgress.current = false;
    
    if (timeline.reset) {
      console.log("Calling timeline.reset()");
      timeline.reset();
    }
    // startingPhaseApplied.current = false;
}, [timeline, playback.isPlaying, enabled]);

  // Track play state changes to detect stops and restarts
  useEffect(() => {
    if (playback.isPlaying) {
      if (!wasPlayingBeforeStop.current && componentHasRendered.current) {
        resetTimeline();
     
        // Ensure current audio state is synchronized with active audio
     if (layers && layers.active) {
      console.log('Synchronizing currentAudioState with active audio');
      Object.entries(layers.active).forEach(([layer, trackId]) => {
        if (trackId) {
          currentAudioState.current[layer] = trackId;
          console.log(`Set currentAudioState for ${layer} to ${trackId}`);
        }
      });
    }
  }
  wasPlayingBeforeStop.current = true;
} else {
  wasPlayingBeforeStop.current = false;
  // Reset the starting phase flag when playback stops
  startingPhaseApplied.current = false;
}
}, [playback.isPlaying, resetTimeline, layers]);

  // Watch for active crossfades to update transition state
  useEffect(() => {
    const hasActiveCrossfades = Object.keys(transitions.active).length > 0;
    
    // If any layer is in transition, mark as transitioning
    if (hasActiveCrossfades) {
      transitionInProgress.current = true;
      setTransitioning(true);
    } else if (transitionInProgress.current) {
      // If was transitioning but now no crossfades are active
      transitionInProgress.current = false;
      
      // Short delay before allowing new transitions
      setTimeout(() => {
        setTransitioning(false);
        transitionCompletedRef.current = true;
      }, 200);
    }
  }, [transitions.active]);
  
 
  
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

  // Apply pre-onset phase IMMEDIATELY when play is pressed (no transition)
  useEffect(() => {
     // Skip the effect on first render to prevent state changes when the container is opened
  if (isFirstRender.current) {
    isFirstRender.current = false;
    return;
  }
    if (enabled && playback.isPlaying && !startingPhaseApplied.current && wasPlayingBeforeStop.current === false) {
      const preOnsetPhase = phases.find(p => p.id === 'pre-onset');
      
      if (Object.keys(currentAudioState.current).length === 0 && layers && layers.active) {
        console.log('Initializing currentAudioState from active layers');
        Object.entries(layers.active).forEach(([layer, trackId]) => {
          if (trackId) {
            currentAudioState.current[layer] = trackId;
          }
        });
      
      if (timelineRef.current) { // This ensures the DOM is fully rendered
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
      // This is the key check to prevent unwanted state application when container is opened
      if (playback.isPlaying) {
      // Apply the state
      console.log('Applying pre-onset phase immediately at start of playback (no transition)');
      
      // Immediately set volumes
      Object.entries(stateToApply.volumes).forEach(([layer, vol]) => {
        volume.setLayer(layer, vol, { immediate: true });
      });
      
      // Handle track changes immediately (with a nearly instant 50ms crossfade)
      Object.entries(stateToApply.activeAudio).forEach(([layer, trackId]) => {
        if (trackId !== layers.active[layer]) {
          console.log(`Immediate switch to ${trackId} for ${layer}`);
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
 } }, [enabled, playback.isPlaying, phases, volume, transitions, layers]);
  
  // Update time and progress bar - runs continuously during playback
  useEffect(() => {
    let interval;
    
    if (enabled && playback.isPlaying) {
      // Add debug logging
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
        // Log progress occasionally to verify it's updating
        if (Math.floor(progressPercent) % 10 === 0) {
         // console.log(`Timeline progress: ${progressPercent.toFixed(1)}%`);
        }
        setProgress(progressPercent);
      }, 50); // Update more frequently for smoother animation
    } else if (!playback.isPlaying) {
      // Explicitly reset when not playing
      console.log("Playback not active, setting timeline to initial state");
    }
    
    return () => {
      if (interval) {
        console.log("Cleaning up SessionTimeline progress tracking");
        clearInterval(interval);
      }
    };
  }, [enabled, playback.isPlaying, timeline.duration]);
  
  // Phase detection logic - separate from animation updates
  useEffect(() => {
    let phaseCheckInterval;
    
    if (enabled && playback.isPlaying) {
      phaseCheckInterval = setInterval(() => {
        // Skip phase checks during active transitions
        if (transitioning || !transitionCompletedRef.current || transitionInProgress.current) {
          return;
        }
        
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
          
          lastActivePhaseId.current = newActivePhase.id;
          setActivePhase(newActivePhase.id);
          
          if (newActivePhase.state) {
            console.log(`Starting transition to ${newActivePhase.name} phase`);
            
            // Store current state before transition
            currentVolumeState.current = { ...volume.layers };
            currentAudioState.current = { ...layers.active };
            
            // Begin transition
            transitionCompletedRef.current = false;
            transitionInProgress.current = true;
            
            // Start full transition
            startFullTransition(newActivePhase);
          }
        }
      }, 250);
    }
    
    return () => {
      if (phaseCheckInterval) clearInterval(phaseCheckInterval);
    };
  }, [enabled, playback, phases, volume.layers, layers.active, timeline.duration, transitioning]);
  
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
  
  // Full transition function that coordinates track changes and volume changes
  const startFullTransition = useCallback((phase) => {
    if (!enabled || !phase.state) {
      console.log('Skipping transition - either disabled or no state');
      return;
    }
    
    // Clean up any existing volume transition timer
    if (volumeTransitionTimer.current) {
      clearInterval(volumeTransitionTimer.current);
      volumeTransitionTimer.current = null;
    }
    
    // Signal that transition is starting
    setTransitioning(true);
    
    // Use the duration from session settings
    const duration = timeline.transitionDuration;
    console.log(`Starting full transition with duration: ${duration}ms`);
    
    // Step 1: Identify track changes needed
    const trackChanges = [];
    
    Object.entries(phase.state.activeAudio).forEach(([layer, targetTrackId]) => {
      const currentTrackId = currentAudioState.current[layer] !== undefined ? 
    currentAudioState.current[layer] : 
    layers.active[layer];
        // Additional check to ensure we have a valid currentTrackId
    if (!currentTrackId) {
      console.log(`No current track ID for ${layer}, will use immediate switch`);
    }
      if (targetTrackId !== currentTrackId) {
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
    
    // Step 3: Handle volume changes with smooth transitions over the same duration
    const volumeChanges = [];

    Object.entries(phase.state.volumes).forEach(([layer, targetVolume]) => {
      const currentVolume = currentVolumeState.current[layer] !== undefined 
        ? currentVolumeState.current[layer] 
        : (volume.layers[layer] !== undefined ? volume.layers[layer] : 0);
      
      // Only transition if there's a meaningful difference
      if (Math.abs(targetVolume - currentVolume) > 0.02) {
        volumeChanges.push({
          layer,
          from: currentVolume,
          to: targetVolume
        });
      } else {
        console.log(`Skipping volume transition for ${layer} - change too small (${currentVolume.toFixed(2)} → ${targetVolume.toFixed(2)})`);
      }
    });
    
    // If we have volume changes to make, set up the transition timer
    if (volumeChanges.length > 0) {
      const updateInterval = 50; // ms between volume updates
      const totalSteps = Math.max(1, duration / updateInterval);
      let currentStep = 0;

      // Log the volume transition plan
  console.log(`Setting up volume transitions with ${totalSteps} steps over ${duration}ms`);
  console.log('Volume changes:', volumeChanges.map(c => `${c.layer}: ${c.from.toFixed(2)} → ${c.to.toFixed(2)}`));
      
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
              // Use the immediate flag to ensure volume changes are applied directly
        // This ensures the UI slider moves with the transition
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
              volume.setLayer(change.layer, change.to, { immediate: true });
              console.log(`Volume transition complete for ${change.layer}: ${change.to.toFixed(2)}`);
            }
          });
          
          // Update state only if all track crossfades are done
          if (trackChanges.length === 0) {
            // Only mark transition complete if no track changes are happening
            finishTransition(phase);
          }
        }
      }, updateInterval);
    }
    
    // Step 4: If we have track changes, wait for them to complete
    if (trackChanges.length > 0) {
      // Wait for all crossfades to complete
      Promise.all(crossfadePromises)
        .then(() => {
          console.log(`All track crossfades complete`);
          
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
  }, [enabled, timeline, layers, volume, transitions]);
  
  // Helper function to finish the transition and update state
  const finishTransition = useCallback((phase) => {
    // Update current state references
    currentVolumeState.current = { ...phase.state.volumes };
    currentAudioState.current = { ...phase.state.activeAudio };
    
    // Clear transition flags after a small delay to avoid race conditions
    setTimeout(() => {
      setTransitioning(false);
      transitionCompletedRef.current = true;
      transitionInProgress.current = false;
      
      console.log(`Transition to ${phase.name} phase complete`);
    }, 200);
  }, []);
  
  // Handle click away from markers - deselect the current marker
  const handleBackgroundClick = useCallback((e) => {
    // Make sure we're clicking on the timeline background, not a marker
    if (e.target === timelineRef.current) {
      deselectAllMarkers();
    }
  }, [deselectAllMarkers, timelineRef]);
  
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
};
export default SessionTimeline;