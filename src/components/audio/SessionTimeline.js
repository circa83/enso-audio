// src/components/audio/SessionTimeline.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudio } from '../../hooks/useAudio';
import useLogger from '../../hooks/useLogger';
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
  
  // Initialize logger for this component
  const logger = useLogger('SessionTimeline');
  
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
  const phasesApplied = useRef(false);
  
 // Set Transition State
const setTransitionState = useCallback((isTransitioning, force = false) => {
  // Skip unnecessary state updates
  if (!force && isTransitioning === transitioning && 
      isTransitioning === transitionInProgress.current && 
      !isTransitioning === transitionCompletedRef.current) {
    logger.debug(`[SessionTimeline] Transition state already ${isTransitioning ? 'active' : 'inactive'}, skipping update`);
    return;
  }
  
  logger.info(`[SessionTimeline] Setting transition state: ${isTransitioning ? 'START' : 'END'}`);
  
  // Update refs first
  transitionInProgress.current = isTransitioning;
  transitionCompletedRef.current = !isTransitioning;
  
  // Batch the state update to reduce re-renders
  // Only update React state if it's different
  if (transitioning !== isTransitioning) {
    setTransitioning(isTransitioning);
  }
}, [transitioning]);

  // Finish transition and clean up
  const finishTransition = useCallback(() => {
    logger.info("[SessionTimeline: transition] Finishing transition");
    
    // Clear transition timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    
    // Update transition state
    setTransitionState(false);
  }, [setTransitionState]);

  // Start a transition from current to target phase
  const startFullTransition = useCallback((currentPhaseData, targetPhaseData) => {
    logger.info(`[SessionTimeline: transition] Starting full transition from ${currentPhaseData.id} to ${targetPhaseData.id}`);
    
    // Capture current state
    currentVolumeState.current = { ...volume.layers };
    currentAudioState.current = { ...layers.active };
    
    // Set transition state to active
    setTransitionState(true);
    
    // Track changes needed
    let volumeChanges = false;
    let trackChanges = false;
    
    // Handle volume transitions
    if (targetPhaseData.state?.volumes) {
      const targetVolumes = targetPhaseData.state.volumes;
      
      Object.entries(targetVolumes).forEach(([layer, targetVolume]) => {
        const currentVolume = currentVolumeState.current[layer] || 0;
        
        if (currentVolume !== targetVolume) {
          volumeChanges = true;
          logger.debug(`[SessionTimeline: transition] Volume change for ${layer}: ${currentVolume} -> ${targetVolume}`);
          
          // Start the actual volume transition
          if (volume.fade) {
            volume.fade(layer, targetVolume, timeline.transitionDuration || 4000);
          }
        }
      });
    }
    
    // Handle track transitions
    if (targetPhaseData.state?.activeAudio) {
      const targetTracks = targetPhaseData.state.activeAudio;
      
      Object.entries(targetTracks).forEach(([layer, targetTrackId]) => {
        const currentTrackId = currentAudioState.current[layer];
        
        if (currentTrackId !== targetTrackId) {
          trackChanges = true;
          logger.debug(`[SessionTimeline: transition] Track change for ${layer}: ${currentTrackId || 'none'} -> ${targetTrackId}`);
          
          // Start the actual track transition
          if (transitions.crossfade) {
            transitions.crossfade(layer, targetTrackId, timeline.transitionDuration || 4000);
          }
        }
      });
    }
    
    // Set timeout to complete the transition
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    
    // Wait for transition to complete
    transitionTimeoutRef.current = setTimeout(() => {
      // Trigger transition completion
      finishTransition();
      
      // Update the active phase
      lastActivePhaseId.current = targetPhaseData.id;
      setActivePhase(targetPhaseData.id);
      
      // Process any queued phase transitions
      const queuedPhase = queuedPhaseRef.current;
      if (queuedPhase) {
        queuedPhaseRef.current = null;
        logger.info(`[SessionTimeline: transition] Processing queued phase: ${queuedPhase}`);
        setTimeout(() => {
          handlePhaseTransition(queuedPhase);
        }, 50);
      }
    }, (timeline.transitionDuration || 4000) + 100); // Add a small buffer
    
    // Log if no changes were made
    if (!volumeChanges && !trackChanges) {
      logger.info("[SessionTimeline: transition] No state changes needed for this transition");
      
      // Still need to finish the transition
      setTimeout(() => {
        finishTransition();
      }, 100);
    }
  }, [volume, layers, transitions, timeline, setTransitionState, finishTransition]);

  // Handle phase transition
  const handlePhaseTransition = useCallback((newPhaseId) => {
    // If a transition is already in progress, queue this phase
    if (transitionInProgress.current) {
      logger.info(`[SessionTimeline: transition] Transition already in progress, queueing phase: ${newPhaseId}`);
      queuedPhaseRef.current = newPhaseId;
      return;
    }
    
    logger.info(`[SessionTimeline: transition] Starting transition to phase: ${newPhaseId}`);
    
    // Find the phase by ID
    const newPhase = phases.find(p => p.id === newPhaseId);
    
    if (!newPhase) {
      logger.error(`[SessionTimeline: transition] Phase not found: ${newPhaseId}`);
      return;
    }
    
    // Find the current phase (for transitions)
    const currentPhaseId = lastActivePhaseId.current;
    const currentPhase = phases.find(p => p.id === currentPhaseId);
    
    // Only proceed if the phase has state
    if (!newPhase.state) {
      logger.warn(`[SessionTimeline: transition] Phase ${newPhaseId} has no state data, skipping transition`);
      
      // Still update the active phase display
      lastActivePhaseId.current = newPhaseId;
      setActivePhase(newPhaseId);
      return;
    }
    
    // Start the transition
    if (currentPhase && currentPhase.state) {
      // If we have a current phase with state, do a full transition
      startFullTransition(currentPhase, newPhase);
    } else {
      // If we don't have a current phase, just set the new state directly
      logger.info(`[SessionTimeline: transition] No valid current phase, applying new phase directly`);
      
      // Start transition
      setTransitionState(true);
      
      // Update active phase display immediately
      lastActivePhaseId.current = newPhaseId;
      setActivePhase(newPhaseId);
      
      // Apply volume changes immediately
      if (newPhase.state.volumes) {
        Object.entries(newPhase.state.volumes).forEach(([layer, targetVolume]) => {
          logger.debug(`[SessionTimeline: transition] Setting ${layer} volume to ${targetVolume} directly`);
          volume.setLayer(layer, targetVolume, { immediate: true });
        });
      }
      
      // Apply track changes immediately
      if (newPhase.state.activeAudio) {
        Object.entries(newPhase.state.activeAudio).forEach(([layer, trackId]) => {
          // Skip if track is already active
          if (trackId === layers.active[layer]) {
            logger.debug(`[SessionTimeline: transition] Layer ${layer} already playing track ${trackId}`);
            return;
          }
          
          logger.debug(`[SessionTimeline: transition] Switching ${layer} to track ${trackId} directly`);
          transitions.crossfade(layer, trackId, 50); // Minimal fade time
        });
      }
      
      // Finish the transition
      setTimeout(() => {
        finishTransition();
      }, 100);
    }
  }, [phases, volume, layers, transitions, startFullTransition, finishTransition, setTransitionState]);

