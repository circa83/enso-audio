// src/components/audio/PlayerControlPanel.js
import React, { memo, useCallback, useRef, useEffect  } from 'react';
import { useAudio } from '../../hooks/useAudio';
import VisualizerContainer from './VisualizerContainer';
import MasterVolumeControl from './MasterVolumeControl';
import SessionTimeline from './SessionTimeline';
import styles from '../../styles/components/PlayerControlPanel.module.css';

/**
 * PlayerControlPanel component
 * 
 * Provides the main playback controls, audio visualization,
 * and master volume controls for the audio player
 * 
 * @returns {JSX.Element} Rendered component
 */
const PlayerControlPanel = React.forwardRef(({ 
  onDurationChange,
  transitionDuration,
  onTransitionDurationChange, 
  coverImageUrl
}, ref) => {
  // Enhanced logging with more details
  console.log('[PlayerControlPanel] Rendering with props:', { 
    hasCoverImageUrl: !!coverImageUrl,
    coverImageUrl, 
    coverImageUrlType: typeof coverImageUrl
  });
  
  // Use our new hook with grouped API
  const { playback, currentCollection } = useAudio();

  // Add debug logging for currentCollection - moved to top level
  useEffect(() => {
    console.log('[PlayerControlPanel] Current collection in context:', 
      currentCollection ? {
        id: currentCollection.id,
        name: currentCollection.name,
        hasCover: !!currentCollection.coverImage,
        coverImage: currentCollection.coverImage,
        coverImageType: typeof currentCollection.coverImage
      } : 'None'
    );
  }, [currentCollection]);
  
  // Log when coverImageUrl changes - moved to top level
  useEffect(() => {
    console.log('[PlayerControlPanel] Cover image URL changed:', {
      coverImageUrl,
      isString: typeof coverImageUrl === 'string',
      isEmpty: !coverImageUrl,
      shouldShow: Boolean(coverImageUrl)
    });
  }, [coverImageUrl]);
  
  // Handle play/pause with useCallback for optimization
  const togglePlayPause = useCallback(() => {
    console.log("[PlayerControlPanel] Play/Pause button clicked, current state:", playback.isPlaying);
    if (playback.isPlaying) {
      console.log("[PlayerControlPanel] Attempting to pause playback");
      playback.pause();
    } else {
      console.log("[PlayerControlPanel] Attempting to start playback");
      playback.start();
    }
  }, [playback]);
  
  // Determine if we should show the cover image
  const shouldShowCoverImage = Boolean(coverImageUrl);
  
  return (
    <div className={styles.playerControlPanel}>
      <div className={styles.visualizerSection}>
      {/* Conditionally render album art if available, otherwise show visualizer */}
      {shouldShowCoverImage ? (
         <div className={styles.albumArtContainer}>
         <img 
           src={coverImageUrl} 
           alt="Album Cover" 
           className={styles.albumArt}
           onLoad={() => console.log("[PlayerControlPanel] Cover image loaded successfully")}
           onError={(e) => console.error("[PlayerControlPanel] Error loading cover image:", e)}
         />
         {/* Debug text to show in the UI */}
         <div style={{position: 'absolute', bottom: 0, left: 0, background: 'rgba(0,0,0,0.5)', color: 'white', padding: '2px 5px', fontSize: '10px'}}>
           Cover: {coverImageUrl.split('/').pop()}
         </div>
       </div>
     ) : (
       <>
         <VisualizerContainer />
         {/* Debug message when no cover image */}
         <div style={{position: 'absolute', top: 0, left: 0, background: 'rgba(0,0,0,0.5)', color: 'white', padding: '2px 5px', fontSize: '10px'}}>
           No cover image available
         </div>
       </>
     )}
   </div>
      
      <div className={styles.controlsSection}>
        <button 
          className={`${styles.playButton} ${playback.isPlaying ? styles.playing : ''}`}
          onClick={togglePlayPause}
          aria-label={playback.isPlaying ? 'Stop' : 'Play'}
          aria-pressed={playback.isPlaying}
        >
          {playback.isPlaying ? 'Stop' : 'Play'}
        </button>
        <SessionTimeline 
          ref={ref}
          onDurationChange={onDurationChange}
          transitionDuration={transitionDuration}
          onTransitionDurationChange={onTransitionDurationChange}
        />
        <MasterVolumeControl />
      </div>
    </div>
  );
});

// Add display name for debugging
PlayerControlPanel.displayName = 'PlayerControlPanel';

// Use memo for performance optimization
export default memo(PlayerControlPanel);