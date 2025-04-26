// src/components/audio/LayerControl.js
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useLayer } from '../../hooks/useLayer';
import { useAudio } from '../../hooks/useAudio';
import { useBuffer } from '../../hooks/useBuffer';
import styles from '../../styles/components/LayerControl.module.css';

/**
 * Unified LayerControl component combining the functionality of 
 * LayerControl, LayerDropdown, and LayerSelector
 * 
 * @param {Object} props Component props
 * @param {string} props.layer Layer identifier
 * @returns {JSX.Element} Rendered component
 */
const LayerControl = ({ layer }) => {
  // Get layer-specific data using the enhanced useLayer hook
  const { 
    getTracksForLayer,
    getActiveTrack,
    changeTrack,
    isLayerMuted,
    toggleMute
  } = useLayer();
  
  // Get volume control for this layer
  const { getLayerVolume, setLayerVolume } = useAudio();
  
  // Get buffer loading status
  const { getLoadingStatus } = useBuffer();
  
  // Get audio system state for crossfades
  const { 
    transitions: { 
      active: activeCrossfades, 
      progress: crossfadeProgress, 
      preloadProgress 
    },
    playback: { isPlaying } 
  } = useAudio();
  
  // Local state
  const [isExpanded, setIsExpanded] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [errorMessage, setErrorMessage] = useState(null);
  
  // Refs
  const dropdownRef = useRef(null);
  const toggleButtonRef = useRef(null);
  const isMounted = useRef(false);
  
  // Get data for this layer
  const tracks = getTracksForLayer(layer);
  const activeTrackId = getActiveTrack(layer);
  const volume = getLayerVolume(layer) || 0;
  const isMuted = isLayerMuted(layer);
  
  // Format volume as percentage for display and accessibility
  const volumePercentage = Math.round(volume * 100);
  
  // Get z-index based on layer name for proper stacking
  const getZIndexForLayer = useCallback((layerName) => {
    // Significantly increased z-index values with wider gaps between them
    switch(layerName) {
      case 'Layer 1':
        return 10000; // 1 is at the top 
      case 'Layer 2':
        return 9500; // 2 is below 1
      case 'Layer 3':
        return 9000; // 3 is below 2
      case 'Layer 4':
        return 8500; // 4 is at the bottom
      default:
        return 8000; // Fallback
    }
  }, []);
  
  // Track component lifecycle
  useEffect(() => {
    // Only log on initial mount
    if (!isMounted.current) {
      isMounted.current = true;
      console.log(`[LayerControl] Mounted for ${layer}, initial volume: ${volume}`);
    }
    
    // Cleanup on unmount
    return () => {
      console.log(`[LayerControl] Unmounted for ${layer}`);
      isMounted.current = false;
    };
  }, [layer, volume]);
  
  // Update menu position function
  const updateMenuPosition = useCallback(() => {
    if (!toggleButtonRef.current) return;
    
    const rect = toggleButtonRef.current.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom,
      left: rect.left
    });
  }, [toggleButtonRef]);
  
  // Handle scroll event to update dropdown position
  useEffect(() => {
    const handleScroll = () => {
      if (isExpanded) {
        updateMenuPosition();
      }
    };
    
    // Add event listeners for when dropdown is expanded
    if (isExpanded) {
      updateMenuPosition(); // Initial position update
      window.addEventListener('scroll', handleScroll);
      window.addEventListener('resize', handleScroll);
    }
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isExpanded, updateMenuPosition]);
  
  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsExpanded(false);
      }
    };
    
    // Only add event listener when the dropdown is expanded
    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);
  
  // Close dropdown on ESC key press
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };
    
    document.addEventListener('keydown', handleEscKey);
    
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isExpanded]);
  
  // Handle volume change
  const handleVolumeChange = useCallback((e) => {
    const newVolume = parseFloat(e.target.value);
    setLayerVolume(layer, newVolume);
  }, [layer, setLayerVolume]);
  
  // Toggle dropdown visibility
  const toggleDropdown = useCallback((e) => {
    e.stopPropagation(); // Prevent event from reaching parent elements
    setIsExpanded(prev => !prev);
  }, []);
  
  // Toggle mute state
  const handleMuteToggle = useCallback(() => {
    toggleMute(layer);
  }, [layer, toggleMute]);
  
  // Handle track selection from dropdown
  const handleTrackSelect = useCallback(async (e, trackId) => {
    e.stopPropagation(); // Prevent event bubbling
    e.preventDefault();
    
    // Don't allow selection during active crossfade
    if (activeCrossfades && activeCrossfades[layer]) {
      console.log(`Crossfade already in progress for ${layer}`);
      return;
    }
    
    // Skip if already selected
    if (trackId === activeTrackId) {
      setIsExpanded(false);
      return;
    }
    
    // Clear previous errors
    setErrorMessage(null);
    
    try {
      console.log(`[LayerControl] User selected track ${trackId} for ${layer}`);
      
      // Execute the track change with crossfade
      const transitionDuration = isPlaying ? 3000 : 200;
      changeTrack(layer, trackId, transitionDuration);
      
      // Close the dropdown
      setIsExpanded(false);
    } catch (error) {
      console.error(`[LayerControl] Error selecting track: ${error.message}`);
      setErrorMessage('Error during track transition. Please try again.');
    }
  }, [layer, activeCrossfades, activeTrackId, isPlaying, changeTrack]);
  
  // Get active track name
  const getActiveTrackName = useCallback(() => {
    if (!activeTrackId || !tracks) return 'None';
    
    const activeTrack = tracks.find(t => t.id === activeTrackId);
    return activeTrack ? activeTrack.name : 'None';
  }, [activeTrackId, tracks]);
  
  // Check if the layer is currently in a crossfade
  const isInCrossfade = activeCrossfades && activeCrossfades[layer];
  
  // Get progress percentage for display
  const getProgressPercent = useCallback(() => {
    if (!isInCrossfade) return 0;
    return Math.floor((crossfadeProgress[layer] || 0) * 100);
  }, [isInCrossfade, crossfadeProgress, layer]);
  
  // Get crossfade info
  const getCrossfadeInfo = useCallback(() => {
    const isInCrossfade = activeCrossfades && activeCrossfades[layer];
    if (!isInCrossfade) return null;
    
    const sourceTrack = tracks.find(t => t.id === activeCrossfades[layer].from);
    const targetTrack = tracks.find(t => t.id === activeCrossfades[layer].to);
    
    return {
      from: sourceTrack ? sourceTrack.name : 'Unknown',
      to: targetTrack ? targetTrack.name : 'Unknown',
      progress: getProgressPercent(),
      isLoading: activeCrossfades[layer].isLoading
    };
  }, [tracks, activeCrossfades, layer, getProgressPercent]);
  
  // Get crossfade info if active
  const crossfadeInfo = isInCrossfade ? getCrossfadeInfo() : null;
  
  // Calculate z-index for the current layer
  const zIndex = getZIndexForLayer(layer);
  
  // Render the layer control with dropdown and expanded details
  return (
    <div className={styles.layerControl}>
      {/* Layer Control Main View - combines LayerControl sliders and toggles */}
      <div className={styles.layerSlider}>
        <div className={styles.labelContainer}>
          <label className={styles.label}>{layer}</label>
          
          {/* Mute button */}
          <div className={styles.trackControls}>
            <button 
              className={`${styles.muteButton} ${isMuted ? styles.muted : ''}`}
              onClick={handleMuteToggle}
              aria-label={isMuted ? `Unmute ${layer}` : `Mute ${layer}`}
            >
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            
            {/* Track dropdown toggle button - from LayerDropdown */}
            <div className={styles.dropdownContainer} ref={dropdownRef}>
              <button 
                className={`${styles.dropdownToggle} ${isExpanded ? styles.expanded : ''} ${isInCrossfade ? styles.crossfading : ''}`}
                onClick={toggleDropdown}
                disabled={isInCrossfade}
                type="button"
                ref={toggleButtonRef}
              >
                <span className={styles.currentTrack}>
                  {isInCrossfade ? (
                    <span className={styles.crossfadeStatus}>
                      Transitioning ({getProgressPercent()}%)
                    </span>
                  ) : (
                    getActiveTrackName()
                  )}
                </span>
                <span className={styles.arrowIcon}>▼</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Volume slider */}
        <input 
          className={styles.slider}
          type="range" 
          min="0" 
          max="1" 
          step="0.01" 
          value={volume}
          onChange={handleVolumeChange}
          disabled={isMuted}
          aria-label={`${layer} Volume`}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={volumePercentage}
        />
        
        {/* Volume display */}
        <div className={styles.valueContainer}>
          <span className={styles.value}>{volumePercentage}%</span>
          
          {/* Display active track name */}
          {!isMuted && (
            <span className={styles.activeTrack} title={getActiveTrackName()}>
              {getActiveTrackName()}
            </span>
          )}
          
          {/* Show muted status if muted */}
          {isMuted && (
            <span className={styles.mutedStatus}>Muted</span>
          )}
        </div>
      </div>
      
      {/* Dropdown Menu for Track Selection - from LayerDropdown */}
      {isExpanded && (
        <>
          {/* Add a full-screen transparent overlay to capture clicks */}
          <div 
            className={styles.menuOverlay} 
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(false);
            }}
            style={{ zIndex: zIndex - 1 }}
          />
          
          <ul 
            className={styles.dropdownMenu}
            onClick={(e) => e.stopPropagation()} 
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              zIndex: zIndex 
            }}
          >
            {/* Error message if any */}
            {errorMessage && (
              <div className={styles.errorMessage}>{errorMessage}</div>
            )}
            
            {/* Track list */}
            {tracks.map((track) => {
              // Check if this track is part of an active crossfade
              const isSource = isInCrossfade && activeCrossfades[layer].from === track.id;
              const isTarget = isInCrossfade && activeCrossfades[layer].to === track.id;
              const isLoading = isInCrossfade && activeCrossfades[layer].isLoading && activeCrossfades[layer].to === track.id;
              const isActive = activeTrackId === track.id;
              
              // Check if this track is currently preloading but not in a crossfade yet
              const isPreloading = !isInCrossfade && preloadProgress && preloadProgress[track.id] !== undefined && preloadProgress[track.id] < 100;
              const preloadPercent = preloadProgress && preloadProgress[track.id] ? preloadProgress[track.id] : 0;
              // Get buffer loading status for this track
              const bufferStatus = track.path ? getLoadingStatus(track.path) : { isLoading: false, progress: 0 };
              
              return (
                <li
                  key={track.id}
                  className={`${styles.dropdownItem} ${isActive ? styles.active : ''} 
                    ${isSource ? styles.crossfadeSource : ''} 
                    ${isTarget ? styles.crossfadeTarget : ''} 
                    ${isLoading || isPreloading || bufferStatus.isLoading ? styles.loading : ''}`}
                  onClick={(e) => handleTrackSelect(e, track.id)}
                >
                  <div className={styles.trackInfo}>
                    <span className={styles.trackName}>{track.name}</span>
                    
                    {/* Loading/progress indicators */}
                    {(isLoading || isPreloading || bufferStatus.isLoading) && (
                      <span className={styles.loadingIndicator}>
                        {isLoading ? 'Loading...' : bufferStatus.isLoading ? `Loading ${bufferStatus.progress}%` : `Preloading ${preloadPercent}%`}
                      </span>
                    )}
                    
                    {/* Active indicator */}
                    {isActive && !isSource && !isTarget && (
                      <span className={styles.activeIndicator}>Active</span>
                    )}
                    
                    {/* Crossfade indicators */}
                    {isSource && (
                      <span className={styles.crossfadeIndicator}>
                        Fading Out ({getProgressPercent()}%)
                      </span>
                    )}
                    
                    {isTarget && (
                      <span className={styles.crossfadeIndicator}>
                        Fading In ({getProgressPercent()}%)
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
            
            {/* Empty state if no tracks */}
            {(!tracks || tracks.length === 0) && (
              <li className={styles.dropdownItem}>
                <span className={styles.emptyMessage}>No tracks available</span>
              </li>
            )}
          </ul>
        </>
      )}
      
      {/* Expanded Details View - from LayerSelector */}
      {isExpanded && (
        <div 
          className={styles.expandedDetails}
          style={{ zIndex: zIndex }}
        >
          {/* Crossfade Progress Bar */}
          {isInCrossfade && (
            <div className={styles.crossfadeContainer}>
              <div className={styles.crossfadeLabel}>
                Crossfading: {crossfadeInfo?.from} → {crossfadeInfo?.to}
              </div>
              <div className={styles.progressContainer}>
                <div 
                  className={styles.progressBar} 
                  style={{ width: `${getProgressPercent()}%` }}
                ></div>
                <div className={styles.progressText}>
                  {getProgressPercent()}%
                </div>
              </div>
            </div>
          )}
          
          {/* Layer Status Information */}
          <div className={styles.layerStatus}>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Status:</span>
              <span className={styles.statusValue}>
                {isMuted ? 'Muted' : isInCrossfade ? 'Transitioning' : isPlaying ? 'Playing' : 'Ready'}
              </span>
            </div>
            
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Active Track:</span>
              <span className={styles.statusValue}>{getActiveTrackName()}</span>
            </div>
            
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Volume:</span>
              <span className={styles.statusValue}>{volumePercentage}%</span>
            </div>
            
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Available Tracks:</span>
              <span className={styles.statusValue}>{tracks ? tracks.length : 0}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Use memo to prevent unnecessary re-renders
export default memo(LayerControl);
