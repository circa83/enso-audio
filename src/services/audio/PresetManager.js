/**
 * PresetManager.js
 * 
 * Service for managing audio presets in Ensō Audio
 * Handles saving, loading, exporting, and importing preset configurations
 */

class PresetManager {
    /**
     * Create a new PresetManager instance
     * @param {Object} options - Configuration options
     * @param {Function} [options.onPresetChange] - Callback when presets change: (presets) => void
     * @param {Function} [options.onPresetLoad] - Callback when a preset is loaded: (presetName, presetData) => void
     * @param {Function} [options.getStateProviders] - Function that returns state provider map
     * @param {Object} [options.initialPresets={}] - Initial preset data to load
     * @param {string} [options.storageKey='ensoAudioPresets'] - Local storage key
     * @param {boolean} [options.enableLogging=false] - Enable detailed console logging
     */
    constructor(options = {}) {
      // Configuration
      this.config = {
        storageKey: options.storageKey || 'ensoAudioPresets',
        enableLogging: options.enableLogging || false
      };
      
      // Callbacks
      this.onPresetChange = options.onPresetChange || null;
      this.onPresetLoad = options.onPresetLoad || null;
      this.getStateProviders = options.getStateProviders || (() => ({}));
      
      // State
      this.presets = {};
      
      // Initialize presets
      if (options.initialPresets && typeof options.initialPresets === 'object') {
        this.presets = { ...options.initialPresets };
      } else {
        // Try loading from localStorage if available
        this._loadFromStorage();
      }
      
      this.log('PresetManager initialized');
    }
    
    /**
     * Get all available presets
     * @returns {Object} Map of preset names to preset objects
     */
    getAllPresets() {
      return { ...this.presets };
    }
    
    /**
     * Get presets as a sorted array
     * @param {string} [sortBy='date'] - Field to sort by ('date', 'name')
     * @param {boolean} [descending=true] - Sort in descending order
     * @returns {Array} Array of preset objects
     */
    getPresetArray(sortBy = 'date', descending = true) {
      const presetArray = Object.values(this.presets);
      
      const sortFn = (a, b) => {
        if (sortBy === 'date') {
          const dateA = new Date(a.date || 0);
          const dateB = new Date(b.date || 0);
          return descending ? dateB - dateA : dateA - dateB;
        } else if (sortBy === 'name') {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return descending ? nameB.localeCompare(nameA) : nameA.localeCompare(nameB);
        }
        return 0;
      };
      
      return presetArray.sort(sortFn);
    }
    
    /**
     * Get a specific preset by name
     * @param {string} name - Preset name
     * @returns {Object|null} Preset object or null if not found
     */
    getPreset(name) {
      return this.presets[name] || null;
    }
    
    /**
     * Save current state as a preset
     * @param {string} name - Preset name
     * @returns {Object|null} The saved preset or null on failure
     */
    savePreset(name) {
      if (!name || typeof name !== 'string' || name.trim() === '') {
        this.log('Invalid preset name', 'error');
        return null;
      }
      
      try {
        // Get state from all registered providers
        const stateProviders = this.getStateProviders();
        const componentStates = {};
        
        // Collect state from all providers
        Object.entries(stateProviders).forEach(([key, providerFn]) => {
          try {
            const state = providerFn();
            if (state) {
              componentStates[key] = state;
            }
          } catch (error) {
            this.log(`Error getting state from provider ${key}: ${error.message}`, 'error');
          }
        });
        
        // Create the preset
        const preset = {
          name,
          date: new Date().toISOString(),
          components: componentStates
        };
        
        // Save to internal state
        this.presets = {
          ...this.presets,
          [name]: preset
        };
        
        // Save to localStorage
        this._saveToStorage();
        
        // Trigger callback
        if (this.onPresetChange) {
          this.onPresetChange(this.presets);
        }
        
        this.log(`Preset "${name}" saved successfully`);
        return preset;
      } catch (error) {
        this.log(`Error saving preset: ${error.message}`, 'error');
        return null;
      }
    }
    