// Apply Pre-Onset Phase 
const applyPreOnsetPhase = useCallback(() => {
  logger.info("[SessionTimeline: applyPreOnsetPhase] Applying pre-onset phase state immediately");
  
  // Find the pre-onset phase
  const preOnsetPhase = phases.find(p => p.id === 'pre-onset');
  
  if (preOnsetPhase && preOnsetPhase.state) {
    logger.info("[SessionTimeline: applyPreOnsetPhase] Found pre-onset phase with saved state");
    
   // Log state details
   if (preOnsetPhase.state.volumes) {
    logger.debug(`[SessionTimeline: applyPreOnsetPhase] Volumes: ${JSON.stringify(preOnsetPhase.state.volumes)}`);
  }
  
  if (preOnsetPhase.state.activeAudio) {
    logger.debug(`[SessionTimeline: applyPreOnsetPhase] Tracks: ${JSON.stringify(preOnsetPhase.state.activeAudio)}`);
  }
  
    // Immediately set volumes without transitions
    if (preOnsetPhase.state.volumes) {
      Object.entries(preOnsetPhase.state.volumes).forEach(([layer, vol]) => {
        logger.debug(`[SessionTimeline: applyPreOnsetPhase] Setting ${layer} volume to ${vol}`);
        volume.setLayer(layer, vol, { immediate: true });
      });
    }
    
    // Immediately switch to pre-onset tracks without crossfade
    if (preOnsetPhase.state.activeAudio) {
      Object.entries(preOnsetPhase.state.activeAudio).forEach(([layer, trackId]) => {
        if (trackId !== layers.active[layer]) {
          logger.debug(`[SessionTimeline: applyPreOnsetPhase] Switching ${layer} to track ${trackId}`);
          // Use a minimal 50ms transition to prevent audio pops but still be immediate
          transitions.crossfade(layer, trackId, 50);
        }
      });
    }
    
    // Mark that we've applied the starting phase
    startingPhaseApplied.current = true;
    lastActivePhaseId.current = 'pre-onset';
    
    // Set active phase as well
    setActivePhase('pre-onset');
  } else {
    logger.warn("[SessionTimeline: applyPreOnsetPhase] Could not find pre-onset phase with valid state");
  }
}, [phases, volume, transitions, layers]);

  //=======INITIALIZE========
  //=========================

  // Initialize and register with timeline service
  useEffect(() => {
    //console.log("SessionTimeline mounting check");
    
    // Only run the setup operations once on first mount
    if (initialMount.current) {
      logger.info("[INITIALIZE] SessionTimeline - initial setup");
      
      // Initialize transition state
      setTransitionState(false);
      
       // Register initial phases with timeline service

    // Use loaded phases from the timeline if available (from collection config)
    if (timeline.phases && timeline.phases.length > 0) {
      logger.info("[INITIALIZE] Using phases from timeline service (collection config):", timeline.phases.length);
      
           // Log each phase and its state
           timeline.phases.forEach(phase => {
            logger.debug(`[INITIALIZE] - Phase "${phase.name}" (${phase.id}) at position ${phase.position}:`);
            
            if (phase.state) {
              if (phase.state.volumes) {
                logger.debug(`[INITIALIZE] -- Volumes: ${JSON.stringify(phase.state.volumes)}`);
              }
              
              if (phase.state.activeAudio) {
                logger.debug(`[INITIALIZE] -- Tracks: ${JSON.stringify(phase.state.activeAudio)}`);
              }
            } else {
              logger.debug(`[INITIALIZE] -- No state defined`);
            }
          });
    
    
          setPhases(timeline.phases);
            //prevent the other effect from running during initialization
            componentHasRendered.current = true;
        } else if (timeline.updatePhases) {
          logger.info("[INITIALIZE] Registering initial phases with timeline service");
            
          // Set a flag to prevent the update effect from running on initialization
          componentHasRendered.current = true;
          
          timeline.updatePhases(phases);
        }
          
          // Register session duration
          if (timeline.setDuration) {
            logger.info("[INITIALIZE] Setting initial session duration");
            timeline.setDuration(timeline.duration);
          }
          
          // Register transition duration
          if (timeline.setTransitionDuration) {
            logger.info("[INITIALIZE] Setting initial transition duration");
            timeline.setTransitionDuration(timeline.transitionDuration);
          }
    
          applyPreOnsetPhase();
    
          // Only reset timeline if playback is not active
          if (!playback.isPlaying && timeline.reset) {
            logger.info("[INITIALIZE] Timeline reset on mount (playback not active)");
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
      }, [phases, timeline, playback.isPlaying, setTransitionState, applyPreOnsetPhase]);
    
    
      //Check if volume object is available
      // useEffect(() => {
      //   console.log("[SESSIONTIMELINE] Volume object in SessionTimeline:", {
      //     hasLayers: volume && !!volume.layers,
      //     methods: volume ? Object.keys(volume) : 'No volume object',
      //     fadeVolume: typeof volume.fadeVolume === 'function' ? 'Available' : 'Not available'
      //   });
      //   console.log("[SESSIONTIMELINE] Volume object volumes:", volume && volume.layers);
      // }, [volume]);
    
    
      // Update phases when they change
      useEffect(() => {
        // Only update if component has fully rendered and it's not the initial mount
        if (!initialMount.current && componentHasRendered.current && timeline.updatePhases) {
          logger.info("[SessionTimeline] Phases changed locally, updating timeline");
          timeline.updatePhases(phases);
        }
      }, [phases, timeline]);
    
    
      // Listen for timeline setting changes
      useEffect(() => {
        // Handle duration change events
        const handleDurationChange = (event) => {
          logger.info('Timeline received duration change event:', event.detail.duration);
          
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
          logger.info('Timeline received transition change event:', event.detail.duration);
          
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
            logger.info('Updating timeline phases from preset:', eventData.detail.phases);
            
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
      
      
      useEffect(() => {
        // Check if timeline.phases is available AND has proper state data
        if (timeline.phases && 
            timeline.phases.length > 0 && 
            !phasesApplied.current) {
          
          logger.info("[TIMELINE] Applying collection-specific phases:", timeline.phases.length);
          
          // Verify phases have proper state data
          const hasValidStates = timeline.phases.some(phase => 
            phase.state && (Object.keys(phase.state.volumes || {}).length > 0 || 
                           Object.keys(phase.state.activeAudio || {}).length > 0)
          );
          
          if (hasValidStates) {
            logger.info("[TIMELINE] Phases have valid state data, applying now");
            
            // Log details of each phase for debugging
            timeline.phases.forEach(phase => {
              logger.debug(`- Phase "${phase.name}" (${phase.id}):`);
              if (phase.state) {
                if (phase.state.volumes) {
                  logger.debug(`  Volumes: ${JSON.stringify(phase.state.volumes)}`);
                }
                if (phase.state.activeAudio) {
                  logger.debug(`  Tracks: ${JSON.stringify(phase.state.activeAudio)}`);
                }
              }
            });
            
            // Apply the phases directly from the timeline
            setPhases(timeline.phases);
            phasesApplied.current = true;
            
            // Apply the pre-onset phase immediately
            const preOnsetPhase = timeline.phases.find(p => p.id === 'pre-onset');
            if (preOnsetPhase && preOnsetPhase.state) {
              logger.info("[TIMELINE] Reapplying pre-onset phase from collection config");
              
              // Set as active phase
              lastActivePhaseId.current = 'pre-onset';
              setActivePhase('pre-onset');
            }
          } else {
            logger.warn("[TIMELINE] Phases from timeline don't have valid state data");
          }
        }
      }, [timeline.phases]);
      
    
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
     
      // Update timeline progress
      useEffect(() => {
        // If we're getting progress and time updates from the timeline service
        const handleTimelineProgress = (progressPercent, currentTimeMs) => {
          setProgress(progressPercent);
          setCurrentTime(currentTimeMs);
          
          // Find the correct active phase based on progress
          const currentProgress = progressPercent; // 0-100
          let newActivePhase = null;
          
          // No phase checks during transitions to avoid conflicts
          if (transitionInProgress.current) {
            logger.debug(`[SessionTimeline: progress] Skipping phase check during transition (${progressPercent.toFixed(1)}%)`);
            return;
          }
          
          // Find which phase we're in
          for (let i = phases.length - 1; i >= 0; i--) {
            if (currentProgress >= phases[i].position) {
              newActivePhase = phases[i].id;
              break;
            }
          }
          
          // If phase has changed, handle the transition
          if (newActivePhase && newActivePhase !== lastActivePhaseId.current) {
            handlePhaseTransition(newActivePhase);
          }
        };
        
        if (timeline.registerProgressCallback) {
          timeline.registerProgressCallback(handleTimelineProgress);
          logger.debug("[SessionTimeline: progress] Registered progress callback with timeline service");
          
          // Clean up
          return () => {
            timeline.registerProgressCallback(null);
          };
        }
      }, [phases, timeline, handlePhaseTransition]);
    
    
      // Listen for play state changes from the main player
      useEffect(() => {
        const updateTimelinePlayState = () => {
          const isPlaying = playback.isPlaying;
          
          if (isPlaying !== timelineIsPlaying) {
            logger.debug(`[SessionTimeline: playback] Playback state changed to: ${isPlaying ? 'playing' : 'paused'}`);
            setTimelineIsPlaying(isPlaying);
          }
        };
        
        // Initial update
        updateTimelinePlayState();
        
        // Clean up
        return () => {
          if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
          }
        };
      }, [playback.isPlaying, timelineIsPlaying]);
    
    
      //========PHASE HANDLING========
      //==============================
      
      // Toggle playback of the timeline
      const toggleTimelinePlayback = useCallback(() => {
        if (playback.togglePlayback) {
          if (timelineIsPlaying) {
            logger.info("[SessionTimeline] Toggling playback: pausing");
            playback.togglePlayback();
            setLocalTimelineIsPlaying(false);
          } else {
            logger.info("[SessionTimeline] Toggling playback: playing");
            playback.togglePlayback();
            setLocalTimelineIsPlaying(true);
          }
        }
      }, [timelineIsPlaying, playback]);
    
    
      // Restart timeline
      const handleRestartTimeline = useCallback(() => {
        logger.info("[SessionTimeline] Restarting timeline");
        
        // Mark that we need to reapply pre-onset
        startingPhaseApplied.current = false;
        
        // Stop playback if playing and reset timeline
        if (timelineIsPlaying) {
          wasPlayingBeforeStop.current = true;
          
          if (playback.pause) {
            playback.pause();
          }
        } else {
          wasPlayingBeforeStop.current = false;
        }
        
        // Reset timeline
        if (timeline.reset) {
          timeline.reset();
        }
        
        // Reapply pre-onset phase
        applyPreOnsetPhase();
        
        // Restart playback if it was playing before
        if (wasPlayingBeforeStop.current && playback.play) {
          setTimeout(() => {
            playback.play();
          }, 50);
        }
      }, [applyPreOnsetPhase, playback, timeline, timelineIsPlaying]);
    
    
      // Handle marker drag
      const handleMarkerDrag = useCallback((id, newPosition) => {
        logger.debug(`[SessionTimeline: marker] Marker ${id} dragged to position ${newPosition}`);
        
        // Update marker position
        setPhases(prevPhases => {
          // Create a copy of the phases array
          const newPhases = [...prevPhases];
          
          // Find the index of the phase with the given id
          const phaseIndex = newPhases.findIndex(phase => phase.id === id);
          
          if (phaseIndex !== -1) {
            // Create a copy of the phase object to avoid mutating the original
            const updatedPhase = { ...newPhases[phaseIndex], position: newPosition };
            
            // Replace the old phase with the updated one
            newPhases[phaseIndex] = updatedPhase;
            
            // Sort phases by position
            newPhases.sort((a, b) => a.position - b.position);
          }
          
          return newPhases;
        });
      }, []);
    
      // De-select all markers
      const deselectAllMarkers = useCallback(() => {
        logger.debug("[SessionTimeline: marker] Deselecting all markers");
        setSelectedPhase(null);
      }, []);
    
    
      // Handle click on a phase marker
      const handlePhaseClick = useCallback((id) => {
        if (editMode) {
          // Set as selected marker for editing
          logger.debug(`[SessionTimeline: marker] Phase ${id} selected for editing`);
          setSelectedPhase(id);
        } else {
          logger.info(`[SessionTimeline: marker] Manually activating phase: ${id}`);
          handlePhaseTransition(id);
        }
      }, [editMode, handlePhaseTransition]);
    
    
      // Handle phase state capture
      const handleCaptureState = useCallback((phaseId) => {
        logger.info(`[SessionTimeline: state] Capturing current state for phase: ${phaseId}`);
        
        // Find the phase by ID
        const phaseIndex = phases.findIndex(p => p.id === phaseId);
        
        if (phaseIndex === -1) {
          logger.error(`[SessionTimeline: state] Phase ${phaseId} not found`);
          return;
        }
        
        // Get current state
        const capturedState = {
          volumes: { ...volume.layers },
          activeAudio: { ...layers.active }
        };
        
        // Log the captured state
        logger.debug(`[SessionTimeline: state] Captured volumes: ${JSON.stringify(capturedState.volumes)}`);
        logger.debug(`[SessionTimeline: state] Captured tracks: ${JSON.stringify(capturedState.activeAudio)}`);
    
        // Update the phase state
        setPhases(prevPhases => {
          const newPhases = [...prevPhases];
          newPhases[phaseIndex] = {
            ...newPhases[phaseIndex],
            state: capturedState
          };
          return newPhases;
        });
        
        logger.info(`[SessionTimeline: state] State captured for phase: ${phaseId}`);
      }, [phases, volume, layers]);
      
      
      // Handle phase editor changes
      const handlePhaseChange = useCallback((id, updates) => {
        logger.debug(`[SessionTimeline: marker] Updating phase ${id}:`, updates);
        
        // Update the phase
        setPhases(prevPhases => {
          const newPhases = [...prevPhases];
          const phaseIndex = newPhases.findIndex(phase => phase.id === id);
          
          if (phaseIndex !== -1) {
            newPhases[phaseIndex] = {
              ...newPhases[phaseIndex],
              ...updates
            };
          }
          
          return newPhases;
        });
      }, []);
    
    
      // Handle phase editor deletion
      const handlePhaseDelete = useCallback((id) => {
        logger.info(`[SessionTimeline: marker] Deleting phase: ${id}`);
        
        // Don't allow deleting locked phases
        const phaseToDelete = phases.find(p => p.id === id);
        if (phaseToDelete?.locked) {
          logger.warn(`[SessionTimeline: marker] Cannot delete locked phase: ${id}`);
          return;
        }
        
        // Remove the phase
        setPhases(prevPhases => {
          return prevPhases.filter(phase => phase.id !== id);
        });
        
        // Deselect the marker
        setSelectedPhase(null);
      }, [phases]);
    
    
      // Add a new marker
      const handleAddPhase = useCallback(() => {
        logger.info("[SessionTimeline: marker] Adding new phase");
        
        // Create a new unique ID
        const newId = `phase-${Date.now()}`;
        
        // Create a new phase at a reasonable position
        const newPhase = {
          id: newId,
          name: 'New Phase',
          position: 50, // Middle of timeline
          color: '#6E9CAA', // Default color
          state: null,
          locked: false
        };
        
        // Add the new phase
        setPhases(prevPhases => {
          const newPhases = [...prevPhases, newPhase];
          // Sort phases by position
          return newPhases.sort((a, b) => a.position - b.position);
        });
        
        // Select the new phase for editing
        setSelectedPhase(newId);
      }, []);
    
    
      // Toggle edit mode
      const handleToggleEditMode = useCallback(() => {
        logger.info(`[SessionTimeline: editMode] ${editMode ? 'Disabling' : 'Enabling'} edit mode`);
        setEditMode(prev => !prev);
      }, [editMode]);
    
    
      // Format time for display (MM:SS)
      const formatTime = useCallback((timeMs) => {
        const totalSeconds = Math.floor(timeMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }, []);
    
    
      // Format session duration for display (HH:MM:SS)
      const formatSessionDuration = useCallback((durationMs) => {
        const totalSeconds = Math.floor(durationMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        if (hours > 0) {
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
          return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
      }, []);
    
    
      // Calculate progress bar position
      const getProgressBarPosition = useCallback(() => {
        return `${progress}%`;
      }, [progress]);
    
    
      // Convert a position from pixels to percent
      const convertPositionToPercent = useCallback((positionPx) => {
        if (!timelineRef.current) return 0;
        
        const timelineWidth = timelineRef.current.clientWidth;
        let percent = (positionPx / timelineWidth) * 100;
        
        // Clamp between 0 and 100
        percent = Math.max(0, Math.min(100, percent));
        
        return percent;
      }, []);
    
    
      // Handle click on the timeline to position a marker
      const handleTimelineClick = useCallback((event) => {
        if (!editMode) return;
        
        // Get click position relative to timeline
        const rect = timelineRef.current.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        
        // Convert to percentage
        const position = convertPositionToPercent(offsetX);
        
        // If we have a selected marker, update its position
        if (selectedPhase) {
          handleMarkerDrag(selectedPhase, position);
        }
      }, [editMode, selectedPhase, handleMarkerDrag, convertPositionToPercent]);
    
      //=== Reference methods for parent components ===
      // Expose methods via ref
      React.useImperativeHandle(ref, () => ({
        // Get all phase data with their states
        getPhases: () => phases,
        
        // Get the active phase ID
        getActivePhase: () => activePhase,
        
        // Update phases from external source
        updatePhases: (newPhases) => {
          logger.info("[SessionTimeline: ref] External update to phases:", newPhases.length);
          setPhases(newPhases);
        },
        
        // Add a phase from external source
        addPhase: (phaseData) => {
          logger.info("[SessionTimeline: ref] Adding phase from external source:", phaseData.id);
          setPhases(prevPhases => {
            const newPhases = [...prevPhases, phaseData];
            return newPhases.sort((a, b) => a.position - b.position);
          });
        },
        
        // Reset timeline to beginning
        restart: () => {
          logger.info("[SessionTimeline: ref] External restart request");
          handleRestartTimeline();
        },
        
        // Toggle timeline playback
        togglePlayback: () => {
          logger.info("[SessionTimeline: ref] External toggle playback request");
          toggleTimelinePlayback();
        }
      }));
    
      return (
        <div className={timelinestyles.sessionTimelineContainer}>
          <div 
            ref={timelineRef}
            className={timelinestyles.timeline} 
            onClick={handleTimelineClick}
          >
            {/* Timeline background */}
            <div className={timelinestyles.timelineBackground}></div>
            
            {/* Time markers */}
            <div className={timelinestyles.timeMarkers}>
              <span className={timelinestyles.startTime}>00:00</span>
              <span className={timelinestyles.endTime}>
                {formatSessionDuration(timeline.duration || 1800000)}
              </span>
            </div>
            
            {/* Phase markers */}
            {phases.map((phase) => (
              <PhaseMarker
                key={phase.id}
                id={phase.id}
                name={phase.name}
                position={phase.position}
                color={phase.color}
                isActive={activePhase === phase.id}
                isSelected={selectedPhase === phase.id}
                transitioning={transitioning}
                editable={editMode && !phase.locked}
                onClick={handlePhaseClick}
                onDrag={handleMarkerDrag}
              />
            ))}
            
            {/* Progress indicator */}
            <div 
              className={timelinestyles.progressIndicator}
              style={{ left: getProgressBarPosition() }}
            >
              <div className={timelinestyles.progressLine}></div>
              <div className={timelinestyles.progressHandle}></div>
            </div>
          </div>
          
          {/* Playback controls and time display */}
          <div className={timelinestyles.controls}>
            <button 
              onClick={toggleTimelinePlayback}
              className={timelinestyles.playPauseButton}
            >
              {timelineIsPlaying ? 'Pause' : 'Play'}
            </button>
            
            <button 
              onClick={handleRestartTimeline}
              className={timelinestyles.restartButton}
            >
              Restart
            </button>
            
            <div className={timelinestyles.timeDisplay}>
              {formatTime(currentTime)}
            </div>
            
            <button
              onClick={handleToggleEditMode}
              className={`${timelinestyles.editButton} ${editMode ? timelinestyles.active : ''}`}
            >
              Edit
            </button>
          </div>
          
          {/* Phase editor (when in edit mode) */}
          {editMode && (
            <div className={timelinestyles.editorToolbar}>
              <button 
                onClick={handleAddPhase}
                className={timelinestyles.addPhaseButton}
              >
                Add Phase
              </button>
              
              {selectedPhase && (
                <div className={timelinestyles.phaseEditor}>
                  <h3>Edit Phase</h3>
                  
                  {/* Phase being edited */}
                  {(() => {
                    const phase = phases.find(p => p.id === selectedPhase);
                    if (!phase) return null;
                    
                    return (
                      <>
                        <div className={timelinestyles.editorField}>
                          <label>Name:</label>
                          <input 
                            type="text"
                            value={phase.name}
                            onChange={(e) => handlePhaseChange(phase.id, { name: e.target.value })}
                          />
                        </div>
                        
                        <div className={timelinestyles.editorField}>
                          <label>Position:</label>
                          <input 
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={Math.round(phase.position)}
                            onChange={(e) => handlePhaseChange(phase.id, { position: Number(e.target.value) })}
                          />
                        </div>
                        
                        <div className={timelinestyles.editorField}>
                          <label>Color:</label>
                          <input 
                            type="color"
                            value={phase.color}
                            onChange={(e) => handlePhaseChange(phase.id, { color: e.target.value })}
                          />
                        </div>
                        
                        <div className={timelinestyles.editorActions}>
                          <button 
                            onClick={() => handleCaptureState(phase.id)}
                            className={timelinestyles.captureButton}
                          >
                            Capture Current State
                          </button>
                          
                          {!phase.locked && (
                            <button 
                              onClick={() => handlePhaseDelete(phase.id)}
                              className={timelinestyles.deleteButton}
                            >
                              Delete Phase
                            </button>
                          )}
                        </div>
                        
                        {/* Display if this phase has saved state */}
                        {phase.state && (
                          <div className={timelinestyles.stateInfo}>
                            <span>State data captured ✓</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
          
          {/* Session settings */}
          <SessionSettings
            sessionDuration={timeline.duration}
            transitionDuration={timeline.transitionDuration}
            onSessionDurationChange={(duration) => {
              if (onDurationChange) onDurationChange(duration);
            }}
            onTransitionDurationChange={(duration) => {
              if (onTransitionDurationChange) onTransitionDurationChange(duration);
            }}
          />
        </div>
      );
    });
    
    export default SessionTimeline;
    