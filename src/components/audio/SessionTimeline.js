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
  transitionDuration = 4000,
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
    if (!enabled && transitionTimer.current) {
      clearInterval(transitionTimer.current);
      transitionTimer.current = null;
      setTransitioning(false);
    }
    
    if (!enabled) {
      startingPhaseApplied.current = false;
    }
  }, [enabled]);
  
  // Clear selection when edit mode changes
  useEffect(() => {
    if (!editMode) {
      setSelectedPhase(null);
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
    }
  }, [isPlaying]);
  
  // Reset all timeline state for a clean restart
  const resetTimeline = () => {
    setProgress(0);
    setCurrentTime(0);
    
    startingPhaseApplied.current = false;
    lastActivePhaseId.current = null;
    setActivePhase(null);
    
    if (transitionTimer.current) {
      clearInterval(transitionTimer.current);
      transitionTimer.current = null;
    }
    setTransitioning(false);
    transitionCompletedRef.current = true;
    
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
        
        Object.entries(preOnsetPhase.state.volumes).forEach(([layer, volume]) => {
          setVolume(layer, volume);
        });
        
        Object.entries(preOnsetPhase.state.activeAudio).forEach(([layer, trackId]) => {
          if (trackId !== activeAudio[layer]) {
            crossfadeTo(layer, trackId, 500);
          }
        });
        
        currentVolumeState.current = { ...preOnsetPhase.state.volumes };
        currentAudioState.current = { ...preOnsetPhase.state.activeAudio };
        
        startingPhaseApplied.current = true;
        lastActivePhaseId.current = 'pre-onset';
        setActivePhase('pre-onset');
      }
    }
    
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
        
        const progressPercent = Math.min(100, (time / sessionDuration) * 100);
        setProgress(progressPercent);
        
        if (enabled && !transitioning && !isDraggingMarker.current && transitionCompletedRef.current) {
          let newActivePhase = null;
          
          const sortedPhases = [...phases].sort((a, b) => b.position - a.position);
          
          for (const phase of sortedPhases) {
            if (progressPercent >= phase.position) {
              newActivePhase = phase;
              break;
            }
          }
          
          if (newActivePhase && newActivePhase.id !== lastActivePhaseId.current) {
            console.log(`New active phase detected: ${newActivePhase.name} at ${progressPercent.toFixed(1)}%`);
            
            lastActivePhaseId.current = newActivePhase.id;
            setActivePhase(newActivePhase.id);
            
            if (newActivePhase.state) {
              console.log(`Starting transition to ${newActivePhase.name} phase`);
              
              currentVolumeState.current = { ...volumes };
              currentAudioState.current = { ...activeAudio };
              
              transitionCompletedRef.current = false;
              startTransition(newActivePhase);
            }
          }
        }
      }, 250);
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
  
  // Handle phase marker drag
  const handlePhaseMarkerDrag = (index, newPosition) => {
    if (phases[index].locked) {
      console.log('Cannot move Pre-Onset marker as it is locked to position 0');
      return;
    }
    
    isDraggingMarker.current = true;
    
    const lowerBound = index > 0 ? phases[index - 1].position + 1 : 0;
    const upperBound = index < phases.length - 1 ? phases[index + 1].position - 1 : 100;
    
    const clampedPosition = Math.max(lowerBound, Math.min(upperBound, newPosition));
    
    setPhases(prev => {
      const newPhases = [...prev];
      newPhases[index].position = clampedPosition;
      return newPhases;
    });
    
    setTimeout(() => {
      isDraggingMarker.current = false;
    }, 100);
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
    
    if (phases[index].id === 'pre-onset' && lastActivePhaseId.current === 'pre-onset') {
      currentVolumeState.current = { ...volumes };
      currentAudioState.current = { ...activeAudio };
    }
  };
  
  // Start transition to a phase's state
  const startTransition = (phase) => {
    if (!enabled || !phase.state || transitioning) {
      console.log('Skipping transition - either disabled, no state, or already transitioning');
      return;
    }
    
    if (transitionTimer.current) {
      clearInterval(transitionTimer.current);
      transitionTimer.current = null;
    }
    
    setTransitioning(true);
    
    const actualTransitionDuration = transitionDuration;
    const updateInterval = 50;
    const totalSteps = actualTransitionDuration / updateInterval;
    let currentStep = 0;
    
    Object.entries(phase.state.activeAudio).forEach(([layer, targetTrackId]) => {
      const currentTrackId = currentAudioState.current[layer] || activeAudio[layer];
      if (targetTrackId !== currentTrackId) {
        console.log(`Starting crossfade for ${layer}: ${currentTrackId} → ${targetTrackId}`);
        crossfadeTo(layer, targetTrackId, actualTransitionDuration);
      }
    });
    
    transitionTimer.current = setInterval(() => {
      currentStep++;
      
      Object.entries(phase.state.volumes).forEach(([layer, targetVolume]) => {
        const startVolume = currentVolumeState.current[layer] !== undefined 
          ? currentVolumeState.current[layer] 
          : volumes[layer];
        
        const progress = currentStep / totalSteps;
        const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);
        const newVolume = startVolume + (targetVolume - startVolume) * easedProgress;
        
        setVolume(layer, newVolume);
      });
      
      if (currentStep >= totalSteps) {
        clearInterval(transitionTimer.current);
        transitionTimer.current = null;
        
        currentVolumeState.current = { ...phase.state.volumes };
        currentAudioState.current = { ...phase.state.activeAudio };
        
        setTransitioning(false);
        transitionCompletedRef.current = true;
        
        Object.entries(phase.state.volumes).forEach(([layer, targetVolume]) => {
          setVolume(layer, targetVolume);
        });
        
        console.log(`Transition to ${phase.name} phase complete`);
      }
    }, updateInterval);
  };
  
  // Handle click away from markers - deselect the current marker
  const handleBackgroundClick = (e) => {
    if (editMode && selectedPhase !== null) {
      // Only deselect if we're not clicking on a marker
      if (e.target === timelineRef.current) {
        setSelectedPhase(null);
      }
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
            onClick={(e) => {
              if (editMode) {
                e.stopPropagation();
                if (selectedPhase === index) {
                  // Deselect if clicking on the already selected marker
                  setSelectedPhase(null);
                } else {
                  // Select this marker, deselecting any previously selected marker
                  setSelectedPhase(index);
                }
              }
            }}
            onStateCapture={editMode ? () => capturePhaseState(index) : null}
            storedState={phase.state}
            editMode={editMode}
            sessionDuration={sessionDuration}
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
          Click on a phase marker to select it, then click "Capture State" to save the current audio settings.
          Drag markers (except Pre-Onset) to adjust when each phase begins.
        </div>
      )}
    </div>
  );
};

export default SessionTimeline;