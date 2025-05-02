/**
 * TimelineManager.js
 * 
 * Manages timeline functionality including phases, events, and timeline playback
 * Extracted from StreamingAudioContext to improve modularity
 */
import logger from '../../services/LoggingService';

/**
 * Creates a timeline manager with the provided dependencies
 * 
 * @param {Object} deps - Dependencies needed by the timeline manager
 * @returns {Object} Timeline operations
 */
const createTimelineManager = ({
    // Refs
    serviceRef,
    
    // State setters
    setTimelineIsPlaying,
    setProgress,
    setActivePhase,
    setTimelineEvents,
    setTimelinePhases,
    setSessionDuration,
    setTransitionDuration,
    
    // State values
    sessionDuration,
    transitionDuration,
    timelineEvents,
    timelinePhases,
    
    // Additional refs/state
    isPlayingRef,
    phasesLoaded,
    setPhasesLoaded
  }) => {
    /**
     * Starts the timeline playback
     * @returns {boolean} Success status
     */
    const handleStartTimeline = () => {
      if (!serviceRef.current.timelineEngine) {
        logger.error('TimelineManager', "handleStartTimeline: TimelineEngine not initialized");
        return false;
      }
  
      // Ensure the audio is playing first - timeline should not auto-start audio
      if (!isPlayingRef.current) {
        logger.info('TimelineManager', "handleStartTimeline: Audio is not playing, cannot start timeline");
        return false;
      }
  
      // Reset the timeline state first
      serviceRef.current.timelineEngine.stop();
  
      // Start the timeline with reset option
      const started = serviceRef.current.timelineEngine.start({ reset: true });
      logger.info('TimelineManager', `handleStartTimeline: TimelineEngine start result: ${started}`);
  
      if (started) {
        setTimelineIsPlaying(true);
      }
  
      return started;
    };
  
    /**
     * Stops timeline playback
     * @returns {boolean} Success status
     */
    const handleStopTimeline = () => {
      if (!serviceRef.current.timelineEngine) {
        logger.info('TimelineManager', "handleStopTimeline: Can't stop timeline: TimelineEngine missing");
        return false;
      }
      logger.info('TimelineManager', "handleStopTimeline: Stopping timeline...");
      
      // Just stop the timeline without affecting audio playback
      const stopped = serviceRef.current.timelineEngine.stop();
      logger.info('TimelineManager', `handleStopTimeline: TimelineEngine stop result: ${stopped}`);
  
      if (stopped) {
        setTimelineIsPlaying(false);
      }
  
      return stopped;
    };
  
    /**
     * Pauses timeline playback while preserving position
     * @returns {boolean} Success status
     */
    const handlePauseTimeline = () => {
      if (!serviceRef.current.timelineEngine) {
        logger.info('TimelineManager', "handlePauseTimeline: Can't pause timeline: TimelineEngine missing");
        return false;
      }
      logger.info('TimelineManager', "handlePauseTimeline: Pausing timeline (preserving position)...");
  
      // Use the pauseTimeline method if it exists, otherwise fall back to stop
      if (serviceRef.current.timelineEngine.pauseTimeline) {
        const paused = serviceRef.current.timelineEngine.pauseTimeline();
        logger.info('TimelineManager', `handlePauseTimeline: TimelineEngine pause result: ${paused}`);
  
        if (paused) {
          setTimelineIsPlaying(false);
        }
  
        return paused;
      } else {
        // Fall back to stop if pause isn't available
        logger.info('TimelineManager', "handlePauseTimeline: pauseTimeline not available, using stopTimeline as fallback");
        const stopped = serviceRef.current.timelineEngine.stop();
        logger.info('TimelineManager', `handlePauseTimeline: TimelineEngine stop result: ${stopped}`);
  
        if (stopped) {
          setTimelineIsPlaying(false);
        }
  
        return stopped;
      }
    };
  
    /**
     * Resumes timeline playback from current position
     * @returns {boolean} Success status
     */
    const handleResumeTimeline = () => {
      if (!serviceRef.current.timelineEngine) {
        logger.info('TimelineManager', "handleResumeTimeline: Can't resume timeline: TimelineEngine missing");
        return false;
      }
      logger.info('TimelineManager', "handleResumeTimeline: Resuming timeline from current position...");
  
      // Use the resumeTimeline method if it exists
      if (serviceRef.current.timelineEngine.resumeTimeline) {
        const resumed = serviceRef.current.timelineEngine.resumeTimeline();
        logger.info('TimelineManager', `handleResumeTimeline: TimelineEngine resume result: ${resumed}`);
  
        if (resumed) {
          setTimelineIsPlaying(true);
        }
  
        return resumed;
      } else {
        // Fall back to start with reset:false if resume isn't available
        logger.info('TimelineManager', "handleResumeTimeline: resumeTimeline not available, using startTimeline with reset:false as fallback");
        const started = serviceRef.current.timelineEngine.start({ reset: false });
        logger.info('TimelineManager', `handleResumeTimeline: TimelineEngine start result: ${started}`);
  
        if (started) {
          setTimelineIsPlaying(true);
        }
  
        return started;
      }
    };
  
    /**
     * Resets the timeline event index
     * @returns {boolean} Success status
     */
    const handleResetTimelineEventIndex = () => {
      if (!serviceRef.current.timelineEngine) {
        logger.info('TimelineManager', "handleResetTimelineEventIndex: TimelineEngine not available");
        return false;
      }
      
      serviceRef.current.timelineEngine.stop();
      serviceRef.current.timelineEngine.reset();
      return true;
    };
  
    /**
     * Updates timeline phases
     * @param {Array} phases - Array of timeline phase objects
     * @returns {boolean} Success status
     */
    const handleUpdateTimelinePhases = (phases) => {
      if (!phases || !Array.isArray(phases)) {
        logger.info('TimelineManager', "handleUpdateTimelinePhases: No phases to update");
        return false;
      }

      // Add optimization guard
      if (JSON.stringify(timelinePhases) === JSON.stringify(phases)) {
        logger.info('TimelineManager', "handleUpdateTimelinePhases: Phases unchanged, skipping update");
        return true;
      }
  
      logger.debug('TimelineManager', `handleUpdateTimelinePhases: Updating ${phases.length} timeline phases:`);
  
      // Ensure phases are properly formed with states
      const validPhases = phases.map(phase => {
        logger.debug('TimelineManager', `handleUpdateTimelinePhases: - Phase "${phase.name}" (${phase.id}) at position ${phase.position}:`);
  
        // Create a properly structured phase
        const validPhase = {
          id: phase.id,
          name: phase.name,
          position: phase.position,
          color: phase.color,
          locked: phase.locked || false,
        };
  
        // Ensure state is properly structured if it exists
        if (phase.state) {
          logger.debug('TimelineManager', `handleUpdateTimelinePhases: -- Phase has state`);
          validPhase.state = {
            volumes: phase.state.volumes ? { ...phase.state.volumes } : {},
            activeAudio: phase.state.activeAudio ? { ...phase.state.activeAudio } : {}
          };
  
          if (phase.state.volumes) {
            logger.debug('TimelineManager', `handleUpdateTimelinePhases: -- Volumes: ${JSON.stringify(phase.state.volumes)}`);
          }
  
          if (phase.state.activeAudio) {
            logger.debug('TimelineManager', `handleUpdateTimelinePhases: -- Tracks: ${JSON.stringify(phase.state.activeAudio)}`);
          }
        } else {
          logger.debug('TimelineManager', `handleUpdateTimelinePhases: -- No state defined, creating empty state`);
          // Always provide a state object, even if empty
          validPhase.state = {
            volumes: {},
            activeAudio: {}
          };
        }
  
        return validPhase;
      });
  
      setTimelinePhases(validPhases);
  
      // Then update the TimelineEngine - IMPORTANT: this makes phases available to components
      if (serviceRef.current.timelineEngine) {
        const success = serviceRef.current.timelineEngine.setPhases(validPhases);
        logger.info('TimelineManager', `handleUpdateTimelinePhases: TimelineEngine phases update ${success ? 'succeeded' : 'failed'}`);
  
        // Verify the phases were actually set in the engine
        const enginePhases = serviceRef.current.timelineEngine.getPhases?.();
        if (enginePhases) {
          logger.debug('TimelineManager', `handleUpdateTimelinePhases: TimelineEngine now has ${enginePhases.length} phases`);
  
          // Check if each phase has proper state
          const hasStates = enginePhases.some(p => p.state &&
            (Object.keys(p.state.volumes || {}).length > 0 ||
              Object.keys(p.state.activeAudio || {}).length > 0));
  
          logger.debug('TimelineManager', `handleUpdateTimelinePhases: TimelineEngine phases have states: ${hasStates ? 'YES' : 'NO'}`);
        }
      }
  
      // Mark phases as loaded, allowing components to initialize
      setPhasesLoaded(true);
      
      return true;
    };
  
    /**
     * Registers a timeline event
     * @param {Object} event - Timeline event object
     * @returns {boolean} Success status
     */
    const handleRegisterTimelineEvent = (event) => {
      if (!event) return false;
  
      setTimelineEvents(prev => {
        const updatedEvents = [...prev, event].sort((a, b) => a.time - b.time);
        return updatedEvents;
      });
  
      if (serviceRef.current.timelineEngine) {
        serviceRef.current.timelineEngine.addEvent(event);
      }
  
      return true;
    };
  
    /**
     * Clears all timeline events
     * @returns {boolean} Success status
     */
    const handleClearTimelineEvents = () => {
      setTimelineEvents([]);
  
      if (serviceRef.current.timelineEngine) {
        serviceRef.current.timelineEngine.clearEvents();
      }
  
      return true;
    };
  
    /**
     * Sets the session duration
     * @param {number} duration - Duration in milliseconds
     * @returns {boolean} Success status
     */
    const handleSetSessionDuration = (duration) => {
      if (!serviceRef.current.timelineEngine) {
        logger.info('TimelineManager', "handleSetSessionDuration: TimelineEngine not available");
        return false;
      }
      
      // Update both the engine and React state
      serviceRef.current.timelineEngine.setSessionDuration(duration);
      setSessionDuration(duration);
      return true;
    };
  
    /**
     * Sets the transition duration for phase changes
     * @param {number} duration - Duration in milliseconds
     * @returns {boolean} Success status
     */
    const handleSetTransitionDuration = (duration) => {
      if (!serviceRef.current.timelineEngine) {
        logger.info('TimelineManager', "handleSetTransitionDuration: TimelineEngine not available");
        return false;
      }
      
      serviceRef.current.timelineEngine.setTransitionDuration(duration);
      setTransitionDuration(duration);
      return true;
    };
  
    /**
     * Seeks to a specific time in the timeline
     * @param {number} timeMs - Time in milliseconds
     * @returns {boolean} Success status
     */
    const handleSeekToTime = (timeMs) => {
      if (!serviceRef.current.timelineEngine) {
        logger.info('TimelineManager', "handleSeekToTime: TimelineEngine not available");
        return false;
      }
      
      return serviceRef.current.timelineEngine.seekTo(timeMs);
    };
  
    /**
     * Seeks to a percentage position in the timeline
     * @param {number} percent - Position as percentage (0-100)
     * @returns {boolean} Success status
     */
    const handleSeekToPercent = (percent) => {
      if (!serviceRef.current.timelineEngine) {
        logger.info('TimelineManager', "handleSeekToPercent: TimelineEngine not available");
        return false;
      }
      
      return serviceRef.current.timelineEngine.seekToPercent(percent);
    };
  
    /**
     * Toggles timeline playback
     * @returns {boolean} New playing state
     */
    const toggleTimeline = () => {
      const isTimelinePlaying = serviceRef.current.timelineEngine?.isPlaying() || false;
      
      if (isTimelinePlaying) {
        return handlePauseTimeline();
      } else {
        return handleStartTimeline();
      }
    };
  
    // Return the public API
    return {
      handleStartTimeline,
      handleStopTimeline,
      handlePauseTimeline,
      handleResumeTimeline,
      handleResetTimelineEventIndex,
      handleUpdateTimelinePhases,
      handleRegisterTimelineEvent,
      handleClearTimelineEvents,
      handleSetSessionDuration,
      handleSetTransitionDuration,
      handleSeekToTime,
      handleSeekToPercent,
      toggleTimeline
    };
  };
  
  export default createTimelineManager;
