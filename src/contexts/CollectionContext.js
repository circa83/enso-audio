// src/contexts/CollectionContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import CollectionService from '../services/CollectionService';
import eventBus, { EVENTS } from '../services/EventBus.js';
import { useAudioContext } from './AudioContext.js';
import AppConfig from '../config/appConfig';

// Create the context
const CollectionContext = createContext(null);

/**
 * Provider component for collection management
 * Handles fetching, and selecting audio collections
 */
export const CollectionProvider = ({
  children,
  enableLogging = false,
  initialPageSize = 20,
  cacheDuration = 60000, // 1 minute default
  enableLocalStorage = AppConfig.collections.useLocalStorage || false,
  localStorageKey = 'enso_collections'
}) => {
  // Add check for audio context
  const { audioContext, initialized: audioInitialized } = useAudioContext();
  
  // Service reference
  const [collectionService, setCollectionService] = useState(null);

  // Collection state
  const [collections, setCollections] = useState([]);
  const [currentCollection, setCurrentCollection] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  // const [filters, setFilters] = useState({});
  const [initialized, setInitialized] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: initialPageSize,
    pages: 0
  });

  // Source distribution (how many collections from each source)
  const [sourceDistribution, setSourceDistribution] = useState({
    blob: 0,
    local: 0,
    localFolder: 0
  });

  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);
  const hasInitiallyLoadedRef = useRef(false);
  const retriesRef = useRef(0);
  const maxRetries = 3;

  // Initialize CollectionService
  useEffect(() => {
    if (!audioInitialized) {
      console.log('[CollectionContext] Waiting for AudioContext to initialize');
      return;
    }

    console.log('[CollectionContext] Initializing CollectionService...');

    try {
      const service = new CollectionService({
        enableLogging,
        cacheDuration,
        apiBasePath: '/api',
        enableLocalStorage,
        localStorageKey,
        // Pass the source configuration from AppConfig
        collectionSource: AppConfig.collections.source || 'local-folder'
      });

      setCollectionService(service);
      setInitialized(true);

      console.log('[CollectionContext] CollectionService initialized successfully');

      // Clean up on unmount
      return () => {
        isMountedRef.current = false;
        if (service && typeof service.dispose === 'function') {
          console.log('[CollectionContext] Cleaning up CollectionService');
          service.dispose();
        }
      };
    } catch (error) {
      console.error('[CollectionContext] Error initializing CollectionService:', error);
      setError(error.message);
      return () => {
        isMountedRef.current = false;
      };
    }
  }, [audioInitialized, enableLogging, cacheDuration, enableLocalStorage, localStorageKey]);

  // Set mounted ref for cleanup
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Consolidated loadCollections that handles collections from the configured source
  const loadCollections = useCallback(async (
    page = 1, 
    // currentFilters = filtersRef.current, 
    source = undefined, // Use undefined to respect the AppConfig source
    options = {}
  ) => {
    if (!isMountedRef.current || !collectionService) {
      console.log('[CollectionContext] Component not mounted or service unavailable, skipping load');
      return;
    }

    // Add flag to prevent multiple simultaneous requests
    if (isLoading && !options.force) {
      console.log('[CollectionContext] Already loading collections, skipping duplicate request');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

     // console.log(`[CollectionContext] Loading collections page ${page} with filters:`, currentFilters);

      const result = await collectionService.getCollections({
        //...currentFilters,
        page,
        limit: pagination.limit,
        useCache: true,
        source // Pass undefined to use the configured source
      });

      if (!isMountedRef.current) return; // Check if still mounted

      if (result.success) {
        // Add deduplication logic
        const uniqueCollections = [];
        const seenIds = new Set();
        
        result.data.forEach(collection => {
          if (!seenIds.has(collection.id)) {
            seenIds.add(collection.id);
            uniqueCollections.push(collection);
          } else {
            console.warn(`[CollectionContext] Duplicate collection ID detected: ${collection.id} - "${collection.name}"`);
          }
        });
        
        if (uniqueCollections.length !== result.data.length) {
          console.log(`[CollectionContext] Filtered ${result.data.length} collections to ${uniqueCollections.length} unique collections`);
        }

        console.log(`[CollectionContext] Successfully loaded ${uniqueCollections.length} collections (${result.pagination?.total || 0} total)`);
        
        setCollections(uniqueCollections);
        
        // Adjust pagination if needed due to filtering
        const adjustedPagination = {
          ...result.pagination,
          total: Math.max(result.pagination?.total - (result.data.length - uniqueCollections.length), uniqueCollections.length),
          pages: Math.ceil(Math.max(result.pagination?.total - (result.data.length - uniqueCollections.length), uniqueCollections.length) / pagination.limit)
        };
        
        setPagination(adjustedPagination || {
          total: uniqueCollections.length,
          page: 1,
          limit: pagination.limit,
          pages: 1
        });

        // Update source distribution when available
        if (result.sources) {
          setSourceDistribution(result.sources);
        }

        // Reset retry counter on success
        retriesRef.current = 0;

        // Publish event through event bus
        eventBus.emit(EVENTS.COLLECTION_LOADED || 'collections:loaded', {
          collections: uniqueCollections,
          pagination: result.pagination,
          source: undefined,
          timestamp: Date.now()
        });
        
        return uniqueCollections;
      } else {
        throw new Error(result.error || 'Failed to load collections');
      }
    } catch (err) {
      console.error(`[CollectionContext] Error loading collections:`, err);

      if (!isMountedRef.current) return; // Check if still mounted

      // Implement retry logic - but don't retry missing local folder collections
      if (retriesRef.current < maxRetries && 
          !options.noRetry &&
          !err.message.includes('collections index') && 
          !err.message.includes('404')) {
        retriesRef.current++;
        console.log(`[CollectionContext] Retrying (${retriesRef.current}/${maxRetries})...`);
          // Wait a moment before retrying (exponential backoff)
          const delay = Math.pow(2, retriesRef.current) * 500;
          setTimeout(() => {
            if (isMountedRef.current) {
              loadCollections(page, source, options);
            }
          }, delay);

          return;
      }

      setError(err.message);

      // Publish error event
      eventBus.emit(EVENTS.COLLECTION_ERROR || 'collections:error', {
        error: err.message,
        timestamp: Date.now()
      });
      
      return null;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [collectionService, pagination.limit]);

  // // Update filters and reload collections
  // const updateFilters = useCallback((newFilters) => {
  //   console.log(`[CollectionContext] Updating filters:`, newFilters);
  //   setFilters(prev => {
  //     const updated = { ...prev, ...newFilters };
  //     filtersRef.current = updated; // Update the ref
  //     return updated;
  //   });
  // }, []);

  // // Navigate to a specific page
  // const goToPage = useCallback((pageNumber) => {
  //   if (pageNumber < 1 || pageNumber > pagination.pages) {
  //     console.warn(`[CollectionContext] Invalid page number: ${pageNumber}`);
  //     return;
  //   }

  //   console.log(`[CollectionContext] Navigating to page ${pageNumber}`);
  //   loadCollections(pageNumber, filtersRef.current);
  // }, [pagination.pages, loadCollections]);

  // // Clear all filters and reload
  // const clearFilters = useCallback(() => {
  //   console.log(`[CollectionContext] Clearing all filters`);
  //   setFilters({});
  //   filtersRef.current = {};

  //   // Reload from page 1 with empty filters - don't specify source to use config
  //   loadCollections(1, {}, undefined);
  // }, [loadCollections]);

  // // Effect to handle filter changes
  // useEffect(() => {
  //   if (!isMountedRef.current || !collectionService || !initialized) return;

  //   console.log(`[CollectionContext] Filters changed, reloading collections from page 1`);

  //   // Use the ref to get current filters
  //   const currentFilters = filtersRef.current;

  //   loadCollections(1, currentFilters, undefined);
  // }, [filters, loadCollections, collectionService, initialized]);

  // Fetch a specific collection by ID
  const getCollection = useCallback(async (id) => {
    if (!id || !collectionService) {
      console.error('[CollectionContext] Collection ID is required and service must be available');
      throw new Error('Collection ID is required');
    }
  
    try {
      console.log(`[CollectionContext] Loading collection: ${id}`);
      setIsLoading(true);
  
      const result = await collectionService.getCollection(id);
  
      if (!isMountedRef.current) return null; // Check if still mounted
  
      if (!result.success) {
        throw new Error(result.error || `Collection ${id} not found`);
      }
  
      console.log(`[CollectionContext] Successfully loaded collection: ${result.data.name} from source: ${result.source || 'unknown'}`);
  
      // Store raw collection as current collection
      setCurrentCollection(result.data);
  
      // Check if collection has required track data structure for formatting
      const hasValidTrackData = 
        result.data && 
        Array.isArray(result.data.tracks) && 
        result.data.tracks.length > 0 &&
        result.data.tracks[0].layerFolder;
  
      // Only try to format if the collection has the expected track structure
      if (hasValidTrackData) {
        try {
          console.log(`[CollectionContext] Formatting collection for player: ${result.data.tracks.length} tracks`);
          const formattedCollection = collectionService.formatCollectionForPlayer(result.data);
          
          // Publish event with formatted collection
          eventBus.emit(EVENTS.COLLECTION_SELECTED || 'collection:selected', {
            collectionId: result.data.id,
            collection: formattedCollection,  // Formatted with layers property
            rawCollection: result.data,
            source: result.source || 'api',
            format: 'player-ready',
            timestamp: Date.now()
          });
          
          console.log(`[CollectionContext] Emitted event with formatted collection`);
          return result.data;
        } catch (formatError) {
          console.error(`[CollectionContext] Error formatting collection: ${formatError.message}`);
          // Fall through to default handling below
        }
      } else {
        console.warn(`[CollectionContext] Collection lacks proper track structure for formatting`);
      }
      
      // Default handling if formatting wasn't possible or failed
      eventBus.emit(EVENTS.COLLECTION_SELECTED || 'collection:selected', {
        collectionId: result.data.id,
        collection: result.data,
        source: result.source || 'api',
        format: 'raw',
        requiresFormatting: true,
        timestamp: Date.now()
      });
      
      return result.data;
    } catch (err) {
      console.error(`[CollectionContext] Error loading collection ${id}:`, err);
  
      if (!isMountedRef.current) return null;
  
      setError(err.message);
  
      // Publish error event
      eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
        id,
        error: err.message,
        timestamp: Date.now()
      });
  
      throw err;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [collectionService]);

  // Format a collection for the player
  const formatForPlayer = useCallback((collection) => {
    if (!collection || !collectionService) {
      console.error('[CollectionContext] Collection and service are required for formatting');
      return null;
    }

    try {
      console.log(`[CollectionContext] Formatting collection for player: ${collection.id}`);
      const formatted = collectionService.formatCollectionForPlayer(collection);

      // Publish event
      eventBus.emit(EVENTS.COLLECTION_FORMATTED || 'collection:formatted', {
        collectionId: collection.id,
        formatted,
        timestamp: Date.now()
      });

      return formatted;
    } catch (err) {
      console.error(`[CollectionContext] Error formatting collection:`, err);
      setError(err.message);
      return null;
    }
  }, [collectionService]);

  // // Reset collection cache
  // const resetCache = useCallback(() => {
  //   if (!collectionService) {
  //     console.error('[CollectionContext] Service unavailable, cannot reset cache');
  //     return;
  //   }

  //   console.log('[CollectionContext] Resetting collection cache');
  //   collectionService.resetCache();

  //   // Reload collections - don't specify source to use config
  //   loadCollections(1, filtersRef.current, undefined);
  // }, [collectionService, loadCollections]);

    // Load initial data when service is initialized
    useEffect(() => {
      if (collectionService && initialized && !isLoading && !hasInitiallyLoadedRef.current) {
        console.log('[CollectionContext] Service initialized, loading initial data');
         // Set the ref so we don't load again
    hasInitiallyLoadedRef.current = true;
        // Load collections first time - don't specify source to use config
        loadCollections(1, undefined);
      }
    }, [collectionService, initialized, isLoading, loadCollections]);
  
    // Create memoized context value for better performance
    const contextValue = useMemo(() => ({
      // System state
      system: {
        initialized,
        isLoading,
        error,
        service: collectionService
      },
      
      // State data
      data: {
        collections,
        currentCollection,
        pagination,
        sourceDistribution,
        // filters
      },
      
      // Collection list operations
      list: {
        loadCollections,
        // updateFilters,
        // clearFilters,
        // goToPage,
        // resetCache
      },
      
      // Single collection operations
      collection: {
        get: getCollection,
        format: formatForPlayer
      },
      
      // Keep the flat API for backward compatibility
      collections,
      currentCollection,
      isLoading,
      error,
      // filters,
      pagination,
      
      // Methods
      loadCollections,
      getCollection,
      // updateFilters,
      // clearFilters,
      // goToPage,
      formatForPlayer,
      // resetCache,
      
      // Service access for advanced usage
      service: collectionService
    }), [
      // Dependencies
      initialized,
      collections,
      currentCollection,
      isLoading,
      error,
      // filters,
      pagination,
      sourceDistribution,
      loadCollections,
      getCollection,
      // updateFilters,
      // clearFilters,
      // goToPage,
      formatForPlayer,
      // resetCache,
      collectionService
    ]);
    
    return (
      <CollectionContext.Provider value={contextValue}>
        {children}
      </CollectionContext.Provider>
    );
  };
  
  /**
   * Custom hook to use the collection context
   * @returns {Object} Collection context value
   */
  export const useCollectionContext = () => {
    const context = useContext(CollectionContext);
    if (!context) {
      throw new Error('useCollectionContext must be used within a CollectionProvider');
    }
    return context;
  };
  
  /**
   * Access the collection service directly (for service-to-service integration)
   * @returns {Object|null} Collection service instance
   */
  export const useCollectionService = () => {
    const context = useContext(CollectionContext);
    if (!context) {
      console.warn('useCollectionService called outside of CollectionProvider');
      return null;
    }
    return context.service || context.system?.service;
  };
  
  export default CollectionContext;
  