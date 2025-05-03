// /**
//  * TimelineManager.js
//  * 
//  * Adapter connecting TimelineEngine to React state management
//  * Delegates core timeline functionality to TimelineEngine
//  */
// import logger from '../../services/LoggingService';

// const createTimelineManager = ({
//   // Refs
//   serviceRef,
//   progressTimerRef,
//   nextEventIndexRef,
//   isPlayingRef,
  
//   // State values
//   timelinePhases,
//   activePhase,
//   timelineEvents,
//   progress,
//   sessionDuration,
//   transitionDuration,
//   timelineIsPlaying,
//   phasesLoaded,
  
//   // State setters
//   setTimelineIsPlaying,
//   setProgress,
//   setActivePhase,
//   setTimelineEvents,
//   setTimelinePhases,
//   setSessionDuration,
//   setTransitionDuration,
//   setPhasesLoaded
// }) => {
//   /**
//    * Initializes the TimelineEngine if not already initialized
//    * @returns {Object|null} TimelineEngine instance or null if initialization failed
//    * @private
//    */
//   const ensureTimelineEngine = () => {
//     if (!serviceRef.current) {
//       logger.error('TimelineManager', 'Service reference is unavailable');
//       return null;
//     }
    
//     if (!serviceRef.current.timelineEngine) {
//       logger.error('TimelineManager', 'TimelineEngine not initialized');
//       return null;
//     }
    
//     return serviceRef.current.timelineEngine;
//   };

//   /**
//    * Updates React state based on TimelineEngine progress
//    * Called periodically to sync UI with engine state
//    */
//   const syncProgressWithEngine = () => {
//     const engine = ensureTimelineEngine();
//     if (!engine) return;
    
//     // Get current progress from TimelineEngine
//     const currentProgress = engine.getProgress();
    
//     // Update progress state if changed
//     if (currentProgress !== progress) {
//       setProgress(currentProgress);
//     }
    
//     // Get current phase from TimelineEngine
//     const currentPhase = engine.getCurrentPhase();
    
//     // Update active phase if changed
//     if (currentPhase && (!activePhase || activePhase !== currentPhase.id)) {
//       setActivePhase(currentPhase.id);
//     }
//   };

//   /**
//    * Setup event handlers for TimelineEngine callbacks
//    * @private
//    */
//   const setupEngineCallbacks = () => {
//     const engine = ensureTimelineEngine();
//     if (!engine) return;
    
//     // Set up the phase change callback
//     engine.onPhaseChange = (phaseId, phaseState) => {
//       logger.info('TimelineManager', `Phase changed: ${phaseId}`);
      
//       // Update state
//       setActivePhase(phaseId);
      
//       // Find the full phase data
//       const phaseData = timelinePhases.find(p => p.id === phaseId);
      
//       // Dispatch event for other components
//       if (phaseData) {
//         const phaseChangeEvent = new CustomEvent('timeline-phase-changed', {
//           detail: {
//             phaseId,
//             phaseData,
//             state: phaseState,
//             progress: engine.getProgress()
//           }
//         });
        
//         window.dispatchEvent(phaseChangeEvent);
//       }
//     };
    
//     // Set up progress update callback
//     engine.onProgress = (progressPercent, timeMs) => {
//       setProgress(progressPercent);
//     };
    
//     // Set up scheduled event callback
//     engine.onScheduledEvent = (event) => {
//       logger.info('TimelineManager', `Event triggered: ${event.id}`);
      
//       // Dispatch event for other components
//       const timelineEvent = new CustomEvent('timeline-event-triggered', {
//         detail: event
//       });
      
//       window.dispatchEvent(timelineEvent);
//     };
//   };

//   /**
//    * Updates timeline phases in both state and engine
//    * @param {Array} phases - New timeline phases
//    * @returns {boolean} Success status
//    */
//   const handleUpdateTimelinePhases = (phases) => {
//     try {
//       const engine = ensureTimelineEngine();
//       if (!engine) return false;
      
//       if (!phases || !Array.isArray(phases)) {
//         logger.error('TimelineManager', 'Invalid phases data');
//         return false;
//       }
      
//       logger.info('TimelineManager', `Updating timeline phases (${phases.length} phases)`);
      
//       // Sort phases by position
//       const sortedPhases = [...phases].sort((a, b) => a.position - b.position);
      
//       // Update React state
//       setTimelinePhases(sortedPhases);
      
//       // Update TimelineEngine with the new phases
//       const success = engine.setPhases(sortedPhases);
      
//       // Set phases loaded flag
//       setPhasesLoaded(true);
      
//       // Trigger an immediate phase check
//       engine.checkCurrentPhase();
      
