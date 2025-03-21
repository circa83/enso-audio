import React, { useEffect, useState } from 'react';
import '../styles/components/LoadingScreen.css';

const LoadingScreen = ({ isLoading, onActivateAudio, loadingProgress = 0 }) => {
  const [isFading, setIsFading] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  
  const handleStartAudio = () => {
    setIsFading(true);
    // Only call activateAudio once when user clicks
 // Call the activateAudio function, which will set isAudioActivated to true
 if (onActivateAudio) {
    onActivateAudio();
  } else {
    console.error("onActivateAudio function is not defined");
  }
  };
  
  // Handle animation end
  const handleAnimationEnd = () => {
    if (isFading) {
      setIsVisible(false);
    }
  };

  // Don't render if not visible
  if (!isVisible) return null;
  
  return (
    <div 
      className={`loading-screen ${isFading ? 'fade-out' : ''}`} 
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="loading-content">
        <h2>Ensō Audio</h2>
        
        {loadingProgress < 100 ? (
          <div className="loading-spinner"></div>
        ) : (
          <div className="loading-complete">✓</div>
        )}
        
        <p>{loadingProgress < 100 ? 'Loading audio...' : 'Loading complete!'}</p>
        
        {/* Progress bar */}
        <div className="progress-container">
          <div 
            className="progress-bar" 
            style={{ width: `${loadingProgress}%` }}
          ></div>
        </div>
        <p className="progress-text">{Math.round(loadingProgress)}%</p>
        
        {/* Only show button when loaded */}
        {loadingProgress >= 100 && (
          <button 
            className="start-audio-button"
            onClick={handleStartAudio}
          >
            Begin Session
          </button>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;