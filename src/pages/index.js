// src/pages/index.js
import React, { useState } from 'react';
import Head from 'next/head';
import { useAudio } from '../contexts/StreamingAudioContext';
import LoadingScreen from '../components/LoadingScreen';
import Player from '../components/Player';
// Removed global CSS import as it should only be in _app.js

export default function Home() {
  const { isLoading } = useAudio();
  const [showPlayer, setShowPlayer] = useState(false);
  
  // Handler for when the "Start Audio Session" button is clicked
  const handleStartSession = () => {
    setShowPlayer(true);
  };
  
  return (
    <div className="container">
      <Head>
        <title>Ensō Audio</title>
        <meta name="description" content="Therapeutic sound platform for psychedelic-assisted therapy" />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@100;200;300&family=Space+Mono&display=swap" rel="stylesheet" />
      </Head>

      <main>
        {(isLoading || !showPlayer) ? (
          <LoadingScreen onStartSession={handleStartSession} />
        ) : (
          <Player />
        )}
      </main>
    </div>
  );
}