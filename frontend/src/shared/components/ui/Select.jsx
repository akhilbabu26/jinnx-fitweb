import React from 'react';

export default function Select({
  label,
  name,
  value,
  onChange,
  options = [],
  required = false,
  disabled = false,
  className = '',
  error,
  ...props
}) {
  return (
    <div className="w-full text-left">
      {label && (
        <label className="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">
          {label}
        </label>
      )}
      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`w-full bg-[#08080c] border rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-1 focus:ring-[#39ff14]/10 transition-all duration-300 hover:border-white/10 text-sm ${
          error 
            ? 'border-red-500/50 focus:border-red-500' 
            : 'border-white/5 focus:border-[#39ff14]/40'
        } ${className}`}
        {...props}
      >
        {options.map((opt) => {
          const val = typeof opt === 'object' ? opt.value : opt;
          const lbl = typeof opt === 'object' ? opt.label : opt;
          return (
            <option key={val} value={val} className="bg-[#0d0d12]">
              {lbl}
            </option>
          );
        })}
      </select>
      {error && (
        <p className="mt-1.5 text-xs text-red-400 font-semibold">{error}</p>
      )}
    </div>
  );
}
