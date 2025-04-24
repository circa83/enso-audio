// src/contexts/AudioContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AudioService from '../services/AudioService';
import eventBus, { EVENTS } from '../services/EventBus.js';

// Create the context
const AudioContext = createContext(null);

/**
 * Provider component for core audio functionality
 * Manages Web Audio API context and audio playback
 */
export const AudioProvider = ({ 
  children, 
  initialVolume = 0.8,
  autoResume = true,
  enableLogging = false
}) => {
  // Service reference
  const [audioService, setAudioService] = useState(null);
  
  // Audio context state
  const [audioContext, setAudioContext] = useState(null);
  const [masterGain, setMasterGain] = useState(null);
  const [analyzer, setAnalyzer] = useState(null);
  
  // Audio state
  const [initialized, setInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [masterVolume, setMasterVolume] = useState(initialVolume);
  const [suspended, setSuspended] = useState(true);
  
  // Audio elements tracking
  const [audioElements, setAudioElements] = useState({});
  
  // Refs for preventing race conditions
  const isPlayingRef = useRef(false);
  
  // Initialize AudioService
  useEffect(() => {
    console.log('[AudioContext] Initializing AudioService...');
    
    try {
      const service = new AudioService({
        initialVolume,
        autoResume,
        enableLogging
      });
      
      // Initialize the AudioService
      service.initialize().then(success => {
        if (success) {
          console.log('[AudioContext] AudioService initialized successfully');
          
          // Get and store audio context and nodes
          const ctx = service.getContext();
          const gain = service.getMasterGain();
          const anlz = service.getAnalyzer();
          
          setAudioContext(ctx);
          setMasterGain(gain);
          setAnalyzer(anlz);
          setAudioService(service);
          setInitialized(true);
          setIsLoading(false);
          setSuspended(service.isSuspended());
          
          // Publish event through event bus
          eventBus.emit(EVENTS.AUDIO_INITIALIZED || 'audio:initialized', { 
            context: ctx, 
            masterGain: gain, 
            timestamp: Date.now() });
        } else {
          console.error('[AudioContext] Failed to initialize AudioService');
          setIsLoading(false);
        }
      }).catch(error => {
        console.error('[AudioContext] Error initializing AudioService:', error);
        setIsLoading(false);
      });
      
      // Clean up on unmount
      return () => {
        if (service && typeof service.cleanup === 'function') {
          console.log('[AudioContext] Cleaning up AudioService');
          service.cleanup();
        }
      };
    } catch (error) {
      console.error('[AudioContext] Error creating AudioService:', error);
      setIsLoading(false);
      return () => {};
    }
  }, [initialVolume, autoResume, enableLogging]);
  
  // Set master volume
  const handleSetMasterVolume = useCallback((value) => {
    if (!audioService) {
      console.error('[AudioContext] Cannot set master volume: AudioService not available');
      return false;
    }
    
    // Ensure value is within valid range
    const safeValue = Math.max(0, Math.min(1, value));
    
    try {
      const success = audioService.setMasterVolume(safeValue);
      
      if (success) {
        setMasterVolume(safeValue);
        
        // Publish event through event bus
        eventBus.emit( EVENTS.AUDIO_VOLUME_CHANGED || 'audio:volumeChanged', { 
          masterVolume: safeValue,
          timestamp: Date.now() });
      }
      
      return success;
    } catch (error) {
      console.error('[AudioContext] Error setting master volume:', error);
      return false;
    }
  }, [audioService]);
  
  // Start playback
  const handleStartPlayback = useCallback(async () => {
    if (!audioService) {
      console.error('[AudioContext] Cannot start playback: AudioService not available');
      return false;
    }
    
    // Use ref for current state check to avoid race conditions
    if (isPlayingRef.current) {
      console.log('[AudioContext] Already playing, ignoring start request');
      return true; // Return true since it's already in the desired state
    }
    
    try {
      console.log('[AudioContext] Starting playback...');
      
      // Resume the audio context
      const resumed = await audioService.resume();
      
      if (resumed) {
        // Update state
        isPlayingRef.current = true;
        setIsPlaying(true);
        setSuspended(false);
        
        // Publish event through event bus
        eventBus.emit(EVENTS.AUDIO_PLAYBACK_STARTED || 'audio:playbackStarted', { 
          timestamp: Date.now() });
        
        return true;
      } else {
        console.error('[AudioContext] Failed to resume audio context');
        return false;
      }
    } catch (error) {
      console.error('[AudioContext] Error starting playback:', error);
      return false;
    }
  }, [audioService]);
  
  // Pause playback
  const handlePausePlayback = useCallback(async () => {
    if (!audioService) {
      console.error('[AudioContext] Cannot pause playback: AudioService not available');
      return false;
    }
    
    // Use ref for current state check to avoid race conditions
    if (!isPlayingRef.current) {
      console.log('[AudioContext] Not playing, ignoring pause request');
      return true; // Return true since it's already in the desired state
    }
    
    try {
      console.log('[AudioContext] Pausing playback...');
      
      // Suspend the audio context
      const suspended = await audioService.suspend();
      
      if (suspended) {
        // Update state
        isPlayingRef.current = false;
        setIsPlaying(false);
        setSuspended(true);
        
        // Publish event through event bus
        eventBus.emit(EVENTS.AUDIO_PLAYBACK_PAUSED || 'audio:playbackPaused', { 
          timestamp: Date.now() });
        
        return true;
      } else {
        console.error('[AudioContext] Failed to suspend audio context');
        return false;
      }
    } catch (error) {
      console.error('[AudioContext] Error pausing playback:', error);
      return false;
    }
  }, [audioService]);
  
  // Register audio elements
  const handleRegisterElements = useCallback((elements) => {
    if (!audioService) {
      console.error('[AudioContext] Cannot register elements: AudioService not available');
      return false;
    }
    
    try {
      const success = audioService.registerElements(elements);
      
      if (success) {
        setAudioElements(elements);
      }
      
      return success;
    } catch (error) {
      console.error('[AudioContext] Error registering audio elements:', error);
      return false;
    }
  }, [audioService]);
  
  // Update a single audio element
  const handleUpdateElement = useCallback((layer, trackId, elementData) => {
    if (!audioService) {
      console.error('[AudioContext] Cannot update element: AudioService not available');
      return false;
    }
    
    try {
      const success = audioService.updateElement(layer, trackId, elementData);
      
      if (success) {
        setAudioElements(prev => {
          const updated = {...prev};
          
          if (!updated[layer]) {
            updated[layer] = {};
          }
          
          updated[layer][trackId] = elementData;
          
          return updated;
        });
      }
      
      return success;
    } catch (error) {
      console.error('[AudioContext] Error updating audio element:', error);
      return false;
    }
  }, [audioService]);
  
  // Get all audio elements
  const handleGetElements = useCallback(() => {
    if (!audioService) {
      console.error('[AudioContext] Cannot get elements: AudioService not available');
      return {};
    }
    
    try {
      return audioService.getElements() || {};
    } catch (error) {
      console.error('[AudioContext] Error getting audio elements:', error);
      return {};
    }
  }, [audioService]);
  
  // Create memoized context value
  const contextValue = useMemo(() => ({
    // Core audio objects
    audioContext,
    masterGain,
    analyzer,
    service: audioService,
    
    // State
    initialized,
    isLoading,
    isPlaying,
    masterVolume,
    suspended,
    audioElements,
    
    // Methods
    setMasterVolume: handleSetMasterVolume,
    startPlayback: handleStartPlayback,
    pausePlayback: handlePausePlayback,
    registerElements: handleRegisterElements,
    updateElement: handleUpdateElement,
    getElements: handleGetElements
  }), [
    audioContext,
    masterGain,
    analyzer,
    audioService,
    initialized,
    isLoading,
    isPlaying,
    masterVolume,
    suspended,
    audioElements,
    handleSetMasterVolume,
    handleStartPlayback,
    handlePausePlayback,
    handleRegisterElements,
    handleUpdateElement,
    handleGetElements
  ]);
  
  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  );
};

/**
 * Custom hook to use the audio context
 * @returns {Object} Audio context value
 */
export const useAudioContext = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudioContext must be used within an AudioProvider');
  }
  return context;
};

/**
 * Access the audio service directly (for service-to-service integration)
 * @returns {Object|null} Audio service instance
 */
export const useAudioService = () => {
  const context = useContext(AudioContext);
  if (!context) {
    console.warn('useAudioService called outside of AudioProvider');
    return null;
  }
  return context.service;
};

export default AudioContext;
