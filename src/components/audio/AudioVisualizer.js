// src/components/audio/AudioVisualizer.js
import React, { useEffect, useRef, memo } from 'react';
import { useAudio } from '../../hooks/useAudio';
import styles from '../../styles/components/AudioVisualizer.module.css';

/**
 * AudioVisualizer component
 * Creates a visual representation of the currently playing audio
 * Uses reactive circles that respond to different frequency bands
 * 
 * @returns {JSX.Element} Rendered component
 */
const AudioVisualizer = () => {
  // Use our new hook with grouped API
  const { playback, volume, layers } = useAudio();
  
  // References
  const visualizerRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  // Effect for visualization animation
  useEffect(() => {
    // Maps layers to frequency bands for visualization
    const bassLayers = [layers.TYPES.DRONE, layers.TYPES.RHYTHM];
    const midLayers = [layers.TYPES.MELODY];
    const highLayers = [layers.TYPES.NATURE];
    
    // Function to simulate audio reactivity
    const updateVisualization = () => {
      if (!visualizerRef.current) return;
      
      // Get current layer volumes
      const layerVolumes = volume.layers;
      
      // Get average volumes for each frequency range
      const bassVolume = bassLayers.reduce((sum, layer) => 
        sum + (layerVolumes[layer.toLowerCase()] || 0), 0) / bassLayers.length;
      
      const midVolume = midLayers.reduce((sum, layer) => 
        sum + (layerVolumes[layer.toLowerCase()] || 0), 0) / midLayers.length;
      
      const highVolume = highLayers.reduce((sum, layer) => 
        sum + (layerVolumes[layer.toLowerCase()] || 0), 0) / highLayers.length;
      
      // Add randomness for more lively visualization
      const addRandomness = (value) => {
        if (!playback.isPlaying) return value;
        // Add varying intensity changes based on volume
        return Math.min(1, value + (Math.random() * 0.5 * value));
      };
      
      // Calculate intensity values with randomness
      const bassIntensity = addRandomness(bassVolume);
      const midIntensity = addRandomness(midVolume);
      const highIntensity = addRandomness(highVolume);
      
      // Update CSS variables for animation
      document.documentElement.style.setProperty('--bass-intensity', bassIntensity);
      document.documentElement.style.setProperty('--mid-intensity', midIntensity);
      document.documentElement.style.setProperty('--high-intensity', highIntensity);
      
      // Continue animation if playing
      if (playback.isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateVisualization);
      }
    };
    
    if (playback.isPlaying) {
      // Start visualization loop
      updateVisualization();
    } else {
      // Reset visualization when not playing
      document.documentElement.style.setProperty('--bass-intensity', 0);
      document.documentElement.style.setProperty('--mid-intensity', 0);
      document.documentElement.style.setProperty('--high-intensity', 0);
      
      // Cancel animation loop
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
    
    // Cleanup function
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [playback.isPlaying, volume.layers, layers.TYPES]);
  
  return (
    <div className={styles.visualizerContainer} ref={visualizerRef}>
      <div className={styles.audioVisualizer}>
      <img 
          src="../../images/Stillness_EnsōAudio_bkcp.png" 
          alt="Ensō circle" 
          className={styles.visualizerImage}
        />
        
     {/*   <div className={`${styles.circle} ${styles.bass}`}></div>
        <div className={`${styles.circle} ${styles.mid}`}></div>
        <div className={`${styles.circle} ${styles.high}`}></div>
        <div className={`${styles.circle} ${styles.overlay}`}></div>
      </div> */}
      </div>
    </div>
  );
};

// Use memo for performance optimization
export default memo(AudioVisualizer);