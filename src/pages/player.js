import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Player from '../components/Player';
import withAuth from '../components/auth/ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/pages/Player.module.css';

const PlayerPage = () => {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const handleLogout = async () => {
    await logout();
  };
  
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };
  
  return (
    <div className={styles.playerContainer}>
      <Head>
        <title>Audio Session | Ensō Audio</title>
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