//       return success;
//     } catch (error) {
//       logger.error('TimelineManager', 'handleUpdateTimelinePhases error:', error);
//       return false;
//     }
//   };

//   /**
//    * Starts timeline progression
//    * @returns {boolean} Success status
//    */
//   const handleStartTimeline = () => {
//     try {
//       const engine = ensureTimelineEngine();
//       if (!engine) return false;
      
//       logger.info('TimelineManager', 'Starting timeline progression');
      
//       // Start the engine with reset option
//       const success = engine.start({ reset: true });
      
//       if (success) {
//         // Update React state
//         setTimelineIsPlaying(true);
        
//         // Set up engine callbacks if needed
//         setupEngineCallbacks();
        
//         return true;
//       } else {
//         logger.error('TimelineManager', 'Failed to start TimelineEngine');
//         return false;
//       }
//     } catch (error) {
//       logger.error('TimelineManager', 'handleStartTimeline error:', error);
//       return false;
//     }
//   };

//   /**
//    * Pauses timeline progression
//    * @returns {boolean} Success status
//    */
//   const handlePauseTimeline = () => {
//     try {
//       const engine = ensureTimelineEngine();
//       if (!engine) return false;
      
//       logger.info('TimelineManager', 'Pausing timeline progression');
      
//       // Use pauseTimeline method from TimelineEngine
//       const success = engine.pauseTimeline();
      
//       if (success) {
//         // Update React state
//         setTimelineIsPlaying(false);
//         return true;
//       } else {
//         logger.error('TimelineManager', 'Failed to pause TimelineEngine');
//         return false;
//       }
//     } catch (error) {
//       logger.error('TimelineManager', 'handlePauseTimeline error:', error);
//       return false;
//     }
//   };

//   /**
//    * Resumes timeline progression from current position
//    * @returns {boolean} Success status
//    */
//   const handleResumeTimeline = () => {
//     try {
//       const engine = ensureTimelineEngine();
//       if (!engine) return false;
      
//       logger.info('TimelineManager', 'Resuming timeline progression');
      
//       // Use resumeTimeline method from TimelineEngine
//       const success = engine.resumeTimeline();
      
//       if (success) {
//         // Update React state
//         setTimelineIsPlaying(true);
//         return true;
//       } else {
//         logger.error('TimelineManager', 'Failed to resume TimelineEngine');
//         return false;
//       }
//     } catch (error) {
//       logger.error('TimelineManager', 'handleResumeTimeline error:', error);
//       return false;
//     }
//   };

//   /**
//    * Stops timeline progression
//    * @returns {boolean} Success status
//    */
//   const handleStopTimeline = () => {
//     try {
//       const engine = ensureTimelineEngine();
//       if (!engine) return false;
      
//       logger.info('TimelineManager', 'Stopping timeline progression');
      
//       // Use stop method from TimelineEngine
//       const success = engine.stop();
      
//       if (success) {
//         // Update React state
//         setTimelineIsPlaying(false);
//         setProgress(0);
//         setActivePhase(null);
//         return true;
//       } else {
//         logger.error('TimelineManager', 'Failed to stop TimelineEngine');
//         return false;
//       }
//     } catch (error) {
//       logger.error('TimelineManager', 'handleStopTimeline error:', error);
//       return false;
//     }
//   };

//   /**
//    * Resets the timeline state completely
//    * @returns {boolean} Success status
//    */
//   const handleResetTimeline = () => {
//     try {
//       const engine = ensureTimelineEngine();
//       if (!engine) return false;
      
//       logger.info('TimelineManager', 'Resetting timeline');
      
//       // Use reset method from TimelineEngine
//       const success = engine.reset();
      
//       if (success) {
//         // Update React state
//         setTimelineIsPlaying(false);
//         setProgress(0);
//         setActivePhase(null);
//         nextEventIndexRef.current = 0;
//         return true;
//       } else {
//         logger.error('TimelineManager', 'Failed to reset TimelineEngine');
//         return false;
//       }
//     } catch (error) {
//       logger.error('TimelineManager', 'handleResetTimeline error:', error);
//       return false;
//     }
//   };

//   /**
//    * Toggles timeline play/pause state
//    * @returns {boolean} Success status
//    */
//   const toggleTimeline = () => {
//     if (timelineIsPlaying) {
//       return handlePauseTimeline();
//     } else {
//       return timelineIsPlaying ? handleResumeTimeline() : handleStartTimeline();
//     }
//   };
  
//   /**
//    * Registers a timeline event
//    * @param {Object} event - Event to register
//    * @returns {boolean} Success status
//    */
//   const handleRegisterTimelineEvent = (event) => {
//     try {
//       const engine = ensureTimelineEngine();
//       if (!engine) return false;
      
//       if (!event || !event.id) {
//         logger.error('TimelineManager', 'Invalid event data');
//         return false;
//       }
      
