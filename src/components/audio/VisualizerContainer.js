// src/components/audio/VisualizerContainer.js
import React, { useState, memo } from 'react';
import VisualizerSelector from './VisualizerSelector';
import AudioCircleVisualizer from './AudioCircleVisualizer';
import BreathingCircle from './BreathingCircle';
import AlbumArt from './AlbumArt';
import styles from '../../styles/components/VisualizerContainer.module.css';

const VisualizerContainer = () => {
  console.log('[VisualizerContainer] Component rendering');
  
  const [currentMode, setCurrentMode] = useState('audioVisualizer');
  
  // Handle changing visualization mode
  const handleModeChange = (mode) => {
    console.log(`[VisualizerContainer] Changing mode to: ${mode}`);
    setCurrentMode(mode);
  };
  
  return (
    <div className={styles.container}>
      <VisualizerSelector 
        currentMode={currentMode} 
        onModeChange={handleModeChange} 
      />
      
      <div className={styles.visualizerWrapper}>
        {currentMode === 'audioVisualizer' && <AudioCircleVisualizer />}
        {currentMode === 'breathingCircle' && <BreathingCircle />}
        {currentMode === 'albumArt' && <AlbumArt />}
      </div>
    </div>
  );
};

export default memo(VisualizerContainer);