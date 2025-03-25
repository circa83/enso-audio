// src/components/audio/PhaseMarker.js
import React, { useState, useRef, useEffect } from 'react';
import styles from '../../styles/components/PhaseMarker.module.css';

const PhaseMarker = ({ 
  name, 
  color, 
  position, 
  isActive, 
  isSelected,
  isDraggable,
  onDrag, 
  onClick,
  onStateCapture,
  storedState,
  editMode,
  sessionDuration
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const markerRef = useRef(null);
  const timelineRef = useRef(null);
  const dragStartPosition = useRef({ x: 0, offset: 0 });
  
  // Combined function for both selecting and starting drag
  const handleMouseDown = (e) => {
    // Always stop propagation to prevent parent elements from handling the event
    e.preventDefault();
    e.stopPropagation();
    
    // Call onClick handler to select the marker
    onClick(e);
    
    // If not draggable, don't proceed with drag setup
    if (!isDraggable) return;
    
    // Start the drag operation
    startDrag(e.clientX);
  };
  
  // Start drag operation
  const startDrag = (clientX) => {
    // Set dragging state
    setIsDragging(true);
    
    // Store the timeline reference
    if (markerRef.current && markerRef.current.parentElement) {
      timelineRef.current = markerRef.current.parentElement;
    }
    
    // Store initial position for relative movement
    dragStartPosition.current = { 
      x: clientX,
      offset: position
    };
    
    // Add event listeners for mouse move and up
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  // Handle mouse move during drag with improved responsiveness
  const handleMouseMove = (e) => {
    if (!isDragging || !timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStartPosition.current.x;
    const deltaPct = (deltaX / rect.width) * 100;
    
    // Calculate new position based on original position plus delta
    const newPosition = Math.min(100, Math.max(0, dragStartPosition.current.offset + deltaPct));
    
    // Call onDrag with new position
    onDrag(newPosition);
  };
  
  // Handle mouse up - end dragging
  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
  };
  
  // Touch event handlers for mobile
  const handleTouchStart = (e) => {
    // Call onClick to select the marker
    onClick(e);
    
    // If not draggable, don't proceed with drag setup
    if (!isDraggable) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    if (e.touches && e.touches[0]) {
      startDrag(e.touches[0].clientX);
    }
    
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };
  
  const handleTouchMove = (e) => {
    if (!isDragging || !timelineRef.current || !e.touches || !e.touches[0]) return;
    
    e.preventDefault(); // Prevent scrolling while dragging
    
    const rect = timelineRef.current.getBoundingClientRect();
    const deltaX = e.touches[0].clientX - dragStartPosition.current.x;
    const deltaPct = (deltaX / rect.width) * 100;
    
    // Calculate new position based on original position plus delta
    const newPosition = Math.min(100, Math.max(0, dragStartPosition.current.offset + deltaPct));
    
    // Call onDrag with new position
    onDrag(newPosition);
  };
  
  const handleTouchEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    }
  };
  
  // Clean up event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);
  
  // Only show selection highlight when in edit mode
  const showSelectedHighlight = isSelected && editMode;
  
  // Calculate the timestamp based on position percentage and session duration
  const formatTimestamp = () => {
    if (!sessionDuration) return '00:00:00';
    
    // Calculate milliseconds based on position percentage
    // This will update automatically when the position changes during drag
    const ms = (position / 100) * sessionDuration;
    
    // Convert to HH:MM:SS format
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Keep track of position changes in real-time during drag
  useEffect(() => {
    // The timestamp will be recalculated whenever the position changes
    // This ensures it updates in real-time during dragging
  }, [position, sessionDuration]);
  
  // Create a separate event handler to prevent event propagation
  const handleCaptureClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onStateCapture) {
      onStateCapture();
    }
  };
  
  return (
    <div 
      ref={markerRef}
      className={`
        ${styles.phaseMarker} 
        ${isActive ? styles.activeMarker : ''} 
        ${showSelectedHighlight ? styles.selectedMarker : ''}
        ${isDraggable ? styles.draggable : ''}
        ${!isDraggable ? styles.fixed : ''}
        ${isDragging ? styles.dragging : ''}
      `} 
      style={{ 
        left: `${position}%`,
      }}
      onClick={onClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div className={styles.timeStamp}>{formatTimestamp()}</div>
      <div className={styles.markerLabel}>{name}</div>
      
      {/* Capture state button - always rendered but visibility controlled by CSS */}
      {editMode && (
        <button 
          className={styles.captureButton}
          onClick={handleCaptureClick}
        >
          {storedState ? 'Update' : 'Capture'} State
        </button>
      )}
    </div>
  );
};

export default PhaseMarker;