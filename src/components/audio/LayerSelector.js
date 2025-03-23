// src/components/audio/LayerSelector.js
import React, { useState } from 'react';
import { useAudio } from '../../contexts/StreamingAudioContext';
import styles from '../../styles/components/LayerSelector.module.css';

const LayerSelector = ({ layer }) => {
  const { 
    audioLibrary, 
    activeAudio, 
    enhancedCrossfadeTo
  } = useAudio();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadingTrack, setLoadingTrack] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isCrossfading, setIsCrossfading] = useState(false);
  const [crossfadeProgress, setCrossfadeProgress] = useState(0);

  // Handle track selection with enhanced crossfade
  const handleTrackSelect = async (trackId) => {
    // Don't do anything if already selected or already loading
    if (trackId === activeAudio[layer] || loadingTrack || isCrossfading) return;
    
    setLoadingTrack(trackId);
    setErrorMessage(null);
    setIsCrossfading(true);
    setCrossfadeProgress(0);
    
    try {
      // Start progress indicator
      const progressInterval = setInterval(() => {
        setCrossfadeProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 5;
        });
      }, 100);
      
      // Use the enhanced crossfade function with a 15 second fade
      const result = await enhancedCrossfadeTo(layer, trackId, 15000);
      
      // Clear the progress interval
      clearInterval(progressInterval);
      
      if (result) {
        // Successfully crossfaded
        setCrossfadeProgress(100);
        setTimeout(() => {
          setIsCrossfading(false);
          setCrossfadeProgress(0);
          // Close the selector after successful selection
          setIsExpanded(false);
        }, 500);
      } else {
        // Crossfade failed
        setErrorMessage('Could not crossfade to selected track');
        setIsCrossfading(false);
        setCrossfadeProgress(0);
      }
    } catch (error) {
      console.error('Error changing track:', error);
      setErrorMessage('Could not load audio track');
      setIsCrossfading(false);
      setCrossfadeProgress(0);
    } finally {
      setLoadingTrack(null);
    }
  };

  // Get active track name
  const getActiveTrackName = () => {
    if (!activeAudio[layer] || !audioLibrary[layer]) return 'None';
    
    const activeTrack = audioLibrary[layer].find(t => t.id === activeAudio[layer]);
    return activeTrack ? activeTrack.name : 'None';
  };

  return (
    <div className={styles['layer-selector']}>
      <div 
        className={`${styles['layer-selector-header']} ${isExpanded ? styles.active : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={styles['layer-info']}>
          <span className={styles['layer-name']}>
            {layer.charAt(0).toUpperCase() + layer.slice(1)}
          </span>
          <span className={styles['active-sample']}>
            {getActiveTrackName()}
          </span>
        </div>
        <div className={`${styles['expand-icon']} ${isExpanded ? styles.expanded : ''}`}>
          ▼
        </div>
      </div>
      
      {isExpanded && (
        <div className={styles['track-list']}>
          {errorMessage && (
            <div className={styles['error-message']}>{errorMessage}</div>
          )}
          
          {isCrossfading && (
            <div className={styles['crossfade-progress']}>
              <div className={styles['progress-text']}>Crossfading (15s)...</div>
              <div className={styles['progress-bar-container']}>
                <div 
                  className={styles['progress-bar']} 
                  style={{width: `${crossfadeProgress}%`}}
                ></div>
              </div>
            </div>
          )}
          
          {audioLibrary[layer] && audioLibrary[layer].map(track => (
            <div 
              key={track.id}
              className={`
                ${styles['track-item']} 
                ${activeAudio[layer] === track.id ? styles.active : ''}
                ${loadingTrack === track.id ? styles.loading : ''}
                ${isCrossfading ? styles.disabled : ''}
              `}
              onClick={() => handleTrackSelect(track.id)}
            >
              <span className={styles['track-name']}>{track.name}</span>
              {loadingTrack === track.id && (
                <span className={styles['loading-indicator']}>Loading...</span>
              )}
              {activeAudio[layer] === track.id && (
                <span className={styles['active-indicator']}>▶</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LayerSelector;