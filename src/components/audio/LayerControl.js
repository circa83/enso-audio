// src/components/audio/LayerControl.js
import React, { memo, useCallback, useEffect, useRef } from 'react';
import { useAudio } from '../../hooks/useAudio';
import LayerDropdown from './LayerDropdown';
import styles from '../../styles/components/LayerControl.module.css';

/**
 * LayerControl component for managing individual audio layer volumes
 * Provides slider control and optional layer selection dropdown
 * 
 * @param {Object} props Component props
 * @param {string} props.label Display label for the layer
 * @param {string} props.layer Layer identifier (e.g., 'drone', 'melody')
 * @returns {JSX.Element} Rendered component
 */
const LayerControl = ({ label, layer }) => {
  // Use our new hook with grouped API
  const { volume, layers } = useAudio();
  
    // Track mounting state with useRef (doesn't cause re-renders)
    const isMounted = useRef(false);
    
    
   // Get normalized layer key (lowercase)
   const layerKey = layer.toLowerCase();
  
   // Current volume for this layer
   const currentVolume = volume.layers[layerKey] || 0;
  
  
  // Format volume as percentage for display and accessibility
  const volumePercentage = Math.round(currentVolume * 100);
  
    // Track component lifecycle without triggering re-renders
    useEffect(() => {
      // Only log on initial mount
      if (!isMounted.current) {
        isMounted.current = true;
      //  console.log(`LayerControl mounted for ${layerKey}, initial volume: ${currentVolume}`);
      }
      
      // Cleanup on unmount
      return () => {
      //  console.log(`LayerControl unmounted for ${layerKey}`);
        isMounted.current = false;
      };
    }, [layerKey, currentVolume]);

   // Handle volume change with the same pattern as master volume
   const handleVolumeChange = useCallback((e) => {
    const newVolume = parseFloat(e.target.value);
    // Set volume with immediate=true to match master volume behavior
    volume.setLayer(layerKey, newVolume, { immediate: true });
  }, [volume, layerKey]);


  
  return (
    <div className={styles.layerSlider}>
      <div className={styles.labelContainer}>
        <label className={styles.label}>{label}</label>
        {/* Only show dropdown if switchable audio is available */}
        {layers.hasSwitchable && <LayerDropdown layer={layerKey} />}
      </div>
      
      <input 
        className={styles.slider}
        type="range" 
        min="0" 
        max="1" 
        step="0.01" 
        value={currentVolume}
        onChange={handleVolumeChange}
        aria-label={`${label} Volume`}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={volumePercentage}
      />
      
      <span className={styles.value}>{volumePercentage}%</span>
    </div>
  );
};

// Use memo to prevent unnecessary re-renders
export default memo(LayerControl);