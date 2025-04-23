// src/hooks/useTimeline.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTimelineContext } from '../contexts/TimelineContext';
import { useAudio } from './useAudio';

/**
 * Hook for managing timeline functionality in the audio player
 * Leverages the TimelineContext and provides a consistent API
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} options.isPlaying - Whether audio is currently playing
 * @param {Function} options.onPhaseChange - Callback for phase changes
 * @returns {Object} Timeline state and control functions
 */
export function useTimeline(options = {}) {
  const {
    isPlaying = false,
    onPhaseChange = null,
  } = options;
  
  // Get timeline functionality from context instead of audioServiceManager
  const timeline = useTimelineContext();
  const { isPlaying: audioIsPlaying } = useAudio();
  
  // Local state for tracking user-provided callbacks
  const onPhaseChangeRef = useRef(onPhaseChange);
  const isPlayingRef = useRef(isPlaying || audioIsPlaying);
  
  // Update refs when dependencies change
  useEffect(() => {
    onPhaseChangeRef.current = onPhaseChange;
    isPlayingRef.current = isPlaying || audioIsPlaying;
  }, [onPhaseChange, isPlaying, audioIsPlaying]);
  
  // Set up phase change handler to call user-provided callback
  useEffect(() => {
    if (!onPhaseChangeRef.current) return;
    
    const handlePhaseChange = (event) => {
      const { phaseId, phaseData } = event.detail;
      if (onPhaseChangeRef.current) {
        onPhaseChangeRef.current(phaseId, phaseData);
      }
    };
    
    window.addEventListener('timeline-phase-changed', handlePhaseChange);
    
    return () => {
      window.removeEventListener('timeline-phase-changed', handlePhaseChange);
    };
  }, []);
  
  // Start the timeline
  const startTimeline = useCallback(() => {
    // Ensure the audio is playing first - timeline should not auto-start audio
    if (!isPlayingRef.current) {
      console.log("[useTimeline] Audio is not playing, cannot start timeline");
      return false;
    }

    console.log("[useTimeline] Starting timeline with reset");
    
    // Use context method to start the timeline
    return timeline.start({ reset: true });
  }, [timeline]);

  // Stop the timeline
  const stopTimeline = useCallback(() => {
    console.log("[useTimeline] Stopping timeline...");
    return timeline.stop();
  }, [timeline]);

  // Pause the timeline (preserving position)
  const pauseTimeline = useCallback(() => {
    console.log("[useTimeline] Pausing timeline (preserving position)...");
    return timeline.pause();
  }, [timeline]);

  // Resume the timeline from current position
  const resumeTimeline = useCallback(() => {
    console.log("[useTimeline] Resuming timeline from current position...");
    return timeline.resume();
  }, [timeline]);

  // Get current session time
  const getSessionTime = useCallback(() => {
    return timeline.getTime();
  }, [timeline]);

  // Reset timeline event index
  const resetTimelineEventIndex = useCallback(() => {
    return timeline.reset();
  }, [timeline]);

  // Update timeline phases
  const updateTimelinePhases = useCallback((phases) => {
    if (!phases || !Array.isArray(phases)) return;
    
    console.log(`[useTimeline] Updating timeline phases (${phases.length} phases)`);
    return timeline.updatePhases(phases);
  }, [timeline]);

  // Register a timeline event
  const registerTimelineEvent = useCallback((event) => {
    if (!event) return false;
    
    console.log(`[useTimeline] Registering timeline event: ${event.id || 'unnamed'}`);
    return timeline.registerEvent(event);
  }, [timeline]);

  // Clear all timeline events
  const clearTimelineEvents = useCallback(() => {
    console.log("[useTimeline] Clearing all timeline events");
    return timeline.clearEvents();
  }, [timeline]);

  // Set session duration
  const handleSetSessionDuration = useCallback((duration) => {
    console.log(`[useTimeline] Setting session duration: ${duration}ms`);
    return timeline.setDuration(duration);
  }, [timeline]);
  
  // Set transition duration
  const handleSetTransitionDuration = useCallback((duration) => {
    console.log(`[useTimeline] Setting transition duration: ${duration}ms`);
    return timeline.setTransitionDuration(duration);
  }, [timeline]);
  
  // Seek to specific time
  const seekToTime = useCallback((timeMs) => {
    console.log(`[useTimeline] Seeking to time: ${timeMs}ms`);
    return timeline.seekToTime(timeMs);
  }, [timeline]);
  
  // Seek to percentage of total duration
  const seekToPercent = useCallback((percent) => {
    console.log(`[useTimeline] Seeking to percent: ${percent}%`);
    return timeline.seekToPercent(percent);
  }, [timeline]);

  // Return all timeline state and functions with same interface as before
  return {
    // Timeline state
    events: timeline.events,
    phases: timeline.phases,
    activePhase: timeline.activePhase,
    progress: timeline.progress,
    duration: timeline.duration,
    transitionDuration: timeline.transitionDuration,
    isPlaying: timeline.isPlaying,
    
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
