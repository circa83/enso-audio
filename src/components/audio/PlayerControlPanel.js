// src/components/audio/PlayerControlPanel.js
import React, { memo, useCallback } from 'react';
import { useAudio } from '../../hooks/useAudio';
import AudioVisualizer from './AudioVisualizer';
import MasterVolumeControl from './MasterVolumeControl';
import styles from '../../styles/components/PlayerControlPanel.module.css';

/**
 * PlayerControlPanel component
 * 
 * Provides the main playback controls, audio visualization,
 * and master volume controls for the audio player
 * 
 * @returns {JSX.Element} Rendered component
 */
const PlayerControlPanel = () => {
  
  // Use our new hook with grouped API
  const { playback } = useAudio();
 
  // Handle play/pause with useCallback for optimization
  const togglePlayPause = useCallback(() => {
    console.log("Play/Pause button clicked, current state:", playback.isPlaying);
    if (playback.isPlaying) {
      console.log("Attempting to pause playback");
      playback.pause();
    } else {
      console.log("Attempting to start playback");
      playback.start();
    }
  }, [playback]);
  
  return (
    <div className={styles.playerControlPanel}>
      <div className={styles.visualizerSection}>
        <AudioVisualizer />
      </div>
      
      <div className={styles.controlsSection}>
        <button 
          className={`${styles.playButton} ${playback.isPlaying ? styles.playing : ''}`}
          onClick={togglePlayPause}
          aria-label={playback.isPlaying ? 'Stop' : 'Play'}
          aria-pressed={playback.isPlaying}
        >
          {playback.isPlaying ? 'Stop' : 'Play'}
        </button>
        
        <MasterVolumeControl />
      </div>
    </div>
  );
};

// Use memo for performance optimization
export default memo(PlayerControlPanel);