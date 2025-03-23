// src/components/LoadingScreen.js
import React, { useState, useEffect } from 'react';
import { useAudio } from '../contexts/StreamingAudioContext';
import styles from '../styles/components/LoadingScreen.module.css';

const LoadingScreen = ({ onStartSession }) => {
  const { loadingProgress, isLoading } = useAudio();
  const [fadeOut, setFadeOut] = useState(false);
  const [startClicked, setStartClicked] = useState(false);
  
  useEffect(() => {
    // When loading is complete, prepare for transition
    if (!isLoading && !fadeOut && !startClicked) {
      // Keep the loading screen visible until user interaction
    }
  }, [isLoading, fadeOut, startClicked]);
  
  const handleStartClick = () => {
    setStartClicked(true);
    setFadeOut(true);
    
    // Transition to player view
    const timer = setTimeout(() => {
      if (onStartSession && typeof onStartSession === 'function') {
        onStartSession();
      }
    }, 800); // Match this to your CSS animation duration
    
    return () => clearTimeout(timer);
  };
  
  return (
    <div className={`${styles.loadingScreen} ${fadeOut ? styles.fadeOut : ''}`}>
      <div className={styles.loadingContent}>
        <h2 className={styles.loadingTitle}>Ensō Audio</h2>
        
        {isLoading ? (
          // Still loading audio
          <>
            <div className={styles.loadingSpinner}></div>
            <div className={styles.progressContainer}>
              <div 
                className={styles.progressBar} 
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
            <div className={styles.progressText}>
              {Math.round(loadingProgress)}% loaded
            </div>
            <p className={styles.loadingInfo}>Loading audio files...</p>
          </>
        ) : (
          // Loading complete, waiting for user interaction
          <>
            <div className={styles.loadingComplete}>✓</div>
            <p className={styles.loadingInfo}>Audio loaded successfully!</p>
            <button 
              className={styles.startButton}
              onClick={handleStartClick}
              disabled={startClicked}
            >
              Start Audio Session
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;