//       logger.info('TimelineManager', `Registering timeline event: ${event.id}`);
      
//       // Add to React state
//       setTimelineEvents(prevEvents => {
//         const newEvents = [...prevEvents, event].sort((a, b) => 
//           (a.time || 0) - (b.time || 0)
//         );
//         return newEvents;
//       });
      
//       // Add to TimelineEngine
//       return engine.addEvent(event);
//     } catch (error) {
//       logger.error('TimelineManager', 'handleRegisterTimelineEvent error:', error);
//       return false;
//     }
//   };

//   /**
//    * Clears all timeline events
//    * @returns {boolean} Success status
//    */
//   const handleClearTimelineEvents = () => {
//     try {
//       const engine = ensureTimelineEngine();
//       if (!engine) return false;
      
//       logger.info('TimelineManager', 'Clearing all timeline events');
      
//       // Clear from React state
//       setTimelineEvents([]);
      
//       // Clear from TimelineEngine - replace with actual method if different
//       const success = engine.clearEvents ? engine.clearEvents() : true;
      
//       // Reset event index
//       nextEventIndexRef.current = 0;
      
//       return success;
//     } catch (error) {
//       logger.error('TimelineManager', 'handleClearTimelineEvents error:', error);
//       return false;
//     }
//   };

//   /**
//    * Sets the session duration
//    * @param {number} duration - Duration in milliseconds
//    * @returns {boolean} Success status
//    */
//   const handleSetSessionDuration = (duration) => {
//     try {
//       const engine = ensureTimelineEngine();
//       if (!engine) return false;
      
//       if (!duration || typeof duration !== 'number' || duration <= 0) {
//         logger.error('TimelineManager', 'Invalid session duration:', duration);
//         return false;
//       }
      
//       logger.info('TimelineManager', `Setting session duration: ${duration}ms`);
      
//       // Update in React state
//       setSessionDuration(duration);
      
//       // Update in TimelineEngine
//       return engine.setSessionDuration(duration);
//     } catch (error) {
//       logger.error('TimelineManager', 'handleSetSessionDuration error:', error);
//       return false;
//     }
//   };

//   /**
//    * Sets the transition duration
//    * @param {number} duration - Duration in milliseconds
//    * @returns {boolean} Success status
//    */
//   const handleSetTransitionDuration = (duration) => {
//     try {
//       const engine = ensureTimelineEngine();
//       if (!engine) return false;
      
//       if (!duration || typeof duration !== 'number' || duration < 0) {
//         logger.error('TimelineManager', 'Invalid transition duration:', duration);
//         return false;
//       }
      
//       logger.info('TimelineManager', `Setting transition duration: ${duration}ms`);
      
//       // Update in React state
//       setTransitionDuration(duration);
      
//       // Update in TimelineEngine
//       return engine.setTransitionDuration(duration);
//     } catch (error) {
//       logger.error('TimelineManager', 'handleSetTransitionDuration error:', error);
//       return false;
//     }
//   };

//    /**
//    * Triggers a manual phase transition
//    * @param {string} phaseId - ID of the phase to transition to
//    * @returns {boolean} Success status
//    */
//    const handleManualPhaseTransition = (phaseId) => {
//     try {
//       const engine = ensureTimelineEngine();
//       if (!engine) return false;
      
//       // Find the phase in our timeline phases
//       const phase = timelinePhases.find(p => p.id === phaseId);
//       if (!phase) {
//         logger.error('TimelineManager', `Phase not found: ${phaseId}`);
//         return false;
//       }
      
//       logger.info('TimelineManager', `Manually triggering phase: ${phaseId}`);
      
//       // Trigger phase in TimelineEngine
//       const success = engine.triggerPhase(phaseId);
      
//       if (success) {
//         // Update active phase in React state
//         setActivePhase(phaseId);
//         return true;
//       } else {
//         logger.error('TimelineManager', `Failed to trigger phase: ${phaseId}`);
//         return false;
//       }
//     } catch (error) {
//       logger.error('TimelineManager', 'handleManualPhaseTransition error:', error);
//       return false;
//     }
//   };

//   /* Seeks to a specific time in the timeline
//   * @param {number} timeMs - Time in milliseconds
//   * @returns {boolean} Success status
//   */
//  const handleSeekToTime = (timeMs) => {
//    try {
//      const engine = ensureTimelineEngine();
//      if (!engine) return false;
     
//      if (typeof timeMs !== 'number' || timeMs < 0) {
//        logger.error('TimelineManager', 'Invalid seek time:', timeMs);
//        return false;
//      }
     
//      logger.info('TimelineManager', `Seeking to time: ${timeMs}ms`);
     
