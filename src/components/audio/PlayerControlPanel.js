// src/components/audio/ImprovedPlayerControlPanel.js
import React, { memo, useCallback } from 'react';
import { useAudio } from '../../contexts/StreamingAudioContext';
import AudioVisualizer from './AudioVisualizer';
import MasterVolumeControl from './MasterVolumeControl';
import styles from '../../styles/components/PlayerControlPanel.module.css';

/**
 * PlayerControlPanel - Main control interface for audio playback
 * Includes play/pause button, visualizer, and master volume control
 */
const PlayerControlPanel = () => {
  const { isPlaying, startSession, pauseSession } = useAudio();
  
  // Memoized callback for play/pause functionality
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pauseSession();
    } else {
      startSession();
    }
  }, [isPlaying, startSession, pauseSession]);
  
  return (
    <div className={styles.playerControlPanel}>
      <div className={styles.visualizerSection}>
        <AudioVisualizer />
      </div>
      
      <div className={styles.controlsSection}>
        <button 
          className={`${styles.playButton} ${isPlaying ? styles.playing : ''}`}
          onClick={togglePlayPause}
          aria-label={isPlaying ? "Stop playback" : "Start playback"}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </button>
        
        <MasterVolumeControl />
      </div>
    </div>
  );
};

// Use memo to prevent unnecessary re-renders
export default memo(PlayerControlPanel);