import React from 'react';
import { AudioProvider } from '../contexts/StreamingAudioContext';
import '../styles/globals.css';
import '../styles/App.css';  // Keep the original path

function MyApp({ Component, pageProps }) {
  return (
    <AudioProvider>
      <Component {...pageProps} />
    </AudioProvider>
  );
}

export default MyApp;