// src/contexts/CollectionContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import CollectionService from '../services/CollectionService';
import eventBus, { EVENTS } from '../services/EventBus.js';
import { useAudioContext } from './AudioContext.js';

// Create the context
const CollectionContext = createContext(null);

/**
 * Provider component for collection management
 * Handles fetching, filtering, and selecting audio collections
 */
export const CollectionProvider = ({
  children,
  enableLogging = false,
  initialPageSize = 20,
  cacheDuration = 60000 // 1 minute default
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
  const [filters, setFilters] = useState({});
  const [initialized, setInitialized] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: initialPageSize,
    pages: 0
  });

  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);
  const filtersRef = useRef({});
  const retriesRef = useRef(0);
  const maxRetries = 3;

  // Initialize CollectionService
  useEffect(() => {
    if (!initialized) {
      console.log('[CollectionContext] Waiting for AudioContext to initialize');
      return;
    }

    console.log('[CollectionContext] Initializing CollectionService...');

    try {
      const service = new CollectionService({
        enableLogging,
        cacheDuration,
        apiBasePath: '/api'
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
      return () => {
        isMountedRef.current = false;
      };
    }
  }, [audioInitialized, enableLogging, cacheDuration]);
  // Set mounted ref for cleanup
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load collections with current filters and pagination
  const loadCollections = useCallback(async (page = 1, currentFilters = filtersRef.current) => {
    if (!isMountedRef.current || !collectionService) {
      console.log('[CollectionContext] Component not mounted or service unavailable, skipping load');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log(`[CollectionContext] Loading collections page ${page} with filters:`, currentFilters);

      const result = await collectionService.getCollections({
        ...currentFilters,
        page,
        limit: pagination.limit,
        useCache: true
      });

      if (!isMountedRef.current) return; // Check if still mounted

      if (result.success) {
        console.log(`[CollectionContext] Successfully loaded ${result.data.length} collections (${result.pagination?.total || 0} total)`);
        setCollections(result.data);
        setPagination(result.pagination || {
          total: result.data.length,
          page: 1,
          limit: pagination.limit,
          pages: 1
        });

        // Reset retry counter on success
        retriesRef.current = 0;

        // Publish event through event bus
        eventBus.emit(EVENTS.COLLECTIONS_LOADED || 'collections:loaded', {
          collections: result.data,
          pagination: result.pagination,
          timestamp: Date.now()
        });
      } else {
        throw new Error(result.error || 'Failed to load collections');
      }
    } catch (err) {
      console.error(`[CollectionContext] Error loading collections:`, err);

      if (!isMountedRef.current) return; // Check if still mounted

      // Implement retry logic
      if (retriesRef.current < maxRetries) {
        retriesRef.current++;
        console.log(`[CollectionContext] Retrying (${retriesRef.current}/${maxRetries})...`);

        // Wait a moment before retrying (exponential backoff)
        const delay = Math.pow(2, retriesRef.current) * 500;
        setTimeout(() => {
          if (isMountedRef.current) {
            loadCollections(page, currentFilters);
          }
        }, delay);

        return;
      }

      setError(err.message);

      // Publish error event
      eventBus.emit(EVENTS.COLLECTIONS_ERROR || 'collections:error', {
        error: err.message,
        timestamp: Date.now()
      });
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [collectionService, pagination.limit]);

  // Update filters and reload collections
  const updateFilters = useCallback((newFilters) => {
    console.log(`[CollectionContext] Updating filters:`, newFilters);
    setFilters(prev => {
      const updated = { ...prev, ...newFilters };
      filtersRef.current = updated; // Update the ref
      return updated;
    });
  }, []);

  // Navigate to a specific page
  const goToPage = useCallback((pageNumber) => {
    if (pageNumber < 1 || pageNumber > pagination.pages) {
      console.warn(`[CollectionContext] Invalid page number: ${pageNumber}`);
      return;
    }

    console.log(`[CollectionContext] Navigating to page ${pageNumber}`);
    loadCollections(pageNumber, filtersRef.current);
  }, [pagination.pages, loadCollections]);

  // Clear all filters and reload
  const clearFilters = useCallback(() => {
    console.log(`[CollectionContext] Clearing all filters`);
    setFilters({});
    filtersRef.current = {};

    // Reload from page 1 with empty filters
    loadCollections(1, {});
  }, [loadCollections]);


  // Effect to handle filter changes
  useEffect(() => {
    if (!isMountedRef.current || !collectionService) return;

    console.log(`[CollectionContext] Filters changed, reloading collections from page 1`);

    // Use the ref to get current filters
    const currentFilters = filtersRef.current;

    // Define a function inside the effect to avoid the dependency cycle
    const loadCurrentCollections = async () => {
      if (!isMountedRef.current || !collectionService) {
        console.log('[CollectionContext] Component not mounted or service unavailable, skipping load');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        console.log(`[CollectionContext] Loading collections page 1 with filters:`, currentFilters);

        const result = await collectionService.getCollections({
          ...currentFilters,
          page: 1,
          limit: pagination.limit,
          useCache: true
        });

        if (!isMountedRef.current) return; // Check if still mounted

        if (result.success) {
          console.log(`[CollectionContext] Successfully loaded ${result.data.length} collections (${result.pagination?.total || 0} total)`);
          setCollections(result.data);
          setPagination(result.pagination || {
            total: result.data.length,
            page: 1,
            limit: pagination.limit,
            pages: 1
          });

          // Reset retry counter on success
          retriesRef.current = 0;

          // Publish event through event bus
          eventBus.emit(EVENTS.COLLECTIONS_LOADED || 'collections:loaded', {
            collections: result.data,
            pagination: result.pagination,
            timestamp: Date.now()
          });
        } else {
          throw new Error(result.error || 'Failed to load collections');
        }
      } catch (err) {
        console.error(`[CollectionContext] Error loading collections:`, err);

        if (!isMountedRef.current) return;

        setError(err.message);

        // Publish error event
        eventBus.emit(EVENTS.COLLECTIONS_ERROR || 'collections:error', {
          error: err.message,
          timestamp: Date.now()
        });
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    // Execute the function
    loadCurrentCollections();

    // No cleanup needed for this effect
  }, [filters, collectionService, pagination.limit]); // Remove loadCollections from dependencies


  // Load a specific collection by ID
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

      console.log(`[CollectionContext] Successfully loaded collection: ${result.data.name}`);

      // Store as current collection
      setCurrentCollection(result.data);

      // Publish event through event bus
      eventBus.emit(EVENTS.COLLECTION_SELECTED || 'collection:selected', {
        collection: result.data,
        timestamp: Date.now()
      });

      return result.data;
    } catch (err) {
      console.error(`[CollectionContext] Error loading collection ${id}:`, err);

      if (!isMountedRef.current) return null; // Check if still mounted

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

  // Reset collection cache
  const resetCache = useCallback(() => {
    if (!collectionService) {
      console.error('[CollectionContext] Service unavailable, cannot reset cache');
      return;
    }

    console.log('[CollectionContext] Resetting collection cache');
    collectionService.resetCache();

    // Reload collections
    loadCollections(1, filtersRef.current);
  }, [collectionService, loadCollections]);

  // Handle Collection Selection
  useEffect(() => {
    // Handle collection selection events from throughout the app
    const handleCollectionSelected = async (data) => {
      if (!data || !data.collectionId) {
        console.warn('[CollectionContext] Received malformed collection selection event', data);
        return;
      }

      console.log(`[CollectionContext] Collection selected: ${data.collectionId} from ${data.source}`);

      try {
        // Start loading the collection immediately
        setIsLoading(true);
        setError(null);

        // Emit loading event
        eventBus.emit(EVENTS.COLLECTION_LOADING, {
          collectionId: data.collectionId,
          source: data.source,
          timestamp: Date.now()
        });

        // Load the collection data
        const result = await getCollection(data.collectionId);

        if (!isMountedRef.current) return; // Check if still mounted

        if (result && result.success) {
          setCurrentCollection(result.data);

          // Emit loaded event to trigger buffer loading
          eventBus.emit(EVENTS.COLLECTION_LOADED, {
            collectionId: data.collectionId,
            collection: result.data,
            source: data.source || 'unknown',
            timestamp: Date.now()
          });
        } else {
          throw new Error(result?.error || 'Failed to load collection');
        }
      } catch (err) {
        console.error(`[CollectionContext] Error handling collection selection:`, err);

        if (!isMountedRef.current) return; // Check if still mounted

        setError(err.message);

        // Emit error event
        eventBus.emit(EVENTS.COLLECTION_ERROR, {
          collectionId: data.collectionId,
          error: err.message,
          source: data.source,
          timestamp: Date.now()
        });
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    // Subscribe to collection selection events
    eventBus.on(EVENTS.COLLECTION_SELECTED, handleCollectionSelected);

    // Clean up event listener on unmount
    return () => {
      eventBus.off(EVENTS.COLLECTION_SELECTED, handleCollectionSelected);
    };
  }, [getCollection]); // Depend on getCollection to ensure we're using the latest version


  // Create memoized context value
  const contextValue = useMemo(() => ({
    // State
    collections,
    currentCollection,
    isLoading,
    error,
    filters,
    pagination,

    // Methods
    loadCollections,
    getCollection,
    updateFilters,
    clearFilters,
    goToPage,
    formatForPlayer,
    resetCache,

    // Service access for advanced usage
    service: collectionService
  }), [
    collections,
    currentCollection,
    isLoading,
    error,
    filters,
    pagination,
    loadCollections,
    getCollection,
    updateFilters,
    clearFilters,
    goToPage,
    formatForPlayer,
    resetCache,
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
  return context.service;
};

export default CollectionContext;
