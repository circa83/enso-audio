// src/components/audio/LayerDropdown.js
import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { useLayerControls } from '../../hooks/useAudio';
import styles from '../../styles/components/LayerDropdown.module.css';

/**
 * LayerDropdown - Dropdown for selecting audio tracks for a layer
 * 
 * @param {Object} props - Component props
 * @param {string} props.layer - Audio layer ID (e.g., 'drone', 'melody')
 */
const LayerDropdown = ({ layer }) => {
  // Safely provide defaults for all potentially undefined values
  const { 
    audioLibrary = {}, 
    activeAudio = {}, 
    crossfadeTo,
    activeCrossfades = {},
    crossfadeProgress = {},
    preloadProgress = {},
    LAYERS = {}
  } = useLayerControls() || {}; // Also check if useLayerControls returns undefined
  
  // Component state
  const [isExpanded, setIsExpanded] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  
  // Refs for DOM elements
  const dropdownRef = useRef(null);
  const toggleButtonRef = useRef(null);
  const menuRef = useRef(null);
  
  // Get layer tracks
  const layerTracks = audioLibrary[layer] || [];
  const hasMultipleTracks = layerTracks.length > 1;
  
  // Callbacks - declare ALL hooks regardless of conditions
  const updateMenuPosition = useCallback(() => {
    if (!toggleButtonRef.current) return;
    
    const rect = toggleButtonRef.current.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    
    // Calculate position in viewport coordinates
    setMenuPosition({
      top: rect.bottom + scrollY,
      left: rect.left,
      width: Math.max(170, rect.width) // Ensure minimum width
    });
  }, []);
  
  // Toggle dropdown visibility
  const toggleDropdown = useCallback((e) => {
    if (e) {
      e.stopPropagation(); // Prevent event from reaching parent elements
    }
    
    // If we're about to expand, update the menu position
    if (!isExpanded) {
      updateMenuPosition();
    }
    
    setIsExpanded(prev => !prev);
  }, [isExpanded, updateMenuPosition]);
  
  // Get active track name - with proper null checks
  const getActiveTrackName = useCallback(() => {
    if (!activeAudio || !audioLibrary || !layer || !audioLibrary[layer]) {
      return 'Default';
    }
    
    const activeTrackId = activeAudio[layer];
    if (!activeTrackId) return 'Default';
    
    const activeTrack = audioLibrary[layer].find(t => t.id === activeTrackId);
    return activeTrack ? activeTrack.name : 'Default';
  }, [activeAudio, audioLibrary, layer]);
  
   // Handle track selection - with proper null checks
   const handleTrackSelect = useCallback((e, trackId) => {
    if (!e || !trackId || !crossfadeTo) return;
    
    e.stopPropagation(); // Prevent event bubbling
    e.preventDefault();
    
    // Don't allow selection during active crossfade
    if (activeCrossfades && activeCrossfades[layer]) {
      console.log(`Crossfade already in progress for ${layer}`);
      return;
    }
    
    // Skip if already selected
    if (activeAudio && activeAudio[layer] === trackId) {
      setIsExpanded(false);
      return;
    }
    
    // Perform crossfade
    crossfadeTo(layer, trackId, 2000);
    
    // Close the dropdown
    setIsExpanded(false);
  }, [activeCrossfades, layer, activeAudio, crossfadeTo]);
  
  // Check if the layer is currently in a crossfade
  const isInCrossfade = activeCrossfades && activeCrossfades[layer];
  
  // Get progress percentage for display - always define this hook
  const getProgressPercent = useCallback(() => {
    if (!isInCrossfade) return 0;
    return Math.floor((crossfadeProgress[layer] || 0) * 100);
  }, [isInCrossfade, crossfadeProgress, layer]);
  
  // Current crossfade status display - always define this hook
  const renderCrossfadeStatus = useCallback(() => {
    if (!isInCrossfade) return null;
    
    const progress = getProgressPercent();
    
    if (activeCrossfades[layer].isLoading) {
      return <span className={styles.crossfadeStatus}>Loading...</span>;
    }
    
    return <span className={styles.crossfadeStatus}>Transition ({progress}%)</span>;
  }, [isInCrossfade, activeCrossfades, layer, getProgressPercent]);
  
  // Calculate z-index for proper stacking - always define this hook
  const getZIndex = useCallback(() => {
    // Use a base z-index that's higher than other UI elements
    const baseZIndex = 1000;
    
    // Add layer-specific offset
    const layerOffset = {
      'drone': 40,
      'melody': 30,
      'rhythm': 20,
      'nature': 10
    }[layer] || 0;
    
    return baseZIndex + layerOffset;
  }, [layer]);
  
  // Handle click outside the dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsExpanded(false);
      }
    };
    
    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isExpanded]);
  
  // Close dropdown when Escape key is pressed
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };
    
    if (isExpanded) {
      document.addEventListener('keydown', handleEscKey);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isExpanded]);
  
  // If no tracks or only one track, don't render the dropdown
  if (!hasMultipleTracks) {
    return null;
  }

  return (
    <div 
      className={styles.dropdownContainer} 
      ref={dropdownRef}
      style={{ zIndex: getZIndex() }}
    >
      <button 
        className={`${styles.dropdownToggle} ${isExpanded ? styles.expanded : ''} ${isInCrossfade ? styles.crossfading : ''}`}
        onClick={toggleDropdown}
        disabled={isInCrossfade}
        type="button"
        ref={toggleButtonRef}
        aria-haspopup="true"
        aria-expanded={isExpanded}
      >
        <span className={styles.currentTrack}>
          {isInCrossfade ? renderCrossfadeStatus() : getActiveTrackName()}
        </span>
        <span className={styles.arrowIcon}>▼</span>
      </button>
      
      {isExpanded && (
        <>
          {/* Semi-transparent overlay to capture clicks outside menu */}
          <div 
            className={styles.menuOverlay} 
            onClick={() => setIsExpanded(false)}
            style={{ zIndex: getZIndex() - 1 }}
          />
          
          {/* Dropdown menu */}
          <ul 
            className={styles.dropdownMenu}
            ref={menuRef}
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              width: menuPosition.width ? `${menuPosition.width}px` : undefined,
              zIndex: getZIndex() + 5 // Ensure menu is above overlay
            }}
            role="menu"
          >
            {audioLibrary[layer].map((track) => {
              const isActive = activeAudio[layer] === track.id;
              const isPreloading = preloadProgress && 
                preloadProgress[track.id] !== undefined && 
                preloadProgress[track.id] < 100;
              
              return (
                <li 
                  key={track.id}
                  className={`${styles.dropdownItem} ${isActive ? styles.active : ''}`}
                  onClick={(e) => handleTrackSelect(e, track.id)}
                  role="menuitem"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleTrackSelect(e, track.id);
                    }
                  }}
                >
                  <span className={styles.trackName}>{track.name}</span>
                  {isActive && <span className={styles.activeIndicator}>✓</span>}
                  {isPreloading && (
                    <span className={styles.preloadingIndicator}>
                      {preloadProgress[track.id]}%
                    </span>
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

// Use memo to prevent unnecessary re-renders
export default memo(LayerDropdown);