    /**
     * Load a preset by name
     * @param {string} name - Preset name
     * @returns {boolean} Success state
     */
    loadPreset(name) {
      const preset = this.presets[name];
      
      if (!preset) {
        this.log(`Preset "${name}" not found`, 'error');
        return false;
      }
      
      try {
        this.log(`Loading preset "${name}"`);
        
        // Trigger the load callback
        if (this.onPresetLoad) {
          this.onPresetLoad(name, preset);
        }
        
        return true;
      } catch (error) {
        this.log(`Error loading preset: ${error.message}`, 'error');
        return false;
      }
    }
    
    /**
     * Delete a preset
     * @param {string} name - Preset name
     * @returns {boolean} Success state
     */
    deletePreset(name) {
      if (!this.presets[name]) {
        this.log(`Cannot delete: preset "${name}" not found`, 'warn');
        return false;
      }
      
      try {
        // Create new presets object without the target preset
        const { [name]: removed, ...remaining } = this.presets;
        this.presets = remaining;
        
        // Save to localStorage
        this._saveToStorage();
        
        // Trigger callback
        if (this.onPresetChange) {
          this.onPresetChange(this.presets);
        }
        
        this.log(`Preset "${name}" deleted`);
        return true;
      } catch (error) {
        this.log(`Error deleting preset: ${error.message}`, 'error');
        return false;
      }
    }
    
    /**
     * Export a preset to JSON string
     * @param {string} name - Preset name
     * @returns {string|null} JSON string or null on failure
     */
    exportPreset(name) {
      const preset = this.presets[name];
      
      if (!preset) {
        this.log(`Cannot export: preset "${name}" not found`, 'error');
        return null;
      }
      
      try {
        const jsonString = JSON.stringify(preset, null, 2);
        this.log(`Exported preset "${name}" (${jsonString.length} bytes)`);
        return jsonString;
      } catch (error) {
        this.log(`Error exporting preset: ${error.message}`, 'error');
        return null;
      }
    }
    
    /**
     * Export all presets to JSON string
     * @returns {string|null} JSON string or null on failure
     */
    exportAllPresets() {
      try {
        const jsonString = JSON.stringify(this.presets, null, 2);
        this.log(`Exported all presets (${jsonString.length} bytes)`);
        return jsonString;
      } catch (error) {
        this.log(`Error exporting all presets: ${error.message}`, 'error');
        return null;
      }
    }
    
    /**
     * Import a preset from JSON string
     * @param {string} jsonString - JSON string to import
     * @param {Object} [options] - Import options
     * @param {boolean} [options.overwrite=false] - Overwrite existing preset with same name
     * @returns {Object} Result of import operation
     */
    importPreset(jsonString, options = {}) {
      const { overwrite = false } = options;
      
      try {
        // Parse the JSON data
        const preset = JSON.parse(jsonString);
        
        // Validate basic structure
        if (!preset || typeof preset !== 'object' || !preset.name) {
          return {
            success: false,
            error: 'Invalid preset format: missing name or invalid structure'
          };
        }
        
        // Check for duplicate
        if (this.presets[preset.name] && !overwrite) {
          return {
            success: false,
            error: 'A preset with this name already exists',
            name: preset.name,
            duplicate: true
          };
        }
        
        // Update date to current time
        const importedPreset = {
          ...preset,
          date: new Date().toISOString() // Update the date to now
        };
        
        // Add to presets
        this.presets = {
          ...this.presets,
          [preset.name]: importedPreset
        };
        
        // Save to localStorage
        this._saveToStorage();
        
        // Trigger callback
        if (this.onPresetChange) {
          this.onPresetChange(this.presets);
        }
        
        this.log(`Imported preset "${preset.name}" successfully`);
        
        return {
          success: true,
          name: preset.name,
          preset: importedPreset
        };
      } catch (error) {
        this.log(`Error importing preset: ${error.message}`, 'error');
        
        return {
          success: false,
          error: `Failed to import preset: ${error.message}`
        };
      }
    }
    
