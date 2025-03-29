// src/components/player/PlayerControlPanel.js
import React, { useState, useCallback, useEffect } from 'react';
import { useAudio } from '../../contexts/AudioContext';
import AudioVisualizer from '../audio/AudioVisualizer';
import MasterVolumeControl from '../audio/MasterVolumeControl';
import styles from '../../styles/components/PlayerControlPanel.module.css';

/**
 * PlayerControlPanel - Main control interface for audio playback
 * Includes play/pause button, visualizer, and master volume control
 * With improved activation handling
 */
const PlayerControlPanel = () => {
  const { 
    isPlaying, 
    startSession, 
    pauseSession, 
    isAudioActivated,
    activateAudio,
    audioCore,
    volumes,
    activeAudio
  } = useAudio();
  
  const [isActivating, setIsActivating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Handle audio context activation and automatic retry
  useEffect(() => {
    // This effect activates audio on mount to prepare for playback
    const prepareAudio = async () => {
      if (!isAudioActivated && audioCore) {
        try {
          setIsActivating(true);
          
          // Attempt to activate audio with user interaction
          if (audioCore.audioContext && audioCore.audioContext.state === 'suspended') {
            console.log('Activating audio on component mount');
            await activateAudio();
          }
        } catch (error) {
          console.error('Error activating audio:', error);
        } finally {
          setIsActivating(false);
        }
      }
    };
    
    prepareAudio();
  }, [isAudioActivated, activateAudio, audioCore]);
  
  // Check for empty tracks in active audio
  useEffect(() => {
    // This helps diagnose why no sound is playing
    if (isPlaying && Object.values(activeAudio).length === 0) {
      console.warn('Playing state is true but no active audio tracks are loaded');
      setErrorMessage('No audio tracks loaded. Please reload the page.');
    } else if (isPlaying) {
      // Log volumes for debugging
      const allZero = Object.values(volumes).every(vol => vol === 0);
      if (allZero) {
        console.warn('All volume levels are set to zero');
        setErrorMessage('All volume levels are at zero. Please increase volume.');
      } else {
        setErrorMessage('');
      }
    } else {
      setErrorMessage('');
    }
  }, [isPlaying, activeAudio, volumes]);
  
  // Enhanced toggle function that handles activation
  const togglePlayPause = useCallback(async () => {
    try {
      if (isActivating) {
        console.log('Still activating audio, please wait...');
        return;
      }
      
      if (isPlaying) {
        console.log('Pausing session...');
        pauseSession();
      } else {
        console.log('Starting session...');
        setIsActivating(true);
        
        // Make sure audio is activated first
        if (!isAudioActivated) {
          await activateAudio();
        }
        
        const success = await startSession();
        console.log(`Session start ${success ? 'successful' : 'failed'}`);
        
        if (!success) {
          const contextState = audioCore?.audioContext?.state || 'unknown';
          console.warn(`Audio context state after failed start: ${contextState}`);
          
          if (contextState === 'suspended') {
            setErrorMessage('Audio system blocked. Click play again.');
          } else {
            setErrorMessage('Failed to start audio playback. Try reloading.');
          }
        }
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      setErrorMessage('Error toggling playback. Please reload the page.');
    } finally {
      setIsActivating(false);
    }
  }, [isPlaying, startSession, pauseSession, isAudioActivated, activateAudio, audioCore, isActivating]);
  
  return (
    <div className={styles.playerControlPanel}>
      <div className={styles.visualizerSection}>
        <AudioVisualizer />
      </div>
      
      <div className={styles.controlsSection}>
        <button 
          className={`${styles.playButton} ${isPlaying ? styles.playing : ''} ${isActivating ? styles.activating : ''}`}
          onClick={togglePlayPause}
          disabled={isActivating}
          aria-label={isPlaying ? "Stop playback" : "Start playback"}
        >
          {isActivating ? '...' : isPlaying ? 'Stop' : 'Play'}
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