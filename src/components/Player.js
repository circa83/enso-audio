// src/components/Player.js
import React, { useCallback, useState, useEffect } from 'react';
import { useAudio } from '../contexts/StreamingAudioContext';
import LayerControl from './audio/LayerControl';
import LayerSelector from './audio/LayerSelector';
import SessionTimer from './audio/SessionTimer';
import SessionTimeline from './audio/SessionTimeline';
import SessionSettings from './audio/SessionSettings';
import TapePlayerGraphic from './audio/TapePlayerGraphic';
import styles from '../styles/pages/Player.module.css';

const Player = () => {
  const { 
    LAYERS, 
    isPlaying, 
    volumes, 
    startSession, 
    pauseSession,
    hasSwitchableAudio,
    setVolume,
    getSessionTime
  } = useAudio();
  
  const [showLayerSelectors, setShowLayerSelectors] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(60 * 1000); // Default 1 minute (for testing)
  const [timelineEnabled, setTimelineEnabled] = useState(true);
  const [transitionDuration, setTransitionDuration] = useState(10000); // Default 10 seconds
  
  // Log state changes when toggling timeline
  useEffect(() => {
    console.log(`Timeline ${timelineEnabled ? 'enabled' : 'disabled'}`);
  }, [timelineEnabled]);
  
  // Log transition duration changes
  useEffect(() => {
    console.log(`Transition duration set to: ${transitionDuration / 1000}s`);
  }, [transitionDuration]);
  
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pauseSession();
    } else {
      startSession();
    }
  }, [isPlaying, pauseSession, startSession]);
  
  return (
    <div className={styles.simplePlayer}>
      <h1 className={styles.title}>Ensō Audio</h1>
      
      <div className={styles.sessionDescription}>
        Adjust audio layers in real-time to guide the therapeutic journey
      </div>
      
      <TapePlayerGraphic />
      
      <div className={styles.playerControls}>
        <button 
          className={`${styles.playButton} ${isPlaying ? styles.playing : ''}`}
          onClick={togglePlayPause}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </button>
        
        {/* Sound library button - always show this */}
        <button 
          className={`${styles.soundLibraryButton} ${showLayerSelectors ? styles.active : ''}`}
          onClick={() => setShowLayerSelectors(!showLayerSelectors)}
        >
          {showLayerSelectors ? 'Hide Sounds' : 'Change Sounds'}
        </button>
      </div>
      
      {/* Session settings component */}
      <SessionSettings 
        sessionDuration={sessionDuration}
        timelineEnabled={timelineEnabled}
        transitionDuration={transitionDuration}
        onDurationChange={newDuration => setSessionDuration(newDuration)}
        onTransitionDurationChange={newDuration => setTransitionDuration(newDuration)}
        onTimelineToggle={enabled => setTimelineEnabled(enabled)}
      />
      
      {/* Timeline Component - only if enabled */}
      <SessionTimeline 
        enabled={timelineEnabled}
        sessionDuration={sessionDuration}
        transitionDuration={transitionDuration}
        onDurationChange={setSessionDuration}
      />
      
      <div className={styles.layerControls}>
        <h2 className={styles.sectionTitle}>Audio Layers</h2>
        
        {Object.values(LAYERS).map(layer => (
          <LayerControl
            key={layer}
            label={layer.charAt(0).toUpperCase() + layer.slice(1)}
            value={volumes[layer]}
            onChange={(value) => setVolume(layer, value)}
          />
        ))}
      </div>
      
      {/* Layer selectors section */}
      {showLayerSelectors && (
        <div className={styles.layerSelectors}>
          <h2 className={styles.sectionTitle}>Sound Selection</h2>
          {Object.values(LAYERS).map(layer => (
            <LayerSelector key={layer} layer={layer} />
          ))}
        </div>
      )}
      
      <div className={styles.geometricLine}></div>
      
      <SessionTimer />
      
      {!timelineEnabled && (
        <div className={styles.journeyGuide}>
          <h3>Session Flow Guide</h3>
          <div className={styles.journeyPhases}>
            <div className={styles.journeyPhase}>
              <h4>Pre-Onset</h4>
              <p>Higher drone, lower rhythm</p>
            </div>
            <div className={styles.journeyPhase}>
              <h4>Onset & Buildup</h4>
              <p>Increase melody and rhythm gradually</p>
            </div>
            <div className={styles.journeyPhase}>
              <h4>Peak</h4>
              <p>Balanced mix of all elements</p>
            </div>
            <div className={styles.journeyPhase}>
              <h4>Return & Integration</h4>
              <p>Reduce rhythm, increase nature</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Player;