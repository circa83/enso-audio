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

  // Handle filter changes
  const handleFilterChange = (newFilters) => {
    updateFilters(newFilters);
  };

  // Handle collection selection
  const handleCollectionSelect = (collectionId) => {
    // Use Next.js router for client-side navigation
    router.push({
      pathname: '/player',
      query: { collection: collectionId }
    });
  };

  // Handle showing collection details
  const handleShowDetails = (collection, e) => {
    e.stopPropagation(); // Prevent triggering the card click
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
              <h2>{selectedCollection.name}</h2>
              <p className={styles.modalDescription}>{selectedCollection.description}</p>
              
              {selectedCollection.metadata && (
                <div className={styles.modalMetadata}>
                  <p><strong>Artist:</strong> {selectedCollection.metadata.artist}</p>
                  <p><strong>Year:</strong> {selectedCollection.metadata.year}</p>
                  {selectedCollection.metadata.tags && (
                    <p><strong>Tags:</strong> {selectedCollection.metadata.tags.join(', ')}</p>
                  )}
                </div>
              )}
              
              <div className={styles.trackList}>
                <h3>Tracks</h3>
                {selectedCollection.tracks && selectedCollection.tracks.map(track => (
                  <div key={track.id} className={styles.track}>
                    <div className={styles.trackInfo}>
                      <span className={styles.trackTitle}>{track.title}</span>
                      <span className={styles.trackType}>{track.layerType}</span>
                    </div>
                    {track.variations && track.variations.length > 0 && (
                      <div className={styles.variations}>
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
          </div>
        </div>
      )}
    </ArchiveLayout>
  );
};

export default withAuth(AmbientArchive);