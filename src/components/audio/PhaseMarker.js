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
  onSelect,
  onDeselect,
  onStateCapture,
  storedState,
  editMode,
  sessionDuration,
  hasStateCaptured
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isReturningFromDrag, setIsReturningFromDrag] = useState(false);
  const markerRef = useRef(null);
  const timelineRef = useRef(null);
  const dragStartPosition = useRef({ x: 0, offset: 0 });
  const touchStartTime = useRef(0);
  const hasMoved = useRef(false);
  const dragTimerRef = useRef(null);
  
  // Constants for touch/mouse behavior
  const DRAG_THRESHOLD = 5; // Pixels needed to move before considering it a drag
  
  // Helper function to end drag state properly with cursor reset
  const endDragState = () => {
    // Clear any existing timers
    if (dragTimerRef.current) {
      clearTimeout(dragTimerRef.current);
      dragTimerRef.current = null;
    }
    console.log('Ending drag state');
    // Immediately end dragging state
    setIsDragging(false);
    
    // Force an update to the DOM to ensure style changes are applied
    if (markerRef.current) {
      // Remove dragging class directly from DOM for immediate effect
      markerRef.current.classList.remove(styles.dragging);
      // Force a reflow to ensure changes are applied immediately
      void markerRef.current.offsetWidth;
    }
    
    // Set return from drag state for smooth transition
    setIsReturningFromDrag(true);
    
    // Clear returning from drag after animation completes
    dragTimerRef.current = setTimeout(() => {
      setIsReturningFromDrag(false);
      
      // If not in edit mode, deselect the marker
      if (!editMode) {
        onDeselect();
      }
    }, 200);
  };
  
  // Touch start handler - beginning of all touch interactions
  const handleTouchStart = (e) => {
    //Toggle selection if not in edit mode
    if (isSelected && !editMode) {
      // If already selected and not in edit mode, deselect it
      onDeselect();
    } else {
      onSelect();
    }
  
    // Reset the returning from drag state if it was set
    if (isReturningFromDrag) {
      setIsReturningFromDrag(false);
    }
    
    // Record the touch start time
    touchStartTime.current = Date.now();
    hasMoved.current = false;
    
    // Stop propagation to prevent parent elements from handling the event
    e.stopPropagation();
    
    // Store the timeline reference if not already set
    if (!timelineRef.current && markerRef.current?.parentElement) {
      timelineRef.current = markerRef.current.parentElement;
    }
    
    // Store initial touch position
    if (e.touches && e.touches[0]) {
      dragStartPosition.current = {
        x: e.touches[0].clientX,
        offset: position
      };
    }
    
    // Add touch move and end listeners
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };
  
  // Touch move handler - detects and handles dragging
  const handleTouchMove = (e) => {
    if (!e.touches || !e.touches[0]) return;
    
    // Calculate how far we've moved from the starting point
    const touchX = e.touches[0].clientX;
    const deltaX = Math.abs(touchX - dragStartPosition.current.x);
    
    // If we've moved beyond the threshold, start dragging
    if (deltaX > DRAG_THRESHOLD) {
      // Mark that we've moved (to differentiate from a tap)
      hasMoved.current = true;
      
      // Only start dragging if in edit mode and the marker is draggable
      if (isDraggable && editMode) {
        // Enable dragging state if not already set
        if (!isDragging) {
          // Clear any active timers
          if (dragTimerRef.current) {
            clearTimeout(dragTimerRef.current);
            dragTimerRef.current = null;
          }
          
          // Reset returning from drag state
          setIsReturningFromDrag(false);
          
          // Set dragging state
          setIsDragging(true);
          
          // If we're starting to drag, make sure this marker is selected
          if (!isSelected) {
            onSelect();
          }
        }
        
        // Now handle the actual drag movement
        if (timelineRef.current) {
          e.preventDefault(); // Prevent scrolling while dragging
          
          const rect = timelineRef.current.getBoundingClientRect();
          const moveDeltaX = touchX - dragStartPosition.current.x;
          const deltaPct = (moveDeltaX / rect.width) * 100;
          
          // Calculate new position based on original position plus delta
          const newPosition = Math.min(100, Math.max(0, dragStartPosition.current.offset + deltaPct));
          
          // Call onDrag with new position
          onDrag(newPosition);
        }
      }
    }
  };
  
  const handleTouchEnd = (e) => {
    // Clean up listeners first
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
   
    // If we were dragging, call endDragState to handle all necessary transitions
    if (isDragging) {
      endDragState();
      return;
    }
    endDragState();
   
    // If we didn't move and it was a tap, treat as a tap/selection
    if (!hasMoved.current) {
      // This was a tap (not a drag)
      if (isSelected) {
        // If already selected and not in edit mode, deselect it
        if (!editMode) {
          onDeselect();
        }
      } else {
        // If not selected, select it
        onSelect();
      }
    }
  };
  
  // Mouse event handlers (for desktop compatibility)
  const handleMouseDown = (e) => {
    // Reset the returning from drag state if it was set
    if (isReturningFromDrag) {
      setIsReturningFromDrag(false);
    }
    
    // Record initial state
    hasMoved.current = false;
    
    // Stop propagation
    e.stopPropagation();
    e.preventDefault();
    
    // Store timeline reference
    if (!timelineRef.current && markerRef.current?.parentElement) {
      timelineRef.current = markerRef.current.parentElement;
    }
    
    // Store initial position
    dragStartPosition.current = {
      x: e.clientX,
      offset: position
    };
    
    // Add mouse event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const handleMouseMove = (e) => {
    // Calculate distance moved
    const deltaX = Math.abs(e.clientX - dragStartPosition.current.x);
    
    // If we've moved beyond threshold, start dragging (if allowed)
    if (deltaX > DRAG_THRESHOLD && isDraggable && editMode) {
      hasMoved.current = true;
      
      // Enable dragging state
      if (!isDragging) {
        // Clear any active timers
        if (dragTimerRef.current) {
          clearTimeout(dragTimerRef.current);
          dragTimerRef.current = null;
        }
        
        // Reset returning from drag state
        setIsReturningFromDrag(false);
        
        // Set dragging state
        setIsDragging(true);
        
        // Select this marker if not already selected
        if (!isSelected) {
          onSelect();
        }
      }
      
      // Handle position change
      if (timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const moveDeltaX = e.clientX - dragStartPosition.current.x;
        const deltaPct = (moveDeltaX / rect.width) * 100;
        
        // Calculate new position
        const newPosition = Math.min(100, Math.max(0, dragStartPosition.current.offset + deltaPct));
        
        // Update position
        onDrag(newPosition);
      }
    }
  };
  
  const handleMouseUp = (e) => {
    // Clean up event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // If we were dragging, call endDragState to handle all necessary transitions
    if (isDragging) {
      console.log('Ending drag state');
      endDragState();
      return;
    }
    
    // If we didn't move, handle as a click/selection
    if (!hasMoved.current) {
      if (isSelected) {
        // If already selected and not in edit mode, deselect it
        if (!editMode) {
          onDeselect();
        }
      } else {
        // If not selected, select it
        onSelect();
      }
    }
  };
  
  // Handle click for desktop - used only to stop propagation
  const handleClick = (e) => {
    console.log('Click');
    endDragState();
    // Just stop propagation to prevent parent elements from handling
    e.stopPropagation();
  };
  
  // Effect to handle edit mode changes
  useEffect(() => {
    // When edit mode is turned off, ensure we're not in dragging state
    if (!editMode && isDragging) {
      endDragState();
    }
  }, [editMode, isDragging]);
  
  // Clean up event listeners and timers on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      
      if (dragTimerRef.current) {
        clearTimeout(dragTimerRef.current);
      }
    };
  }, []);
  
  // Create a separate event handler for the capture button
  const handleCaptureClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (onStateCapture) {
      onStateCapture();
    }
  };
  
  // Calculate the timestamp based on position percentage and session duration
  const formatTimestamp = () => {
    if (!sessionDuration) return '00:00:00';
    
    // Calculate milliseconds based on position percentage
    const ms = (position / 100) * sessionDuration;
    
    // Convert to HH:MM:SS format
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <div 
      ref={markerRef}
      className={`
        ${styles.phaseMarker} 
        ${isActive ? styles.activeMarker : ''} 
        ${isSelected ? styles.selectedMarker : ''}
        ${isDraggable && editMode ? styles.draggable : ''}
        ${!isDraggable ? styles.fixed : ''}
        ${isDragging ? styles.dragging : ''}
        ${isReturningFromDrag ? styles.returnFromDrag : ''}
        ${hasStateCaptured ? styles.stateCaptured : ''}
      `} 
      style={{ 
        left: `${position}%`,
        backgroundColor: color || 'transparent'
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div className={styles.timeStamp}>{formatTimestamp()}</div>
      <div className={styles.markerLabel}>{name}</div>
      
      {/* Capture state button - only shown when in edit mode and selected */}
      {editMode && isSelected && (
        <button 
          className={styles.captureButton}
          onClick={handleCaptureClick}
        >
          {storedState ? 'Update' : 'Capture'} State
        </button>
      )}
      
      {/* Checkmark indicator for captured state */}
      {hasStateCaptured && (
        <div className={styles.stateIndicator}>✓</div>
      )}
    </div>
  );
};

export default PhaseMarker;