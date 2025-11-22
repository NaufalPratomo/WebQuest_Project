import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { logActivity } from '@/lib/activityLogger';
import { useAuth } from '@/contexts/AuthContext';

export default function RouteLogger() {
  const location = useLocation();
  const { user } = useAuth();
  useEffect(() => {
    logActivity({
      action: 'route_change',
      category: 'navigation',
      details: { path: location.pathname },
      level: 'info',
      userId: user?._id || user?.id,
      role: user?.role,
    });
  }, [location.pathname, user?._id, user?.id, user?.role]);
  return null;
}
