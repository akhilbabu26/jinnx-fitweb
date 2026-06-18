import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: 'bg-[#39ff14]/10 border-[#39ff14]/30 text-[#39ff14] shadow-[#39ff14]/10',
    error:   'bg-red-500/10 border-red-500/30 text-red-400 shadow-red-500/10',
    info:    'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-cyan-500/10',
  };

  const icons = {
    success: '✓',
    error:   '✕',
    info:    'ℹ',
  };

  // Portal renders outside the AuthLayout/card so centering is always correct
  return createPortal(
    <div
      style={{ transform: 'translateX(-50%)' }}
      className={`
        fixed top-6 left-1/2 z-[9999]
        px-5 py-3.5 rounded-xl border backdrop-blur-md shadow-2xl
        flex items-center gap-3
        text-sm font-semibold
        animate-scale-in
        max-w-sm w-max
        ${styles[type] ?? styles.info}
      `}
    >
      <span className="text-base leading-none">{icons[type]}</span>
      <span className="leading-snug">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 opacity-40 hover:opacity-100 transition-opacity cursor-pointer font-bold text-base leading-none select-none"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>,
    document.body
  );
}
