// src/components/audio/PresetManager.js
import React, { useState, useRef, useEffect } from 'react';
import { useAudio } from '../../contexts/StreamingAudioContext';
import styles from '../../styles/components/PresetManager.module.css';

/**
 * PresetManager - Handles saving, loading, and managing audio presets
 */
const PresetManager = () => {
  const { 
    savePreset,
    loadPreset,
    deletePreset,
    getPresets,
    exportPreset,
    importPreset
  } = useAudio();
  
  // State
  const [presets, setPresets] = useState([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [confirmOperation, setConfirmOperation] = useState(null);
  
  // Import/Export
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState(null);
  const fileInputRef = useRef(null);
  
  // Load available presets when the component mounts
  useEffect(() => {
    refreshPresets();
  }, []);
  
  // Load presets from the audio context
  const refreshPresets = () => {
    const availablePresets = getPresets();
    setPresets(availablePresets);
  };
  
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
          refreshPresets();
        }
      });
    } else {
      // New preset, save directly
      savePreset(newPresetName);
      setNewPresetName('');
      refreshPresets();
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
        refreshPresets();
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
        refreshPresets();
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
  );
};

export default PresetManager;