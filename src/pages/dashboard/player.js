// src/pages/dashboard/player.js
import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Player from '../../components/Player';
import withAuth from '../../components/auth/ProtectedRoute';
import styles from '../../styles/pages/DashboardPlayer.module.css';

const PlayerPage = () => {
  return (
    <div className={styles.playerContainer}>
      <Head>
        <title>Audio Session | Ensō Audio</title>
      </Head>
      
      <div className={styles.playerTopBar}>
        <Link href="/ambient-archive" className={styles.backButton}>
          ← Back to Ambient Archive
        </Link>
        
        <div className={styles.sessionControls}>
          <button className={styles.sessionButton}>Save Session</button>
        </div>
      </div>
      
      <Player />
    </div>
  );
};

export default withAuth(PlayerPage);