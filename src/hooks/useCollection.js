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

    // Track if we've run the load effect
  const hasEffectRunRef = useRef(false);

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
        collection.collection.get(collectionId)
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
      collection.list.updateFilters(initialFilters);
    }
  }, [initialFilters, collection]);
  
 // Load collections on mount if requested - with additional guard
useEffect(() => {
  // Only load if:
  // 1. loadOnMount is true
  // 2. Not already loading
  // 3. No error exists (prevent reload loops on error)
  // 4. Component is mounted
  const canLoad = 
    loadOnMount && 
    !collection.system.isLoading && 
    !collection.system.error &&
    hasEffectRunRef.current === false;
    
  if (canLoad) {
    hasEffectRunRef.current = true;
    collection.list.loadCollections(1);
  }
}, [loadOnMount, collection.system.isLoading, collection.system.error, collection]);
  
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
    collections: collection.data.collections,
    currentCollection: collection.data.currentCollection,
    isLoading: collection.system.isLoading,
    error: collection.system.error,
    filters: collection.data.filters,
    pagination: collection.data.pagination,
    
    // Functions
    loadCollections: collection.list.loadCollections,
    getCollection: collection.collection.get,
    updateFilters: collection.list.updateFilters,
    clearFilters: collection.list.clearFilters,
    goToPage: collection.list.goToPage,
    resetCache: collection.list.resetCache,
    
    // Selection functionality
    selectCollection,
    
    // Helpers
    formatForPlayer: collection.collection.format,
    
    // Service access (for advanced usage)
    service: collection.system.service
  }), [
    collection.data.collections,
    collection.data.currentCollection,
    collection.system.isLoading,
    collection.system.error,
    collection.data.filters,
    collection.data.pagination,
    collection.list.loadCollections,
    collection.collection.get,
    collection.list.updateFilters,
    collection.list.clearFilters,
    collection.list.goToPage,
    collection.list.resetCache,
    collection.collection.format,
    collection.system.service,
    selectCollection
  ]);
}

export default useCollection;
