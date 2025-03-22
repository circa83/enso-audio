import React from 'react';
import styles from '../../styles/components/Header.module.css';

const Header = ({ currentPage, onNavigate }) => {
  console.log("Header component rendering");
  
  return (
    <header className={styles['app-header']}>
      <div className={styles.logo}>Ensō Audio</div>
      <nav className={styles['main-nav']}>
        <button 
          className={`${styles['nav-link']} ${currentPage === 'player' ? styles.active : ''}`}
          onClick={() => onNavigate('player')}
        >
          Player
        </button>
        <button 
          className={`${styles['nav-link']} ${currentPage === 'library' ? styles.active : ''}`}
          onClick={() => onNavigate('library')}
        >
          Library
        </button>
      </nav>
    </header>
  );
};

export default Header;