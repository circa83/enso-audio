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
  storedState
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const markerRef = useRef(null);
  
  // Handle mouse down on marker to start dragging
  const handleMouseDown = (e) => {
    if (!isDraggable) {
      console.log(`Marker ${name} is not draggable`);
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    console.log(`Starting drag on ${name} marker`);
    setIsDragging(true);
    
    // Add event listeners for mouse move and up
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  // Handle mouse move during drag
  const handleMouseMove = (e) => {
    if (!isDragging || !markerRef.current || !markerRef.current.parentElement) {
      return;
    }
    
    const timeline = markerRef.current.parentElement;
    const rect = timeline.getBoundingClientRect();
    
    // Calculate position as percentage of timeline width
    const newPosition = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    
    // Call onDrag with new position
    onDrag(newPosition);
  };
  
  // Handle mouse up - end dragging
  const handleMouseUp = () => {
    if (isDragging) {
      console.log(`Ending drag on ${name} marker`);
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
  };
  
  // Also handle touch events for mobile
  const handleTouchStart = (e) => {
    if (!isDraggable) return;
    
    e.preventDefault();
    e.stopPropagation();
    console.log(`Starting touch drag on ${name} marker`);
    setIsDragging(true);
    
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };
  
  const handleTouchMove = (e) => {
    if (!isDragging || !markerRef.current || !markerRef.current.parentElement) return;
    
    e.preventDefault(); // Prevent scrolling while dragging
    
    const timeline = markerRef.current.parentElement;
    const rect = timeline.getBoundingClientRect();
    const touch = e.touches[0];
    
    // Calculate position as percentage of timeline width
    const newPosition = Math.min(100, Math.max(0, ((touch.clientX - rect.left) / rect.width) * 100));
    
    // Call onDrag with new position
    onDrag(newPosition);
  };
  
  const handleTouchEnd = () => {
    if (isDragging) {
      console.log(`Ending touch drag on ${name} marker`);
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
  
  // Format state summary for display
  const formatStateDisplay = () => {
    if (!storedState) return 'No state saved';
    
    const volumeSummary = Object.entries(storedState.volumes || {})
      .map(([layer, vol]) => `${layer.charAt(0).toUpperCase()}: ${Math.round(vol * 100)}%`)
      .join(', ');
      
    const trackSummary = Object.entries(storedState.activeAudio || {})
      .map(([layer, trackId]) => `${layer.charAt(0).toUpperCase()}: ${trackId}`)
      .slice(0, 2) // Show only first 2 tracks to avoid cluttering
      .join(', ');
      
    return `${volumeSummary}${trackSummary ? ` | ${trackSummary}` : ''}`;
  };
  
  return (
    <div 
      ref={markerRef}
      className={`
        ${styles.phaseMarker} 
        ${isActive ? styles.activeMarker : ''} 
        ${isSelected ? styles.selectedMarker : ''}
        ${isDraggable ? styles.draggable : ''}
        ${!isDraggable ? styles.fixed : ''}
        ${isDragging ? styles.dragging : ''}
      `} 
      style={{ 
        left: `${position}%`,
        backgroundColor: color
      }}
      onClick={onClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div className={styles.markerLabel}>{name}</div>
      
      {storedState && (
        <div className={styles.stateIndicator}>
          <div className={styles.stateDetail}>{formatStateDisplay()}</div>
        </div>
      )}
      
      {onStateCapture && (
        <button 
          className={styles.captureButton}
          onClick={(e) => {
            e.stopPropagation();
            onStateCapture();
          }}
        >
          {storedState ? 'Update' : 'Capture'} State
        </button>
      )}
    </div>
  );
};

export default PhaseMarker;