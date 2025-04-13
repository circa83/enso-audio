// File: src/pages/dashboard/index.js (replace existing content)

import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function DashboardRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    console.log('[DashboardRedirect] Redirecting from /dashboard to /ambient-archive');
    router.replace('/ambient-archive');
  }, [router]);
  
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
      Redirecting to Ambient Archive...
    </div>
  );
}