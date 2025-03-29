/**
 * PresetStorage.js
 * 
 * Service for storing and retrieving presets from localStorage or API
 * Handles persistence of user-created audio presets
 */

class PresetStorage {
    constructor() {
      this.storageKey = 'ensoAudioPresets';
      this.initialized = false;
      this.presets = {};
    }
  
    /**
     * Initialize the storage service
     * Loads any saved presets from localStorage
     */
    initialize() {
      if (this.initialized) return;
      
      try {
        // Only access localStorage if we're in a browser environment
        if (typeof window !== 'undefined' && window.localStorage) {
          const savedPresets = localStorage.getItem(this.storageKey);
          if (savedPresets) {
            this.presets = JSON.parse(savedPresets);
          }
        }
        this.initialized = true;
      } catch (error) {
        console.error('Error initializing preset storage:', error);
      }
    }
  
    /**
     * Save a preset
     * @param {string} name - Name of the preset
     * @param {Object} state - State data to save
     * @returns {boolean} Success status
     */
    savePreset(name, state) {
      if (!name || name.trim() === '') return false;
      if (!this.initialized) this.initialize();
      
      try {
        // Create the preset with state data
        const preset = {
          name,
          date: new Date().toISOString(),
          state
        };
        
        // Add to presets collection
        this.presets[name] = preset;
        
        // Persist to localStorage
        this.persistPresets();
        
        return true;
      } catch (error) {
        console.error('Error saving preset:', error);
        return false;
      }
    }
  
    /**
     * Load a preset by name
     * @param {string} name - Name of the preset to load
     * @returns {Object|null} Preset data or null if not found
     */
    loadPreset(name) {
      if (!this.initialized) this.initialize();
      return this.presets[name] || null;
    }
  
    /**
     * Delete a preset
     * @param {string} name - Name of the preset to delete
     * @returns {boolean} Success status
     */
    deletePreset(name) {
      if (!this.initialized) this.initialize();
      
      if (!this.presets[name]) return false;
      
      try {
        // Remove from presets collection
        delete this.presets[name];
        
        // Persist to localStorage
        this.persistPresets();
        
        return true;
      } catch (error) {
        console.error('Error deleting preset:', error);
        return false;
      }
    }
  
    /**
     * Get all presets as an array sorted by date (newest first)
     * @returns {Array} Array of preset objects
     */
    getPresets() {
      if (!this.initialized) this.initialize();
      
      return Object.values(this.presets).sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      );
    }
  
    /**
     * Export a preset as JSON string
     * @param {string} name - Name of the preset to export
     * @returns {string|null} JSON string or null if preset not found
     */
    exportPreset(name) {
      if (!this.initialized) this.initialize();
      
      const preset = this.presets[name];
      if (!preset) return null;
      
      try {
        return JSON.stringify(preset, null, 2);
      } catch (error) {
        console.error('Error exporting preset:', error);
        return null;
      }
    }
  
    /**
     * Import a preset from JSON string
     * @param {string} jsonString - JSON string of preset data
     * @returns {Object} Result object {success, preset, error}
     */
    importPreset(jsonString) {
      if (!this.initialized) this.initialize();
      
      try {
        // Parse the JSON string
        const data = JSON.parse(jsonString);
        
        // Validate the data
        if (!data.name || !data.state) {
          return {
            success: false,
            error: 'Invalid preset format: missing name or state data'
          };
        }
        
        // Add to presets collection
        this.presets[data.name] = {
          ...data,
          date: data.date || new Date().toISOString()
        };
        
        // Persist to localStorage
        this.persistPresets();
        
        return {
          success: true,
          preset: this.presets[data.name]
        };
      } catch (error) {
        console.error('Error importing preset:', error);
        return {
          success: false,
          error: 'Invalid JSON format: ' + error.message
        };
      }
    }
  
    /**
     * Persist presets to localStorage
     * @private
     */
    persistPresets() {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(this.storageKey, JSON.stringify(this.presets));
        }
      } catch (error) {
        console.error('Error persisting presets:', error);
      }
    }
  
    /**
     * Clear all presets
     * @returns {boolean} Success status
     */
    clearAllPresets() {
      try {
        this.presets = {};
        
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem(this.storageKey);
        }
        
        return true;
      } catch (error) {
        console.error('Error clearing presets:', error);
        return false;
      }
    }
  }
  
  // Singleton instance
  let instance = null;
  
  /**
   * Get the PresetStorage instance
   * @returns {PresetStorage} The PresetStorage instance
   */
  export const getPresetStorage = () => {
    if (!instance) {
      instance = new PresetStorage();
      instance.initialize();
    }
    return instance;
  };
  
  export default {
    getPresetStorage
  };