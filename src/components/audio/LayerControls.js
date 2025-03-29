// src/components/audio/LayerControls.js
import React, { memo } from 'react';
import LayerControl from './LayerControl';
import { useLayerControls } from '../../hooks/useAudio';
import styles from '../../styles/components/LayerControls.module.css';

/**
 * LayerControls - Container for all audio layer controls
 * Manages the set of layer volume sliders and dropdown selectors
 */
const LayerControls = () => {
  // Use the specialized hook instead of the full context
  const { LAYERS, volumes, setVolume } = useLayerControls();
  
  return (
    <div className={styles.layerControlsContent}>
      {Object.values(LAYERS).map(layer => (
        <LayerControl
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
export default memo(LayerControls);