// src/components/audio/SessionTimeline.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudio } from '../../hooks/useAudio';
import PhaseMarker from './PhaseMarker';
import SessionSettings from './SessionSettings'
import timelinestyles from '../../styles/components/SessionTimeline.module.css';
import settingsStyles from '../../styles/components/SessionSettings.module.css';

const DEFAULT_PHASES = [
  { id: 'pre-onset', name: 'Pre-Onset', position: 0, color: '#4A6670', state: null, locked: true },
  { id: 'onset', name: 'Onset & Buildup', position: 20, color: '#6E7A8A', state: null, locked: false },
  { id: 'peak', name: 'Peak', position: 40, color: '#8A8A8A', state: null, locked: false },
  { id: 'return', name: 'Return & Integration', position: 60, color: '#A98467', state: null, locked: false }
];

const SessionTimeline = React.forwardRef(({ 
  onDurationChange,
  transitionDuration,
  onTransitionDurationChange, 
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
  const initialMount = useRef(true);
  const transitionTimeoutRef = useRef(null);
  const queuedPhaseRef = useRef(null);
  const progressTimerRef = useRef(null);

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

 
 // Set Transition State
const setTransitionState = useCallback((isTransitioning, force = false) => {
  // Skip unnecessary state updates
  if (!force && isTransitioning === transitioning && 
      isTransitioning === transitionInProgress.current && 
      !isTransitioning === transitionCompletedRef.current) {
    console.log(`[SessionTimeline] Transition state already ${isTransitioning ? 'active' : 'inactive'}, skipping update`);
    return;
  }
  
  console.log(`[SessionTimeline] Setting transition state: ${isTransitioning ? 'START' : 'END'}`);
  
  // Update refs first
  transitionInProgress.current = isTransitioning;
  transitionCompletedRef.current = !isTransitioning;
  
  // Batch the state update to reduce re-renders
  // Only update React state if it's different
  if (transitioning !== isTransitioning) {
    setTransitioning(isTransitioning);
  }
}, [transitioning]);

  //=======INITIALIZE========
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

      applyPreOnsetPhase();

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


  //Check if volume object is available
  useEffect(() => {
    console.log("[SESSIONTIMELINE] Volume object in SessionTimeline:", {
      hasLayers: volume && !!volume.layers,
      methods: volume ? Object.keys(volume) : 'No volume object',
      fadeVolume: typeof volume.fadeVolume === 'function' ? 'Available' : 'Not available'
    });
    console.log("[SESSIONTIMELINE] Volume object volumes:", volume && volume.layers);
  }, [volume]);


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
 


// Apply Pre-Onset Phase 
const applyPreOnsetPhase = useCallback(() => {
  console.log("[SessionTimeline: applyPreOnsetPhase] Applying pre-onset phase state immediately");
  
  // Find the pre-onset phase
  const preOnsetPhase = phases.find(p => p.id === 'pre-onset');
  
  if (preOnsetPhase && preOnsetPhase.state) {
    console.log("[SessionTimeline: applyPreOnsetPhase] Found pre-onset phase with saved state");
    
    // Immediately set volumes without transitions
    if (preOnsetPhase.state.volumes) {
      Object.entries(preOnsetPhase.state.volumes).forEach(([layer, vol]) => {
        console.log(`[SessionTimeline: applyPreOnsetPhase] Setting ${layer} volume to ${vol}`);
        volume.setLayer(layer, vol, { immediate: true });
      });
    }
    
    // Immediately switch to pre-onset tracks without crossfade
    if (preOnsetPhase.state.activeAudio) {
      Object.entries(preOnsetPhase.state.activeAudio).forEach(([layer, trackId]) => {
        if (trackId !== layers.active[layer]) {
          console.log(`[SessionTimeline: applyPreOnsetPhase] Switching ${layer} to track ${trackId}`);
          // Use a minimal 50ms transition to prevent audio pops but still be immediate
          transitions.crossfade(layer, trackId, 50);
        }
      });
    }
    
    // Set pre-onset as the active phase
    lastActivePhaseId.current = 'pre-onset';
    setActivePhase('pre-onset');
  } else {
    console.log("[SessionTimeline: applyPreOnsetPhase] No pre-onset phase state found, using defaults");
    
    // Apply default state for layers if no pre-onset phase state exists
Object.values(layers.TYPES).forEach(layer => {
  const layerKey = layer.toLowerCase();
  // Set default volumes for each layer
  let defaultVolume = 0;
  
  // Assign different default volumes based on layer type
  switch(layerKey) {
    case 'drone':
      defaultVolume = 0.10; // Keep your existing drone default
      break;
    case 'melody':
      defaultVolume = 0.15; // New default for melody
      break;
    case 'rhythm':
      defaultVolume = 0.10; // New default for rhythm
      break;
    case 'nature':
      defaultVolume = 0.20; // New default for nature
      break;
    default:
      defaultVolume = 0; // Fallback
  }
  
  volume.setLayer(layerKey, defaultVolume, { immediate: true });
});
  }
}, [phases, volume, layers, transitions]);


  //Toggle timeline playback
  const toggleTimelinePlayback = useCallback(() => {
    // Only allow starting timeline if audio is playing
    if (!playback.isPlaying && !timelineIsPlaying) {
      console.log("[SessionTimeline: toggleTimelinePlayback] Cannot start timeline when audio is not playing");
      return;
    }
    
    console.log("[SessionTimeline: toggleTimelinePlayback] Timeline toggle button clicked, current state:", timelineIsPlaying);
    
    // Toggle the local timeline state
    const newTimelineState = !timelineIsPlaying;
    console.log("[SessionTimeline: toggleTimelinePlayback] Setting new timeline state to:", newTimelineState);
    
    setTimelineIsPlaying(newTimelineState);
    setLocalTimelineIsPlaying(newTimelineState);
  
    if (newTimelineState) {
      // We're starting/resuming playback
      if (currentTime > 0) {
        // If we have elapsed time, RESUME from that position
        console.log("[SessionTimeline: toggleTimelinePlayback] Resuming timeline from current position:", currentTime);
        if (timeline.resumeTimeline) {
          console.log("[SessionTimeline: toggleTimelinePlayback] Calling timeline.resumeTimeline()");
          timeline.resumeTimeline();
        } else {
          // Fallback if resumeTimeline doesn't exist yet
          console.log("[SessionTimeline: toggleTimelinePlayback] No resumeTimeline method available, using startTimeline with reset:false");
          timeline.startTimeline({ reset: false });
        }
      } else {
        // If no elapsed time, START from beginning
        console.log("[SessionTimeline: toggleTimelinePlayback] Starting timeline from beginning");
        applyPreOnsetPhase();

        if (timeline.startTimeline) {
          console.log("[SessionTimeline: toggleTimelinePlayback] Calling timeline.startTimeline()");
          timeline.startTimeline({ reset: true });
        }
      }
    } else {
      // We're pausing the timeline
      console.log("[SessionTimeline: toggleTimelinePlayback] Pausing timeline progression");
      if (timeline.pauseTimeline) {
        console.log("[SessionTimeline: toggleTimelinePlayback] Calling timeline.pauseTimeline()");
        timeline.pauseTimeline();
      } else {
        // Fallback to stopTimeline if pauseTimeline doesn't exist
        console.log("[SessionTimeline: toggleTimelinePlayback] No pauseTimeline method, using stopTimeline as fallback");
        timeline.stopTimeline();
      }
      
      // Cancel active transitions
      if (volumeTransitionTimer.current) {
        clearInterval(volumeTransitionTimer.current);
        volumeTransitionTimer.current = null;
      }
      
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
      
      setTransitionState(false, true); // Force update transition state
    }
  }, [timelineIsPlaying, applyPreOnsetPhase, playback.isPlaying, timeline, setTransitionState, currentTime]);



// Restart Timeline
const handleRestartTimeline = useCallback(() => {
  console.log("[SessionTimeline: handleRestartTimeline] Restarting timeline immediately to pre-onset phase");
  
  // First, stop the timeline if it's playing
  if (timelineIsPlaying) {
    if (timeline.stopTimeline) {
      console.log("[SessionTimeline: handleRestartTimeline] Stopping timeline progression");
      timeline.stopTimeline();
    }
    setTimelineIsPlaying(false);
    setLocalTimelineIsPlaying(false);
  }
  
  // Reset progress tracking
  setProgress(0);
  setCurrentTime(0);
  
  // Reset phase tracking
  lastActivePhaseId.current = null;
  setActivePhase(null);
  
  // Cancel any active transitions
  if (volumeTransitionTimer.current) {
    clearInterval(volumeTransitionTimer.current);
    volumeTransitionTimer.current = null;
  }
  
  if (transitionTimeoutRef.current) {
    clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = null;
  }
  
  setTransitionState(false, true); // Force update transition state
  
  // Find the pre-onset phase
  const preOnsetPhase = phases.find(p => p.id === 'pre-onset');
  if (preOnsetPhase && preOnsetPhase.state) {
    console.log("[SessionTimeline: handleRestartTimeline] Applying pre-onset phase immediately");
    
    // Immediately set volumes without transitions
    if (preOnsetPhase.state.volumes) {
      Object.entries(preOnsetPhase.state.volumes).forEach(([layer, vol]) => {
        volume.setLayer(layer, vol, { immediate: true });
      });
    }
    
    // // Immediately switch to pre-onset tracks without crossfade
    // if (preOnsetPhase.state.activeAudio) {
    //   Object.entries(preOnsetPhase.state.activeAudio).forEach(([layer, trackId]) => {
    //     if (trackId !== layers.active[layer]) {
    //       // Use a minimal 50ms transition to prevent audio pops but still be immediate
    //       transitions.crossfade(layer, trackId, 50);
    //     }
    //   });
    // }
    applyPreOnsetPhase();
    // Set pre-onset as the active phase
    lastActivePhaseId.current = 'pre-onset';
    setActivePhase('pre-onset');
  } else {
    console.log("[SessionTimeline: handleRestartTimeline] No pre-onset phase state found, using defaults");
  }
  //   // Apply default state for layers if no pre-onset phase state exists
  //   Object.values(layers.TYPES).forEach(layer => {
  //     const layerKey = layer.toLowerCase();
  //     // Set drone to 25%, all others to 0
  //     const defaultVolume = layerKey === 'drone' ? 0.25 : 0;
  //     volume.setLayer(layerKey, defaultVolume, { immediate: true });
  //   });
  // }
  
  // Reset timeline in the service
  if (timeline.reset) {
    console.log("[SessionTimeline: handleRestartTimeline] Resetting timeline service");
    timeline.reset();
  }
  
  if (timeline.seekToPercent) {
    console.log("[SessionTimeline: handleRestartTimeline] Seeking to beginning");
    timeline.seekToPercent(0);
  }
  
  return true;
}, [
  timelineIsPlaying, 
  timeline, 
  phases, 
  volume, 
  layers, 
  transitions, 
  setTransitionState,
  applyPreOnsetPhase
]);

  // Refresh Volume State Reference function
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
    console.log('[SessionTimeline: refreshVolumeStateReference] Refreshed volume state with ACTUAL current values:', actualCurrentVolumes);
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
    console.log('[SessionTimeline: refreshVolumeStateReference] Refreshed audio state with ACTUAL current tracks:', actualCurrentAudio);
  }
}, [volume, layers]);
  