//      // Use the seekToTime method from TimelineEngine
//      const success = engine.seekToTime(timeMs);
     
//      if (success) {
//        // The engine will update progress internally, but we'll sync state as well
//        const progressPercent = (timeMs / sessionDuration) * 100;
//        setProgress(Math.min(100, progressPercent));
       
//        // Tell the engine to check phases right away
//        engine.checkCurrentPhase();
       
//        return true;
//      } else {
//        logger.error('TimelineManager', 'Failed to seek in TimelineEngine');
//        return false;
//      }
//    } catch (error) {
//      logger.error('TimelineManager', 'handleSeekToTime error:', error);
//      return false;
//    }
//  };

//  /**
//   * Seeks to a percentage position in the timeline
//   * @param {number} percent - Position as percentage (0-100)
//   * @returns {boolean} Success status
//   */
//  const handleSeekToPercent = (percent) => {
//    try {
//      const engine = ensureTimelineEngine();
//      if (!engine) return false;
     
//      if (typeof percent !== 'number' || percent < 0 || percent > 100) {
//        logger.error('TimelineManager', 'Invalid seek percentage:', percent);
//        return false;
//      }
     
//      logger.info('TimelineManager', `Seeking to percent: ${percent}%`);
     
//      // Calculate time in ms from percentage
//      const timeMs = (percent / 100) * sessionDuration;
     
//      // Use seekToTime method
//      return handleSeekToTime(timeMs);
//    } catch (error) {
//      logger.error('TimelineManager', 'handleSeekToPercent error:', error);
//      return false;
//    }
//  };

//  /**
//   * Checks for phase transitions using TimelineEngine
//   * Use this to manually trigger a phase check
//   * @returns {boolean} Success status
//   */
//  const checkPhaseTransitions = () => {
//    try {
//      const engine = ensureTimelineEngine();
//      if (!engine) return false;
     
//      logger.debug('TimelineManager', 'Manually checking phase transitions');
     
//      // Use the checkCurrentPhase method from TimelineEngine
//      const success = engine.checkCurrentPhase();
     
//      // Sync state with engine
//      syncProgressWithEngine();
     
//      return success;
//    } catch (error) {
//      logger.error('TimelineManager', 'checkPhaseTransitions error:', error);
//      return false;
//    }
//  };

//  /**
//   * Updates progress and checks for phase transitions
//   * Called periodically to sync UI with engine state
//   * @returns {boolean} Success status
//   */
//  const updateProgressAndCheckPhases = () => {
//    try {
//      const engine = ensureTimelineEngine();
//      if (!engine) return false;
     
//      // Sync state with engine
//      syncProgressWithEngine();
     
//      // No need to manually check phases as TimelineEngine does this internally
//      // when running, but we'll trigger a check just to be safe
//      engine.checkCurrentPhase();
     
//      return true;
//    } catch (error) {
//      logger.error('TimelineManager', 'updateProgressAndCheckPhases error:', error);
//      return false;
//    }
//  };

//  /**
//   * Resets the timeline event index
//   * @returns {boolean} Success status
//   */
//  const resetTimelineEventIndex = () => {
//    try {
//      const engine = ensureTimelineEngine();
//      if (!engine) return false;
     
//      logger.info('TimelineManager', 'Resetting timeline event index');
     
//      // Reset event index in ref
//      nextEventIndexRef.current = 0;
     
//      // Reset event index in TimelineEngine if it has that capability
//      if (typeof engine.resetEventIndex === 'function') {
//        engine.resetEventIndex();
//      }
     
//      return true;
//    } catch (error) {
//      logger.error('TimelineManager', 'resetTimelineEventIndex error:', error);
//      return false;
//    }
//  };

//  // Return public API with methods that delegate to TimelineEngine
//  return {
//    // Timeline control methods
//    handleStartTimeline,
//    handlePauseTimeline,
//    handleResumeTimeline,
//    handleStopTimeline,
//    handleResetTimeline,
//    toggleTimeline,
   
//    // Timeline content methods
//    handleUpdateTimelinePhases,
//    handleRegisterTimelineEvent,
//    handleClearTimelineEvents,
//    handleManualPhaseTransition,
   
//    // Configuration methods
//    handleSetSessionDuration,
//    handleSetTransitionDuration,
   
//    // Navigation methods
//    handleSeekToTime,
//    handleSeekToPercent,
   
//    // Phase detection methods
//    checkPhaseTransitions,
//    updateProgressAndCheckPhases,
   
//    // Internal helpers (exposed for testing)
//    ensureTimelineEngine,
//    syncProgressWithEngine,
//    setupEngineCallbacks,
   
//    // Reset timeline event index (standardized name)
//    resetTimelineEventIndex
//  };
// };

// export default createTimelineManager;
