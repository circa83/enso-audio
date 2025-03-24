// src/components/Player.js - Update the default session duration
import React, { useCallback, useState, useEffect } from 'react';
import { useAudio } from '../contexts/StreamingAudioContext';
import LayerControl from './audio/LayerControl';
import LayerSelector from './audio/LayerSelector';
import SessionTimer from './audio/SessionTimer';
import SessionTimeline from './audio/SessionTimeline';
import SessionSettings from './audio/SessionSettings';
import TapePlayerGraphic from './audio/TapePlayerGraphic';
import TimelineDebugPanel from './audio/TimelineDebugPanel';
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
    getSessionTime,
    savePreset,
    loadPreset,
    getPresets
  } = useAudio();
  
  const [showLayerSelectors, setShowLayerSelectors] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(60 * 1000); // Default 1 minute (changed from 60 minutes)
  const [timelineEnabled, setTimelineEnabled] = useState(true);
  const [transitionDuration, setTransitionDuration] = useState(4000); // Default 4 seconds
  const [showDebugPanel, setShowDebugPanel] = useState(false); // Debug panel state
  
  // Preset management
  const [showPresets, setShowPresets] = useState(false);
  const [presets, setPresets] = useState([]);
  const [newPresetName, setNewPresetName] = useState('');
  
  // Load available presets
  useEffect(() => {
    if (showPresets) {
      const availablePresets = getPresets();
      setPresets(availablePresets);
    }
  }, [showPresets, getPresets]);
  
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
  
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pauseSession();
    } else {
      startSession();
    }
  }, [isPlaying, pauseSession, startSession]);
  
  // Save current state as a preset
  const handleSavePreset = () => {
    if (newPresetName.trim() === '') return;
    
    savePreset(newPresetName);
    setNewPresetName('');
    
    // Refresh presets list
    const availablePresets = getPresets();
    setPresets(availablePresets);
  };
  
  // Load a preset
  const handleLoadPreset = (presetName) => {
    if (window.confirm(`Load preset "${presetName}"? This will update your current settings.`)) {
      loadPreset(presetName);
    }
  };
  
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
        
        {/* Sound library button */}
        <button 
          className={`${styles.soundLibraryButton} ${showLayerSelectors ? styles.active : ''}`}
          onClick={() => setShowLayerSelectors(!showLayerSelectors)}
        >
          {showLayerSelectors ? 'Hide Sounds' : 'Change Sounds'}
        </button>
        
        {/* Preset management button */}
        <button 
          className={`${styles.presetButton} ${showPresets ? styles.active : ''}`}
          onClick={() => setShowPresets(!showPresets)}
        >
          {showPresets ? 'Hide Presets' : 'Presets'}
        </button>
      </div>
      
      {/* Preset management panel */}
      {showPresets && (
        <div className={styles.presetsPanel}>
          <h2 className={styles.sectionTitle}>Timeline Presets</h2>
          
          <div className={styles.presetControls}>
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="New preset name..."
              className={styles.presetInput}
            />
            <button 
              className={styles.savePresetButton}
              onClick={handleSavePreset}
              disabled={newPresetName.trim() === ''}
            >
              Save Current State
            </button>
          </div>
          
          <div className={styles.presetsList}>
            {presets.length === 0 ? (
              <div className={styles.noPresets}>No saved presets</div>
            ) : (
              presets.map(preset => (
                <div key={preset.name} className={styles.presetItem}>
                  <span className={styles.presetName}>{preset.name}</span>
                  <span className={styles.presetDate}>
                    {new Date(preset.date).toLocaleDateString()}
                  </span>
                  <button 
                    className={styles.loadPresetButton}
                    onClick={() => handleLoadPreset(preset.name)}
                  >
                    Load
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
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
      
      {/* Debug Panel - only visible when toggled */}
      <TimelineDebugPanel enabled={showDebugPanel} />
      
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
      
      <div className={styles.debugNote}>
        Press Ctrl+Shift+D to toggle debug panel
      </div>
    </div>
  );
};

export default Player;