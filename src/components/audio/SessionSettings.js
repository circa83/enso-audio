// src/components/audio/SessionSettings.js
import React, { useState, useEffect, useCallback } from 'react';
import { useTimeline } from '../../hooks/useTimeline';
import styles from '../../styles/components/SessionSettings.module.css';

const SessionSettings = ({ 
  sessionDuration, 
  transitionDuration, 
  onDurationChange,
  onTransitionDurationChange,
  phaseId,
  phaseName,
  onSave,
  onClose,
  className
}) => {
  // Get timeline functions from useTimeline hook
  const timeline = useTimeline();
  
  // State for time inputs
  const [durationHours, setDurationHours] = useState(Math.floor(sessionDuration / (60 * 60 * 1000)));
  const [durationMinutes, setDurationMinutes] = useState(Math.floor((sessionDuration % (60 * 60 * 1000)) / (60 * 1000)));
  const [durationSeconds, setDurationSeconds] = useState(Math.floor((sessionDuration % (60 * 1000)) / 1000));
  
  // Update local state when props change
  useEffect(() => {
    setDurationHours(Math.floor(sessionDuration / (60 * 60 * 1000)));
    setDurationMinutes(Math.floor((sessionDuration % (60 * 60 * 1000)) / (60 * 1000)));
    setDurationSeconds(Math.floor((sessionDuration % (60 * 1000)) / 1000));
  }, [sessionDuration]);
  
  // Handle duration change with useCallback
  const handleDurationChange = useCallback(() => {
    const newDuration = (durationHours * 60 * 60 * 1000) + 
                      (durationMinutes * 60 * 1000) + 
                      (durationSeconds * 1000);
    console.log(`[SessionSettings] Setting session duration to: ${newDuration}ms`);
    
    // Use callbacks from props first if provided
    if (onDurationChange) {
      onDurationChange(newDuration);
    }
    
    // Also update the timeline context directly
    if (timeline.setDuration) {
      timeline.setDuration(newDuration);
    }
  }, [durationHours, durationMinutes, durationSeconds, onDurationChange, timeline]);
  
  // Handle hours input change with useCallback
  const handleHoursChange = useCallback((e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0 && value <= 12) {
      setDurationHours(value);
      // Use a micro-task to allow state to update first
      setTimeout(() => {
        const newDuration = (value * 60 * 60 * 1000) + 
                          (durationMinutes * 60 * 1000) + 
                          (durationSeconds * 1000);
        
        // Use callbacks from props first if provided
        if (onDurationChange) {
          onDurationChange(newDuration);
        }
        
        // Also update the timeline context directly
        if (timeline.setDuration) {
          timeline.setDuration(newDuration);
        }
      }, 0);
    }
  }, [onDurationChange, durationMinutes, durationSeconds, timeline]);
  
  // Handle minutes input change with useCallback
  const handleMinutesChange = useCallback((e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0 && value < 60) {
      setDurationMinutes(value);
      // Use a micro-task to allow state to update first
      setTimeout(() => {
        const newDuration = (durationHours * 60 * 60 * 1000) + 
                          (value * 60 * 1000) + 
                          (durationSeconds * 1000);
        
        // Use callbacks from props first if provided
        if (onDurationChange) {
          onDurationChange(newDuration);
        }
        
        // Also update the timeline context directly
        if (timeline.setDuration) {
          timeline.setDuration(newDuration);
        }
      }, 0);
    }
  }, [onDurationChange, durationHours, durationSeconds, timeline]);
  
  // Handle seconds input change with useCallback
  const handleSecondsChange = useCallback((e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0 && value < 60) {
      setDurationSeconds(value);
      // Use a micro-task to allow state to update first
      setTimeout(() => {
        const newDuration = (durationHours * 60 * 60 * 1000) + 
                          (durationMinutes * 60 * 1000) + 
                          (value * 1000);
        
        // Use callbacks from props first if provided
        if (onDurationChange) {
          onDurationChange(newDuration);
        }
        
        // Also update the timeline context directly
        if (timeline.setDuration) {
          timeline.setDuration(newDuration);
        }
      }, 0);
    }
  }, [onDurationChange, durationHours, durationMinutes, timeline]);
  
  // Apply changes on blur with useCallback
  const handleBlur = useCallback(() => {
    console.log("[SessionSettings] Input field blur - validating values");
    handleDurationChange();
  }, [handleDurationChange]);
  
  // Handle transition duration change with useCallback
  const handleTransitionDurationChange = useCallback((e) => {
    const value = parseInt(e.target.value, 10);
    console.log(`[SessionSettings] Setting transition duration to: ${value}ms`);
    
    // Use callbacks from props first if provided
    if (onTransitionDurationChange) {
      onTransitionDurationChange(value);
    }
    
    // Also update the timeline context directly
    if (timeline.setTransitionDuration) {
      timeline.setTransitionDuration(value);
    }
  }, [onTransitionDurationChange, timeline]);

  // Determine if this is phase-specific settings
  const isPhaseSpecific = !!phaseId;

  return (
    <div className={`${styles.settingsContainer} ${className || ''}`}>
      {/* Phase-specific header */}
      {isPhaseSpecific && (
        <div className={styles.phaseHeader}>
          <h3>Settings for {phaseName || "Phase"}</h3>
          <div className={styles.phaseActions}>
            {onSave && (
              <button className={styles.saveButton} onClick={onSave}>
                Save Phase
              </button>
            )}
            {onClose && (
              <button className={styles.closeButton} onClick={onClose}>
                Close
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Global header if not phase specific */}
      {!isPhaseSpecific && (
        <div className={styles.settingsHeader}>
          <h3>Session Settings</h3>
        </div>
      )}
      
      {/* Transition Duration Slider - Maintain Original Design */}
      <div className={styles.settingGroup}>
        <label className={styles.settingLabel}>
          Transition Duration: {(transitionDuration / 1000).toFixed(1)} seconds
        </label>
        <input 
          type="range" 
          min="2000" 
          max="30000" 
          step="1000" 
          value={transitionDuration}
          onChange={handleTransitionDurationChange}
          className={styles.rangeInput}
        />
        <div className={styles.rangeLabels}>
          <span>Fast (2s)</span>
          <span>Slow (30s)</span>
        </div>
      </div>

      {/* Duration Inputs - Maintain Original Design */}
      <div className={styles.settingGroup}>
        <label className={styles.settingLabel}>Session Duration</label>
        <div className={styles.durationInputs}>
          <div className={styles.inputGroup}>
            <input
              type="number"
              min="0"
              max="12"
              value={durationHours}
              onChange={handleHoursChange}
              onBlur={handleBlur}
              className={styles.timeInput}
            />
            <span className={styles.timeLabel}>hours</span>
          </div>
          
          <div className={styles.inputGroup}>
            <input
              type="number"
              min="0"
              max="59"
              value={durationMinutes}
              onChange={handleMinutesChange}
              onBlur={handleBlur}
              className={styles.timeInput}
            />
            <span className={styles.timeLabel}>minutes</span>
          </div>
          
          <div className={styles.inputGroup}>
            <input
              type="number"
              min="0"
              max="59"
              value={durationSeconds}
              onChange={handleSecondsChange}
              onBlur={handleBlur}
              className={styles.timeInput}
            />
            <span className={styles.timeLabel}>seconds</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionSettings;
