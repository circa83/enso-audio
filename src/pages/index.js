// src/pages/index.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push('/');
      } else {
        router.push('/login');
      }
    }
  }, [isLoading, isAuthenticated, router]);
  
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: '#111111',
      color: '#aaaaaa',
      fontFamily: 'Archivo, sans-serif',
      letterSpacing: '2px'
    }}>
      <h1 style={{
        fontWeight: 100,
        letterSpacing: '8px'
      }}>Ensō Audio</h1>
    </div>
  );
}