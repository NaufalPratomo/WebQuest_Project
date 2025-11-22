import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function RouteLogger() {
  const location = useLocation();
  useEffect(() => {
    // Route logging disabled - only log important actions
  }, [location.pathname]);
  return null;
}
