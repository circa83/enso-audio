import React from 'react';
import { useAudio } from '../contexts/AudioContext';
import TapePlayerGraphic from '../components/audio/TapePlayerGraphic';
import LayerControl from '../components/audio/LayerControl';
import SessionTimer from '../components/audio/SessionTimer';
import '../styles/pages/Player.css';

const Player = () => {
  const { 
    isPlaying, 
    volumes, 
    sessionTime, 
    vuMeterLevel,
    availableLayers,
    togglePlayback, 
    handleVolumeChange, 
    resetTimer 
  } = useAudio();

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
      
      <div className="vu-meter">
        <div 
          className="vu-meter-level" 
          style={{ width: `${vuMeterLevel}%` }}
        ></div>
      </div>

      <div className="layer-controls">
        <h2>Audio Layers</h2>
        
        {Object.keys(availableLayers).map(layer => (
          <LayerControl
            key={layer}
            label={layer.charAt(0).toUpperCase() + layer.slice(1)}
            value={volumes[layer]}
            onChange={(value) => handleVolumeChange(layer, value)}
          />
        ))}
      </div>
      
      <div className="geometric-line"></div>
      
      <SessionTimer 
        sessionTime={sessionTime}
        resetTimer={resetTimer}
      />
      
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
};

export default Player;