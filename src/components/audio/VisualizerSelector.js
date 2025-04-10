// src/components/audio/VisualizerSelector.js
import React from 'react';
import styles from '../../styles/components/VisualizerSelector.module.css';

const VisualizerSelector = ({ currentMode, onModeChange }) => {
  return (
    <div className={styles.selectorContainer}>
      <button 
        className={`${styles.selectorButton} ${currentMode === 'audioVisualizer' ? styles.active : ''}`}
        onClick={() => onModeChange('audioVisualizer')}
      >
        Audio Visualizer
      </button>
      <button 
        className={`${styles.selectorButton} ${currentMode === 'breathingCircle' ? styles.active : ''}`}
        onClick={() => onModeChange('breathingCircle')}
      >
        Breathing Guide
      </button>
      <button 
        className={`${styles.selectorButton} ${currentMode === 'albumArt' ? styles.active : ''}`}
        onClick={() => onModeChange('albumArt')}
      >
        Album Art
      </button>
    </div>
  );
};

export default VisualizerSelector;