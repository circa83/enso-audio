import React, { useState } from 'react';
import { AudioProvider } from './contexts/AudioContext';
import Player from './pages/Player';
import Library from './pages/Library';
import Header from './components/layout/Header';
import './styles/globals.css';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('player');
  
  const handleNavigate = (page) => {
    setCurrentPage(page);
  };
  
  // Render the current page
  const renderPage = () => {
    switch (currentPage) {
      case 'library':
        return <Library onNavigate={handleNavigate} />;
      case 'player':
      default:
        return <Player />;
    }
  };
  
  return (
    <div className="App">
      <AudioProvider>
        <Header 
          currentPage={currentPage} 
          onNavigate={handleNavigate} 
        />
        {renderPage()}
      </AudioProvider>
    </div>
  );
}

export default App;