// src/components/audio/TapePlayerGraphic.js
import React from 'react';
import { useAudio } from '../../contexts/StreamingAudioContext';
import styles from '../../styles/components/TapePlayerGraphic.module.css';

const TapePlayerGraphic = () => {
  const { isPlaying } = useAudio();
  
  return (
    <div className={styles.tapePlayerGraphic}>
      <img 
        src="/images/tape_reel_white.png" 
        alt="Tape Reel" 
        className={`${styles.tapeReelImage} ${isPlaying ? styles.spinning : ''}`} 
      />
    </div>
  );
};

export default TapePlayerGraphic;