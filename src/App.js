import React, { useState } from 'react';
import { AudioProvider, useAudio } from './contexts/StreamingAudioContext';
import Player from './pages/Player';
import Library from './pages/Library';
import Header from './components/layout/Header';
import LoadingScreen from './components/LoadingScreen'; // Import the new component
import './styles/globals.css';
import './App.css';


// This component will have access to the AudioContext
const AppContent = () => {
  const [currentPage, setCurrentPage] = useState('player');
  const { isAudioLoaded, isAudioActivated, activateAudio,loadingProgress } = useAudio();
  
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
      {/* Loading screen shows above everything else */}
      <LoadingScreen 
        isLoading={!isAudioLoaded || !isAudioActivated} 
        onActivateAudio={activateAudio} 
        loadingProgress={loadingProgress}
      />
      
      <Header 
        currentPage={currentPage} 
        onNavigate={handleNavigate} 
      />
      {renderPage()}
    </div>
  );
};

function App() {
  return (
    <AudioProvider>
      <AppContent />
    </AudioProvider>
    
  );
}

export default App;