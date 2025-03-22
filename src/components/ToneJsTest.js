import React, { useState, useEffect } from 'react';
import * as Tone from 'tone';

// This is a simple component to test if Tone.js audio works at all
// Add this component somewhere in your app temporarily

const ToneJsTest = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [testResult, setTestResult] = useState(null);
  
  const runBasicTest = async () => {
    try {
      // Start audio context (required for audio to work)
      await Tone.start();
      setTestResult('Audio context started successfully');
      
      // Create a simple synth
      const synth = new Tone.Synth().toDestination();
      
      // Play a note
      synth.triggerAttackRelease("C4", "8n");
      setTestResult('If you heard a beep, Tone.js is working!');
      
      // Clean up
      setTimeout(() => {
        synth.dispose();
      }, 1000);
      
    } catch (error) {
      console.error('Test failed:', error);
      setTestResult(`Test failed: ${error.message}`);
    }
  };
  
  const testAudioFile = async () => {
    try {
      // Start audio context
      await Tone.start();
      setTestResult('Testing audio file playback...');
      
      // Create a player with one of your audio files
      const player = new Tone.Player({
        url: '/samples/drones.mp3',  // Use one of your full audio files
        onload: () => {
          setTestResult('Audio file loaded successfully, playing now...');
          player.start();
          setIsPlaying(true);
        },
        onerror: (err) => {
          setTestResult(`Failed to load audio file: ${err}`);
        }
      }).toDestination();
      
      // Set up cleanup
      return () => {
        if (player) {
          player.stop();
          player.dispose();
        }
      };
    } catch (error) {
      console.error('File test failed:', error);
      setTestResult(`File test failed: ${error.message}`);
    }
  };
  
  const testAudioChunk = async () => {
    try {
      // Start audio context
      await Tone.start();
      setTestResult('Testing audio chunk playback...');
      
      // Create a player with one of your chunk files
      const player = new Tone.Player({
        url: '/samples/chunks/drones_01.mp3',  // Use one of your chunk files
        onload: () => {
          setTestResult('Audio chunk loaded successfully, playing now...');
          player.start();
          setIsPlaying(true);
        },
        onerror: (err) => {
          setTestResult(`Failed to load audio chunk: ${err}`);
        }
      }).toDestination();
      
      // Set up cleanup
      return () => {
        if (player) {
          player.stop();
          player.dispose();
        }
      };
    } catch (error) {
      console.error('Chunk test failed:', error);
      setTestResult(`Chunk test failed: ${error.message}`);
    }
  };
  
  const stopAudio = () => {
    // This will trigger the cleanup functions
    setIsPlaying(false);
    setTestResult('Audio stopped');
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      padding: '15px',
      background: '#333',
      color: 'white',
      zIndex: 1000,
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
    }}>
      <h3>Tone.js Test</h3>
      <div style={{ marginBottom: '10px' }}>
        <button 
          onClick={runBasicTest}
          style={{ padding: '8px', marginRight: '8px' }}
        >
          Test Synth
        </button>
        
        <button 
          onClick={testAudioFile}
          style={{ padding: '8px', marginRight: '8px' }}
        >
          Test File
        </button>
        
        <button 
          onClick={testAudioChunk}
          style={{ padding: '8px', marginRight: '8px' }}
        >
          Test Chunk
        </button>
        
        {isPlaying && (
          <button 
            onClick={stopAudio}
            style={{ padding: '8px', background: '#c33' }}
          >
            Stop Audio
          </button>
        )}
      </div>
      {testResult && (
        <div style={{ 
          marginTop: '10px',
          padding: '8px',
          background: '#222',
          borderRadius: '4px'
        }}>
          {testResult}
        </div>
      )}
    </div>
  );
};

export default ToneJsTest;