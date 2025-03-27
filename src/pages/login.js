// pages/login.js
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { signIn, useSession } from 'next-auth/react';
import { useAuth } from '../contexts/AuthContext';
import CircleVisualizer from '../components/loading/CircleVisualizer';
import styles from '../styles/pages/Auth.module.css';

const Login = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { user } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginInProgress, setLoginInProgress] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  
  // Handle initial page loading
  useEffect(() => {
    // Short timeout to ensure loading UI is visible
    const timer = setTimeout(() => {
      setPageLoading(false);
    }, 800);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Get error message from URL if present
  useEffect(() => {
    const { error } = router.query;
    if (error) {
      // Map error codes to user-friendly messages
      const errorMessages = {
        'CredentialsSignin': 'Invalid email or password. Please try again.',
        'SessionRequired': 'You need to be logged in to access that page.',
        'AccessDenied': 'You do not have permission to access that page.',
        'AuthError': 'An authentication error occurred. Please try again.',
        'SessionExpired': 'Your session has expired. Please log in again.',
        'Default': 'An error occurred during sign in. Please try again.'
      };
      
      setFormError(errorMessages[error] || errorMessages['Default']);
    }
  }, [router.query]);
  
  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (status === 'authenticated' && session) {
      router.replace('/dashboard');
    }
  }, [status, session, router]);
  
  // Clear loading state when status changes
  useEffect(() => {
    if (status !== 'loading') {
      setIsLoading(false);
    }
  }, [status]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reset error
    setFormError('');
    
    // Basic validation
    if (!email || !password) {
      setFormError('Email and password are required');
      return;
    }
    
    try {
      // Prevent multiple submission
      if (loginInProgress) {
        return;
      }
      
      setIsLoading(true);
      setLoginInProgress(true);
      
      console.log('Attempting login with:', email);
      
      // Set up timeout for login attempt
      const loginTimeout = setTimeout(() => {
        setFormError('Login attempt timed out. Please try again.');
        setIsLoading(false);
        setLoginInProgress(false);
      }, 15000); // 15 seconds timeout
      
      // Attempt login with NextAuth
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });
      
      // Clear timeout since we got a response
      clearTimeout(loginTimeout);
      
      console.log('Login result:', result);
      
      if (result?.error) {
        // Handle specific error cases
        if (result.error === 'CredentialsSignin') {
          setFormError('Invalid email or password. Please try again.');
        } else {
          setFormError(result.error || 'Login failed. Please try again.');
        }
        setIsLoading(false);
      } else if (result?.ok) {
        // Success! Redirect to dashboard
        router.push('/dashboard');
      } else {
        // Unexpected result
        setFormError('Something went wrong. Please try again.');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      setFormError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    } finally {
      setLoginInProgress(false);
    }
  };
  
  // Use demo credentials
  const handleDemoLogin = async () => {
    try {
      setFormError('');
      setIsLoading(true);
      
      console.log('Using demo account');
      
      const result = await signIn('credentials', {
        redirect: false,
        email: 'demo@enso-audio.com',
        password: 'password',
      });
      
      console.log('Demo login result:', result);
      
      if (result?.error) {
        setFormError('Demo login failed. Please try again later.');
        setIsLoading(false);
      } else if (result?.ok) {
        router.push('/dashboard');
      } else {
        setFormError('Something went wrong with demo login.');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Demo login error:', err);
      setFormError('An unexpected error occurred with demo login.');
      setIsLoading(false);
    }
  };
  
  // If the page is in initial loading state
  if (pageLoading) {
    return (
      <div className={styles.authContainer}>
        <div className={styles.authCard}>
          <h1 className={styles.authTitle}>Ensō Audio</h1>
          <div style={{ margin: '30px auto', width: '80px', height: '80px' }}>
            <CircleVisualizer size={80} isActive={true} progress={100} />
          </div>
          <h2 className={styles.authSubtitle}>Preparing login...</h2>
        </div>
      </div>
    );
  }
  
  // If NextAuth is still initializing
  if (status === 'loading') {
    return (
      <div className={styles.authContainer}>
        <div className={styles.authCard}>
          <h1 className={styles.authTitle}>Ensō Audio</h1>
          <div style={{ margin: '30px auto', width: '80px', height: '80px' }}>
            <CircleVisualizer size={80} isActive={true} progress={100} />
          </div>
          <h2 className={styles.authSubtitle}>Checking authentication...</h2>
        </div>
      </div>
    );
  }
  
  return (
    <div className={styles.authContainer}>
      <Head>
        <title>Login | Ensō Audio</title>
      </Head>
      
      <div className={styles.authCard}>
        <h1 className={styles.authTitle}>Ensō Audio</h1>
        <h2 className={styles.authSubtitle}>Session Login</h2>
        
        <form className={styles.authForm} onSubmit={handleSubmit}>
          {formError && <div className={styles.errorMessage}>{formError}</div>}
          
          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className={styles.formInput}
              disabled={isLoading}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className={styles.formInput}
              disabled={isLoading}
            />
          </div>
          
          <button
            type="submit"
            className={styles.authButton}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className={styles.loadingIndicator}>
                <span className={styles.loadingDot}></span>
                <span className={styles.loadingDot}></span>
                <span className={styles.loadingDot}></span>
              </span>
            ) : 'Login'}
          </button>
          
          <button
            type="button"
            className={styles.demoButton}
            onClick={handleDemoLogin}
            disabled={isLoading}
          >
            Use Demo Account
          </button>
        </form>
        
        <div className={styles.authLinks}>
          <p>
            Don't have an account?{' '}
            <Link href="/register" className={styles.authLink}>
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;