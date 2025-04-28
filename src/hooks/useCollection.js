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
 * @param {boolean} [options.fetchMissingCollections=true] - Whether to fetch collections by ID when only ID is provided
 * @param {Function} [options.onCollectionLoaded] - Callback when a collection is loaded
 * @returns {Object} Collection data and functions
 */
export function useCollection(options = {}) {
  const {
    loadOnMount = true,
    initialFilters,
    listenForEvents = true,
    autoloadFromUrl = true,
    fetchMissingCollections = true,
    onCollectionLoaded
  } = options;

  // Get collection functionality from context
  const {
    // Direct access to state
    collections,
    currentCollection,
    isLoading,
    error,
    // filters,
    pagination,
    
    // Access to methods
    loadCollections,
    getCollection,
    // updateFilters,
    // clearFilters,
    goToPage,
    formatForPlayer,
    resetCache,
    
    // Access to service
    service
  } = useCollectionContext();

  // Track if we've already loaded a collection from URL
  const hasLoadedFromUrlRef = useRef(false);

  // Track if we've run the load effect
  const hasEffectRunRef = useRef(false);
  
  // Store event handler references to prevent recreation on each render
  const eventHandlersRef = useRef({
    handleCollectionLoaded: null,
    handleCollectionError: null
  });

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
        getCollection(collectionId)
          .then(collectionData => {
            console.log(`[useCollection] Successfully loaded collection: ${collectionData.name || collectionId}`);

            // Emit event for successful load with standardized payload
            eventBus.emit(EVENTS.COLLECTION_LOADED || 'collection:loaded', {
              collectionId,
              collection: collectionData,
              source: 'url',
              timestamp: Date.now()
            });
            
            if (onCollectionLoaded) {
              onCollectionLoaded(collectionData);
            }
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
  }, [autoloadFromUrl, getCollection, onCollectionLoaded]);

  // // Apply initial filters if provided - once only
  // useEffect(() => {
  //   if (initialFilters && Object.keys(initialFilters).length > 0) {
  //     updateFilters(initialFilters);
  //   }
  // }, []); // Empty dependency array to run only once

  // Load collections on mount if requested - with additional guard
  useEffect(() => {
    // Only load if loadOnMount is true and we haven't loaded already
    if (loadOnMount && !hasEffectRunRef.current) {
      hasEffectRunRef.current = true;
      loadCollections(1);
    }
  }, [loadOnMount, loadCollections]);

  // // Listen for collection events - with stable event handlers
  // useEffect(() => {
  //   if (!listenForEvents) return;

  //   // Only create the handlers once to avoid infinite event binding/unbinding
  //   if (!eventHandlersRef.current.handleCollectionLoaded) {
  //     eventHandlersRef.current.handleCollectionLoaded = (data) => {
  //       // Extract collection ID from any payload format
  //       const collectionId = data.collectionId || (data.collection && data.collection.id) || data.id;
        
  //       console.log(`[useCollection] Collection loaded event received for: ${collectionId || 'undefined'}`);
        
  //       // Validate we have a collection ID
  //       if (!collectionId) {
  //         console.warn('[useCollection] Received collection:loaded event with missing or invalid ID', data);
  //         return;
  //       }
        
  //       // If we have the collection data, use it directly
  //       if (data.collection && typeof data.collection === 'object') {
  //         if (onCollectionLoaded) {
  //           onCollectionLoaded(data.collection);
  //         }
  //       } 
  //       // Otherwise, if we only have the ID but not the data,
  //       // and we're supposed to fetch missing collections
  //       else if (fetchMissingCollections) {
  //         // Only fetch if we're not already loading this collection
  //         // and if it's not the current collection
  //         if (!isLoading && (!currentCollection || currentCollection.id !== collectionId)) {
  //           console.log(`[useCollection] Fetching collection data for ID: ${collectionId}`);
  //           getCollection(collectionId).catch(error => {
  //             console.error(`[useCollection] Error loading collection: ${error.message}`);
  //           });
  //         } else {
  //           console.log(`[useCollection] Collection ${collectionId} already loading or current`);
  //         }
  //       }
  //     };
      
  //     eventHandlersRef.current.handleCollectionError = (data) => {
  //       console.error(`[useCollection] Collection error event received:`, data.error);
  //     };
  //   }

  //   // Subscribe to events using the stable handler references
  //   eventBus.on(EVENTS.COLLECTION_LOADED || 'collection:loaded', 
  //     eventHandlersRef.current.handleCollectionLoaded);
  //   eventBus.on(EVENTS.COLLECTION_ERROR || 'collection:error', 
  //     eventHandlersRef.current.handleCollectionError);

  //   return () => {
  //     eventBus.off(EVENTS.COLLECTION_LOADED || 'collection:loaded', 
  //       eventHandlersRef.current.handleCollectionLoaded);
  //     eventBus.off(EVENTS.COLLECTION_ERROR || 'collection:error', 
  //       eventHandlersRef.current.handleCollectionError);
  //   };
  // }, [
  //   listenForEvents, 
  //   isLoading, 
  //   currentCollection, 
  //   getCollection, 
  //   fetchMissingCollections, 
  //   onCollectionLoaded
  // ]);

  /**
   * Select a collection for playback with enhanced buffer integration
   * @param {string} collectionId - ID of collection to select
   * @param {Object} options - Selection options
   */
  const selectCollection = useCallback((collectionId, options = {}) => {
    if (!collectionId) {
      console.error('[useCollection] Cannot select collection: No ID provided');
      return;
    }

    console.log(`[useCollection] Selecting collection: ${collectionId}`);

    // Get the collection data
    getCollection(collectionId)
      .then(collectionData => {
        if (!collectionData) {
          console.error(`[useCollection] Failed to load collection: ${collectionId}`);
          return;
        }
        
        // Format collection for player consumption
        const formattedCollection = formatForPlayer(collectionData);
        
        if (!formattedCollection || !formattedCollection.layers) {
          console.error(`[useCollection] Invalid collection format: ${collectionId}`);
          return;
        }
        
        console.log(`[useCollection] Collection "${formattedCollection.name}" formatted with ${Object.keys(formattedCollection.layers).length} layers`);
        
        // Emit a properly formatted COLLECTION_SELECTED event
        eventBus.emit(EVENTS.COLLECTION_SELECTED || 'collection:selected', {
          collectionId,
          collection: formattedCollection,
          source: options.source || 'collection-hook',
          action: options.action || 'select',
          preloadBuffers: options.preloadBuffers !== false,
          registerWithLayers: options.registerWithLayers !== false,
          timestamp: Date.now()
        });
      })
      .catch(error => {
        console.error(`[useCollection] Error selecting collection: ${error.message}`);
      });
  }, [getCollection, formatForPlayer]);

  // Return a cleaned and organized API
  return useMemo(() => ({
    // State
    collections,
    currentCollection,
    isLoading,
    error,
    // filters,
    pagination,

    // Functions
    loadCollections,
    getCollection,
    // updateFilters,
    // clearFilters,
    goToPage,
    resetCache,

    // Selection functionality
    selectCollection,

    // Helpers
    formatForPlayer,

    // Service access (for advanced usage)
    service
  }), [
    collections,
    currentCollection,
    isLoading,
    error,
    // filters,
    pagination,
    loadCollections,
    getCollection,
    // updateFilters,
    // clearFilters,
    goToPage,
    resetCache,
    formatForPlayer,
    service,
    selectCollection
  ]);
}

export default useCollection;
