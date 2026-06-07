import React, { useEffect } from 'react';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  className = '',
}) {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
      />
      
      {/* Container */}
      <div className={`glass rounded-[2rem] border border-white/10 w-full max-w-lg p-8 relative overflow-hidden bg-[#0d0d12]/90 shadow-[0_0_50px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.1)] z-10 animate-scale-in ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
          <h3 className="text-xl font-bold text-white font-[family-name:var(--font-display)]">
            {title}
          </h3>
          <button 
            onClick={onClose} 
            className="text-white/40 hover:text-white text-2xl font-semibold cursor-pointer transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div>{children}</div>
      </div>
    </div>
  );
}
