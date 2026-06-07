import React, { useEffect } from 'react';
import { useAppDispatch } from './app/hooks';
import { checkAuth } from './features/auth/authSlice';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  return <AppRoutes />;
}
