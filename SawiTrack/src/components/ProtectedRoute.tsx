import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, isAuthenticated, hydrated } = useAuth();
  const disableAuth = String(import.meta.env.VITE_DISABLE_AUTH || '').toLowerCase() === '1' || String(import.meta.env.VITE_DISABLE_AUTH || '').toLowerCase() === 'true';

  // Wait for auth to hydrate from storage before deciding
  if (!hydrated) {
    return null; // or a spinner/skeleton if preferred
  }

  if (disableAuth) {
    return <>{children}</>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;