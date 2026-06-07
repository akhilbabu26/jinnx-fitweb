import React from 'react';

export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className = '',
  icon,
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center font-bold transition-all rounded-xl cursor-pointer select-none active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-surface-900 border border-white/10 hover:border-white/20 text-white',
    secondary: 'bg-surface-800 border border-white/5 hover:bg-surface-700 text-white',
    outline: 'border border-white/10 hover:bg-white/5 text-white/80 hover:text-white',
    neon: 'bg-[#39ff14] text-[#050508] hover:bg-[#2bcc0f] shadow-[0_4px_20px_rgba(57,255,20,0.2)] hover:shadow-[0_4px_25px_rgba(57,255,20,0.35)] border border-transparent',
    cyan: 'bg-[#06b6d4] text-[#050508] hover:bg-[#0891b2] shadow-[0_4px_20px_rgba(6,182,212,0.2)] border border-transparent',
  };

  const sizes = {
    sm: 'px-3.5 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3.5 text-base',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2.5 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {!isLoading && icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
}
