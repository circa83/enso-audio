// src/contexts/TimelineContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import TimelineService from '../services/TimelineService';
import { useAudioService } from './AudioServiceContext';
import { useVolumeService } from './VolumeContext';
import { useCrossfadeService } from './CrossfadeContext';
import eventBus from '../services/EventBus';

// Create the context
const TimelineContext = createContext(null);

/**
 * Provider component for timeline management
 */
export const TimelineProvider = ({ 
  children, 
  initialSessionDuration = 3600000, // 1 hour default
  initialTransitionDuration = 4000, // 4 seconds default
  initialPhases = []
}) => {
  // Get dependencies from other services
  const { audioContext, masterGain, initialized } = useAudioService();
  const volumeService = useVolumeService();
  const crossfadeService = useCrossfadeService();

  // Service reference
  const [timelineService, setTimelineService] = useState(null);

  // Timeline state
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelinePhases, setTimelinePhases] = useState(initialPhases);
  const [activePhase, setActivePhase] = useState(null);
  const [progress, setProgress] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(initialSessionDuration);
  const [transitionDuration, setTransitionDuration] = useState(initialTransitionDuration);
  const [timelineIsPlaying, setTimelineIsPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  // Define callbacks outside useEffect for stability
  const handlePhaseChange = useCallback((phaseId, phaseData) => {
    console.log(`[TimelineContext] Phase changed to: ${phaseId}`);
    setActivePhase(phaseId);
    
    // Broadcast event for components to listen to
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('timeline-phase-changed', { 
        detail: { phaseId, phaseData } 
      });
      window.dispatchEvent(event);
    }
    
    // Publish event through event bus
    eventBus.emit('timeline:phaseChanged', { phaseId, phaseData });
  }, []);

  const handleProgress = useCallback((progressValue, elapsedTime) => {
    setProgress(progressValue);
    
    // Publish event through event bus
    eventBus.emit('timeline:progress', { progress: progressValue, elapsedTime });
  }, []);

  const handleScheduledEvent = useCallback((event) => {
    console.log('[TimelineContext] Timeline event triggered:', event);
    
    // Publish event through event bus
    eventBus.emit('timeline:eventTriggered', event);
  }, []);

  // Initialize TimelineService when dependencies are ready
  useEffect(() => {
    // Check if dependencies are ready
    const dependenciesReady = initialized && 
                             audioContext && 
                             volumeService && 
                             crossfadeService;
    
    if (!dependenciesReady) {
      console.log('[TimelineContext] Waiting for dependencies...');
      return;
    }

    try {
      console.log('[TimelineContext] Initializing TimelineService...');
      
      const service = new TimelineService({
        volumeController: volumeService,
        crossfadeEngine: crossfadeService,
        sessionDuration,
        transitionDuration,
        onPhaseChange: handlePhaseChange,
        onProgress: handleProgress,
        onScheduledEvent: handleScheduledEvent,
        defaultPhases: timelinePhases.length > 0 ? timelinePhases : undefined,
        enableLogging: true
      });

      setTimelineService(service);
      setReady(true);
      
      // If we have initial phases, set them
      if (timelinePhases.length > 0) {
        service.setPhases(timelinePhases);
      }

      console.log('[TimelineContext] TimelineService initialized successfully');

      // Clean up on unmount
      return () => {
        if (service && typeof service.dispose === 'function') {
          service.dispose();
        }
      };
    } catch (error) {
      console.error('[TimelineContext] Error initializing TimelineService:', error);
    }
  }, [
    initialized, 
    audioContext, 
    volumeService, 
    crossfadeService, 
    sessionDuration, 
    transitionDuration, 
    handlePhaseChange, 
    handleProgress, 
    handleScheduledEvent,
    timelinePhases
  ]);

  // Timeline control methods
  const startTimeline = useCallback((options = {}) => {
    if (!timelineService) {
      console.error("[TimelineContext] Cannot start timeline: TimelineService not available");
      return false;
    }

    console.log("[TimelineContext] Starting timeline with options:", options);
    
    const started = timelineService.start(options);
    console.log("[TimelineContext] TimelineService start result:", started);
    
    if (started) {
      setTimelineIsPlaying(true);
      eventBus.emit('timeline:started', { reset: options.reset });
    }
    
    return started;
  }, [timelineService]);

  const stopTimeline = useCallback(() => {
    if (!timelineService) {
      console.log("[TimelineContext] Can't stop timeline: TimelineService missing");
      return false;
    }
    
    console.log("[TimelineContext] Stopping timeline...");
    
    const stopped = timelineService.stop();
    console.log("[TimelineContext] TimelineService stop result:", stopped);
    
    if (stopped) {
      setTimelineIsPlaying(false);
      eventBus.emit('timeline:stopped');
    }
    
    return stopped;
  }, [timelineService]);

  const pauseTimeline = useCallback(() => {
    if (!timelineService) {
      console.log("[TimelineContext] Can't pause timeline: TimelineService missing");
      return false;
    }
    
    console.log("[TimelineContext] Pausing timeline (preserving position)...");
    
    // Use the pauseTimeline method if it exists, otherwise fall back to stop
    if (timelineService.pauseTimeline) {
      const paused = timelineService.pauseTimeline();
      console.log("[TimelineContext] TimelineService pause result:", paused);
      
      if (paused) {
        setTimelineIsPlaying(false);
        eventBus.emit('timeline:paused');
      }
      
      return paused;
    } else {
      // Fall back to stop if pause isn't available
      console.log("[TimelineContext] pauseTimeline not available, using stop as fallback");
      const stopped = timelineService.stop();
      console.log("[TimelineContext] TimelineService stop result:", stopped);
      
      if (stopped) {
        setTimelineIsPlaying(false);
        eventBus.emit('timeline:paused');
      }
      
      return stopped;
    }
  }, [timelineService]);

  const resumeTimeline = useCallback(() => {
    if (!timelineService) {
      console.log("[TimelineContext] Can't resume timeline: TimelineService missing");
      return false;
    }
    
    console.log("[TimelineContext] Resuming timeline from current position...");
    
    // Use the resumeTimeline method if it exists
    if (timelineService.resumeTimeline) {
      const resumed = timelineService.resumeTimeline();
      console.log("[TimelineContext] TimelineService resume result:", resumed);
      
      if (resumed) {
        setTimelineIsPlaying(true);
        eventBus.emit('timeline:resumed');
      }
      
      return resumed;
    } else {
      // Fall back to start with reset:false if resume isn't available
      console.log("[TimelineContext] resumeTimeline not available, using start with reset:false as fallback");
      const started = timelineService.start({ reset: false });
      console.log("[TimelineContext] TimelineService start result:", started);
      
      if (started) {
        setTimelineIsPlaying(true);
        eventBus.emit('timeline:resumed');
      }
      
      return started;
    }
  }, [timelineService]);

  // Get current session time
  const getSessionTime = useCallback(() => {
    if (!timelineService) return 0;
    return timelineService.getElapsedTime();
  }, [timelineService]);

  // Reset timeline event index
  const resetTimelineEventIndex = useCallback(() => {
    if (!timelineService) return false;
    
    timelineService.stop();
    
    if (timelineService.reset) {
      timelineService.reset();
      return true;
    }
    
    return false;
  }, [timelineService]);

  // Update timeline phases
  const updateTimelinePhases = useCallback((phases) => {
    if (!phases || !Array.isArray(phases)) return false;
    
    console.log(`[TimelineContext] Updating timeline phases (${phases.length} phases)`);
    setTimelinePhases(phases);
    
    if (timelineService && timelineService.setPhases) {
      return timelineService.setPhases(phases);
    }
    
    return false;
  }, [timelineService]);

  // Register a timeline event
  const registerTimelineEvent = useCallback((event) => {
    if (!event) return false;
    
    console.log(`[TimelineContext] Registering timeline event: ${event.id || 'unnamed'}`);
    
    setTimelineEvents(prev => {
      const updatedEvents = [...prev, event].sort((a, b) => a.time - b.time);
      return updatedEvents;
    });
    
    if (timelineService && timelineService.addEvent) {
      return timelineService.addEvent(event);
    }
    
    return false;
  }, [timelineService]);

  // Clear all timeline events
  const clearTimelineEvents = useCallback(() => {
    console.log("[TimelineContext] Clearing all timeline events");
    setTimelineEvents([]);
    
    if (timelineService && timelineService.clearEvents) {
      return timelineService.clearEvents();
    }
    
    return false;
  }, [timelineService]);

  // Set session duration
  const handleSetSessionDuration = useCallback((duration) => {
    if (typeof duration !== 'number' || duration <= 0) {
      console.error('[TimelineContext] Invalid session duration:', duration);
      return false;
    }
    
    console.log(`[TimelineContext] Setting session duration: ${duration}ms`);
    setSessionDuration(duration);
    
    if (timelineService && timelineService.setSessionDuration) {
      return timelineService.setSessionDuration(duration);
    }
    
    return false;
  }, [timelineService]);
  
  // Set transition duration
  const handleSetTransitionDuration = useCallback((duration) => {
    if (typeof duration !== 'number' || duration < 0) {
      console.error('[TimelineContext] Invalid transition duration:', duration);
      return false;
    }
    
    console.log(`[TimelineContext] Setting transition duration: ${duration}ms`);
    setTransitionDuration(duration);
    
    if (timelineService && timelineService.setTransitionDuration) {
      return timelineService.setTransitionDuration(duration);
    }
    
    return false;
  }, [timelineService]);
  
  // Seek to specific time
  const seekToTime = useCallback((timeMs) => {
    if (typeof timeMs !== 'number' || timeMs < 0) {
      console.error('[TimelineContext] Invalid seek time:', timeMs);
      return false;
    }
    
    console.log(`[TimelineContext] Seeking to time: ${timeMs}ms`);
    
    if (timelineService && timelineService.seekTo) {
      return timelineService.seekTo(timeMs);
    }
    
    return false;
  }, [timelineService]);
  
  // Seek to percentage of total duration
  const seekToPercent = useCallback((percent) => {
    if (typeof percent !== 'number' || percent < 0 || percent > 100) {
      console.error('[TimelineContext] Invalid seek percentage:', percent);
      return false;
    }
    
    console.log(`[TimelineContext] Seeking to percent: ${percent}%`);
    
    if (timelineService && timelineService.seekToPercent) {
      return timelineService.seekToPercent(percent);
    }
    
    return false;
  }, [timelineService]);

  // Create memoized context value
  const contextValue = useMemo(() => ({
    // State
    events: timelineEvents,
    phases: timelinePhases,
    activePhase,
    progress,
    duration: sessionDuration,
    transitionDuration,
    isPlaying: timelineIsPlaying,
    ready,
    
    // Control functions
    start: startTimeline,
    stop: stopTimeline,
    pause: pauseTimeline,
    resume: resumeTimeline,
    getTime: getSessionTime,
    reset: resetTimelineEventIndex,
    
    // Configuration functions
    registerEvent: registerTimelineEvent,
    clearEvents: clearTimelineEvents,
    updatePhases: updateTimelinePhases,
    seekToTime,
    seekToPercent,
    setDuration: handleSetSessionDuration,
    setTransitionDuration: handleSetTransitionDuration,
    
    // Service access for advanced usage
    service: timelineService
  }), [
    timelineEvents,
    timelinePhases,
    activePhase,
    progress,
    sessionDuration,
    transitionDuration,
    timelineIsPlaying,
    ready,
    startTimeline,
    stopTimeline,
    pauseTimeline,
    resumeTimeline,
    getSessionTime,
    resetTimelineEventIndex,
    registerTimelineEvent,
    clearTimelineEvents,
    updateTimelinePhases,
    seekToTime,
    seekToPercent,
    handleSetSessionDuration,
    handleSetTransitionDuration,
    timelineService
  ]);

  return (
    <TimelineContext.Provider value={contextValue}>
      {children}
    </TimelineContext.Provider>
  );
};

/**
 * Custom hook to use the timeline context
 * @returns {Object} Timeline context value
 */
export const useTimelineContext = () => {
    const context = useContext(TimelineContext);
    if (!context) {
      throw new Error('useTimelineContext must be used within a TimelineProvider');
    }
    return context;
  };
  
  /**
   * Access the timeline service directly (for service-to-service integration)
   * @returns {Object|null} Timeline service instance
   */
  export const useTimelineService = () => {
    const context = useContext(TimelineContext);
    if (!context) {
      console.warn('useTimelineService called outside of TimelineProvider');
      return null;
    }
    return context.service;
  };
  
  export default TimelineContext;
  