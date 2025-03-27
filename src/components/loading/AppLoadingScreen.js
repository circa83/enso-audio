// src/components/loading/AppLoadingScreen.js
import React from 'react';
import CircleVisualizer from './CircleVisualizer';
import styles from '../../styles/components/loading/AppLoadingScreen.module.css';

/**
 * AppLoadingScreen - Simplified loading screen that just shows the CircleVisualizer
 * @param {Object} props
 * @param {number} [props.progress=0] - Loading progress (0-100)
 * @param {boolean} [props.isVisible=true] - Whether the loading screen is visible
 */
const AppLoadingScreen = ({ 
  progress = 0, 
  isVisible = true 
}) => {
  if (!isVisible) return null;
  
  return (
    <div className={styles.loadingScreen}>
      <div className={styles.loadingContent}>
        <h1 className={styles.title}>Ensō Audio</h1>
        
        <div className={styles.visualizerContainer}>
          <CircleVisualizer 
            size={200}
            progress={progress}
          />
        </div>
      </div>
    </div>
  );
};

export default AppLoadingScreen;