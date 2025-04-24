// src/contexts/TimelineContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import TimelineService, { TIMELINE_EVENTS } from '../services/TimelineService';
import { useAudioService } from './AudioContext.js';
import { useVolumeService } from './VolumeContext';
import { useCrossfadeService } from './CrossfadeContext';
import eventBus, { EVENTS } from '../services/EventBus.js';

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
  const [serviceStats, setServiceStats] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [lastOperation, setLastOperation] = useState({ type: 'init', timestamp: Date.now() });

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

    // Publish event through event bus (standard event)
    eventBus.emit(EVENTS.TIMELINE_PHASE_CHANGED || 'timeline:phaseChanged', {
      phaseId,
      phaseData,
      timestamp: Date.now()
    });
  }, []);

  const handleProgress = useCallback((progressValue, elapsedTime) => {
    setProgress(progressValue);

    // Publish event through event bus
    eventBus.emit(EVENTS.TIMELINE_PROGRESS || 'timeline:progress', {
      progress: progressValue,
      elapsedTime,
      timestamp: Date.now()
    });
  }, []);

  const handleScheduledEvent = useCallback((event) => {
    console.log('[TimelineContext] Timeline event triggered:', event);

    // Publish event through event bus
    eventBus.emit(EVENTS.TIMELINE_EVENT_TRIGGERED || 'timeline:eventTriggered', {
      ...event,
      timestamp: Date.now()
    });
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
        enableLogging: true,
        enableEventBus: true // Enable EventBus explicitly
      });

      setTimelineService(service);
      setServiceStats(service.getStats());
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
      setLastError(error.message);
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

  // Set up event listeners for phase transitions and other timeline events
  useEffect(() => {
    if (!timelineService) return;

    // Handler for the new detailed phase transition events
    const handlePhaseTransition = (data) => {
      console.log('[TimelineContext] Phase transition event received:', data);
      const { phaseId, phaseData, previousPhaseId } = data;
      
      // Update our local state
      setActivePhase(phaseId);
      
      // Update last operation for tracking
      setLastOperation({
        type: 'phaseTransition',
        phaseId,
        previousPhaseId,
        timestamp: data.timestamp
      });
      
      // Forward the event to any components that need it via standard DOM events
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('timeline-phase-transition', {
          detail: data
        });
        window.dispatchEvent(event);
      }
    };

    // Event handlers for standard timeline events
    const handleStarted = (data) => {
      console.log('[TimelineContext] Timeline started', data);
      setTimelineIsPlaying(true);
      setLastOperation({ type: 'started', timestamp: data.timestamp, reset: data.reset });
    };

    const handleStopped = (data) => {
      console.log('[TimelineContext] Timeline stopped', data);
      setTimelineIsPlaying(false);
      setLastOperation({ type: 'stopped', timestamp: data.timestamp });
    };

    const handlePaused = (data) => {
      console.log('[TimelineContext] Timeline paused', data);
      setTimelineIsPlaying(false);
      setLastOperation({ type: 'paused', timestamp: data.timestamp });
    };

    const handleResumed = (data) => {
      console.log('[TimelineContext] Timeline resumed', data);
      setTimelineIsPlaying(true);
      setLastOperation({ type: 'resumed', timestamp: data.timestamp });
    };

    const handlePhaseChanged = (data) => {
      console.log('[TimelineContext] Timeline phase changed (legacy event)', data);
      setActivePhase(data.phaseId);
      setLastOperation({
        type: 'phaseChanged',
        phaseId: data.phaseId,
        timestamp: data.timestamp
      });
    };

    const handleEventTriggered = (data) => {
      console.log('[TimelineContext] Timeline event triggered', data);
      setLastOperation({
        type: 'eventTriggered',
        eventId: data.event.id,
        timestamp: data.timestamp
      });
    };

    const handlePhasesUpdated = (data) => {
      console.log('[TimelineContext] Timeline phases updated', data);
      setTimelinePhases(data.phases);
      setLastOperation({
        type: 'phasesUpdated',
        count: data.count,
        timestamp: data.timestamp
      });
    };

    const handleDurationChanged = (data) => {
      console.log('[TimelineContext] Session duration changed', data);
      setSessionDuration(data.newDuration);
      setLastOperation({
        type: 'durationChanged',
        newDuration: data.newDuration,
        timestamp: data.timestamp
      });
    };

    const handleTransitionChanged = (data) => {
      console.log('[TimelineContext] Transition duration changed', data);
      setTransitionDuration(data.newDuration);
      setLastOperation({
        type: 'transitionDurationChanged',
        newDuration: data.newDuration,
        timestamp: data.timestamp
      });
    };

    const handleEventRegistered = (data) => {
      console.log('[TimelineContext] Timeline event registered', data);
      // Update our events list
      setTimelineEvents(prev => [
        ...prev,
        data.event
      ].sort((a, b) => a.time - b.time));
      setLastOperation({
        type: 'eventRegistered',
        eventId: data.event.id,
        timestamp: data.timestamp
      });
    };

    const handleEventsCleared = (data) => {
      console.log('[TimelineContext] Timeline events cleared', data);
      setTimelineEvents([]);
      setLastOperation({
        type: 'eventsCleared',
        count: data.count,
        timestamp: data.timestamp
      });
    };

    const handleError = (data) => {
      console.error('[TimelineContext] Timeline error:', data);
      setLastError(data.message);
      setLastOperation({
        type: 'error',
        operation: data.operation,
        message: data.message,
        timestamp: data.timestamp
      });
    };

    // Register event handlers - including the new phase transition event
    eventBus.on('timeline:phaseTransition', handlePhaseTransition);
    eventBus.on(TIMELINE_EVENTS.STARTED, handleStarted);
    eventBus.on(TIMELINE_EVENTS.STOPPED, handleStopped);
    eventBus.on(TIMELINE_EVENTS.PAUSED, handlePaused);
    eventBus.on(TIMELINE_EVENTS.RESUMED, handleResumed);
    eventBus.on(TIMELINE_EVENTS.PHASE_CHANGED, handlePhaseChanged);
    eventBus.on(TIMELINE_EVENTS.EVENT_TRIGGERED, handleEventTriggered);
    eventBus.on(TIMELINE_EVENTS.PHASES_UPDATED, handlePhasesUpdated);
    eventBus.on(TIMELINE_EVENTS.DURATION_CHANGED, handleDurationChanged);
    eventBus.on(TIMELINE_EVENTS.TRANSITION_CHANGED, handleTransitionChanged);
    eventBus.on(TIMELINE_EVENTS.EVENT_REGISTERED, handleEventRegistered);
    eventBus.on(TIMELINE_EVENTS.EVENTS_CLEARED, handleEventsCleared);
    eventBus.on(TIMELINE_EVENTS.ERROR, handleError);

    // Poll for stats updates periodically
    const statsInterval = setInterval(() => {
      if (timelineService) {
        setServiceStats(timelineService.getStats());
      }
    }, 2000);

    // Clean up event listeners and interval
    return () => {
      eventBus.off('timeline:phaseTransition', handlePhaseTransition);
      eventBus.off(TIMELINE_EVENTS.STARTED, handleStarted);
      eventBus.off(TIMELINE_EVENTS.STOPPED, handleStopped);
      eventBus.off(TIMELINE_EVENTS.PAUSED, handlePaused);
      eventBus.off(TIMELINE_EVENTS.RESUMED, handleResumed);
      eventBus.off(TIMELINE_EVENTS.PHASE_CHANGED, handlePhaseChanged);
      eventBus.off(TIMELINE_EVENTS.EVENT_TRIGGERED, handleEventTriggered);
      eventBus.off(TIMELINE_EVENTS.PHASES_UPDATED, handlePhasesUpdated);
      eventBus.off(TIMELINE_EVENTS.DURATION_CHANGED, handleDurationChanged);
      eventBus.off(TIMELINE_EVENTS.TRANSITION_CHANGED, handleTransitionChanged);
      eventBus.off(TIMELINE_EVENTS.EVENT_REGISTERED, handleEventRegistered);
      eventBus.off(TIMELINE_EVENTS.EVENTS_CLEARED, handleEventsCleared);
      eventBus.off(TIMELINE_EVENTS.ERROR, handleError);

      clearInterval(statsInterval);
    };
  }, [timelineService]);

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
      eventBus.emit(EVENTS.TIMELINE_STARTED || 'timeline:started', { 
        reset: options.reset,
        timestamp: Date.now() 
      });
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
      eventBus.emit(EVENTS.TIMELINE_STOPPED || 'timeline:stopped', { 
        timestamp: Date.now() 
      });
    }

    return stopped;
  }, [timelineService]);

  const pauseTimeline = useCallback(() => {
    if (!timelineService) {
      console.log("[TimelineContext] Can't pause timeline: TimelineService missing");
      return false;
    }

    console.log("[TimelineContext] Pausing timeline (preserving position)...");

    // Use the pauseTimeline method
    const paused = timelineService.pauseTimeline();
    console.log("[TimelineContext] TimelineService pause result:", paused);

    if (paused) {
      setTimelineIsPlaying(false);
      eventBus.emit(EVENTS.TIMELINE_PAUSED || 'timeline:paused', { 
        timestamp: Date.now() 
      });
    }

    return paused;
  }, [timelineService]);

  const resumeTimeline = useCallback(() => {
    if (!timelineService) {
      console.log("[TimelineContext] Can't resume timeline: TimelineService missing");
      return false;
    }

    console.log("[TimelineContext] Resuming timeline from current position...");

    // Use the resumeTimeline method
    const resumed = timelineService.resumeTimeline();
    console.log("[TimelineContext] TimelineService resume result:", resumed);

    if (resumed) {
      setTimelineIsPlaying(true);
      eventBus.emit(EVENTS.TIMELINE_RESUMED || 'timeline:resumed', { 
        timestamp: Date.now() 
      });
    }

    return resumed;
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
      eventBus.emit(EVENTS.TIMELINE_RESET || 'timeline:reset', { 
        timestamp: Date.now() 
      });
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
      const result = timelineService.setPhases(phases);
      
      // Manual event emission to ensure context stays in sync with service
      if (result) {
        eventBus.emit(EVENTS.TIMELINE_PHASES_UPDATED || 'timeline:phasesUpdated', { 
          phases, 
          count: phases.length,
          timestamp: Date.now() 
        });
      }
      
      return result;
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
      const result = timelineService.addEvent(event);
      
      // Manual event emission for consistency
      if (result) {
        eventBus.emit(EVENTS.TIMELINE_EVENT_REGISTERED || 'timeline:eventRegistered', { 
          event,
          timestamp: Date.now() 
        });
      }
      
      return result;
    }
    
    return false;
  }, [timelineService]);

  // Clear all timeline events
  const clearTimelineEvents = useCallback(() => {
    console.log("[TimelineContext] Clearing all timeline events");
    setTimelineEvents([]);
    
    if (timelineService && timelineService.clearEvents) {
      const count = timelineService.clearEvents();
      
      // Manual event emission for consistency
      eventBus.emit(EVENTS.TIMELINE_EVENTS_CLEARED || 'timeline:eventsCleared', { 
        count,
        timestamp: Date.now() 
      });
      
      return true;
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
      const result = timelineService.setSessionDuration(duration);
      
      // Manual event emission for consistency
      if (result) {
        eventBus.emit(EVENTS.TIMELINE_DURATION_CHANGED || 'timeline:durationChanged', { 
          newDuration: duration,
          timestamp: Date.now() 
        });
      }
      
      return result;
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
      const result = timelineService.setTransitionDuration(duration);
      
      // Manual event emission for consistency
      if (result) {
        eventBus.emit(EVENTS.TIMELINE_TRANSITION_CHANGED || 'timeline:transitionChanged', { 
          newDuration: duration,
          timestamp: Date.now() 
        });
      }
      
      return result;
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
      const result = timelineService.seekTo(timeMs);
      
      // Manual event emission for consistency
      if (result) {
        eventBus.emit(EVENTS.TIMELINE_SEEK || 'timeline:seek', { 
          time: timeMs,
          type: 'absolute',
          timestamp: Date.now() 
        });
      }
      
      return result;
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
      const result = timelineService.seekToPercent(percent);
      
      // Manual event emission for consistency
      if (result) {
        eventBus.emit(EVENTS.TIMELINE_SEEK || 'timeline:seek', { 
          percent: percent,
          type: 'percent',
          timestamp: Date.now() 
        });
      }
      
      return result;
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
    stats: serviceStats,
    lastError,
    lastOperation,
    
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
    serviceStats,
    lastError,
    lastOperation,
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
