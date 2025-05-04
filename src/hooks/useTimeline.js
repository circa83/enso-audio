// src/hooks/useTimeline.js
import { useState, useEffect, useCallback, useRef } from 'react';
import TimelineEngine from '../services/audio/TimelineEngine';
import logger from '../services/LoggingService';

/**
 * Hook for managing timeline functionality in the audio player
 * 
 * @param {Object} options - Configuration options
 * @param {Object} [options.timelineEngine] - Existing TimelineEngine instance (optional)
 * @param {boolean} [options.isPlaying=false] - Whether audio is currently playing
 * @param {Function} [options.onPhaseChange=null] - Callback for phase changes
 * @param {number} [options.sessionDuration=60000] - Session duration in ms (default: 1 minute)
 * @param {number} [options.transitionDuration=4000] - Transition duration in ms (default: 4 seconds)
 * @param {boolean} [options.enableLogging=false] - Enable detailed logging
 * @returns {Object} Timeline state and control functions
 */
export function useTimeline(options = {}) {
  const {
    timelineEngine: providedTimelineEngine,
    isPlaying = false,
    onPhaseChange = null,
    sessionDuration: initialSessionDuration = 60000, // 1 min default
    transitionDuration: initialTransitionDuration = 4000, // 4 seconds default
    enableLogging = false
  } = options;



  //=======STATE MANAGEMENT========
  //===============================

  // Timeline state
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelinePhases, setTimelinePhases] = useState([]);
  const [activePhase, setActivePhase] = useState(null);
  const [progress, setProgress] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(1 * 60 * 1000); // 1 min default
  const [transitionDuration, setTransitionDuration] = useState(4000); // 4 seconds default
  const [timelineIsPlaying, setTimelineIsPlaying] = useState(false);
  const [phasesLoaded, setPhasesLoaded] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentTransition, setCurrentTransition] = useState(null);

  // Refs for callback stability
  const isPlayingRef = useRef(isPlaying);
  const timelineEngineRef = useRef(providedTimelineEngine || null);
  const timelinePhasesRef = useRef(timelinePhases);

  // Update refs when dependencies change
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    timelinePhasesRef.current = timelinePhases;
  }, [isPlaying, timelinePhases]);



  //=======UTILITY FUNCTIONS========
  //===============================

  /**
    * Ensures the timeline engine is available
    * @returns {Object|null} The timeline engine or null if unavailable
    */
  const ensureTimelineEngine = useCallback(() => {
    if (!timelineEngineRef.current) {
      logger.error('useTimeline', 'Timeline engine is not available');
      return null;
    }
    return timelineEngineRef.current;
  }, []);


  /**
   * Synchronizes React state with the timeline engine state
   */
  const syncProgressWithEngine = useCallback(() => {
    const engine = ensureTimelineEngine();
    if (!engine) return;

    // Get current progress from TimelineEngine
    const currentProgress = engine.getProgress();

    // Update progress state if changed
    if (currentProgress !== progress) {
      setProgress(currentProgress);
    }

    // Get current phase from TimelineEngine
    const currentPhase = engine.getCurrentPhase();

    // Update active phase if changed
    if (currentPhase && (!activePhase || activePhase !== currentPhase.id)) {
      setActivePhase(currentPhase.id);
    }
  }, [activePhase, progress, ensureTimelineEngine]);



  //=======ENGINE CALLBACKS========
  //===============================

  // Set up phase change callback for creating a new TimelineEngine
  const handlePhaseChange = useCallback((phaseId, phaseData) => {
    logger.info('useTimeline', `Phase changed to: ${phaseId}`);
    setActivePhase(phaseId);

    // Call external handler if provided
    if (onPhaseChange) {
      onPhaseChange(phaseId, phaseData);
    }

    // Find the full phase data
    const phaseInfo = timelinePhasesRef.current.find(p => p.id === phaseId);

    // Broadcast event for components to listen to
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('timeline-phase-changed', {
        detail: {
          phaseId,
          phaseData: phaseInfo || phaseData,
          state: phaseData,
          progress: timelineEngineRef.current?.getProgress() || 0
        }
      });
      window.dispatchEvent(event);
    }
  }, [onPhaseChange]);

  // Set up progress callback
  const handleProgress = useCallback((progressValue, elapsedTime) => {
    setProgress(progressValue);
  }, []);

  // Set up event callback
  const handleScheduledEvent = useCallback((event) => {
    logger.info('useTimeline', 'Timeline event triggered:', event);

    // Dispatch custom event
    if (typeof window !== 'undefined') {
      const timelineEvent = new CustomEvent('timeline-event-triggered', {
        detail: event
      });
      window.dispatchEvent(timelineEvent);
    }
  }, []);

  // Set session duration
  const handleSetSessionDuration = useCallback((duration) => {
    try {
      if (typeof duration !== 'number' || duration <= 0) {
        logger.error('useTimeline', 'Invalid session duration:', duration);
        return false;
      }

      const engine = ensureTimelineEngine();
      if (!engine) return false;

      logger.info('useTimeline', `Setting session duration: ${duration}ms`);

      // Update engine
      const success = engine.setSessionDuration(duration);

      // Update React state
      if (success) {
        setSessionDuration(duration);
      }

      return success;
    } catch (error) {
      logger.error('useTimeline', 'Set session duration error:', error);
      return false;
    }
  }, [ensureTimelineEngine]);

  // Set transition duration
  const handleSetTransitionDuration = useCallback((duration) => {
    try {
      if (typeof duration !== 'number' || duration < 0) {
        logger.error('useTimeline', 'Invalid transition duration:', duration);
        return false;
      }

      const engine = ensureTimelineEngine();
      if (!engine) return false;

      logger.info('useTimeline', `Setting transition duration: ${duration}ms`);

      // Update engine
      const success = engine.setTransitionDuration(duration);

      // Update React state
      if (success) {
        setTransitionDuration(duration);
      }

      return success;
    } catch (error) {
      logger.error('useTimeline', 'Set transition duration error:', error);
      return false;
    }
  }, [ensureTimelineEngine]);






  //=======TIMELINE CONTROL METHODS========
  //=======================================

  // Start the timeline
  const startTimeline = useCallback(() => {
    try {
      const engine = ensureTimelineEngine();
      if (!engine) {
        logger.error('useTimeline', 'Cannot start timeline: TimelineEngine not available');
        return false;
      }

      // Ensure the audio is playing first - timeline should not auto-start audio
      if (!isPlayingRef.current) {
        logger.info('useTimeline', 'Audio is not playing, cannot start timeline');
        return false;
      }

      logger.info('useTimeline', 'Starting timeline with reset');

      // Reset the timeline state first
      engine.stop();

      // Start the timeline with reset option
      const started = engine.start({ reset: true });
      logger.info('useTimeline', 'TimelineEngine start result:', started);

      if (started) {
        setTimelineIsPlaying(true);
      }

      return started;
    } catch (error) {
      logger.error('useTimeline', 'Error starting timeline:', error);
      return false;
    }
  }, [ensureTimelineEngine]);
 
  // Stop the timeline
  const stopTimeline = useCallback(() => {
    try {
      const engine = ensureTimelineEngine();
      if (!engine) {
        logger.error('useTimeline', "Can't stop timeline: TimelineEngine missing");
        return false;
      }

      logger.info('useTimeline', 'Stopping timeline...');

      // Just stop the timeline without affecting audio playback
      const stopped = engine.stop();
      logger.info('useTimeline', 'TimelineEngine stop result:', stopped);

      if (stopped) {
        setTimelineIsPlaying(false);
        setProgress(0);
        setActivePhase(null);
      }

      return stopped;
    } catch (error) {
      logger.error('useTimeline', 'Error stopping timeline:', error);
      return false;
    }
  }, [ensureTimelineEngine]);

  // Pause the timeline (preserving position)
  const pauseTimeline = useCallback(() => {
    try {
      const engine = ensureTimelineEngine();
      if (!engine) {
        logger.error('useTimeline', "Can't pause timeline: TimelineEngine missing");
        return false;
      }

      logger.info('useTimeline', 'Pausing timeline (preserving position)...');

      // Use the pauseTimeline method if it exists, otherwise fall back to stop
      if (engine.pauseTimeline) {
        const paused = engine.pauseTimeline();
        logger.info('useTimeline', 'TimelineEngine pause result:', paused);

        if (paused) {
          setTimelineIsPlaying(false);
        }

        return paused;
      } else {
        // Fall back to stop if pause isn't available
        logger.info('useTimeline', 'pauseTimeline not available, using stop as fallback');
        const stopped = engine.stop();
        logger.info('useTimeline', 'TimelineEngine stop result:', stopped);

        if (stopped) {
          setTimelineIsPlaying(false);
        }

        return stopped;
      }
    } catch (error) {
      logger.error('useTimeline', 'Error pausing timeline:', error);
      return false;
    }
  }, [ensureTimelineEngine]);

  // Resume the timeline from current position
  const resumeTimeline = useCallback(() => {
    try {
      const engine = ensureTimelineEngine();
      if (!engine) {
        logger.error('useTimeline', "Can't resume timeline: TimelineEngine missing");
        return false;
      }

      logger.info('useTimeline', 'Resuming timeline from current position...');

      // Use the resumeTimeline method if it exists
      if (engine.resumeTimeline) {
        const resumed = engine.resumeTimeline();
        logger.info('useTimeline', 'TimelineEngine resume result:', resumed);

        if (resumed) {
          setTimelineIsPlaying(true);
        }

        return resumed;
      } else {
        // Fall back to start with reset:false if resume isn't available
        logger.info('useTimeline', 'resumeTimeline not available, using start with reset:false as fallback');
        const started = engine.start({ reset: false });
        logger.info('useTimeline', 'TimelineEngine start result:', started);

        if (started) {
          setTimelineIsPlaying(true);
        }

        return started;
      }
    } catch (error) {
      logger.error('useTimeline', 'Error resuming timeline:', error);
      return false;
    }
  }, [ensureTimelineEngine]);

  /**
   * Toggle timeline play/pause state
   * From TimelineManager
   */
  const toggleTimeline = useCallback(() => {
    if (timelineIsPlaying) {
      return pauseTimeline();
    } else {
      return resumeTimeline();
    }
  }, [timelineIsPlaying, pauseTimeline, resumeTimeline]);

  /**
   * Reset the timeline completely
   * From TimelineManager
   */
  const resetTimeline = useCallback(() => {
    try {
      const engine = ensureTimelineEngine();
      if (!engine) return false;

      logger.info('useTimeline', 'Resetting timeline');

      // Use reset method from TimelineEngine
      const success = engine.reset();

      if (success) {
        // Update React state
        setTimelineIsPlaying(false);
        setProgress(0);
        setActivePhase(null);
        return true;
      } else {
        logger.error('useTimeline', 'Failed to reset TimelineEngine');
        return false;
      }
    } catch (error) {
      logger.error('useTimeline', 'Reset timeline error:', error);
      return false;
    }
  }, [ensureTimelineEngine]);

  // Get current session time
  const getSessionTime = useCallback(() => {
    const engine = ensureTimelineEngine();
    if (engine && engine.getElapsedTime) {
      return engine.getElapsedTime();
    }
    return 0;
  }, [ensureTimelineEngine]);

  // Set current progress
  const handleSetProgress = useCallback((progressValue) => {
    try {
      if (typeof progressValue !== 'number' || isNaN(progressValue)) {
        logger.error('useTimeline', 'Invalid progress value:', progressValue);
        return false;
      }
      
      // Clamp progress value between 0-100
      const clampedProgress = Math.max(0, Math.min(100, progressValue));
      
      // Update React state
      setProgress(clampedProgress);
      
      logger.debug('useTimeline', `Progress updated to: ${clampedProgress.toFixed(2)}%`);
      return true;
    } catch (error) {
      logger.error('useTimeline', 'Set progress error:', error);
      return false;
    }
  }, []);



  //=======TRANSITION METHODS======
  //===============================