    /**
     * Import multiple presets from JSON string
     * @param {string} jsonString - JSON string containing multiple presets
     * @param {Object} [options] - Import options
     * @param {boolean} [options.overwrite=false] - Overwrite existing presets
     * @returns {Object} Result of import operation
     */
    importMultiplePresets(jsonString, options = {}) {
      const { overwrite = false } = options;
      
      try {
        // Parse the JSON data
        const data = JSON.parse(jsonString);
        
        if (!data || typeof data !== 'object') {
          return {
            success: false,
            error: 'Invalid data format: not a valid JSON object'
          };
        }
        
        let importedCount = 0;
        let skippedCount = 0;
        const errors = [];
        
        // Handle both object map and array formats
        const presetData = Array.isArray(data) ? data : Object.values(data);
        
        // Process each preset
        presetData.forEach(preset => {
          if (!preset || typeof preset !== 'object' || !preset.name) {
            errors.push('Invalid preset (missing name or invalid structure)');
            return;
          }
          
          // Check for duplicate
          if (this.presets[preset.name] && !overwrite) {
            skippedCount++;
            return;
          }
          
          // Update date to current time
          this.presets[preset.name] = {
            ...preset,
            date: new Date().toISOString()
          };
          
          importedCount++;
        });
        
        if (importedCount > 0) {
          // Save to localStorage
          this._saveToStorage();
          
          // Trigger callback
          if (this.onPresetChange) {
            this.onPresetChange(this.presets);
          }
        }
        
        this.log(`Imported ${importedCount} presets, skipped ${skippedCount}`);
        
        return {
          success: true,
          importedCount,
          skippedCount,
          errors: errors.length > 0 ? errors : null
        };
      } catch (error) {
        this.log(`Error importing presets: ${error.message}`, 'error');
        
        return {
          success: false,
          error: `Failed to import presets: ${error.message}`
        };
      }
    }
    
    /**
     * Save presets to localStorage
     * @private
     */
    _saveToStorage() {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      
      try {
        const jsonString = JSON.stringify(this.presets);
        window.localStorage.setItem(this.config.storageKey, jsonString);
        return true;
      } catch (error) {
        this.log(`Error saving to localStorage: ${error.message}`, 'warn');
        return false;
      }
    }
    
    /**
     * Load presets from localStorage
     * @private
     */
    _loadFromStorage() {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      
      try {
        const jsonString = window.localStorage.getItem(this.config.storageKey);
        
        if (!jsonString) {
          this.log('No presets found in localStorage');
          return false;
        }
        
        const loadedPresets = JSON.parse(jsonString);
        if (loadedPresets && typeof loadedPresets === 'object') {
          this.presets = loadedPresets;
          this.log(`Loaded ${Object.keys(loadedPresets).length} presets from localStorage`);
          return true;
        }
      } catch (error) {
        this.log(`Error loading from localStorage: ${error.message}`, 'warn');
      }
      
      return false;
    }
    
    /**
     * Logging helper that respects configuration
     * @private
     * @param {string} message - Message to log
     * @param {string} [level='info'] - Log level
     */
    log(message, level = 'info') {
      if (!this.config.enableLogging) return;
      
      const prefix = '[PresetManager]';
      
      switch (level) {
        case 'error':
          console.error(`${prefix} ${message}`);
          break;
        case 'warn':
          console.warn(`${prefix} ${message}`);
          break;
        case 'info':
        default:
          console.log(`${prefix} ${message}`);
          break;
      }
    }
    
    /**
     * Clean up resources when no longer needed
     */
    dispose() {
      // Reset internal state
      this.presets = {};
      this.log('PresetManager disposed');
    }
  }
  
  export default PresetManager;