import React from 'react';
import '../../styles/components/Header.css';

const Header = ({ currentPage, onNavigate }) => {
  return (
    <header className="app-header">
      <div className="logo">Ensō Audio</div>
      <nav className="main-nav">
        <button 
          className={`nav-link ${currentPage === 'player' ? 'active' : ''}`}
          onClick={() => onNavigate('player')}
        >
          Player
        </button>
        <button 
          className={`nav-link ${currentPage === 'library' ? 'active' : ''}`}
          onClick={() => onNavigate('library')}
        >
          Library
        </button>
      </nav>
    </header>
  );
};

export default Header;