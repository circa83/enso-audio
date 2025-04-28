import { useEffect, useContext } from 'react';
import { useCollectionContext } from '../../contexts/CollectionContext';
import eventBus, { EVENTS } from '../../services/EventBus';

/**
 * CollectionEventHandler
 * 
 * Centralizes the handling of collection-related events from EventBus.
 * Listens to events emitted by CollectionService and updates app state accordingly.
 */
const CollectionEventHandler = () => {
  // Get collection context to update state based on events
  const { 
    setIsLoading, 
    setError, 
    setCollections, 
    setCurrentCollection,
    formatForPlayer,
    service: collectionService
  } = useCollectionContext();

  useEffect(() => {
    // Store all event unsubscribers for cleanup
    const unsubscribers = [];
    
    console.log('[CollectionEventHandler] Initializing collection event handlers');
    
    // Helper function to subscribe to events and store unsubscribe function
    const subscribe = (event, handler) => {
      const unsubscribe = eventBus.on(event, handler);
      unsubscribers.push(unsubscribe);
      return unsubscribe;
    };

    // ========== COLLECTIONS LIST EVENTS ==========
    
    // Collections loading started
    subscribe(EVENTS.COLLECTIONS_LOAD_START || 'collections:loadStart', (data) => {
      console.log('[CollectionEventHandler] Collections loading started', data);
      setIsLoading?.(true);
    });
    
    // Collections successfully loaded
    subscribe(EVENTS.COLLECTIONS_LOADED || 'collections:loaded', (data) => {
      console.log('[CollectionEventHandler] Collections loaded:', 
        data.count || 'unknown count', 
        'total:', data.total || 'unknown total');
      
      setIsLoading?.(false);
      
      // If we have collection data, update state
      if (data.collections) {
        setCollections?.(data.collections);
      }
      
      // When the payload doesn't include collections directly (like from CollectionService)
      // but includes a data property
      if (!data.collections && data.data && Array.isArray(data.data)) {
        setCollections?.(data.data);
      }
    });
    
    // Collections loading error
    subscribe(EVENTS.COLLECTIONS_ERROR || 'collections:error', (data) => {
      console.error('[CollectionEventHandler] Collections error:', data.error);
      setIsLoading?.(false);
      setError?.(data.error || 'Unknown error loading collections');
    });
    
    // ========== SINGLE COLLECTION EVENTS ==========
    
    // Collection fetch started
    subscribe(EVENTS.COLLECTION_FETCH_START || 'collection:fetchStart', (data) => {
      console.log('[CollectionEventHandler] Collection fetch started:', data.id);
      setIsLoading?.(true);
    });
    
    // Collection loaded
    subscribe(EVENTS.COLLECTION_LOADED || 'collection:loaded', (data) => {
      console.log('[CollectionEventHandler] Collection loaded:', 
        data.id, data.name || '');
      
      setIsLoading?.(false);
      
      // Set current collection if it exists in the event data
      if (data.collection) {
        setCurrentCollection?.(data.collection);
      }
    });
    
    // Collection selected (may include formatting)
    subscribe(EVENTS.COLLECTION_SELECTED || 'collection:selected', (data) => {
      console.log('[CollectionEventHandler] Collection selected:', 
        data.collectionId, 
        'format:', data.format || 'unknown');
      
      // If collection is directly provided and wasn't already formatted
      if (data.collection && data.format !== 'player-ready' && data.requiresFormatting) {
        try {
          // Try to format it if we have the formatForPlayer function
          if (formatForPlayer) {
            console.log('[CollectionEventHandler] Formatting selected collection for player');
            formatForPlayer(data.collection);
          }
        } catch (err) {
          console.error('[CollectionEventHandler] Error formatting collection:', err);
        }
      }
    });
    
    // Collection format completed
    subscribe(EVENTS.COLLECTION_FORMATTED || 'collection:formatted', (data) => {
      console.log('[CollectionEventHandler] Collection formatted for player:', 
        data.collectionId);
    });
    
    // Collection error
    subscribe(EVENTS.COLLECTION_ERROR || 'collection:error', (data) => {
      console.error('[CollectionEventHandler] Collection error:', 
        data.id ? `ID: ${data.id}` : '', 
        data.error || 'Unknown error');
      
      setIsLoading?.(false);
      setError?.(data.error || 'Unknown error with collection');
    });
    
    // Collection not found
    subscribe(EVENTS.COLLECTION_NOT_FOUND || 'collection:notFound', (data) => {
      console.warn('[CollectionEventHandler] Collection not found:', 
        data.id, 'source:', data.source || 'unknown');
      
      setIsLoading?.(false);
      setError?.(`Collection "${data.id}" not found`);
    });
    
    // ========== CACHE EVENTS ==========
    
    // Cache hit
    subscribe(EVENTS.COLLECTION_CACHE_HIT || 'collection:cacheHit', (data) => {
      console.log('[CollectionEventHandler] Cache hit for collection:', data.id);
    });
    
    // Cache updated
    subscribe(EVENTS.COLLECTION_CACHE_UPDATED || 'collection:cacheUpdated', (data) => {
      console.log('[CollectionEventHandler] Collection cache updated with', 
        data.count || 'unknown', 'collections');
    });
    
    // Cache cleared
    subscribe(EVENTS.COLLECTION_CACHE_CLEARED || 'collection:cacheCleared', () => {
      console.log('[CollectionEventHandler] Collection cache cleared');
    });
    
    // ========== LOCAL FOLDER EVENTS ==========
    
    // Local folder loading
    subscribe(EVENTS.COLLECTION_LOCAL_LOADING || 'collection:localLoading', (data) => {
      console.log('[CollectionEventHandler] Local collections loading from', 
        data.source || 'unknown source');
    });
    
    // Local folder loaded
    subscribe(EVENTS.COLLECTION_LOCAL_LOADED || 'collection:localLoaded', (data) => {
      console.log('[CollectionEventHandler] Local collections loaded:', 
        data.count || 'unknown count', 
        'from source:', data.source || 'unknown');
    });
    
    // ========== LIFECYCLE EVENTS ==========
    
    // Collection service initialized
    subscribe(EVENTS.COLLECTION_INITIALIZED || 'collection:initialized', (data) => {
      console.log('[CollectionEventHandler] Collection service initialized with config:', 
        data.config || 'config not available');
    });
    
    // Collection service disposed
    subscribe(EVENTS.COLLECTION_DISPOSED || 'collection:disposed', () => {
      console.log('[CollectionEventHandler] Collection service disposed');
    });

    // Clean up on unmount
    return () => {
      console.log('[CollectionEventHandler] Cleaning up collection event handlers');
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [setIsLoading, setError, setCollections, setCurrentCollection, formatForPlayer]);

  // This component doesn't render anything
  return null;
};

export default CollectionEventHandler;
