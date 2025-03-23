// src/pages/tests/crossfade-test.js
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useAudio } from '../../contexts/StreamingAudioContext';

export default function CrossfadeTest() {
  const { 
    LAYERS,
    isLoading,
    loadingProgress,
    isPlaying,
    volumes,
    activeAudio,
    audioLibrary,
    hasSwitchableAudio,
    startSession,
    pauseSession,
    enhancedCrossfadeTo,
    testCrossfade
  } = useAudio();
  
  const [log, setLog] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState(LAYERS.DRONE);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [fadeDuration, setFadeDuration] = useState(2000);
  const [isTesting, setIsTesting] = useState(false);
  
  // Initialize selected track when active audio changes
  useEffect(() => {
    if (activeAudio[selectedLayer]) {
      setSelectedTrack(activeAudio[selectedLayer]);
    }
  }, [activeAudio, selectedLayer]);
  
  // Add log message with timestamp
  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLog(prev => [...prev, `${timestamp}: ${message}`]);
  };
  
  // Clear log
  const clearLog = () => {
    setLog([]);
  };
  
  // Copy log to clipboard
  const copyLog = () => {
    navigator.clipboard.writeText(log.join('\n'))
      .then(() => {
        alert('Log copied to clipboard');
      })
      .catch(err => {
        console.error('Failed to copy log', err);
      });
  };
  
  // Handle manual crossfade
  const handleCrossfade = async () => {
    if (!selectedTrack || selectedTrack === activeAudio[selectedLayer]) {
      addLog('Please select a different track to crossfade to');
      return;
    }
    
    addLog(`Starting crossfade to ${selectedTrack}`);
    
    try {
      // Start session if not playing
      if (!isPlaying) {
        addLog('Starting playback first');
        startSession();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Perform crossfade
      const result = await enhancedCrossfadeTo(selectedLayer, selectedTrack, fadeDuration);
      
      if (result) {
        addLog(`Crossfade to ${selectedTrack} successful`);
      } else {
        addLog(`Crossfade to ${selectedTrack} failed`);
      }
    } catch (error) {
      addLog(`Crossfade error: ${error.message}`);
      console.error('Crossfade error:', error);
    }
  };
  
  // Run automated crossfade test
  const runTest = async () => {
    setIsTesting(true);
    addLog('Starting automated crossfade test');
    
    try {
      const result = await testCrossfade();
      
      if (result) {
        addLog('Automated test completed successfully');
      } else {
        addLog('Automated test failed');
      }
    } catch (error) {
      addLog(`Test error: ${error.message}`);
      console.error('Test error:', error);
    } finally {
      setIsTesting(false);
    }
  };
  
  if (isLoading) {
    return (
      <div style={{padding: '40px', textAlign: 'center'}}>
        <h1>Loading Audio: {loadingProgress}%</h1>
        <p>Please wait for audio initialization...</p>
      </div>
    );
  }
  
  return (
    <div style={{maxWidth: '1000px', margin: '20px auto', padding: '20px', backgroundColor: '#181818', color: '#eaeaea'}}>
      <Head>
        <title>Ensō Audio - Crossfade Test</title>
      </Head>
      
      <h1 style={{textAlign: 'center', marginBottom: '30px'}}>Crossfade Test</h1>
      
      <div style={{display: 'flex', gap: '20px', marginBottom: '20px'}}>
        <button 
          onClick={isPlaying ? pauseSession : startSession}
          style={{
            padding: '10px 20px',
            background: isPlaying ? '#ff5555' : '#55aa55',
            border: 'none',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </button>
        
        <button
          onClick={runTest}
          disabled={isTesting || !hasSwitchableAudio}
          style={{
            padding: '10px 20px',
            background: '#5555aa',
            border: 'none',
            color: 'white',
            cursor: isTesting || !hasSwitchableAudio ? 'not-allowed' : 'pointer',
            opacity: isTesting || !hasSwitchableAudio ? 0.5 : 1
          }}
        >
          {isTesting ? 'Testing...' : 'Run Automatic Test'}
        </button>
      </div>
      
      {!hasSwitchableAudio && (
        <div style={{padding: '10px', backgroundColor: '#553333', marginBottom: '20px'}}>
          <p>No switchable audio available. Crossfading requires multiple audio tracks per layer.</p>
        </div>
      )}
      
      <div style={{display: 'flex', gap: '20px', marginBottom: '30px'}}>
        <div style={{flex: '1', padding: '20px', backgroundColor: '#222', border: '1px solid #333'}}>
          <h2 style={{marginBottom: '15px', fontSize: '1.2rem'}}>Manual Crossfade</h2>
          
          <div style={{marginBottom: '15px'}}>
            <label style={{display: 'block', marginBottom: '5px'}}>Layer:</label>
            <select 
              value={selectedLayer} 
              onChange={(e) => setSelectedLayer(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#333',
                color: 'white',
                border: '1px solid #444'
              }}
            >
              {Object.values(LAYERS).map(layer => (
                <option key={layer} value={layer}>{layer.charAt(0).toUpperCase() + layer.slice(1)}</option>
              ))}
            </select>
          </div>
          
          <div style={{marginBottom: '15px'}}>
            <label style={{display: 'block', marginBottom: '5px'}}>Track:</label>
            <select 
              value={selectedTrack || ''} 
              onChange={(e) => setSelectedTrack(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#333',
                color: 'white',
                border: '1px solid #444'
              }}
            >
              <option value="">Select a track</option>
              {audioLibrary[selectedLayer]?.map(track => (
                <option 
                  key={track.id} 
                  value={track.id}
                  disabled={track.id === activeAudio[selectedLayer]}
                >
                  {track.name} {track.id === activeAudio[selectedLayer] ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>
          
          <div style={{marginBottom: '20px'}}>
            <label style={{display: 'block', marginBottom: '5px'}}>
              Fade Duration: {fadeDuration}ms
            </label>
            <input 
              type="range" 
              min="500" 
              max="5000" 
              step="100" 
              value={fadeDuration}
              onChange={(e) => setFadeDuration(Number(e.target.value))}
              style={{width: '100%'}}
            />
          </div>
          
          <button
            onClick={handleCrossfade}
            disabled={!selectedTrack || selectedTrack === activeAudio[selectedLayer] || isTesting}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#444',
              color: 'white',
              border: 'none',
              cursor: !selectedTrack || selectedTrack === activeAudio[selectedLayer] || isTesting ? 'not-allowed' : 'pointer',
              opacity: !selectedTrack || selectedTrack === activeAudio[selectedLayer] || isTesting ? 0.5 : 1
            }}
          >
            Crossfade
          </button>
        </div>
        
        <div style={{flex: '1', padding: '20px', backgroundColor: '#222', border: '1px solid #333'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
            <h2 style={{fontSize: '1.2rem'}}>Status</h2>
            <div>
              <span style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: isPlaying ? '#55aa55' : '#aa5555',
                marginRight: '5px'
              }}></span>
              {isPlaying ? 'Playing' : 'Stopped'}
            </div>
          </div>
          
          <div style={{marginBottom: '15px'}}>
            <h3 style={{fontSize: '1rem', marginBottom: '5px'}}>Active Tracks:</h3>
            <ul style={{listStyleType: 'none', padding: '0'}}>
              {Object.entries(activeAudio).map(([layer, trackId]) => {
                const track = audioLibrary[layer]?.find(t => t.id === trackId);
                return (
                  <li key={layer} style={{marginBottom: '5px'}}>
                    <strong>{layer}:</strong> {track ? track.name : 'None'} ({trackId})
                  </li>
                );
              })}
            </ul>
          </div>
          
          <div>
            <h3 style={{fontSize: '1rem', marginBottom: '5px'}}>Volume Levels:</h3>
            <ul style={{listStyleType: 'none', padding: '0'}}>
              {Object.entries(volumes).map(([layer, volume]) => (
                <li key={layer} style={{marginBottom: '5px'}}>
                  <strong>{layer}:</strong> {Math.round(volume * 100)}%
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      
      <div style={{padding: '20px', backgroundColor: '#222', border: '1px solid #333'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
          <h2 style={{fontSize: '1.2rem'}}>Test Log</h2>
          <div>
            <button
              onClick={copyLog}
              style={{
                padding: '5px 10px',
                backgroundColor: '#444',
                color: 'white',
                border: 'none',
                marginRight: '10px',
                cursor: 'pointer'
              }}
            >
              Copy Log
            </button>
            <button
              onClick={clearLog}
              style={{
                padding: '5px 10px',
                backgroundColor: '#444',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Clear Log
            </button>
          </div>
        </div>
        
        <div
          style={{
            height: '300px',
            overflowY: 'auto',
            padding: '10px',
            backgroundColor: '#111',
            border: '1px solid #333',
            fontFamily: 'monospace',
            fontSize: '14px'
          }}
        >
          {log.length === 0 ? (
            <p style={{color: '#666', fontStyle: 'italic'}}>No log entries yet.</p>
          ) : (
            log.map((entry, index) => (
              <div key={index} style={{marginBottom: '5px'}}>{entry}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}