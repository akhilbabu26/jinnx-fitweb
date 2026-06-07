import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { logoutUser } from '../../features/auth/authSlice';
import Button from '../components/ui/Button';

export default function DashboardLayout() {
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
      label: 'Dashboard', 
      path: '/dashboard', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
    },
    { 
      label: 'My Workouts', 
      path: '/dashboard/workouts', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4M6 8l4-4 4 4m-4-4v12" />
        </svg>
      ) 
    },
    { 
      label: 'AI Chat Coach', 
      path: '/dashboard/chat', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ) 
    },
    { 
      label: 'Consultations', 
      path: '/dashboard/calls', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ) 
    },
    { 
      label: 'Membership', 
      path: '/dashboard/profile', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ) 
    },
  ];

  return (
    <div className="min-h-screen bg-[#050508] text-white flex font-[family-name:var(--font-body)]">
      
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-white/5 bg-[#08080c] shrink-0">
        {/* Brand */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="font-extrabold text-xl tracking-tight uppercase flex items-center gap-1.5">
              <span className="bg-gradient-to-r from-[#39ff14] via-[#00F2FE] to-[#a855f7] bg-clip-text text-transparent font-black">JINNX</span>
              <span className="text-white">FITWEB</span>
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-grow p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
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
                {user?.name?.[0] || 'J'}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate leading-tight">{user?.name}</div>
                <div className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-0.5">{user?.role || 'USER'}</div>
              </div>
            </div>
            <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Navigation overlay */}
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
                {user?.name?.[0] || 'J'}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate leading-tight">{user?.name}</div>
                <div className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-0.5">{user?.role || 'USER'}</div>
              </div>
            </div>
            <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
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
              Client Dashboard
            </h2>
          </div>
          
          {/* Header Profile Dropdown Widget */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold text-white leading-none">{user?.name || 'jins'}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-1">{user?.role || 'USER'}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#10170d] border border-[#22441b] flex items-center justify-center font-bold text-[#39ff14] text-xs">
              {user?.name?.[0]?.toUpperCase() || 'J'}
            </div>
            <svg className="w-3.5 h-3.5 text-white/35 cursor-pointer hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
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
