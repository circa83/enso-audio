import React from 'react';
import { formatTime } from '../../utils/formatTime';
import '../../styles/components/SessionTimer.css';

const SessionTimer = ({ sessionTime, resetTimer }) => {
  return (
    <div className="session-timer">
      <h2>Session Time</h2>
      <span className="time-display">{formatTime(sessionTime)}</span>
      <button onClick={resetTimer}>Reset</button>
    </div>
  );
};

export default SessionTimer;