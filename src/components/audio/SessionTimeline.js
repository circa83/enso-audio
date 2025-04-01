// src/components/audio/SessionTimeline.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudio } from '../../hooks/useAudio';
import styles from '../../styles/components/SessionTimeline.module.css';

/**
 * SessionTimeline component (Part 1)
 * 
 * Displays a timeline for the audio session with progress indicators
 * and time information. This component handles the UI representation
 * and basic progress tracking for the session timeline.
 * 
 * @param {Object} props Component props
 * @param {boolean} props.enabled Whether the timeline is enabled
 * @param {number} props.onDurationChange Callback for when duration changes
 * @returns {JSX.Element} Rendered component
 */
const SessionTimeline = ({ 
  enabled = true, 
  onDurationChange 
}) => {
  // Use our new hook with grouped API
  const { 
    playback, 
    timeline 
  } = useAudio();
  
  // Local state for UI
  const [currentTime, setCurrentTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  // Refs
  const timelineRef = useRef(null);
  
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
  
  // Update time and progress bar - runs continuously during playback
  useEffect(() => {
    let interval;
    
    if (enabled && playback.isPlaying && !isDragging) {
      interval = setInterval(() => {
        const time = playback.getTime();
        setCurrentTime(time);
        
        const progressPercent = Math.min(100, (time / timeline.duration) * 100);
        setProgress(progressPercent);
      }, 50); // Update frequently for smoother animation
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [enabled, playback, timeline.duration, isDragging]);
  
  // Handle timeline click/touch for seeking
  const handleTimelineClick = useCallback((e) => {
    if (!timelineRef.current || !enabled) return;
    
    // Get timeline element dimensions
    const rect = timelineRef.current.getBoundingClientRect();
    const clickPosition = e.clientX - rect.left;
    const timelineWidth = rect.width;
    
    // Calculate percentage
    const percentage = (clickPosition / timelineWidth) * 100;
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    
    // Update UI immediately for responsiveness
    setProgress(clampedPercentage);
    
    // Calculate time based on percentage
    const newTime = (clampedPercentage / 100) * timeline.duration;
    setCurrentTime(newTime);
    
    // Seek to the new position
    timeline.seekToPercent(clampedPercentage);
  }, [enabled, timeline]);
  
  // Handle drag start
  const handleDragStart = useCallback((e) => {
    if (!enabled) return;
    setIsDragging(true);
    
    // Prevent text selection during drag
    e.preventDefault();
    
    // Handle the initial position
    handleTimelineClick(e);
    
    // Add mouse event listeners for dragging
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    
    // Add touch event listeners for mobile
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleDragEnd);
  }, [enabled, handleTimelineClick]);
  
  // Handle drag move
  const handleDragMove = useCallback((e) => {
    if (isDragging) {
      // For mouse events
      handleTimelineClick(e);
    }
  }, [isDragging, handleTimelineClick]);
  
  // Handle touch move (separate for touch events)
  const handleTouchMove = useCallback((e) => {
    if (isDragging && e.touches && e.touches[0]) {
      // Create a synthetic event with clientX from the touch
      const touchEvent = {
        clientX: e.touches[0].clientX,
        preventDefault: () => e.preventDefault()
      };
      handleTimelineClick(touchEvent);
    }
  }, [isDragging, handleTimelineClick]);
  
  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    
    // Remove event listeners
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleDragEnd);
  }, [handleDragMove, handleTouchMove]);
  
  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleDragEnd);
    };
  }, [handleDragMove, handleDragEnd, handleTouchMove]);
  
  // If timeline is disabled, don't render
  if (!enabled) return null;
  
  return (
    <div className={styles.timelineContainer}>
      <div className={styles.timelineHeader}>
        <h2 className={styles.timelineTitle}>Session Timeline</h2>
      </div>
      
      <div 
        className={styles.timeline} 
        ref={timelineRef}
        onClick={handleTimelineClick}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div 
          className={styles.progressBar} 
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Time info below the timeline */}
      <div className={styles.timeInfo}>
        <span>{formatTime(currentTime)}</span>
        <span className={styles.remainingTime}>-{formatTimeRemaining()}</span>
      </div>
      
      <div className={styles.timelineLabels}>
        <span>Start</span>
        <span>End</span>
      </div>
    </div>
  );
};

export default SessionTimeline;