// src/components/loading/CircleVisualizer.js
import React from 'react';
import styles from '../../styles/components/loading/CircleVisualizer.module.css';

/**
 * CircleVisualizer - An animated loading indicator with concentric circles
 * @param {Object} props
 * @param {number} [props.size=200] - Size of the visualizer in pixels
 * @param {boolean} [props.isActive=true] - Whether the animation is active
 * @param {number} [props.progress=0] - Loading progress (0-100)
 */
const CircleVisualizer = ({ size = 200, isActive = true, progress = 0 }) => {
  // Calculate the progress percentage for the progress arc
  const radius = size / 2;
  const circumference = 2 * Math.PI * (radius - 10); // Adjust for stroke width
  const progressOffset = circumference - (progress / 100) * circumference;
  
  return (
    <div 
      className={`${styles.container} ${isActive ? styles.active : ''}`}
      style={{ width: size, height: size }}
    >
      {/* Outermost circle - pulsating */}
      <div className={styles.pulseCircle}></div>
      
      {/* Main circles */}
      <svg 
        className={styles.svg} 
        width={size} 
        height={size} 
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Background circle */}
        <circle 
          className={styles.backgroundCircle}
          cx={radius}
          cy={radius}
          r={radius - 10}
          strokeWidth="1"
        />
        
        {/* Middle circle - rotating */}
        <circle 
          className={styles.rotatingCircle}
          cx={radius}
          cy={radius}
          r={radius - 25}
          strokeWidth="1"
          strokeDasharray="4 6"
        />
        
        {/* Inner circle - pulsating */}
        <circle 
          className={styles.innerCircle}
          cx={radius}
          cy={radius}
          r={radius - 45}
          strokeWidth="1"
        />
        
        {/* Progress indicator */}
        <circle 
          className={styles.progressCircle}
          cx={radius}
          cy={radius}
          r={radius - 10}
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={progressOffset}
          transform={`rotate(-90 ${radius} ${radius})`}
        />
      </svg>
      
      {/* Display progress percentage in the center */}
      <div className={styles.progressText}>
        {Math.round(progress)}%
      </div>
      
      {/* Ensō (Zen circle) symbol in the center */}
      <div className={styles.ensoSymbol}>
        音
      </div>
    </div>
  );
};

export default CircleVisualizer;