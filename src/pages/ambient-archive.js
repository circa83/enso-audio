// src/pages/ambient-archive.js
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import withAuth from '../components/auth/ProtectedRoute';
import ArchiveLayout from '../components/layout/ArchiveLayout';
import { useCollection } from '../hooks/useCollection';
import styles from '../styles/pages/AmbientArchive.module.css';
import eventBus, { EVENTS } from '../services/EventBus';

const AmbientArchive = () => {
  const router = useRouter();
  
  // State for details modal
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  
  // Use the useCollection hook with loadOnMount set to true
  const {
    collections,
    isLoading,
    error,
    filters,
    updateFilters,
    loadCollections,
    selectCollection
  } = useCollection({
    loadOnMount: true,
    filters: {} // Initial empty filters
  });

  

  // a clean-up reference to prevent over-rendering
useEffect(() => {
  let isMounted = true;
  
  // Diagnostic logging only when component is mounted
  if (isMounted) {
    console.log('[AmbientArchive] Current collections state:', { 
      count: collections?.length || 0,
      isLoading, 
      error,
      filters 
    });
  }
  
  return () => {
    isMounted = false; // Clean up
  };
}, [collections, isLoading, error, filters]);

  // Handle filter changes
  const handleFilterChange = (newFilters) => {
    updateFilters(newFilters);
  };

// Handle collection selection with enhanced buffer loading
const handleCollectionSelect = (collectionId) => {
  console.log(`[AmbientArchive] Selected collection: ${collectionId}`);

  // Use the hook's selectCollection method with navigation option
  selectCollection(collectionId, {
    source: 'ambient-archive',
    action: 'play',
    preloadBuffers: true, // Indicate buffer preloading should happen
    navigate: true,
    queryParams: {
      source: 'archive',
      action: 'play'
    }
  });
  
  // Enhanced event emission with standardized payload structure
  eventBus.emit(EVENTS.COLLECTION_SELECTED, { 
    collectionId, 
    source: 'ambient-archive',
    action: 'play',
    preloadBuffers: true,
    timestamp: Date.now() 
  });
  
  // Then use Next.js router for navigation with consistent structured data
  router.push({
    pathname: '/player',
    query: { 
      collection: collectionId,
      source: 'archive',
      action: 'play'
    }
  });
};


  // Error recovery function
  const handleRetryLoad = () => {
    console.log('[AmbientArchive] Retrying collection load');
    loadCollections(1);
  };

  // Handle showing collection details
  const handleShowDetails = async (collection, e) => {
    e.stopPropagation(); // Prevent triggering the card click
    
    try {
      setShowDetails(true);
      
      // Show loading state
      setSelectedCollection({
        ...collection,
        isLoading: true
      });
      
      // Fetch tracks for this collection
      console.log(`[AmbientArchive] Fetching tracks for collection: ${collection.id}`);
      const tracksResponse = await fetch(`/api/collections/${collection.id}/tracks`);
      
      if (!tracksResponse.ok) {
        throw new Error(`Failed to load collection tracks: ${tracksResponse.status}`);
      }
      
      const tracksResult = await tracksResponse.json();
      
      if (!tracksResult.success) {
        throw new Error(tracksResult.message || 'Failed to load collection tracks');
      }
      
      // Create a complete collection object with track data
      const detailedCollection = {
        ...collection,
        tracks: tracksResult.data // Use the tracks data from the API
      };
      
      // Debug logs
      console.log('[AmbientArchive] Collection data for details modal:', detailedCollection);
      console.log('[AmbientArchive] Tracks data:', detailedCollection.tracks);
      console.log('[AmbientArchive] Metadata:', detailedCollection.metadata);
      
      // Update state with detailed collection
      setSelectedCollection(detailedCollection);
    } catch (error) {
      console.error(`[AmbientArchive] Error loading collection details:`, error);
      
      // Update with error state
      setSelectedCollection({
        ...collection,
        error: error.message
      });
    }
  };

  // Handle closing details modal
  const handleCloseDetails = () => {
    setShowDetails(false);
    setSelectedCollection(null);
  };

  if (isLoading) {
    return (
      <ArchiveLayout activePage="ambient-archive">
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading collections...</p>
        </div>
      </ArchiveLayout>
    );
  }

  if (error) {
    return (
      <ArchiveLayout activePage="ambient-archive">
        <div className={styles.errorContainer}>
          <h3>Error Loading Collections</h3>
          <p>{error}</p>
          <button 
            className={styles.retryButton}
            onClick={() => loadCollections(1)}
          >
            Retry
          </button>
        </div>
      </ArchiveLayout>
    );
  }

  return (
    <ArchiveLayout activePage="ambient-archive">
      <Head>
        <title>Ambient Archive | Ensō Audio</title>
      </Head>
      
      <div className={styles.archiveHeader}>
        <h1 className={styles.archiveTitle}>The Ambient Archive</h1>
        <p className={styles.archiveDescription}>
          Browse and select audio collections for your therapeutic sessions
        </p>
      </div>

      {/* Filter controls */}
      <div className={styles.filterControls}>
        <input
          type="text"
          placeholder="Search collections..."
          className={styles.searchInput}
          onChange={(e) => handleFilterChange({ search: e.target.value })}
        />
        <select
          className={styles.filterSelect}
          onChange={(e) => handleFilterChange({ tag: e.target.value })}
        >
          <option value="">All Tags</option>
          <option value="meditation">Meditation</option>
          <option value="focus">Focus</option>
          <option value="relaxation">Relaxation</option>
        </select>
      </div>
      
      <div className={styles.collectionsGrid}>
        {collections.map(collection => (
          <div 
            key={collection.id} 
            className={styles.collectionCard}
            onClick={() => handleCollectionSelect(collection.id)}
          >
            <div className={styles.collectionImageContainer}>
              {collection.coverImage && (
                <img 
                  src={collection.coverImage} 
                  alt={`${collection.name} collection`} 
                  className={styles.collectionImage}
                />
              )}
            </div>
            <div className={styles.collectionInfo}>
              <h2 className={styles.collectionName}>{collection.name}</h2>
              <p className={styles.collectionDescription}>{collection.description}</p>
              
              <div className={styles.collectionMeta}>
                {collection.metadata && (
                  <>
                    {collection.metadata.artist && (
                      <span className={styles.collectionArtist}>{collection.metadata.artist}</span>
                    )}
                    {collection.metadata.year && (
                      <span className={styles.collectionYear}>{collection.metadata.year}</span>
                    )}
                  </>
                )}
              </div>
              
              <div className={styles.collectionControls}>
              <button 
  className={styles.playButton}
  onClick={() => handleCollectionSelect(collection.id)}
>
  Play Collection
</button>
                <button 
                  className={styles.detailsButton}
                  onClick={(e) => handleShowDetails(collection, e)}
                >
                  Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {collections.length === 0 && (
        <div className={styles.emptyState}>
          <p>No collections found in the Ambient Archive.</p>
        </div>
      )}

      {/* Details Modal */}
      {showDetails && selectedCollection && (
  <div className={styles.modalOverlay} onClick={handleCloseDetails}>
    <div className={styles.modal} onClick={e => e.stopPropagation()}>
      <button className={styles.modalClose} onClick={handleCloseDetails}>×</button>
      
      <div className={styles.modalContent}>
        {selectedCollection.isLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading collection details...</p>
          </div>
        ) : selectedCollection.error ? (
          <div className={styles.errorContainer}>
            <h3>Error Loading Collection Details</h3>
            <p>{selectedCollection.error}</p>
          </div>
        ) : (
          <>
            {/* Header with collection info */}
            <div className={styles.modalHeader}>
              {selectedCollection.coverImage && (
                <div className={styles.modalCoverImage}>
                  <img 
                    src={selectedCollection.coverImage} 
                    alt={`${selectedCollection.name} cover`} 
                  />
                </div>
              )}
              <div className={styles.modalHeadContent}>
                <h2>{selectedCollection.name || 'Unnamed Collection'}</h2>
                <p className={styles.modalDescription}>{selectedCollection.description || 'No description available'}</p>
              </div>
            </div>
            
            {/* Metadata section */}
            <div className={styles.modalMetadata}>
              <p><strong>Artist:</strong> {selectedCollection.metadata?.artist || 'Unknown'}</p>
              <p><strong>Year:</strong> {selectedCollection.metadata?.year || 'N/A'}</p>
              {selectedCollection.metadata?.tags && selectedCollection.metadata.tags.length > 0 && (
                <p><strong>Tags:</strong> {selectedCollection.metadata.tags.join(', ')}</p>
              )}
            </div>
            
            {/* Track list organized by layer - SIMPLIFIED VERSION */}
            <div className={styles.trackListContainer}>
  <h3>Audio Layers</h3>
  
  {/* Check for actual track objects */}
  {!selectedCollection.tracks || !Array.isArray(selectedCollection.tracks) || selectedCollection.tracks.length === 0 ? (
    <div className={styles.emptyState}>
      <p>No tracks found for this collection.</p>
    </div>
  ) : (
    /* Group tracks by layer folder for simpler organization */
    ['Layer_1', 'Layer_2', 'Layer_3', 'Layer_4'].map(layerFolder => {
      // Get all tracks for this layer, including variations
      const allTracks = [];
      
      // First gather main tracks
      const mainTracks = selectedCollection.tracks.filter(track => 
        track.layerFolder === layerFolder
      );
      
      // Add main tracks to our list
      mainTracks.forEach(track => {
        allTracks.push(track.title);
        
        // Include variations without separating them
        if (track.variations && Array.isArray(track.variations)) {
          track.variations.forEach(variation => {
            allTracks.push(variation.title);
          });
        }
      });
      
      // Skip empty layers
      if (allTracks.length === 0) return null;
      
      return (
        <div key={layerFolder} className={styles.layerSection}>
          <h4 className={styles.layerTitle}>
            {layerFolder.replace('_', ' ')} 
            <span className={styles.trackCount}>({allTracks.length} tracks)</span>
          </h4>
          
          {/* Display tracks vertically instead of comma-separated */}
          <div className={styles.layerTracks}>
            {allTracks.map((trackName, index) => (
              <span key={index}>{trackName}</span>
            ))}
          </div>
        </div>
      );
    })
  )}
</div>
           
            
            {/* Action buttons */}
            <div className={styles.modalActions}>
              <button 
                className={styles.playCollectionButton}
                onClick={() => handleCollectionSelect(selectedCollection.id)}
              >
                Load in Player
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  </div>
)}
    </ArchiveLayout>
  );
};

export default withAuth(AmbientArchive);