//the Finish Transition function
const finishTransition = useCallback((phase) => {
  console.log('[SessionTimeline: finishTransition] Finishing transition to phase:', phase.name);
  
  // NOW is when we update the current state references to the target values
  // This ensures we only update after the transition is complete
  
  // Update volume state reference
  if (phase.state?.volumes) {
    currentVolumeState.current = {};
    Object.entries(phase.state.volumes).forEach(([layer, vol]) => {
      currentVolumeState.current[layer] = vol;
    });
    console.log('[SessionTimeline: finishTransition] Updated volume state reference to target values:', currentVolumeState.current);
  }
  
  // Update audio state reference
  if (phase.state?.activeAudio) {
    currentAudioState.current = {};
    Object.entries(phase.state.activeAudio).forEach(([layer, trackId]) => {
      currentAudioState.current[layer] = trackId;
    });
    console.log('[SessionTimeline: finishTransition] Updated audio state reference to target values:', currentAudioState.current);
  }
  
  // Reset transition flags
  transitionCompletedRef.current = true;
  transitionInProgress.current = false;
  
  // Set React state
  setTransitioning(false);
  
  console.log('[SessionTimeline: finishTransition] Transition complete - flags reset, phase detection unblocked');
}, []);

 //=======START FULL TRANSITION========
