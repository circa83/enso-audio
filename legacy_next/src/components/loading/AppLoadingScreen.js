import React, { useEffect, useState } from 'react';
import CircleVisualizer from './CircleVisualizer';
import styles from '../../styles/components/loading/AppLoadingScreen.module.css';

/**
 * AppLoadingScreen - Main application loading screen with visualization
 * @param {Object} props
 * @param {number} props.progress - Loading progress (0-100)
 * @param {string} props.message - Loading message to display
 * @param {boolean} props.isVisible - Whether the loading screen is visible
 */
const AppLoadingScreen = (props) => {
  const { 
    progress = 0, 
    //message = 'Loading...', 
    isVisible = true 
  } = props;
  
  const [fadeOut, setFadeOut] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);
  
  // When isVisible changes to false, trigger fade out animation
  useEffect(() => {
    if (!isVisible && !fadeOut) {
      setFadeOut(true);
      
      // Set a timer to actually remove the component after animation completes
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 500); // Match this to your CSS transition duration
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, fadeOut]);
  
  // If we shouldn't render at all, return null
  if (!shouldRender) return null;
  
  return (
    <div className={`${styles.loadingScreen} ${fadeOut ? styles.fadeOut : ''}`}>
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