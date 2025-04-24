// src/components/audio/SessionTimeline.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudio } from '../../hooks/useAudio';
import { useVolume } from '../../hooks/useVolume';
import { useLayer } from '../../hooks/useLayer';
import { useCrossfade } from '../../hooks/useCrossfade';
import { useTimeline } from '../../hooks/useTimeline';
import eventBus, { EVENTS } from '../../services/EventBus';
import PhaseMarker from './PhaseMarker';
import SessionSettings from './SessionSettings';
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
  
  // Use our hooks with grouped functionality
  const { playback } = useAudio();
  const volume = useVolume();
  const layers = useLayer();
  const crossfade = useCrossfade();
  const timeline = useTimeline();
  
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
    
    // Emit transition state change event
    eventBus.emit(EVENTS.TIMELINE_TRANSITION_STATE_CHANGED || 'timeline:transitionStateChanged', {
      isTransitioning,
      timestamp: Date.now()
    });
  }, [transitioning]);

  // Apply Pre-Onset Phase - regular function, not callback
  function applyPreOnsetPhase() {
    console.log("[SessionTimeline: applyPreOnsetPhase] Applying pre-onset phase state immediately");
    
    // Find the pre-onset phase
    const preOnsetPhase = phases.find(p => p.id === 'pre-onset');
    
    if (preOnsetPhase && preOnsetPhase.state) {
      console.log("[SessionTimeline: applyPreOnsetPhase] Found pre-onset phase with saved state");
      
      // Immediately set volumes without transitions
      if (preOnsetPhase.state.volumes) {
        Object.entries(preOnsetPhase.state.volumes).forEach(([layer, vol]) => {
          console.log(`[SessionTimeline: applyPreOnsetPhase] Setting ${layer} volume to ${vol}`);
          volume.setVolume(layer, vol, { immediate: true });
        });
      }
      
      // Immediately switch to pre-onset tracks without crossfade
      if (preOnsetPhase.state.activeAudio) {
        Object.entries(preOnsetPhase.state.activeAudio).forEach(([layer, trackId]) => {
          if (trackId !== layers.activeTracks[layer]) {
            console.log(`[SessionTimeline: applyPreOnsetPhase] Switching ${layer} to track ${trackId}`);
            // Use a minimal 50ms transition to prevent audio pops but still be immediate
            crossfade.crossfadeTo(layer, trackId, 50);
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
          case 'layer1':
            defaultVolume = 0.10; // Keep your existing L1 default
            break;
          case 'layer2':
            defaultVolume = 0.15; // New default for L2
            break;
          case 'layer3':
            defaultVolume = 0.10; // New default for L3
            break;
          case 'layer4':
            defaultVolume = 0.20; // New default for L4
            break;
          default:
            defaultVolume = 0; // Fallback
        }
        
        volume.setVolume(layerKey, defaultVolume, { immediate: true });
      });
    }
  }

  // Apply phase changes - regular function, not callback
  function applyPhaseChanges(phaseId) {
    // Don't process if a transition is in progress
    if (transitionInProgress.current) {
      console.log(`[SessionTimeline: applyPhaseChanges] Transition in progress, queueing phase ${phaseId}`);
      queuedPhaseRef.current = phaseId;
      
      // Emit event that we're queuing this phase
      eventBus.emit(EVENTS.TIMELINE_PHASE_QUEUED || 'timeline:phaseQueued', {
        phaseId,
        reason: 'transitionInProgress',
        timestamp: Date.now()
      });
      
      return;
    }
    
    console.log(`[SessionTimeline: applyPhaseChanges] Applying phase ${phaseId}`);
    
    // Find phase definition
    const phase = phases.find(p => p.id === phaseId);
    if (!phase || !phase.state) {
      console.log(`[SessionTimeline: applyPhaseChanges] Phase ${phaseId} has no saved state, skipping`);
      return;
    }
    
    // Set transition state - beginning state transition
    setTransitionState(true);
    
    // Emit phase application started event
    eventBus.emit(EVENTS.TIMELINE_PHASE_APPLICATION_STARTED || 'timeline:phaseApplicationStarted', {
      phaseId,
      timestamp: Date.now()
    });
    
    // Apply track changes first with crossfade engine
    if (phase.state.activeAudio) {
      console.log(`[SessionTimeline: applyPhaseChanges] Applying track changes for phase ${phaseId}`);
      
      // Store current state for tracking changes
      const currentTracks = {...layers.activeTracks};
      
      // Apply track changes that differ from current state
      Object.entries(phase.state.activeAudio).forEach(([layer, trackId]) => {
        // Only apply changes if track is different
        if (trackId !== currentTracks[layer]) {
          console.log(`[SessionTimeline: applyPhaseChanges] Switching ${layer} from ${currentTracks[layer]} to ${trackId}`);
          crossfade.crossfadeTo(layer, trackId, timeline.transitionDuration || 4000);
        }
      });
    }
    
    // Apply volume changes
    if (phase.state.volumes) {
      console.log(`[SessionTimeline: applyPhaseChanges] Applying volume changes for phase ${phaseId}`);
      
      // Store current volumes
      currentVolumeState.current = {...volume.volumes};
      
      // Apply volume transitions
      Object.entries(phase.state.volumes).forEach(([layer, targetVolume]) => {
        // Get current volume for calculation
        const currentVol = volume.volumes[layer] || 0;
        
        console.log(`[SessionTimeline: applyPhaseChanges] Fading ${layer} from ${currentVol} to ${targetVolume}`);
        
        // Use volume service to fade
        volume.fadeVolume(layer, targetVolume, timeline.transitionDuration || 4000);
      });
      
      // Set timeout for end of transition
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      
      transitionTimeoutRef.current = setTimeout(() => {
        console.log(`[SessionTimeline: applyPhaseChanges] Phase ${phaseId} transition complete`);
        setTransitionState(false);
        
        // Emit phase application completed event
        eventBus.emit(EVENTS.TIMELINE_PHASE_APPLICATION_COMPLETED || 'timeline:phaseApplicationCompleted', {
          phaseId,
          timestamp: Date.now()
        });
      }, (timeline.transitionDuration || 4000) + 100); // Add a small buffer
    } else {
      // If there are no volume changes, but we have track changes
      if (phase.state.activeAudio) {
        // Set a timeout for completion based on crossfade duration
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
        }
        
        transitionTimeoutRef.current = setTimeout(() => {
          console.log(`[SessionTimeline: applyPhaseChanges] Phase ${phaseId} track changes complete`);
          setTransitionState(false);
          
          // Emit phase application completed event
          eventBus.emit(EVENTS.TIMELINE_PHASE_APPLICATION_COMPLETED || 'timeline:phaseApplicationCompleted', {
            phaseId,
            timestamp: Date.now()
          });
        }, (timeline.transitionDuration || 4000) + 100); // Add a small buffer
      } else {
        // No changes to apply
        console.log(`[SessionTimeline: applyPhaseChanges] Phase ${phaseId} has no changes to apply`);
        setTransitionState(false);
        
        // Emit phase application completed event with "no changes"
        eventBus.emit(EVENTS.TIMELINE_PHASE_APPLICATION_COMPLETED || 'timeline:phaseApplicationCompleted', {
          phaseId,
          noChanges: true,
          timestamp: Date.now()
        });
      }
    }
  }

  // Listen for specific phase transition events from EventBus
  useEffect(() => {
    // Handle explicit phase transition events from TimelineService
    const handlePhaseTransition = (data) => {
      const { phaseId, phaseData, transitionDuration } = data;
      
      console.log(`[SessionTimeline] Received phase transition event for phase: ${phaseId}`);
      
      // Update our internal state
      setActivePhase(phaseId);
      lastActivePhaseId.current = phaseId;
      
      // Check if we can apply this phase now or queue it
      if (!transitionInProgress.current) {
        console.log(`[SessionTimeline] Applying phase changes for: ${phaseId}`);
        applyPhaseChanges(phaseId);
      } else {
        console.log(`[SessionTimeline] Transition in progress, queueing phase: ${phaseId}`);
        queuedPhaseRef.current = phaseId;
      }
    };
    
    // Listen for crossfade completion events to manage transition state
    const handleCrossfadeComplete = (data) => {
      const { layer, fromTrack, toTrack } = data;
      
      console.log(`[SessionTimeline] Crossfade complete: ${layer} from ${fromTrack} to ${toTrack}`);
      
      // Check if all crossfades are complete
      if (!crossfade.activeCrossfades || Object.keys(crossfade.activeCrossfades).length === 0) {
        // Small delay to ensure any nearly-simultaneous crossfades have completed
        setTimeout(() => {
          if (!crossfade.activeCrossfades || Object.keys(crossfade.activeCrossfades).length === 0) {
            console.log('[SessionTimeline] All crossfades completed');
            setTransitionState(false);
          }
        }, 100);
      }
    };
    
      // Listen for phase state updates from external sources
  const handleExternalPhaseStateUpdate = (data) => {
    if (data.phaseId && data.state) {
      console.log(`[SessionTimeline] Received external phase state update for: ${data.phaseId}`);
      // Update your phase state
      setPhases(prevPhases => 
        prevPhases.map(p => 
          p.id === data.phaseId ? { ...p, state: data.state } : p
        )
      );
    }
  };
    // Handle timeline playback state changes
    const handleTimelineStarted = () => {
      console.log('[SessionTimeline] Timeline started');
      setTimelineIsPlaying(true);
      setLocalTimelineIsPlaying(true);
    };
    
    const handleTimelineStopped = () => {
      console.log('[SessionTimeline] Timeline stopped');
      setTimelineIsPlaying(false);
      setLocalTimelineIsPlaying(false);

    };
    
    const handleTimelinePaused = () => {
      console.log('[SessionTimeline] Timeline paused');
      setTimelineIsPlaying(false);
      setLocalTimelineIsPlaying(false);
    };
    
    const handleTimelineResumed = () => {
      console.log('[SessionTimeline] Timeline resumed');
      setTimelineIsPlaying(true);
      setLocalTimelineIsPlaying(true);
    };
    
    // Register all event listeners
    eventBus.on('timeline:phaseStateUpdated', handleExternalPhaseStateUpdate);
    eventBus.on('timeline:phaseTransition', handlePhaseTransition);
    eventBus.on('crossfade:complete', handleCrossfadeComplete);
    eventBus.on(EVENTS.TIMELINE_STARTED, handleTimelineStarted);
    eventBus.on(EVENTS.TIMELINE_STOPPED, handleTimelineStopped);
    eventBus.on(EVENTS.TIMELINE_PAUSED, handleTimelinePaused);
    eventBus.on(EVENTS.TIMELINE_RESUMED, handleTimelineResumed);
    
    // Backward compatibility with legacy DOM events
    const handleLegacyPhaseChange = (event) => {
      const { phaseId, phaseData } = event.detail;
      
      console.log(`[SessionTimeline] Received legacy phase change event for phase: ${phaseId}`);
      
      // Update internal state
      setActivePhase(phaseId);
      lastActivePhaseId.current = phaseId;
      
      // Apply phase changes using the same logic
      if (!transitionInProgress.current) {
        applyPhaseChanges(phaseId);
      } else {
        queuedPhaseRef.current = phaseId;
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('timeline-phase-changed', handleLegacyPhaseChange);
      window.addEventListener('timeline-phase-transition', handleLegacyPhaseChange);
    }
    
    // Clean up all listeners on unmount
    return () => {
      eventBus.off('timeline:phaseStateUpdated', handleExternalPhaseStateUpdate);
      eventBus.off('timeline:phaseTransition', handlePhaseTransition);
      eventBus.off('crossfade:complete', handleCrossfadeComplete);
      eventBus.off(EVENTS.TIMELINE_STARTED, handleTimelineStarted);
      eventBus.off(EVENTS.TIMELINE_STOPPED, handleTimelineStopped);
      eventBus.off(EVENTS.TIMELINE_PAUSED, handleTimelinePaused);
      eventBus.off(EVENTS.TIMELINE_RESUMED, handleTimelineResumed);
      
      if (typeof window !== 'undefined') {
        window.removeEventListener('timeline-phase-changed', handleLegacyPhaseChange);
        window.removeEventListener('timeline-phase-transition', handleLegacyPhaseChange);
      }
      
      // Clear any pending timeouts
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      
      if (progressTimerRef.current) {
        cancelAnimationFrame(progressTimerRef.current);
      }
    };
  }, []); // Empty dependency array ensures these listeners are only set up once

  // Initialize on mount
  useEffect(() => {
    console.log("[SessionTimeline] Component mounted");
    
    // Initialize phases if none are saved already
    if (timeline.phases && timeline.phases.length > 0) {
      console.log("[SessionTimeline] Using phases from timeline context:", timeline.phases.length);
      setPhases(timeline.phases);
    } else {
      console.log("[SessionTimeline] No existing phases, using defaults:", DEFAULT_PHASES.length);
      setPhases(DEFAULT_PHASES);
      
      // Send default phases to timeline service
      if (timeline.updatePhases) {
        timeline.updatePhases(DEFAULT_PHASES);
      }
    }
    
    // Mark component as rendered
    componentHasRendered.current = true;
    
    // Apply pre-onset phase if audio is already playing
    if (playback.isPlaying && !startingPhaseApplied.current) {
      console.log("[SessionTimeline] Audio is already playing on mount, applying pre-onset phase");
      applyPreOnsetPhase();
      startingPhaseApplied.current = true;
    }
    
    // Track initial state of playback
    wasPlayingBeforeStop.current = playback.isPlaying;
    
    // Mark initial mount as complete
    initialMount.current = false;
  }, []);

  // Watch for playback changes to apply pre-onset phase
  useEffect(() => {
    if (playback.isPlaying && !startingPhaseApplied.current) {
      console.log("[SessionTimeline] Audio started playing, applying pre-onset phase");
      applyPreOnsetPhase();
      startingPhaseApplied.current = true;
    } else if (!playback.isPlaying && startingPhaseApplied.current) {
      console.log("[SessionTimeline] Audio stopped, resetting starting phase flag");
      startingPhaseApplied.current = false;
    }
  }, [playback.isPlaying]);

  // Watch for active phase changes from timeline
  useEffect(() => {
    const newActivePhase = timeline.activePhase;
    
    // Skip if we're already tracking this phase
    if (newActivePhase === activePhase && newActivePhase === lastActivePhaseId.current) {
      return;
    }
    
    console.log(`[SessionTimeline] Active phase changed: ${newActivePhase}`);
    
    // Update our local state to match timeline context
    setActivePhase(newActivePhase);
    lastActivePhaseId.current = newActivePhase;
    
    // Apply phase changes if needed
    if (newActivePhase && playback.isPlaying) {
      if (!transitionInProgress.current) {
        applyPhaseChanges(newActivePhase);
      } else {
        console.log(`[SessionTimeline] Queuing phase change to ${newActivePhase} - transition in progress`);
        queuedPhaseRef.current = newActivePhase;
      }
    }
  }, [timeline.activePhase, activePhase, playback.isPlaying]);

  // Watch for queued phase transitions
  useEffect(() => {
    // If we're not transitioning and we have a queued phase change
    if (!transitionInProgress.current && queuedPhaseRef.current) {
      console.log(`[SessionTimeline] Applying queued phase: ${queuedPhaseRef.current}`);
      
      // Process the queued phase change
      applyPhaseChanges(queuedPhaseRef.current);
      
      // Clear the queue
      queuedPhaseRef.current = null;
    }
  }, [transitioning]); // Only depends on transitioning state

  // Update phases when they change
  useEffect(() => {
    if (!initialMount.current && timeline.updatePhases) {
      timeline.updatePhases(phases);
    }
  }, [phases]);
  
  // Synchronize progress state with timeline
  useEffect(() => {
    if (timeline.progress !== progress) {
      setProgress(timeline.progress);
    }
    
    // Use requestAnimationFrame for smooth progress display when playing
    if (timelineIsPlaying) {
      if (progressTimerRef.current) {
        cancelAnimationFrame(progressTimerRef.current);
      }
      
      progressTimerRef.current = requestAnimationFrame(() => {
        if (playback.getTime) {
          const elapsed = playback.getTime();
          setCurrentTime(elapsed);
        }
      });
    }
    
    return () => {
      if (progressTimerRef.current) {
        cancelAnimationFrame(progressTimerRef.current);
      }
    };
  }, [timeline.progress, progress, timelineIsPlaying, playback]);

  // Utility function to deselect all markers
  const deselectAllMarkers = useCallback(() => {
    setSelectedPhase(null);
  }, []);

  // Capture volume state
  const captureCurrentVolumeState = useCallback(() => {
    const currentVolumes = {};
    
    // Capture current volume levels for all layers
    Object.values(layers.TYPES).forEach(layer => {
      const layerKey = layer.toLowerCase();
      currentVolumes[layerKey] = volume.volumes[layerKey] || 0;
    });
    
    return currentVolumes;
  }, [layers.TYPES, volume.volumes]);

  // Capture audio tracks state
  const captureCurrentAudioState = useCallback(() => {
    return {...layers.activeTracks};
  }, [layers.activeTracks]);

  // Get formatted time
  const formatTime = useCallback((ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }, []);

   // Format remaining time
   const formatTimeRemaining = useCallback(() => {
    const remainingMs = Math.max(0, timeline.duration - currentTime);
    return formatTime(remainingMs);
  }, [currentTime, timeline.duration, formatTime]);


  // Toggle timeline playback
  const toggleTimelinePlayback = useCallback(() => {
    // Only allow starting timeline if audio is playing
    if (!playback.isPlaying && !timelineIsPlaying) {
      console.log("[SessionTimeline] Cannot start timeline - audio is not playing");
      return false;
    }
    
    if (timelineIsPlaying) {
      console.log("[SessionTimeline] Pausing timeline");
      timeline.pause();
    } else {
      console.log("[SessionTimeline] Starting timeline");
      const success = timeline.start();
      
      if (success) {
        console.log("[SessionTimeline] Timeline started successfully");
      } else {
        console.log("[SessionTimeline] Timeline failed to start");
      }
    }
  }, [playback.isPlaying, timelineIsPlaying, timeline]);

  // Handle restart timeline
  const handleRestartTimeline = useCallback(() => {
    if (timeline.reset) {
      timeline.reset();
    }
    
    if (timeline.start) {
      timeline.start({ reset: true });
    }
  }, [timeline]);

  // Handle saving a phase state
  const handleSavePhaseState = useCallback((phaseId) => {
    if (!phaseId) return;
    
    // Find the phase to update
    const phaseIndex = phases.findIndex(p => p.id === phaseId);
    if (phaseIndex === -1) return;
    
    console.log(`[SessionTimeline] Saving state for phase ${phaseId}`);
    
    // Capture current state
    const volumeState = captureCurrentVolumeState();
    const audioState = captureCurrentAudioState();
    
    // Create new array with updated phase
    const updatedPhases = [...phases];
    updatedPhases[phaseIndex] = {
      ...updatedPhases[phaseIndex],
      state: {
        volumes: volumeState,
        activeAudio: audioState
      }
    };
    
    // Update phases state
    setPhases(updatedPhases);
    
    console.log(`[SessionTimeline] Saved state for phase ${phaseId}:`, {
      volumes: volumeState,
      activeAudio: audioState
    });
    
    // Send update to timeline service
    if (timeline.updatePhases) {
      timeline.updatePhases(updatedPhases);
    }
    
    // Emit event that phase state was saved
    eventBus.emit(EVENTS.TIMELINE_PHASE_STATE_SAVED || 'timeline:phaseStateSaved', {
      phaseId,
      state: {
        volumes: volumeState,
        activeAudio: audioState
      },
      timestamp: Date.now()
    });
    
    // Deselect after saving
    if (selectedPhase === phaseId) {
      setSelectedPhase(null);
    }
  }, [
    phases, 
    selectedPhase, 
    captureCurrentVolumeState, 
    captureCurrentAudioState, 
    timeline
  ]);

  // Handle marker click
  const handleMarkerClick = useCallback((phaseId, event) => {
    event.stopPropagation();
    
    // If in edit mode, select the marker
    if (editMode) {
      console.log(`[SessionTimeline] Select phase: ${phaseId}`);
      setSelectedPhase(phaseId === selectedPhase ? null : phaseId);
      return;
    }
    
    // Regular mode - seek to phase
    console.log(`[SessionTimeline] Seek to phase: ${phaseId}`);
    
    // Find the phase and seek to its position
    const phase = phases.find(p => p.id === phaseId);
    if (phase) {
      const position = phase.position / 100;
      
      if (timeline.seekToPercent) {
        timeline.seekToPercent(position * 100);
      }
    }
  }, [editMode, selectedPhase, phases, timeline]);

  // Handle marker position change
  const handleMarkerPositionChange = useCallback((phaseId, newPosition) => {
    console.log(`[SessionTimeline] Updating phase ${phaseId} position to ${newPosition}%`);
    
    // Find the phase to update
    const phaseIndex = phases.findIndex(p => p.id === phaseId);
    if (phaseIndex === -1) return;
    
    // Create new array with updated phase position
    const updatedPhases = [...phases];
    updatedPhases[phaseIndex] = {
      ...updatedPhases[phaseIndex],
      position: newPosition
    };
    
    // Sort phases by position
    updatedPhases.sort((a, b) => a.position - b.position);
    
    // Update phases state
    setPhases(updatedPhases);
    
    // Send update to timeline service
    if (timeline.updatePhases) {
      timeline.updatePhases(updatedPhases);
    }
    
    // Emit event that phase position was changed
    eventBus.emit(EVENTS.TIMELINE_PHASE_POSITION_CHANGED || 'timeline:phasePositionChanged', {
      phaseId,
      newPosition,
      timestamp: Date.now()
    });
  }, [phases, timeline]);

  // Toggle edit mode
  const toggleEditMode = useCallback(() => {
    setEditMode(prev => !prev);
    setSelectedPhase(null);
  }, []);

  // Handle timeline click for seeking
  const handleTimelineClick = useCallback((e) => {
    // Determine if we're clicking on a marker
    const isMarkerClick = e.target.closest(`.${timelinestyles.phaseMarker}`);
    
    // If clicking on a marker, let the marker handle it
    if (isMarkerClick) return;
    
    // Otherwise, this is a background click
    
    // If in edit mode, just deselect the marker
    if (editMode) {
      deselectAllMarkers();
      return;
    }
    
    // If not in edit mode, perform seeking
    if (timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const clickPosition = (e.clientX - rect.left) / rect.width;
      const seekPercent = Math.max(0, Math.min(100, clickPosition * 100));
      
      console.log(`[SessionTimeline] Seeking to ${seekPercent.toFixed(2)}%`);
      
      if (timeline.seekToPercent) {
        timeline.seekToPercent(seekPercent);
      }
      
      // Emit event for analytics
      eventBus.emit(EVENTS.TIMELINE_MANUAL_SEEK || 'timeline:manualSeek', {
        percent: seekPercent,
        type: 'click',
        timestamp: Date.now()
      });
    }
  }, [editMode, timeline, deselectAllMarkers]);

  // Export interface for parent components
  React.useImperativeHandle(ref, () => ({
    togglePlayback: toggleTimelinePlayback,
    setEditMode: setEditMode,
    getPhases: () => phases,
    savePhaseState: handleSavePhaseState,
    isPlaying: timelineIsPlaying,
    isTransitioning: transitioning,
    seekToPercent: (percent) => {
      if (timeline.seekToPercent) {
        return timeline.seekToPercent(percent);
      }
      return false;
    },
    reset: () => {
      if (timeline.reset) {
        return timeline.reset();
      }
      return false;
    }
  }), [
    toggleTimelinePlayback,
    phases,
    handleSavePhaseState,
    timelineIsPlaying,
    transitioning,
    timeline
  ]);

  // Render the timeline component
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
      
      <div className={timelinestyles.timelineWrapper}>
        <div 
          className={timelinestyles.timeline}
          ref={timelineRef}
          onClick={handleTimelineClick}
        >
          <div 
            className={timelinestyles.progressBar}
            style={{ width: `${progress * 100}%` }}
          />
          
          {/* Map phase markers */}
          {phases.map(phase => (
  <PhaseMarker
    key={phase.id}
    id={phase.id}
    name={phase.name}
    position={phase.position}
    color={phase.color}
    isActive={phase.id === activePhase}
    isSelected={phase.id === selectedPhase}
    isLocked={phase.locked}
    editMode={editMode}
    isDraggable={editMode && !phase.locked}
    onClick={(e) => handleMarkerClick(phase.id, e)}
    onPositionChange={(newPos) => handleMarkerPositionChange(phase.id, newPos)}
    onStateCapture={(phaseId) => handlePhaseStateCapture(phaseId)}
    onDragEnd={deselectAllMarkers}
    hasSavedState={!!phase.state}
    sessionDuration={timeline.duration}
  />
))}
        </div>
      </div>
      
      <div className={timelinestyles.timelineControls}>
        <button 
          className={`${timelinestyles.controlButton} ${timelineIsPlaying ? timelinestyles.active : ''}`}
          onClick={toggleTimelinePlayback}
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
            Press and hold a marker to drag it. Tap a marker to save current audio layers and volumes.
          </div>
          
          {/* Add SessionSettings here when in edit mode */}
          {selectedPhase ? (
              <SessionSettings
              phaseId={selectedPhase}
              phaseName={phases.find(p => p.id === selectedPhase)?.name || ''}
              sessionDuration={timeline.duration}
              transitionDuration={transitionDuration}
              onDurationChange={onDurationChange}
              onTransitionDurationChange={onTransitionDurationChange}
              onSave={() => handleSavePhaseState(selectedPhase)}
              onClose={() => setSelectedPhase(null)}
              className={settingsStyles.timelineSettings}
            />
          ) : (
            /* Show global session settings when no phase is selected */
            <SessionSettings
              sessionDuration={timeline.duration}
              transitionDuration={transitionDuration}
              onDurationChange={onDurationChange}
              onTransitionDurationChange={onTransitionDurationChange}
              className={settingsStyles.timelineSettings}
            />
          )}
        </>
      )}
    </div>
  );
});


// Set display name for debugging
SessionTimeline.displayName = 'SessionTimeline';

export default SessionTimeline;
