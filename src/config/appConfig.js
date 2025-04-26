/**
 * Application Configuration
 * Central configuration for the Ensō Audio application
 */

const AppConfig = {
    // Collection Source Configuration
    collections: {
      // Primary source for collections: 'local' or 'blob'
      source: 'local',
      
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
        fallbackToLocal: true,
        
        // Cache duration for blob collections in milliseconds (1 minute)
        cacheDuration: 60 * 1000
      }
    },
    
    // Debug Configuration
    debug: {
      // Enable detailed console logging
      enableLogging: true,
      
      // Log collection loading
      logCollections: true,
      
      // Log buffer loading
      logBuffers: true,
      
      // Log layer actions
      logLayers: true
    }
  };
  
  export default AppConfig;
  