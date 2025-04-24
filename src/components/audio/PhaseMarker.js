// src/components/audio/PhaseMarker.js
import React, { useState, useRef, useEffect } from 'react';
import styles from '../../styles/components/PhaseMarker.module.css';
import eventBus, { EVENTS } from '../../services/EventBus';

/**
 * PhaseMarker component - Represents a phase point on the timeline
 * Handles dragging, selection, and state capture for timeline phases
 * Works on both mobile and desktop with touch/mouse events
 * 
 * @param {Object} props Component props
 * @param {string} props.id Phase unique identifier
 * @param {string} props.name Display name for the phase
 * @param {string} props.color Color for the phase marker
 * @param {number} props.position Position percentage (0-100)
 * @param {boolean} props.isActive Whether this phase is currently active
 * @param {boolean} props.isSelected Whether this phase is currently selected for editing
 * @param {boolean} props.isDraggable Whether this phase can be dragged
 * @param {boolean} props.isLocked Whether this phase is locked from editing
 * @param {boolean} props.editMode Whether timeline is in edit mode
 * @param {Function} props.onClick Click handler for the marker
 * @param {Function} props.onPositionChange Callback when marker position changes
 * @param {Function} props.onStateCapture Callback to capture current audio state
 * @param {boolean} props.hasSavedState Whether this phase has saved state
 * @param {number} props.sessionDuration Total session duration in ms
 */
