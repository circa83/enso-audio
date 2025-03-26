// src/components/Player.js
import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useAudio } from '../contexts/StreamingAudioContext';
import LayerControl from './audio/LayerControl';
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
    deletePreset,
    getPresets,
    exportPreset,
    importPreset,
    registerPresetStateProvider
  } = useAudio();
  
  const [sessionDuration, setSessionDuration] = useState(60 * 1000); // Default 1 hour
  const [timelineEnabled, setTimelineEnabled] = useState(true);
  const [transitionDuration, setTransitionDuration] = useState(4000); // Default 4 seconds
  const [showDebugPanel, setShowDebugPanel] = useState(false); // Debug panel state
  
  // Preset management
  const [showPresets, setShowPresets] = useState(false);
  const [presets, setPresets] = useState([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [confirmOperation, setConfirmOperation] = useState(null);
  
  // Import/Export
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState(null);
  const fileInputRef = useRef(null);
  
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
  
  // Load available presets
  useEffect(() => {
    if (showPresets) {
      const availablePresets = getPresets();
      setPresets(availablePresets);
    }
  }, [showPresets, getPresets]);
  
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
    
    // Check if preset name already exists
    const existingPreset = presets.find(p => p.name === newPresetName);
    
    if (existingPreset) {
      // Ask for confirmation before overwriting
      setConfirmOperation({
        type: 'overwrite',
        presetName: newPresetName,
        action: () => {
          // Save preset and reset state
          savePreset(newPresetName);
          setNewPresetName('');
          setConfirmOperation(null);
          
          // Refresh presets list
          const updatedPresets = getPresets();
          setPresets(updatedPresets);
        }
      });
    } else {
      // New preset, save directly
      savePreset(newPresetName);
      setNewPresetName('');
      
      // Refresh presets list
      const updatedPresets = getPresets();
      setPresets(updatedPresets);
    }
  };
  
  // Load a preset
  const handleLoadPreset = (presetName) => {
    setSelectedPreset(presetName);
    setConfirmOperation({
      type: 'load',
      presetName,
      action: () => {
        loadPreset(presetName);
        setConfirmOperation(null);
        setSelectedPreset(null);
      }
    });
  };
  
  // Delete a preset
  const handleDeletePreset = (presetName) => {
    setSelectedPreset(presetName);
    setConfirmOperation({
      type: 'delete',
      presetName,
      action: () => {
        deletePreset(presetName);
        setConfirmOperation(null);
        setSelectedPreset(null);
        
        // Refresh presets list
        const updatedPresets = getPresets();
        setPresets(updatedPresets);
      }
    });
  };
  
  // Cancel operation
  const handleCancelOperation = () => {
    setConfirmOperation(null);
    setSelectedPreset(null);
  };
  
  // Export a preset to JSON
  const handleExportPreset = (presetName) => {
    const presetJson = exportPreset(presetName);
    if (!presetJson) return;
    
    // Create a blob object to save
    const blob = new Blob([presetJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link element and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `${presetName.replace(/\s+/g, '_')}_preset.json`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
  };
  
  // Show import UI
  const handleShowImport = () => {
    setIsImporting(true);
    setImportText('');
    setImportError(null);
  };
  
  // Hide import UI
  const handleCancelImport = () => {
    setIsImporting(false);
    setImportText('');
    setImportError(null);
  };
  
  // Import from text
  const handleImportFromText = () => {
    if (!importText.trim()) {
      setImportError('Please enter valid JSON data');
      return;
    }
    
    try {
      const result = importPreset(importText);
      
      if (result.success) {
        setIsImporting(false);
        setImportText('');
        setImportError(null);
        
        // Refresh presets list
        const updatedPresets = getPresets();
        setPresets(updatedPresets);
      } else {
        setImportError(result.error || 'Failed to import preset');
      }
    } catch (error) {
      setImportError(`Error importing preset: ${error.message}`);
    }
  };
  
  // Handle file selection for import
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const fileContent = event.target.result;
        setImportText(fileContent);
        
        // Clear file input
        if (fileInputRef.current) {
          fileInputRef.current.value = null;
        }
      } catch (error) {
        setImportError(`Error reading file: ${error.message}`);
      }
    };
    
    reader.onerror = () => {
      setImportError('Error reading file');
    };
    
    reader.readAsText(file);
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
          <h2 className={styles.sectionTitle}>Session Presets</h2>
          
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
          
          <div className={styles.presetActions}>
            <button 
              className={styles.importButton}
              onClick={handleShowImport}
            >
              Import Preset
            </button>
          </div>
          
          {/* Import interface */}
          {isImporting && (
            <div className={styles.importContainer}>
              <div className={styles.importHeader}>
                <h3>Import Preset</h3>
                <button 
                  className={styles.closeButton}
                  onClick={handleCancelImport}
                >
                  ×
                </button>
              </div>
              
              <div className={styles.importContent}>
                <div className={styles.fileSelectArea}>
                  <button
                    className={styles.fileSelectButton}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Select Preset File
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".json"
                    style={{ display: 'none' }}
                  />
                </div>
                
                <textarea
                  className={styles.importTextarea}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Or paste preset JSON data here..."
                />
                
                {importError && (
                  <div className={styles.importError}>{importError}</div>
                )}
                
                <div className={styles.importActions}>
                  <button 
                    className={styles.cancelButton}
                    onClick={handleCancelImport}
                  >
                    Cancel
                  </button>
                  <button 
                    className={styles.importButton}
                    onClick={handleImportFromText}
                  >
                    Import
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Confirmation dialog */}
          {confirmOperation && (
            <div className={styles.confirmDialog}>
              <div className={styles.confirmContent}>
                <h3>Confirm {confirmOperation.type === 'delete' ? 'Delete' : confirmOperation.type === 'overwrite' ? 'Overwrite' : 'Load'}</h3>
                <p>
                  {confirmOperation.type === 'delete' && `Are you sure you want to delete the preset "${confirmOperation.presetName}"?`}
                  {confirmOperation.type === 'overwrite' && `A preset named "${confirmOperation.presetName}" already exists. Do you want to overwrite it?`}
                  {confirmOperation.type === 'load' && `Load preset "${confirmOperation.presetName}"? This will replace your current settings.`}
                </p>
                <div className={styles.confirmActions}>
                  <button
                    className={styles.cancelButton}
                    onClick={handleCancelOperation}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.confirmButton}
                    onClick={confirmOperation.action}
                  >
                    {confirmOperation.type === 'delete' ? 'Delete' : confirmOperation.type === 'overwrite' ? 'Overwrite' : 'Load'}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <div className={styles.presetsList}>
            {presets.length === 0 ? (
              <div className={styles.noPresets}>No saved presets</div>
            ) : (
              presets.map(preset => (
                <div 
                  key={preset.name} 
                  className={`${styles.presetItem} ${selectedPreset === preset.name ? styles.selected : ''}`}
                >
                  <span className={styles.presetName}>{preset.name}</span>
                  <span className={styles.presetDate}>
                    {new Date(preset.date).toLocaleDateString()}
                  </span>
                  <div className={styles.presetButtons}>
                    <button 
                      className={styles.presetActionButton}
                      onClick={() => handleLoadPreset(preset.name)}
                    >
                      Load
                    </button>
                    <button 
                      className={styles.presetActionButton}
                      onClick={() => handleExportPreset(preset.name)}
                    >
                      Export
                    </button>
                    <button 
                      className={`${styles.presetActionButton} ${styles.deleteButton}`}
                      onClick={() => handleDeletePreset(preset.name)}
                    >
                      Delete
                    </button>
                  </div>
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
            layer={layer}  
          />
        ))}
      </div>
      
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