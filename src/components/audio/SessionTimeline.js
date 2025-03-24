// src/components/audio/SessionTimeline.js
import React, { useState, useEffect, useRef } from 'react';
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
  transitionDuration = 4000, // Default 4 seconds as requested
  onDurationChange 
}) => {
  const { 
    getSessionTime, 
    isPlaying,
    activeAudio,
    volumes,
    crossfadeTo,
    setVolume,
    LAYERS,
    resetTimelineEventIndex
  } = useAudio();
  
  const [currentTime, setCurrentTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [phases, setPhases] = useState(DEFAULT_PHASES);
  const [activePhase, setActivePhase] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  
  const timelineRef = useRef(null);
  const transitionTimer = useRef(null);
  const startingPhaseApplied = useRef(false);
  const lastActivePhaseId = useRef(null);
  const isDraggingMarker = useRef(false);
  const wasPlayingBeforeStop = useRef(false);
  const transitionCompletedRef = useRef(true);
  const currentVolumeState = useRef({});
  const currentAudioState = useRef({});
  
  // Handle enabling/disabling timeline
  useEffect(() => {
    // If disabling, clear any active transitions
    if (!enabled && transitionTimer.current) {
      clearInterval(transitionTimer.current);
      transitionTimer.current = null;
      setTransitioning(false);
    }
    
    // Reset the starting phase application flag when timeline is disabled
    if (!enabled) {
      startingPhaseApplied.current = false;
    }
  }, [enabled]);
  
  // Clear selection when edit mode changes
  useEffect(() => {
    if (!editMode) {
      // Always clear selected phase when exiting edit mode
      setSelectedPhase(null);
    }
  }, [editMode]);
  
  // Track play state changes to detect stops and restarts
  useEffect(() => {
    if (isPlaying) {
      // If we were stopped and now starting again
      if (!wasPlayingBeforeStop.current) {
        // Reset timeline state for a clean restart
        resetTimeline();
      }
      wasPlayingBeforeStop.current = true;
    } else {
      // Keep track of the fact we were playing and now stopped
      wasPlayingBeforeStop.current = false;
    }
  }, [isPlaying]);
  
  // Reset all timeline state for a clean restart
  const resetTimeline = () => {
    // Reset progress display
    setProgress(0);
    setCurrentTime(0);
    
    // Reset phase tracking
    startingPhaseApplied.current = false;
    lastActivePhaseId.current = null;
    setActivePhase(null);
    
    // Reset any ongoing transitions
    if (transitionTimer.current) {
      clearInterval(transitionTimer.current);
      transitionTimer.current = null;
    }
    setTransitioning(false);
    transitionCompletedRef.current = true;
    
    // Tell the audio context to reset its timeline tracking
    if (resetTimelineEventIndex) {
      resetTimelineEventIndex();
    }
  };
  
  // Apply pre-onset phase immediately when play is pressed
  useEffect(() => {
    if (enabled && isPlaying && !startingPhaseApplied.current) {
      const preOnsetPhase = phases.find(p => p.id === 'pre-onset');
      if (preOnsetPhase && preOnsetPhase.state) {
        console.log('Applying pre-onset phase state immediately at start of playback');
        
        // Apply volumes directly without interpolation
        Object.entries(preOnsetPhase.state.volumes).forEach(([layer, volume]) => {
          setVolume(layer, volume);
        });
        
        // Set audio tracks directly (with minimal crossfade)
        Object.entries(preOnsetPhase.state.activeAudio).forEach(([layer, trackId]) => {
          if (trackId !== activeAudio[layer]) {
            crossfadeTo(layer, trackId, 500); // Very short crossfade
          }
        });
        
        // Store the current state for future transitions
        currentVolumeState.current = { ...preOnsetPhase.state.volumes };
        currentAudioState.current = { ...preOnsetPhase.state.activeAudio };
        
        // Mark as applied so we don't do it again this session
        startingPhaseApplied.current = true;
        lastActivePhaseId.current = 'pre-onset';
        setActivePhase('pre-onset');
      }
    }
    
    // Reset the flag when playback stops
    if (!isPlaying) {
      startingPhaseApplied.current = false;
    }
  }, [enabled, isPlaying, phases, setVolume, crossfadeTo, activeAudio]);
  
  // Update time and progress
  useEffect(() => {
    let interval;
    
    if (enabled && isPlaying) {
      interval = setInterval(() => {
        const time = getSessionTime();
        setCurrentTime(time);
        
        // Calculate progress as percentage of total duration
        const progressPercent = Math.min(100, (time / sessionDuration) * 100);
        setProgress(progressPercent);
        
        // Only check for phase transitions if timeline is enabled, not already transitioning, 
        // and no marker is being dragged
        if (enabled && !transitioning && !isDraggingMarker.current && transitionCompletedRef.current) {
          // Find the currently active phase based on progress
          let newActivePhase = null;
          
          // Sort phases by position (highest to lowest) to ensure we get the correct one
          const sortedPhases = [...phases].sort((a, b) => b.position - a.position);
          
          // Find the first phase whose position is less than or equal to current progress
          for (const phase of sortedPhases) {
            if (progressPercent >= phase.position) {
              newActivePhase = phase;
              break;
            }
          }
          
          if (newActivePhase && newActivePhase.id !== lastActivePhaseId.current) {
            console.log(`New active phase detected: ${newActivePhase.name} at ${progressPercent.toFixed(1)}%`);
            
            // Update active phase tracking
            lastActivePhaseId.current = newActivePhase.id;
            setActivePhase(newActivePhase.id);
            
            // Start transition to the new phase (if it has state)
            if (newActivePhase.state) {
              console.log(`Starting transition to ${newActivePhase.name} phase`);
              
              // IMPORTANT: Capture current state before starting transition
              // This ensures we transition from current values, not saved values
              currentVolumeState.current = { ...volumes };
              currentAudioState.current = { ...activeAudio };
              
              transitionCompletedRef.current = false; // Mark that we're about to start a transition
              startTransition(newActivePhase);
            }
          }
        }
      }, 250); // Check more frequently for more precision
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [enabled, isPlaying, getSessionTime, sessionDuration, phases, transitioning, volumes, activeAudio]);
  
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
  
  // Handle phase marker drag with improved responsiveness
  const handlePhaseMarkerDrag = (index, newPosition) => {
    // Skip if this is the pre-onset marker (locked)
    if (phases[index].locked) {
      console.log('Cannot move Pre-Onset marker as it is locked to position 0');
      return;
    }
    
    // Set the dragging flag to prevent transition checks during dragging
    isDraggingMarker.current = true;
    
    // Don't allow dragging beyond adjacent markers
    const lowerBound = index > 0 ? phases[index - 1].position + 1 : 0;
    const upperBound = index < phases.length - 1 ? phases[index + 1].position - 1 : 100;
    
    const clampedPosition = Math.max(lowerBound, Math.min(upperBound, newPosition));
    
    setPhases(prev => {
      const newPhases = [...prev];
      newPhases[index].position = clampedPosition;
      return newPhases;
    });
    
    // Reset dragging flag after a short delay
    setTimeout(() => {
      isDraggingMarker.current = false;
    }, 100);
  };
  
  // Capture current player state for a phase
  const capturePhaseState = (index) => {
    // Create a state object with current volumes and active tracks
    const state = {
      volumes: { ...volumes },
      activeAudio: { ...activeAudio }
    };
    
    setPhases(prev => {
      const newPhases = [...prev];
      newPhases[index].state = state;
      return newPhases;
    });
    
    // If we're capturing the pre-onset phase and it's currently active,
    // also update the current state references
    if (phases[index].id === 'pre-onset' && lastActivePhaseId.current === 'pre-onset') {
      currentVolumeState.current = { ...volumes };
      currentAudioState.current = { ...activeAudio };
    }
  };
  
  // Start transition to a phase's state
  const startTransition = (phase) => {
    // Skip if already transitioning, timeline is disabled, or phase has no state
    if (!enabled || !phase.state || transitioning) {
      console.log('Skipping transition - either disabled, no state, or already transitioning');
      return;
    }
    
    // Clear any existing transition timer
    if (transitionTimer.current) {
      clearInterval(transitionTimer.current);
      transitionTimer.current = null;
    }
    
    setTransitioning(true);
    
    // Use the configured transition duration
    const actualTransitionDuration = transitionDuration;
    const updateInterval = 50; // 50ms updates
    const totalSteps = actualTransitionDuration / updateInterval;
    let currentStep = 0;
    
    // Start crossfades for each layer independently, using the current state (not saved)
    Object.entries(phase.state.activeAudio).forEach(([layer, targetTrackId]) => {
      const currentTrackId = currentAudioState.current[layer] || activeAudio[layer];
      if (targetTrackId !== currentTrackId) {
        console.log(`Starting crossfade for ${layer}: ${currentTrackId} → ${targetTrackId}`);
        crossfadeTo(layer, targetTrackId, actualTransitionDuration);
      }
    });
    
    // Set up transition interval for volume changes
    transitionTimer.current = setInterval(() => {
      currentStep++;
      
      // Update volumes gradually for each layer independently
      // IMPORTANT: Use currentVolumeState as the starting point, not volumes
      Object.entries(phase.state.volumes).forEach(([layer, targetVolume]) => {
        const startVolume = currentVolumeState.current[layer] !== undefined 
          ? currentVolumeState.current[layer] 
          : volumes[layer];
        
        // Calculate new volume with easing
        const progress = currentStep / totalSteps;
        const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI); // Sinusoidal easing
        const newVolume = startVolume + (targetVolume - startVolume) * easedProgress;
        
        // Apply volume change
        setVolume(layer, newVolume);
      });
      
      // End transition when complete
      if (currentStep >= totalSteps) {
        clearInterval(transitionTimer.current);
        transitionTimer.current = null;
        
        // Update current state references after transition complete
        currentVolumeState.current = { ...phase.state.volumes };
        currentAudioState.current = { ...phase.state.activeAudio };
        
        setTransitioning(false);
        transitionCompletedRef.current = true; // Mark transition as complete
        
        // Make sure we're at the exact target values
        Object.entries(phase.state.volumes).forEach(([layer, targetVolume]) => {
          setVolume(layer, targetVolume);
        });
        
        console.log(`Transition to ${phase.name} phase complete`);
      }
    }, updateInterval);
  };
  
  // If timeline is disabled, render nothing
  if (!enabled) return null;
  
  return (
    <div className={styles.timelineContainer}>
      <div className={styles.timelineHeader}>
        <h2 className={styles.timelineTitle}>Session Timeline</h2>
        
        <div className={styles.timelineControls}>
          <button 
            className={`${styles.controlButton} ${editMode ? styles.active : ''}`}
            onClick={() => setEditMode(!editMode)}
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
      
      <div className={styles.timeInfo}>
        <span>{formatTime(currentTime)}</span>
        <span className={styles.remainingTime}>-{formatTimeRemaining()}</span>
      </div>
      
      {/* Timeline with no click-to-move functionality */}
      <div 
        className={styles.timeline} 
        ref={timelineRef}
      >
        <div 
          className={styles.progressBar} 
          style={{ width: `${progress}%` }}
        />
        
        {/* Phase markers */}
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
            onClick={(e) => {
              // If in edit mode, toggle selection of this marker
              if (editMode) {
                e.stopPropagation();
                setSelectedPhase(selectedPhase === index ? null : index);
              }
            }}
            onStateCapture={editMode ? () => capturePhaseState(index) : null}
            storedState={phase.state}
            editMode={editMode}
          />
        ))}
      </div>
      
      <div className={styles.timelineLabels}>
        <span>Start</span>
        <span>End</span>
      </div>
      
      {editMode && (
        <div className={styles.editInstructions}>
          Click on a phase marker to select it, then click "Capture State" to save the current audio settings.
          Drag markers (except Pre-Onset) to adjust when each phase begins.
        </div>
      )}
    </div>
  );
};

export default SessionTimeline;