// src/components/audio/LayerSelector.js
import React, { useState, useCallback } from 'react';
import { useAudio } from '../../hooks/useAudio'; // Import the refactored hook
import styles from '../../styles/components/LayerSelector.module.css';

const LayerSelector = ({ layer }) => {
  const { 
    audioLibrary, 
    activeAudio, 
    crossfadeTo,
    activeCrossfades,
    crossfadeProgress,
    preloadProgress  // New: track loading progress
  } = useAudio();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Handle track selection with useCallback
  const handleTrackSelect = useCallback(async (trackId) => {
    // Don't do anything if already selected or already in a crossfade
    if (trackId === activeAudio[layer]) {
      console.log(`${trackId} already selected`);
      return;
    }
    
    // Don't allow selection during active crossfade
    if (activeCrossfades && activeCrossfades[layer]) {
      console.log(`Crossfade already in progress for ${layer}`);
      return;
    }
    
    // Clear previous errors
    setErrorMessage(null);
    
    try {
      console.log(`User selected track ${trackId} for ${layer}`);
      
      // Attempt crossfade with the exposed function name
      const success = await crossfadeTo(layer, trackId, transitionDuration);
      
      if (!success) {
        setErrorMessage('Could not load audio track. Please try again.');
      }
    } catch (error) {
      console.error('Error changing track:', error);
      setErrorMessage('Error during track transition. Please try again.');
    }
  }, [layer, activeAudio, activeCrossfades, crossfadeTo, transitionDuration]);

  // Toggle expanded state with useCallback
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Get active track name with useCallback
  const getActiveTrackName = useCallback(() => {
    if (!activeAudio[layer] || !audioLibrary[layer]) return 'None';
    
    const activeTrack = audioLibrary[layer].find(t => t.id === activeAudio[layer]);
    return activeTrack ? activeTrack.name : 'None';
  }, [activeAudio, audioLibrary, layer]);

  // Get progress percentage for display with useCallback
  const getProgressPercent = useCallback(() => {
    if (!activeCrossfades || !activeCrossfades[layer]) return 0;
    return Math.floor((crossfadeProgress[layer] || 0) * 100);
  }, [activeCrossfades, crossfadeProgress, layer]);
  
  // Get crossfade info with useCallback
  const getCrossfadeInfo = useCallback(() => {
    const isInCrossfade = activeCrossfades && activeCrossfades[layer];
    if (!isInCrossfade) return null;
    
    const sourceTrack = audioLibrary[layer].find(t => t.id === activeCrossfades[layer].from);
    const targetTrack = audioLibrary[layer].find(t => t.id === activeCrossfades[layer].to);
    
    return {
      from: sourceTrack ? sourceTrack.name : 'Unknown',
      to: targetTrack ? targetTrack.name : 'Unknown',
      progress: getProgressPercent(),
      isLoading: activeCrossfades[layer].isLoading
    };
  }, [audioLibrary, activeCrossfades, layer, getProgressPercent]);

  // Check if the layer is currently in a crossfade
  const isInCrossfade = activeCrossfades && activeCrossfades[layer];

  // Get crossfade info if active
  const crossfadeInfo = isInCrossfade ? getCrossfadeInfo() : null;

  return (
    <div className={styles['layer-selector']}>
      <div 
        className={`
          ${styles['layer-selector-header']} 
          ${isExpanded ? styles.active : ''} 
          ${isInCrossfade ? styles.crossfading : ''}
        `}
        onClick={toggleExpanded}
      >
        <div className={styles['layer-info']}>
          <span className={styles['layer-name']}>
            {layer.charAt(0).toUpperCase() + layer.slice(1)}
          </span>
          
          {isInCrossfade ? (
            <span className={styles['crossfade-info']}>
              {crossfadeInfo.isLoading ? (
                <span>Loading...</span>
              ) : (
                <span>Transitioning ({crossfadeInfo.progress}%)</span>
              )}
            </span>
          ) : (
            <span className={styles['active-sample']}>
              {getActiveTrackName()}
            </span>
          )}
        </div>
        
        {/* Crossfade progress bar */}
        {isInCrossfade && !crossfadeInfo.isLoading && (
          <div className={styles['crossfade-progress-container']}>
            <div 
              className={styles['crossfade-progress-bar']} 
              style={{ width: `${crossfadeInfo.progress}%` }}
            ></div>
          </div>
        )}
        
        <div className={`${styles['expand-icon']} ${isExpanded ? styles.expanded : ''}`}>
          ▼
        </div>
      </div>
      
      {isExpanded && (
        <div className={styles['track-list']}>
          {errorMessage && (
            <div className={styles['error-message']}>{errorMessage}</div>
          )}
          
          {audioLibrary[layer] && audioLibrary[layer].map(track => {
            // Check if this track is part of an active crossfade
            const isSource = isInCrossfade && activeCrossfades[layer].from === track.id;
            const isTarget = isInCrossfade && activeCrossfades[layer].to === track.id;
            const isLoading = isInCrossfade && activeCrossfades[layer].isLoading && activeCrossfades[layer].to === track.id;
            
            // Check if this track is currently preloading but not in a crossfade yet
            const isPreloading = !isInCrossfade && preloadProgress && preloadProgress[track.id] !== undefined && preloadProgress[track.id] < 100;
            const preloadPercent = preloadProgress && preloadProgress[track.id] ? preloadProgress[track.id] : 0;
            
            return (
              <div 
                key={track.id}
                className={`
                  ${styles['track-item']} 
                  ${activeAudio[layer] === track.id ? styles.active : ''}
                  ${isSource ? styles.fadeOut : ''}
                  ${isTarget ? styles.fadeIn : ''}
                  ${isLoading || isPreloading ? styles.loading : ''}
                `}
                onClick={() => {
                  // Only allow selection if not currently preloading or in a crossfade
                  if (!isPreloading && !isInCrossfade) {
                    handleTrackSelect(track.id);
                  }
                }}
              >
                <span className={styles['track-name']}>{track.name}</span>
                
                {/* Preloading indicator (not in crossfade yet) */}
                {isPreloading && (
                  <div className={styles['preload-container']}>
                    <span className={styles['loading-indicator']}>Preparing ({preloadPercent}%)</span>
                    <div className={styles['preload-bar-container']}>
                      <div 
                        className={styles['preload-bar']} 
                        style={{ width: `${preloadPercent}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                
                {/* Loading indicator */}
                {isLoading && (
                  <span className={styles['loading-indicator']}>Loading...</span>
                )}
                
                {/* Crossfade indicators */}
                {isSource && !isLoading && (
                  <span className={styles['fade-indicator']}>Fading out</span>
                )}
                
                {isTarget && !isLoading && (
                  <span className={styles['fade-indicator']}>Fading in</span>
                )}
                
                {/* Active indicator */}
                {activeAudio[layer] === track.id && !isInCrossfade && !isPreloading && (
                  <span className={styles['active-indicator']}>▶</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default React.memo(LayerSelector);