// Replace the existing startFullTransition function
const startFullTransition = useCallback((phase) => {
  console.log(`[startFullTransition] Starting transition to phase: ${phase.name}`);
  
  // Skip transition if already in progress or no state available
  if (!phase.state || transitionInProgress.current) {
    console.log('[startFullTransition] Skipping transition - disabled, no state, or already in progress');
    return;
  }
  
  // Signal that transition is starting
  setTransitionState(true);
  
  // Get the transition duration from settings
  const duration = timeline.transitionDuration;
  console.log(`[startFullTransition] Using transition duration: ${duration}ms`);
  
  // Handle volume transitions using fadeVolume
  if (phase.state.volumes) {
    // Create a list of fade promises to track completion
    const fadePromises = [];
    
    Object.entries(phase.state.volumes).forEach(([layer, targetVolume]) => {
      // Get current volume from the volume controller
      const currentVolume = volume.layers[layer] || 0;
      
      console.log(`[startFullTransition] Volume transition for ${layer}: ${currentVolume} → ${targetVolume}`);
      
      try {
        // Use fadeVolume for smooth transition with UI updates
        const fadePromise = volume.fadeVolume(layer, targetVolume, duration);
        fadePromises.push(fadePromise);
      } catch (error) {
        console.error(`[startFullTransition] Error starting fade for ${layer}:`, error);
      }
    });
    
    // Wait for all fades to complete
    Promise.all(fadePromises)
      .then(() => {
        console.log(`[startFullTransition] All volume transitions completed for phase: ${phase.name}`);
      })
      .catch(err => {
        console.error(`[startFullTransition] Error during volume transitions:`, err);
      });
  }
  
  // Handle track changes if needed
  if (phase.state.activeAudio) {
    Object.entries(phase.state.activeAudio).forEach(([layer, trackId]) => {
      if (trackId !== layers.active[layer]) {
        console.log(`[startFullTransition] Track change for ${layer}: ${layers.active[layer]} → ${trackId}`);
        try {
          transitions.crossfade(layer, trackId, duration);
        } catch (error) {
          console.error(`[startFullTransition] Error crossfading for ${layer}:`, error);
        }
      }
    });
  }
  
  // Set a timeout to mark transition as complete
  if (transitionTimeoutRef.current) {
    clearTimeout(transitionTimeoutRef.current);
  }
  
  transitionTimeoutRef.current = setTimeout(() => {
    console.log(`[startFullTransition] Transition to ${phase.name} complete`);
    setTransitionState(false);
    transitionTimeoutRef.current = null;
  }, duration + 100); // Add a small buffer
}, [ timeline, volume, layers, transitions, setTransitionState]);



