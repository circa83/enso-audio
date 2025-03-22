// src/pages/_app.js
import React from 'react';
import { AudioProvider } from '../contexts/StreamingAudioContext';
import '../styles/globals.css';  // Global CSS must be imported here

function MyApp({ Component, pageProps }) {
  return (
    <AudioProvider>
      <Component {...pageProps} />
    </AudioProvider>
  );
}

export default MyApp;