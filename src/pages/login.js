// src/pages/login.js
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/pages/Auth.module.css';

const Login = () => {
  const router = useRouter();
  const { login, isAuthenticated, error, isLoading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  
  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);
  
  // Set form error if there's an auth error
  useEffect(() => {
    if (error) {
      setFormError(error);
    }
  }, [error]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    
    // Basic validation
    if (!email || !password) {
      setFormError('Email and password are required');
      return;
    }
    
    try {
      // Try to login
      console.log('Attempting login with:', email);
      const success = await login(email, password);
      
      console.log('Login result:', success);
      
      if (success) {
        router.push('/dashboard');
      } else if (error) {
        // Error already set by the auth context
        console.log('Login error from context:', error);
      } else {
        setFormError('Invalid login credentials');
      }
    } catch (err) {
      console.error('Login error:', err);
      setFormError('An unexpected error occurred. Please try again.');
    }
  };
  
  // Use demo credentials
  const handleDemoLogin = async () => {
    try {
      setFormError('');
      console.log('Using demo account');
      const success = await login('demo@enso-audio.com', 'password');
      
      if (success) {
        router.push('/dashboard');
      } else {
        setFormError('Demo login failed. Please try again.');
      }
    } catch (err) {
      console.error('Demo login error:', err);
      setFormError('An unexpected error occurred with demo login.');
    }
  };
  
  return (
    <div className={styles.authContainer}>
      <Head>
        <title>Login | Ensō Audio</title>
      </Head>
      
      <div className={styles.authCard}>
        <h1 className={styles.authTitle}>Ensō Audio</h1>
        <h2 className={styles.authSubtitle}>Therapist Login</h2>
        
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
            />
          </div>
          
          <button
            type="submit"
            className={styles.authButton}
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
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