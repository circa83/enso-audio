// src/pages/tests/audio-debug.js
import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useAudio } from '../../contexts/StreamingAudioContext';

// Simple debugging component with minimal styling
export default function AudioDebug() {
  const audioContext = useAudio();
  const {
    LAYERS,
    isLoading,
    loadingProgress,
    isPlaying,
    volumes,
    startSession,
    pauseSession
  } = audioContext;
  
  // Keep a local log that won't be affected by React re-renders
  const [debugLog, setDebugLog] = useState([]);
  const [localPlayState, setLocalPlayState] = useState(false);
  
  // Use refs to track state changes for accurate reporting in timeouts
  const isPlayingStateRef = useRef(isPlaying);
  const localPlayStateRef = useRef(localPlayState);
  
  // Update refs when states change
  useEffect(() => {
    isPlayingStateRef.current = isPlaying;
    // Also log when the state changes
    log(`isPlaying state changed to: ${isPlaying}`);
  }, [isPlaying]);
  
  useEffect(() => {
    localPlayStateRef.current = localPlayState;
  }, [localPlayState]);
  
  // Keep references to actual AudioElements for direct checking
  const audioElementRefs = useRef(null);
  
  // Add log message with timestamp
  const log = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog(prev => [...prev, `${timestamp}: ${message}`]);
  };
  
  // Copy log to clipboard
  const copyLog = () => {
    const text = debugLog.join('\n');
    navigator.clipboard.writeText(text)
      .then(() => alert('Log copied to clipboard'))
      .catch(err => alert('Failed to copy: ' + err));
  };
  
  // Clear the log
  const clearLog = () => {
    setDebugLog([]);
  };
  
  // Direct inspection of the AudioContext internals 
  // This accesses private implementation details for debugging purposes
  const inspectAudioState = () => {
    try {
      // Always get the current state from the ref to avoid closure issues
      log(`React State - isPlaying: ${isPlayingStateRef.current}`);
      
      // Try to access the actual audio elements through the context
      // This is hacky debugging that depends on the implementation
      const contextObj = audioContext;
      log(`Context has keys: ${Object.keys(contextObj).join(', ')}`);
      
      // Examine individual layers
      Object.values(LAYERS).forEach(layer => {
        log(`Checking layer: ${layer}`);
        log(`Volume: ${volumes[layer]}`);
      });
      
      if (window._debugAudioElements) {
        // If we have direct access to audio elements (set up in startPlayback)
        log('Inspecting actual audio elements:');
        Object.entries(window._debugAudioElements).forEach(([key, elem]) => {
          if (elem) {
            log(`Audio '${key}': paused=${elem.paused}, currentTime=${elem.currentTime.toFixed(2)}, duration=${elem.duration?.toFixed(2) || 'unknown'}`);
          } else {
            log(`Audio '${key}': not available`);
          }
        });
      } else {
        log('Inspecting actual audio elements:');
      }
      
      // Check if window has the audio context
      if (window.AudioContext || window.webkitAudioContext) {
        log('AudioContext API is available in this browser');
      } else {
        log('AudioContext API is NOT available in this browser');
      }
    } catch (error) {
      log(`Error inspecting audio state: ${error.message}`);
      console.error('Inspection error:', error);
    }
  };
  
  // Direct play function that hooks into the react state
  const startPlayback = () => {
    try {
      log('Attempting to start playback...');
      
      // Store the current state for comparison
      const beforeState = isPlayingStateRef.current;
      log(`Before startSession - isPlaying: ${beforeState}`);
      
      // Call the context function to start
      startSession();
      
      // Log immediately after
      log(`After startSession call - isPlaying: ${isPlayingStateRef.current}`);
      
      // Set a flag for our own tracking
      setLocalPlayState(true);
      
      // Set up interval to directly check audio element state
      const checkInterval = setInterval(() => {
        // Try to capture references to actual audio elements for direct inspection
        try {
          // This approach depends on the implementation details and may be fragile
          // It's just for debugging purposes
          const audioElements = {};
          const elements = document.querySelectorAll('audio');
          elements.forEach((elem, i) => {
            audioElements[`audio_${i}`] = elem;
          });
          window._debugAudioElements = audioElements;
        } catch (e) {
          console.error("Couldn't access audio elements:", e);
        }
      }, 1000);
      
      // Clean up interval and check state after 5 seconds
      // This timeout properly uses refs to get current values
      setTimeout(() => {
        clearInterval(checkInterval);
        // Check current state values from refs
        log(`5 seconds after start - isPlaying: ${isPlayingStateRef.current}, localState: ${localPlayStateRef.current}`);
        inspectAudioState();
      }, 5000);
      
    } catch (error) {
      log(`Error starting playback: ${error.message}`);
      console.error('Playback error:', error);
    }
  };
  
  // Direct pause function
  const stopPlayback = () => {
    try {
      log('Attempting to pause playback...');
      
      // Store the current state for comparison
      const beforeState = isPlayingStateRef.current;
      log(`Before pauseSession - isPlaying: ${beforeState}`);
      
      // Call the context function to pause
      pauseSession();
      
      // Log immediately after
      log(`After pauseSession call - isPlaying: ${isPlayingStateRef.current}`);
      
      // Set a flag for our own tracking
      setLocalPlayState(false);
      
      // Check state after 2 seconds - using refs for current values
      setTimeout(() => {
        log(`2 seconds after pause - isPlaying: ${isPlayingStateRef.current}, localState: ${localPlayStateRef.current}`);
        inspectAudioState();
      }, 2000);
      
    } catch (error) {
      log(`Error pausing playback: ${error.message}`);
      console.error('Pause error:', error);
    }
  };

  // Simple styles for the debug component
  const styles = {
    container: {
      maxWidth: '1000px',
      margin: '20px auto',
      padding: '20px',
      backgroundColor: '#181818',
      color: '#eaeaea',
      fontFamily: 'monospace'
    },
    heading: {
      color: '#ffffff',
      fontSize: '1.5rem',
      marginBottom: '20px',
    },
    buttonContainer: {
      display: 'flex',
      gap: '10px',
      marginBottom: '20px',
    },
    button: {
      backgroundColor: '#222',
      border: '1px solid #555',
      color: '#fff',
      padding: '10px 15px',
      cursor: 'pointer',
    },
    log: {
      backgroundColor: '#111',
      border: '1px solid #333',
      padding: '10px',
      height: '500px',
      overflowY: 'auto',
      fontSize: '14px',
      lineHeight: 1.5,
      whiteSpace: 'pre-wrap',
    },
    info: {
      marginBottom: '20px',
      padding: '10px',
      backgroundColor: '#222',
      border: '1px solid #333',
    },
    loadingContainer: {
      textAlign: 'center',
      padding: '50px',
    },
    stateIndicator: {
      display: 'inline-block',
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      marginRight: '8px'
    }
  };
  
  // Log initial load
  useEffect(() => {
    log('Debug component mounted');
    log(`Initial state - isPlaying: ${isPlaying}, isLoading: ${isLoading}`);
    
    // Add browser info
    log(`Browser: ${navigator.userAgent}`);
    
    return () => {
      log('Debug component unmounting');
    };
  }, []);
  
  // Check for audio state inconsistencies
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (localPlayStateRef.current !== isPlayingStateRef.current) {
        log(`⚠️ State mismatch: localPlayState=${localPlayStateRef.current}, isPlaying=${isPlayingStateRef.current}`);
      }
    }, 2000);
    
    return () => clearInterval(intervalId);
  }, []);

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <h1 style={styles.heading}>Loading Audio System: {loadingProgress}%</h1>
        <p>Please wait for audio initialization...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <Head>
        <title>Ensō Audio - Debug</title>
      </Head>

      <h1 style={styles.heading}>Audio System Debug</h1>
      
      <div style={styles.info}>
        <p>
          <span 
            style={{
              ...styles.stateIndicator, 
              backgroundColor: isPlayingStateRef.current ? '#4CAF50' : '#F44336'
            }}
          ></span>
          <strong>Current State:</strong> {isPlayingStateRef.current ? 'PLAYING' : 'PAUSED'}
        </p>
        <p>
          <span 
            style={{
              ...styles.stateIndicator, 
              backgroundColor: localPlayStateRef.current ? '#4CAF50' : '#F44336'
            }}
          ></span>
          <strong>Local State:</strong> {localPlayStateRef.current ? 'PLAYING' : 'PAUSED'}
        </p>
        <p><strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}</p>
      </div>
      
      <div style={styles.buttonContainer}>
        <button 
          style={{
            ...styles.button,
            backgroundColor: isPlayingStateRef.current ? '#F44336' : '#4CAF50'
          }} 
          onClick={isPlayingStateRef.current ? stopPlayback : startPlayback}
        >
          {isPlayingStateRef.current ? 'Stop Playback' : 'Start Playback'}
        </button>
        <button style={styles.button} onClick={inspectAudioState}>
          Inspect Audio State
        </button>
      </div>
      
      <div style={styles.buttonContainer}>
        <button style={styles.button} onClick={copyLog}>
          Copy Log
        </button>
        <button style={styles.button} onClick={clearLog}>
          Clear Log
        </button>
      </div>
      
      <div style={styles.log}>
        {debugLog.map((entry, i) => (
          <div key={i}>{entry}</div>
        ))}
      </div>
    </div>
  );
}