// Start a phase transition
const startTransition = useCallback((phaseId, options = {}) => {
  try {
    const engine = ensureTimelineEngine();
    if (!engine) return false;
    
    if (!engine.startPhaseTransition) {
      logger.error('useTimeline', 'startPhaseTransition not available');
      return false;
    }
    
    return engine.startPhaseTransition(phaseId, options);
  } catch (error) {
    logger.error('useTimeline', 'startTransition error:', error);
    return false;
  }
}, [ensureTimelineEngine]);

// Cancel a transition
const cancelTransition = useCallback(() => {
  try {
    const engine = ensureTimelineEngine();
    if (!engine || !engine.cancelTransition) return false;
    
    return engine.cancelTransition();
  } catch (error) {
    logger.error('useTimeline', 'cancelTransition error:', error);
    return false;
  }
}, [ensureTimelineEngine]);



  //=======TIMELINE CONTENT METHODS=====
  //====================================

  // Reset timeline event index
  const resetTimelineEventIndex = useCallback(() => {
    try {
      const engine = ensureTimelineEngine();
      if (!engine) return false;

      logger.info('useTimeline', 'Resetting timeline event index');

      engine.stop();
      if (engine.reset) {
        engine.reset();
      }

      return true;
    } catch (error) {
      logger.error('useTimeline', 'Reset timeline event index error:', error);
      return false;
    }
  }, [ensureTimelineEngine]);

  // Update timeline phases
  const updateTimelinePhases = useCallback((phases) => {
    try {
      const engine = ensureTimelineEngine();
      if (!phases || !Array.isArray(phases)) {
        logger.error('useTimeline', 'Invalid phases data');
        return false;
      }

      logger.info('useTimeline', `Updating timeline phases (${phases.length} phases)`);

      // Sort phases by position (from TimelineManager)
      const sortedPhases = [...phases].sort((a, b) => a.position - b.position);

      // Update React state
      setTimelinePhases(sortedPhases);

      // Set phases in engine
      if (engine && engine.setPhases) {
        engine.setPhases(sortedPhases);
      }

      // Set phases loaded flag (from TimelineManager)
      setPhasesLoaded(true);

      // Trigger an immediate phase check (from TimelineManager)
      if (engine && engine.checkCurrentPhase) {
        engine.checkCurrentPhase();
      }

      return true;
    } catch (error) {
      logger.error('useTimeline', 'Update timeline phases error:', error);
      return false;
    }
  }, [ensureTimelineEngine]);

  // Register a timeline event
  const registerTimelineEvent = useCallback((event) => {
    try {
      const engine = ensureTimelineEngine();
      if (!engine) return false;

      if (!event || !event.id || !event.time) {
        logger.error('useTimeline', 'Invalid event data', event);
        return false;
      }

      logger.info('useTimeline', `Registering timeline event: ${event.id} at ${event.time}ms`);

      // Add event to engine
      const success = engine.addEvent(event);

      // Update React state to match engine
      if (success && engine.getEvents) {
        setTimelineEvents(engine.getEvents());
      }

      return success;
    } catch (error) {
      logger.error('useTimeline', 'Register timeline event error:', error);
      return false;
    }
  }, [ensureTimelineEngine]);

  // Clear all timeline events
  const clearTimelineEvents = useCallback(() => {
    try {
      const engine = ensureTimelineEngine();
      if (!engine) return false;

      logger.info('useTimeline', 'Clearing all timeline events');

      // Use clearEvents method from TimelineEngine
      const success = engine.clearEvents ? engine.clearEvents() : false;

      // Update React state
      if (success) {
        setTimelineEvents([]);
      }

      return success;
    } catch (error) {
      logger.error('useTimeline', 'Clear timeline events error:', error);
      return false;
    }
  }, [ensureTimelineEngine]);




  //=======CONFIGURATION METHODS=====
  //=================================

  // Transition started state
  const handleTransitionStarted = useCallback((phaseId, phase, duration) => {
    logger.info('useTimeline', `Transition started to phase: ${phaseId}`);
    setIsTransitioning(true);
    setCurrentTransition({ phaseId, phase, duration, startTime: Date.now() });
  }, []);

  // Transition completed state
  const handleTransitionComplete = useCallback((phaseId, phase) => {
    logger.info('useTimeline', `Transition completed to phase: ${phaseId}`);
    setIsTransitioning(false);
    setCurrentTransition(null);
  }, []);



 //=======PHASE MANAGEMENT========
