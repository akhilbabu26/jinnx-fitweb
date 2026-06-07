import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../shared/components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center p-6 text-center font-[family-name:var(--font-body)]">
      <div className="text-9xl font-black font-[family-name:var(--font-display)] text-white/5 tracking-widest absolute select-none">
        404
      </div>
      <div className="relative z-10 space-y-6">
        <h1 className="text-4xl md:text-5xl font-black font-[family-name:var(--font-display)] tracking-tight">
          Page <span className="text-[#a855f7]">Not Found</span>
        </h1>
        <p className="text-white/50 text-sm max-w-sm mx-auto leading-relaxed">
          The link you followed may be broken, or the page may have been removed. Let's get you back on track.
        </p>
        <Link to="/" className="inline-block mt-4">
          <Button variant="neon">Back to Safety</Button>
        </Link>
      </div>
    </div>
  );
}
