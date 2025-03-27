// src/pages/dashboard/index.js
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useAuth } from '../../contexts/AuthContext';
import withAuth from '../../components/auth/ProtectedRoute';
import DashboardLayout from '../../components/layout/DashboardLayout';
import styles from '../../styles/pages/Dashboard.module.css';

const Dashboard = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { data: session, status } = useSession();
  const [userStats, setUserStats] = useState({
    sessionsCompleted: 0,
    activeClients: 0,
    totalSessionTime: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Add a fallback fetch function
  const fetchUserStatsFallback = async () => {
    try {
      console.log('Attempting fallback stats fetch');
      const response = await fetch('/api/fallback-stats', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.error('Fallback stats failed too');
        
        // If everything fails, use default stats
        setUserStats({
          sessionsCompleted: 0,
          activeClients: 0,
          totalSessionTime: 0
        });
        
        return;
      }
      
      const data = await response.json();
      if (data.stats) {
        setUserStats(data.stats);
        setError(null); // Clear any error if fallback succeeds
      }
    } catch (err) {
      console.error('Fallback stats error:', err);
      
      // Set default stats as last resort
      setUserStats({
        sessionsCompleted: 0,
        activeClients: 0,
        totalSessionTime: 0
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch user stats from API
  const fetchUserStats = async () => {
    if (session) {
      try {
        setIsLoading(true);
        
        // Use a more resilient fetch with credentials included
        const response = await fetch('/api/users/stats', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include' // Important: include credentials with the request
        });
        
        // Handle authentication errors
        if (response.status === 401 || response.status === 403) {
          console.error('Authentication error fetching stats. Status:', response.status);
          setError('Authentication error. You may need to log in again.');
          
          // Try the fallback before potentially redirecting
          console.log('Main stats API returned 401/403, trying fallback');
          await fetchUserStatsFallback();
          
          // If we got stats from fallback, don't redirect
          if (userStats.sessionsCompleted !== 0 || 
              userStats.activeClients !== 0 || 
              userStats.totalSessionTime !== 0) {
            return;
          }
          
          // If fallback also failed, consider a redirect after a delay
          setTimeout(() => {
            if (error) { // Only redirect if error still exists
              router.push('/login?error=SessionExpired');
            }
          }, 5000);
          
          return;
        }
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to fetch user stats');
        }
        
        const data = await response.json();
        setUserStats(data);
        setError(null); // Clear any previous errors
      } catch (err) {
        console.error('Error fetching user stats:', err);
        setError(err.message || 'Could not load your statistics');
        
        // Try fallback on error
        await fetchUserStatsFallback();
      } finally {
        setIsLoading(false);
      }
    } else if (status === 'unauthenticated') {
      // Handle case when not authenticated
      setError('Your session has expired. Please log in again.');
      setTimeout(() => {
        router.push('/login?error=SessionExpired');
      }, 2000);
    }
  };
  
  // Fetch stats when session changes
  useEffect(() => {
    if (session || status === 'unauthenticated') {
      fetchUserStats();
    }
  }, [session, status]);
  
  // Format milliseconds to HH:MM:SS
  const formatTime = (ms) => {
    if (!ms) return '00:00:00';
    
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <DashboardLayout activePage="dashboard">
      <Head>
        <title>Dashboard | Ensō Audio</title>
      </Head>
      
      <div className={styles.dashboardHeader}>
        <h1 className={styles.welcomeTitle}>
          Welcome, {user?.name || session?.user?.name || 'Therapist'}
        </h1>
        <p className={styles.welcomeSubtitle}>
          Manage your therapeutic sessions and audio library
        </p>
      </div>
      
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            {isLoading ? '...' : userStats.sessionsCompleted || 0}
          </div>
          <div className={styles.statLabel}>Sessions Completed</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            {isLoading ? '...' : userStats.activeClients || 0}
          </div>
          <div className={styles.statLabel}>Active Clients</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            {isLoading ? '...' : formatTime(userStats.totalSessionTime || 0)}
          </div>
          <div className={styles.statLabel}>Total Session Time</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statValue}>8</div>
          <div className={styles.statLabel}>Audio Files</div>
        </div>
      </div>
      
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}
      
      <div className={styles.quickActions}>
        <h2 className={styles.sectionTitle}>Quick Actions</h2>
        
        <div className={styles.actionGrid}>
          <Link href="/dashboard/player" className={styles.actionCard}>
            <div className={styles.actionIcon}>▶</div>
            <div className={styles.actionLabel}>Start Session</div>
          </Link>
          
          <Link href="/dashboard/library" className={styles.actionCard}>
            <div className={styles.actionIcon}>🎵</div>
            <div className={styles.actionLabel}>Audio Library</div>
          </Link>
          
          <Link href="/dashboard/settings" className={styles.actionCard}>
            <div className={styles.actionIcon}>⚙️</div>
            <div className={styles.actionLabel}>Settings</div>
          </Link>
          
          <Link href="/dashboard/help" className={styles.actionCard}>
            <div className={styles.actionIcon}>?</div>
            <div className={styles.actionLabel}>Help Guide</div>
          </Link>
        </div>
      </div>
      
      <div className={styles.recentSessions}>
        <h2 className={styles.sectionTitle}>Recent Sessions</h2>
        
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📋</div>
          <div className={styles.emptyTitle}>No Recent Sessions</div>
          <div className={styles.emptyDescription}>
            Your recent therapy sessions will appear here once you start recording them.
          </div>
          <Link href="/dashboard/player" className={styles.emptyButton}>
            Start Your First Session
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default withAuth(Dashboard);