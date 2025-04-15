// src/hooks/useCollections.js
import { useState, useEffect, useCallback, useRef } from 'react';
import CollectionService from '../services/CollectionService';

/**
 * Hook for browsing and filtering collections
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} [options.loadOnMount=true] - Whether to load collections on mount
 * @param {Object} [options.filters] - Initial filters to apply
 * @returns {Object} Collection data and functions
 */
export function useCollections(options = {}) {
  const {
    loadOnMount = true,
    filters: initialFilters = {}
  } = options;
  
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    pages: 0
  });
  
  // Use a ref to track current filters without causing re-renders
  const filtersRef = useRef(initialFilters);
  const isMountedRef = useRef(false);
  
  const collectionService = new CollectionService({
    enableLogging: true
  });
  
  // Load collections with current filters
  const loadCollections = useCallback(async (page = 1, currentFilters = filtersRef.current) => {
    if (!isMountedRef.current) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`[useCollections] Loading collections with filters:`, currentFilters);
      
      const result = await collectionService.getCollections({
        ...currentFilters,
        page,
        useCache: true
      });
      
      if (result.success) {
        setCollections(result.data);
        setPagination(result.pagination || {
          total: result.data.length,
          page: 1,
          limit: result.data.length,
          pages: 1
        });
      } else {
        throw new Error(result.error || 'Failed to load collections');
      }
    } catch (err) {
      console.error('[useCollections] Error loading collections:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty dependency array since we're using refs
  
  // Update filters and reload collections
  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => {
      const updated = { ...prev, ...newFilters };
      filtersRef.current = updated; // Update the ref
      return updated;
    });
  }, []);
  
  // Effect to handle filter changes
  useEffect(() => {
    if (!isMountedRef.current) return;
    loadCollections(1, filtersRef.current);
  }, [filters, loadCollections]);
  
  // Effect to handle initial load
  useEffect(() => {
    isMountedRef.current = true;
    
    if (loadOnMount) {
      loadCollections(1, filtersRef.current);
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [loadOnMount, loadCollections]);
  
  // Load a specific collection by ID
  const getCollection = useCallback(async (id) => {
    try {
      console.log(`[useCollections] Loading collection: ${id}`);
      
      const result = await collectionService.getCollection(id);
      
      if (!result.success) {
        throw new Error(result.error || `Collection ${id} not found`);
      }
      
      return result.data;
    } catch (err) {
      console.error(`[useCollections] Error loading collection ${id}:`, err);
      throw err;
    }
  }, [collectionService]);
  
  return {
    collections,
    isLoading,
    error,
    filters,
    pagination,
    updateFilters,
    loadCollections,
    getCollection
  };
}

export default useCollections;