const PhaseMarker = ({
  id,
  name,
  color,
  position,
  isActive,
  isSelected,
  isDraggable,
  isLocked,
  editMode,
  onClick,
  onPositionChange,
  onStateCapture,
  onDragEnd,
  hasSavedState,
  sessionDuration = 3600000
}) => {
  // Local state
  const [isDragging, setIsDragging] = useState(false);
  const [isReturningFromDrag, setIsReturningFromDrag] = useState(false);

  // Refs for event handling
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

    // Call onDragEnd callback to notify parent that drag is fully complete
      // This allows deselection to happen after animation completes
      if (onDragEnd) {
        onDragEnd(id);  
      }

    }, 200);

    // Notify EventBus that dragging has ended
    eventBus.emit(EVENTS.PHASE_MARKER_DRAG_END || 'phaseMarker:dragEnd', {
      phaseId: id,
      position: position,
      timestamp: Date.now()
    });
  };

  // Touch start handler - beginning of all touch interactions
  const handleTouchStart = (e) => {
    // Handle selection first
    if (onClick) {
      onClick(e);
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

    // Notify EventBus that a touch has started
    eventBus.emit(EVENTS.PHASE_MARKER_TOUCH_START || 'phaseMarker:touchStart', {
      phaseId: id,
      position: position,
      timestamp: Date.now()
    });

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

          // Notify EventBus that dragging has started
          eventBus.emit(EVENTS.PHASE_MARKER_DRAG_START || 'phaseMarker:dragStart', {
            phaseId: id,
            position: position,
            timestamp: Date.now()
          });
        }

        // Now handle the actual drag movement
        if (timelineRef.current) {
          e.preventDefault(); // Prevent scrolling while dragging

          const rect = timelineRef.current.getBoundingClientRect();
          const moveDeltaX = touchX - dragStartPosition.current.x;
          const deltaPct = (moveDeltaX / rect.width) * 100;

          // Calculate new position based on original position plus delta
          const newPosition = Math.min(100, Math.max(0, dragStartPosition.current.offset + deltaPct));

          // Call onPositionChange with new position
          if (onPositionChange) {
            onPositionChange(newPosition);
          }

          // Notify EventBus that position is changing during drag
          eventBus.emit(EVENTS.PHASE_MARKER_DRAG_UPDATE || 'phaseMarker:dragUpdate', {
            phaseId: id,
            position: newPosition,
            timestamp: Date.now()
          });
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

    // If we didn't move, it was just a tap, already handled in touchStart
  };

  // Mouse event handlers (for desktop compatibility)
  const handleMouseDown = (e) => {
    // Handle click first - this covers selection logic
    if (onClick) {
      onClick(e);
    }

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

    // Notify EventBus that mouse down has occurred
    eventBus.emit(EVENTS.PHASE_MARKER_MOUSE_DOWN || 'phaseMarker:mouseDown', {
      phaseId: id,
      position: position,
      timestamp: Date.now()
    });

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

        // Notify EventBus that dragging has started
        eventBus.emit(EVENTS.PHASE_MARKER_DRAG_START || 'phaseMarker:dragStart', {
          phaseId: id,
          position: position,
          timestamp: Date.now()
        });
      }

      // Handle the actual drag movement
      if (timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const moveDeltaX = e.clientX - dragStartPosition.current.x;
        const deltaPct = (moveDeltaX / rect.width) * 100;

        // Calculate new position, clamped to 0-100 range
        const newPosition = Math.min(100, Math.max(0, dragStartPosition.current.offset + deltaPct));

        // Call onPositionChange with new position
        if (onPositionChange) {
          onPositionChange(newPosition);
        }

        // Notify EventBus of position update
        eventBus.emit(EVENTS.PHASE_MARKER_DRAG_UPDATE || 'phaseMarker:dragUpdate', {
          phaseId: id,
          position: newPosition,
          timestamp: Date.now()
        });
      }
    }
  };

  const handleMouseUp = (e) => {
    // Clean up listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);

    // If we were dragging, end the drag state properly
    if (isDragging) {
      endDragState();
    }
  };

  // Format time for display (convert percentage position to time)
  const formatTime = (positionPercent) => {
    if (!sessionDuration) return "00:00";

    const milliseconds = Math.floor((positionPercent / 100) * sessionDuration);
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle marker state capture
  const handleCaptureState = (e) => {
    e.stopPropagation();

    // Prevent capture during drag
    if (isDragging) return;

    if (onStateCapture) {
      console.log(`[PhaseMarker] Capturing state for phase: ${id}`);
      onStateCapture(id);

      // Notify EventBus that state has been captured
      eventBus.emit(EVENTS.PHASE_MARKER_STATE_CAPTURE || 'phaseMarker:stateCapture', {
        phaseId: id,
        position: position,
        timestamp: Date.now()
      });
    }
  };

  // Clean up event listeners on unmount
  useEffect(() => {
    return () => {
      // Clean up any lingering event listeners
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // Clear any active timers
      if (dragTimerRef.current) {
        clearTimeout(dragTimerRef.current);
      }
    };
  }, []);

  // Calculate time string based on position
  const timeDisplay = formatTime(position);

  // Determine marker classes based on state
  const markerClasses = [
    styles.phaseMarker,
    isActive ? styles.active : '',
    isSelected ? styles.selected : '',
    isDragging ? styles.dragging : '',
    isReturningFromDrag ? styles.returning : '',
    isLocked ? styles.locked : '',
    editMode ? styles.editMode : '',
  ].filter(Boolean).join(' ');

  // Calculate marker style for positioning
  const markerStyle = {
    left: `${position}%`,
    backgroundColor: color || '#3498db',
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
      ${hasSavedState ? styles.stateCaptured : ''}
    `}
      style={{
        left: `${position}%`,
        backgroundColor: color || 'transparent'
      }}
      onClick={onClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div className={styles.timeStamp}>{formatTime(position)}</div>
      <div className={styles.markerLabel}>{name}</div>

      {/* Capture state button - only shown when in edit mode and selected */}
      {editMode && isSelected && (
        <button
          className={styles.captureButton}
          onClick={handleCaptureState}
        >
          {hasSavedState ? 'Update' : 'Capture'} State
        </button>
      )}

      {/* Checkmark indicator for captured state */}
      {hasSavedState && (
        <div className={styles.stateIndicator}>✓</div>
      )}
    </div>
  );
};

export default PhaseMarker;