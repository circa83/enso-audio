import React, { useState, useEffect, useCallback } from 'react';
import { useAudio } from '../../hooks/useAudio';
import styles from '../../styles/components/PresetManager.module.css';

const PresetManager = () => {
  const {
    volumes,
    activeAudio,
    timelinePhases,
    sessionDuration,
    transitionDuration,
    currentCollection,
    setVolume,
    crossfadeTo,
    updateTimelinePhases,
    setSessionDuration,
    setTransitionDuration
  } = useAudio();

  const [presets, setPresets] = useState([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Load presets from localStorage on mount
  useEffect(() => {
    loadPresetsFromStorage();
  }, []);

  // Update presets list when collection changes
  useEffect(() => {
    if (currentCollection) {
      loadPresetsFromStorage();
    }
  }, [currentCollection?.id]);

  // Function to load presets from localStorage
  const loadPresetsFromStorage = () => {
    if (!currentCollection) return;

    try {
      const storageKey = `enso_presets_${currentCollection.id}`;
      const savedPresets = JSON.parse(localStorage.getItem(storageKey) || '[]');
      setPresets(savedPresets);
    } catch (error) {
      console.error('Error loading presets:', error);
      setPresets([]);
    }
  };

  // Function to save current state as a preset
  const saveCurrentAsPreset = (presetName) => {
    if (!currentCollection) return;

    // Capture current state
    const newPreset = {
      id: Date.now().toString(),
      name: presetName,
      createdAt: new Date().toISOString(),
      collectionId: currentCollection.id,
      state: {
        volumes: { ...volumes },
        activeAudio: { ...activeAudio },
        timelinePhases: timelinePhases.map(phase => ({ ...phase })),
        sessionDuration,
        transitionDuration
      }
    };

    // Add to presets list
    const updatedPresets = [...presets, newPreset];
    setPresets(updatedPresets);

    // Save to localStorage
    const storageKey = `enso_presets_${currentCollection.id}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedPresets));
  };

  // Function to load a preset
  const loadPreset = (preset) => {
    if (!preset || !preset.state) return;

    // Apply session duration
    if (preset.state.sessionDuration && setSessionDuration) {
      setSessionDuration(preset.state.sessionDuration);
    }

    // Apply transition duration
    if (preset.state.transitionDuration && setTransitionDuration) {
      setTransitionDuration(preset.state.transitionDuration);
    }

    // Apply timeline phases
    if (preset.state.timelinePhases && updateTimelinePhases) {
      updateTimelinePhases(preset.state.timelinePhases);
    }

    // Apply volumes
    if (preset.state.volumes) {
      Object.entries(preset.state.volumes).forEach(([layer, volume]) => {
        setVolume(layer, volume);
      });
    }

    // Apply active audio tracks with crossfade
    if (preset.state.activeAudio) {
      Object.entries(preset.state.activeAudio).forEach(([layer, trackId]) => {
        if (activeAudio[layer] !== trackId) {
          crossfadeTo(layer, trackId, transitionDuration);
        }
      });
    }
  };

  // Function to delete a preset
  const deletePreset = (presetId) => {
    const updatedPresets = presets.filter(preset => preset.id !== presetId);
    setPresets(updatedPresets);

    // Save updated list to localStorage
    const storageKey = `enso_presets_${currentCollection.id}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedPresets));
  };

  const handleCreatePreset = () => {
    if (!newPresetName.trim()) return;

    saveCurrentAsPreset(newPresetName.trim());
    setNewPresetName('');
    setIsCreating(false);
  };

 // Update the exportPresetAsConfig function with proper phase state handling
// Update the exportPresetAsConfig function with proper phase state handling
const exportPresetAsConfig = (preset) => {
  if (!preset || !currentCollection) return;
  
  // Helper function to clean volumes - keep only uppercase Layer entries
  const cleanVolumes = (volumesObj) => {
    return Object.entries(volumesObj)
      .filter(([key]) => key.startsWith('Layer ')) // Only keep uppercase Layer entries
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {});
  };
  
  // Clean up the preset data to match the expected structure
  const configData = {
    name: formatCollectionId(currentCollection.name), // Use new helper for consistent capitalization
    description: `Audio configuration for ${currentCollection.name} collection`,
    sessionDuration: sessionDuration,
    transitionDuration: transitionDuration,
    
    // Clean up top-level volumes using our helper
    volumes: cleanVolumes(volumes),
    
    // Keep the activeAudio mapping
    activeAudio: { ...activeAudio },
    
    // Properly format the phaseMarkers to match Stillness_config.js
    phaseMarkers: timelinePhases.map(phase => ({
      id: phase.id,
      name: phase.name,
      position: phase.position,
      color: phase.color,
      state: phase.state ? {
        // IMPORTANT: Clean the volumes in each phase's state too
        volumes: cleanVolumes(phase.state.volumes),
        activeAudio: { ...phase.state.activeAudio }
      } : {
        // For null states, create a clean default
        volumes: cleanVolumes(volumes),
        activeAudio: { ...activeAudio }
      },
      locked: phase.locked || false
    }))
  };
  
  // Format as a JS module with proper name
  const cleanName = formatCollectionId(currentCollection.name); // Use proper capitalization
  
  const configFileContent = 
`/**
 * ${cleanName} Configuration
 * 
 * Audio configuration for ${currentCollection.name} collection
 * Created: ${new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'numeric', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })}
 */

const ${formatConfigName(cleanName)} = ${JSON.stringify(configData, null, 2)};

export default ${formatConfigName(cleanName)};`;

  // Download as a file - use the updated formatFileName
  downloadAsFile(`${formatFileName(cleanName)}_config.js`, configFileContent);
};


