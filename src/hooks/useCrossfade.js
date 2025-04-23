// src/hooks/useCrossfade.js
import { useCallback, useMemo } from 'react';
import { useCrossfadeContext } from '../contexts/CrossfadeContext';
import { useAudio } from './useAudio';

/**
 * Hook for managing audio crossfades and track transitions
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.activeAudio - Current active audio tracks
 * @param {Object} options.audioLibrary - Available audio tracks library
 * @param {Function} options.onActiveAudioChange - Callback when active audio changes
 * @param {boolean} options.isPlaying - Whether audio is currently playing
 * @param {number} options.transitionDuration - Custom transition duration to override default
 * @returns {Object} Crossfade state and control functions
 */
export function useCrossfade(options = {}) {
  const {
    activeAudio = {},
    audioLibrary = {},
    onActiveAudioChange = null,
    isPlaying = false,
    transitionDuration = null,  // Will use context default if not specified
  } = options;

  // Get crossfade functionality from context
  const crossfade = useCrossfadeContext();
  
  // Get additional audio services and state from useAudio
  const { 
    getActiveSourceNode, 
    getActiveAudioElement,
    getOrCreateSourceNode,
    getOrCreateAudioElement
  } = useAudio();
  
  // Crossfade between audio tracks
  const crossfadeTo = useCallback(async (layer, newTrackId, fadeDuration = null) => {
    console.log(`[useCrossfade] Starting crossfade process for ${layer}: ${newTrackId}`);
    
    // Use provided duration, or options-level duration, or context default
    const actualDuration = fadeDuration !== null 
      ? fadeDuration 
      : (transitionDuration !== null ? transitionDuration : undefined);
      
    console.log(`[useCrossfade] Using transition duration: ${actualDuration || 'default'}ms`);
    
    // Find the current track ID from activeAudio
    const currentTrackId = activeAudio[layer];
    
    // Skip if already playing requested track
    if (currentTrackId === newTrackId) {
      console.log(`[useCrossfade] Already playing ${newTrackId} on ${layer}`);
      return true;
    }
    
    // Find the target track in library
    let libraryTrack = audioLibrary[layer]?.find(t => t.id === newTrackId);
    
    // If not found, create a fallback
    if (!libraryTrack) {
      console.log(`[useCrossfade] Track ${newTrackId} not found in library for layer ${layer}, creating fallback`);
      
      libraryTrack = {
        id: newTrackId,
        name: newTrackId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        path: `/samples/default/${layer.toLowerCase()}.mp3` // Fallback path
      };
    }
    
    // If we're not playing or have no current track, do an immediate switch
    if (!isPlaying || !currentTrackId) {
      console.log(`[useCrossfade] Not currently playing or no current track, using immediate switch instead of crossfade`);
      
      // Update active audio state immediately
      if (onActiveAudioChange) {
        onActiveAudioChange(layer, newTrackId);
      }
      
      console.log(`[useCrossfade] Immediate switch to ${newTrackId} successful for ${layer}`);
      return true;
    }
    
    try {
      // Get source and target audio nodes
      const sourceNode = getActiveSourceNode(layer);
      const sourceElement = getActiveAudioElement(layer);
      
      // Get or create target nodes
      const targetNode = getOrCreateSourceNode(layer, newTrackId);
      const targetElement = getOrCreateAudioElement(layer, newTrackId);
      
      if (!sourceNode || !targetNode) {
        console.error(`[useCrossfade] Could not get required audio nodes for ${layer}`);
        return false;
      }
      
      // Update active audio state before crossfade
      if (onActiveAudioChange) {
        onActiveAudioChange(layer, newTrackId);
      }
      
      // Execute the crossfade through the context
      const success = await crossfade.executeCrossfade({
        layer,
        sourceNode,
        sourceElement,
        targetNode,
        targetElement,
        fromTrackId: currentTrackId,
        toTrackId: newTrackId,
        duration: actualDuration,
        syncPosition: true
      });
      
      return success;
    } catch (error) {
      console.error(`[useCrossfade] Error during crossfade: ${error.message}`);
      return false;
    }
  }, [
    activeAudio, 
    audioLibrary, 
    isPlaying, 
    transitionDuration, 
    onActiveAudioChange,
    getActiveSourceNode,
    getActiveAudioElement,
    getOrCreateSourceNode,
    getOrCreateAudioElement,
    crossfade
  ]);

  // Preload audio using context's preloadAudio method
  const preloadAudio = useCallback(async (layer, trackId) => {
    if (!layer || !trackId) {
      console.error("[useCrossfade] Layer and trackId are required for preloading");
      return false;
    }
    
    try {
      // Find the track in library
      const track = audioLibrary[layer]?.find(t => t.id === trackId);
      console.log(`[useCrossfade] Preloading audio for ${layer}/${trackId}:`, track ? 'Found' : 'Not found', track);
      
      if (!track) {
        console.error(`[useCrossfade] Track ${trackId} not found in library`);
        return false;
      }
      
      // Use context's preloadAudio method
      return await crossfade.preloadAudio(track.path);
    } catch (error) {
      console.error(`[useCrossfade] Error preloading audio: ${error.message}`);
      return false;
    }
  }, [audioLibrary, crossfade]);

  // Cancel all active crossfades
  const cancelCrossfades = useCallback((options = {}) => {
    console.log("[useCrossfade] Cancelling all active crossfades");
    return crossfade.cancelCrossfades(options);
  }, [crossfade]);

  // Adjust volume during an active crossfade
  const adjustCrossfadeVolume = useCallback((layer, volume) => {
    console.log(`[useCrossfade] Adjusting crossfade volume for ${layer} to ${volume}`);
    return crossfade.adjustCrossfadeVolume(layer, volume);
  }, [crossfade]);

  // Return a consistent API that matches the original hook
  return useMemo(() => ({
    // State from context
    crossfadeProgress: crossfade.crossfadeProgress,
    activeCrossfades: crossfade.activeCrossfades,
    preloadProgress: crossfade.preloadProgress,
    
    // Methods
    crossfadeTo,
    preloadAudio,
    cancelCrossfades,
    adjustCrossfadeVolume,
    
    // Pass through methods from useAudio for audio element access
    getActiveSourceNode,
    getActiveAudioElement,
    getOrCreateSourceNode,
    getOrCreateAudioElement
  }), [
    crossfade.crossfadeProgress,
    crossfade.activeCrossfades,
    crossfade.preloadProgress,
    crossfadeTo,
    preloadAudio,
    cancelCrossfades,
    adjustCrossfadeVolume,
    getActiveSourceNode,
    getActiveAudioElement,
    getOrCreateSourceNode,
    getOrCreateAudioElement
  ]);
}

export default useCrossfade;
