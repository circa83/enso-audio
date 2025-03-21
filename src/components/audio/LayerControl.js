import React from 'react';
import '../../styles/components/LayerControl.css';

const LayerControl = ({ label, value, onChange }) => {
  return (
    <div className="layer-slider">
      <label>{label}</label>
      <input 
        type="range" 
        min="0" 
        max="1" 
        step="0.01" 
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span>{Math.round(value * 100)}%</span>
    </div>
  );
};

export default LayerControl;