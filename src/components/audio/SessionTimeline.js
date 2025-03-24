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
  transitionDuration = 10000,
  onDurationChange 
}) => {
  const { 
    getSessionTime, 
    isPlaying,
    activeAudio,
    volumes,
    crossfadeTo,
    setVolume,
    LAYERS
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
  
  // Handle enabling/disabling timeline
  useEffect(() => {
    // If disabling, clear any active transitions
    if (!enabled && transitionTimer.current) {
      clearInterval(transitionTimer.current);
      transitionTimer.current = null;
      setTransitioning(false);
      console.log('Timeline disabled - transitions cleared');
    }
    
    // Reset the starting phase application flag when timeline is disabled
    if (!enabled) {
      startingPhaseApplied.current = false;
    }
  }, [enabled]);
  
  // Apply pre-onset phase immediately when play is pressed (no crossfade)
  useEffect(() => {
    if (enabled && isPlaying && !startingPhaseApplied.current) {
      const preOnsetPhase = phases.find(p => p.id === 'pre-onset');
      if (preOnsetPhase && preOnsetPhase.state) {
        console.log('Applying pre-onset phase state IMMEDIATELY at start of playback');
        
        // Apply volumes directly without interpolation
        Object.entries(preOnsetPhase.state.volumes).forEach(([layer, volume]) => {
          setVolume(layer, volume);
          console.log(`Applied immediate volume for ${layer}: ${Math.round(volume * 100)}%`);
        });
        
        // Set audio tracks directly (no crossfade)
        // Note: This actually has to use crossfadeTo function for the audio engine to work,
        // but we'll use a very short duration (500ms) to make it nearly immediate
        Object.entries(preOnsetPhase.state.activeAudio).forEach(([layer, trackId]) => {
          if (trackId !== activeAudio[layer]) {
            crossfadeTo(layer, trackId, 500); // Very short crossfade
            console.log(`Applied quick track change for ${layer} to track: ${trackId}`);
          }
        });
        
        // Mark as applied so we don't do it again this session
        startingPhaseApplied.current = true;
        lastActivePhaseId.current = 'pre-onset';
        setActivePhase('pre-onset');
      }
    }
    
    // Reset the flag when playback stops
    if (!isPlaying) {
      startingPhaseApplied.current = false;
      lastActivePhaseId.current = null;
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
        
        // Only check for phase transitions if timeline is enabled and not already transitioning
        if (enabled && !transitioning && !isDraggingMarker.current) {
          // Find the currently active phase based on progress
          // We need to use a different approach here to fix the issue with multiple transitions
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
            console.log(`New active phase detected: ${newActivePhase.name} at ${progressPercent.toFixed(1)}% (time: ${formatTime(time)})`);
            
            // Update active phase tracking
            lastActivePhaseId.current = newActivePhase.id;
            setActivePhase(newActivePhase.id);
            
            // Start transition to the new phase (if it has state and is not pre-onset)
            if (newActivePhase.state && newActivePhase.id !== 'pre-onset') {
              console.log(`Starting transition to ${newActivePhase.name} phase`);
              startTransition(newActivePhase);
            }
          }
        }
      }, 250); // Check more frequently for more precision
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [enabled, isPlaying, getSessionTime, sessionDuration, phases, transitioning]);
  
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
  
  // Handle phase marker drag
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
    
    console.log(`Moving phase "${phases[index].name}" to position: ${clampedPosition.toFixed(1)}%`);
    
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
    
    // Generate a summary for debugging
    const volumeSummary = Object.entries(volumes)
      .map(([layer, vol]) => `${layer}: ${Math.round(vol * 100)}%`)
      .join(', ');
    
    const trackSummary = Object.entries(activeAudio)
      .map(([layer, track]) => `${layer}: ${track}`)
      .join(', ');
    
    console.log(`Captured state for ${phases[index].name}:`);
    console.log(`Volumes: ${volumeSummary}`);
    console.log(`Tracks: ${trackSummary}`);
    
    setPhases(prev => {
      const newPhases = [...prev];
      newPhases[index].state = state;
      return newPhases;
    });
  };
  
  // Start transition to a phase's state
  const startTransition = (phase) => {
    // Skip if already transitioning or timeline is disabled
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
    
    // Use the configured transition duration (passed as prop)
    const actualTransitionDuration = transitionDuration;
    const updateInterval = 50; // 50ms updates
    const totalSteps = actualTransitionDuration / updateInterval;
    let currentStep = 0;
    
    // Calculate volume changes per step for each layer
    const volumeChanges = {};
    Object.entries(phase.state.volumes).forEach(([layer, targetVolume]) => {
      const currentVolume = volumes[layer];
      volumeChanges[layer] = (targetVolume - currentVolume) / totalSteps;
      
      console.log(`${layer} volume transition: ${Math.round(currentVolume * 100)}% → ${Math.round(targetVolume * 100)}%`);
    });
    
    // Start crossfades for any track changes
    Object.entries(phase.state.activeAudio).forEach(([layer, trackId]) => {
      if (trackId !== activeAudio[layer]) {
        crossfadeTo(layer, trackId, actualTransitionDuration);
        console.log(`Starting crossfade for ${layer}: ${activeAudio[layer]} → ${trackId}`);
      }
    });
    
    console.log(`Starting transition to ${phase.name} phase, duration: ${actualTransitionDuration}ms`);
    
    // Set up transition interval
    transitionTimer.current = setInterval(() => {
      currentStep++;
      
      // Update volumes gradually
      Object.entries(volumeChanges).forEach(([layer, change]) => {
        const currentVolume = volumes[layer];
        const targetVolume = phase.state.volumes[layer];
        
        // Calculate new volume with easing
        const progress = currentStep / totalSteps;
        const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI); // Sinusoidal easing
        const newVolume = currentVolume + (targetVolume - currentVolume) * easedProgress;
        
        // Apply volume change
        setVolume(layer, newVolume);
      });
      
      // Log progress occasionally
      if (currentStep % 40 === 0) {
        console.log(`Transition progress: ${Math.round((currentStep / totalSteps) * 100)}%`);
      }
      
      // End transition when complete
      if (currentStep >= totalSteps) {
        clearInterval(transitionTimer.current);
        transitionTimer.current = null;
        setTransitioning(false);
        
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
            onClick={() => editMode && setSelectedPhase(index)}
            onStateCapture={editMode ? () => capturePhaseState(index) : null}
            storedState={phase.state}
          />
        ))}
      </div>
      
      <div className={styles.timelineLabels}>
        <span>Start</span>
        <span>End</span>
      </div>
      
      {editMode && (
        <div className={styles.editInstructions}>
          Click on a phase marker to select it, then click "Capture State" to save the current player settings to that phase.
          Drag any marker (except Pre-Onset) to adjust when that phase begins.
        </div>
      )}
    </div>
  );
};

export default SessionTimeline;