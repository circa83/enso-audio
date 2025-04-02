// src/components/audio/SessionTimer.js
import React, { useState, useEffect } from 'react';
import { useAudio } from '../../hooks/useAudio'; // Use the refactored hook
import { formatTime } from '../../utils/formatTime';
import styles from '../../styles/components/SessionTimer.module.css';

const SessionTimer = () => {
  const { playback } = useAudio(); // Get the playback group from the hook
  const [displayTime, setDisplayTime] = useState('00:00:00');

  useEffect(() => {
    console.log("SessionTimer effect running, playback state:", playback.isPlaying);
    console.log(playback)
    let intervalId = null;
  
    if (playback.isPlaying) {
      console.log("Setting up timer interval");
      // Update every second when playing
      intervalId = setInterval(() => {
        const time = playback.getTime();
       // console.log("Current session time:", time, "ms");
        if (time !== undefined && time !== null && !isNaN(time)) {
          setDisplayTime(formatTime(time));
        } else {
          console.log("Invalid time value:", time);
          setDisplayTime('00:00:00');
        }
      }, 1000);
    } else {
      // Get current time when paused
      const time = playback.getTime();
      console.log("Paused time check:", time, "ms");
      if (time !== undefined && time !== null && !isNaN(time)) {
        setDisplayTime(formatTime(time));
      } else {
        setDisplayTime('00:00:00');
      }
    }

    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [playback.isPlaying, playback.getTime]); // Update dependencies

  return (
    <div className={styles.sessionTimer}>
      <h2 className={styles.timerTitle}>Session Time</h2>
      <span className={styles.timeDisplay}>{displayTime}</span>
    </div>
  );
};

// Export with memoization to prevent unnecessary re-renders
export default React.memo(SessionTimer);