import React, { useState, useEffect, useRef } from 'react';
import './SimplePlayerDark.css';
import TapePlayerGraphic from './TapePlayerGraphic';

// Sample audio files - replace with your own
const audioLayers = {
  drones: '/samples/drones.mp3',
  melody: '/samples/melody.mp3',
  rhythm: '/samples/rhythm.mp3',
  nature: '/samples/nature.mp3',
};

function SimplePlayerDark() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volumes, setVolumes] = useState({
    drones: 0.8,
    melody: 0.5,
    rhythm: 0.3,
    nature: 0.6,
  });
  const [sessionTime, setSessionTime] = useState(0);
  const [vuMeterLevel, setVuMeterLevel] = useState(0);
  const timerRef = useRef(null);
  const vuMeterRef = useRef(null);
  
  // Audio elements refs
  const audioRefs = useRef({
    drones: null,
    melody: null,
    rhythm: null,
    nature: null,
  });
  
  // Initialize audio context
  const audioContextRef = useRef(null);
  const gainNodesRef = useRef({});
  const sourceNodesRef = useRef({});
  
  useEffect(() => {
    // Set up Web Audio API
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create gain nodes for each layer
    const layers = Object.keys(audioLayers);
    layers.forEach(layer => {
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = volumes[layer];
      gainNode.connect(audioContextRef.current.destination);
      gainNodesRef.current[layer] = gainNode;
    });
    
    // Load audio buffers
    loadAudioBuffers();
    
    return () => {
      // Clean up audio context when component unmounts
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      // Clear the timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      // Clear VU meter animation
      if (vuMeterRef.current) {
        clearInterval(vuMeterRef.current);
      }
    };
  }, []);
  
  const loadAudioBuffers = async () => {
    const layers = Object.keys(audioLayers);
    
    try {
      for (const layer of layers) {
        if (!audioLayers[layer]) continue;
        
        const response = await fetch(audioLayers[layer]);
        const arrayBuffer = await response.arrayBuffer();
        
        // Only decode if we have valid audio data
        if (arrayBuffer.byteLength > 0) {
          const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
          
          // Store the buffer for later use
          audioRefs.current[layer] = audioBuffer;
        }
      }
      console.log('All audio layers loaded');
    } catch (error) {
      console.error('Error loading audio:', error);
    }
  };
  
  const playAllTracks = () => {
    if (!audioContextRef.current) return;
    
    // Resume audio context if it's suspended (browser policy)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    const layers = Object.keys(audioLayers);
    
    layers.forEach(layer => {
      if (!audioRefs.current[layer]) return;
      
      // Create a new source for this layer
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioRefs.current[layer];
      source.loop = true;
      
      // Connect to the gain node
      source.connect(gainNodesRef.current[layer]);
      
      // Start playback
      source.start(0);
      sourceNodesRef.current[layer] = source;
    });
    
    setIsPlaying(true);
    
    // Start the timer
    timerRef.current = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);
    
    // Animate VU meter
    vuMeterRef.current = setInterval(() => {
      // Calculate based on all layer volumes
      const totalVolume = Object.values(volumes).reduce((sum, vol) => sum + vol, 0);
      const baseLevel = (totalVolume / 4) * 100; // Base level from current volumes
      
      // Add some randomness to simulate audio dynamics
      const randomFactor = Math.random() * 20 - 10; // -10 to +10
      const newLevel = Math.max(0, Math.min(100, baseLevel + randomFactor));
      
      setVuMeterLevel(newLevel);
    }, 200);
  };
  
  const stopAllTracks = () => {
    const layers = Object.keys(audioLayers);
    
    layers.forEach(layer => {
      if (sourceNodesRef.current[layer]) {
        sourceNodesRef.current[layer].stop();
        sourceNodesRef.current[layer] = null;
      }
    });
    
    setIsPlaying(false);
    
    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Stop VU meter animation
    if (vuMeterRef.current) {
      clearInterval(vuMeterRef.current);
      setVuMeterLevel(0);
    }
  };
  
  const handleVolumeChange = (layer, value) => {
    // Update state
    setVolumes(prev => ({
      ...prev,
      [layer]: value
    }));
    
    // Update gain node
    if (gainNodesRef.current[layer]) {
      gainNodesRef.current[layer].gain.value = value;
    }
  };
  
  const togglePlayback = () => {
    if (isPlaying) {
      stopAllTracks();
    } else {
      playAllTracks();
    }
  };
  
  const resetTimer = () => {
    setSessionTime(0);
  };
  
  // Format time as HH:MM:SS
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className={`simple-player ${isPlaying ? 'playing' : ''}`}>
      <div className="geometric-element"></div>
      
      <h1>Ensō Audio</h1>
      
      <TapePlayerGraphic />
      
      <div className="session-description">
        Adjust audio layers in real-time to guide the therapeutic journey
      </div>
      
      <div className="player-controls">
        <button 
          className={`play-button ${isPlaying ? 'playing' : ''}`}
          onClick={togglePlayback}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </button>
      </div>
      
      {/* <div className="vu-meter">
        <div 
          className="vu-meter-level" 
          style={{ width: `${vuMeterLevel}%` }}
        ></div>
      </div>  */}

      <div className="layer-controls">
        <h2>Audio Layers</h2>
        
        <div className="layer-slider">
          <label>Drones</label>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={volumes.drones}
            onChange={(e) => handleVolumeChange('drones', parseFloat(e.target.value))}
          />
          <span>{Math.round(volumes.drones * 100)}%</span>
        </div>
        
        <div className="layer-slider">
          <label>Melody</label>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={volumes.melody}
            onChange={(e) => handleVolumeChange('melody', parseFloat(e.target.value))}
          />
          <span>{Math.round(volumes.melody * 100)}%</span>
        </div>
        
        <div className="layer-slider">
          <label>Rhythm</label>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={volumes.rhythm}
            onChange={(e) => handleVolumeChange('rhythm', parseFloat(e.target.value))}
          />
          <span>{Math.round(volumes.rhythm * 100)}%</span>
        </div>
        
        <div className="layer-slider">
          <label>Nature</label>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={volumes.nature}
            onChange={(e) => handleVolumeChange('nature', parseFloat(e.target.value))}
          />
          <span>{Math.round(volumes.nature * 100)}%</span>
        </div>
      </div>
      
      <div className="geometric-line"></div>
      
      <div className="session-timer">
        <h2>Session Time</h2>
        <span className="time-display">{formatTime(sessionTime)}</span>
        <button onClick={resetTimer}>Reset</button>
      </div>
      
      {/* <div className="info-panel">
        <p>
          Ensō Audio: Professional soundscapes for guided therapeutic experiences.
        </p>
        <p>
          Adjust audio layers to match the client's journey phase.
        </p>
      </div> */}
      <div className="journey-guide">
        <h3>Session Flow Guide</h3>
        <div className="journey-phases">
          <div className="journey-phase">
            <h4>Pre-Onset</h4>
            <p>Higher drones, lower rhythm</p>
          </div>
          <div className="journey-phase">
            <h4>Onset & Buildup</h4>
            <p>Increase melody and rhythm gradually</p>
          </div>
          <div className="journey-phase">
            <h4>Peak</h4>
            <p>Balanced mix of all elements</p>
          </div>
          <div className="journey-phase">
            <h4>Return & Integration</h4>
            <p>Reduce rhythm, increase nature</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SimplePlayerDark;