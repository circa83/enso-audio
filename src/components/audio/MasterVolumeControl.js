// src/components/audio/MasterVolumeControl.js
import React from 'react';
import { useAudio } from '../../contexts/StreamingAudioContext';
import styles from '../../styles/components/MasterVolumeControl.module.css';

const MasterVolumeControl = () => {
  const { masterVolume, setMasterVolumeLevel } = useAudio();
  
  return (
    <div className={styles.masterVolume}>
      <label className={styles.volumeLabel}>Master Volume</label>
      <div className={styles.volumeControl}>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.01" 
          value={masterVolume}
          onChange={(e) => setMasterVolumeLevel(parseFloat(e.target.value))}
          className={styles.volumeSlider}
        />
        <span className={styles.volumeValue}>{Math.round(masterVolume * 100)}%</span>
      </div>
    </div>
  );
};

export default MasterVolumeControl;