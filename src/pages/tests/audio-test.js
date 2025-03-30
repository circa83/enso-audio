// src/pages/tests/audio-test.js
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useAudio } from '../../contexts/StreamingAudioContext';
import styles from '../../styles/pages/TestPage.module.css';
// At the top of the file
import './crossfade-test.js';

/**
 * AudioSystemTest - A component for testing Ensō Audio functionality
 * This page provides UI controls to test various aspects of the audio system
 */
export default function AudioSystemTest() {
  const { 
    LAYERS,
    isLoading,
    loadingProgress, 
    isPlaying, 
    volumes, 
    activeAudio,
    audioLibrary,
    hasSwitchableAudio,
    setVolume,
    startSession,
    pauseSession,
    crossfadeTo,
    preloadAudio,
    getSessionTime
  } = useAudio();
  
  // Test state
  const [sessionTime, setSessionTime] = useState(0);
  const [testResults, setTestResults] = useState({});
  const [testOutput, setTestOutput] = useState([]);
  const [crossfadeSpeed, setCrossfadeSpeed] = useState(2000);
  
  // Add log message to test output
  const logMessage = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setTestOutput(prev => [
      ...prev, 
      { message, timestamp, type }
    ]);
  };
  
  // Clear test output
  const clearLog = () => {
    setTestOutput([]);
  };
  
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
  
  // Format milliseconds to readable time
  const formatTime = (ms) => {
    if (!ms) return '00:00:00';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor((seconds % 3600) / 60);
    const hours = Math.floor(seconds / 3600);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds % 60 < 10 ? '0' : ''}${seconds % 60}`;
  };
  
  // Test 1: Basic Playback
  const testBasicPlayback = async () => {
    logMessage('Starting Basic Playback Test', 'test');
    
    try {
      // First ensure we're stopped
      if (isPlaying) {
        pauseSession();
        logMessage('Paused existing playback');
        // Wait a moment for pause to take effect
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Start playback
      logMessage('Starting audio playback');
      startSession();
      
      // Wait longer for playback to initialize (3 seconds instead of 2)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check current state manually
      const playingCheck = isPlaying;
      
      // Log the actual state for debugging
      logMessage(`Current playback state is: ${playingCheck ? 'playing' : 'paused'}`, 'info');
      
      if (playingCheck) {
        logMessage('✅ Playback started successfully', 'success');
        
        // Pause playback
        logMessage('Testing pause functionality');
        pauseSession();
        
        // Wait longer for pause to take effect
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check current state with a direct reference
        const pausedCheck = !isPlaying;
        
        // Log the actual state for debugging
        logMessage(`After pause, playback state is: ${!pausedCheck ? 'still playing' : 'paused'}`, 'info');
        
        if (pausedCheck) {
          logMessage('✅ Pause functionality working', 'success');
          setTestResults(prev => ({
            ...prev,
            basicPlayback: true
          }));
        } else {
          logMessage('❌ Pause functionality failed', 'error');
          logMessage('Issue: The app doesn\'t detect the paused state correctly', 'info');
          setTestResults(prev => ({
            ...prev,
            basicPlayback: false
          }));
        }
      } else {
        logMessage('❌ Playback failed to start', 'error');
        logMessage('Issue: The app doesn\'t detect the playing state correctly', 'info');
        setTestResults(prev => ({
            ...prev,
            basicPlayback: false
        }));
      }
    } catch (error) {
      logMessage(`❌ Test error: ${error.message}`, 'error');
      setTestResults(prev => ({
        ...prev,
        basicPlayback: false
      }));
    }
  };
  
  // Test 2: Volume Control
  const testVolumeControl = async () => {
    logMessage('Starting Volume Control Test', 'test');
    
    try {
      // Start playback if not already playing
      if (!isPlaying) {
        startSession();
        logMessage('Started playback for volume test');
        // Wait for audio to start
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Test each layer
      for (const layer of Object.values(LAYERS)) {
        logMessage(`Testing volume control for ${layer} layer`);
        
        // Get initial volume
        const initialVolume = volumes[layer];
        logMessage(`Initial ${layer} volume: ${Math.round(initialVolume * 100)}%`);
        
        // Set to zero
        logMessage(`Setting ${layer} volume to 0%`);
        setVolume(layer, 0);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Set to 100%
        logMessage(`Setting ${layer} volume to 100%`);
        setVolume(layer, 1);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Restore original
        logMessage(`Restoring ${layer} volume to ${Math.round(initialVolume * 100)}%`);
        setVolume(layer, initialVolume);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      logMessage('✅ Volume control test completed', 'success');
      setTestResults(prev => ({
        ...prev,
        volumeControl: true
      }));
    } catch (error) {
      logMessage(`❌ Volume test error: ${error.message}`, 'error');
      setTestResults(prev => ({
        ...prev,
        volumeControl: false
      }));
    }
  };
  
  // Test 3: Crossfading
  const testCrossfading = async () => {
    logMessage('Starting Crossfading Test', 'test');
    logMessage(`Using crossfade duration: ${crossfadeSpeed}ms`);
    
    try {
      if (hasSwitchableAudio) {
        // Start playback if not already playing
        if (!isPlaying) {
          startSession();
          logMessage('Started playback for crossfade test');
          // Wait for audio to start
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Test each layer
        for (const layer of Object.values(LAYERS)) {
          logMessage(`Testing crossfade for ${layer} layer`);
          
          // Get available tracks for this layer
          const tracks = audioLibrary[layer];
          
          if (tracks && tracks.length > 1) {
            // Get current active track
            const currentTrackId = activeAudio[layer];
            
            // Find a different track to crossfade to
            const differentTrack = tracks.find(track => track.id !== currentTrackId);
            
            if (differentTrack) {
              logMessage(`Crossfading from ${currentTrackId} to ${differentTrack.id}`);
              
              // Perform crossfade
              await crossfadeTo(layer, differentTrack.id, crossfadeSpeed);
              
              // Wait for crossfade to complete
              await new Promise(resolve => setTimeout(resolve, crossfadeSpeed + 1000));
              
              // Check if active audio changed
              if (activeAudio[layer] === differentTrack.id) {
                logMessage(`✅ Crossfade to ${differentTrack.id} successful`, 'success');
                
                // Crossfade back to original
                logMessage(`Crossfading back to ${currentTrackId}`);
                await crossfadeTo(layer, currentTrackId, crossfadeSpeed);
                
                // Wait for crossfade to complete
                await new Promise(resolve => setTimeout(resolve, crossfadeSpeed + 1000));
                
                // Check if active audio changed back
                if (activeAudio[layer] === currentTrackId) {
                  logMessage(`✅ Crossfade back to ${currentTrackId} successful`, 'success');
                } else {
                  logMessage(`❌ Crossfade back to ${currentTrackId} failed`, 'error');
                }
              } else {
                logMessage(`❌ Crossfade to ${differentTrack.id} failed`, 'error');
              }
            } else {
              logMessage(`❌ Could not find a different track for ${layer}`, 'error');
            }
          } else {
            logMessage(`❌ Not enough tracks for ${layer} to test crossfading`, 'error');
          }
        }
        
        logMessage('✅ Crossfade test completed', 'success');
        setTestResults(prev => ({
          ...prev,
          crossfading: true
        }));
      } else {
        logMessage('❌ Switchable audio not available, cannot test crossfading', 'error');
        setTestResults(prev => ({
          ...prev,
          crossfading: false
        }));
      }
    } catch (error) {
      logMessage(`❌ Crossfade test error: ${error.message}`, 'error');
      setTestResults(prev => ({
        ...prev,
        crossfading: false
      }));
    }
  };
  
  // Test 4: Audio Preloading
  const testPreloading = async () => {
    logMessage('Starting Audio Preloading Test', 'test');
    
    try {
      if (hasSwitchableAudio) {
        // Test each layer
        for (const layer of Object.values(LAYERS)) {
          logMessage(`Testing preloading for ${layer} layer`);
          
          // Get available tracks for this layer
          const tracks = audioLibrary[layer];
          
          if (tracks && tracks.length > 1) {
            // Get current active track
            const currentTrackId = activeAudio[layer];
            
            // Find a different track to preload
            const differentTrack = tracks.find(track => track.id !== currentTrackId);
            
            if (differentTrack) {
              logMessage(`Preloading track ${differentTrack.id}`);
              
              // Perform preload
              const result = await preloadAudio(layer, differentTrack.id);
              
              if (result) {
                logMessage(`✅ Preloading ${differentTrack.id} successful`, 'success');
              } else {
                logMessage(`❌ Preloading ${differentTrack.id} failed`, 'error');
              }
            } else {
              logMessage(`❌ Could not find a different track for ${layer}`, 'error');
            }
          } else {
            logMessage(`❌ Not enough tracks for ${layer} to test preloading`, 'error');
          }
        }
        
        logMessage('✅ Preloading test completed', 'success');
        setTestResults(prev => ({
          ...prev,
          preloading: true
        }));
      } else {
        logMessage('❌ Switchable audio not available, cannot test preloading', 'error');
        setTestResults(prev => ({
          ...prev,
          preloading: false
        }));
      }
    } catch (error) {
      logMessage(`❌ Preloading test error: ${error.message}`, 'error');
      setTestResults(prev => ({
        ...prev,
        preloading: false
      }));
    }
  };
  
  // Test 5: Memory Usage
  const testMemoryUsage = async () => {
    logMessage('Starting Memory Usage Test', 'test');
    
    try {
      if (window.performance && window.performance.memory) {
        const initialMemory = window.performance.memory.usedJSHeapSize;
        logMessage(`Initial memory usage: ${Math.round(initialMemory / (1024 * 1024))} MB`);
        
        // Start playback if not already playing
        if (!isPlaying) {
          startSession();
          logMessage('Started playback for memory test');
        }
        
        // Wait 10 seconds
        logMessage('Monitoring memory for 10 seconds...');
        for (let i = 1; i <= 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (window.performance && window.performance.memory) {
            const currentMemory = window.performance.memory.usedJSHeapSize;
            logMessage(`Memory after ${i}s: ${Math.round(currentMemory / (1024 * 1024))} MB`);
          }
        }
        
        // Final measurement
        if (window.performance && window.performance.memory) {
          const finalMemory = window.performance.memory.usedJSHeapSize;
          const difference = finalMemory - initialMemory;
          
          logMessage(`Final memory usage: ${Math.round(finalMemory / (1024 * 1024))} MB`);
          logMessage(`Change in memory: ${Math.round(difference / (1024 * 1024))} MB`);
          
          if (difference > 50 * 1024 * 1024) { // 50MB threshold
            logMessage('❌ Significant memory increase detected', 'error');
            setTestResults(prev => ({
              ...prev,
              memoryUsage: false
            }));
          } else {
            logMessage('✅ Memory usage appears stable', 'success');
            setTestResults(prev => ({
              ...prev,
              memoryUsage: true
            }));
          }
        } else {
          logMessage('❌ Could not access memory performance API', 'error');
          setTestResults(prev => ({
            ...prev,
            memoryUsage: 'unknown'
          }));
        }
      } else {
        logMessage('❌ Memory performance API not available in this browser', 'error');
        setTestResults(prev => ({
          ...prev,
          memoryUsage: 'unknown'
        }));
      }
    } catch (error) {
      logMessage(`❌ Memory test error: ${error.message}`, 'error');
      setTestResults(prev => ({
        ...prev,
        memoryUsage: false
      }));
    }
  };
  
  // Run all tests
  const runAllTests = async () => {
    clearLog();
    logMessage('Starting All Tests', 'test');
    
    await testBasicPlayback();
    await testVolumeControl();
    
    if (hasSwitchableAudio) {
      await testCrossfading();
      await testPreloading();
    } else {
      logMessage('⚠️ Skipping crossfading and preloading tests (not available)', 'warning');
    }
    
    await testMemoryUsage();
    
    logMessage('All tests completed', 'success');
  };
  
  return (
    <div className={styles.testContainer}>
      <Head>
        <title>Ensō Audio - System Tests</title>
      </Head>
      
      <h1 className={styles.testTitle}>Audio System Tests</h1>
      
      {isLoading ? (
        <div className={styles.loadingInfo}>
          <h2>Loading Audio Engine: {loadingProgress}%</h2>
          <p>Please wait for the audio system to initialize</p>
        </div>
      ) : (
        <div className={styles.testContent}>
          <div className={styles.testControls}>
            <h2 className={styles.sectionTitle}>Test Controls</h2>
            
            <div className={styles.testButtons}>
              <button 
                className={styles.testButton} 
                onClick={testBasicPlayback}
              >
                Test Basic Playback
              </button>
              
              <button 
                className={styles.testButton} 
                onClick={testVolumeControl}
              >
                Test Volume Control
              </button>
              
              {hasSwitchableAudio && (
                <>
                  <button 
                    className={styles.testButton} 
                    onClick={testCrossfading}
                  >
                    Test Crossfading
                  </button>
                  
                  <button 
                    className={styles.testButton} 
                    onClick={testPreloading}
                  >
                    Test Preloading
                  </button>
                </>
              )}
              
              <button 
                className={styles.testButton} 
                onClick={testMemoryUsage}
              >
                Test Memory Usage
              </button>
              
              <button 
                className={`${styles.testButton} ${styles.primary}`} 
                onClick={runAllTests}
              >
                Run All Tests
              </button>
            </div>
            
            <div className={styles.testSettings}>
              <h3>Test Settings</h3>
              
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
            
            <div className={styles.playbackStatus}>
              <h3>Playback Status</h3>
              <p>
                <strong>State:</strong> {isPlaying ? 'Playing' : 'Paused'}
              </p>
              <p>
                <strong>Session Time:</strong> {formatTime(sessionTime)}
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
              
              <div className={styles.audioControls}>
                <button
                  className={`${styles.controlButton} ${isPlaying ? styles.stop : styles.play}`}
                  onClick={() => isPlaying ? pauseSession() : startSession()}
                >
                  {isPlaying ? 'Stop' : 'Play'}
                </button>
              </div>
            </div>
          </div>
          
          <div className={styles.testOutput}>
            <div className={styles.outputHeader}>
              <h2 className={styles.sectionTitle}>Test Output</h2>
              <div className={styles.outputButtons}>
                <button 
                  className={styles.copyButton}
                  onClick={() => {
                    const logText = testOutput.map(entry => `${entry.timestamp} ${entry.message}`).join('\n');
                    navigator.clipboard.writeText(logText)
                      .then(() => alert('Log copied to clipboard!'))
                      .catch(err => console.error('Failed to copy log:', err));
                  }}
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
              {testOutput.length === 0 ? (
                <p className={styles.noLogs}>No test output yet</p>
              ) : (
                testOutput.map((entry, index) => (
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
      )}
    </div>
  );
}