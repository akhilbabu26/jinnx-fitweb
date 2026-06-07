import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Input from '../../../shared/components/ui/Input';
import Button from '../../../shared/components/ui/Button';
import Toast from '../../../shared/components/ui/Toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) {
      setToastMsg({ message: 'Please enter your email', type: 'error' });
      return;
    }
    setLoading(true);
    // Mock recovery link sent
    setTimeout(() => {
      setLoading(false);
      setToastMsg({ message: 'Password recovery instructions sent to your email!', type: 'success' });
    }, 1500);
  };

  return (
    <div className="animate-fade-in-up">
      {toastMsg && (
        <Toast message={toastMsg.message} type={toastMsg.type} onClose={() => setToastMsg(null)} />
      )}
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#06b6d4]/15 to-[#a855f7]/15 border border-white/10 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-base">🔑</span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-white font-[family-name:var(--font-display)]">
            Reset Password
          </h3>
          <p className="text-white/40 text-xs mt-0.5">
            Recover your account password
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="Email Address"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
          required
          disabled={loading}
        />
        
        <Button
          type="submit"
          variant="neon"
          isLoading={loading}
          className="w-full text-base font-black py-3.5"
        >
          Recover Password
        </Button>
      </form>

      <p className="text-center text-white/40 text-sm mt-6">
        Back to{' '}
        <Link to="/login" className="text-[#39ff14] hover:text-[#2bcc0f] transition-colors font-bold ml-1 hover:underline">
          Sign In
        </Link>
      </p>
    </div>
  );
}
