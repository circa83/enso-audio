/**
 * Ensō Audio App Configuration
 * 
 * Central configuration registry that imports individual collection configs
 * and provides utilities for accessing them.
 */



// Import collection configurations
import StillnessConfig from './collections/Stillness_config';
import ElevateConfig from './collections/Elevate_config';
// Add more imports as you create them
// import ForestConfig from './collections/Forest_config';
// import MeditationConfig from './collections/Meditation_config';

const appConfig = {

  //========Collection Configs===========
  //=====================================

  // Global toggle to enable/disable collection-specific configurations
  useCollectionConfigs: true,
  
  // Global application defaults (used when collection-specific settings aren't defined)
  defaults: {
    sessionDuration: 60 * 60 * 1000, // 60 minutes in milliseconds
    transitionDuration: 4000, // 4 seconds for audio transitions
    volumes: {
      'Layer 1': 0.25, // Drone layer
      'Layer 2': 0.0,  // Melody layer
      'Layer 3': 0.0,  // Rhythm layer
      'Layer 4': 0.0,  // Nature layer
    },
    // Default phase marker configuration
    phaseMarkers: [
      {
        id: 'pre-onset',
        name: 'Pre-Onset',
        position: 0,
        color: '#4A6670',
        locked: true,
        state: {
          volumes: {
            'Layer 1': 0.25,
            'Layer 2': 0.0,
            'Layer 3': 0.0,
            'Layer 4': 0.0
          },
          activeAudio: {}  // Will be populated with defaults from the collection
        }
      },
      {
        id: 'onset',
        name: 'Onset & Buildup',
        position: 20,
        color: '#6E7A8A',
        locked: false,
        state: {
          volumes: {
            'Layer 1': 0.5,
            'Layer 2': 0.3,
            'Layer 3': 0.0,
            'Layer 4': 0.0
          },
          activeAudio: {}  // Will be populated with defaults from the collection
        }
      },
      {
        id: 'peak',
        name: 'Peak',
        position: 40,
        color: '#8A8A8A',
        locked: false,
        state: {
          volumes: {
            'Layer 1': 0.4,
            'Layer 2': 0.6,
            'Layer 3': 0.5,
            'Layer 4': 0.3
          },
          activeAudio: {}  // Will be populated with defaults from the collection
        }
      },
      {
        id: 'return',
        name: 'Return & Integration',
        position: 60,
        color: '#A98467',
        locked: false,
        state: {
          volumes: {
            'Layer 1': 0.6,
            'Layer 2': 0.2,
            'Layer 3': 0.0,
            'Layer 4': 0.5
          },
          activeAudio: {}  // Will be populated with defaults from the collection
        }
      }
    ]
  },

  // Collection registry - maps collection IDs to their config modules with enabled flag
  collections: {
    "Stillness": {
      config: StillnessConfig,
      enabled: true  // Whether this collection's config should be used
    },
    "Elevate": {
      config: ElevateConfig,
      enabled: true
    },
    // "forest": {
    //   config: ForestConfig,
    //   enabled: true
    // },
    // "meditation": {
    //   config: MeditationConfig,
    //   enabled: true
    // },
    // Add more as you create them
  },
  
  // Function to get configuration for a specific collection
  getCollectionConfig: function(collectionId) {
    console.log(`[appConfig] getCollectionConfig called with ID: "${collectionId}" (${typeof collectionId})`);
  
    // Convert collectionId to a standardized format for comparison (e.g., lowercase)
    const normalizedId = typeof collectionId === 'string' ? collectionId.trim() : collectionId;
    
    // Find the matching collection entry (case-insensitive)
    let matchedCollection = null;
    const availableCollections = Object.keys(this.collections);
    
    for (const configId of availableCollections) {
      if (configId.toLowerCase() === normalizedId.toLowerCase()) {
        matchedCollection = configId;
        break;
      }
    }
    
    // Log the match result
    console.log(`[appConfig] Collection "${collectionId}" normalized to "${normalizedId}"`);
    console.log(`[appConfig] Matched to config ID: ${matchedCollection || 'NONE'}`);
  
    // Check if global config use is enabled
    console.log(`[appConfig] Global useCollectionConfigs setting: ${this.useCollectionConfigs ? 'ENABLED' : 'DISABLED'}`);
    
    // If collection exists, check if it's enabled
    const collectionExists = !!matchedCollection;
    console.log(`[appConfig] Collection exists in registry: ${collectionExists ? 'YES' : 'NO'}`);
    
    if (collectionExists) {
      console.log(`[appConfig] Collection "${matchedCollection}" enabled status: ${this.collections[matchedCollection].enabled ? 'ENABLED' : 'DISABLED'}`);
    }
  
    // Check if we should use collection configs and if this collection has one
    const useConfig = this.useCollectionConfigs && 
                      matchedCollection && 
                      this.collections[matchedCollection].enabled;
    
    if (useConfig) {
      console.log(`Using custom configuration for collection: ${matchedCollection}`);
      
      // Get the collection config
      const collectionConfig = this.collections[matchedCollection].config;
      
      // Validate that the config has all needed properties
      const validatedConfig = this._ensureValidConfig(collectionConfig);
      
      console.log(`[appConfig] Returning validated collection config with ${validatedConfig.phaseMarkers?.length || 0} phase markers`);
      
      // Return the collection config directly without merging
      return validatedConfig;
    }
    
    // Otherwise return default config
    console.warn(`[appConfig] Using default configuration for collection: ${collectionId}`);
    console.log(`[appConfig] Default config has ${this.defaults.phaseMarkers?.length || 0} phase markers`);
    return this.defaults;
  },

// Add a new helper to ensure config has all required properties
_ensureValidConfig: function(config) {
  // Create a deep clone to avoid modifying the original
  const validConfig = JSON.parse(JSON.stringify(config));
  
  // Ensure essential properties exist
  if (!validConfig.sessionDuration) {
    console.warn('Collection config missing sessionDuration, using default');
    validConfig.sessionDuration = this.defaults.sessionDuration;
  }
  
  if (!validConfig.transitionDuration) {
    console.warn('Collection config missing transitionDuration, using default');
    validConfig.transitionDuration = this.defaults.transitionDuration;
  }
  
  // Ensure volumes exist
  if (!validConfig.volumes) {
    console.warn('Collection config missing volumes, using default');
    validConfig.volumes = { ...this.defaults.volumes };
  }
  
  // Ensure phaseMarkers have proper structure
  if (validConfig.phaseMarkers) {
    validConfig.phaseMarkers = validConfig.phaseMarkers.map(marker => {
      // Ensure marker has all needed properties
      const validMarker = {
        id: marker.id,
        name: marker.name || `Phase ${marker.id}`,
        position: marker.position !== undefined ? marker.position : 0,
        color: marker.color || '#8A8A8A',
        locked: marker.locked !== undefined ? marker.locked : false
      };
      
      // Ensure state has the right structure if it exists
      if (marker.state) {
        validMarker.state = {
          volumes: marker.state.volumes || {},
          activeAudio: marker.state.activeAudio || {}
        };
      }
      
      return validMarker;
    });
  } else {
    console.warn('Collection config missing phaseMarkers, using default');
    validConfig.phaseMarkers = [...this.defaults.phaseMarkers];
  }
  
  return validConfig;
}, 
  
  // Toggle collection config usage globally
  setUseCollectionConfigs: function(enabled) {
    this.useCollectionConfigs = enabled;
    console.log(`Collection configs ${enabled ? 'enabled' : 'disabled'} globally`);
    return this.useCollectionConfigs;
  },
  
  // Toggle a specific collection's config
  toggleCollectionConfig: function(collectionId, enabled) {
    if (!this.collections[collectionId]) {
      console.warn(`Collection not found: ${collectionId}`);
      return false;
    }
    
    // If enabled is not provided, toggle the current state
    if (enabled === undefined) {
      enabled = !this.collections[collectionId].enabled;
    }
    
    this.collections[collectionId].enabled = enabled;
    console.log(`Configuration for ${collectionId} ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  },
  
  // // Helper function to perform a deep merge with defaults
  // _mergeWithDefaults: function(collectionConfig) {
  //   // Start with defaults
  //   const result = { ...this.defaults };
    
  //   // For each property in the collection config
  //   Object.entries(collectionConfig).forEach(([key, value]) => {
  //     // If it's an object (but not an array), merge recursively
  //     if (value && typeof value === 'object' && !Array.isArray(value) && 
  //         result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
  //       result[key] = { ...result[key], ...value };
  //     } 
  //     // For arrays and primitive values, replace entirely
  //     else {
  //       result[key] = value;
  //     }
  //   });
    
  //   // Special handling for phaseMarkers if they exist in both
  //   if (collectionConfig.phaseMarkers && result.phaseMarkers) {
  //     // Map collection phase markers by ID for easy lookup
  //     const phaseMarkersById = {};
  //     collectionConfig.phaseMarkers.forEach(marker => {
  //       phaseMarkersById[marker.id] = marker;
  //     });
      
  //     // Merge with defaults while preserving order
  //     result.phaseMarkers = result.phaseMarkers.map(defaultMarker => {
  //       // If this marker exists in collection config, merge with default
  //       if (phaseMarkersById[defaultMarker.id]) {
  //         return {
  //           ...defaultMarker,
  //           ...phaseMarkersById[defaultMarker.id],
  //           // Deep merge the state object
  //           state: {
  //             ...defaultMarker.state,
  //             ...phaseMarkersById[defaultMarker.id].state,
  //             // Deep merge volumes
  //             volumes: {
  //               ...defaultMarker.state?.volumes,
  //               ...phaseMarkersById[defaultMarker.id].state?.volumes
  //             },
  //             // Deep merge activeAudio
  //             activeAudio: {
  //               ...defaultMarker.state?.activeAudio,
  //               ...phaseMarkersById[defaultMarker.id].state?.activeAudio
  //             }
  //           }
  //         };
  //       }
  //       return defaultMarker;
  //     });
  //   }
    
  //   return result;
  // },
  
  // Get a list of all available collection IDs
  getAvailableCollections: function() {
    return Object.keys(this.collections);
  },
  
  // Get config status for all collections
  getConfigStatus: function() {
    const status = {
      globalEnabled: this.useCollectionConfigs,
      collections: {}
    };
    
    Object.entries(this.collections).forEach(([id, collectionData]) => {
      status.collections[id] = {
        enabled: collectionData.enabled,
        effectivelyEnabled: this.useCollectionConfigs && collectionData.enabled
      };
    });
    
    return status;
  },


//===========
// Feature Visibility
//===========


  featureVisibility: {
    //Player
    exportConfig: true,
    audioLayers: true,
    //ambient archive
    filterControls: false, 
    //timeline
    captureState: true,
    
  },
  
  isFeatureVisible: function(featureId) {
    return this.featureVisibility[featureId] === true;
  }
  
};

// Log the loaded collection configs
console.log("[appConfig] Collection configs:");
Object.entries(appConfig.collections).forEach(([id, collection]) => {
  console.log(`[appConfig] - ${id} (enabled: ${collection.enabled})`);
  
  if (collection.config?.phaseMarkers) {
    console.log(`[appConfig] -- Phase markers: ${collection.config.phaseMarkers.length}`);
    collection.config.phaseMarkers.forEach(phase => {
      console.log(`[appConfig] --- Phase "${phase.name}" has state: ${phase.state ? 'YES' : 'NO'}`);
      if (phase.state) {
        console.log(`[appConfig] ---- Volumes: ${JSON.stringify(phase.state.volumes || {})}`);
        console.log(`[appConfig] ---- ActiveAudio: ${JSON.stringify(phase.state.activeAudio || {})}`);
      }
    });
  }
});

export default appConfig;
