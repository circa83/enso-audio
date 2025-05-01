// src/hooks/useCollections.js
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import CollectionService from '../services/CollectionService';

/**
 * Enhanced hook for browsing and filtering collections
 * Provides improved logging and UI integration
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} [options.loadOnMount=true] - Whether to load collections on mount
 * @param {Object} [options.filters] - Initial filters to apply
 * @param {number} [options.pageSize=20] - Number of items per page
 * @returns {Object} Collection data and functions
 */
export function useCollections(options = {}) {
  const {
    loadOnMount = true,
    filters: initialFilters = {},
    pageSize = 20
  } = options;

  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: pageSize,
    pages: 0
  });

  // Use refs to track state without causing re-renders
  const filtersRef = useRef(initialFilters);
  const isMountedRef = useRef(false);
  const retriesRef = useRef(0);
  const maxRetries = 3;

  const collectionService = useMemo(() => new CollectionService({
    enableLogging: true
  }), []);

  /**
   * Load collections with current filters and pagination
   * Includes retry logic for better reliability
   */
  const loadCollections = useCallback(async (page = 1, currentFilters = filtersRef.current) => {
    if (!isMountedRef.current) {
      console.log('[useCollections] Component not mounted, skipping load');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log(`[useCollections] Loading collections`);

      const result = await collectionService.getCollections({
        page,
        limit: pageSize,
        useCache: true
      });

      if (result.success) {
        console.log(`[useCollections] Successfully loaded ${result.data.length} collections (${result.pagination?.total || 0} total)`);
        setCollections(result.data);
        setPagination(result.pagination || {
          total: result.data.length,
          page: 1,
          limit: pageSize,
          pages: 1
        });

        // Reset retry counter on success
        retriesRef.current = 0;
      } else {
        throw new Error(result.error || 'Failed to load collections');
      }
    } catch (err) {
      console.error(`[useCollections] Error loading collections:`, err);

      // Implement retry logic
      if (retriesRef.current < maxRetries) {
        retriesRef.current++;
        console.log(`[useCollections] Retrying (${retriesRef.current}/${maxRetries})...`);

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
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [collectionService, pageSize]);


  /**
   * Navigate to a specific page
   */
  const goToPage = useCallback((pageNumber) => {
    if (pageNumber < 1 || pageNumber > pagination.pages) {
      console.warn(`[useCollections] Invalid page number: ${pageNumber}`);
      return;
    }

    console.log(`[useCollections] Navigating to page ${pageNumber}`);
    loadCollections(pageNumber, filtersRef.current);
  }, [pagination.pages, loadCollections]);


  // Effect to handle initial load
  useEffect(() => {
    console.log('[useCollections] Component mounted');
    isMountedRef.current = true;

    if (loadOnMount) {
      console.log(`[useCollections] Initial load on mount`);
      loadCollections(1, filtersRef.current);
    }

    return () => {
      console.log('[useCollections] Component unmounting');
      isMountedRef.current = false;
    };
  }, [loadOnMount, loadCollections]);

  /**
   * Load a specific collection by ID
   * Includes detailed error handling
   */
  const getCollection = useCallback(async (id) => {
    if (!id) {
      console.error('[useCollections] Collection ID is required');
      throw new Error('Collection ID is required');
    }

    try {
      console.log(`[useCollections] Loading collection: ${id}`);
      setIsLoading(true);

      const result = await collectionService.getCollection(id);

      if (!result.success) {
        throw new Error(result.error || `Collection ${id} not found`);
      }

      console.log(`[useCollections] Successfully loaded collection: ${result.data.name}`);
      return result.data;
    } catch (err) {
      console.error(`[useCollections] Error loading collection ${id}:`, err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [collectionService]);

  return {
    // Data
    collections,
    isLoading,
    error,

    pagination,

    // Functions

    loadCollections,
    getCollection,
    goToPage,

    // Service access (for advanced usage)
    collectionService
  };
}

export default useCollections;