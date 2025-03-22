// src/components/audio/SessionTimer.js
import React, { useState, useEffect } from 'react';
import { useAudio } from '../../contexts/StreamingAudioContext';
import { formatTime } from '../../utils/formatTime';
import styles from '../../styles/components/SessionTimer.module.css';

const SessionTimer = () => {
  const { isPlaying, getSessionTime } = useAudio();
  const [displayTime, setDisplayTime] = useState('00:00:00');

  useEffect(() => {
    let intervalId = null;

    if (isPlaying) {
      // Update every second when playing
      intervalId = setInterval(() => {
        const time = getSessionTime();
        if (time !== undefined && time !== null && !isNaN(time)) {
          setDisplayTime(formatTime(time));
        } else {
          setDisplayTime('00:00:00');
        }
      }, 1000);
    } else {
      // Get current time when paused
      const time = getSessionTime();
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
  }, [isPlaying, getSessionTime]);

  return (
    <div className={styles.sessionTimer}>
      <h2 className={styles.timerTitle}>Session Time</h2>
      <span className={styles.timeDisplay}>{displayTime}</span>
    </div>
  );
};

export default SessionTimer;