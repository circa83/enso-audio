// src/hooks/useCollection.js
import { useCallback, useMemo, useEffect, useRef } from 'react';
import { useCollectionContext } from '../contexts/CollectionContext';
import { useRouter } from 'next/router';

/**
 * Enhanced hook for browsing and filtering collections
 * Uses the CollectionContext to provide a clean API
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} [options.loadOnMount=true] - Whether to load collections on mount
 * @param {boolean} [options.autoloadFromUrl=true] - Whether to auto-load collection from URL
 * @param {Function} [options.onCollectionLoaded] - Callback when a collection is loaded
 * @returns {Object} Collection data and functions
 */
export function useCollection(options = {}) {
  const {
    loadOnMount = true,
    autoloadFromUrl = true,
    onCollectionLoaded
  } = options;

  // Get collection functionality from context - maintaining the direct destructuring approach
  const {
    // Direct access to state
    collections,
    currentCollection,
    isLoading,
    error,
    pagination,

    // Access to methods
    loadCollections,
    getCollection,
    goToPage,
    formatForPlayer,
    resetCache,

    // Access to service
    service
  } = useCollectionContext();

  // Use router from Next.js
  const router = useRouter();

  // Track if we've already loaded a collection from URL
  const hasLoadedFromUrlRef = useRef(false);

  // Track if we've run the load effect
  const hasEffectRunRef = useRef(false);

  // Auto-detect collection ID from URL if enabled
  useEffect(() => {
    if (autoloadFromUrl && typeof window !== 'undefined' && !hasLoadedFromUrlRef.current && router.isReady) {
      // Get collection ID from URL parameter
      const collectionId = router.query.collection;

      if (collectionId) {
        console.log(`[useCollection] Auto-loading collection from URL: ${collectionId}`);

        // Mark as loaded to prevent duplicate loads
        hasLoadedFromUrlRef.current = true;

        // Load the collection
        getCollection(collectionId)
          .then(collectionData => {
            console.log(`[useCollection] Successfully loaded collection: ${collectionData.name || collectionId}`);

            if (onCollectionLoaded) {
              onCollectionLoaded(collectionData);
            }
          })
          .catch(error => {
            console.error(`[useCollection] Error loading collection: ${error.message}`);

            // Reset flag to allow retry
            hasLoadedFromUrlRef.current = false;
          });
      }
    }
  }, [autoloadFromUrl, getCollection, onCollectionLoaded, router]);

  // Load collections on mount if requested
  useEffect(() => {
    // Only load if loadOnMount is true and we haven't loaded already
    if (loadOnMount && !hasEffectRunRef.current) {
      hasEffectRunRef.current = true;
      loadCollections(1);
    }
  }, [loadOnMount, loadCollections]);

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

    // Use Next.js router for navigation with consistent structured data
    router.push({
      pathname: '/player',
      query: {
        collection: collectionId,
        source: options.source || 'archive',
        action: options.action || 'play'
      }
    });

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
      })
      .catch(error => {
        console.error(`[useCollection] Error selecting collection: ${error.message}`);
      });
  }, [getCollection, formatForPlayer, router]);

  // Return a cleaned and organized API
  return useMemo(() => ({
    // State
    collections,
    currentCollection,
    isLoading,
    error,
    pagination,

    // Functions
    loadCollections,
    getCollection,
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
    pagination,
    loadCollections,
    getCollection,
    goToPage,
    resetCache,
    formatForPlayer,
    service,
    selectCollection
  ]);
}

export default useCollection;
