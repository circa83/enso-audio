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
  cacheDuration = 60000, // 1 minute default
  enableLocalStorage = true,
  localStorageKey = 'enso_collections'
}) => {
  // Add check for audio context
  const { audioContext, initialized: audioInitialized } = useAudioContext();
  
  // Service reference
  const [collectionService, setCollectionService] = useState(null);

  // Collection state
  const [collections, setCollections] = useState([]);
  const [localCollections, setLocalCollections] = useState([]);
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

  // Source distribution (how many collections from each source)
  const [sourceDistribution, setSourceDistribution] = useState({
    blob: 0,
    local: 0,
    localFolder: 0
  });

  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);
  const filtersRef = useRef({});
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
        localStorageKey
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

  // Load collections with current filters and pagination
  const loadCollections = useCallback(async (page = 1, currentFilters = filtersRef.current, source = 'all') => {
    if (!isMountedRef.current || !collectionService) {
      console.log('[CollectionContext] Component not mounted or service unavailable, skipping load');
      return;
    }

     // Add flag to prevent multiple simultaneous requests
  if (isLoading) {
    console.log('[CollectionContext] Already loading collections, skipping duplicate request');
    return;
  }

    try {
      setIsLoading(true);
      setError(null);

      console.log(`[CollectionContext] Loading collections page ${page} from source ${source} with filters:`, currentFilters);

      const result = await collectionService.getCollections({
        ...currentFilters,
        page,
        limit: pagination.limit,
        useCache: true,
        source
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

        // Update source distribution when available
        if (result.sources) {
          setSourceDistribution(result.sources);
        }

        // Reset retry counter on success
        retriesRef.current = 0;

        // Publish event through event bus
        eventBus.emit(EVENTS.COLLECTION_LOADED || 'collections:loaded', {
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

        // Implement retry logic - but don't retry missing local folder collections
    if (retriesRef.current < maxRetries && 
        !err.message.includes('collections index') && 
        !err.message.includes('404')) {
      retriesRef.current++;
      console.log(`[CollectionContext] Retrying (${retriesRef.current}/${maxRetries})...`);
        // Wait a moment before retrying (exponential backoff)
        const delay = Math.pow(2, retriesRef.current) * 500;
        setTimeout(() => {
          if (isMountedRef.current) {
            loadCollections(page, currentFilters, source);
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
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [collectionService, pagination.limit, isLoading]);

  // Load local collections
  const loadLocalCollections = useCallback(async () => {
    if (!collectionService || !isMountedRef.current) return;

    try {
      setIsLoading(true);
      
      // Use the service's local source handler
      const sourceCollections = await collectionService.sourceHandlers.local.getCollections();
      
      if (!isMountedRef.current) return;
      
      setLocalCollections(sourceCollections);
      console.log(`[CollectionContext] Loaded ${sourceCollections.length} local collections`);
      
      return sourceCollections;
    } catch (error) {
      console.error('[CollectionContext] Error loading local collections:', error);
      if (isMountedRef.current) {
        setError(error.message);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [collectionService]);

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
    if (!isMountedRef.current || !collectionService || !initialized) return;

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

          // Update source distribution when available
          if (result.sources) {
            setSourceDistribution(result.sources);
          }

          // Reset retry counter on success
          retriesRef.current = 0;

          // Publish event through event bus
          eventBus.emit(EVENTS.COLLECTION_LOADED || 'collections:loaded', {
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
        eventBus.emit(EVENTS.COLLECTION_ERROR || 'collections:error', {
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
  }, [filters, collectionService, pagination.limit, initialized]);

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

      console.log(`[CollectionContext] Successfully loaded collection: ${result.data.name} from source: ${result.source || 'unknown'}`);

      // Store as current collection
      setCurrentCollection(result.data);

      // Publish event through event bus
      eventBus.emit(EVENTS.COLLECTION_SELECTED || 'collection:selected', {
        collectionId: result.data.id,
        collection: result.data,
        source: result.source || 'api',
        format: result.data.format || 'standard',
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

  // Create a new collection in local storage
  const createCollection = useCallback((data) => {
    if (!collectionService) {
      console.error('[CollectionContext] Service unavailable, cannot create collection');
      return { success: false, error: 'Service unavailable' };
    }

    try {
      console.log('[CollectionContext] Creating new collection:', data.name);
      const result = collectionService.createCollection(data);
      if (result.success) {
        console.log('[CollectionContext] Collection created successfully:', result.data.id);
        
        // Update local collections list
        loadLocalCollections();
        
        return result;
      } else {
        throw new Error(result.error || 'Failed to create collection');
      }
    } catch (err) {
      console.error(`[CollectionContext] Error creating collection:`, err);
      setError(err.message);
      
      return { success: false, error: err.message };
    }
  }, [collectionService, loadLocalCollections]);

  // Update an existing collection
  const updateCollection = useCallback((id, updates) => {
    if (!collectionService) {
      console.error('[CollectionContext] Service unavailable, cannot update collection');
      return { success: false, error: 'Service unavailable' };
    }

    try {
      console.log(`[CollectionContext] Updating collection: ${id}`);
      const result = collectionService.updateCollection(id, updates);
      
      if (result.success) {
        console.log('[CollectionContext] Collection updated successfully');
        
        // If this is the current collection, update it
        if (currentCollection && currentCollection.id === id) {
          setCurrentCollection(result.data);
        }
        
        // Update local collections list
        loadLocalCollections();
        
        return result;
      } else {
        throw new Error(result.error || 'Failed to update collection');
      }
    } catch (err) {
      console.error(`[CollectionContext] Error updating collection:`, err);
      setError(err.message);
      
      return { success: false, error: err.message };
    }
  }, [collectionService, currentCollection, loadLocalCollections]);

  // Remove (delete) a collection
  const removeCollection = useCallback((id) => {
    if (!collectionService) {
      console.error('[CollectionContext] Service unavailable, cannot remove collection');
      return { success: false, error: 'Service unavailable' };
    }

    try {
      console.log(`[CollectionContext] Removing collection: ${id}`);
      const result = collectionService.removeLocalCollection(id);
      
      if (result) {
        console.log('[CollectionContext] Collection removed successfully');
        
        // If this was the current collection, clear it
        if (currentCollection && currentCollection.id === id) {
          setCurrentCollection(null);
        }
        
        // Update local collections list
        loadLocalCollections();
        
        // Also update main collections list if needed
        loadCollections(pagination.page, filtersRef.current);
        
        return { success: true };
      } else {
        throw new Error('Failed to remove collection');
      }
    } catch (err) {
      console.error(`[CollectionContext] Error removing collection:`, err);
      setError(err.message);
      
      return { success: false, error: err.message };
    }
  }, [collectionService, currentCollection, loadLocalCollections, loadCollections, pagination.page]);

  // Add a track to a collection
  const addTrackToCollection = useCallback((collectionId, track) => {
    if (!collectionService) {
      console.error('[CollectionContext] Service unavailable, cannot add track');
      return { success: false, error: 'Service unavailable' };
    }

    try {
      console.log(`[CollectionContext] Adding track to collection: ${collectionId}`);
      const result = collectionService.addTrackToCollection(collectionId, track);
      
      if (result.success) {
        console.log('[CollectionContext] Track added successfully');
        
        // If this is the current collection, reload it to get updated tracks
        if (currentCollection && currentCollection.id === collectionId) {
          getCollection(collectionId);
        }
        
        // Update local collections list
        loadLocalCollections();
        
        return result;
      } else {
        throw new Error(result.error || 'Failed to add track');
      }
    } catch (err) {
      console.error(`[CollectionContext] Error adding track:`, err);
      setError(err.message);
      
      return { success: false, error: err.message };
    }
  }, [collectionService, currentCollection, getCollection, loadLocalCollections]);

  // Remove a track from a collection
  const removeTrackFromCollection = useCallback((collectionId, trackId) => {
    if (!collectionService) {
      console.error('[CollectionContext] Service unavailable, cannot remove track');
      return { success: false, error: 'Service unavailable' };
    }

    try {
      console.log(`[CollectionContext] Removing track ${trackId} from collection: ${collectionId}`);
      const result = collectionService.removeTrackFromCollection(collectionId, trackId);
      
      if (result.success) {
        console.log('[CollectionContext] Track removed successfully');
        
        // If this is the current collection, reload it to get updated tracks
        if (currentCollection && currentCollection.id === collectionId) {
          getCollection(collectionId);
        }
        
        // Update local collections list
        loadLocalCollections();
        
        return result;
      } else {
        throw new Error(result.error || 'Failed to remove track');
      }
    } catch (err) {
      console.error(`[CollectionContext] Error removing track:`, err);
      setError(err.message);
      
      return { success: false, error: err.message };
    }
  }, [collectionService, currentCollection, getCollection, loadLocalCollections]);

  // Export a collection to JSON
  const exportCollection = useCallback((id) => {
    if (!collectionService) {
      console.error('[CollectionContext] Service unavailable, cannot export collection');
      return { success: false, error: 'Service unavailable' };
    }

    try {
      console.log(`[CollectionContext] Exporting collection: ${id}`);
      return collectionService.exportCollection(id);
    } catch (err) {
      console.error(`[CollectionContext] Error exporting collection:`, err);
      setError(err.message);
      
      return { success: false, error: err.message };
    }
  }, [collectionService]);

  // Import a collection from JSON
  const importCollection = useCallback((data) => {
    if (!collectionService) {
      console.error('[CollectionContext] Service unavailable, cannot import collection');
      return { success: false, error: 'Service unavailable' };
    }

    try {
      console.log('[CollectionContext] Importing collection');
      const result = collectionService.importCollection(data);
      
      if (result.success) {
        console.log('[CollectionContext] Collection imported successfully:', result.data.id);
        
        // Update local collections list
        loadLocalCollections();
        
        return result;
      } else {
        throw new Error(result.error || 'Failed to import collection');
      }
    } catch (err) {
      console.error(`[CollectionContext] Error importing collection:`, err);
      setError(err.message);
      
      return { success: false, error: err.message };
    }
  }, [collectionService, loadLocalCollections]);

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

  // Load initial data when service is initialized
  useEffect(() => {
    if (collectionService && initialized && !isLoading) {
      console.log('[CollectionContext] Service initialized, loading initial data');
      
      // Load collections first time
      loadCollections(1, filtersRef.current);
      
      // Load local collections
      loadLocalCollections();
    }
  }, [collectionService, initialized, isLoading, loadCollections, loadLocalCollections]);

  // Subscribe to relevant events from EventBus
  useEffect(() => {
    if (!initialized) return;
    
    const handleCollectionChange = () => {
      // Reload collections to get latest data
      loadLocalCollections();
    };
    
    // Subscribe to events
    eventBus.on('collection:created', handleCollectionChange);
    eventBus.on('collection:updated', handleCollectionChange);
    eventBus.on('collection:deleted', handleCollectionChange);
    eventBus.on('collection:imported', handleCollectionChange);
    
    // Cleanup
    return () => {
      eventBus.off('collection:created', handleCollectionChange);
      eventBus.off('collection:updated', handleCollectionChange);
      eventBus.off('collection:deleted', handleCollectionChange);
      eventBus.off('collection:imported', handleCollectionChange);
    };
  }, [initialized, loadLocalCollections]);

  // Create memoized context value
  // Create memoized context value with explicit grouping
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
      localCollections,
      currentCollection,
      pagination,
      sourceDistribution,
      filters
    },
    
    // Collection list operations
    list: {
      loadCollections,
      updateFilters,
      clearFilters,
      goToPage,
      resetCache
    },
    
    // Single collection operations
    collection: {
      get: getCollection,
      format: formatForPlayer
    },
    
    // Local collection management
    local: {
      load: loadLocalCollections,
      create: createCollection,
      update: updateCollection,
      remove: removeCollection,
      addTrack: addTrackToCollection,
      removeTrack: removeTrackFromCollection
    },
    
    // Import/Export functionality
    transfer: {
      export: exportCollection,
      import: importCollection
    },
    
    // Legacy flat API for backward compatibility
    loadCollections,
    getCollection,
    updateFilters,
    clearFilters,
    goToPage,
    formatForPlayer,
    resetCache,
    loadLocalCollections,
    createCollection,
    updateCollection,
    removeCollection,
    addTrackToCollection,
    removeTrackFromCollection,
    exportCollection,
    importCollection
  }), [
    // Dependencies remain the same
    initialized,
    collections,
    localCollections,
    currentCollection,
    isLoading,
    error,
    filters,
    pagination,
    sourceDistribution,
    loadCollections,
    getCollection,
    updateFilters,
    clearFilters,
    goToPage,
    formatForPlayer,
    resetCache,
    loadLocalCollections,
    createCollection,
    updateCollection,
    removeCollection,
    addTrackToCollection,
    removeTrackFromCollection,
    exportCollection,
    importCollection,
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
