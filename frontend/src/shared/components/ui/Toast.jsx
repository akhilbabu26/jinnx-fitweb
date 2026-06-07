import React, { useEffect } from 'react';

export default function Toast({
  message,
  type = 'success',
  onClose,
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: 'bg-[#39ff14]/10 border-[#39ff14]/30 text-[#39ff14]',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
    info: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
  };

  const icons = {
    success: '✓',
    error: '❌',
    info: 'ℹ',
  };

  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3.5 rounded-xl border backdrop-blur-md shadow-2xl flex items-center gap-3 animate-scale-in text-sm font-semibold transition-all duration-300 ${styles[type]}`}>
      <span>{icons[type]}</span>
      <span>{message}</span>
      <button 
        onClick={onClose} 
        className="ml-3 text-white/40 hover:text-white cursor-pointer font-bold select-none text-base"
      >
        &times;
      </button>
    </div>
  );
}
