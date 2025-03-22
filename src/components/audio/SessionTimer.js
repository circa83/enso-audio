import React from 'react';
import { formatTime } from '../../utils/formatTime';
import styles from '../../styles/components/SessionTimer.module.css';

const SessionTimer = ({ sessionTime, resetTimer }) => {
  console.log("SessionTimer rendering", { sessionTime });
  
  return (
    <div className={styles['session-timer']}>
      <h2>Session Time</h2>
      <span className={styles['time-display']}>{formatTime(sessionTime)}</span>
      <button className={styles['timer-button']} onClick={resetTimer}>Reset</button>
    </div>
  );
};

export default SessionTimer;