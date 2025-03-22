// src/components/audio/LayerSelector.js
import React, { useState } from 'react';
import { useAudio } from '../../contexts/StreamingAudioContext';
import styles from '../../styles/components/LayerSelector.module.css';

const LayerSelector = ({ layer }) => {
  const { 
    audioLibrary, 
    activeAudio, 
    crossfadeTo
  } = useAudio();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadingTrack, setLoadingTrack] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Handle track selection
  const handleTrackSelect = async (trackId) => {
    // Don't do anything if already selected or already loading
    if (trackId === activeAudio[layer] || loadingTrack) return;
    
    setLoadingTrack(trackId);
    setErrorMessage(null);
    
    try {
      // Attempt crossfade (preloading happens inside crossfadeTo)
      await crossfadeTo(layer, trackId);
      
      // Close the selector after selection
      setIsExpanded(false);
    } catch (error) {
      console.error('Error changing track:', error);
      setErrorMessage('Could not load audio track');
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
          
          {audioLibrary[layer] && audioLibrary[layer].map(track => (
            <div 
              key={track.id}
              className={`
                ${styles['track-item']} 
                ${activeAudio[layer] === track.id ? styles.active : ''}
                ${loadingTrack === track.id ? styles.loading : ''}
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