// src/hooks/useCollection.js
import { useCallback, useMemo } from 'react';
import { useCollectionContext } from '../contexts/CollectionContext';

/**
 * Enhanced hook for browsing and filtering collections
 * Uses the CollectionContext to provide a clean API
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} [options.loadOnMount=true] - Whether to load collections on mount
 * @param {Object} [options.initialFilters] - Initial filters to apply
 * @returns {Object} Collection data and functions
 */
export function useCollection(options = {}) {
  const {
    loadOnMount = true,
    initialFilters
  } = options;
  
  // Get collection functionality from context
  const collection = useCollectionContext();
  
  // If initial filters provided, apply them
  useCallback(() => {
    if (initialFilters && Object.keys(initialFilters).length > 0) {
      collection.updateFilters(initialFilters);
    }
  }, [initialFilters, collection]);
  
  // Load collections on mount if requested
  useCallback(() => {
    if (loadOnMount) {
      collection.loadCollections(1);
    }
  }, [loadOnMount, collection]);
  
  // Return a cleaned and organized API
  return useMemo(() => ({
    // State
    collections: collection.collections,
    isLoading: collection.isLoading,
    error: collection.error,
    filters: collection.filters,
    pagination: collection.pagination,
    
    // Functions
    loadCollections: collection.loadCollections,
    getCollection: collection.getCollection,
    updateFilters: collection.updateFilters,
    clearFilters: collection.clearFilters,
    goToPage: collection.goToPage,
    resetCache: collection.resetCache,
    
    // Helpers
    formatForPlayer: collection.formatForPlayer,
    
    // Service access (for advanced usage)
    service: collection.service
  }), [collection]);
}

export default useCollection;