// Make formatFileName simpler to ensure it creates a clean filename
const formatFileName = (name) => {
  // First, clean the name to remove invalid characters
  const cleanName = name
    .replace(/[^a-zA-Z0-9_\s]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  
  // Split by spaces or underscores
  const parts = cleanName.split(/[\s_]+/);
  
  // Capitalize first letter of each word
  const capitalizedParts = parts.map(part => 
    part.charAt(0).toUpperCase() + part.slice(1)
  );
  
  // Join with underscores and return
  return capitalizedParts.join('_');
};

// Update formatConfigName to capitalize the first letter of the variable name
const formatConfigName = (name) => {
  // Convert to camelCase
  const parts = name.split(/[^a-zA-Z0-9]+/);
  
  // CHANGE: Always capitalize the first character of the first part
  const camelCase = parts.map((part, index) => {
    // Always capitalize first letter for first part
    if (index === 0) return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    // Keep existing behavior for other parts
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join('');
  
  // Add Config suffix if not already present
  return camelCase.endsWith('Config') ? camelCase : camelCase + 'Config';
};

// New helper function to ensure collection IDs are properly capitalized
const formatCollectionId = (id) => {
  if (!id) return '';
  
  // Split by underscores or spaces
  const parts = id.split(/[_\s]+/);
  
  // Capitalize first letter of each part
  return parts.map(part => 
    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  ).join('');
};

// Export current state function
const exportCurrentStateAsConfig = () => {
  if (!currentCollection) return;
  
  // Just call exportPresetAsConfig with current collection name
  exportPresetAsConfig({
    name: currentCollection.name
  });
};


  const downloadAsFile = (filename, text) => {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  //    // If no collection is loaded, show placeholder
  //    if (!currentCollection) {
  //     return (
  //       <div className={styles.noCollection}>
  //         No collection loaded. Load a collection to manage presets.
  //       </div>
  //     );
  //   }

  return (
    <div className={styles.presetManager}>
      {/* Header with collection info */}
      <div className={styles.presetHeader}>
        <h3>Presets for {currentCollection.name}</h3>
        {!isCreating ? (
          <button
            className={styles.createButton}
            onClick={() => setIsCreating(true)}
          >
            + Create New Preset
          </button>
        ) : (
          <div className={styles.createForm}>
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Preset name"
              className={styles.presetNameInput}
            />
            <div className={styles.createFormButtons}>
              <button
                className={styles.saveButton}
                onClick={handleCreatePreset}
                disabled={!newPresetName.trim()}
              >
                Save
              </button>
              <button
                className={styles.cancelButton}
                onClick={() => {
                  setIsCreating(false);
                  setNewPresetName('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* List of presets */}
      <div className={styles.presetList}>
        {presets.length === 0 ? (
          <div className={styles.noPresets}>
            No presets saved for this collection. Create one by capturing the current state.
          </div>
        ) : (
          presets.map(preset => (
            <div key={preset.id} className={styles.presetItem}>
              <div className={styles.presetInfo}>
                <h4>{preset.name}</h4>
                <span className={styles.presetDate}>
                  {new Date(preset.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className={styles.presetActions}>
                <button
                  className={styles.applyButton}
                  onClick={() => loadPreset(preset)}
                >
                  Apply
                </button>
                <button
                  className={styles.deleteButton}
                  onClick={() => {
                    if (window.confirm(`Delete preset "${preset.name}"?`)) {
                      deletePreset(preset.id);
                    }
                  }}
                >
                  Delete
                </button>
                <button
                  className={styles.exportButton}
                  onClick={() => exportPresetAsConfig(preset)}
                >
                  Export
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Export current state as a config file */}
      <div className={styles.exportSection}>
        <button
          className={styles.exportCurrentButton}
          onClick={exportCurrentStateAsConfig}
        >
          Export Current State as Config File
        </button>
      </div>
    </div>
  );
};

export default PresetManager;
