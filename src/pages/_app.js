// pages/_app.js
import React, { useState, useEffect } from 'react';
import { SessionProvider, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { AudioProvider } from '../contexts/StreamingAudioContext';
import { AuthProvider } from '../contexts/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import '../styles/globals.css';  // Global CSS must be imported here

// Error handler for auth failures
const AuthErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Function to handle auth errors
    const handleAuthError = async (event) => {
      if (event.detail?.error && 
          (event.detail.error.includes('auth') || 
           event.detail.error.includes('session'))) {
        console.error('Auth error detected:', event.detail.error);
        setHasError(true);
        
        // Attempt to clear session and redirect to login
        try {
          await signOut({ redirect: false });
          router.push('/login?error=AuthError');
        } catch (err) {
          console.error('Failed to sign out after auth error:', err);
          // Force redirect to login as fallback
          router.push('/login?error=AuthError');
        }
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

// Custom fetch function to handle auth timeouts
function setupAuthTimeoutHandling() {
  const originalFetch = window.fetch;
  
  window.fetch = async function (...args) {
    const url = args[0] && typeof args[0] === 'string' ? args[0] : '';
    
    // Only intercept auth-related requests
    if (url.includes('/api/auth')) {
      // Create a timeout for auth requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      // Add signal to request options
      if (args[1] && typeof args[1] === 'object') {
        args[1].signal = controller.signal;
      } else {
        args[1] = { signal: controller.signal };
      }
      
      try {
        const response = await originalFetch.apply(this, args);
        clearTimeout(timeoutId);
        
        // Check for auth errors in the response
        if (!response.ok && url.includes('/api/auth')) {
          const errorEvent = new CustomEvent('auth-error', { 
            detail: { 
              error: `Auth request failed: ${response.status} ${response.statusText}`,
              url
            } 
          });
          window.dispatchEvent(errorEvent);
        }
        
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        
        // Dispatch custom event for auth errors
        if (url.includes('/api/auth')) {
          const errorEvent = new CustomEvent('auth-error', { 
            detail: { 
              error: `Auth request error: ${error.message}`,
              url
            } 
          });
          window.dispatchEvent(errorEvent);
        }
        
        throw error;
      }
    }
    
    // Pass through non-auth requests
    return originalFetch.apply(this, args);
  };
}

function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Setup auth timeout handling
    setupAuthTimeoutHandling();
    
    // Add a reasonable delay for app initialization
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Authentication system healthcheck
  useEffect(() => {
    const checkAuthSystem = async () => {
      try {
        const response = await fetch('/api/auth/health', {
          method: 'GET',
          cache: 'no-store'
        });
        
        if (!response.ok) {
          console.warn('Auth system health check failed:', await response.json());
        } else {
          console.log('Auth system health check passed');
        }
      } catch (error) {
        console.error('Error checking auth system health:', error);
      }
    };
    
    checkAuthSystem();
  }, []);
  
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#121212',
        color: '#eaeaea'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ 
            fontFamily: 'Archivo, sans-serif', 
            fontWeight: 100,
            fontSize: '2rem',
            letterSpacing: '8px'
          }}>
            Ensō Audio
          </h1>
          <p style={{ 
            fontFamily: 'Archivo, sans-serif', 
            fontWeight: 200, 
            fontSize: '1rem',
            opacity: 0.7
          }}>
            Loading application...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Ensō Audio</title>
      </Head>
      
      <SessionProvider 
  session={session} 
  refetchInterval={60} // Refetch session every minute
  refetchOnWindowFocus={true} // Refetch when user focuses window
>
  {/* Your components */}
</SessionProvider>
    </>
  );
}

export default MyApp;