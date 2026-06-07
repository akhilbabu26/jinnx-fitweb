import React from 'react';
import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-[#050508] p-6 sm:p-10 font-[family-name:var(--font-body)]">
      
      {/* ══════════════ Theme Toggle Decorative Button ══════════════ */}
      <div className="absolute top-6 sm:top-10 right-6 sm:right-10 z-20">
        <button className="w-10 h-10 rounded-full glass-light border border-white/5 flex items-center justify-center text-white/50 hover:text-white transition-colors cursor-pointer">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
        </button>
      </div>

      {/* ══════════════ Background Athlete & Halo ══════════════ */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-[450px] h-[450px] md:w-[650px] md:h-[650px] rounded-full border border-dashed border-[#39ff14]/10 animate-[spin_120s_linear_infinite]" />
          <div className="absolute w-[420px] h-[420px] md:w-[610px] md:h-[610px] rounded-full border border-[#06b6d4]/5 animate-pulse" />
          <div className="absolute w-[300px] h-[300px] md:w-[450px] md:h-[450px] rounded-full bg-gradient-to-tr from-[#39ff14]/5 via-[#06b6d4]/5 to-[#a855f7]/5 blur-3xl" />
          
          <img
            src="/athlete_login.png"
            alt="Athlete"
            className="h-[75vh] md:h-[85vh] lg:h-[90vh] object-contain opacity-40 lg:opacity-90 select-none animate-fade-in-up"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-transparent to-[#050508] opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050508] via-transparent to-[#050508] opacity-85" />
      </div>

      {/* ══════════════ Main Content Grid ══════════════ */}
      <div className="relative z-10 flex-grow flex items-center justify-center max-w-7xl w-full mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center w-full">
          
          {/* Left Side: Branding & Features Rows */}
          <div className="lg:col-span-6 flex flex-col justify-center text-left">
            {/* Logo */}
            <div className="mb-10 flex flex-col items-start">
              <h1 className="text-3xl font-black font-[family-name:var(--font-display)] tracking-wider">
                <span className="text-[#39ff14]">JIN</span>
                <span className="text-[#a855f7]">NX</span>{' '}
                <span className="text-white">FITWEB</span>
              </h1>
              <div className="h-[4px] w-24 bg-gradient-to-r from-[#39ff14] to-[#a855f7] rounded-full mt-2" />
            </div>

            {/* Hero Header */}
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-[1.15] mb-6 font-[family-name:var(--font-display)]">
              Your personal<br />
              <span className="text-[#39ff14]">fitness journey,</span><br />
              crafted by your trainer.
            </h2>

            {/* Sub-headline */}
            <p className="text-md font-semibold mb-12">
              <span className="text-[#39ff14]">Personalised workouts.</span> <span className="text-white">Real results.</span>
            </p>

            {/* Features Checklist */}
            <div className="space-y-6 max-w-md">
              {/* Feature 1 */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border border-[#39ff14]/20 bg-[#39ff14]/5 text-[#39ff14] shadow-[0_0_15px_rgba(57,255,20,0.05)]">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18.5 13.5c1.5-1.5 2.5-3 2.5-4.5S19.5 6 18 6s-2.5 1-3.5 2c-.8.8-1.7 1.2-2.5 1H9a4 4 0 0 0-4 4v4a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4v-3.5" />
                    <path d="M9 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-white text-md">Custom Workouts</h4>
                  <p className="text-sm text-white/40 mt-0.5">Tailored plans that fit your goals.</p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border border-[#06b6d4]/20 bg-[#06b6d4]/5 text-[#06b6d4] shadow-[0_0_15px_rgba(6,182,212,0.05)]">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="6 3 20 12 6 21 6 3" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-white text-md">Video Demos</h4>
                  <p className="text-sm text-white/40 mt-0.5">Learn every move with our expert videos.</p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border border-[#3b82f6]/20 bg-[#3b82f6]/5 text-[#3b82f6] shadow-[0_0_15px_rgba(59,130,246,0.05)]">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="8" cy="16" r="1" />
                    <circle cx="16" cy="16" r="1" />
                    <path d="M9 16h6" />
                    <path d="M12 11V8" />
                    <circle cx="12" cy="7" r="1" />
                    <path d="M2 14h1M21 14h1" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-white text-md">AI Coach</h4>
                  <p className="text-sm text-white/40 mt-0.5">Smart guidance to keep you on track.</p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border border-[#a855f7]/20 bg-[#a855f7]/5 text-[#a855f7] shadow-[0_0_15px_rgba(168,85,247,0.05)]">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-white text-md">1-on-1 Calls</h4>
                  <p className="text-sm text-white/40 mt-0.5">Connect with your trainer anytime.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Form Card */}
          <div className="lg:col-span-6 flex justify-end w-full">
            <div className="glass rounded-[2rem] p-8 sm:p-10 border border-white/5 relative overflow-hidden bg-[#0d0d12]/75 backdrop-blur-xl w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.4)] animate-scale-in">
              <Outlet />
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════ Footer ══════════════ */}
      <footer className="relative z-10 text-center py-4 text-xs text-white/30 font-medium">
        &copy; 2024 <span className="text-[#39ff14]">JINNX</span> <span className="text-[#a855f7] font-bold">FITWEB</span>. All rights reserved.
      </footer>
    </div>
  );
}
