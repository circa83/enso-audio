// src/components/audio/LayerControls.js
import React, { memo } from 'react';
import { useAudio } from '../../contexts/StreamingAudioContext';
import LayerControl from './LayerControl';
import styles from '../../styles/components/LayerControls.module.css';

/**
 * LayerControls - Component for managing all audio layers
 * Renders individual layer control sliders and tracks their state
 */
const LayerControls = () => {
  const { LAYERS, volumes, setVolume } = useAudio();
  
  return (
    <div className={styles.layerControlsContent}>
      {Object.values(LAYERS).map(layer => (
        <LayerControl
          key={layer}
          label={layer.charAt(0).toUpperCase() + layer.slice(1)}
          value={volumes[layer.toLowerCase()]}
          onChange={(value) => setVolume(layer.toLowerCase(), value)}
          layer={layer}
        />
      ))}
    </div>
  );
};

// Use memo to prevent unnecessary re-renders
export default memo(LayerControls);