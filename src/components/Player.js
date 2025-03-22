import React, { memo, useCallback } from 'react';
import { useAudio } from '../contexts/StreamingAudioContext';
import TapePlayerGraphic from './audio/TapePlayerGraphic';
import LayerControl from './audio/LayerControl';
import SessionTimer from './audio/SessionTimer';
import styles from '../styles/pages/Player.module.css';

const Player = memo(() => {
  const { 
    isPlaying, 
    volumes, 
    sessionTime, 
    vuMeterLevel,
    availableLayers,
    togglePlayback, 
    handleVolumeChange, 
    resetTimer 
  } = useAudio();

  // Memoize LayerControl onChange callback
  const createVolumeChangeHandler = useCallback((layer) => {
    return (value) => handleVolumeChange(layer, value);
  }, [handleVolumeChange]);

  return (
    <div className={`${styles['simple-player']} ${isPlaying ? styles.playing : ''}`}>
      <div className={styles['geometric-element']}></div>
      
      <h1 className={styles.pageTitle}>Ensō Audio</h1>
      
      <TapePlayerGraphic />
      
      <div className={styles['session-description']}>
        Adjust audio layers in real-time to guide the therapeutic journey
      </div>
      
      <div className={styles['player-controls']}>
        <button 
          className={`${styles['play-button']} ${isPlaying ? styles.playing : styles['play-button-inactive']}`}
          onClick={togglePlayback}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </button>
      </div>
      
      <div className={styles['vu-meter']}>
        <div 
          className={styles['vu-meter-level']} 
          style={{ width: `${vuMeterLevel}%` }}
        ></div>
      </div>

      <div className={styles['layer-controls']}>
        <h2 className={styles.sectionTitle}>Audio Layers</h2>
        
        {Object.keys(availableLayers).map(layer => (
          <LayerControl
            key={layer}
            label={layer.charAt(0).toUpperCase() + layer.slice(1)}
            value={volumes[layer]}
            onChange={createVolumeChangeHandler(layer)}
          />
        ))}
      </div>
      
      <div className={styles['geometric-line']}></div>
      
      <SessionTimer 
        sessionTime={sessionTime}
        resetTimer={resetTimer}
      />
      
      <div className={styles['journey-guide']}>
        <h3 className={styles['journey-title']}>Session Flow Guide</h3>
        <div className={styles['journey-phases']}>
          <div className={styles['journey-phase']}>
            <h4 className={styles['phase-title']}>Pre-Onset</h4>
            <p className={styles['phase-description']}>Higher drones, lower rhythm</p>
          </div>
          <div className={styles['journey-phase']}>
            <h4 className={styles['phase-title']}>Onset & Buildup</h4>
            <p className={styles['phase-description']}>Increase melody and rhythm gradually</p>
          </div>
          <div className={styles['journey-phase']}>
            <h4 className={styles['phase-title']}>Peak</h4>
            <p className={styles['phase-description']}>Balanced mix of all elements</p>
          </div>
          <div className={styles['journey-phase']}>
            <h4 className={styles['phase-title']}>Return & Integration</h4>
            <p className={styles['phase-description']}>Reduce rhythm, increase nature</p>
          </div>
        </div>
      </div>
    </div>
  );
});

Player.displayName = 'Player';
export default Player;