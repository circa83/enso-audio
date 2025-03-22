import React, { memo } from 'react';
import styles from '../../styles/components/LayerControl.module.css';

const LayerControl = memo(({ label, value, onChange }) => {
  const handleChange = (e) => {
    onChange(parseFloat(e.target.value));
  };
  
  return (
    <div className={styles['layer-slider']}>
      <label className={styles['slider-label']}>{label}</label>
      <input 
        className={styles['slider-input']}
        type="range" 
        min="0" 
        max="1" 
        step="0.01" 
        value={value}
        onChange={handleChange}
      />
      <span className={styles['slider-value']}>{Math.round(value * 100)}%</span>
    </div>
  );
});

// Add a display name for debugging
LayerControl.displayName = 'LayerControl';

export default LayerControl;