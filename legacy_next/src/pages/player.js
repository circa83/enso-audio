import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Player from '../components/Player';
import withAuth from '../components/auth/ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';
import { useAudio } from '../contexts/StreamingAudioContext';
import styles from '../styles/pages/Player.module.css';


const PlayerPage = () => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [collectionInfo, setCollectionInfo] = useState(null);
  const loadingRef = useRef(false); // Add this ref at the component level

  // Get loadCollection function and states from audio context
  const {
    loadCollection,
    currentCollection,
    loadingCollection,
    collectionError
  } = useAudio();

  // Effect to load collection from URL parameter - update this part
  useEffect(() => {
    // Check if router and query are available
    if (!router || !router.isReady) return;

    const { collection: collectionId } = router.query;

    // Only load if we have a collection ID and haven't already started loading it
    if (collectionId && !loadingRef.current) {
      console.log(`[PlayerPage] Loading collection from URL: ${collectionId}`);

      // Set flag to true to prevent additional load attempts
      loadingRef.current = true;

      // Load the collection with autoPlay set to false
      loadCollection(collectionId, {
        autoPlay: false,
        initialVolumes: {
          Layer_1: 0.6,
          Layer_2: 0.3,
          Layer_3: 0.2,
          Layer_4: 0.1
        }
      }).catch(error => {
        console.error("[PlayerPage] Error loading collection:", error);
        // Reset the flag if loading fails to allow retry
        loadingRef.current = false;
      });
    }

    // No cleanup function needed as we're managing the ref at component level
  }, [router?.isReady, router?.query.collection, loadCollection]);

  // Reset loading flag when collection changes
  useEffect(() => {
    if (currentCollection) {
      // New collection loaded successfully, keep flag true to prevent reloading
      loadingRef.current = true;
    }
  }, [currentCollection]);

  // Update collection info when currentCollection changes
  useEffect(() => {
    if (currentCollection) {
      setCollectionInfo({
        name: currentCollection.name,
        description: currentCollection.description
      });
    }
  }, [currentCollection]);

  // Rest of component unchanged
  const handleLogout = async () => {
    await logout();
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <div className={styles.playerContainer}>
      <Head>
        <title>{collectionInfo ? `${collectionInfo.name} | Ensō Audio` : 'Audio Session | Ensō Audio'}</title>
      </Head>

      <div className={styles.playerTopBar}>
        <button className={styles.hamburgerMenu} onClick={toggleMenu}>
          <span></span>
          <span></span>
          <span></span>
        </button>
        <div className={styles.topBarTitle}>
          Ensō Audio
        </div>

        <Link href="/ambient-archive" className={styles.backButton}>
          Archive →
        </Link>
      </div>

      {/* Loading indicator */}
      {loadingCollection && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading collection...</p>
        </div>
      )}

      {/* Error message */}
      {collectionError && (
        <div className={styles.errorMessage}>
          <h3>Failed to load collection</h3>
          <p>{collectionError}</p>
          <button
            className={styles.retryButton}
            onClick={() => router.push('/ambient-archive')}
          >
            Return to Archive
          </button>
        </div>
      )}

      <Player />

      {/* Menu Overlay */}
      <div className={`${styles.menuOverlay} ${isMenuOpen ? styles.menuOpen : ''}`} onClick={toggleMenu}></div>

      {/* Simplified Menu Dropdown */}
      <div className={`${styles.menuDropdown} ${isMenuOpen ? styles.menuOpen : ''}`}>
        <nav className={styles.dropdownNav}>
          <Link href="#" className={styles.dropdownLink}>
            Settings
          </Link>
          <Link href="#" className={styles.dropdownLink}>
            Account
          </Link>

          <button className={styles.dropdownButton} onClick={handleLogout}>
            {user ? 'Logout' : 'Login'}
          </button>
        </nav>
      </div>
    </div>
  );
};

export default withAuth(PlayerPage);