//===============================

  /**
   * Manually trigger a phase transition
   * From TimelineManager
   * @param {string} phaseId - ID of the phase to transition to
   */
  const handleManualPhaseTransition = useCallback((phaseId) => {
    try {
      const engine = ensureTimelineEngine();
      if (!engine) return false;

      if (!phaseId) {
        logger.error('useTimeline', 'No phase ID provided for manual transition');
        return false;
      }

      logger.info('useTimeline', `Manually transitioning to phase: ${phaseId}`);

      // Use triggerPhase method if available
      if (engine.triggerPhase) {
        return engine.triggerPhase(phaseId);
      } else {
        // Fallback if triggerPhase not available
        const phase = timelinePhasesRef.current.find(p => p.id === phaseId);
        if (!phase) {
          logger.error('useTimeline', `Phase ${phaseId} not found`);
          return false;
        }

        // Apply the phase state
        handlePhaseChange(phaseId, phase.state || {});
        return true;
      }
    } catch (error) {
      logger.error('useTimeline', 'Manual phase transition error:', error);
      return false;
    }
  }, [ensureTimelineEngine, handlePhaseChange]);

    /**
   * Checks for phase transitions
   * From TimelineManager
   */
    const checkPhaseTransitions = useCallback(() => {
      try {
        const engine = ensureTimelineEngine();
        if (!engine) return false;
  
        logger.debug('useTimeline', 'Manually checking phase transitions');
  
        // Use the checkCurrentPhase method from TimelineEngine
        const success = engine.checkCurrentPhase ? engine.checkCurrentPhase() : false;
  
        // Sync state with engine
        syncProgressWithEngine();
  
        return success;
      } catch (error) {
        logger.error('useTimeline', 'checkPhaseTransitions error:', error);
        return false;
      }
    }, [ensureTimelineEngine, syncProgressWithEngine]);
  

    

    /**
     * Updates progress and checks for phase transitions
     * From TimelineManager
     */
    const updateProgressAndCheckPhases = useCallback(() => {
      try {
        const engine = ensureTimelineEngine();
        if (!engine) return false;
  
        // Sync state with engine
        syncProgressWithEngine();
  
        // Check phases (if needed)
        if (engine.checkCurrentPhase) {
          engine.checkCurrentPhase();
        }
  
        return true;
      } catch (error) {
        logger.error('useTimeline', 'updateProgressAndCheckPhases error:', error);
        return false;
      }
    }, [ensureTimelineEngine, syncProgressWithEngine]);
  

  //=======NAVIGATION METHODS======
  //===============================

  /**
   * Seek to a specific time in the timeline
   * From TimelineManager
   * @param {number} timeMs - Time in milliseconds
   */
  const seekToTime = useCallback((timeMs) => {
    try {
      const engine = ensureTimelineEngine();
      if (!engine) return false;

      if (typeof timeMs !== 'number' || timeMs < 0) {
        logger.error('useTimeline', 'Invalid seek time:', timeMs);
        return false;
      }

      logger.info('useTimeline', `Seeking to time: ${timeMs}ms`);

      // Use the seekToTime method from TimelineEngine
      const success = engine.seekToTime ? engine.seekToTime(timeMs) : false;

      if (success) {
        // The engine will update progress internally, but sync state as well
        syncProgressWithEngine();

        // Tell the engine to check phases right away
        if (engine.checkCurrentPhase) {
          engine.checkCurrentPhase();
        }

        return true;
      } else {
        logger.error('useTimeline', 'Failed to seek in TimelineEngine');
        return false;
      }
    } catch (error) {
      logger.error('useTimeline', 'seekToTime error:', error);
      return false;
    }
  }, [ensureTimelineEngine, syncProgressWithEngine]);

  /**
   * Seek to a percentage position in the timeline
   * From TimelineManager
   * @param {number} percent - Position as percentage (0-100)
   */
  const seekToPercent = useCallback((percent) => {
    try {
      const engine = ensureTimelineEngine();
      if (!engine) return false;

      if (typeof percent !== 'number' || percent < 0 || percent > 100) {
        logger.error('useTimeline', 'Invalid seek percentage:', percent);
        return false;
      }

      logger.info('useTimeline', `Seeking to percent: ${percent}%`);

      // Calculate time in ms from percentage
      const timeMs = (percent / 100) * sessionDuration;

      // Use seekToTime method
      return seekToTime(timeMs);
    } catch (error) {
      logger.error('useTimeline', 'seekToPercent error:', error);
      return false;
    }
  }, [ensureTimelineEngine, sessionDuration, seekToTime]);




  //=======ENGINE INITIALIZATION=======
  //===================================


  // Initialize the TimelineEngine
  useEffect(() => {
    // If an engine is provided, use that
    if (providedTimelineEngine) {
      timelineEngineRef.current = providedTimelineEngine;
      logger.info('useTimeline', 'Using provided TimelineEngine instance');
    }
    // Otherwise create a new TimelineEngine
    else if (!timelineEngineRef.current) {
      try {
        logger.info('useTimeline', 'Creating new TimelineEngine instance');

        // Create a new TimelineEngine with required callbacks
        const engine = new TimelineEngine({
          onPhaseChange: handlePhaseChange,
          onProgress: handleProgress,
          onScheduledEvent: handleScheduledEvent,
          onScheduledEvent: handleScheduledEvent,
          onTransitionStart: handleTransitionStarted,
          onTransitionComplete: handleTransitionComplete,
          sessionDuration,
          transitionDuration,
          enableLogging
        });

        timelineEngineRef.current = engine;
        logger.info('useTimeline', 'TimelineEngine created successfully');
      } catch (error) {
        logger.error('useTimeline', 'Failed to create TimelineEngine:', error);
      }
    }

    // Configure the engine
    const engine = timelineEngineRef.current;
    if (engine) {
      engine.setSessionDuration(sessionDuration);
      engine.setTransitionDuration(transitionDuration);
    }

    // Cleanup on unmount
    return () => {
      const engine = timelineEngineRef.current;
      if (engine && engine.dispose) {
        engine.dispose();
      }
    };
  }, [
    providedTimelineEngine,
    handlePhaseChange,
    handleProgress,
    handleScheduledEvent,
    handleTransitionStarted,
    handleTransitionComplete,
    sessionDuration,
    transitionDuration,
    enableLogging
    
  ]);





  //=======PUBLIC API==============
  //===============================

  // Return public API
  return {
    // State
    isPlaying: timelineIsPlaying,
    progress,
    activePhase,
    sessionDuration,
    transitionDuration,
    timelinePhases,
    timelineEvents,
    phasesLoaded,
    isTransitioning,
    currentTransition,

    // Transition methods
    startTransition,
    cancelTransition,


  //Setters
  setPhasesLoaded,
  setActivePhase, 
  setProgress: handleSetProgress,

 

    // Core timeline control methods
    start: startTimeline,
    stop: stopTimeline,
    pause: pauseTimeline,
    resume: resumeTimeline,
    toggle: toggleTimeline,
    reset: resetTimeline,
    getTime: getSessionTime,

    // Timeline content methods 
    updatePhases: updateTimelinePhases,
    registerEvent: registerTimelineEvent,
    clearEvents: clearTimelineEvents,
    resetEventIndex: resetTimelineEventIndex,

    // Added from TimelineManager
    manualPhaseTransition: handleManualPhaseTransition,
    checkPhaseTransitions,
    updateProgressAndCheckPhases,
    syncProgressWithEngine,

    // Configuration methods
    setSessionDuration: handleSetSessionDuration,
    setTransitionDuration: handleSetTransitionDuration,

    // Navigation methods
    seekToTime,
    seekToPercent,

    // Engine access (for advanced usage)
    getEngine: ensureTimelineEngine
  };
}

export default useTimeline;
