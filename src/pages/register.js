// src/pages/register.js
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/pages/Auth.module.css';

const Register = () => {
  const router = useRouter();
  const { register, isAuthenticated, error, isLoading } = useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    if (!name || !email || !password || !confirmPassword) {
      setFormError('All fields are required');
      return;
    }
    
    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }
    
    // Require password of at least 8 characters
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters');
      return;
    }
    
    // Try to register
    const success = await register(name, email, password);
    
    if (success) {
      router.push('/dashboard');
    }
  };
  
  return (
    <div className={styles.authContainer}>
      <Head>
        <title>Register | Ensō Audio</title>
      </Head>
      
      <div className={styles.authCard}>
        <h1 className={styles.authTitle}>Ensō Audio</h1>
        <h2 className={styles.authSubtitle}>Therapist Registration</h2>
        
        <form className={styles.authForm} onSubmit={handleSubmit}>
          {formError && <div className={styles.errorMessage}>{formError}</div>}
          
          <div className={styles.formGroup}>
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              className={styles.formInput}
            />
          </div>
          
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
          
          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              className={styles.formInput}
            />
          </div>
          
          <button
            type="submit"
            className={styles.authButton}
            disabled={isLoading}
          >
            {isLoading ? 'Registering...' : 'Register'}
          </button>
        </form>
        
        <div className={styles.authLinks}>
          <p>
            Already have an account?{' '}
            <Link href="/login" className={styles.authLink}>
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;