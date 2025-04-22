// src/hooks/useTimeline.js
import { useState, useEffect, useCallback, useRef } from 'react';
import audioServiceManager from '../services/audio/AudioServiceManager';

/**
 * Hook for managing timeline functionality in the audio player
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.timelineEngine - The timeline engine service
 * @param {boolean} options.isPlaying - Whether audio is currently playing
 * @param {Function} options.onPhaseChange - Callback for phase changes
 * @returns {Object} Timeline state and control functions
 */
export function useTimeline(options = {}) {
  const {
    timelineEngine: provideTimelineEngine,
    isPlaying = false,
    onPhaseChange = null,
  } = options;
  
   // Use provided engine or get from manager
   const timelineEngine = audioServiceManager.getService('timelineEngine');


  // Timeline state
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelinePhases, setTimelinePhases] = useState([]);
  const [activePhase, setActivePhase] = useState(null);
  const [progress, setProgress] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(1 * 60 * 1000); // 1 min default
  const [transitionDuration, setTransitionDuration] = useState(4000); // 4 seconds default
  const [timelineIsPlaying, setTimelineIsPlaying] = useState(false);
  
  // Refs for callback stability
  const isPlayingRef = useRef(isPlaying);
  const timelineEngineRef = useRef(timelineEngine);
  
  // Update refs when dependencies change
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    timelineEngineRef.current = timelineEngine;
  }, [isPlaying, timelineEngine]);
  
  // Initialize timeline engine with callbacks
  useEffect(() => {
    if (!timelineEngine) return;
    
   console.log("[useTimeline] Initializing timeline engine with callbacks");
  
   // Register callbacks with the engine
   if (timelineEngine.onPhaseChange !== undefined) {
    timelineEngine.onPhaseChange = handlePhaseChange;
  }
  
  if (timelineEngine.onProgress !== undefined) {
    timelineEngine.onProgress = handleProgress;
  }
  
  if (timelineEngine.onScheduledEvent !== undefined) {
    timelineEngine.onScheduledEvent = handleScheduledEvent;
  }
  
  // Set initial configuration
  timelineEngine.setSessionDuration(sessionDuration);
  timelineEngine.setTransitionDuration(transitionDuration);
  
  // Clean up on unmount
  return () => {
    // Remove callbacks if the engine supports it
    if (timelineEngine.cleanup) {
      timelineEngine.cleanup();
    }
  };
}, [timelineEngine, onPhaseChange, sessionDuration, transitionDuration]);


    // Set up phase change callback
    const handlePhaseChange = (phaseId, phaseData) => {
      console.log(`[useTimeline] Phase changed to: ${phaseId}`);
      setActivePhase(phaseId);
      
      // Call external handler if provided
      if (onPhaseChange) {
        onPhaseChange(phaseId, phaseData);
      }
      
      // Broadcast event for components to listen to
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('timeline-phase-changed', { 
          detail: { phaseId, phaseData } 
        });
        window.dispatchEvent(event);
      }
    };
    
    // Set up progress callback
    const handleProgress = (progressValue, elapsedTime) => {
      setProgress(progressValue);
    };
    
    // Set up event callback
    const handleScheduledEvent = (event) => {
      console.log('[useTimeline] Timeline event triggered:', event);
    }; 
  
  // Start the timeline
  const startTimeline = useCallback(() => {
    const engine = timelineEngineRef.current;
    if (!engine) {
      console.error("[useTimeline] Cannot start timeline: TimelineEngine not available");
      return false;
    }

    // Ensure the audio is playing first - timeline should not auto-start audio
    if (!isPlayingRef.current) {
      console.log("[useTimeline] Audio is not playing, cannot start timeline");
      return false;
    }

    console.log("[useTimeline] Starting timeline with reset");
    
    // Reset the timeline state first
    engine.stop();
    
    // Start the timeline with reset option
    const started = engine.start({ reset: true });
    console.log("[useTimeline] TimelineEngine start result:", started);
    
    if (started) {
      setTimelineIsPlaying(true);
    }
    
    return started;
  }, []);

  // Stop the timeline
  const stopTimeline = useCallback(() => {
    const engine = timelineEngineRef.current;
    if (!engine) {
      console.log("[useTimeline] Can't stop timeline: TimelineEngine missing");
      return false;
    }
    
    console.log("[useTimeline] Stopping timeline...");
    
    // Just stop the timeline without affecting audio playback
    const stopped = engine.stop();
    console.log("[useTimeline] TimelineEngine stop result:", stopped);
    
    if (stopped) {
      setTimelineIsPlaying(false);
    }
    
    return stopped;
  }, []);

  // Pause the timeline (preserving position)
  const pauseTimeline = useCallback(() => {
    const engine = timelineEngineRef.current;
    if (!engine) {
      console.log("[useTimeline] Can't pause timeline: TimelineEngine missing");
      return false;
    }
    
    console.log("[useTimeline] Pausing timeline (preserving position)...");
    
    // Use the pauseTimeline method if it exists, otherwise fall back to stop
    if (engine.pauseTimeline) {
      const paused = engine.pauseTimeline();
      console.log("[useTimeline] TimelineEngine pause result:", paused);
      
      if (paused) {
        setTimelineIsPlaying(false);
      }
      
      return paused;
    } else {
      // Fall back to stop if pause isn't available
      console.log("[useTimeline] pauseTimeline not available, using stop as fallback");
      const stopped = engine.stop();
      console.log("[useTimeline] TimelineEngine stop result:", stopped);
      
      if (stopped) {
        setTimelineIsPlaying(false);
      }
      
      return stopped;
    }
  }, []);

  // Resume the timeline from current position
  const resumeTimeline = useCallback(() => {
    const engine = timelineEngineRef.current;
    if (!engine) {
      console.log("[useTimeline] Can't resume timeline: TimelineEngine missing");
      return false;
    }
    
    console.log("[useTimeline] Resuming timeline from current position...");
    
    // Use the resumeTimeline method if it exists
    if (engine.resumeTimeline) {
      const resumed = engine.resumeTimeline();
      console.log("[useTimeline] TimelineEngine resume result:", resumed);
      
      if (resumed) {
        setTimelineIsPlaying(true);
      }
      
      return resumed;
    } else {
      // Fall back to start with reset:false if resume isn't available
      console.log("[useTimeline] resumeTimeline not available, using start with reset:false as fallback");
      const started = engine.start({ reset: false });
      console.log("[useTimeline] TimelineEngine start result:", started);
      
      if (started) {
        setTimelineIsPlaying(true);
      }
      
      return started;
    }
  }, []);

  // Get current session time
  const getSessionTime = useCallback(() => {
    const engine = timelineEngineRef.current;
    if (engine && engine.getElapsedTime) {
      return engine.getElapsedTime();
    }
    return 0;
  }, []);

  // Reset timeline event index
  const resetTimelineEventIndex = useCallback(() => {
    const engine = timelineEngineRef.current;
    if (engine) {
      engine.stop();
      if (engine.reset) {
        engine.reset();
      }
    }
  }, []);

  // Update timeline phases
  const updateTimelinePhases = useCallback((phases) => {
    const engine = timelineEngineRef.current;
    if (!phases || !Array.isArray(phases)) return;
    
    console.log(`[useTimeline] Updating timeline phases (${phases.length} phases)`);
    setTimelinePhases(phases);
    
    if (engine && engine.setPhases) {
      engine.setPhases(phases);
    }
  }, []);

  // Register a timeline event
  const registerTimelineEvent = useCallback((event) => {
    const engine = timelineEngineRef.current;
    if (!event) return false;
    
    console.log(`[useTimeline] Registering timeline event: ${event.id || 'unnamed'}`);
    
    setTimelineEvents(prev => {
      const updatedEvents = [...prev, event].sort((a, b) => a.time - b.time);
      return updatedEvents;
    });
    
    if (engine && engine.addEvent) {
      engine.addEvent(event);
    }
    
    return true;
  }, []);

  // Clear all timeline events
  const clearTimelineEvents = useCallback(() => {
    const engine = timelineEngineRef.current;
    
    console.log("[useTimeline] Clearing all timeline events");
    setTimelineEvents([]);
    
    if (engine && engine.clearEvents) {
      engine.clearEvents();
    }
    
    return true;
  }, []);

  // Set session duration
  const handleSetSessionDuration = useCallback((duration) => {
    const engine = timelineEngineRef.current;
    
    console.log(`[useTimeline] Setting session duration: ${duration}ms`);
    setSessionDuration(duration);
    
    if (engine && engine.setSessionDuration) {
      engine.setSessionDuration(duration);
    }
    
    return true;
  }, []);
  
  // Set transition duration
  const handleSetTransitionDuration = useCallback((duration) => {
    const engine = timelineEngineRef.current;
    
    console.log(`[useTimeline] Setting transition duration: ${duration}ms`);
    setTransitionDuration(duration);
    
    if (engine && engine.setTransitionDuration) {
      engine.setTransitionDuration(duration);
    }
    
    return true;
  }, []);
  
  // Seek to specific time
  const seekToTime = useCallback((timeMs) => {
    const engine = timelineEngineRef.current;
    
    console.log(`[useTimeline] Seeking to time: ${timeMs}ms`);
    
    if (engine && engine.seekTo) {
      return engine.seekTo(timeMs);
    }
    return false;
  }, []);
  
  // Seek to percentage of total duration
  const seekToPercent = useCallback((percent) => {
    const engine = timelineEngineRef.current;
    
    console.log(`[useTimeline] Seeking to percent: ${percent}%`);
    
    if (engine && engine.seekToPercent) {
      return engine.seekToPercent(percent);
    }
    return false;
  }, []);

  // Return all timeline state and functions
  return {
    // Timeline state
    events: timelineEvents,
    phases: timelinePhases,
    activePhase,
    progress,
    duration: sessionDuration,
    transitionDuration,
    isPlaying: timelineIsPlaying,
    
    // Timeline control functions
    start: startTimeline,
    stop: stopTimeline,
    pause: pauseTimeline,
    resume: resumeTimeline,
    getTime: getSessionTime,
    reset: resetTimelineEventIndex,
    
    // Timeline configuration functions
    registerEvent: registerTimelineEvent,
    clearEvents: clearTimelineEvents,
    updatePhases: updateTimelinePhases,
    seekToTime,
    seekToPercent,
    setDuration: handleSetSessionDuration,
    setTransitionDuration: handleSetTransitionDuration
  };
}

export default useTimeline;
