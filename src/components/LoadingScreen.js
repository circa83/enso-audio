import React, { useState, useEffect } from 'react';
import '../styles/components/LoadingScreen.css';

const LoadingScreen = ({ 
  isLoading, 
  onActivateAudio, 
  loadingProgress, 
  loadingError,
  retryLoading,
  usingChunks
}) => {
  const [fadeOut, setFadeOut] = useState(false);
  const [message, setMessage] = useState('Loading audio files...');
  const [showRetryButton, setShowRetryButton] = useState(false);

  useEffect(() => {
    // Update loading message based on progress and errors
    if (loadingError) {
      setMessage(loadingError);
      setShowRetryButton(true);
    } else if (usingChunks && loadingProgress > 0) {
      setMessage('Loading essential audio (streaming mode)...');
    } else if (loadingProgress === 100) {
      setMessage('Audio loaded! Ready to play.');
      setShowRetryButton(false);
    } else {
      setMessage('Loading audio files...');
      setShowRetryButton(false);
    }

    // If we're not loading anymore, start the fade out animation
    if (!isLoading) {
      setFadeOut(true);
      
      // Remove the component from DOM after animation completes
      const timer = setTimeout(() => {
        // Component will be removed by parent due to isLoading=false
      }, 800); // Match this to your CSS animation duration
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, loadingProgress, loadingError, usingChunks]);

  // Handle retry button click
  const handleRetry = () => {
    if (retryLoading) {
      retryLoading();
      setShowRetryButton(false);
    }
  };

  // If loading is done and fade-out has completed, don't render the component
  if (!isLoading && fadeOut) {
    return null;
  }

  return (
    <div className={`loading-screen ${fadeOut ? 'fade-out' : ''}`}>
      <div className="loading-content">
        <h2>Ensō Audio</h2>
        
        {loadingProgress < 100 ? (
          // Still loading audio
          <>
            <div className="loading-spinner"></div>
            <div className="progress-container">
              <div 
                className="progress-bar" 
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
            <div className="progress-text">
              {Math.round(loadingProgress)}% loaded
              {usingChunks && ' (streaming mode)'}
            </div>
            <p>{message}</p>
            
            {showRetryButton && (
              <button 
                className="retry-button"
                onClick={handleRetry}
              >
                Retry Loading
              </button>
            )}
          </>
        ) : (
          // Loading complete, waiting for user interaction
          <>
            <div className="loading-complete">✓</div>
            <p>{message}</p>
            <button 
              className="start-audio-button"
              onClick={onActivateAudio}
            >
              Start Audio Session
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;