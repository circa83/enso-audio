// src/components/Player.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudio } from '../../hooks/useAudio';           // Core audio functionality
import { useTimeline } from '../../hooks/useTimeline';     // Timeline management
import { useCollection } from '../../hooks/useCollection'; // Collection data
import { useVolume } from '../../hooks/useVolume';         // Volume control (if needed)
import CollapsibleSection from '../common/CollapsibleSection';
import LayerControl from './LayerControl';
import SessionTimer from './SessionTimer';
import SessionSettings from './SessionSettings';
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
    playback,              // Play/pause controls
  } = useAudio();
  
  // 2. Timeline functionality
  const {
    setDuration: setTimelineDuration,
    setTransitionDuration: setTimelineTransitionDuration,
    progress: timelineProgress         // If needed for visualization
  } = useTimeline();
  
  // 3. Collection data
  const {
    currentCollection,
    isLoading: loadingCollection,
    error: collectionError
  } = useCollection();
  
  // 4. Volume control (if needed for layer functionality)
  const {
    volumes: layerVolumes,   // Current volumes per layer  
    setVolume               // Set volume for a layer
  } = useVolume();
  
  // Local state (same as before)
  const [sessionDuration, setSessionDuration] = useState(1 * 60 * 1000);
  const [transitionDuration, setTransitionDuration] = useState(4000);
  const timelineComponentRef = useRef(null);
  
  // Import/Export state (preserved from original)
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState(null);
  const fileInputRef = useRef(null);
  
  // Track previous playback state (preserved from original)
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
    } : "No collection loaded");
  }, [currentCollection]);

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

  // Listen for external timeline settings updates (using EventBus instead of direct listeners)
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
    
    // Use EventBus instead of direct window events
    eventBus.on('timeline-settings-update', handleExternalUpdate);
    eventBus.on('sessionSettings-update', handleExternalUpdate);
    
    return () => {
      eventBus.off('timeline-settings-update', handleExternalUpdate);
      eventBus.off('sessionSettings-update', handleExternalUpdate);
    };
  }, []);

  // Handle duration change - now uses the timeline hook
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

  // Handle transition duration change - now uses the timeline hook
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

  // Render Session settings
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
        {Object.values({}).map(layer => (
          <LayerControl
            key={layer}
            label={layer.charAt(0).toUpperCase() + layer.slice(1)}
            layer={layer}
            // Pass volume functionality if LayerControl needs it
            volume={layerVolumes?.[layer]}
            onVolumeChange={(value) => setVolume(layer, value)}
          />
        ))}
      </div>
    );
  }, [layerVolumes, setVolume]);

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
      
      {/* Session Timer - would likely need timeline progress */}
      <SessionTimer />
    </div>
  );
};

export default Player;
