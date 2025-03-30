// src/pages/tests/MasterDebugPanel.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useAudio } from '../../contexts/StreamingAudioContext';
import styles from '../../styles/pages/MasterDebugPanel.module.css';

// Debug panel sections
const DEBUG_SECTIONS = {
  AUDIO_STATE: 'audio-state',
  PLAYBACK_TEST: 'playback-test',
  CROSSFADE_TEST: 'crossfade-test',
  BUFFER_STATS: 'buffer-stats',
  TIMELINE_DEBUG: 'timeline-debug',
  VOLUME_TEST: 'volume-test'
};

/**
 * MasterDebugPanel - Consolidated debugging interface for Ensō Audio
 * This component combines functionality from audio-debug.js, audio-test.js,
 * and crossfade-test.js into a unified debugging interface.
 */
export default function MasterDebugPanel() {
  // Access to audio context
  const {
    LAYERS,
    isLoading,
    loadingProgress,
    isPlaying,
    volumes,
    activeAudio,
    audioLibrary,
    hasSwitchableAudio,
    crossfadeProgress,
    activeCrossfades,
    preloadProgress,
    masterVolume,
    setMasterVolumeLevel,
    setVolume,
    startSession,
    pauseSession,
    crossfadeTo,
    preloadAudio,
    getSessionTime
  } = useAudio();

  // Component state
  const [activeSection, setActiveSection] = useState(DEBUG_SECTIONS.AUDIO_STATE);
  const [debugLog, setDebugLog] = useState([]);
  const [sessionTime, setSessionTime] = useState(0);
  const [testResults, setTestResults] = useState({});
  const [crossfadeSpeed, setCrossfadeSpeed] = useState(2000);
  const [browserInfo, setBrowserInfo] = useState(null);

  // Reference to track actual playing state to avoid closure issues
  const isPlayingRef = useRef(isPlaying);
  const audioElementsRef = useRef({});

  // Update ref when isPlaying changes
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    // Log state changes
    log(`isPlaying state changed to: ${isPlaying}`);
  }, [isPlaying]);

  // Update session time when playing
  useEffect(() => {
    let intervalId = null;
    
    if (isPlaying) {
      intervalId = setInterval(() => {
        const time = getSessionTime();
        if (time !== undefined && time !== null) {
          setSessionTime(time);
        }
      }, 1000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPlaying, getSessionTime]);

  // Collect browser information on mount
  useEffect(() => {
    setBrowserInfo({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
      audioContextSupported: !!(window.AudioContext || window.webkitAudioContext),
      screenSize: `${window.innerWidth}x${window.innerHeight}`
    });

    log('Debug panel initialized');
    log(`Browser: ${navigator.userAgent}`);
    
    // Try to capture references to actual audio elements
    const checkAudioElements = () => {
      const elements = document.querySelectorAll('audio');
      const audioElements = {};
      
      elements.forEach((elem, i) => {
        audioElements[`audio_${i}`] = elem;
      });
      
      audioElementsRef.current = audioElements;
      window._debugAudioElements = audioElements; // For console access
    };
    
    // Set up interval to periodically check audio elements
    const intervalId = setInterval(checkAudioElements, 2000);
    
    return () => {
      clearInterval(intervalId);
      log('Debug panel unmounting');
    };
  }, []);

  // Add log message with timestamp
  const log = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog(prev => [...prev, { message, timestamp, type }]);
  }, []);

  // Clear the log
  const clearLog = useCallback(() => {
    setDebugLog([]);
  }, []);

  // Format milliseconds to readable time
  const formatTime = useCallback((ms) => {
    if (!ms) return '00:00:00';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor((seconds % 3600) / 60);
    const hours = Math.floor(seconds / 3600);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds % 60 < 10 ? '0' : ''}${seconds % 60}`;
  }, []);

  // Copy log to clipboard
  const copyLog = useCallback(() => {
    const text = debugLog.map(entry => `[${entry.timestamp}] [${entry.type}] ${entry.message}`).join('\n');
    navigator.clipboard.writeText(text)
      .then(() => alert('Log copied to clipboard'))
      .catch(err => alert('Failed to copy: ' + err));
  }, [debugLog]);

  // Inspect the current audio state
  const inspectAudioState = useCallback(() => {
    log('Inspecting audio state...', 'test');
    
    // Log current React state
    log(`React State - isPlaying: ${isPlayingRef.current}`);
    log(`Master Volume: ${masterVolume * 100}%`);
    
    // Log active audio
    Object.entries(activeAudio).forEach(([layer, trackId]) => {
      log(`Active Track - ${layer}: ${trackId}`);
    });
    
    // Log volumes
    Object.entries(volumes).forEach(([layer, volume]) => {
      log(`Volume - ${layer}: ${Math.round(volume * 100)}%`);
    });
    
    // Log crossfades
    const activeCrossfadeCount = Object.keys(activeCrossfades).length;
    if (activeCrossfadeCount > 0) {
      log(`Active Crossfades: ${activeCrossfadeCount}`, 'info');
      Object.entries(activeCrossfades).forEach(([layer, info]) => {
        if (info) {
          log(`  ${layer}: ${info.from} → ${info.to} (${Math.round((crossfadeProgress[layer] || 0) * 100)}%)`);
        }
      });
    } else {
      log('No active crossfades');
    }
    
    // Log audio elements
    try {
      log('Inspecting actual audio elements:');
      Object.entries(audioElementsRef.current).forEach(([key, elem]) => {
        if (elem) {
          log(`Audio '${key}': paused=${elem.paused}, currentTime=${elem.currentTime.toFixed(2)}, duration=${elem.duration?.toFixed(2) || 'unknown'}`);
        }
      });
    } catch (e) {
      log(`Error inspecting audio elements: ${e.message}`, 'error');
    }
    
    // Check browser audio support
    if (window.AudioContext || window.webkitAudioContext) {
      log('AudioContext API is available in this browser', 'success');
    } else {
      log('AudioContext API is NOT available in this browser', 'error');
    }
    
    // Check for memory info
    if (window.performance && window.performance.memory) {
      const memory = window.performance.memory;
      log(`Memory - Used JS Heap: ${Math.round(memory.usedJSHeapSize / (1024 * 1024))} MB / ${Math.round(memory.jsHeapSizeLimit / (1024 * 1024))} MB`);
    }
    
    log('Audio state inspection complete', 'success');
    
  }, [log, masterVolume, activeAudio, volumes, activeCrossfades, crossfadeProgress]);

  // Test basic playback
  const testBasicPlayback = useCallback(async () => {
    log('Starting Basic Playback Test', 'test');
    
    try {
      // First ensure we're stopped
      if (isPlaying) {
        pauseSession();
        log('Paused existing playback');
        // Wait a moment for pause to take effect
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Start playback
      log('Starting audio playback');
      startSession();
      
      // Wait for playback to initialize (3 seconds)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check current state
      const playingCheck = isPlayingRef.current;
      log(`Current playback state is: ${playingCheck ? 'playing' : 'paused'}`);
      
      if (playingCheck) {
        log('✅ Playback started successfully', 'success');
        
        // Pause playback
        log('Testing pause functionality');
        pauseSession();
        
        // Wait for pause to take effect
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check current state
        const pausedCheck = !isPlayingRef.current;
        log(`After pause, playback state is: ${!pausedCheck ? 'still playing' : 'paused'}`);
        
        if (pausedCheck) {
          log('✅ Pause functionality working', 'success');
          setTestResults(prev => ({
            ...prev,
            basicPlayback: true
          }));
        } else {
          log('❌ Pause functionality failed', 'error');
          setTestResults(prev => ({
            ...prev,
            basicPlayback: false
          }));
        }
      } else {
        log('❌ Playback failed to start', 'error');
        setTestResults(prev => ({
            ...prev,
            basicPlayback: false
        }));
      }
    } catch (error) {
      log(`❌ Test error: ${error.message}`, 'error');
      setTestResults(prev => ({
        ...prev,
        basicPlayback: false
      }));
    }
  }, [isPlaying, pauseSession, startSession, log, isPlayingRef]);

  // Test volume control
  const testVolumeControl = useCallback(async () => {
    log('Starting Volume Control Test', 'test');
    
    try {
      // Start playback if not already playing
      if (!isPlaying) {
        startSession();
        log('Started playback for volume test');
        // Wait for audio to start
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Test each layer
      for (const layer of Object.values(LAYERS)) {
        log(`Testing volume control for ${layer} layer`);
        
        // Get initial volume
        const initialVolume = volumes[layer];
        log(`Initial ${layer} volume: ${Math.round(initialVolume * 100)}%`);
        
        // Set to zero
        log(`Setting ${layer} volume to 0%`);
        setVolume(layer, 0);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Set to 100%
        log(`Setting ${layer} volume to 100%`);
        setVolume(layer, 1);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Restore original
        log(`Restoring ${layer} volume to ${Math.round(initialVolume * 100)}%`);
        setVolume(layer, initialVolume);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Test master volume
      log('Testing master volume control');
      const initialMasterVolume = masterVolume;
      
      log(`Initial master volume: ${Math.round(initialMasterVolume * 100)}%`);
      log('Setting master volume to 50%');
      setMasterVolumeLevel(0.5);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      log('Setting master volume to 100%');
      setMasterVolumeLevel(1.0);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      log(`Restoring master volume to ${Math.round(initialMasterVolume * 100)}%`);
      setMasterVolumeLevel(initialMasterVolume);
      
      log('✅ Volume control test completed', 'success');
      setTestResults(prev => ({
        ...prev,
        volumeControl: true
      }));
    } catch (error) {
      log(`❌ Volume test error: ${error.message}`, 'error');
      setTestResults(prev => ({
        ...prev,
        volumeControl: false
      }));
    }
  }, [LAYERS, volumes, masterVolume, isPlaying, startSession, setVolume, setMasterVolumeLevel, log]);

  // Test crossfading
  const testCrossfading = useCallback(async () => {
    log('Starting Crossfading Test', 'test');
    log(`Using crossfade duration: ${crossfadeSpeed}ms`);
    
    try {
      if (hasSwitchableAudio) {
        // Start playback if not already playing
        if (!isPlaying) {
          startSession();
          log('Started playback for crossfade test');
          // Wait for audio to start
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Test each layer
        for (const layer of Object.values(LAYERS)) {
          log(`Testing crossfade for ${layer} layer`);
          
          // Get available tracks for this layer
          const tracks = audioLibrary[layer];
          
          if (tracks && tracks.length > 1) {
            // Get current active track
            const currentTrackId = activeAudio[layer];
            
            // Find a different track to crossfade to
            const differentTrack = tracks.find(track => track.id !== currentTrackId);
            
            if (differentTrack) {
              log(`Crossfading from ${currentTrackId} to ${differentTrack.id}`);
              
              // Perform crossfade
              await crossfadeTo(layer, differentTrack.id, crossfadeSpeed);
              
              // Wait for crossfade to complete
              await new Promise(resolve => setTimeout(resolve, crossfadeSpeed + 1000));
              
              // Check if active audio changed
              if (activeAudio[layer] === differentTrack.id) {
                log(`✅ Crossfade to ${differentTrack.id} successful`, 'success');
                
                // Crossfade back to original
                log(`Crossfading back to ${currentTrackId}`);
                await crossfadeTo(layer, currentTrackId, crossfadeSpeed);
                
                // Wait for crossfade to complete
                await new Promise(resolve => setTimeout(resolve, crossfadeSpeed + 1000));
                
                // Check if active audio changed back
                if (activeAudio[layer] === currentTrackId) {
                  log(`✅ Crossfade back to ${currentTrackId} successful`, 'success');
                } else {
                  log(`❌ Crossfade back to ${currentTrackId} failed`, 'error');
                }
              } else {
                log(`❌ Crossfade to ${differentTrack.id} failed`, 'error');
              }
            } else {
              log(`❌ Could not find a different track for ${layer}`, 'error');
            }
          } else {
            log(`❌ Not enough tracks for ${layer} to test crossfading`, 'error');
          }
        }
        
        log('✅ Crossfade test completed', 'success');
        setTestResults(prev => ({
          ...prev,
          crossfading: true
        }));
      } else {
        log('❌ Switchable audio not available, cannot test crossfading', 'error');
        setTestResults(prev => ({
          ...prev,
          crossfading: false
        }));
      }
    } catch (error) {
      log(`❌ Crossfade test error: ${error.message}`, 'error');
      setTestResults(prev => ({
        ...prev,
        crossfading: false
      }));
    }
  }, [
    LAYERS,
    audioLibrary,
    activeAudio,
    crossfadeSpeed,
    hasSwitchableAudio,
    isPlaying,
    startSession,
    crossfadeTo,
    log
  ]);

  // Test buffer loading
  const testBufferLoading = useCallback(async () => {
    log('Starting Buffer Loading Test', 'test');
    
    try {
      if (hasSwitchableAudio) {
        // Test each layer
        for (const layer of Object.values(LAYERS)) {
          log(`Testing audio preloading for ${layer} layer`);
          
          // Get available tracks for this layer
          const tracks = audioLibrary[layer];
          
          if (tracks && tracks.length > 1) {
            // Get current active track
            const currentTrackId = activeAudio[layer];
            
            // Find a different track to preload
            const differentTrack = tracks.find(track => track.id !== currentTrackId);
            
            if (differentTrack) {
              log(`Preloading track ${differentTrack.id}`);
              
              // Perform preload
              const result = await preloadAudio(layer, differentTrack.id);
              
              if (result) {
                log(`✅ Preloading ${differentTrack.id} successful`, 'success');
              } else {
                log(`❌ Preloading ${differentTrack.id} failed`, 'error');
              }
            } else {
              log(`❌ Could not find a different track for ${layer}`, 'error');
            }
          } else {
            log(`❌ Not enough tracks for ${layer} to test preloading`, 'error');
          }
        }
        
        log('✅ Buffer loading test completed', 'success');
        setTestResults(prev => ({
          ...prev,
          bufferLoading: true
        }));
      } else {
        log('❌ Switchable audio not available, cannot test buffer loading', 'error');
        setTestResults(prev => ({
          ...prev,
          bufferLoading: false
        }));
      }
    } catch (error) {
      log(`❌ Buffer loading test error: ${error.message}`, 'error');
      setTestResults(prev => ({
        ...prev,
        bufferLoading: false
      }));
    }
  }, [LAYERS, audioLibrary, activeAudio, hasSwitchableAudio, preloadAudio, log]);

  // Test memory usage
  const testMemoryUsage = useCallback(async () => {
    log('Starting Memory Usage Test', 'test');
    
    try {
      if (window.performance && window.performance.memory) {
        const initialMemory = window.performance.memory.usedJSHeapSize;
        log(`Initial memory usage: ${Math.round(initialMemory / (1024 * 1024))} MB`);
        
        // Start playback if not already playing
        if (!isPlaying) {
          startSession();
          log('Started playback for memory test');
        }
        
        // Wait 10 seconds
        log('Monitoring memory for 10 seconds...');
        for (let i = 1; i <= 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (window.performance && window.performance.memory) {
            const currentMemory = window.performance.memory.usedJSHeapSize;
            log(`Memory after ${i}s: ${Math.round(currentMemory / (1024 * 1024))} MB`);
          }
        }
        
        // Final measurement
        if (window.performance && window.performance.memory) {
          const finalMemory = window.performance.memory.usedJSHeapSize;
          const difference = finalMemory - initialMemory;
          
          log(`Final memory usage: ${Math.round(finalMemory / (1024 * 1024))} MB`);
          log(`Change in memory: ${Math.round(difference / (1024 * 1024))} MB`);
          
          if (difference > 50 * 1024 * 1024) { // 50MB threshold
            log('❌ Significant memory increase detected', 'error');
            setTestResults(prev => ({
              ...prev,
              memoryUsage: false
            }));
          } else {
            log('✅ Memory usage appears stable', 'success');
            setTestResults(prev => ({
              ...prev,
              memoryUsage: true
            }));
          }
        } else {
          log('❌ Could not access memory performance API', 'error');
          setTestResults(prev => ({
            ...prev,
            memoryUsage: 'unknown'
          }));
        }
      } else {
        log('❌ Memory performance API not available in this browser', 'error');
        setTestResults(prev => ({
          ...prev,
          memoryUsage: 'unknown'
        }));
      }
    } catch (error) {
      log(`❌ Memory test error: ${error.message}`, 'error');
      setTestResults(prev => ({
        ...prev,
        memoryUsage: false
      }));
    }
  }, [isPlaying, startSession, log]);

  // Run all tests
  const runAllTests = useCallback(async () => {
    clearLog();
    log('Starting All Tests', 'test');
    
    await testBasicPlayback();
    await testVolumeControl();
    
    if (hasSwitchableAudio) {
      await testCrossfading();
      await testBufferLoading();
    } else {
      log('⚠️ Skipping crossfading and buffer tests (not available)', 'warning');
    }
    
    await testMemoryUsage();
    
    log('All tests completed', 'success');
  }, [
    clearLog,
    testBasicPlayback,
    testVolumeControl,
    testCrossfading,
    testBufferLoading,
    testMemoryUsage,
    hasSwitchableAudio,
    log
  ]);

  // Render different sections based on active section
  const renderActiveSection = () => {
    switch (activeSection) {
      case DEBUG_SECTIONS.AUDIO_STATE:
        return renderAudioStateSection();
      case DEBUG_SECTIONS.PLAYBACK_TEST:
        return renderPlaybackTestSection();
      case DEBUG_SECTIONS.CROSSFADE_TEST:
        return renderCrossfadeTestSection();
      case DEBUG_SECTIONS.BUFFER_STATS:
        return renderBufferStatsSection();
      case DEBUG_SECTIONS.TIMELINE_DEBUG:
        return renderTimelineDebugSection();
      case DEBUG_SECTIONS.VOLUME_TEST:
        return renderVolumeTestSection();
      default:
        return renderAudioStateSection();
    }
  };

  // Render audio state section
  const renderAudioStateSection = () => (
    <>
      <div className={styles.testSettings}>
        <h3>Current Audio State</h3>
        
        <div className={styles.playbackStatus}>
          <p>
            <strong>Playback State:</strong> {isPlaying ? 'Playing' : 'Paused'}
          </p>
          <p>
            <strong>Session Time:</strong> {formatTime(sessionTime)}
          </p>
          <p>
            <strong>Master Volume:</strong> {Math.round(masterVolume * 100)}%
          </p>
          
          <div className={styles.layerInfo}>
            <h4>Layers:</h4>
            <ul>
              {Object.values(LAYERS).map(layer => (
                <li key={layer}>
                  {layer}: {Math.round(volumes[layer] * 100)}% - 
                  Track: {activeAudio[layer] || 'None'}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      
      <div className={styles.testButtons}>
        <button 
          className={styles.testButton} 
          onClick={inspectAudioState}
        >
          Refresh Audio State
        </button>
        
        <button
          className={`${styles.controlButton} ${isPlaying ? styles.stop : styles.play}`}
          onClick={() => isPlaying ? pauseSession() : startSession()}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </button>
      </div>
      
      {browserInfo && (
        <div className={styles.testSettings}>
          <h3>Browser Information</h3>
          <p><strong>User Agent:</strong> {browserInfo.userAgent}</p>
          <p><strong>Platform:</strong> {browserInfo.platform}</p>
          <p><strong>Vendor:</strong> {browserInfo.vendor}</p>
          <p><strong>Screen Size:</strong> {browserInfo.screenSize}</p>
          <p><strong>AudioContext Support:</strong> {browserInfo.audioContextSupported ? 'Yes' : 'No'}</p>
        </div>
      )}
    </>
  );

  // Render playback test section
  const renderPlaybackTestSection = () => (
    <>
      <div className={styles.testSettings}>
        <h3>Playback Test Controls</h3>
      </div>
      
      <div className={styles.testButtons}>
        <button 
          className={styles.testButton} 
          onClick={testBasicPlayback}
        >
          Test Basic Playback
        </button>
        
        <button
          className={`${styles.controlButton} ${isPlaying ? styles.stop : styles.play}`}
          onClick={() => isPlaying ? pauseSession() : startSession()}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </button>
      </div>
      
      <div className={styles.playbackStatus}>
        <p>
          <strong>Current State:</strong> {isPlaying ? 'Playing' : 'Paused'}
        </p>
        <p>
          <strong>Session Time:</strong> {formatTime(sessionTime)}
        </p>
        
        <h4>Test Results:</h4>
        <p>
          <strong>Basic Playback:</strong> {
            testResults.basicPlayback === undefined ? 'Not tested' :
            testResults.basicPlayback ? '✅ Passed' : '❌ Failed'
          }
        </p>
      </div>
    </>
  );

  // Render crossfade test section
  const renderCrossfadeTestSection = () => (
    <>
      <div className={styles.testSettings}>
        <h3>Crossfade Test Settings</h3>
        
        <div className={styles.settingControl}>
          <label htmlFor="crossfade-speed">Crossfade Duration (ms):</label>
          <input 
            id="crossfade-speed"
            type="range" 
            min="500" 
            max="5000" 
            step="100" 
            value={crossfadeSpeed}
            onChange={(e) => setCrossfadeSpeed(parseInt(e.target.value))}
          />
          <span>{crossfadeSpeed}ms</span>
        </div>
      </div>
      
      <div className={styles.testButtons}>
        <button 
          className={styles.testButton} 
          onClick={testCrossfading}
          disabled={!hasSwitchableAudio}
        >
          Test Crossfading
        </button>
        
        <button 
          className={styles.testButton} 
          onClick={testBufferLoading}
          disabled={!hasSwitchableAudio}
        >
          Test Buffer Loading
        </button>
      </div>
      
      {!hasSwitchableAudio && (
        <div className={styles.testSettings}>
          <p style={{ color: '#ff6b6b' }}>
            Switchable audio is not available. Make sure variation audio files are loaded.
          </p>
        </div>
      )}
      
      <div className={styles.playbackStatus}>
        <h4>Active Crossfades:</h4>
        {Object.keys(activeCrossfades).length === 0 ? (
          <p>No active crossfades</p>
        ) : (
          <ul>
            {Object.entries(activeCrossfades).map(([layer, info]) => (
              <li key={layer}>
                {layer}: {info.from} → {info.to} ({Math.round((crossfadeProgress[layer] || 0) * 100)}%)
              </li>
            ))}
          </ul>
        )}
        
        <h4>Test Results:</h4>
        <p>
          <strong>Crossfading:</strong> {
            testResults.crossfading === undefined ? 'Not tested' :
            testResults.crossfading ? '✅ Passed' : '❌ Failed'
          }
        </p>
        <p>
          <strong>Buffer Loading:</strong> {
            testResults.bufferLoading === undefined ? 'Not tested' :
            testResults.bufferLoading ? '✅ Passed' : '❌ Failed'
          }
        </p>
      </div>
    </>
  );

  // Render buffer stats section
  const renderBufferStatsSection = () => (
    <>
      <div className={styles.testSettings}>
        <h3>Buffer Statistics</h3>
        <p>Information about audio buffer loading and management</p>
      </div>
      
      <div className={styles.testButtons}>
        <button 
          className={styles.testButton} 
          onClick={testMemoryUsage}
        >
          Test Memory Usage
        </button>
      </div>
      
      <div className={styles.playbackStatus}>
        <h4>Preload Progress:</h4>
        {Object.keys(preloadProgress).length === 0 ? (
          <p>No active preloads</p>
        ) : (
          <ul>
            {Object.entries(preloadProgress).map(([trackId, progress]) => (
              <li key={trackId}>
                {trackId}: {progress}%
              </li>
            ))}
          </ul>
        )}
        
        <h4>Memory Test:</h4>
        <p>
          <strong>Memory Usage:</strong> {
            testResults.memoryUsage === undefined ? 'Not tested' :
            testResults.memoryUsage === 'unknown' ? '⚠️ Unknown' :
            testResults.memoryUsage ? '✅ Stable' : '❌ Unstable'
          }
        </p>
      </div>
    </>
  );

  // Render timeline debug section
  const renderTimelineDebugSection = () => (
    <>
      <div className={styles.testSettings}>
        <h3>Timeline Debugging</h3>
        <p>Monitor timeline events and phase transitions</p>
      </div>
      
      <div className={styles.playbackStatus}>
        <p><strong>Current Session Time:</strong> {formatTime(sessionTime)}</p>
        <p><strong>Active Phase:</strong> {activePhase || 'None'}</p>
        
        <div className={styles.timelineInfo}>
          <h4>Phase Markers:</h4>
          <div className={styles.phaseMarkers}>
            {/* This would connect to timeline phase data when implemented */}
            <p>Timeline phase debug info will display here when available</p>
          </div>
        </div>
      </div>
    </>
  );

  // Render volume test section
  const renderVolumeTestSection = () => (
    <>
      <div className={styles.testSettings}>
        <h3>Volume Control Testing</h3>
      </div>
      
      <div className={styles.testButtons}>
        <button 
          className={styles.testButton} 
          onClick={testVolumeControl}
        >
          Test Volume Controls
        </button>
      </div>
      
      <div className={styles.masterVolume}>
        <h4>Master Volume</h4>
        <div className={styles.volumeControl}>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={masterVolume}
            onChange={(e) => setMasterVolumeLevel(parseFloat(e.target.value))}
          />
          <span>{Math.round(masterVolume * 100)}%</span>
        </div>
      </div>
      
      <div className={styles.layerVolumes}>
        <h4>Layer Volumes</h4>
        {Object.entries(volumes).map(([layer, value]) => (
          <div key={layer} className={styles.volumeControl}>
            <label>{layer}:</label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={value}
              onChange={(e) => setVolume(layer, parseFloat(e.target.value))}
            />
            <span>{Math.round(value * 100)}%</span>
          </div>
        ))}
      </div>
      
      <div className={styles.testResults}>
        <h4>Test Results:</h4>
        <p>
          <strong>Volume Control:</strong> {
            testResults.volumeControl === undefined ? 'Not tested' :
            testResults.volumeControl ? '✅ Passed' : '❌ Failed'
          }
        </p>
      </div>
    </>
  );

  // If still loading, show loading screen
  if (isLoading) {
    return (
      <div className={styles.testContainer}>
        <Head>
          <title>Ensō Audio - Debug Panel</title>
        </Head>
        
        <h1 className={styles.testTitle}>Debug Panel</h1>
        
        <div className={styles.loadingInfo}>
          <h2>Loading Audio Engine: {loadingProgress}%</h2>
          <p>Please wait for the audio system to initialize</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.testContainer}>
      <Head>
        <title>Ensō Audio - Debug Panel</title>
      </Head>
      
      <h1 className={styles.testTitle}>Ensō Audio Debug Panel</h1>
      
      {/* Section navigation */}
      <div className={styles.sectionNav}>
        {Object.entries(DEBUG_SECTIONS).map(([key, value]) => (
          <button 
            key={key}
            className={`${styles.sectionButton} ${activeSection === value ? styles.activeSection : ''}`}
            onClick={() => setActiveSection(value)}
          >
            {key.replace('_', ' ')}
          </button>
        ))}
      </div>
      
      <div className={styles.testContent}>
        <div className={styles.testControls}>
          <h2 className={styles.sectionTitle}>{activeSection.replace('-', ' ')}</h2>
          
          {/* Run all tests button */}
          {activeSection !== DEBUG_SECTIONS.AUDIO_STATE && (
            <button 
              className={`${styles.testButton} ${styles.primary}`} 
              onClick={runAllTests}
            >
              Run All Tests
            </button>
          )}
          
          {/* Render active section content */}
          {renderActiveSection()}
          
          {/* Common playback controls */}
          <div className={styles.audioControls}>
            <button
              className={`${styles.controlButton} ${isPlaying ? styles.stop : styles.play}`}
              onClick={() => isPlaying ? pauseSession() : startSession()}
            >
              {isPlaying ? 'Stop' : 'Play'}
            </button>
          </div>
        </div>
        
        <div className={styles.testOutput}>
          <div className={styles.outputHeader}>
            <h2 className={styles.sectionTitle}>Debug Log</h2>
            <div className={styles.outputButtons}>
              <button 
                className={styles.copyButton}
                onClick={copyLog}
              >
                Copy Log
              </button>
              <button 
                className={styles.clearButton}
                onClick={clearLog}
              >
                Clear Log
              </button>
            </div>
          </div>
          
          <div className={styles.logMessages}>
            {debugLog.length === 0 ? (
              <p className={styles.noLogs}>No log entries yet</p>
            ) : (
              debugLog.map((entry, index) => (
                <div 
                  key={index} 
                  className={`${styles.logEntry} ${styles[entry.type]}`}
                >
                  <span className={styles.timestamp}>{entry.timestamp}</span>
                  <span className={styles.message}>{entry.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}