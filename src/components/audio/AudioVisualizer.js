// src/components/audio/AudioVisualizer.js
import React, { useEffect, useRef } from 'react';
import { useAudio } from '../../hooks/useAudio'; // Fixed import path
import styles from '../../styles/components/AudioVisualizer.module.css';

/**
 * AudioVisualizer - Visual representation of the audio playback
 * Displays reactive circular visualizations based on audio layers
 */
const AudioVisualizer = () => {
  // Extract only what we need from the context
  const { 
    isPlaying, 
    volumes
  } = useAudio();
  
  const visualizerRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  // Define frequency range directly to avoid LAYERS dependency
  // This prevents the error since we're not depending on potentially undefined values
  const bassLayers = ['drone', 'rhythm'];
  const midLayers = ['melody'];
  const highLayers = ['nature'];
  
  // Animation effect for visualization
  useEffect(() => {
    // Function to calculate intensity values with randomness
    const calculateIntensities = () => {
      // Get average volumes for each frequency range
      const bassVolume = bassLayers.reduce((sum, layer) => 
        sum + (volumes[layer] || 0), 0) / bassLayers.length;
      
      const midVolume = midLayers.reduce((sum, layer) => 
        sum + (volumes[layer] || 0), 0) / midLayers.length;
      
      const highVolume = highLayers.reduce((sum, layer) => 
        sum + (volumes[layer] || 0), 0) / highLayers.length;
      
      // Add randomness for more lively visualization
      const addRandomness = (value) => {
        if (!isPlaying) return value;
        // Add varying intensity changes based on volume
        return Math.min(1, value + (Math.random() * 0.5 * value));
      };
      
      return {
        bassIntensity: addRandomness(bassVolume),
        midIntensity: addRandomness(midVolume),
        highIntensity: addRandomness(highVolume)
      };
    };
    
    // Animation function
    const updateVisualization = () => {
      if (!visualizerRef.current) return;
      
      if (isPlaying) {
        // Calculate new intensities
        const { bassIntensity, midIntensity, highIntensity } = calculateIntensities();
        
        // Update CSS variables for animation
        document.documentElement.style.setProperty('--bass-intensity', bassIntensity);
        document.documentElement.style.setProperty('--mid-intensity', midIntensity);
        document.documentElement.style.setProperty('--high-intensity', highIntensity);
        
        // Continue animation
        animationFrameRef.current = requestAnimationFrame(updateVisualization);
      } else {
        // Reset visualization when not playing
        document.documentElement.style.setProperty('--bass-intensity', 0);
        document.documentElement.style.setProperty('--mid-intensity', 0);
        document.documentElement.style.setProperty('--high-intensity', 0);
      }
    };
    
    // Start or stop animation based on playing state
    if (isPlaying) {
      updateVisualization();
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      
      // Reset visualizer
      document.documentElement.style.setProperty('--bass-intensity', 0);
      document.documentElement.style.setProperty('--mid-intensity', 0);
      document.documentElement.style.setProperty('--high-intensity', 0);
    }
    
    // Cleanup function
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, volumes]);
  
  return (
    <div className={styles.visualizerContainer} ref={visualizerRef}>
      <div className={styles.audioVisualizer} aria-label="Audio visualizer">
        <div className={`${styles.circle} ${styles.bass}`}></div>
        <div className={`${styles.circle} ${styles.mid}`}></div>
        <div className={`${styles.circle} ${styles.high}`}></div>
        <div className={`${styles.circle} ${styles.overlay}`}></div>
      </div>
    </div>
  );
};

export default React.memo(AudioVisualizer);