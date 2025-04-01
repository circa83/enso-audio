// src/components/audio/MasterVolumeControl.js
import React, { memo } from 'react';
import { useAudio } from '../../hooks/useAudio';
import styles from '../../styles/components/MasterVolumeControl.module.css';

/**
 * Master volume control component
 * Provides a slider to control the global master volume level
 * 
 * @returns {JSX.Element} Rendered component
 */
const MasterVolumeControl = () => {
  // Use our new hook with the grouped API pattern
  const { volume } = useAudio();
  
  // Handle volume change from the slider
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    volume.setMaster(newVolume);
  };
  
  // Format volume as percentage for display
  const volumePercentage = Math.round(volume.master * 100);
  
  return (
    <div className={styles.masterVolume}>
      <label className={styles.volumeLabel}>Master Volume</label>
      <div className={styles.volumeControl}>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.01" 
          value={volume.master}
          onChange={handleVolumeChange}
          className={styles.volumeSlider}
          aria-label="Master Volume"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={volumePercentage}
        />
        <span className={styles.volumeValue}>{volumePercentage}%</span>
      </div>
    </div>
  );
};

// Use React.memo to prevent unnecessary re-renders
export default memo(MasterVolumeControl);