// src/components/audio/LayerControls.js
import React, { memo, useEffect, useState } from 'react';
import LayerControl from './LayerControl';
import { useAudio } from '../../hooks/useAudio';
import styles from '../../styles/components/LayerControls.module.css';

/**
 * LayerControls - Container for all audio layer controls
 * Manages the set of layer volume sliders and dropdown selectors
 */
const LayerControls = () => {
  // Use the main hook instead of the specialized hook for now
  const { LAYERS, volumes, setVolume } = useAudio();
  const [layerIds, setLayerIds] = useState([]);
  
  // Safely initialize layer IDs once LAYERS is available
  useEffect(() => {
    if (LAYERS && typeof LAYERS === 'object') {
      setLayerIds(Object.values(LAYERS));
    }
  }, [LAYERS]);

  // Guard against missing LAYERS object
  if (!LAYERS || typeof LAYERS !== 'object') {
    console.error('LAYERS object is undefined or not an object in LayerControls');
    return <div className={styles.layerControlsContainer}>Loading layer controls...</div>;
  }
  
  return (
    <div className={styles.layerControlsContainer}>
      {layerIds.map(layer => {
        const layerId = layer.toLowerCase();
        return (
          <LayerControl
            key={layerId}
            label={layer.charAt(0).toUpperCase() + layer.slice(1)}
            value={volumes[layerId] || 0}
            onChange={(value) => setVolume(layerId, value)}
            layer={layerId}
          />
        );
      })}
    </div>
  );
};

// Use memo to prevent unnecessary re-renders
export default memo(LayerControls);