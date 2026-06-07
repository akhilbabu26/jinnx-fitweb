import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import PublicRoute from './PublicRoute';

// Layouts
import AuthLayout from '../shared/layouts/AuthLayout';
import DashboardLayout from '../shared/layouts/DashboardLayout';
import AdminLayout from '../shared/layouts/AdminLayout';

// Pages
import HomePage from '../pages/HomePage';
import NotFoundPage from '../pages/NotFoundPage';
import UnauthorizedPage from '../pages/UnauthorizedPage';

// Auth Feature
import LoginPage from '../features/auth/pages/LoginPage';
import RegisterPage from '../features/auth/pages/RegisterPage';
import ForgotPasswordPage from '../features/auth/pages/ForgotPasswordPage';

// Dashboard / Admin Features
import UserDashboardPage from '../features/dashboard/pages/UserDashboardPage';
import AdminDashboardPage from '../features/admin/pages/AdminDashboardPage';
import WorkoutPage from '../features/dashboard/pages/WorkoutPage';
import ChatPage from '../features/dashboard/pages/ChatPage';
import ConsultationPage from '../features/dashboard/pages/ConsultationPage';

// Skeletons / Placeholders for sub-features
function ProfilePlaceholder() {
  return (
    <div className="bg-[#0d0d12]/40 backdrop-blur-md rounded-2xl border border-white/5 p-6 text-center text-white/50 animate-fade-in-up">
      👤 Client account credentials and profile update view.
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Root switchboard redirector */}
      <Route path="/" element={<HomePage />} />

      {/* Auth Routes */}
      <Route element={<PublicRoute><AuthLayout /></PublicRoute>}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      {/* User Dashboard Routes (role = 'user') */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['user']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<UserDashboardPage />} />
        <Route path="workouts" element={<WorkoutPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="calls" element={<ConsultationPage />} />
        <Route path="profile" element={<ProfilePlaceholder />} />
      </Route>

      {/* Admin Dashboard Routes (role = 'admin') */}
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="approvals" element={<AdminDashboardPage />} />
        <Route path="workouts" element={<AdminDashboardPage />} />
        <Route path="consultations" element={<AdminDashboardPage />} />
        <Route path="membership-plans" element={<AdminDashboardPage />} />
        <Route path="settings" element={<AdminDashboardPage />} />
        <Route path="reports" element={<AdminDashboardPage />} />
      </Route>


      {/* Standalone Error Routes */}
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

