// src/pages/_app.js
import React from 'react';
import { SessionProvider } from 'next-auth/react';
import { AudioProvider } from '../contexts/StreamingAudioContext';
import { AuthProvider } from '../contexts/AuthContext';
import '../styles/globals.css';  // Global CSS must be imported here

function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <AuthProvider>
        <AudioProvider>
          <Component {...pageProps} />
        </AudioProvider>
      </AuthProvider>
    </SessionProvider>
  );
}

export default MyApp;