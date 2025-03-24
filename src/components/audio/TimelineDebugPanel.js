// src/components/audio/TimelineDebugPanel.js
import React, { useState, useEffect } from 'react';
import { useAudio } from '../../contexts/StreamingAudioContext';
import styles from '../../styles/components/TimelineDebugPanel.module.css';

const TimelineDebugPanel = ({ enabled = false }) => {
  const { 
    isPlaying, 
    volumes, 
    activeAudio,
    crossfadeProgress,
    activeCrossfades,
    LAYERS
  } = useAudio();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isLive, setIsLive] = useState(true);
  
  // Automatically log state changes
  useEffect(() => {
    if (!enabled || !isLive) return;
    
    const log = {
      timestamp: new Date().toLocaleTimeString(),
      playing: isPlaying,
      volumes: { ...volumes },
      activeAudio: { ...activeAudio },
      crossfades: { ...activeCrossfades }
    };
    
    setLogs(prev => {
      // Keep last 100 logs only
      const newLogs = [...prev, log];
      if (newLogs.length > 100) {
        return newLogs.slice(-100);
      }
      return newLogs;
    });
  }, [isPlaying, volumes, activeAudio, activeCrossfades, enabled, isLive]);
  
  const clearLogs = () => {
    setLogs([]);
  };
  
  const toggleLiveLogging = () => {
    setIsLive(!isLive);
  };
  
  if (!enabled) return null;
  
  return (
    <div className={styles.debugPanel}>
      <div 
        className={`${styles.debugHeader} ${isExpanded ? styles.expanded : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className={styles.debugTitle}>Timeline Debug Panel</h3>
        <div className={styles.debugStatus}>
          <span className={`${styles.statusIndicator} ${isPlaying ? styles.playing : styles.stopped}`}></span>
          <span>{isPlaying ? 'Playing' : 'Stopped'}</span>
        </div>
        <div className={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</div>
      </div>
      
      {isExpanded && (
        <div className={styles.debugContent}>
          <div className={styles.controls}>
            <button 
              className={styles.controlButton}
              onClick={clearLogs}
            >
              Clear Logs
            </button>
            <button 
              className={`${styles.controlButton} ${isLive ? styles.active : ''}`}
              onClick={toggleLiveLogging}
            >
              {isLive ? 'Live Logging: ON' : 'Live Logging: OFF'}
            </button>
          </div>
          
          <div className={styles.currentState}>
            <div className={styles.stateSection}>
              <h4>Current Volumes</h4>
              <div className={styles.stateGrid}>
                {Object.entries(volumes).map(([layer, value]) => (
                  <div key={layer} className={styles.stateItem}>
                    <span className={styles.stateLabel}>{layer}:</span>
                    <span className={styles.stateValue}>{Math.round(value * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className={styles.stateSection}>
              <h4>Active Tracks</h4>
              <div className={styles.stateGrid}>
                {Object.entries(activeAudio).map(([layer, trackId]) => (
                  <div key={layer} className={styles.stateItem}>
                    <span className={styles.stateLabel}>{layer}:</span>
                    <span className={styles.stateValue}>{trackId || 'none'}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className={styles.stateSection}>
              <h4>Active Crossfades</h4>
              <div className={styles.stateGrid}>
                {Object.values(LAYERS).map(layer => {
                  const crossfade = activeCrossfades[layer];
                  const progress = crossfadeProgress[layer] || 0;
                  
                  return (
                    <div key={layer} className={styles.stateItem}>
                      <span className={styles.stateLabel}>{layer}:</span>
                      <span className={styles.stateValue}>
                        {crossfade 
                          ? `${crossfade.from} → ${crossfade.to} (${Math.round(progress * 100)}%)`
                          : 'none'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          <div className={styles.logSection}>
            <h4>Event Log</h4>
            <div className={styles.logContainer}>
              {logs.length === 0 ? (
                <div className={styles.emptyLog}>No events logged yet</div>
              ) : (
                logs.map((log, index) => {
                  // Create a message summarizing the state
                  const volumeChanges = Object.entries(log.volumes)
                    .map(([layer, vol]) => `${layer}:${Math.round(vol * 100)}%`)
                    .join(', ');
                  
                  const trackChanges = Object.entries(log.activeAudio)
                    .map(([layer, track]) => `${layer}:${track}`)
                    .join(', ');
                  
                  const crossfadeInfo = Object.entries(log.crossfades)
                    .filter(([_, cf]) => cf !== null)
                    .map(([layer, cf]) => `${layer}:${cf.from}→${cf.to}`)
                    .join(', ');
                  
                  return (
                    <div key={index} className={styles.logEntry}>
                      <span className={styles.logTime}>{log.timestamp}</span>
                      <span className={styles.logPlaying}>
                        {log.playing ? 'Playing' : 'Stopped'}
                      </span>
                      <div className={styles.logDetails}>
                        <div>Volumes: {volumeChanges}</div>
                        <div>Tracks: {trackChanges}</div>
                        {crossfadeInfo && <div>Crossfades: {crossfadeInfo}</div>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelineDebugPanel;