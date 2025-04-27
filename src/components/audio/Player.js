// src/components/audio/Player.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudio } from '../../hooks/useAudio';
import { useTimeline } from '../../hooks/useTimeline';
import { useCollection } from '../../hooks/useCollection';
import { useLayer, LAYER_TYPES } from '../../hooks/useLayer'; 
import CollapsibleSection from '../common/CollapsibleSection';
import LayerControl from './LayerControl';
import SessionTimer from './SessionTimer';
import PlayerControlPanel from './PlayerControlPanel';
import styles from '../../styles/pages/Player.module.css';
import eventBus from '../../services/EventBus';

/**
 * Main Player component for Ensō Audio
 * Integrates all audio functionality including playback controls,
 * layer management, timeline settings
 */
const Player = () => {
  console.log("[Player] Using modularized hook integration");
  
  // 1. Core audio functionality
  const { 
    playback              // Play/pause controls
  } = useAudio();
  
  // 2. Timeline functionality
  const {
    setDuration: setTimelineDuration,
    setTransitionDuration: setTimelineTransitionDuration,
    progress: timelineProgress         // If needed for visualization
  } = useTimeline();
  
  // 3. Collection data - minimal reference for UI elements only
  const {
    currentCollection,
    isLoading: loadingCollection,
    error: collectionError
  } = useCollection();
  
  // 4. Layer management - only get what we need at the Player level
  const {
    layerList              // List of all layer names to render controls
  } = useLayer();
  
  // Local state (same as before)
  const [sessionDuration, setSessionDuration] = useState(1 * 60 * 1000);
  const [transitionDuration, setTransitionDuration] = useState(4000);
  const [debugPanelVisible, setDebugPanelVisible] = useState(false);
  const timelineComponentRef = useRef(null);
  
  // Track previous playback state (preserved from original)
  const wasPlaying = useRef(playback.isPlaying);
  const preventUpdateCycle = useRef(false);
  const settingsInitialized = useRef(false);

  // Update wasPlaying ref when playback changes
  useEffect(() => {
    wasPlaying.current = playback.isPlaying;
  }, [playback.isPlaying]);

  // Timeline initialization effect
  useEffect(() => {
    if (!settingsInitialized.current) {
      console.log('Initializing timeline settings');
      
      preventUpdateCycle.current = true;
      
      try {
        // Use the hooks from useTimeline() instead
        setTimelineDuration(sessionDuration);
        setTimelineTransitionDuration(transitionDuration);
        
        settingsInitialized.current = true;
      } finally {
        setTimeout(() => {
          preventUpdateCycle.current = false;
          console.log('Initialization complete, allowing updates');
        }, 100);
      }
    }
  }, [sessionDuration, transitionDuration, setTimelineDuration, setTimelineTransitionDuration]);

  // Listen for external timeline settings updates
  useEffect(() => {
    const handleExternalUpdate = (data) => {
      if (preventUpdateCycle.current) {
        console.log('Ignoring external update during prevention period');
        return;
      }
      
      console.log('Received external timeline settings update:', data);
      preventUpdateCycle.current = true;
      
      try {
        if (data.sessionDuration) {
          setSessionDuration(data.sessionDuration);
        }
        
        if (data.transitionDuration) {
          setTransitionDuration(data.transitionDuration);
        }
      } finally {
        setTimeout(() => {
          preventUpdateCycle.current = false;
        }, 100);
      }
    };
    
    eventBus.on('timeline-settings-update', handleExternalUpdate);
    eventBus.on('sessionSettings-update', handleExternalUpdate);
    
    return () => {
      eventBus.off('timeline-settings-update', handleExternalUpdate);
      eventBus.off('sessionSettings-update', handleExternalUpdate);
    };
  }, []);

  // Handle duration change
  const handleDurationChange = useCallback((newDuration) => {
    if (preventUpdateCycle.current) {
      console.log('Prevented recursive duration update:', newDuration);
      return;
    }
    
    console.log('Player received new duration:', newDuration);
    setSessionDuration(newDuration);
    setTimelineDuration(newDuration);
    settingsInitialized.current = true;
  }, [setTimelineDuration]);

  // Handle transition duration change
  const handleTransitionDurationChange = useCallback((newDuration) => {
    if (preventUpdateCycle.current) {
      console.log('Prevented recursive transition update:', newDuration);
      return;
    }
    
    console.log('Player received new transition duration:', newDuration);
    setTransitionDuration(newDuration);
    setTimelineTransitionDuration(newDuration);
    settingsInitialized.current = true;
  }, [setTimelineTransitionDuration]);

  // Toggle debug panel visibility
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Shift+D to toggle debug panel
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setDebugPanelVisible(prev => !prev);
        console.log('Debug panel toggled');
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Simplified render for layer controls
  const renderLayerControls = useCallback(() => {
    return (
      <div className={styles.layerControlsContent}>
        {layerList.map(layer => (
          <LayerControl
            key={layer}
            layer={layer}
          />
        ))}
      </div>
    );
  }, [layerList]);

  return (
    <div className={styles.simplePlayer}>
      {/* Show loading state if collection is loading */}
      {loadingCollection && (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading collection...</p>
        </div>
      )}
      
      {/* Show error message if collection failed to load */}
      {collectionError && !loadingCollection && (
        <div className={styles.errorMessage}>
          <h3>Failed to load collection</h3>
          <p>{collectionError}</p>
        </div>
      )}
    
      {/* Main player and controls */}
      <PlayerControlPanel 
        onDurationChange={handleDurationChange}
        transitionDuration={transitionDuration}
        onTransitionDurationChange={handleTransitionDurationChange}
        ref={timelineComponentRef}
        coverImageUrl={currentCollection?.coverImage || null}
      />
      
      {/* Collapsible Section for Audio Layers */}
      <CollapsibleSection 
        title="Audio Layers" 
        initialExpanded={false}
      >
        {renderLayerControls()}
      </CollapsibleSection>
      
      {/* Session Timer */}
      <SessionTimer />
      
      {debugPanelVisible && (
        <div className={styles.debugPanel}>
          <h3>Layer State Debug</h3>
          <pre>
            {JSON.stringify({
              playbackActive: playback.isPlaying,
              layers: Object.keys(LAYER_TYPES).length,
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
