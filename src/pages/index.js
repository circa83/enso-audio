import React, { useState, useCallback, memo, useMemo } from 'react';
import { useAudio } from '../contexts/StreamingAudioContext';
import Player from '../components/Player';
import Library from '../components/Library';
import Header from '../components/layout/Header';
import LoadingScreen from '../components/LoadingScreen';

// Memoize components
const MemoizedPlayer = memo(Player);
const MemoizedLibrary = memo(Library);
const MemoizedHeader = memo(Header);
const MemoizedLoadingScreen = memo(LoadingScreen);

export default function Home() {
  const [currentPage, setCurrentPage] = useState('player');
  
  // Destructure only what you need
  const { 
    isAudioLoaded, 
    isAudioActivated, 
    activateAudio, 
    loadingProgress,
    forceLoadingComplete
  } = useAudio();
  
  const handleNavigate = useCallback((page) => {
    setCurrentPage(page);
  }, []);
  
  // Force skip loading screen - uncomment to bypass loading if needed
  // React.useEffect(() => {
  //   forceLoadingComplete();
  // }, [forceLoadingComplete]);
  
  // Memoize the current page content
  const currentPageContent = useMemo(() => {
    switch (currentPage) {
      case 'library':
        return <MemoizedLibrary onNavigate={handleNavigate} />;
      case 'player':
      default:
        return <MemoizedPlayer />;
    }
  }, [currentPage, handleNavigate]);
  
  // Memoize loading state
  const isLoading = useMemo(() => {
    return !isAudioLoaded || !isAudioActivated;
  }, [isAudioLoaded, isAudioActivated]);
  
  return (
    <div className="App">
      <MemoizedLoadingScreen 
        isLoading={isLoading} 
        onActivateAudio={activateAudio} 
        loadingProgress={loadingProgress}
      />
      
      <MemoizedHeader 
        currentPage={currentPage} 
        onNavigate={handleNavigate} 
      />
      {currentPageContent}
    </div>
  );
}