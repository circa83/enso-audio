// pages/_app.js
import React, { useState, useEffect } from 'react';
import { SessionProvider } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { AudioProvider } from '../contexts/StreamingAudioContext';
import { AuthProvider } from '../contexts/AuthContext';
import AppLoadingScreen from '../components/loading/AppLoadingScreen';
import '../styles/globals.css';

// Error handler component for auth failures
const AuthErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Function to handle auth errors
    const handleAuthError = async (event) => {
      if (event.detail?.error) {
        console.error('Auth error detected:', event.detail.error);
        setHasError(true);
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push('/login?error=AuthError');
        }, 1000);
      }
    };

    // Set up event listener for auth errors
    window.addEventListener('auth-error', handleAuthError);
    
    return () => {
      window.removeEventListener('auth-error', handleAuthError);
    };
  }, [router]);

  if (hasError) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        padding: '20px',
        textAlign: 'center',
        backgroundColor: '#181818',
        color: '#eaeaea'
      }}>
        <h1>Authentication Error</h1>
        <p>We're having trouble with the authentication system.</p>
        <p>Please try refreshing the page or logging in again.</p>
        <button 
          onClick={() => router.push('/login')}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: 'transparent',
            border: '1px solid #ffffff',
            color: '#ffffff',
            cursor: 'pointer'
          }}
        >
          Return to Login
        </button>
      </div>
    );
  }

  return children;
};

function AppContent({ Component, pageProps }) {
  const router = useRouter();
  const [loadingState, setLoadingState] = useState({
    isLoading: true,
    progress: 0,
    message: 'Initializing application...'
  });
  
  // Handle loading progress
  useEffect(() => {
    let currentProgress = 0;
    
    // Simulate loading progress
    const interval = setInterval(() => {
      if (currentProgress < 100) {
        currentProgress += Math.random() * 15;
        
        if (currentProgress > 85 && currentProgress < 98) {
          // Slow down near the end for a more realistic feel
          currentProgress += Math.random() * 2;
        }
        
        if (currentProgress > 100) {
          currentProgress = 100;
        }
        
        // Update loading message based on progress
        let message = 'Initializing application...';
        if (currentProgress > 30) message = 'Loading resources...';
        if (currentProgress > 60) message = 'Preparing audio engine...';
        if (currentProgress > 85) message = 'Almost ready...';
        if (currentProgress >= 100) message = 'Finishing up...';
        
        setLoadingState({
          isLoading: true,
          progress: Math.floor(currentProgress),
          message
        });
      } else {
        clearInterval(interval);
        
        // Short delay before hiding loading screen to ensure smooth transition
        setTimeout(() => {
          setLoadingState({
            isLoading: false,
            progress: 100,
            message: 'Complete'
          });
        }, 500);
      }
    }, 150);
    
    return () => clearInterval(interval);
  }, []);
  
  // Public pages that don't require the full app initialization
  const isPublicPage = 
    router.pathname === '/login' || 
    router.pathname === '/register' || 
    router.pathname === '/';
  
  // For public pages, don't load the AudioProvider (heavy) but still use AuthProvider
  if (isPublicPage && !loadingState.isLoading) {
    return (
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    );
  }
  
  // Show loading screen while initializing
  if (loadingState.isLoading) {
    return (
      <AppLoadingScreen 
        progress={loadingState.progress} 
        message={loadingState.message}
        isVisible={true}
      />
    );
  }
  
  // For authenticated routes, wrap with providers
  return (
    <AuthProvider>
      <AudioProvider>
        <Component {...pageProps} />
      </AudioProvider>
    </AuthProvider>
  );
}

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Ensō Audio</title>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300&display=swap" rel="stylesheet" />
      </Head>
      
      <SessionProvider session={pageProps.session} refetchInterval={0}>
        <AuthErrorBoundary>
          <AppContent Component={Component} pageProps={pageProps} />
        </AuthErrorBoundary>
      </SessionProvider>
    </>
  );
}

export default MyApp;