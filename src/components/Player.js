// src/components/Player.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAudio } from '../hooks/useAudio';
import CollapsibleSection from './common/CollapsibleSection';
import LayerControl from './audio/LayerControl';
import SessionTimer from './audio/SessionTimer';
import SessionTimeline from './audio/SessionTimeline';
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
    
  } = useAudio();
  
  // Local state for settings and UI
  const [sessionDuration, setSessionDuration] = useState(60 * 60 * 1000); // Default 1 hour
  const [timelineEnabled, setTimelineEnabled] = useState(true);
  const [transitionDuration, setTransitionDuration] = useState(4000); // Default 4 seconds
  const [showDebugPanel, setShowDebugPanel] = useState(false); // Debug panel state
  
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
  
  // Memoize the session settings state object for the preset system
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
       // Effect to handle settings updates and ensure UI reactivity
useEffect(() => {
  // This effect will run whenever sessionDuration, timelineEnabled, or transitionDuration changes
  console.log('Settings changed, ensuring UI updates:', {
    sessionDuration,
    timelineEnabled,
    transitionDuration
  });
  
  // If we have a timeline component and it's available
  if (timeline) {
    // Ensure timeline duration is synced
    if (timeline.setDuration) {
      timeline.setDuration(sessionDuration);
    }
    
    // Ensure transition duration is synced
    if (timeline.setTransitionDuration) {
      timeline.setTransitionDuration(transitionDuration);
    }
    
    // Force a UI update by triggering a state refresh of the phases
    if (timeline.phases && timeline.updatePhases) {
      console.log('Refreshing timeline phases to trigger UI update');
      timeline.updatePhases([...timeline.phases]);
    }
  }
}, [sessionDuration, timelineEnabled, transitionDuration, timeline]);

    };

   

    
    // Listen for settings updates
    window.addEventListener('sessionSettings-update', handleSessionSettingsUpdate);
    console.log("Listening for sessionSettings-update events...");
    // Cleanup
    return () => {
      window.removeEventListener('sessionSettings-update', handleSessionSettingsUpdate);
    };
  }, []);
  
  // Load available presets when the presets section is expanded
  const handlePresetsExpanded = useCallback(() => {
    const loadedPresets = presets.getAll();
    setAvailablePresets(loadedPresets);
  }, [presets]);
  
  // Memoize the validation result for the new preset name
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
  
  // Memoize import validation state
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
  
  // Render session timeline content
  const renderSessionTimeline = useCallback(() => {
    if (!timelineEnabled) return (
      <div className={styles.timelineDisabled}>
        Timeline is currently disabled. Enable it in Session Settings.
      </div>
    );
    
    return (
      <SessionTimeline 
        enabled={true}
        onDurationChange={setSessionDuration}
      />
    );
  }, [timelineEnabled]);
  
  // Memoize timeline settings handlers
  const handleDurationChange = useCallback((newDuration) => {
    console.log(`Player received new session duration: ${newDuration}ms`);
    
    //update local state
    setSessionDuration(newDuration);
    
    // Make sure this is passed to the timeline service
    if (timeline.setDuration) {
      //ensure this happens synchronously
      timeline.setDuration(newDuration);

      // Trigger a phase update to refresh the timeline display
    if (timeline.updatePhases && timelinePhases.length > 0) {
      console.log('Refreshing timeline phases after duration change');
      const phasesClone = [...timelinePhases];
      timeline.updatePhases(phasesClone);
    }
  }
  
  // Force timeline component to update
  const timelineEvent = new CustomEvent('timeline-duration-changed', { 
    detail: { duration: newDuration } 
  });
  window.dispatchEvent(timelineEvent);
  
}, [timeline, timelinePhases]);
  
  const handleTransitionDurationChange = useCallback((newDuration) => {
    console.log(`Player received new transition duration: ${newDuration}ms`);
    
    //Update local state
    setTransitionDuration(newDuration);
    
    // Make sure this is passed to the timeline service
    if (timeline.setTransitionDuration) {
      timeline.setTransitionDuration(newDuration);
    
    // Trigger a custom event to force updates
    const event = new CustomEvent('timeline-transition-changed', { 
      detail: { duration: newDuration } 
    });
    window.dispatchEvent(event);
  }
}, [timeline]);

const handleTimelineToggle = useCallback((enabled) => {
  console.log(`Timeline toggle: ${enabled}`);
  setTimelineEnabled(enabled);
  
  // Force an update by triggering a custom event
  const event = new CustomEvent('timeline-enabled-changed', { 
    detail: { enabled: enabled } 
  });
  window.dispatchEvent(event);
}, []);
  
  // Render session settings content
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
  
  // Memoize the confirmation dialog content
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
  
  // Memoize the import interface content
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
  
  // Memoize the preset items list
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