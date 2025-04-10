// src/components/audio/PlayerControlPanel.js
import React, { memo, useCallback, useRef } from 'react';
import { useAudio } from '../../hooks/useAudio';
import VisualizerContainer from './VisualizerContainer';
import MasterVolumeControl from './MasterVolumeControl';
import SessionTimeline from './SessionTimeline';
import styles from '../../styles/components/PlayerControlPanel.module.css';

/**
 * PlayerControlPanel component
 * 
 * Provides the main playback controls, audio visualization,
 * and master volume controls for the audio player
 * 
 * @returns {JSX.Element} Rendered component
 */
const PlayerControlPanel = React.forwardRef(({ 
  timelineEnabled, 
  onDurationChange 
}, ref) => {
  console.log('[PlayerControlPanel] Component rendering');
  
  // Use our new hook with grouped API
  const { playback } = useAudio();
 
  // Handle play/pause with useCallback for optimization
  const togglePlayPause = useCallback(() => {
    console.log("[PlayerControlPanel] Play/Pause button clicked, current state:", playback.isPlaying);
    if (playback.isPlaying) {
      console.log("[PlayerControlPanel] Attempting to pause playback");
      playback.pause();
    } else {
      console.log("[PlayerControlPanel] Attempting to start playback");
      playback.start();
    }
  }, [playback]);
  
  return (
    <div className={styles.playerControlPanel}>
      <div className={styles.visualizerSection}>
        <VisualizerContainer />
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
        <SessionTimeline 
          ref={ref}
          enabled={timelineEnabled}
          onDurationChange={onDurationChange}
        />
        <MasterVolumeControl />
      </div>
    </div>
  );
});

// Add display name for debugging
PlayerControlPanel.displayName = 'PlayerControlPanel';

// Use memo for performance optimization
export default memo(PlayerControlPanel);