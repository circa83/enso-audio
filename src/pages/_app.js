// pages/_app.js
import React, { useState, useEffect } from 'react';
import { SessionProvider } from 'next-auth/react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { AudioProvider } from '../contexts/AudioContext';
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
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  
  // Single smooth loading simulation
  useEffect(() => {
    let currentProgress = 0;
    const targetProgress = 100;
    
    // Simulate loading progress - go all the way to 100%
    const interval = setInterval(() => {
      if (currentProgress < targetProgress) {
        // Start fast, then slow down near completion
        const increment = currentProgress < 70 
          ? Math.random() * 10  // Faster initially
          : Math.random() * 3;  // Slower as we approach completion
        
        currentProgress += increment;
        
        if (currentProgress > targetProgress) {
          currentProgress = targetProgress;
        }
        
        setProgress(Math.floor(currentProgress));
        
        // When we reach 100%, wait a moment before hiding the loading screen
        if (currentProgress >= targetProgress) {
          clearInterval(interval);
          
          // Give a small delay for visual polish before revealing content
          setTimeout(() => {
            setIsLoading(false);
          }, 300);
        }
      }
    }, 150);
    
    return () => clearInterval(interval);
  }, []);
  
  // Show loading screen until fully loaded
  if (isLoading || status === 'loading') {
    return <AppLoadingScreen 
      progress={progress} 
      isVisible={true} 
      message={progress >= 90 ? "Preparing application..." : "Loading..."}
    />;
  }
  
  // For unauthenticated users, still use AuthProvider but not AudioProvider
  if (status === 'unauthenticated') {
    return (
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    );
  }
  
  // For authenticated users, wrap with both providers
  return (
    <AuthProvider>
      <AudioProvider>
        <Component {...pageProps} />
      </AudioProvider>
    </AuthProvider>
  );
}

function MyApp({ Component, pageProps }) {
//mobile ios detection
  useEffect(() => {
    // Simple iOS detection
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
    // Only apply these fixes on iOS
    if (isIOS) {
      console.log("iOS detected - applying special fixes");
      
      // Fix for iOS rendering
      document.documentElement.style.width = '100%';
      document.body.style.width = '100%';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.position = 'relative';
      
      // Fix for main player container
      const playerElements = document.querySelectorAll('[class*="Player_simplePlayer"]');
      playerElements.forEach(el => {
        el.style.left = '50%';
        el.style.right = 'auto';
        el.style.transform = 'translateX(-50%)';
        el.style.marginLeft = '0';
        el.style.marginRight = '0';
        el.style.width = 'calc(100% - 20px)';
      });
    }
  }, []);

  return (
    <>
      <Head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <title>Ensō Audio</title>
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@100;200;300&family=Space+Mono&family=Noto+Sans+JP:wght@300&display=swap" rel="stylesheet" />
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