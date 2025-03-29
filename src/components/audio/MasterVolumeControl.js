// src/components/audio/ImprovedMasterVolumeControl.js
import React, { memo, useCallback } from 'react';
import { useAudio } from '../../contexts/StreamingAudioContext';
import styles from '../../styles/components/MasterVolumeControl.module.css';

/**
 * MasterVolumeControl - Controls the master volume level
 * Provides a slider to adjust overall volume of all audio layers
 */
const MasterVolumeControl = () => {
  const { masterVolume, setMasterVolumeLevel } = useAudio();
  
  // Memoized callback for volume change
  const handleVolumeChange = useCallback((e) => {
    setMasterVolumeLevel(parseFloat(e.target.value));
  }, [setMasterVolumeLevel]);
  
  return (
    <div className={styles.masterVolume}>
      <label 
        className={styles.volumeLabel} 
        htmlFor="master-volume"
      >
        Master Volume
      </label>
      <div className={styles.volumeControl}>
        <input 
          id="master-volume"
          type="range" 
          min="0" 
          max="1" 
          step="0.01" 
          value={masterVolume}
          onChange={handleVolumeChange}
          className={styles.volumeSlider}
          aria-label="Master volume control"
        />
        <span className={styles.volumeValue}>{Math.round(masterVolume * 100)}%</span>
      </div>
    </div>
  );
};

// Use memo to prevent unnecessary re-renders
export default memo(MasterVolumeControl);