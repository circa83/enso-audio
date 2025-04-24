// src/components/audio/LayerControl.js
import React, { memo, useCallback, useEffect, useRef } from 'react';
import { useLayer } from '../../hooks/useLayer';
import { useVolume } from '../../hooks/useVolume';
import styles from '../../styles/components/LayerControl.module.css';

/**
 * LayerControl component for managing individual audio layer volumes
 * and track selection with layer management integration
 * 
 * @param {Object} props Component props
 * @param {string} props.label Display label for the layer
 * @param {string} props.layer Layer identifier
 * @param {Array} props.tracks Available tracks for this layer
 * @param {string} props.activeTrackId Currently active track ID
 * @param {number} props.volume Current volume (0-1)
 * @param {boolean} props.isMuted Whether layer is muted
 * @param {Function} props.onVolumeChange Callback when volume changes
 * @param {Function} props.onTrackChange Callback when track selection changes
 * @param {Function} props.onMuteToggle Callback when mute is toggled
 * @returns {JSX.Element} Rendered component
 */
const LayerControl = ({ 
  label, 
  layer,
  tracks = [],
  activeTrackId,
  volume = 0,
  isMuted = false,
  onVolumeChange,
  onTrackChange,
  onMuteToggle
}) => {
  // Track mounting state with useRef (doesn't cause re-renders)
  const isMounted = useRef(false);
  
  // Format volume as percentage for display and accessibility
  const volumePercentage = Math.round(volume * 100);
  
  // Track component lifecycle without triggering re-renders
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

  // Handle volume change 
  const handleVolumeChange = useCallback((e) => {
    const newVolume = parseFloat(e.target.value);
    if (onVolumeChange) {
      onVolumeChange(newVolume);
    }
  }, [onVolumeChange]);
  
  // Handle track selection
  const handleTrackChange = useCallback((e) => {
    const trackId = e.target.value;
    if (trackId !== activeTrackId && onTrackChange) {
      onTrackChange(trackId);
    }
  }, [activeTrackId, onTrackChange]);
  
  // Handle mute toggle
  const handleMuteToggle = useCallback(() => {
    if (onMuteToggle) {
      onMuteToggle();
    }
  }, [onMuteToggle]);
  
  // Get active track name for display
  const activeTrackName = 
    tracks.find(track => track.id === activeTrackId)?.name || 
    'No track selected';
  
  // REDESIGNED RETURN TO MATCH ORIGINAL DESIGN
  return (
    <div className={styles.layerSlider}>
      <div className={styles.labelContainer}>
        <label className={styles.label}>{label}</label>
        
        {/* Track selection functionality as a toggle button */}
        {tracks && tracks.length > 0 && (
          <div className={styles.trackControls}>
            <button 
              className={`${styles.muteButton} ${isMuted ? styles.muted : ''}`}
              onClick={onMuteToggle}
              aria-label={isMuted ? `Unmute ${label}` : `Mute ${label}`}
            >
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            
            {/* Simple track selector that can be styled to match design */}
            <select 
              className={styles.trackSelect}
              value={activeTrackId || ''}
              onChange={handleTrackChange}
              disabled={tracks.length === 0 || isMuted}
              aria-label={`Select track for ${label}`}
            >
              {tracks.map(track => (
                <option key={track.id} value={track.id}>
                  {track.name || track.id}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      {/* Volume slider - matches original design */}
      <input 
        className={styles.slider}
        type="range" 
        min="0" 
        max="1" 
        step="0.01" 
        value={volume}
        onChange={handleVolumeChange}
        disabled={isMuted}
        aria-label={`${label} Volume`}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={volumePercentage}
      />
      
      {/* Volume display */}
      <div className={styles.valueContainer}>
        <span className={styles.value}>{volumePercentage}%</span>
        
        {/* Display active track name */}
        {!isMuted && (
          <span className={styles.activeTrack} title={activeTrackName}>
            {activeTrackName}
          </span>
        )}
        
        {/* Show muted status if muted */}
        {isMuted && (
          <span className={styles.mutedStatus}>Muted</span>
        )}
      </div>
    </div>
  );
};

// Use memo to prevent unnecessary re-renders
export default memo(LayerControl);
