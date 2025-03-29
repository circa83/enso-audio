// src/components/Player.js
import React, { useState, useEffect, useCallback, memo } from 'react';
import { useAudio } from '../contexts/StreamingAudioContext';
import CollapsibleSection from './common/CollapsibleSection';
import LayerControls from './audio/ImprovedLayerControls';
import SessionTimer from './audio/SessionTimer';
import SessionTimeline from './audio/SessionTimeline';
import SessionSettings from './audio/SessionSettings';
import PlayerControlPanel from './audio/PlayerControlPanel';
import TimelineDebugPanel from './audio/TimelineDebugPanel';
import PresetManager from './audio/PresetManager';
import JourneyGuide from './audio/JourneyGuide';
import styles from '../styles/pages/Player.module.css';

/**
 * Player - Main component for the audio player interface
 * Handles session configuration and provides access to all audio controls
 */
const Player = () => {
  // Get timeline-related state from the audio context
  const { 
    registerPresetStateProvider,
    updateTimelinePhases
  } = useAudio();
  
  // Local state for session configuration
  const [sessionDuration, setSessionDuration] = useState(60 * 60 * 1000); // Default 1 hour
  const [timelineEnabled, setTimelineEnabled] = useState(true);
  const [transitionDuration, setTransitionDuration] = useState(4000); // Default 4 seconds
  const [showDebugPanel, setShowDebugPanel] = useState(false); // Debug panel state
  
  // Register our session settings with the preset system
  useEffect(() => {
    if (registerPresetStateProvider) {
      const getSessionState = () => {
        return {
          timelineEnabled,
          sessionDuration,
          transitionDuration
        };
      };
      
      // Register the state provider function
      registerPresetStateProvider('sessionSettings', getSessionState);
      
      // Cleanup on component unmount
      return () => registerPresetStateProvider('sessionSettings', null);
    }
  }, [registerPresetStateProvider, timelineEnabled, sessionDuration, transitionDuration]);
  
  // Listen for settings updates from preset loading
  useEffect(() => {
    const handleSessionSettingsUpdate = (event) => {
      if (event.detail) {
        // Update session settings
        if (event.detail.timelineEnabled !== undefined) {
          setTimelineEnabled(event.detail.timelineEnabled);
        }
        
        if (event.detail.sessionDuration) {
          setSessionDuration(event.detail.sessionDuration);
        }
        
        if (event.detail.transitionDuration) {
          setTransitionDuration(event.detail.transitionDuration);
        }
      }
    };
    
    // Listen for settings updates
    window.addEventListener('sessionSettings-update', handleSessionSettingsUpdate);
    
    // Cleanup
    return () => {
      window.removeEventListener('sessionSettings-update', handleSessionSettingsUpdate);
    };
  }, []);
  
  // Toggle debug panel with Ctrl+Shift+D
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowDebugPanel(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Memoized render for session timeline content
  const renderSessionTimeline = useCallback(() => {
    if (!timelineEnabled) return (
      <div className={styles.timelineDisabled}>
        Timeline is currently disabled. Enable it in Session Settings.
      </div>
    );
    
    return (
      <SessionTimeline 
        enabled={true}
        sessionDuration={sessionDuration}
        transitionDuration={transitionDuration}
        onDurationChange={setSessionDuration}
      />
    );
  }, [timelineEnabled, sessionDuration, transitionDuration]);
  
  // Memoized render for session settings content
  const renderSessionSettings = useCallback(() => {
    return (
      <SessionSettings 
        sessionDuration={sessionDuration}
        timelineEnabled={timelineEnabled}
        transitionDuration={transitionDuration}
        onDurationChange={newDuration => setSessionDuration(newDuration)}
        onTransitionDurationChange={newDuration => setTransitionDuration(newDuration)}
        onTimelineToggle={enabled => setTimelineEnabled(enabled)}
      />
    );
  }, [sessionDuration, timelineEnabled, transitionDuration]);
  
  return (
    <div className={styles.simplePlayer}>
      <h1 className={styles.title}>Ensō Audio</h1>
      
      <div className={styles.sessionDescription}>
        Adjust audio layers in real-time to guide the therapeutic journey
      </div>
      
      {/* Main player and controls */}
      <PlayerControlPanel />
      
      {/* Collapsible Section for Session Timeline */}
      <CollapsibleSection 
        title="Session Timeline" 
        initialExpanded={false}
      >
        {renderSessionTimeline()}
      </CollapsibleSection>
      
      {/* Collapsible Section for Audio Layers */}
      <CollapsibleSection 
        title="Audio Layers" 
        initialExpanded={false}
      >
        <LayerControls />
      </CollapsibleSection>
      
      {/* Collapsible Section for Session Settings */}
      <CollapsibleSection 
        title="Session Settings" 
        initialExpanded={false}
      >
        {renderSessionSettings()}
      </CollapsibleSection>
      
      {/* Collapsible Section for Presets */}
      <CollapsibleSection 
        title="Presets" 
        initialExpanded={false}
      >
        <PresetManager />
      </CollapsibleSection>
      
      {/* Journey Guide */}
      <JourneyGuide />
      
      {/* Session Timer */}
      <SessionTimer />
      
      {/* Debug Panel - only visible when toggled */}
      <TimelineDebugPanel enabled={showDebugPanel} />
      
      <div className={styles.debugNote}>
        Press Ctrl+Shift+D to toggle debug panel
      </div>
    </div>
  );
};

// Memoize the entire Player component for performance
export default memo(Player);