import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { userApi }    from '../../../shared/services/userApi';
import { sessionApi } from '../../../shared/services/sessionApi';
import { workoutApi } from '../../../shared/services/workoutApi';

import Toast  from '../../../shared/components/ui/Toast';
import Loader from '../../../shared/components/ui/Loader';

// ── Section components ────────────────────────────────────────────────────────
import AdminOverview          from '../components/AdminOverview';
import AdminUserManagement    from '../components/AdminUserManagement';
import AdminWorkoutManagement from '../components/AdminWorkoutManagement';
import AdminConsultations     from '../components/AdminConsultations';
import AdminSystemSettings    from '../components/AdminSystemSettings';

// ── Shell ─────────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const location = useLocation();

  const [users,          setUsers]          = useState([]);
  const [usersLoading,   setUsersLoading]   = useState(false);
  const [toastMsg,       setToastMsg]       = useState(null);
  const [compilingPdfId, setCompilingPdfId] = useState(null);

  // ── Fetch users (shared across multiple sections) ──────────────────────────
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const [approvedRes, pendingRes, rejectedRes] = await Promise.all([
        userApi.getApprovedUsers().catch(() => ({ data: { data: [] } })),
        userApi.getPendingUsers().catch(()  => ({ data: { data: [] } })),
        workoutApi.getRejectedUsers().catch(() => ({ data: { data: [] } })),
      ]);

      const toRow = (u, status) => ({
        id:     u.id,
        name:   u.name,
        email:  u.email,
        role:   u.role === 'admin' ? 'Admin' : 'User',
        status,
        level:  u.level,
        joined: new Date(u.created_at).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        }),
      });

      setUsers([
        ...(pendingRes.data?.data  || []).map((u) => toRow(u, 'Pending')),
        ...(approvedRes.data?.data || []).map((u) => toRow(u, 'Active')),
        ...(rejectedRes.data?.data || []).map((u) => toRow(u, 'Rejected')),
      ]);
    } catch (err) {
      console.error('fetchUsers error:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  // ── Shared action handlers ─────────────────────────────────────────────────
  const handleApprove = async (id, name) => {
    try {
      await userApi.approveUser(id);
      setToastMsg({ message: `Approved ${name}!`, type: 'success' });
      fetchUsers();
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Failed to approve', type: 'error' });
    }
  };

  const handleReject = async (id, name) => {
    try {
      await userApi.rejectUser(id);
      setToastMsg({ message: `Rejected ${name}.`, type: 'success' });
      fetchUsers();
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Failed to reject', type: 'error' });
    }
  };

  const handleReApprove = async (id, name) => {
    try {
      await workoutApi.reApproveUser(id);
      setToastMsg({ message: `Re-approved ${name}. Account is pending approval again!`, type: 'success' });
      fetchUsers();
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Failed to re-approve', type: 'error' });
    }
  };

  const handleSetLevel = async (id, level) => {
    try {
      await workoutApi.setUserLevel(id, level);
      setToastMsg({ message: `Level updated to ${level}!`, type: 'success' });
      fetchUsers();
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Failed to set level', type: 'error' });
    }
  };

  const handleCall = async (id, name) => {
    try {
      await sessionApi.initializeSession(id);
      setToastMsg({ message: `Video room initialized for ${name}!`, type: 'success' });
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Failed to initialize session', type: 'error' });
    }
  };

  const handlePDF = async (userId, name) => {
    setCompilingPdfId(userId);
    try {
      const res = await sessionApi.generatePDF(userId);
      if (res.data?.success && res.data?.data?.pdf_url) {
        setToastMsg({ message: `PDF ready for ${name}!`, type: 'success' });
        window.open(res.data.data.pdf_url, '_blank');
      } else {
        throw new Error('Invalid response');
      }
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Failed to generate PDF', type: 'error' });
    } finally {
      setCompilingPdfId(null);
    }
  };

  // ── Route → component ─────────────────────────────────────────────────────
  const renderSection = () => {
    if (usersLoading && !users.length) {
      return <div className="py-20 flex justify-center"><Loader size="lg" /></div>;
    }

    switch (location.pathname) {
      case '/admin/dashboard':
        return (
          <AdminOverview
            users={users}
            workouts={[]}   // workouts state lives inside AdminWorkoutManagement
            courses={[]}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        );

      case '/admin/approvals':
        return (
          <AdminUserManagement
            users={users}
            loading={usersLoading}
            onApprove={handleApprove}
            onReject={handleReject}
            onReApprove={handleReApprove}
            onSetLevel={handleSetLevel}
            onCall={handleCall}
            onPDF={handlePDF}
            compilingPdfId={compilingPdfId}
          />
        );

      case '/admin/workouts':
        return (
          <AdminWorkoutManagement
            users={users}
            compilingPdfId={compilingPdfId}
            onPDF={handlePDF}
            setToastMsg={setToastMsg}
          />
        );

      case '/admin/consultations':
        return <AdminConsultations users={users} onCall={handleCall} />;

      case '/admin/settings':
        return <AdminSystemSettings setToastMsg={setToastMsg} />;

      case '/admin/reports':
        return (
          <div className="bg-[#08080c] border border-white/5 rounded-2xl p-12 text-center space-y-3">
            <div className="text-4xl">📊</div>
            <h3 className="text-sm font-bold text-white">Reports Coming Soon</h3>
            <p className="text-xs text-white/40 max-w-sm mx-auto">
              Platform performance metrics and trainer statistics will appear here once connected to Razorpay and analytics.
            </p>
          </div>
        );

      default:
        return (
          <AdminOverview
            users={users}
            workouts={[]}
            courses={[]}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        );
    }
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {toastMsg && (
        <Toast
          message={toastMsg.message}
          type={toastMsg.type}
          onClose={() => setToastMsg(null)}
        />
      )}

      {renderSection()}
    </div>
  );
}
