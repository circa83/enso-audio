// src/components/audio/SessionSettings.js
import React, { useState } from 'react';
import styles from '../../styles/components/SessionSettings.module.css';

const SessionSettings = ({ 
  sessionDuration, 
  timelineEnabled,
  transitionDuration = 10000,
  onDurationChange,
  onTransitionDurationChange,
  onTimelineToggle
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [durationHours, setDurationHours] = useState(Math.floor(sessionDuration / (60 * 60 * 1000)));
  const [durationMinutes, setDurationMinutes] = useState(Math.floor((sessionDuration % (60 * 60 * 1000)) / (60 * 1000)));
  const [durationSeconds, setDurationSeconds] = useState(Math.floor((sessionDuration % (60 * 1000)) / 1000));
  
  // Handle duration change
  const handleDurationChange = () => {
    const newDuration = (durationHours * 60 * 60 * 1000) + 
                        (durationMinutes * 60 * 1000) + 
                        (durationSeconds * 1000);
    onDurationChange(newDuration);
  };
  
  // Handle hours input change
  const handleHoursChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0 && value <= 12) {
      setDurationHours(value);
    }
  };
  
  // Handle minutes input change
  const handleMinutesChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0 && value < 60) {
      setDurationMinutes(value);
    }
  };
  
  // Handle seconds input change
  const handleSecondsChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0 && value < 60) {
      setDurationSeconds(value);
    }
  };
  
  // Apply changes on blur
  const handleBlur = () => {
    handleDurationChange();
  };
  
  // Handle transition duration change
  const handleTransitionDurationChange = (e) => {
    const value = parseInt(e.target.value, 10);
    onTransitionDurationChange(value);
  };
  
  return (
    <div className={styles.settingsContainer}>
      <div 
        className={`${styles.settingsHeader} ${isExpanded ? styles.active : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className={styles.settingsTitle}>Session Settings</span>
        <span className={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</span>
      </div>
      
      {isExpanded && (
        <div className={styles.settingsContent}>
          <div className={styles.settingGroup}>
            <label className={styles.settingLabel}>Timeline</label>
            <div className={styles.settingToggle}>
              <button 
                className={`${styles.toggleButton} ${timelineEnabled ? styles.active : ''}`}
                onClick={() => onTimelineToggle(true)}
              >
                Enabled
              </button>
              <button 
                className={`${styles.toggleButton} ${!timelineEnabled ? styles.active : ''}`}
                onClick={() => onTimelineToggle(false)}
              >
                Disabled
              </button>
            </div>
          </div>
          
          {timelineEnabled && (
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
            </>
          )}
          
          <div className={styles.settingGroup}>
            <p className={styles.settingInfo}>
              {timelineEnabled 
                ? 'With timeline enabled, you can set up phase transitions that automatically adjust audio layers during the session.'
                : 'With timeline disabled, you control audio layers manually throughout the session.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionSettings;