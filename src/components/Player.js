// src/components/Player.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAudio } from '../hooks/useAudio';
import CollapsibleSection from './common/CollapsibleSection';
import LayerControl from './audio/LayerControl';
import SessionTimer from './audio/SessionTimer';
import SessionSettings from './audio/SessionSettings';
import PlayerControlPanel from './audio/PlayerControlPanel';
import DebugOverlay from './debug/DebugOverlay';
import styles from '../styles/pages/Player.module.css';

/**
 * Main Player component for Ensō Audio
 * 
 * Integrates all audio functionality including playback controls,
 * layer management, timeline, and presets
 * 
 * @returns {JSX.Element} Rendered component
 */
const Player = () => {
  // Destructure more fields from useAudio for debugging
  const { 
    layers,
    timeline,
    presets,
    timelinePhases,
    playback,
    currentCollection,
    loadingCollection,
    collectionError
  } = useAudio();
  
  // Add direct debug logging of what we receive from useAudio
  console.log("[Player] DIRECT from useAudio:", {
    hasCurrentCollection: !!currentCollection,
    currentCollectionType: typeof currentCollection,
    isLoadingCollection: loadingCollection,
    hasCollectionError: !!collectionError,
    coverImage: currentCollection?.coverImage
  });
  
  if (currentCollection) {
    console.log("[Player] Current collection details:", {
      id: currentCollection.id,
      name: currentCollection.name,
      coverImage: currentCollection.coverImage,
      coverImageType: typeof currentCollection.coverImage
    });
  }
  
  // Local state for settings and UI
  const [sessionDuration, setSessionDuration] = useState(1 * 60 * 1000); // Default 1 minute
  const [transitionDuration, setTransitionDuration] = useState(4000); // Default 4 seconds
  const [debugPanelVisible, setDebugPanelVisible] = useState(false); // Debug panel state
  const timelineComponentRef = useRef(null);
  
  // Track previous playback state
  const wasPlaying = useRef(playback.isPlaying);
  const lastDurationRef = useRef(sessionDuration);
  const lastTransitionRef = useRef(transitionDuration);
  const preventUpdateCycle = useRef(false);
  const settingsInitialized = useRef(false);

  // Debug log for currentCollection
  useEffect(() => {
    console.log("[Player] Current collection changed:", currentCollection ? {
      id: currentCollection.id,
      name: currentCollection.name,
      hasCover: !!currentCollection.coverImage,
      coverImage: currentCollection.coverImage,
      coverImageType: typeof currentCollection.coverImage
    } : "No collection loaded");
  }, [currentCollection]);

  // Toggle debug panel with Ctrl+Shift+D
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setDebugPanelVisible(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // the session settings state object for the preset system
  const sessionSettingsState = useMemo(() => ({
    sessionDuration,
    transitionDuration
  }), [sessionDuration, transitionDuration]);
  
 
  // Update wasPlaying ref when playback changes
  useEffect(() => {
    wasPlaying.current = playback.isPlaying;
  }, [playback.isPlaying]);

  // Single initialization effect - replaces multiple effects
  useEffect(() => {
    // Only run this initialization once
    if (!settingsInitialized.current && timeline) {
      console.log('Initializing timeline settings');
      
      // Set the flag to prevent recursive updates during initialization
      preventUpdateCycle.current = true;
      
      try {
        // Initialize timeline duration
        if (timeline.setDuration) {
          console.log('Setting initial timeline duration:', sessionDuration);
          timeline.setDuration(sessionDuration);
        }
        
        // Initialize transition duration
        if (timeline.setTransitionDuration) {
          console.log('Setting initial transition duration:', transitionDuration);
          timeline.setTransitionDuration(transitionDuration);
        }
        
        // Mark as initialized
        settingsInitialized.current = true;
      } finally {
        // Reset the prevention flag after a small delay
        setTimeout(() => {
          preventUpdateCycle.current = false;
          console.log('Initialization complete, allowing updates');
        }, 100);
      }
    }
  }, [timeline, sessionDuration, transitionDuration]);

  // Event listening effect for external updates
  useEffect(() => {
    // Handler for external timeline settings updates
    const handleExternalUpdate = (event) => {
      // Skip if we're preventing update cycles
      if (preventUpdateCycle.current) {
        console.log('Ignoring external update during prevention period');
        return;
      }
      
      const data = event.detail;
      console.log('Received external timeline settings update:', data);
      
      // Set the flag to prevent recursive updates
      preventUpdateCycle.current = true;
      
      try {
        // Update our local state to match external changes
        if (data.sessionDuration) {
          setSessionDuration(data.sessionDuration);
        }
        
        if (data.transitionDuration) {
          setTransitionDuration(data.transitionDuration);
        }
        
      } finally {
        // Reset the prevention flag after a delay
        setTimeout(() => {
          preventUpdateCycle.current = false;
          console.log('External update handling complete');
        }, 100);
      }
    };
    
    // Add event listeners for external updates
    window.addEventListener('timeline-settings-update', handleExternalUpdate);
    window.addEventListener('sessionSettings-update', handleExternalUpdate);
    
    return () => {
      window.removeEventListener('timeline-settings-update', handleExternalUpdate);
      window.removeEventListener('sessionSettings-update', handleExternalUpdate);
    };
  }, []);


  //======= Timeline settings handlers=====

  const handleDurationChange = useCallback((newDuration) => {
    // Prevent recursive updates
    if (preventUpdateCycle.current) {
      console.log('Prevented recursive duration update:', newDuration);
      return;
    }
    
    console.log('Player received new duration:', newDuration);
    
    // Set local state
    setSessionDuration(newDuration);
    
    // Only update timeline service once, directly
    if (timeline && timeline.setDuration) {
      console.log('Directly updating timeline duration service:', newDuration);
      timeline.setDuration(newDuration);
    }
    
    // Mark settings as initialized
    settingsInitialized.current = true;
  }, [timeline]);

  const handleTransitionDurationChange = useCallback((newDuration) => {
  // Prevent recursive updates
  if (preventUpdateCycle.current) {
    console.log('Prevented recursive transition update:', newDuration);
    return;
  }
  
  console.log('Player received new transition duration:', newDuration);
  
  // Set local state
  setTransitionDuration(newDuration);
  
  // Update timeline service directly
  if (timeline && timeline.setTransitionDuration) {
    console.log('Directly updating timeline transition duration:', newDuration);
    timeline.setTransitionDuration(newDuration);
  }
  
  // Mark settings as initialized
  settingsInitialized.current = true;
  }, [timeline]);



  //======= Render Session settings =======

  const renderSessionSettings = useCallback(() => {
    return (
      <SessionSettings 
        sessionDuration={sessionDuration}
        transitionDuration={transitionDuration}
        onDurationChange={handleDurationChange}
        onTransitionDurationChange={handleTransitionDurationChange}
      />
    );
  }, [
    sessionDuration, 
    transitionDuration, 
    handleDurationChange, 
    handleTransitionDurationChange, 
  ]);
  
  // Render audio layer controls
  const renderLayerControls = useCallback(() => {
    return (
      <div className={styles.layerControlsContent}>
        {Object.values(layers.TYPES).map(layer => (
          <LayerControl
            key={layer}
            label={layer.charAt(0).toUpperCase() + layer.slice(1)}
            layer={layer}
          />
        ))}
      </div>
    );
  }, [layers.TYPES]);

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
      
      
      {/* Add the debug overlay */}
      <DebugOverlay />
      
      {/* Session Timer */}
      <SessionTimer />
      
      <div className={styles.debugNote}>
        Press Ctrl+Shift+D to toggle debug panel
      </div>
    </div>
  );
};

export default Player;