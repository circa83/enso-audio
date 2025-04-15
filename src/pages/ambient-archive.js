// src/pages/ambient-archive.js
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import withAuth from '../components/auth/ProtectedRoute';
import ArchiveLayout from '../components/layout/ArchiveLayout';
import { useCollections } from '../hooks/useCollections';
import styles from '../styles/pages/AmbientArchive.module.css';

const AmbientArchive = () => {
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
    // Navigate to player with collection ID
    window.location.href = `/player?collection=${collectionId}`;
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
                <button className={styles.detailsButton}>
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
    </ArchiveLayout>
  );
};

export default withAuth(AmbientArchive);