import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { logoutUser } from '../../features/auth/authSlice';
import Button from '../components/ui/Button';

export default function AdminLayout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAppSelector((state) => state.auth);
  
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/login');
  };

  const navItems = [
    { 
      label: 'Admin Overview', 
      path: '/admin/dashboard', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
        </svg>
      )
    },
    { 
      label: 'User Management', 
      path: '/admin/approvals', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) 
    },
    { 
      label: 'Workout Management', 
      path: '/admin/workouts', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4M6 8l4-4 4 4m-4-4v12" />
        </svg>
      ) 
    },
    { 
      label: 'Consultations', 
      path: '/admin/consultations', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ) 
    },
    { 
      label: 'Membership Plans', 
      path: '/admin/membership-plans', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ) 
    },
    { 
      label: 'System Settings', 
      path: '/admin/settings', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ) 
    },
    { 
      label: 'Reports & Analytics', 
      path: '/admin/reports', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.003 9.003 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      ) 
    },
  ];

  return (
    <div className="min-h-screen bg-[#050508] text-white flex font-[family-name:var(--font-body)]">
      
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-white/5 bg-[#08080c] shrink-0">
        <div className="p-6 border-b border-white/5">
          <Link to="/admin/dashboard" className="flex items-center gap-2">
            <span className="font-extrabold text-xl tracking-tight uppercase flex items-center gap-1.5">
              <span className="bg-gradient-to-r from-[#39ff14] via-[#00F2FE] to-[#a855f7] bg-clip-text text-transparent font-black">JINNX</span>
              <span className="text-white">FITWEB</span>
            </span>
          </Link>
        </div>

        <nav className="flex-grow p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === '/admin/approvals' && location.pathname.startsWith('/admin/approvals'));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                  isActive 
                    ? 'bg-[#10170d] border border-[#22441b] text-[#39ff14]' 
                    : 'border border-transparent text-white/55 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <span className={`text-base ${isActive ? 'text-[#39ff14]' : 'text-white/40'}`}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer Profile */}
        <div className="p-4 border-t border-white/5">
          <div 
            onClick={handleLogout}
            className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#1c1c24] border border-white/10 flex items-center justify-center font-bold text-[#39ff14] text-sm uppercase">
                {user?.name?.[0] || 'A'}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate leading-tight">{user?.name || 'akhil'}</div>
                <div className="text-[10px] text-[#39ff14] font-bold uppercase tracking-wider mt-0.5">Trainer</div>
              </div>
            </div>
            <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden cursor-pointer"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-white/5 bg-[#08080c] flex flex-col transition-transform duration-300 lg:hidden ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <span className="font-extrabold text-lg tracking-tight uppercase">
            <span className="bg-gradient-to-r from-[#39ff14] via-[#00F2FE] to-[#a855f7] bg-clip-text text-transparent font-black">JINNX</span>
            <span className="text-white ml-1.5">FITWEB</span>
          </span>
          <button onClick={() => setIsOpen(false)} className="text-white/40 hover:text-white text-2xl font-bold">&times;</button>
        </div>

        <nav className="flex-grow p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                  isActive 
                    ? 'bg-[#10170d] border border-[#22441b] text-[#39ff14]' 
                    : 'border border-transparent text-white/55 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div 
            onClick={handleLogout}
            className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#1c1c24] border border-white/10 flex items-center justify-center font-bold text-[#39ff14] text-sm uppercase">
                {user?.name?.[0] || 'A'}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate leading-tight">{user?.name || 'akhil'}</div>
                <div className="text-[10px] text-[#39ff14] font-bold uppercase tracking-wider mt-0.5">Trainer</div>
              </div>
            </div>
            <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-grow flex flex-col min-w-0 overflow-y-auto h-screen bg-[#050508]">
        
        {/* Top Navbar */}
        <header className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-[#050508] sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-xl font-bold text-white tracking-wide">
              Trainer Admin Panel
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Welcome back text dropdown */}
            <div className="flex items-center gap-2 bg-[#08080c] border border-white/5 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer hover:border-white/10 transition-all">
              <div className="w-2 h-2 rounded-full bg-[#39ff14] animate-pulse" />
              <span>Welcome back, {user?.name || 'akhil'}!</span>
              <svg className="w-3 h-3 text-white/45 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Calendar dropdown date */}
            <div className="flex items-center gap-2 bg-[#08080c] border border-white/5 px-4 py-2 rounded-xl text-xs font-bold text-white/60 cursor-pointer hover:border-white/10 transition-all">
              <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>May 10 - May 16, 2024</span>
              <svg className="w-3 h-3 text-white/35 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </header>

        {/* Page Area */}
        <main className="flex-grow p-8 bg-[#050508]">
          <Outlet />
        </main>
      </div>

    </div>
  );
}
