import React from 'react';
import { useAudio } from '../../hooks/useAudio';
import styles from '../../styles/components/ExportConfig.module.css';

const ExportConfig = () => {
  const {
    volumes,
    activeAudio,
    timelinePhases,
    sessionDuration,
    transitionDuration,
    currentCollection
  } = useAudio();

  // Format collection ID to ensure proper capitalization
  const formatCollectionId = (id) => {
    if (!id) return '';
    
    // Split by underscores or spaces
    const parts = id.split(/[_\s]+/);
    
    // Capitalize first letter of each part
    return parts.map(part => 
      part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    ).join('');
  };

  // Format filename for config file
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

  // Format config variable name
  const formatConfigName = (name) => {
    // Convert to camelCase
    const parts = name.split(/[^a-zA-Z0-9]+/);
    
    // Always capitalize the first character of the first part
    const camelCase = parts.map((part, index) => {
      // Always capitalize first letter for first part
      if (index === 0) return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      // Keep existing behavior for other parts
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join('');
    
    // Add Config suffix if not already present
    return camelCase.endsWith('Config') ? camelCase : camelCase + 'Config';
  };

  // Helper to download file
  const downloadAsFile = (filename, text) => {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Export current state as config file
  const exportCurrentStateAsConfig = () => {
    if (!currentCollection) return;
    
    // Helper function to clean volumes - keep only Layer entries
    const cleanVolumes = (volumesObj) => {
      return Object.entries(volumesObj)
        .filter(([key]) => key.startsWith('Layer '))
        .reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
        }, {});
    };
    
    // Clean up the data to match the expected structure
    const configData = {
      name: formatCollectionId(currentCollection.name),
      description: `Audio configuration for ${currentCollection.name} collection`,
      sessionDuration: sessionDuration,
      transitionDuration: transitionDuration,
      
      // Clean up top-level volumes
      volumes: cleanVolumes(volumes),
      
      // Keep the activeAudio mapping
      activeAudio: { ...activeAudio },
      
      // Format the phaseMarkers properly
      phaseMarkers: timelinePhases.map(phase => ({
        id: phase.id,
        name: phase.name,
        position: phase.position,
        color: phase.color,
        state: phase.state ? {
          volumes: cleanVolumes(phase.state.volumes),
          activeAudio: { ...phase.state.activeAudio }
        } : {
          volumes: cleanVolumes(volumes),
          activeAudio: { ...activeAudio }
        },
        locked: phase.locked || false
      }))
    };
    
    // Format as a JS module with proper name
    const cleanName = formatCollectionId(currentCollection.name);
    
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

    // Download as a file
    downloadAsFile(`${formatFileName(cleanName)}_config.js`, configFileContent);
  };

  // If no collection is loaded, don't render the button
  if (!currentCollection) {
    return null;
  }

  return (
    <div className={styles.exportConfigContainer}>
      <button
        className={styles.exportButton}
        onClick={exportCurrentStateAsConfig}
        title="Export the current audio settings as a configuration file"
      >
        Export Current State as Config File
      </button>
    </div>
  );
};

export default ExportConfig;