// Watch for active crossfades to update transition state
useEffect(() => {
  const hasActiveCrossfades = Object.keys(transitions.active).length > 0;
  
  console.log(`[SessionTimeline: crossfadeWatchEffect] Active crossfades: ${Object.keys(transitions.active).join(', ') || 'none'}`);
  
  // If any layer is in transition, mark as transitioning
  if (hasActiveCrossfades) {
    transitionInProgress.current = true;
    setTransitionState(true);
  } else if (transitionInProgress.current) {
    // If was transitioning but now no crossfades are active
    console.log('[SessionTimeline: crossfadeWatchEffect] All crossfades completed');
    
    // Short delay before allowing new transitions
    setTimeout(() => {
      setTransitionState(false);
      transitionCompletedRef.current = true;
    }, 200);
  }
}, [transitions.active, setTransitionState]);

//=======Progress Tracking Effect=======

// Keep tracking during transitions
useEffect(() => {
  // If we enter a transition state, make sure progress tracking is running
  if (transitionInProgress.current && playback.isPlaying && localTimelineIsPlaying) {
    console.log("[SessionTimeline] Ensuring progress tracking continues during transition");
    
    // Create a dedicated timer just for transition periods
    const transitionProgressTimer = setInterval(() => {
      const time = playback.getTime();
      const progressPercent = Math.min(100, (time / timeline.duration) * 100);
      
      // Force progress updates even during transitions
      setCurrentTime(time);
      setProgress(progressPercent);
    }, 50);
    
    return () => clearInterval(transitionProgressTimer);
  }
}, [transitionInProgress.current,  playback.isPlaying, localTimelineIsPlaying, timeline.duration, playback]);

