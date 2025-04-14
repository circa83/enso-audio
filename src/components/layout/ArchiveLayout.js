import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../styles/components/ArchiveLayout.module.css';

const ArchiveLayout = ({ children, activePage }) => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const handleLogout = async () => {
    await logout();
  };
  
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };
  
  return (
    <div className={styles.archiveContainer}>
      {/* Main content */}
      <main className={styles.mainContent}>
        <div className={styles.topBar}>
          <button className={styles.hamburgerMenu} onClick={toggleMenu}>
            <span></span>
            <span></span>
            <span></span>
          </button>
          
          <div className={styles.topBarTitle}>
            Ambient Archive
          </div>
          
          <Link href="/player" className={styles.playerButton}>
            Audio Player →
          </Link>
        </div>
        
        <div className={styles.content}>
          {children}
        </div>
      </main>
      
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

export default ArchiveLayout; 