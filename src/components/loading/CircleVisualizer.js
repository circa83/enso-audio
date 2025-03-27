// src/components/loading/CircleVisualizer.js
import React, { useEffect, useState } from 'react';
import styles from '../../styles/components/loading/CircleVisualizer.module.css';

/**
 * CircleVisualizer - A loading visualizer that matches the AudioVisualizer style
 * @param {Object} props
 * @param {number} [props.size=200] - Size of the visualizer in pixels
 * @param {number} [props.progress=0] - Loading progress (0-100)
 */
const CircleVisualizer = ({ size = 200, progress = 0 }) => {
  // Convert progress to intensity values for each circle
  const [intensities, setIntensities] = useState({
    bass: 0,
    mid: 0,
    high: 0
  });
  
  // Update intensities based on progress
  useEffect(() => {
    // Add some randomness for a more dynamic feeling
    const addRandomness = (baseValue) => {
      return Math.min(1, baseValue + (Math.random() * 0.3 * baseValue));
    };
    
    // Calculate base intensity from progress
    const baseIntensity = progress / 100;
    
    // Stagger the intensities slightly for a more varied animation
    setIntensities({
      bass: addRandomness(baseIntensity),
      mid: addRandomness(baseIntensity * 0.9),
      high: addRandomness(baseIntensity * 0.8)
    });
    
    // Update every 200ms to create animation
    const interval = setInterval(() => {
      setIntensities(prev => ({
        bass: addRandomness(baseIntensity),
        mid: addRandomness(baseIntensity * 0.9),
        high: addRandomness(baseIntensity * 0.8)
      }));
    }, 200);
    
    return () => clearInterval(interval);
  }, [progress]);

  return (
    <div className={styles.visualizerContainer} style={{ width: size, height: size }}>
      <div className={styles.audioVisualizer}>
        {/* Red circle - Bass */}
        <div 
          className={`${styles.circle} ${styles.bass}`}
          style={{ 
            '--bass-intensity': intensities.bass 
          }}
        ></div>
        
        {/* Blue circle - Mid */}
        <div 
          className={`${styles.circle} ${styles.mid}`}
          style={{ 
            '--mid-intensity': intensities.mid 
          }}
        ></div>
        
        {/* Yellow circle - High */}
        <div 
          className={`${styles.circle} ${styles.high}`}
          style={{ 
            '--high-intensity': intensities.high 
          }}
        ></div>
        
        {/* White overlay circle */}
        <div className={`${styles.circle} ${styles.overlay}`}></div>
      </div>
    </div>
  );
};

export default CircleVisualizer;