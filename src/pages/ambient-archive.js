// src/pages/ambient-archive.js
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import withAuth from '../components/auth/ProtectedRoute';
import ArchiveLayout from '../components/layout/ArchiveLayout';
import { useCollections } from '../hooks/useCollections';
import styles from '../styles/pages/AmbientArchive.module.css';

const AmbientArchive = () => {
  const router = useRouter();
  
  // State for details modal
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  
  // Use the useCollections hook with loadOnMount set to true
  const {
    collections,
    isLoading,
    error,
    filters,
    updateFilters,
    loadCollections
  } = useCollections({
    loadOnMount: true,
    filters: {} // Initial empty filters
  });

  // Add some diagnostic console logs
  useEffect(() => {
    console.log('[AmbientArchive] Current collections state:', { 
      count: collections?.length || 0,
      isLoading, 
      error,
      filters 
    });
  }, [collections, isLoading, error, filters]);


  // Handle filter changes
  const handleFilterChange = (newFilters) => {
    updateFilters(newFilters);
  };

 // Handle collection selection with logging
 const handleCollectionSelect = (collectionId) => {
  console.log(`[AmbientArchive] Selected collection: ${collectionId}`);
  // Use Next.js router for client-side navigation
  router.push({
    pathname: '/player',
    query: { collection: collectionId }
  });
};

// Error recovery function
const handleRetryLoad = () => {
  console.log('[AmbientArchive] Retrying collection load');
  loadCollections(1);
};

  // Handle showing collection details
  const handleShowDetails = (collection, e) => {
    e.stopPropagation(); // Prevent triggering the card click
  
    // Debug logs
    console.log('[AmbientArchive] Collection data for details modal:', collection);
    console.log('[AmbientArchive] Tracks data:', collection.tracks);
    console.log('[AmbientArchive] Metadata:', collection.metadata);
    
    setSelectedCollection(collection);
    setShowDetails(true);
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
                <button className={styles.playButton}>
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
          {selectedCollection.metadata?.tags && (
            <p><strong>Tags:</strong> {selectedCollection.metadata.tags.join(', ')}</p>
          )}
        </div>
        
        {/* Track list organized by layer */}
        <div className={styles.trackListContainer}>
          <h3>Audio Layers</h3>
          
          {/* Debug information for tracks */}
          {!selectedCollection.tracks || selectedCollection.tracks.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No tracks found for this collection.</p>
              <p className={styles.debugInfo}>Raw collection data: {JSON.stringify(selectedCollection).substring(0, 200)}...</p>
            </div>
          ) : (
            /* Group tracks by layer folder for better organization */
            ['Layer_1', 'Layer_2', 'Layer_3', 'Layer_4'].map(layerFolder => {
              // Filter tracks for this layer with multiple property checks
              const layerTracks = selectedCollection.tracks?.filter(track => {
                // Check for layerFolder property first
                if (track.layerFolder === layerFolder) return true;
                
                // Then check for layerType property
                if (track.layerType === layerFolder) return true;
                
                // Finally, check if the track path includes the layer folder name
                if (track.audioUrl && track.audioUrl.includes(`/${layerFolder}/`)) return true;
                
                return false;
              }) || [];
              
              if (layerTracks.length === 0) return null;
              
              return (
                <div key={layerFolder} className={styles.layerSection}>
                  <h4 className={styles.layerTitle}>
                    {layerFolder.replace('_', ' ')} 
                    <span className={styles.trackCount}>({layerTracks.length} tracks)</span>
                  </h4>
                  
                  <div className={styles.layerTracks}>
                    {layerTracks.map(track => (
                      <div key={track.id} className={styles.track}>
                        <div className={styles.trackInfo}>
                          <span className={styles.trackTitle}>{track.title}</span>
                        </div>
                        
                        {track.variations && track.variations.length > 0 && (
                          <div className={styles.variations}>
                            <span className={styles.variationsLabel}>Variations:</span>
                            {track.variations.map(variation => (
                              <div key={variation.id} className={styles.variation}>
                                <span className={styles.variationTitle}>{variation.title}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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
      </div>
    </div>
  </div>
)}
    </ArchiveLayout>
  );
};

export default withAuth(AmbientArchive);