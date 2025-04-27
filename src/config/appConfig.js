/**
 * Application Configuration
 * Central configuration for the Ensō Audio application
 */

const AppConfig = {
  // Collection Source Configuration
  collections: {
    // Primary source for collections: 'blob', 'local', or 'local-folder'
    // 'blob': Fetch from Vercel Blob Storage (cloud)
    // 'local': Fetch from browser localStorage and local folder
    // 'local-folder': Fetch only from public/collections folder
    source: 'local-folder',
    
    // Local storage configuration
    local: {
      // Base path for local collections
      basePath: '/collections',
      
      // Whether to fallback to blob if local collection not found
      fallbackToBlob: false,
      
      // Cache duration for local collections in milliseconds (10 minutes)
      cacheDuration: 10 * 60 * 1000
    },
    
    // Blob storage configuration
    blob: {
      // API endpoint for listing blobs
      listEndpoint: '/api/blob/list',
      
      // Base URL for blob storage (from env or default)
      baseUrl: process.env.NEXT_PUBLIC_BLOB_BASE_URL || 'https://uggtzauwx9gzthtf.public.blob.vercel-storage.com',
      
      // Whether to fallback to local if blob collection not found
      fallbackToLocal: false,
      
      // Cache duration for blob collections in milliseconds (1 minute)
      cacheDuration: 60 * 1000
    }
  },
  
  // Audio Playback Configuration
  audio: {
    // Default volume settings (0-1)
    defaultVolume: 0.8,
    
    // Whether to auto-resume audio context on user interaction
    autoResume: true,
    
    // Default crossfade duration in milliseconds
    crossfadeDuration: 3000,
    
    // Default session duration in milliseconds (30 minutes)
    sessionDuration: 30 * 60 * 1000,
    
    // Whether to preload audio when collection is loaded
    preloadAudio: true,
    
    // Default volume for each layer (0-1)
    layerVolumes: {
      'Layer 1': 0.7, // Drone layer
      'Layer 2': 0.5, // Melody layer
      'Layer 3': 0.4, // Rhythm layer
      'Layer 4': 0.3  // Nature layer
    }
  },
  
  // User Interface Configuration
  ui: {
    // Theme settings
    theme: 'dark',
    
    // Animation settings
    animations: {
      enabled: true,
      reducedMotion: false
    },
    
    // Debug mode
    debugMode: false,
    
    // Default view for collections
    defaultCollectionView: 'grid', // 'grid' or 'list'
    
    // Whether to show advanced controls by default
    showAdvancedControls: false
  },
  
  // Logging Configuration
  logging: {
    // Enable detailed logging for debugging
    enabled: false,
    
    // Log levels to include
    levels: ['error', 'warn', 'info'],
    
    // Services to enable logging for
    services: ['audio', 'collection', 'volume', 'buffer', 'timeline']
  }
};

export default AppConfig;
