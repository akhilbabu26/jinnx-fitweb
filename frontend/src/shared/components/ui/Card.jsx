import React from 'react';

export default function Card({
  children,
  className = '',
  glow = false,
  variant = 'glass',
  onClick,
  ...props
}) {
  const baseStyles = 'rounded-2xl border transition-all duration-300 relative overflow-hidden';
  
  const variants = {
    glass: 'glass bg-[#0d0d12]/75 shadow-lg',
    solid: 'bg-surface-900 border-white/5 shadow-md',
    light: 'glass-light bg-white/[0.02]',
  };

  const glowStyles = glow 
    ? 'border-[#39ff14]/20 hover:border-[#39ff14]/30 hover:shadow-[0_4px_25px_rgba(57,255,20,0.05)]' 
    : 'border-white/5 hover:border-white/10';

  const clickableStyles = onClick ? 'cursor-pointer active:scale-[0.995]' : '';

  return (
    <div
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]} ${glowStyles} ${clickableStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
