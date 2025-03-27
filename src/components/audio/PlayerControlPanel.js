// src/components/audio/PlayerControlPanel.js
import React from 'react';
import { useAudio } from '../../contexts/StreamingAudioContext';
import AudioVisualizer from './AudioVisualizer';
import MasterVolumeControl from './MasterVolumeControl';
import styles from '../../styles/components/PlayerControlPanel.module.css';

const PlayerControlPanel = () => {
  const { isPlaying, startSession, pauseSession } = useAudio();
  
  const togglePlayPause = () => {
    if (isPlaying) {
      pauseSession();
    } else {
      startSession();
    }
  };
  
  return (
    <div className={styles.playerControlPanel}>
      <div className={styles.visualizerSection}>
        <AudioVisualizer />
      </div>
      
      <div className={styles.controlsSection}>
        <button 
          className={`${styles.playButton} ${isPlaying ? styles.playing : ''}`}
          onClick={togglePlayPause}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </button>
        
        <MasterVolumeControl />
      </div>
    </div>
  );
};

export default PlayerControlPanel;