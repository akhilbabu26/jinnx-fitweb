import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../shared/components/ui/Button';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center p-6 text-center font-[family-name:var(--font-body)]">
      <div className="text-9xl font-black font-[family-name:var(--font-display)] text-white/5 tracking-widest absolute select-none">
        401
      </div>
      <div className="relative z-10 space-y-6">
        <h1 className="text-4xl md:text-5xl font-black font-[family-name:var(--font-display)] tracking-tight">
          Access <span className="text-red-400">Denied</span>
        </h1>
        <p className="text-white/50 text-sm max-w-sm mx-auto leading-relaxed">
          You do not have the required permissions to view this resource. Please contact the administrator or switch accounts.
        </p>
        <Link to="/" className="inline-block mt-4">
          <Button variant="neon">Back to Home</Button>
        </Link>
      </div>
    </div>
  );
}
