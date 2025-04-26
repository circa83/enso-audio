// src/hooks/useCollection.js
import { useCallback, useMemo, useEffect, useRef } from 'react';
import { useCollectionContext } from '../contexts/CollectionContext';
import eventBus, { EVENTS } from '../services/EventBus';

/**
 * Enhanced hook for browsing and filtering collections
 * Uses the CollectionContext to provide a clean API
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} [options.loadOnMount=true] - Whether to load collections on mount
 * @param {Object} [options.initialFilters] - Initial filters to apply
 * @param {boolean} [options.listenForEvents=true] - Whether to listen for collection events
* @param {boolean} [options.autoloadFromUrl=true] - Whether to auto-load collection from URL
 * @returns {Object} Collection data and functions
 */
export function useCollection(options = {}) {
  const {
    loadOnMount = true,
    initialFilters,
    listenForEvents = true,
    autoloadFromUrl = true
  } = options;
  
  // Get collection functionality from context
  const collection = useCollectionContext();

   // Track if we've already loaded a collection from URL
   const hasLoadedFromUrlRef = useRef(false);

    // Auto-detect collection ID from URL if enabled
  useEffect(() => {
    if (autoloadFromUrl && typeof window !== 'undefined' && !hasLoadedFromUrlRef.current) {
      // Get collection ID from URL parameter
      const urlParams = new URLSearchParams(window.location.search);
      const collectionId = urlParams.get('collection');
      
      if (collectionId) {
        console.log(`[useCollection] Auto-loading collection from URL: ${collectionId}`);
        
        // Mark as loaded to prevent duplicate loads
        hasLoadedFromUrlRef.current = true;
        
        // Emit event before loading
        eventBus.emit(EVENTS.COLLECTION_LOADING || 'collection:loading', {
          collectionId,
          source: 'url',
          timestamp: Date.now()
        });
        
        // Load the collection
        collection.getCollection(collectionId)
          .then(collectionData => {
            console.log(`[useCollection] Successfully loaded collection: ${collectionData.name || collectionId}`);
            
            // Emit event for successful load
            eventBus.emit(EVENTS.COLLECTION_LOADED || 'collection:loaded', {
              collectionId,
              collection: collectionData,
              source: 'url',
              timestamp: Date.now()
            });
          })
          .catch(error => {
            console.error(`[useCollection] Error loading collection: ${error.message}`);
            
            // Reset flag to allow retry
            hasLoadedFromUrlRef.current = false;
            
            // Emit error event
            eventBus.emit(EVENTS.COLLECTION_ERROR || 'collection:error', {
              collectionId,
              error: error.message,
              source: 'url',
              timestamp: Date.now()
            });
          });
      }
    }
  }, [autoloadFromUrl, collection]);
  
  // Apply initial filters if provided
  useEffect(() => {
    if (initialFilters && Object.keys(initialFilters).length > 0) {
      collection.updateFilters(initialFilters);
    }
  }, [initialFilters, collection]);
  
  // Load collections on mount if requested
  useEffect(() => {
    if (loadOnMount) {
      collection.loadCollections(1);
    }
  }, [loadOnMount, collection]);
  
  // Listen for collection selection events if enabled
  useEffect(() => {
    if (!listenForEvents) return;
    
    const handleCollectionLoaded = (data) => {
      console.log(`[useCollection] Collection loaded event received for: ${data.collectionId}`);
      // Components using this hook can react to collection loading
      // without having to implement their own event listeners
    };
    
    const handleCollectionError = (data) => {
      console.error(`[useCollection] Collection error event received:`, data.error);
      // Components can react to collection errors
    };
    
    // Subscribe to events
    eventBus.on(EVENTS.COLLECTION_LOADED, handleCollectionLoaded);
    eventBus.on(EVENTS.COLLECTION_ERROR, handleCollectionError);
    
    return () => {
      eventBus.off(EVENTS.COLLECTION_LOADED, handleCollectionLoaded);
      eventBus.off(EVENTS.COLLECTION_ERROR, handleCollectionError);
    };
  }, [listenForEvents]);
  
  /**
   * Select a collection for playback
   * @param {string} collectionId - ID of collection to select
   * @param {Object} options - Selection options
   */
  const selectCollection = useCallback((collectionId, options = {}) => {
    if (!collectionId) {
      console.error('[useCollection] Cannot select collection: No ID provided');
      return;
    }
    
    console.log(`[useCollection] Selecting collection: ${collectionId}`);
    
    // Emit selection event
    eventBus.emit(EVENTS.COLLECTION_SELECTED, {
      collectionId,
      source: options.source || 'hook',
      action: options.action || 'select',
      timestamp: Date.now()
    });
    
    // Optionally handle navigation if requested
    if (options.navigate && typeof window !== 'undefined') {
      const query = new URLSearchParams({
        collection: collectionId,
        ...options.queryParams
      }).toString();
      
      window.location.href = `/player?${query}`;
    }
  }, []);
  
  // Return a cleaned and organized API
  return useMemo(() => ({
    // State
    collections: collection.collections,
    currentCollection: collection.currentCollection,
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
    
    // Selection functionality
    selectCollection,
    
    // Helpers
    formatForPlayer: collection.formatForPlayer,
    
    // Service access (for advanced usage)
    service: collection.service
  }), [
    collection.collections,
    collection.currentCollection,
    collection.isLoading,
    collection.error,
    collection.filters,
    collection.pagination,
    collection.loadCollections,
    collection.getCollection,
    collection.updateFilters,
    collection.clearFilters,
    collection.goToPage,
    collection.resetCache,
    collection.formatForPlayer,
    collection.service,
    selectCollection
  ]);
}

export default useCollection;
