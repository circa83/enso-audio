// src/components/player/PlayerControlPanel.js
import React, { useState, useCallback, useEffect } from 'react';
import { useAudio } from '../../hooks/useAudio';
import AudioVisualizer from '../audio/AudioVisualizer';
import MasterVolumeControl from '../audio/MasterVolumeControl';
import styles from '../../styles/components/PlayerControlPanel.module.css';

/**
 * PlayerControlPanel - Main control interface for audio playback
 * Includes play/pause button, visualizer, and master volume control
 * With improved activation and initialization handling
 */
const PlayerControlPanel = () => {
  const { 
    isPlaying, 
    startSession, 
    pauseSession, 
    isAudioActivated,
    activateAudio,
    isLoading,
    loadingProgress,
    volumes,
    activeAudio
  } = useAudio();
  
  const [isActivating, setIsActivating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  
   // Track if we have audio tracks loaded
   useEffect(() => {
    if (!isLoading) {
      // Check if we have audio tracks loaded
      const hasAudioTracks = activeAudio && Object.keys(activeAudio).length > 0;
      setIsInitialized(hasAudioTracks);
      
      if (!hasAudioTracks) {
        // Handle the case where loading completed but no tracks were loaded
        if (loadingErrors && loadingErrors.length > 0) {
          // Show a more helpful error message
          setErrorMessage(`Audio loading error: ${loadingErrors[0]}`);
        } else {
          setErrorMessage('Waiting for audio tracks to load... Check that audio files exist in the correct location.');
        }
      } else {
        setErrorMessage('');
      }
    }
  }, [isLoading, activeAudio, loadingErrors]);
  
  // Check for empty tracks in active audio
  useEffect(() => {
    // This helps diagnose why no sound is playing
    if (isPlaying && activeAudio && Object.keys(activeAudio).length === 0) {
      console.warn('Playing state is true but no active audio tracks are loaded');
      setErrorMessage('No audio tracks loaded. Please reload the page.');
      return;
    }
    
    if (isPlaying && volumes) {
      // Log volumes for debugging
      const allZero = Object.values(volumes).every(vol => vol === 0);
      if (allZero) {
        console.warn('All volume levels are set to zero');
        setErrorMessage('All volume levels are at zero. Please increase volume for at least one layer.');
      } else if (errorMessage === 'All volume levels are at zero. Please increase volume for at least one layer.') {
        // Clear this specific error message if volumes are now non-zero
        setErrorMessage('');
      }
    }
  }, [isPlaying, activeAudio, volumes, errorMessage]);
  
  // Enhanced toggle function that handles activation and initialization
  const togglePlayPause = useCallback(async () => {
    try {
      if (isActivating) {
        console.log('Still activating audio, please wait...');
        return;
      }
      
      if (isPlaying) {
        console.log('Pausing session...');
        pauseSession();
        return;
      }
      
      // Starting playback...
      console.log('Starting session...');
      setIsActivating(true);
      
        // Check if we have audio tracks loaded
        if (!activeAudio || Object.keys(activeAudio).length === 0) {
          console.warn('No active audio tracks loaded, cannot start playback');
          setErrorMessage('Audio tracks not loaded yet. Please check that your audio files exist in the public/samples folder.');
          setIsActivating(false);
          return;
        }
      
      // Make sure audio is activated first
      if (!isAudioActivated) {
        console.log('Activating audio context...');
        const activated = await activateAudio();
        if (!activated) {
          setErrorMessage('Failed to activate audio. Please click again or reload the page.');
          setIsActivating(false);
          return;
        }
      }
      
       // Try to start the session
       console.log('Starting audio session...');
       const success = await startSession();
       console.log(`Session start ${success ? 'successful' : 'failed'}`);
       
       if (!success) {
         setErrorMessage('Failed to start audio playback. Try clicking play again or reload the page.');
       } else {
         // Clear any error messages on successful play
         setErrorMessage('');
       }
     } catch (error) {
       console.error('Error toggling playback:', error);
       setErrorMessage(`Error toggling playback: ${error.message}. Please reload the page.`);
     } finally {
       setIsActivating(false);
     }
   }, [isPlaying, startSession, pauseSession, isAudioActivated, activateAudio, activeAudio, isActivating]);
  
  // Show loading state if tracks aren't loaded yet
  const showLoading = isLoading || !isInitialized;
  
  return (
    <div className={styles.playerControlPanel}>
      <div className={styles.visualizerSection}>
        <AudioVisualizer />
      </div>
      
      <div className={styles.controlsSection}>
        <button 
          className={`${styles.playButton} ${isPlaying ? styles.playing : ''} ${isActivating ? styles.activating : ''} ${showLoading ? styles.loading : ''}`}
          onClick={togglePlayPause}
          disabled={isActivating || showLoading}
          aria-label={isPlaying ? "Stop playback" : "Start playback"}
        >
          {isActivating ? '...' : showLoading ? 'Loading' : isPlaying ? 'Stop' : 'Play'}
        </button>
        
        {errorMessage && (
          <div className={styles.errorMessage}>
            {errorMessage}
          </div>
        )}
        
        <MasterVolumeControl />
      </div>
    </div>
  );
};

export default PlayerControlPanel;