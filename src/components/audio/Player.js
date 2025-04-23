// src/components/Player.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudio } from '../../hooks/useAudio';
import { useTimeline } from '../../hooks/useTimeline';
import { useCollection } from '../../hooks/useCollection';
import { useVolume } from '../../hooks/useVolume';
import { useLayer, LAYER_TYPES } from '../../hooks/useLayer'; // Import our new hook
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
    error: collectionError,
    formatForPlayer
  } = useCollection();
  
  // 4. Volume control
  const {
    volumes: layerVolumes,   // Current volumes per layer  
    setVolume               // Set volume for a layer
  } = useVolume();
  
  // 5. Layer management (new)
  const {
    layerList,              // List of all layer names
    availableTracks,        // Available tracks per layer
    activeTracks,           // Currently active track per layer
    getTracksForLayer,      // Get tracks for a specific layer
    changeTrack,            // Change active track with crossfade
    isLayerMuted,           // Check if layer is muted
    toggleMute,             // Toggle mute state for a layer
    registerCollection      // Register a collection with layers
  } = useLayer();
  
  // Local state (same as before)
  const [sessionDuration, setSessionDuration] = useState(1 * 60 * 1000);
  const [transitionDuration, setTransitionDuration] = useState(4000);
  const [debugPanelVisible, setDebugPanelVisible] = useState(false);
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

  // Debug keyboard shortcut (Ctrl+Shift+D)
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

  // Register collection with layer manager when it changes
  useEffect(() => {
    console.log("[Player] Current collection changed:", currentCollection ? {
      id: currentCollection.id,
      name: currentCollection.name,
      hasCover: !!currentCollection.coverImage,
    } : "No collection loaded");
    
    if (currentCollection) {
      // Format collection for player if needed
      const formattedCollection = currentCollection.layers 
        ? currentCollection  // Already formatted
        : formatForPlayer(currentCollection);
      
      if (formattedCollection) {
        console.log("[Player] Registering collection with layer manager");
        registerCollection(formattedCollection);
      }
    }
  }, [currentCollection, formatForPlayer, registerCollection]);

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

  // Handle track change from layer control
  const handleTrackChange = useCallback((layer, trackId) => {
    console.log(`[Player] Changing track for ${layer} to ${trackId}`);
    
    // Use our layer management to handle the crossfade
    changeTrack(layer, trackId, {
      duration: transitionDuration,
      onComplete: (success) => {
        if (success) {
          console.log(`[Player] Successfully changed ${layer} track to ${trackId}`);
        } else {
          console.error(`[Player] Failed to change ${layer} track to ${trackId}`);
        }
      }
    });
  }, [changeTrack, transitionDuration]);

  // Handle mute toggle from layer control
  const handleMuteToggle = useCallback((layer) => {
    console.log(`[Player] Toggling mute for ${layer}`);
    toggleMute(layer);
  }, [toggleMute]);

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

  // Render audio layer controls - updated to use our layer management
  const renderLayerControls = useCallback(() => {
    return (
      <div className={styles.layerControlsContent}>
        {layerList.map(layer => {
          const tracks = getTracksForLayer(layer);
          const activeTrackId = activeTracks[layer];
          
          return (
            <LayerControl
              key={layer}
              label={layer.charAt(0).toUpperCase() + layer.slice(1)}
              layer={layer}
              tracks={tracks}
              activeTrackId={activeTrackId}
              volume={layerVolumes?.[layer] || 0}
              isMuted={isLayerMuted(layer)}
              onVolumeChange={(value) => setVolume(layer, value)}
              onTrackChange={(trackId) => handleTrackChange(layer, trackId)}
              onMuteToggle={() => handleMuteToggle(layer)}
            />
          );
        })}
      </div>
    );
  }, [
    layerList,
    getTracksForLayer,
    activeTracks,
    layerVolumes,
    isLayerMuted,
    setVolume,
    handleTrackChange,
    handleMuteToggle
  ]);

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
      
      {debugPanelVisible && (
        <div className={styles.debugPanel}>
          <h3>Layer State Debug</h3>
          <pre>
            {JSON.stringify({
              playbackActive: playback.isPlaying,
              layers: Object.keys(LAYER_TYPES).length,
              activeTracks,
              volumes: layerVolumes,
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
