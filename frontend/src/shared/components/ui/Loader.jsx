import React from 'react';

export default function Loader({
  size = 'md',
  className = '',
}) {
  const sizes = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-[3px]',
    lg: 'w-16 h-16 border-4',
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative">
        <div className={`rounded-full border-white/5 ${sizes[size]}`} />
        <div className={`absolute inset-0 rounded-full border-t-[#39ff14] border-r-[#39ff14]/30 animate-spin ${sizes[size]}`} />
      </div>
    </div>
  );
}
