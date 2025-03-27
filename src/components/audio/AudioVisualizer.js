// src/components/audio/AudioVisualizer.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAudio } from '../../contexts/StreamingAudioContext';
import styles from '../../styles/components/AudioVisualizer.module.css';

const AudioVisualizer = () => {
  const { 
    isPlaying, 
    volumes,
    LAYERS 
  } = useAudio();
  
  const visualizerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const analyzerRef = useRef(null);
  const audioContextRef = useRef(null);
  
  // Function to create audio analyzer if it doesn't exist
  const createAnalyzer = useCallback(() => {
    // Only create analyzer if we're playing and don't already have one
    if (isPlaying && !analyzerRef.current && window.AudioContext) {
      try {
        // Create audio context
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create analyzer
        analyzerRef.current = audioContextRef.current.createAnalyser();
        analyzerRef.current.fftSize = 64;
        analyzerRef.current.smoothingTimeConstant = 0.8;
        
        console.log('Audio analyzer created for visualization');
      } catch (error) {
        console.error('Failed to create audio analyzer:', error);
      }
    }
  }, [isPlaying]);
  
  // Set up animation loop based on playing state
  useEffect(() => {
    // Create analyzer if needed
    createAnalyzer();
    
    // Function to simulate audio reactivity
    const updateVisualization = () => {
      if (!visualizerRef.current) return;
      
      // Maps layers to frequency bands for visualization
      const bassLayers = [LAYERS.DRONE, LAYERS.RHYTHM];
      const midLayers = [LAYERS.MELODY];
      const highLayers = [LAYERS.NATURE];
      
      // Get average volumes for each frequency range
      const bassVolume = bassLayers.reduce((sum, layer) => 
        sum + (volumes[layer.toLowerCase()] || 0), 0) / bassLayers.length;
      
      const midVolume = midLayers.reduce((sum, layer) => 
        sum + (volumes[layer.toLowerCase()] || 0), 0) / midLayers.length;
      
      const highVolume = highLayers.reduce((sum, layer) => 
        sum + (volumes[layer.toLowerCase()] || 0), 0) / highLayers.length;
      
      // Add randomness for more lively visualization
      const addRandomness = (value) => {
        if (!isPlaying) return value;
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
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateVisualization);
      }
    };
    
    if (isPlaying) {
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
  }, [isPlaying, volumes, LAYERS, createAnalyzer]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(err => {
          console.error('Error closing audio context:', err);
        });
      }
    };
  }, []);
  
  return (
    <div className={styles.visualizerContainer} ref={visualizerRef}>
      <div className={styles.audioVisualizer}>
        <div className={`${styles.circle} ${styles.bass}`}></div>
        <div className={`${styles.circle} ${styles.mid}`}></div>
        <div className={`${styles.circle} ${styles.high}`}></div>
        <div className={`${styles.circle} ${styles.overlay}`}></div>
      </div>
    </div>
  );
};

export default AudioVisualizer;