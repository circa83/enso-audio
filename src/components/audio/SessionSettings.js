// src/components/audio/SessionSettings.js
import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/components/SessionSettings.module.css';

const SessionSettings = ({ 
  sessionDuration, 
  transitionDuration, // Default to 4 seconds
  onDurationChange,
  onTransitionDurationChange,

}) => {
  const [durationHours, setDurationHours] = useState(Math.floor(sessionDuration / (60 * 60 * 1000)));
  const [durationMinutes, setDurationMinutes] = useState(Math.floor((sessionDuration % (60 * 60 * 1000)) / (60 * 1000)));
  const [durationSeconds, setDurationSeconds] = useState(Math.floor((sessionDuration % (60 * 1000)) / 1000));
  
  // Initialize with default 4 second transition
  /*useEffect(() => {
    if (onTransitionDurationChange && transitionDuration !== 4000) {
      onTransitionDurationChange(4000); // Fallback to 4 seconds if undefined
    }
  }, [onTransitionDurationChange, transitionDuration]);
  */

  // Handle duration change with useCallback
  const handleDurationChange = useCallback(() => {
    const newDuration = (durationHours * 60 * 60 * 1000) + 
                        (durationMinutes * 60 * 1000) + 
                        (durationSeconds * 1000);
    console.log(`Setting session duration to: ${newDuration}ms`);
    onDurationChange(newDuration);
  }, [durationHours, durationMinutes, durationSeconds, onDurationChange]);
  
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
      onDurationChange(newDuration);
    }, 0);
  }
}, [onDurationChange, durationMinutes, durationSeconds]);
  
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
    onDurationChange(newDuration);
  }, 0);
}
}, [onDurationChange, durationHours, durationSeconds]);
  
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
        onDurationChange(newDuration);
      }, 0);
    }
  }, [onDurationChange, durationHours, durationMinutes]);
  
  // Apply changes on blur with useCallback
  const handleBlur = useCallback(() => {
    console.log("Input field blur - validating values");
    handleDurationChange();
  }, [handleDurationChange]);
  
  // Handle transition duration change with useCallback
  const handleTransitionDurationChange = useCallback((e) => {
    const value = parseInt(e.target.value, 10);
    console.log(`Setting transition duration to: ${value}ms`);
    onTransitionDurationChange(value);
  }, [onTransitionDurationChange]);
  

  return (
    <div className={styles.settingsContainer}>
      <div className={styles.settingGroup}>
        
      </div>
      
       
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

     
        <>
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
         
        </>
      
      
      <div className={styles.settingGroup}>
  
      </div>
    </div>
  );
};

export default SessionSettings;