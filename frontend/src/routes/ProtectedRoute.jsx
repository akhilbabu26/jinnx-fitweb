import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';
import Loader from '../shared/components/ui/Loader';

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const location = useLocation();
  const { accessToken, user, isInitializing } = useAppSelector((state) => state.auth);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
