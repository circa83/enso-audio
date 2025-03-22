import React from 'react';
import styles from '../../styles/components/TapePlayerGraphic.module.css';

const TapePlayerGraphic = () => {
  console.log("TapePlayerGraphic rendering");
  
  return (
    <div className={styles['tape-player-graphic']}>
      <img 
        src="/images/tape_reel_white.png" 
        alt="Tape Reel" 
        className={styles['tape-reel-image']} 
      />
    </div>
  );
};

export default TapePlayerGraphic;