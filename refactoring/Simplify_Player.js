import React, { useState, useEffect, useRef } from 'react';
import { useAudio } from '../../hooks/useAudio';
import { useTimeline } from '../../hooks/useTimeline';
import { useLayer } from '../../hooks/useLayer';
import CollapsibleSection from '../common/CollapsibleSection';
import LayerControl from './LayerControl';
import SessionTimer from './SessionTimer';
import PlayerControlPanel from './PlayerControlPanel';
import styles from '../../styles/pages/Player.module.css';

/**
 * Main Player component for Ensō Audio
 * Focused solely on playback controls and UI organization
 */
const Player = ({ collectionId }) => {
  console.log("[Player] Using modularized hook integration");
  
  // Core functionality
  const { playback } = useAudio();
  const { duration, transitionDuration, setDuration, setTransitionDuration } = useTimeline();
  
  // Enhanced layer functionality that handles collection loading
  const { 
    renderLayerControls, 
    currentCollection,
    isCollectionLoading,
    collectionError
  } = useLayer();
  
  // Local UI state only
  const [debugPanelVisible, setDebugPanelVisible] = useState(false);
  
  // Enable debug panel with keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Shift+D to toggle debug panel
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setDebugPanelVisible(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  return (
    <div className={styles.simplePlayer}>
      {/* Show loading state if collection is loading */}
      {isCollectionLoading && (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading collection...</p>
        </div>
      )}
      
      {/* Show error message if collection failed to load */}
      {collectionError && !isCollectionLoading && (
        <div className={styles.errorMessage}>
          <h3>Failed to load collection</h3>
          <p>{collectionError}</p>
        </div>
      )}
    
      {/* Main player and controls */}
      <PlayerControlPanel 
        onDurationChange={setDuration}
        transitionDuration={transitionDuration}
        onTransitionDurationChange={setTransitionDuration}
        coverImageUrl={currentCollection?.coverImage || null}
      />
      
      {/* Collapsible Section for Audio Layers */}
      <CollapsibleSection 
        title="Audio Layers" 
        initialExpanded={false}
      >
        {/* Use the static method from LayerControl */}
        {LayerControl.renderMultiple(renderLayerControls(), styles.layerControlsContent)}
      </CollapsibleSection>
      
      {/* Session Timer */}
      <SessionTimer />
      
      {/* Debug panel */}
      {debugPanelVisible && (
        <div className={styles.debugPanel}>
          <h3>Player State Debug</h3>
          <pre>
            {JSON.stringify({
              playbackActive: playback.isPlaying,
              collection: currentCollection ? {
                id: currentCollection.id,
                name: currentCollection.name
              } : 'None'
            }, null, 2)}
          </pre>
        </div>
      )}
      
      <div className={styles.debugNote}>
        Press Ctrl+Shift+D to toggle debug panel
      </div>
    </div>
  );
};

export default Player;
