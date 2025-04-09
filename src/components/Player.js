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
  // Use our new hook with structured API approach
  const { 
    layers,
    timeline,
    presets,
    timelinePhases,
    playback,
  } = useAudio();
  
  // Local state for settings and UI
  const [sessionDuration, setSessionDuration] = useState(1 * 60 * 1000); // Default 1 minute
  const [timelineEnabled, setTimelineEnabled] = useState(true);
  const [transitionDuration, setTransitionDuration] = useState(4000); // Default 4 seconds
  const [debugPanelVisible, setDebugPanelVisible] = useState(false); // Debug panel state
  const timelineComponentRef = useRef(null);
  
  // Preset management state
  const [availablePresets, setAvailablePresets] = useState([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [confirmOperation, setConfirmOperation] = useState(null);
  
  // Import/Export state
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState(null);
  const fileInputRef = useRef(null);
  
  // Track previous playback state
  const wasPlaying = useRef(playback.isPlaying);
  const lastDurationRef = useRef(sessionDuration);
  const lastTransitionRef = useRef(transitionDuration);
  const preventUpdateCycle = useRef(false);
  const settingsInitialized = useRef(false);

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
    timelineEnabled,
    sessionDuration,
    transitionDuration
  }), [timelineEnabled, sessionDuration, transitionDuration]);
  
  // Register our session settings with the preset system
  useEffect(() => {
    // Register the state provider function
    presets.registerStateProvider('sessionSettings', () => sessionSettingsState);
    
    // Cleanup on component unmount
    return () => presets.registerStateProvider('sessionSettings', null);
  }, [presets, sessionSettingsState]);
  
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
    console.log("Listening for sessionSettings-update events...");
    
    // Cleanup
    return () => {
      window.removeEventListener('sessionSettings-update', handleSessionSettingsUpdate);
    };
  }, []);

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
      
      // Initialize timeline enabled state
      if (timeline.setTimelineEnabled) {
        console.log('Setting initial timeline enabled state:', timelineEnabled);
        timeline.setTimelineEnabled(timelineEnabled);
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
}, [timeline, sessionDuration, transitionDuration, timelineEnabled]);

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
      
      if (data.timelineEnabled !== undefined) {
        setTimelineEnabled(data.timelineEnabled);
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

const handleTimelineToggle = useCallback((enabled) => {
  console.log('Timeline toggle:', enabled);
  
  // Prevent recursive updates
  if (preventUpdateCycle.current) {
    console.log('Prevented recursive timeline toggle');
    return;
  }
  
  setTimelineEnabled(enabled);
  
  // Update the timeline enabled state in the service directly
  if (timeline && timeline.setTimelineEnabled) {
    timeline.setTimelineEnabled(enabled);
  }
  
  // Mark settings as initialized
  settingsInitialized.current = true;
}, [timeline]);

  //======= Render Session settings =======

  const renderSessionSettings = useCallback(() => {
    return (
      <SessionSettings 
        sessionDuration={sessionDuration}
        timelineEnabled={timelineEnabled}
        transitionDuration={transitionDuration}
        onDurationChange={handleDurationChange}
        onTransitionDurationChange={handleTransitionDurationChange}
        onTimelineToggle={handleTimelineToggle}
      />
    );
  }, [
    sessionDuration, 
    timelineEnabled, 
    transitionDuration, 
    handleDurationChange, 
    handleTransitionDurationChange, 
    handleTimelineToggle
  ]);
  
  //PRESET MANAGEMENT

  // Load available presets when the presets section is expanded
  const handlePresetsExpanded = useCallback(() => {
    const loadedPresets = presets.getAll();
    setAvailablePresets(loadedPresets);
  }, [presets]);

  // the validation result for the new preset name
  const isNewPresetNameValid = useMemo(() => 
    newPresetName.trim() !== '', 
    [newPresetName]
  );

  // Save current state as a preset
  const handleSavePreset = useCallback(() => {
    if (!isNewPresetNameValid) return;
    
    // Check if preset name already exists
    const existingPreset = availablePresets.find(p => p.name === newPresetName);
    
    if (existingPreset) {
      // Ask for confirmation before overwriting
      setConfirmOperation({
        type: 'overwrite',
        presetName: newPresetName,
        action: () => {
          // Save preset and reset state
          presets.save(newPresetName);
          setNewPresetName('');
          setConfirmOperation(null);
          
          // Refresh presets list
          const updatedPresets = presets.getAll();
          setAvailablePresets(updatedPresets);
        }
      });
    } else {
      // New preset, save directly
      presets.save(newPresetName);
      setNewPresetName('');
      
      // Refresh presets list
      const updatedPresets = presets.getAll();
      setAvailablePresets(updatedPresets);
    }
  }, [newPresetName, availablePresets, presets, isNewPresetNameValid]);

  // Load a preset
  const handleLoadPreset = useCallback((presetName) => {
    setSelectedPreset(presetName);
    setConfirmOperation({
      type: 'load',
      presetName,
      action: () => {
        presets.load(presetName);
        setConfirmOperation(null);
        setSelectedPreset(null);
      }
    });
  }, [presets]);

  // Delete a preset
  const handleDeletePreset = useCallback((presetName) => {
    setSelectedPreset(presetName);
    setConfirmOperation({
      type: 'delete',
      presetName,
      action: () => {
        presets.delete(presetName);
        setConfirmOperation(null);
        setSelectedPreset(null);
        
        // Refresh presets list
        const updatedPresets = presets.getAll();
        setAvailablePresets(updatedPresets);
      }
    });
  }, [presets]);

  // Cancel operation
  const handleCancelOperation = useCallback(() => {
    setConfirmOperation(null);
    setSelectedPreset(null);
  }, []);

  // Export a preset to JSON
  const handleExportPreset = useCallback((presetName) => {
    const presetJson = presets.export(presetName);
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
  }, [presets]);

  // Show import UI
  const handleShowImport = useCallback(() => {
    setIsImporting(true);
    setImportText('');
    setImportError(null);
  }, []);

  // Hide import UI
  const handleCancelImport = useCallback(() => {
    setIsImporting(false);
    setImportText('');
    setImportError(null);
  }, []);

  // import validation state
  const isImportTextValid = useMemo(() => 
    importText.trim() !== '', 
    [importText]
  );

  // Import from text
  const handleImportFromText = useCallback(() => {
    if (!isImportTextValid) {
      setImportError('Please enter valid JSON data');
      return;
    }
    
    try {
      const result = presets.import(importText);
      
      if (result.success) {
        setIsImporting(false);
        setImportText('');
        setImportError(null);
        
        // Refresh presets list
        const updatedPresets = presets.getAll();
        setAvailablePresets(updatedPresets);
      } else {
        setImportError(result.error || 'Failed to import preset');
      }
    } catch (error) {
      setImportError(`Error importing preset: ${error.message}`);
    }
  }, [importText, presets, isImportTextValid]);

  // Handle file selection for import
  const handleFileSelect = useCallback((e) => {
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
  }, []);

  // the confirmation dialog content
  const confirmDialogContent = useMemo(() => {
    if (!confirmOperation) return null;
    
    return (
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
    );
  }, [confirmOperation, handleCancelOperation]);
  
  // the import interface content
  const importInterfaceContent = useMemo(() => {
    if (!isImporting) return null;
    
    return (
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
    );
  }, [
    isImporting, 
    importText, 
    importError, 
    handleCancelImport, 
    handleFileSelect, 
    handleImportFromText
  ]);
  
  // the preset items list
  const presetItemsList = useMemo(() => {
    if (availablePresets.length === 0) {
      return <div className={styles.noPresets}>No saved presets</div>;
    }
    
    return availablePresets.map(preset => (
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
    ));
  }, [
    availablePresets, 
    selectedPreset, 
    handleLoadPreset, 
    handleExportPreset, 
    handleDeletePreset
  ]);
  
  // Render presets content
  const renderPresetsContent = useCallback(() => {
    return (
      <div className={styles.presetsContent}>
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
            disabled={!isNewPresetNameValid}
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
        {importInterfaceContent}
        
        {/* Confirmation dialog */}
        {confirmDialogContent}
        
        <div className={styles.presetsList}>
          {presetItemsList}
        </div>
      </div>
    );
  }, [
    newPresetName,
    handleSavePreset,
    handleShowImport,
    importInterfaceContent,
    confirmDialogContent,
    presetItemsList,
    isNewPresetNameValid
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
      <h1 className={styles.title}>Ensō Audio</h1>
      
      <div className={styles.sessionDescription}>
        Adjust audio layers in real-time to guide the therapeutic journey
      </div>
      
      {/* Main player and controls */}
      <PlayerControlPanel 
        timelineEnabled={timelineEnabled}
        onDurationChange={handleDurationChange}
        ref={timelineComponentRef}
      />
      
      {/* Collapsible Section for Audio Layers */}
      <CollapsibleSection 
        title="Audio Layers" 
        initialExpanded={false}
      >
        {renderLayerControls()}
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
        onExpand={handlePresetsExpanded}
      >
        {renderPresetsContent()}
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