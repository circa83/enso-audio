// src/pages/dashboard/index.js
import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import withAuth from '../../components/auth/ProtectedRoute';
import DashboardLayout from '../../components/layout/DashboardLayout';
import styles from '../../styles/pages/Dashboard.module.css';

const Dashboard = () => {
  const { user } = useAuth();
  
  return (
    <DashboardLayout activePage="dashboard">
      <Head>
        <title>Dashboard | Ensō Audio</title>
      </Head>
      
      <div className={styles.dashboardHeader}>
        <h1 className={styles.welcomeTitle}>
          Welcome, {user?.name || 'Therapist'}
        </h1>
        <p className={styles.welcomeSubtitle}>
          Manage your therapeutic sessions and audio library
        </p>
      </div>
      
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>0</div>
          <div className={styles.statLabel}>Sessions Completed</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statValue}>0</div>
          <div className={styles.statLabel}>Active Clients</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statValue}>0:00</div>
          <div className={styles.statLabel}>Total Session Time</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statValue}>8</div>
          <div className={styles.statLabel}>Audio Files</div>
        </div>
      </div>
      
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