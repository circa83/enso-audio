// src/components/audio/SessionTimeline.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTimeline } from '../../hooks/useTimeline';
import useCrossfade from '../../hooks/useCrossfade';
import { usePhase } from '../../hooks/usePhase';
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

  // Use specialized hooks for better separation of concerns
  const timeline = useTimeline();
  const phase = usePhase({ timeline });
  
  

  // Use only playback-related functionality from useAudio
  const { playback } = useAudio();

  // Local UI state only (not duplicating engine/hook state)
  const [editMode, setEditMode] = useState(false);

  // Refs
  const timelineRef = useRef(null);

  //=======INITIALIZATION=======
  //============================
  useEffect(() => {
    logger.info('[SessionTimeline] Component mounted');

    // Register session duration
    if (timeline.setSessionDuration) {
      logger.info('[SessionTimeline] Setting initial session duration');
      timeline.setSessionDuration(timeline.sessionDuration);
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
      timeline.pause();
    } else {
      // Check if we need to start or resume
      const currentTime = timeline.getTime();
      if (currentTime > 0) {
        timeline.resume();
      } else {
        timeline.start();
      }
    }
  }, [playback.isPlaying, timeline]);

  // Restart Timeline
  
  const handleRestartTimeline = useCallback(() => {
    logger.info("[SessionTimeline] Restarting timeline to beginning");

    // First stop if playing
    if (timeline.isPlaying) {
      timeline.stop();
    }

    // Reset timeline in the service
    if (timeline.reset) {
      logger.info("[SessionTimeline] Resetting timeline service");
      timeline.reset();
    }

    // Seek to beginning
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

    // Seek to that position via the hook
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
    const remainingMs = timeline.sessionDuration - timeline.getTime();
    if (remainingMs <= 0) return '00:00:00';
    return formatTime(remainingMs);
  }, [formatTime, timeline]);

  // Toggle edit mode
  const toggleEditMode = useCallback(() => {
    setEditMode(prevMode => !prevMode);

    // Also toggle edit mode in the phase hook if available
    if (phase.toggleEditMode) {
      phase.toggleEditMode();
    }
  }, [phase]);

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
    if (!timeline.activePhase || !phase.phases) return '';

    const activePhase = phase.phases.find(p => p.id === timeline.activePhase);
    return activePhase ? activePhase.name : '';
  }, [timeline.activePhase, phase.phases]);

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

      {timeline.activePhase && (
        <div className={timelinestyles.phaseIndicator}>
          Current Phase: <span className={timelinestyles.activePhase}>
            {getActivePhaseDisplayName()}
          </span>
          {timeline.isTransitioning && <span className={timelinestyles.transitioningLabel}> (Transitioning)</span>}
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
            style={{ width: `${timeline.progress}%` }}
          />

          {/* Phase markers would be here, managed by the PhaseManager component */}
          {phase.phases.map((phaseItem, index) => (
            <div
              key={phaseItem.id}
              className={`${timelinestyles.phaseMarker} ${timeline.activePhase === phaseItem.id ? timelinestyles.active : ''}`}
              style={{
                left: `${phaseItem.position}%`,
                backgroundColor: phaseItem.color || '#888'
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (editMode) {
                  phase.selectPhase(phaseItem.id);
                } else if (timeline.isPlaying) {
                  // Trigger phase transition if playing
                  phase.triggerPhase(phaseItem.id);
                }
              }}
            >
              <span className={timelinestyles.markerLabel}>{phaseItem.name}</span>
            </div>
          ))}
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
        <span>{formatTime(timeline.getTime())}</span>
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
            sessionDuration={timeline.sessionDuration}
            transitionDuration={timeline.transitionDuration}
            onDurationChange={onDurationChange}
            onTransitionDurationChange={onTransitionDurationChange}
            className={settingsStyles.timelineSettings}
          />

          {/* Phase editing interface when a phase is selected */}
          {phase.selectedPhaseId && (
            <div className={timelinestyles.phaseEditor}>
              <h3>Edit Phase: {phase.phases.find(p => p.id === phase.selectedPhaseId)?.name}</h3>
              <button
                className={timelinestyles.captureButton}
                onClick={() => phase.capturePhaseState(phase.selectedPhaseId)}
              >
                Capture Current State
              </button>
              <button
                className={timelinestyles.deselectButton}
                onClick={() => phase.deselectPhase()}
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
});

export default React.memo(SessionTimeline);
