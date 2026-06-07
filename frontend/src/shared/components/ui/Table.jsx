import React from 'react';

export default function Table({
  headers = [],
  children,
  className = '',
}) {
  return (
    <div className={`w-full overflow-x-auto rounded-xl border border-white/5 bg-[#0d0d12]/40 backdrop-blur-md ${className}`}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-white/5 bg-white/[0.02]">
            {headers.map((h, index) => (
              <th 
                key={index} 
                className="px-6 py-4 text-xs font-bold text-white/50 uppercase tracking-wider font-[family-name:var(--font-display)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-sm text-white/80">
          {children}
        </tbody>
      </table>
    </div>
  );
}
