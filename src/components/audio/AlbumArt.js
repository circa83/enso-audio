// src/components/audio/AlbumArt.js
import React, { memo } from 'react';
import styles from '../../styles/components/AlbumArt.module.css';

const AlbumArt = () => {
  return (
    <div className={styles.albumArtContainer}>
      <img 
        src="/images/Stillness_EnsōAudio_bkcp.png" 
        alt="Ensō circle - Album Art" 
        className={styles.albumImage}
      />
    </div>
  );
};

export default memo(AlbumArt);