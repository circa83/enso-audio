// src/pages/ambient-archive.js
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import withAuth from '../components/auth/ProtectedRoute';
import ArchiveLayout from '../components/layout/ArchiveLayout';
import styles from '../styles/pages/AmbientArchive.module.css';

const AmbientArchive = () => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch collections on mount
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        console.log('[AmbientArchive] Fetching collections...');
        const response = await fetch('/collections/collections.json');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch collections: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[AmbientArchive] Fetched collections:', data);
        setCollections(data);
        setLoading(false);
      } catch (err) {
        console.error('[AmbientArchive] Error fetching collections:', err);
        setError('Failed to load audio collections. Please try again later.');
        setLoading(false);
      }
    };
    
    fetchCollections();
  }, []);
  
  if (loading) {
    return (
      <ArchiveLayout activePage="ambient-archive">
        <div className={styles.loadingContainer}>
          <p>Loading collections...</p>
        </div>
      </ArchiveLayout>
    );
  }
  
  if (error) {
    return (
      <ArchiveLayout activePage="ambient-archive">
        <div className={styles.errorContainer}>
          <p>{error}</p>
        </div>
      </ArchiveLayout>
    );
  }
  
  return (
    <ArchiveLayout activePage="ambient-archive">
      <Head>
        <title>Ambient Archive | Ensō Audio</title>
      </Head>
      
      {/* <div className={styles.archiveHeader}>
        <h1 className={styles.archiveTitle}>The Ambient Archive</h1>
        <p className={styles.archiveDescription}>
          Browse and select audio collections for your therapeutic sessions
        </p>
      </div> */}
      
      <div className={styles.collectionsGrid}>
        {collections.map(collection => (
          <div key={collection.id} className={styles.collectionCard}>
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
                <Link href={`/player?collection=${collection.id}`} passHref>
                  <button className={styles.playButton}>
                    Play Collection
                  </button>
                </Link>
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