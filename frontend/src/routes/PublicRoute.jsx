import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';
import Loader from '../shared/components/ui/Loader';

export default function PublicRoute({ children }) {
  const { accessToken, user, isInitializing } = useAppSelector((state) => state.auth);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (accessToken) {
    if (user?.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
