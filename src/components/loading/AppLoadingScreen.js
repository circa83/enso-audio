// src/components/loading/AppLoadingScreen.js
import React from 'react';
import CircleVisualizer from './CircleVisualizer';
import styles from '../../styles/components/loading/AppLoadingScreen.module.css';

/**
 * AppLoadingScreen - Main application loading screen with visualization
 * @param {Object} props
 * @param {number} [props.progress=0] - Loading progress (0-100)
 * @param {string} [props.message='Loading...'] - Loading message to display
 * @param {boolean} [props.isVisible=true] - Whether the loading screen is visible
 */
const AppLoadingScreen = ({ 
  progress = 0, 
  message = 'Loading...', 
  isVisible = true 
}) => {
  if (!isVisible) return null;
  
  return (
    <div className={styles.loadingScreen}>
      <div className={styles.loadingContent}>
        <h1 className={styles.title}>Ensō Audio</h1>
        
        <div className={styles.visualizerContainer}>
          <CircleVisualizer 
            size={180} 
            isActive={true} 
            progress={progress} 
          />
        </div>
        
        <div className={styles.messageContainer}>
          <p className={styles.loadingMessage}>{message}</p>
          <div className={styles.loadingDots}>
            <span className={styles.dot}></span>
            <span className={styles.dot}></span>
            <span className={styles.dot}></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppLoadingScreen;