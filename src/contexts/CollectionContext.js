// src/contexts/CollectionContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import CollectionService from '../services/CollectionService';
import eventBus from '../services/EventBus.js';

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
  // Service reference
  const [collectionService, setCollectionService] = useState(null);
  
  // Collection state
  const [collections, setCollections] = useState([]);
  const [currentCollection, setCurrentCollection] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({});
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
    console.log('[CollectionContext] Initializing CollectionService...');
    
    try {
      const service = new CollectionService({
        enableLogging,
        cacheDuration,
        apiBasePath: '/api'
      });
      
      setCollectionService(service);
      
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
  }, [enableLogging, cacheDuration]);
  
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
        eventBus.emit('collections:loaded', { 
          collections: result.data,
          pagination: result.pagination
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
      eventBus.emit('collections:error', { error: err.message });
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
    loadCollections(1, filtersRef.current);
  }, [filters, loadCollections, collectionService]);
  
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
      eventBus.emit('collection:selected', { collection: result.data });
      
      return result.data;
    } catch (err) {
      console.error(`[CollectionContext] Error loading collection ${id}:`, err);
      
      if (!isMountedRef.current) return null; // Check if still mounted
      
      setError(err.message);
      
      // Publish error event
      eventBus.emit('collection:error', { id, error: err.message });
      
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
      eventBus.emit('collection:formatted', { 
        collectionId: collection.id,
        formatted 
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
