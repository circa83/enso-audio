// src/components/audio/LayerControl.js
import React from 'react';
import styles from '../../styles/components/LayerControl.module.css';

const LayerControl = ({ label, value, onChange }) => {
  return (
    <div className={styles.layerSlider}>
      <label className={styles.label}>{label}</label>
      <input 
        className={styles.slider}
        type="range" 
        min="0" 
        max="1" 
        step="0.01" 
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className={styles.value}>{Math.round(value * 100)}%</span>
    </div>
  );
};

export default LayerControl;