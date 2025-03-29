// src/components/audio/ImprovedLayerControls.js
import React, { memo } from 'react';
import { useAudio } from '../../contexts/StreamingAudioContext';
import ImprovedLayerControl from './ImprovedLayerControl';
import styles from '../../styles/components/LayerControls.module.css';

/**
 * ImprovedLayerControls - Container for all audio layer controls
 * Manages the set of layer volume sliders and dropdown selectors
 */
const ImprovedLayerControls = () => {
  const { LAYERS, volumes, setVolume } = useAudio();
  
  return (
    <div className={styles.layerControlsContent}>
      {Object.values(LAYERS).map(layer => (
        <ImprovedLayerControl
          key={layer}
          label={layer.charAt(0).toUpperCase() + layer.slice(1)}
          value={volumes[layer.toLowerCase()]}
          onChange={(value) => setVolume(layer.toLowerCase(), value)}
          layer={layer.toLowerCase()}
        />
      ))}
    </div>
  );
};

// Use memo to prevent unnecessary re-renders
export default memo(ImprovedLayerControls);