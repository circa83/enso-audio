// src/components/audio/SessionTimeline.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudio } from '../../hooks/useAudio';
import timelinestyles from '../../styles/components/SessionTimeline.module.css';
import settingsStyles from '../../styles/components/SessionSettings.module.css';
import SessionSettings from './SessionSettings';
import logger from '../../services/LoggingService';

const SessionTimeline = React.forwardRef(({ 
  onDurationChange,
  transitionDuration,
  onTransitionDurationChange, 
}, ref) => {
  
  // Use our hook with grouped functionality
  const { 
    playback,
    timeline,
  } = useAudio();
  
  // Core timeline state - minimal now, mostly from timeline engine
  const [activePhaseId, setActivePhaseId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Refs
  const timelineRef = useRef(null);
  const wasPlayingBeforeStop = useRef(false);
  
  //=======INITIALIZATION=======
  //============================
  useEffect(() => {
    logger.info('[SessionTimeline] Component mounted');
    
    // Register session duration
    if (timeline.setSessionDuration) {
      logger.info('[SessionTimeline] Setting initial session duration');
      timeline.setSessionDuration(timeline.duration);
    }
    
    // Register transition duration
    if (timeline.setTransitionDuration) {
      logger.info('[SessionTimeline] Setting initial transition duration');
      timeline.setTransitionDuration(timeline.transitionDuration);
    }
    
    // Only reset timeline if playback is not active
    if (!playback.isPlaying && timeline.reset) {
      logger.info('[SessionTimeline] Timeline reset on mount (playback not active)');
      timeline.reset();
    }
  }, [timeline, playback.isPlaying]);

  //=======EVENT LISTENERS=======
  //============================
  
  // Listen for timeline progress updates
  useEffect(() => {
    const handleProgressUpdate = (event) => {
      const { progress: newProgress, time, phase } = event.detail;
      
      // Update local state for rendering
      setProgress(newProgress);
      setCurrentTime(time);
      
      // Update active phase if changed
      if (phase && phase !== activePhaseId) {
        setActivePhaseId(phase);
      }
    };
    
    window.addEventListener('timeline-progress-update', handleProgressUpdate);
    return () => {
      window.removeEventListener('timeline-progress-update', handleProgressUpdate);
    };
  }, [activePhaseId]);
  
  // Listen for phase change events
  useEffect(() => {
    const handlePhaseChange = (event) => {
      const { phaseId } = event.detail;
      setActivePhaseId(phaseId);
    };
    
    window.addEventListener('timeline-phase-changed', handlePhaseChange);
    return () => {
      window.removeEventListener('timeline-phase-changed', handlePhaseChange);
    };
  }, []);
  
  // Listen for transition state events
  useEffect(() => {
    const handleTransitionStarted = () => setTransitioning(true);
    const handleTransitionCompleted = () => setTransitioning(false);
    
    window.addEventListener('timeline-transition-started', handleTransitionStarted);
    window.addEventListener('timeline-transition-completed', handleTransitionCompleted);
    
    return () => {
      window.removeEventListener('timeline-transition-started', handleTransitionStarted);
      window.removeEventListener('timeline-transition-completed', handleTransitionCompleted);
    };
  }, []);
  
  // Listen for timeline setting changes
  useEffect(() => {
    const handleDurationChange = (event) => {
      logger.info('Timeline received duration change event:', event.detail.duration);
      
      // Force an update of the timeline
      if (timeline.setSessionDuration) {
        timeline.setSessionDuration(event.detail.duration);
      }
      
      // Update local state if needed
      if (onDurationChange) {
        onDurationChange(event.detail.duration);
      }
    };
    
    const handleTransitionChange = (event) => {
      logger.info('Timeline received transition change event:', event.detail.duration);
      
      if (timeline.setTransitionDuration) {
        timeline.setTransitionDuration(event.detail.duration);
      }
      
      if (onTransitionDurationChange) {
        onTransitionDurationChange(event.detail.duration);
      }
    };
    
    window.addEventListener('timeline-duration-changed', handleDurationChange);
    window.addEventListener('timeline-transition-changed', handleTransitionChange);

    return () => {
      window.removeEventListener('timeline-duration-changed', handleDurationChange);
      window.removeEventListener('timeline-transition-changed', handleTransitionChange);
    };
  }, [timeline, onDurationChange, onTransitionDurationChange]);
  
  //=======TIMELINE CONTROLS=======
  //==============================
  
  // Toggle timeline playback
  const toggleTimelinePlayback = useCallback(() => {
    // Only allow starting timeline if audio is playing
    if (!playback.isPlaying && !timeline.isPlaying) {
      logger.info("[SessionTimeline] Cannot start timeline when audio is not playing");
      return;
    }
    
    logger.info("[SessionTimeline] Toggling timeline, current state:", timeline.isPlaying);
    
    if (timeline.isPlaying) {
      // We're pausing the timeline
      logger.info("[SessionTimeline] Pausing timeline progression");
      timeline.pause();
    } else {
      // We're starting/resuming playback
      if (currentTime > 0) {
        // If we have elapsed time, RESUME from that position
        logger.info("[SessionTimeline] Resuming timeline from current position:", currentTime);
        timeline.resume();
      } else {
        // If no elapsed time, START from beginning
        logger.info("[SessionTimeline] Starting timeline from beginning");
        timeline.start();
      }
    }
  }, [playback.isPlaying, timeline, currentTime]);

  // Restart Timeline
  const handleRestartTimeline = useCallback(() => {
    logger.info("[SessionTimeline] Restarting timeline to beginning");
    
    // First, stop the timeline if it's playing
    if (timeline.isPlaying) {
      timeline.stop();
    }
    
    // Reset progress tracking
    setProgress(0);
    setCurrentTime(0);
    
    // Reset phase tracking
    setActivePhaseId(null);
    
    // Reset timeline in the service
    if (timeline.reset) {
      logger.info("[SessionTimeline] Resetting timeline service");
      timeline.reset();
    }
    
    if (timeline.seekToPercent) {
      logger.info("[SessionTimeline] Seeking to beginning");
      timeline.seekToPercent(0);
    }
    
    return true;
  }, [timeline]);
  
  // Handle timeline click for seeking
  const handleTimelineClick = useCallback((e) => {
    if (!playback.isPlaying) return;
    
    // Get click position relative to timeline
    const timelineRect = timelineRef.current.getBoundingClientRect();
    const clickPositionX = e.clientX - timelineRect.left;
    const percentPosition = (clickPositionX / timelineRect.width) * 100;
    
    // Seek to that position
    if (timeline.seekToPercent) {
      logger.info(`[SessionTimeline] Seeking to ${percentPosition.toFixed(2)}%`);
      timeline.seekToPercent(percentPosition);
    }
  }, [playback.isPlaying, timeline]);
  
  // Format time display (HH:MM:SS)
  const formatTime = useCallback((ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);
  
  // Format estimated time remaining
  const formatTimeRemaining = useCallback(() => {
    const remainingMs = timeline.duration - currentTime;
    if (remainingMs <= 0) return '00:00:00';
    return formatTime(remainingMs);
  }, [formatTime, currentTime, timeline.duration]);
  
  // Toggle edit mode
  const toggleEditMode = useCallback(() => {
    setEditMode(prevMode => !prevMode);
  }, []);
  
  // useImperativeHandle hook
  React.useImperativeHandle(ref, () => ({
    resetTimelinePlayback: () => {
      logger.info("Timeline playback reset by parent component");
      
      // Stop timeline in the service
      if (timeline.stop) {
        timeline.stop();
      }
      
      return true;
    },
    restartTimeline: () => handleRestartTimeline()
  }));

  // Get phase name for display
  const getActivePhaseDisplayName = useCallback(() => {
    if (!activePhaseId || !timeline.phases) return '';
    
    const phase = timeline.phases.find(p => p.id === activePhaseId);
    return phase ? phase.name : '';
  }, [activePhaseId, timeline.phases]);

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
      
      {activePhaseId && (
        <div className={timelinestyles.phaseIndicator}>
          Current Phase: <span className={timelinestyles.activePhase}>
            {getActivePhaseDisplayName()}
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
            style={{ width: `${progress}%` }}
          />
          
          {/* Phase markers are now managed by PhaseManager component */}
        </div>
      </div>
      <div className={timelinestyles.timelineControls}>
        <button 
          className={`${timelinestyles.controlButton} ${timeline.isPlaying ? timelinestyles.active : ''}`}
          onClick={toggleTimelinePlayback}
          disabled={!playback.isPlaying}
        >
          {timeline.isPlaying ? 'Pause Timeline' : 'Start Timeline'}
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
            Use the timeline settings below to adjust session duration and transitions.
          </div>
          
          {/* Add SessionSettings here when in edit mode */}
          <SessionSettings 
            sessionDuration={timeline.duration}
            transitionDuration={transitionDuration}
            onDurationChange={onDurationChange}
            onTransitionDurationChange={onTransitionDurationChange}
            className={settingsStyles.timelineSettings}
          />
        </>
      )}
    </div>
  );
});

export default React.memo(SessionTimeline);
