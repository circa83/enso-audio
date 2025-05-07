// src/components/debug/DebugOverlay.js
import React, { useState, useEffect, useRef } from 'react';
import { useAudio } from '../../contexts/StreamingAudioContext';
import styles from '../../styles/components/debug/DebugOverlay.module.css';

/**
 * DebugOverlay - A live debugging overlay for Ensō Audio
 * Shows real-time information about the audio system's state
 * Toggle with Ctrl+Shift+D keyboard shortcut
 */
const DebugOverlay = () => {
  const {
    // Core audio state
    isPlaying,
    volumes,
    activeAudio,
    masterVolume,
    
    // Advanced state
    activeCrossfades,
    crossfadeProgress,
    preloadProgress,
    
    // Timeline related
    timelineEvents,
    timelinePhases,
    
    // All layers reference
    LAYERS
  } = useAudio();

  // Panel visibility state
  const [isVisible, setIsVisible] = useState(false);
  
  // Which section to display
  const [activeSection, setActiveSection] = useState('state');
  
  // Track audio elements
  const audioElementsRef = useRef({});
  
  // Events log
  const [eventLog, setEventLog] = useState([]);
  const logRef = useRef([]);
  const maxLogEntries = 100;

  // Track previous state to detect changes
  const prevStateRef = useRef({
    isPlaying: false,
    volumes: {},
    activeAudio: {},
    activeCrossfades: {},
  });

  // Capture keypresses to toggle visibility
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Toggle on Ctrl+Shift+D
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsVisible(prev => !prev);
        if (!isVisible) {
          addLogEntry('Debug overlay opened', 'system');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  // Track audio elements
  useEffect(() => {
    // Function to find and track audio elements
    const trackAudioElements = () => {
      const elements = document.querySelectorAll('audio');
      const audioElements = {};
      
      elements.forEach((elem, i) => {
        audioElements[`audio_${i}`] = {
          element: elem,
          paused: elem.paused,
          currentTime: elem.currentTime,
          duration: elem.duration || 0,
          volume: elem.volume,
          src: elem.src.split('/').pop() // Just the filename
        };
      });
      
      audioElementsRef.current = audioElements;
    };
    
    // Track elements initially and on an interval
    trackAudioElements();
    const intervalId = setInterval(trackAudioElements, 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Monitor state changes to log events
  useEffect(() => {
    // Only run if overlay is visible to save performance
    if (!isVisible) return;
    
    const currentState = {
      isPlaying,
      volumes: { ...volumes },
      activeAudio: { ...activeAudio },
      activeCrossfades: { ...activeCrossfades },
      preloadProgress: { ...preloadProgress }
    };
    
    // Check for state changes
    
    // Check play state change
    if (currentState.isPlaying !== prevStateRef.current.isPlaying) {
      addLogEntry(
        `Playback ${currentState.isPlaying ? 'started' : 'stopped'}`,
        'playback'
      );
    }
    
    // Check for track changes
    Object.entries(currentState.activeAudio).forEach(([layer, trackId]) => {
      const prevTrackId = prevStateRef.current.activeAudio[layer];
      if (trackId !== prevTrackId && prevTrackId !== undefined) {
        addLogEntry(
          `Track changed for ${layer}: ${prevTrackId} → ${trackId}`,
          'track'
        );
      }
    });
    
    // Check for significant volume changes (more than 5%)
    Object.entries(currentState.volumes).forEach(([layer, volume]) => {
      const prevVolume = prevStateRef.current.volumes[layer];
      if (
        prevVolume !== undefined && 
        Math.abs(volume - prevVolume) > 0.05
      ) {
        addLogEntry(
          `Volume changed for ${layer}: ${Math.round(prevVolume * 100)}% → ${Math.round(volume * 100)}%`,
          'volume'
        );
      }
    });
    
    // Check for new crossfades
    Object.entries(currentState.activeCrossfades).forEach(([layer, info]) => {
      if (!prevStateRef.current.activeCrossfades[layer] && info) {
        addLogEntry(
          `Crossfade started for ${layer}: ${info.from} → ${info.to}`,
          'crossfade'
        );
      }
    });
    
    // Check for completed crossfades
    Object.entries(prevStateRef.current.activeCrossfades).forEach(([layer, info]) => {
      if (info && !currentState.activeCrossfades[layer]) {
        addLogEntry(
          `Crossfade completed for ${layer}`,
          'crossfade'
        );
      }
    });
    
    // Check for new preloads
    Object.entries(currentState.preloadProgress).forEach(([trackId, progress]) => {
      if (prevStateRef.current.preloadProgress[trackId] === undefined) {
        addLogEntry(
          `Preloading started for track: ${trackId}`,
          'buffer'
        );
      } else if (
        prevStateRef.current.preloadProgress[trackId] < 100 && 
        progress >= 100
      ) {
        addLogEntry(
          `Preloading completed for track: ${trackId}`,
          'buffer'
        );
      }
    });
    
    // Update previous state reference
    prevStateRef.current = currentState;
  }, [
    isVisible, 
    isPlaying, 
    volumes, 
    activeAudio, 
    activeCrossfades,
    preloadProgress
  ]);

  // Helper to add a log entry
  const addLogEntry = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const entry = { message, timestamp, type };
    
    // Update the log, keeping only the most recent entries
    setEventLog(prev => {
      const newLog = [entry, ...prev].slice(0, maxLogEntries);
      logRef.current = newLog;
      return newLog;
    });
  };

  // If not visible, don't render
  if (!isVisible) {
    return null;
  }

  // Render the active section
  const renderActiveSection = () => {
    switch (activeSection) {
      case 'state':
        return renderStateSection();
      case 'audio':
        return renderAudioElementsSection();
      case 'crossfades':
        return renderCrossfadesSection();
      case 'timeline':
        return renderTimelineSection();
      case 'log':
        return renderLogSection();
      default:
        return renderStateSection();
    }
  };

  // Render current state section
  const renderStateSection = () => (
    <div className={styles.debugSection}>
      <h3>Current Audio State</h3>
      
      <div className={styles.stateGrid}>
        <div className={styles.stateItem}>
          <span className={styles.stateLabel}>Playback:</span>
          <span className={styles.stateValue}>
            {isPlaying ? 'Playing' : 'Paused'}
          </span>
        </div>

        <div className={styles.stateItem}>
          <span className={styles.stateLabel}>Master Volume:</span>
          <span className={styles.stateValue}>
            {Math.round(masterVolume * 100)}%
          </span>
        </div>
        
        <div className={styles.stateItem}>
          <span className={styles.stateLabel}>Active Crossfades:</span>
          <span className={styles.stateValue}>
            {Object.keys(activeCrossfades).length}
          </span>
        </div>
      </div>
      
      <h4>Layer Status</h4>
      <div className={styles.layerGrid}>
        {Object.values(LAYERS).map(layer => (
          <div key={layer} className={styles.layerCard}>
            <div className={styles.layerHeader}>
              <span className={styles.layerName}>{layer}</span>
              <span className={styles.layerVolume}>
                {Math.round(volumes[layer] * 100)}%
              </span>
            </div>
            <div className={styles.layerBody}>
              <div className={styles.layerTrack}>
                {activeAudio[layer] || 'None'}
              </div>
              {activeCrossfades[layer] && (
                <div className={styles.layerCrossfade}>
                  <div>Crossfading: {activeCrossfades[layer].from} → {activeCrossfades[layer].to}</div>
                  <div className={styles.progressBar}>
                    <div 
                      className={styles.progressFill}
                      style={{width: `${Math.round((crossfadeProgress[layer] || 0) * 100)}%`}}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render audio elements section
  const renderAudioElementsSection = () => (
    <div className={styles.debugSection}>
      <h3>Audio Elements</h3>
      
      {Object.keys(audioElementsRef.current).length === 0 ? (
        <div className={styles.noData}>No audio elements detected</div>
      ) : (
        <div className={styles.audioGrid}>
          {Object.entries(audioElementsRef.current).map(([key, info]) => (
            <div key={key} className={styles.audioCard}>
              <div className={styles.audioHeader}>
                <span className={styles.audioName}>{key}</span>
                <span className={styles.audioState}>
                  {info.paused ? 'Paused' : 'Playing'}
                </span>
              </div>
              <div className={styles.audioBody}>
                <div className={styles.audioDetail}>
                  <span className={styles.detailLabel}>Source:</span>
                  <span className={styles.detailValue}>{info.src}</span>
                </div>
                <div className={styles.audioDetail}>
                  <span className={styles.detailLabel}>Time:</span>
                  <span className={styles.detailValue}>
                    {info.currentTime.toFixed(2)} / {info.duration.toFixed(2)}
                  </span>
                </div>
                <div className={styles.audioDetail}>
                  <span className={styles.detailLabel}>Volume:</span>
                  <span className={styles.detailValue}>
                    {Math.round(info.volume * 100)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render crossfades section
  const renderCrossfadesSection = () => (
    <div className={styles.debugSection}>
      <h3>Active Crossfades</h3>
      
      {Object.keys(activeCrossfades).length === 0 ? (
        <div className={styles.noData}>No active crossfades</div>
      ) : (
        <div className={styles.crossfadeGrid}>
          {Object.entries(activeCrossfades).map(([layer, info]) => (
            <div key={layer} className={styles.crossfadeCard}>
              <div className={styles.crossfadeHeader}>
                <span className={styles.crossfadeLayer}>{layer}</span>
                <span className={styles.crossfadeProgress}>
                  {Math.round((crossfadeProgress[layer] || 0) * 100)}%
                </span>
              </div>
              <div className={styles.crossfadeBody}>
                <div className={styles.crossfadeDetail}>
                  <span className={styles.detailLabel}>From:</span>
                  <span className={styles.detailValue}>{info.from}</span>
                </div>
                <div className={styles.crossfadeDetail}>
                  <span className={styles.detailLabel}>To:</span>
                  <span className={styles.detailValue}>{info.to}</span>
                </div>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill}
                    style={{width: `${Math.round((crossfadeProgress[layer] || 0) * 100)}%`}}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <h3>Preloading Tracks</h3>
      {Object.keys(preloadProgress).length === 0 ? (
        <div className={styles.noData}>No tracks being preloaded</div>
      ) : (
        <div className={styles.preloadGrid}>
          {Object.entries(preloadProgress).map(([trackId, progress]) => (
            <div key={trackId} className={styles.preloadCard}>
              <div className={styles.preloadHeader}>
                <span className={styles.preloadTrack}>{trackId}</span>
                <span className={styles.preloadProgress}>{progress}%</span>
              </div>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill}
                  style={{width: `${progress}%`}}
                ></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render timeline section
  const renderTimelineSection = () => (
    <div className={styles.debugSection}>
      <h3>Timeline</h3>
      
      <h4>Phase Markers</h4>
      {!timelinePhases || timelinePhases.length === 0 ? (
        <div className={styles.noData}>No timeline phases defined</div>
      ) : (
        <div className={styles.phaseGrid}>
          {timelinePhases.map((phase, index) => (
            <div key={phase.id} className={styles.phaseCard}>
              <div className={styles.phaseHeader}>
                <span className={styles.phaseName}>{phase.name}</span>
                <span className={styles.phasePosition}>{phase.position}%</span>
              </div>
              <div className={styles.phaseBody}>
                <div className={styles.phaseDetail}>
                  <span className={styles.detailLabel}>ID:</span>
                  <span className={styles.detailValue}>{phase.id}</span>
                </div>
                <div className={styles.phaseDetail}>
                  <span className={styles.detailLabel}>Has State:</span>
                  <span className={styles.detailValue}>
                    {phase.state ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className={styles.phaseDetail}>
                  <span className={styles.detailLabel}>Is Locked:</span>
                  <span className={styles.detailValue}>
                    {phase.locked ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <h4>Timeline Events</h4>
      {!timelineEvents || timelineEvents.length === 0 ? (
        <div className={styles.noData}>No timeline events scheduled</div>
      ) : (
        <div className={styles.eventGrid}>
          {timelineEvents.map((event, index) => (
            <div key={index} className={styles.eventCard}>
              <div className={styles.eventHeader}>
                <span className={styles.eventName}>{event.name || 'Event ' + (index + 1)}</span>
                <span className={styles.eventTime}>{event.time}ms</span>
              </div>
              <div className={styles.eventBody}>
                <div className={styles.eventDetail}>
                  <span className={styles.detailLabel}>Action:</span>
                  <span className={styles.detailValue}>{event.action}</span>
                </div>
                {event.layerSettings && (
                  <div className={styles.eventDetail}>
                    <span className={styles.detailLabel}>Layers:</span>
                    <span className={styles.detailValue}>
                      {Object.keys(event.layerSettings).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render event log section
  const renderLogSection = () => (
    <div className={styles.debugSection}>
      <h3>Event Log</h3>
      
      <div className={styles.logControls}>
        <button 
          className={styles.logButton}
          onClick={() => setEventLog([])}
        >
          Clear Log
        </button>
      </div>
      
      <div className={styles.eventLog}>
        {eventLog.length === 0 ? (
          <div className={styles.noData}>No events logged yet</div>
        ) : (
          eventLog.map((entry, index) => (
            <div 
              key={index}
              className={`${styles.logEntry} ${styles[entry.type]}`}
            >
              <span className={styles.logTime}>{entry.timestamp}</span>
              <span className={styles.logMessage}>{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className={styles.debugOverlay}>
      <div className={styles.debugHeader}>
        <h2 className={styles.debugTitle}>Ensō Audio Debug</h2>
        <div className={styles.sectionTabs}>
          <button 
            className={`${styles.tabButton} ${activeSection === 'state' ? styles.activeTab : ''}`}
            onClick={() => setActiveSection('state')}
          >
            State
          </button>
          <button 
            className={`${styles.tabButton} ${activeSection === 'audio' ? styles.activeTab : ''}`}
            onClick={() => setActiveSection('audio')}
          >
            Audio Elements
          </button>
          <button 
            className={`${styles.tabButton} ${activeSection === 'crossfades' ? styles.activeTab : ''}`}
            onClick={() => setActiveSection('crossfades')}
          >
            Crossfades
          </button>
          <button 
            className={`${styles.tabButton} ${activeSection === 'timeline' ? styles.activeTab : ''}`}
            onClick={() => setActiveSection('timeline')}
          >
            Timeline
          </button>
          <button 
            className={`${styles.tabButton} ${activeSection === 'log' ? styles.activeTab : ''}`}
            onClick={() => setActiveSection('log')}
          >
            Log
          </button>
        </div>
        <button 
          className={styles.closeButton}
          onClick={() => {
            setIsVisible(false);
            addLogEntry('Debug overlay closed', 'system');
          }}
        >
          Close
        </button>
      </div>
      
      <div className={styles.debugContent}>
        {renderActiveSection()}
      </div>
      
      <div className={styles.debugFooter}>
        <div className={styles.keyboardShortcuts}>
          Toggle: Ctrl+Shift+D
        </div>
      </div>
    </div>
  );
};

export default DebugOverlay;