//=======Phase detection effect=======

useEffect(() => {
  // Skip if disabled or not playing
  if ( !playback.isPlaying || !localTimelineIsPlaying) {
    console.log("[SessionTimeline] Progress tracking not starting - disabled or not playing");
    return;
  }
  
  console.log("[SessionTimeline] Starting stable progress tracking");
  
  // Use a ref to track if we already have an active interval
  // This prevents creating multiple intervals during re-renders
  if (progressTimerRef.current) {
    console.log("[SessionTimeline] Reusing existing progress timer");
    return; // Already have a timer, don't create another
  }
  
  // Create a stable timer that will persist across re-renders
  progressTimerRef.current = setInterval(() => {
    // Get current time directly from playback
    const currentTime = playback.getTime();
    const progressPercent = Math.min(100, (currentTime / timeline.duration) * 100);
    
    // Use a function form of setState to avoid stale closures
    setCurrentTime(time => currentTime);
    setProgress(prog => progressPercent);
  }, 50);
  
  // Clear timer only when really stopping playback
  return () => {
    if (progressTimerRef.current) {
      console.log("[SessionTimeline] Cleaning up progress timer");
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };
}, [
  // Minimal dependencies to avoid recreation
  playback.isPlaying,
  localTimelineIsPlaying,
  timeline.duration
  // Explicitly remove playback from dependencies
]);

// -------Phase change event listener-------
// Listen for phase change events from the TimelineEngine
useEffect(() => {
  // Listen for phase change events from the TimelineEngine
  const handlePhaseChangeEvent = (event) => {
    
    const { phaseId, phaseData } = event.detail;
    console.log(`[SessionTimeline: handlePhaseChangeEvent] Received phase change event phaseData: ${phaseData}`);
    console.log(`[SessionTimeline: handlePhaseChangeEvent] Received phase change event phaseId: ${phaseId}`);
    
    // Always update the activePhase state, even during transitions
    // This ensures the UI shows the correct phase marker
    if (phaseId !== lastActivePhaseId.current) {
      lastActivePhaseId.current = phaseId;
      setActivePhase(phaseId);
      
      // Find the phase object in our local phases
      const phase = phases.find(p => p.id === phaseId);
      
      // Start transition for the new phase, but delay if another is in progress
      if (phase && phase.state) {
        if (!transitionInProgress.current) {
          // Start transition immediately if none is in progress
          console.log(`[SessionTimeline: handlePhaseChangeEvent] Starting transition to phase: ${phase.name}`);
          startFullTransition(phase);
        } else {
          // Queue this transition to start after the current one finishes
          console.log(`[SessionTimeline: handlePhaseChangeEvent] Transition already in progress, queuing phase change to: ${phase.name}`);
          
          // Store the phase to transition to after current completes
          // You'd need to add a queuedPhaseRef for this
          queuedPhaseRef.current = phase;
        }
      }
    }
  };
  
  // Add event listener for phase changes
  window.addEventListener('timeline-phase-changed', handlePhaseChangeEvent);
  
  // Clean up
  return () => {
    window.removeEventListener('timeline-phase-changed', handlePhaseChangeEvent);
  };
}, [ phases, startFullTransition]);


// Cleanup transitions when playback stops
useEffect(() => {
  // Force reset all transition state when playback stops
  if (!playback.isPlaying) {
    console.log("[SessionTimeline: playbackStateEffect] Playback stopped, forcing transition state reset");
    
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
    console.log('[SessionTimeline: handlePhaseMarkerDrag] Cannot move Pre-Onset marker as it is locked to position 0');
    return;
  }
  
  const lowerBound = index > 0 ? phases[index - 1].position + 1 : 0;
  const upperBound = index < phases.length - 1 ? phases[index + 1].position - 1 : 100;
  
  const clampedPosition = Math.max(lowerBound, Math.min(upperBound, newPosition));
  
  console.log(`[SessionTimeline: handlePhaseMarkerDrag] Moving phase marker ${phases[index].id} to position ${clampedPosition}`);
  
  const newPhases = [...phases];
  newPhases[index].position = clampedPosition;
  setPhases(newPhases);
  
  // Notify the timeline service that phases have been updated
  if (timeline.updatePhases) {
    console.log('[SessionTimeline: handlePhaseMarkerDrag] Updating phases in TimelineEngine');
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
  console.log(`[SessionTimeline: capturePhaseState] Capturing current state for phase: ${phases[index].name}`);
  
  // Refresh volume state reference first to ensure we have the latest state
  refreshVolumeStateReference();
  
  const state = {
    volumes: { ...volume.layers },
    activeAudio: { ...layers.active }
  };
  
  console.log('[SessionTimeline: capturePhaseState] Captured state:', state);
  
  const newPhases = [...phases];
  newPhases[index].state = state;
  setPhases(newPhases);
  
  // Notify the timeline service of updated phases
  if (timeline.updatePhases) {
    console.log('[SessionTimeline: capturePhaseState] Updating phases in TimelineEngine');
    timeline.updatePhases(newPhases);
  }
  
  // If capturing state for the current phase, update our references
  if (phases[index].id === lastActivePhaseId.current) {
    console.log('[SessionTimeline: capturePhaseState] Updating current state references as this is the active phase');
    currentVolumeState.current = { ...volume.layers };
    currentAudioState.current = { ...layers.active };
  }
  
  // After capturing state, deselect all markers
  console.log('[SessionTimeline: capturePhaseState] Deselecting markers after capture');
  deselectAllMarkers();
}, [phases, volume.layers, layers.active, timeline, deselectAllMarkers, refreshVolumeStateReference]);


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
 },
 restartTimeline: () => handleRestartTimeline()
}));
  


  return (
    <div className={timelinestyles.timelineContainer}>
      <div className={timelinestyles.timelineHeader}>
        <h2 className={timelinestyles.timelineTitle}>Session Timeline</h2>
        
        <div className={timelinestyles.timelineControls}>
          <button 
            className={`${timelinestyles.controlButton} ${editMode ? timelinestyles.active : ''}`}
            onClick={toggleEditMode}
          >
            {editMode ? 'Done' : 'Edit Timeline'}
          </button>
        </div>
      </div>
      
      {activePhase && (
        <div className={timelinestyles.phaseIndicator}>
          Current Phase: <span className={timelinestyles.activePhase}>
            {phases.find(p => p.id === activePhase)?.name}
          </span>
          {transitioning && <span className={timelinestyles.transitioningLabel}> (Transitioning)</span>}
        </div>
      )}
      
      <div 
        className={timelinestyles.timelineWrapper}
      >
        <div 
          className={timelinestyles.timeline} 
          ref={timelineRef}
          onClick={handleBackgroundClick}
        >
          <div 
            className={timelinestyles.progressBar} 
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
      <div className={timelinestyles.timelineControls}>
  
  
  {/* Add timeline playback controls */}
 {/* Add debug info to the button */}
<button 
  className={`${timelinestyles.controlButton} ${timelineIsPlaying ? timelinestyles.active : ''}`}
  onClick={() => {
    console.log("Timeline button clicked!");
    toggleTimelinePlayback();
  }}
  disabled={!playback.isPlaying}
>
  {timelineIsPlaying ? 'Pause Timeline' : 'Start Timeline'}
</button>
<button 
    className={timelinestyles.controlButton}
    onClick={handleRestartTimeline}
    disabled={!playback.isPlaying}
  >
    Restart
  </button>
</div>
      {/* Time info below the timeline */}
      <div className={timelinestyles.timeInfo}>
        <span>{formatTime(currentTime)}</span>
        <span className={timelinestyles.remainingTime}>-{formatTimeRemaining()}</span>
      </div>
      
      <div className={timelinestyles.timelineLabels}>
        <span>Start</span>
        <span>End</span>
      </div>
      
      {editMode && (
        <>
          <div className={timelinestyles.editInstructions}>
            Press and hold a marker to drag it. Tap "Capture State" to save current audio layers and volumes.
          </div>
          
          {/* Add SessionSettings here when in edit mode */}
          <SessionSettings 
            sessionDuration={timeline.duration}
            transitionDuration={transitionDuration}
            onDurationChange={onDurationChange}
            onTransitionDurationChange={onTransitionDurationChange}
            className={settingsStyles.timelineSettings}
          />
        </>
      )}
    </div>
  );
});

export default React.memo(SessionTimeline);