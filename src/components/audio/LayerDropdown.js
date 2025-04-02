// src/components/audio/LayerDropdown.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAudio } from '../../hooks/useAudio'; // Import the refactored hook
import styles from '../../styles/components/LayerDropdown.module.css';

const LayerDropdown = ({ layer }) => {
  const { 
    audioLibrary, 
    activeAudio, 
    crossfadeTo,
    activeCrossfades,
    crossfadeProgress,
    preloadProgress,
    isPlaying
  } = useAudio();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);
  const toggleButtonRef = useRef(null);
  
  // Get z-index based on layer name for proper stacking
  const getZIndexForLayer = useCallback((layerName) => {
    // Significantly increased z-index values with wider gaps between them
    switch(layerName.toLowerCase()) {
      case 'drone':
        return 10000; // Drone is at the top 
      case 'melody':
        return 9500; // Melody is below Drone
      case 'rhythm':
        return 9000; // Rhythm is below Melody
      case 'nature':
        return 8500; // Nature is at the bottom
      default:
        return 8000; // Fallback
    }
  }, []); // No dependencies since this is a pure function

  // Update menu position function
  const updateMenuPosition = useCallback(() => {
    if (!toggleButtonRef.current) return;
    
    const rect = toggleButtonRef.current.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom,
      left: rect.left
    });
  }, [toggleButtonRef]); // Depend on the ref
  
  // Toggle dropdown visibility with useCallback
  const toggleDropdown = useCallback((e) => {
    e.stopPropagation(); // Prevent event from reaching parent elements
    setIsExpanded(prev => !prev);
  }, []); // No external dependencies needed
  
  // Handle track selection with useCallback
  const handleTrackSelect = useCallback((e, trackId) => {
    e.stopPropagation(); // Important: prevent event bubbling
    e.preventDefault();
    
    // Don't allow selection during active crossfade
    if (activeCrossfades && activeCrossfades[layer]) {
      console.log(`Crossfade already in progress for ${layer}`);
      return;
    }
    
    // Skip if already selected
    if (trackId === activeAudio[layer]) {
      setIsExpanded(false);
      return;
    }
    
    console.log(`Selecting track ${trackId} for ${layer}`);
    
    // Perform crossfade with appropriate duration
    // Use shorter crossfade if not playing to avoid long waits
    const fadeDuration = isPlaying ? 2000 : 200;
    crossfadeTo(layer, trackId, fadeDuration);
    
    // Close the dropdown
    setIsExpanded(false);
  }, [layer, activeCrossfades, activeAudio, isPlaying, crossfadeTo]); // Include all external dependencies
  
  // Handle scroll event to update dropdown position
  useEffect(() => {
    const handleScroll = () => {
      if (isExpanded) {
        updateMenuPosition();
      }
    };
    
    // Add event listeners for when dropdown is expanded
    if (isExpanded) {
      updateMenuPosition(); // Initial position update
      window.addEventListener('scroll', handleScroll);
      window.addEventListener('resize', handleScroll);
    }
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isExpanded, updateMenuPosition]); // Now depends on the memoized function
  
  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsExpanded(false);
      }
    };
    
    // Only add event listener when the dropdown is expanded
    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);
  
  // Close dropdown on ESC key press
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };
    
    document.addEventListener('keydown', handleEscKey);
    
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isExpanded]);
  
  // Get active track name - optimize with useCallback if used in multiple places
  const getActiveTrackName = useCallback(() => {
    if (!activeAudio[layer] || !audioLibrary[layer]) return 'Default';
    
    const activeTrack = audioLibrary[layer].find(t => t.id === activeAudio[layer]);
    return activeTrack ? activeTrack.name : 'Default';
  }, [activeAudio, audioLibrary, layer]);
  
  // Check if the layer is currently in a crossfade
  const isInCrossfade = activeCrossfades && activeCrossfades[layer];
  
  // Get progress percentage for display
  const getProgressPercent = useCallback(() => {
    if (!isInCrossfade) return 0;
    return Math.floor((crossfadeProgress[layer] || 0) * 100);
  }, [isInCrossfade, crossfadeProgress, layer]);

  // If there are no options to show, don't render the component
  if (!audioLibrary[layer] || audioLibrary[layer].length <= 1) {
    return null;
  }
  
  // Calculate z-index for the current layer
  const zIndex = getZIndexForLayer(layer);
  
  return (
    <div className={styles.dropdownContainer} ref={dropdownRef}>
      <button 
        className={`${styles.dropdownToggle} ${isExpanded ? styles.expanded : ''} ${isInCrossfade ? styles.crossfading : ''}`}
        onClick={toggleDropdown}
        disabled={isInCrossfade}
        type="button"
        ref={toggleButtonRef}
      >
        <span className={styles.currentTrack}>
          {isInCrossfade ? (
            <span className={styles.crossfadeStatus}>
              Transitioning ({getProgressPercent()}%)
            </span>
          ) : (
            getActiveTrackName()
          )}
        </span>
        <span className={styles.arrowIcon}>▼</span>
      </button>
      
      {isExpanded && (
        <>
          {/* Add a full-screen transparent overlay to capture clicks */}
          <div 
            className={styles.menuOverlay} 
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(false);
            }}
            style={{ zIndex: zIndex - 1 }}
          />
          
          <ul 
            className={styles.dropdownMenu}
            onClick={(e) => e.stopPropagation()} // Prevent clicks from reaching through
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              zIndex: zIndex // Apply layer-specific z-index
            }}
          >
            {audioLibrary[layer].map((track) => {
              const isActive = activeAudio[layer] === track.id;
              const isPreloading = preloadProgress && preloadProgress[track.id] !== undefined && preloadProgress[track.id] < 100;
              
              return (
                <li 
                  key={track.id}
                  className={`${styles.dropdownItem} ${isActive ? styles.active : ''}`}
                  onClick={(e) => handleTrackSelect(e, track.id)}
                >
                  <span className={styles.trackName}>{track.name}</span>
                  {isActive && <span className={styles.activeIndicator}>✓</span>}
                  {isPreloading && (
                    <div className={styles.preloadingIndicator}>
                      <span>{preloadProgress[track.id]}%</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};

// Export with memoization to prevent unnecessary re-renders
export default React.memo(LayerDropdown);