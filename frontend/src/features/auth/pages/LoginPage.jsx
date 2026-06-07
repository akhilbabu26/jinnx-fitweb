import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { loginUser, clearErrors } from '../authSlice';
import Input from '../../../shared/components/ui/Input';
import Button from '../../../shared/components/ui/Button';
import Toast from '../../../shared/components/ui/Toast';

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isLoading, error, isAuthenticated } = useAppSelector((state) => state.auth);

  const [form, setForm] = useState({ email: '', password: '' });
  const [toastMsg, setToastMsg] = useState(null);

  // Clear errors on load
  useEffect(() => {
    dispatch(clearErrors());
  }, [dispatch]);

  // Show error toasts from state
  useEffect(() => {
    if (error) {
      setToastMsg({ message: error, type: 'error' });
      dispatch(clearErrors());
    }
  }, [error, dispatch]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setToastMsg({ message: 'Please fill in all fields', type: 'error' });
      return;
    }

    const result = await dispatch(loginUser(form));
    if (loginUser.fulfilled.match(result)) {
      setToastMsg({ message: 'Login successful!', type: 'success' });
      // Redirect handled by routes or local effect
    }
  };

  return (
    <div className="animate-fade-in-up">
      {toastMsg && (
        <Toast message={toastMsg.message} type={toastMsg.type} onClose={() => setToastMsg(null)} />
      )}

      {/* Header: Dumbbell on left, text on right */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#06b6d4]/10 to-[#a855f7]/10 border border-white/5 flex items-center justify-center relative flex-shrink-0">
          <div className="absolute inset-0 rounded-full bg-[#06b6d4]/5 blur-md" />
          <svg className="w-6 h-6 text-[#06b6d4] relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6.5 6.5h11M5 11h14M6.5 15.5h11M6 13.5h12"/>
            <rect x="2" y="6" width="3" height="12" rx="1"/>
            <rect x="19" y="6" width="3" height="12" rx="1"/>
          </svg>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-white font-[family-name:var(--font-display)]">
            Welcome back
          </h3>
          <p className="text-white/40 text-sm mt-0.5">
            Sign in to continue your training
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          placeholder="Enter your email"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
          required
          disabled={isLoading}
        />

        <div className="space-y-2">
          <Input
            label="Password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Enter your password"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
            required
            disabled={isLoading}
          />
          <div className="flex justify-end pt-1">
            <Link
              to="/forgot-password"
              className="text-xs text-[#39ff14] hover:text-[#2bcc0f] transition-colors font-medium cursor-pointer"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          variant="neon"
          isLoading={isLoading}
          className="w-full text-base font-black py-3.5"
        >
          <span>Sign In</span>
          <svg className="w-4 h-4 ml-1 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </Button>
      </form>

      {/* Divider */}
      <div className="relative flex py-5 items-center">
        <div className="flex-grow border-t border-white/5"></div>
        <span className="flex-shrink mx-4 text-xs bg-[#121218]/90 border border-white/5 px-2.5 py-1 rounded-full text-white/40 font-medium">OR</span>
        <div className="flex-grow border-t border-white/5"></div>
      </div>

      {/* Register Link */}
      <div className="text-center">
        <p className="text-white/40 text-sm">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="text-[#39ff14] hover:text-[#2bcc0f] transition-colors font-bold ml-1 hover:underline cursor-pointer"
          >
            Request Access
          </Link>
        </p>
      </div>
    </div>
  );
}
