// src/components/audio/SessionTimeline.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudio } from '../../contexts/StreamingAudioContext';
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
  sessionDuration = 60 * 1000,
  transitionDuration = 4000, // Default 4s transition time
  onDurationChange 
}) => {
  const { 
    getSessionTime, 
    isPlaying,
    activeAudio,
    volumes,
    crossfadeTo, // Using the actual function name from your context
    setVolume,
    LAYERS,
    resetTimelineEventIndex,
    crossfadeProgress,
    activeCrossfades,
    // New functions for preset integration
    updateTimelinePhases,
    registerPresetStateProvider
  } = useAudio();
  
  const [currentTime, setCurrentTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [phases, setPhases] = useState(DEFAULT_PHASES);
  const [activePhase, setActivePhase] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  
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
  
  // Register the state provider for presets
  useEffect(() => {
    if (registerPresetStateProvider) {
      // This function will be called by the AudioContext when saving a preset
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
          sessionDuration: sessionDuration,
          transitionDuration: transitionDuration
        };
      };

      // Register the function
      registerPresetStateProvider('timeline', getTimelineState);
      
      // Clean up when component unmounts
      return () => registerPresetStateProvider('timeline', null);
    }
  }, [registerPresetStateProvider, phases, sessionDuration, transitionDuration]);

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
    
    if (!enabled) {
      startingPhaseApplied.current = false;
    }
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
  
  // Track play state changes to detect stops and restarts
  useEffect(() => {
    if (isPlaying) {
      if (!wasPlayingBeforeStop.current) {
        resetTimeline();
      }
      wasPlayingBeforeStop.current = true;
    } else {
      wasPlayingBeforeStop.current = false;
      // Reset the starting phase flag when playback stops
      // This ensures that when playback is restarted, the pre-onset phase will be applied again
      startingPhaseApplied.current = false;
    }
  }, [isPlaying]);

  // Watch for active crossfades to update our transition state
  useEffect(() => {
    const hasActiveCrossfades = Object.values(activeCrossfades).some(cf => cf !== null);
    
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
  }, [activeCrossfades]);
  
  // Reset all timeline state for a clean restart
  const resetTimeline = () => {
    setProgress(0);
    setCurrentTime(0);
    
    lastActivePhaseId.current = null;
    setActivePhase(null);
    
    if (volumeTransitionTimer.current) {
      clearInterval(volumeTransitionTimer.current);
      volumeTransitionTimer.current = null;
    }
    setTransitioning(false);
    transitionCompletedRef.current = true;
    transitionInProgress.current = false;
    
    if (resetTimelineEventIndex) {
      resetTimelineEventIndex();
    }
  };
  
  // Define default pre-onset phase state - used if no saved state exists
  const DEFAULT_PRE_ONSET_STATE = {
    volumes: {
      [LAYERS.DRONE]: 0.25,
      [LAYERS.MELODY]: 0.0,
      [LAYERS.RHYTHM]: 0.0,
      [LAYERS.NATURE]: 0.0
    },
    // We'll use whatever tracks are currently active
    activeAudio: {}
  };

  // Apply pre-onset phase IMMEDIATELY when play is pressed (no transition)
  useEffect(() => {
    if (enabled && isPlaying && !startingPhaseApplied.current) {
      const preOnsetPhase = phases.find(p => p.id === 'pre-onset');
      
      // Determine the state to apply - either the saved state or the default
      const stateToApply = preOnsetPhase?.state || DEFAULT_PRE_ONSET_STATE;
      
      // If using default state, fill in current active audio
      if (!preOnsetPhase?.state) {
        Object.keys(LAYERS).forEach(layer => {
          stateToApply.activeAudio[layer.toLowerCase()] = activeAudio[layer.toLowerCase()];
        });
        console.log('Using DEFAULT pre-onset state (no saved state found)', stateToApply);
      } else {
        console.log('Applying SAVED pre-onset phase state', stateToApply);
      }
      
      // Apply the state
      console.log('Applying pre-onset phase immediately at start of playback (no transition)');
      
      // Immediately set volumes
      Object.entries(stateToApply.volumes).forEach(([layer, volume]) => {
        setVolume(layer, volume);
      });
      
      // Handle track changes immediately (with a nearly instant 50ms crossfade)
      // We use a very short crossfade (50ms) instead of 0ms to avoid potential pops/clicks
      Object.entries(stateToApply.activeAudio).forEach(([layer, trackId]) => {
        if (trackId !== activeAudio[layer]) {
          console.log(`Immediate switch to ${trackId} for ${layer}`);
          crossfadeTo(layer, trackId, 50); // 50ms is practically instant but avoids audio pops
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
  }, [enabled, isPlaying, phases, setVolume, crossfadeTo, activeAudio]);
  
  // SEPARATED: Update time and progress bar - this runs continuously during playback
  // regardless of transitions
  useEffect(() => {
    let interval;
    
    if (enabled && isPlaying) {
      interval = setInterval(() => {
        const time = getSessionTime();
        setCurrentTime(time);
        
        const progressPercent = Math.min(100, (time / sessionDuration) * 100);
        setProgress(progressPercent);
      }, 50); // Update more frequently for smoother animation
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [enabled, isPlaying, getSessionTime, sessionDuration]);
  
  // SEPARATED: Phase detection logic - this can be paused during transitions
  useEffect(() => {
    let phaseCheckInterval;
    
    if (enabled && isPlaying) {
      phaseCheckInterval = setInterval(() => {
        // Skip phase checks during active transitions
        if (transitioning || !transitionCompletedRef.current || transitionInProgress.current) {
          return;
        }
        
        const time = getSessionTime();
        const progressPercent = Math.min(100, (time / sessionDuration) * 100);
        
        let newActivePhase = null;
        
        // Find the current phase based on progress
        const sortedPhases = [...phases].sort((a, b) => b.position - a.position);
        
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
            currentVolumeState.current = { ...volumes };
            currentAudioState.current = { ...activeAudio };
            
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
  }, [enabled, isPlaying, phases, volumes, activeAudio, getSessionTime, sessionDuration, transitioning]);
  
  // Format time display (HH:MM:SS)
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Format estimated time remaining
  const formatTimeRemaining = () => {
    const remainingMs = sessionDuration - currentTime;
    if (remainingMs <= 0) return '00:00:00';
    return formatTime(remainingMs);
  };
  
  // Handle phase marker position change
  const handlePhaseMarkerDrag = (index, newPosition) => {
    if (phases[index].locked) {
      console.log('Cannot move Pre-Onset marker as it is locked to position 0');
      return;
    }
    
    const lowerBound = index > 0 ? phases[index - 1].position + 1 : 0;
    const upperBound = index < phases.length - 1 ? phases[index + 1].position - 1 : 100;
    
    const clampedPosition = Math.max(lowerBound, Math.min(upperBound, newPosition));
    
    setPhases(prev => {
      const newPhases = [...prev];
      newPhases[index].position = clampedPosition;
      return newPhases;
    });
    
    // Notify the context system that phases have been updated (for preset saving)
    if (updateTimelinePhases) {
      const updatedPhases = [...phases];
      updatedPhases[index].position = clampedPosition;
      updateTimelinePhases(updatedPhases);
    }
  };
  
  // Deselect all markers - explicitly defined function
  const deselectAllMarkers = () => {
    if (selectedPhase !== null) {
      console.log('Deselecting all markers');
      setSelectedPhase(null);
    }
  };
  
  // Toggle edit mode
  const toggleEditMode = () => {
    // If currently in edit mode and about to exit, deselect all markers first
    if (editMode) {
      deselectAllMarkers();
    }
    
    // Toggle edit mode state
    setEditMode(!editMode);
  };

  // Select a marker - handles both edit mode and view mode differently
  const handleSelectMarker = (index) => {
    // If the same marker is already selected
    if (selectedPhase === index) {
      // In edit mode, don't deselect (keep selected for capture)
      if (!editMode) {
        // In view mode, toggle selection
        setSelectedPhase(null);
        deselectAllMarkers();
      }
    } else {
      // Different marker selected, or no marker was selected before
      setSelectedPhase(index);
    }
  };
  
  // Deselect a specific marker
  const handleDeselectMarker = (index) => {
    if (selectedPhase === index) {
      setSelectedPhase(null);
    }
  };
  
  // Capture current player state for a phase
  const capturePhaseState = (index) => {
    const state = {
      volumes: { ...volumes },
      activeAudio: { ...activeAudio }
    };
    
    setPhases(prev => {
      const newPhases = [...prev];
      newPhases[index].state = state;
      return newPhases;
    });
    
    // Notify the audio context of updated phases
    // This is important for preset saving
    if (updateTimelinePhases) {
      const updatedPhases = [...phases];
      updatedPhases[index].state = state;
      updateTimelinePhases(updatedPhases);
    }
    
    if (phases[index].id === 'pre-onset' && lastActivePhaseId.current === 'pre-onset') {
      currentVolumeState.current = { ...volumes };
      currentAudioState.current = { ...activeAudio };
    }
    
    // After capturing state, deselect all markers
    deselectAllMarkers();
  };
  
  // IMPROVED: Full transition function that coordinates track changes and volume changes
  const startFullTransition = (phase) => {
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
    const duration = transitionDuration;
    console.log(`Starting full transition with duration: ${duration}ms`);
    
    // Step 1: Identify track changes needed
    const trackChanges = [];
    
    Object.entries(phase.state.activeAudio).forEach(([layer, targetTrackId]) => {
      const currentTrackId = currentAudioState.current[layer] || activeAudio[layer];
      
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
    // This ensures they all finish at the same time
    const crossfadePromises = trackChanges.map(change => {
      return crossfadeTo(change.layer, change.to, duration)
        .catch(err => {
          console.error(`Error in crossfade for ${change.layer}:`, err);
          return false;
        });
    });
    
    // Step 3: Handle volume changes with smooth transitions over the same duration
    // We'll set up a timer for volume transitions that operates in parallel with track changes
    
    // Track which layers need volume changes
    const volumeChanges = [];
    
    Object.entries(phase.state.volumes).forEach(([layer, targetVolume]) => {
      const currentVolume = currentVolumeState.current[layer] !== undefined 
        ? currentVolumeState.current[layer] 
        : volumes[layer];
      
      // Only transition if there's a meaningful difference
      if (Math.abs(targetVolume - currentVolume) > 0.01) {
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
      const totalSteps = duration / updateInterval;
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
          // as the crossfade will handle its own volume transition
          const isInCrossfade = trackChanges.some(tc => tc.layer === change.layer);
          if (!isInCrossfade) {
            setVolume(change.layer, newVolume);
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
              setVolume(change.layer, change.to);
            }
          });
          
          // Update state only if all track crossfades are done
          // Otherwise the crossfade completion will handle this
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
  };
  
  // Helper function to finish the transition and update state
  const finishTransition = (phase) => {
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
  };
  
  // Handle click away from markers - deselect the current marker
  const handleBackgroundClick = (e) => {
    // Make sure we're clicking on the timeline background, not a marker
    if (e.target === timelineRef.current) {
      deselectAllMarkers();
    }
  };
  
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
        
        {phases.map((phase, index) => (
          <PhaseMarker
            key={phase.id}
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
            sessionDuration={sessionDuration}
            hasStateCaptured={!!phase.state}
          />
        ))}
      </div>
      
      {/* Moved time info below the timeline */}
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