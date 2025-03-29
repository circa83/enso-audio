// src/components/audio/LayerControl.js
import React, { memo, useCallback } from 'react';
import LayerDropdown from './LayerDropdown'; 
import styles from '../../styles/components/LayerControl.module.css';

/**
 * LayerControl - Component for individual audio layer volume control
 * 
 * @param {Object} props - Component props
 * @param {string} props.label - Display label for the control
 * @param {number} props.value - Current volume value (0-1)
 * @param {Function} props.onChange - Callback for volume changes
 * @param {string} props.layer - Audio layer ID
 */
const LayerControl = ({ label, value, onChange, layer }) => {
  // Handle slider value change
  const handleChange = useCallback((e) => {
    const newValue = parseFloat(e.target.value);
    onChange(newValue);
  }, [onChange]);
  
  // Format volume percentage for display
  const volumePercentage = Math.round(value * 100);
  
  return (
    <div className={styles.layerSlider}>
      <div className={styles.labelContainer}>
        <label 
          className={styles.label} 
          htmlFor={`volume-${layer}`}
        >
          {label}
        </label>
        <LayerDropdown layer={layer} />
      </div>
      
      <input 
        id={`volume-${layer}`}
        type="range" 
        min="0" 
        max="1" 
        step="0.01" 
        value={value} 
        onChange={handleChange}
        className={styles.slider}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={volumePercentage}
        aria-label={`${label} volume`}
      />
      
      <span className={styles.value}>{volumePercentage}%</span>
    </div>
  );
};

// Use memo to prevent unnecessary re-renders
export default memo(LayerControl);