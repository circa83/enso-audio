// src/components/auth/ProtectedRoute.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';

// A higher-order component that redirects to login if not authenticated
const withAuth = (Component) => {
  const AuthenticatedComponent = (props) => {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();
    
    useEffect(() => {
      // If authentication is finished loading and user is not authenticated
      if (!isLoading && !isAuthenticated) {
        router.replace('/login');
      }
    }, [isLoading, isAuthenticated, router]);
    
    // Show nothing while authentication is being verified
    if (isLoading || !isAuthenticated) {
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
          Verifying authentication...
        </div>
      );
    }
    
    // If authenticated, render the component
    return <Component {...props} />;
  };
  
  return AuthenticatedComponent;
};

export default withAuth;