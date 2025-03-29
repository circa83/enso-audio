// src/components/audio/JourneyGuide.js
import React, { memo } from 'react';
import styles from '../../styles/components/JourneyGuide.module.css';

/**
 * JourneyGuide - Provides guidance on session flow and audio layer settings
 * Displays recommendations for different phases of the therapeutic journey
 */
const JourneyGuide = () => {
  // Journey phases with recommendations
  const journeyPhases = [
    {
      id: 'pre-onset',
      name: 'Pre-Onset',
      recommendation: 'Higher drones, lower rhythm'
    },
    {
      id: 'onset',
      name: 'Onset & Buildup',
      recommendation: 'Increase melody and rhythm gradually'
    },
    {
      id: 'peak',
      name: 'Peak',
      recommendation: 'Balanced mix of all elements'
    },
    {
      id: 'return',
      name: 'Return & Integration',
      recommendation: 'Reduce rhythm, increase nature'
    }
  ];
  
  return (
    <div className={styles.journeyGuide}>
      <h3>Session Flow Guide</h3>
      <div className={styles.journeyPhases}>
        {journeyPhases.map(phase => (
          <div key={phase.id} className={styles.journeyPhase}>
            <h4>{phase.name}</h4>
            <p>{phase.recommendation}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default memo(JourneyGuide);