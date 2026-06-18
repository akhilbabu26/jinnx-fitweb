import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { forgotPassword, resetPassword, clearErrors, resetRegisterState } from '../authSlice';
import Input from '../../../shared/components/ui/Input';
import Button from '../../../shared/components/ui/Button';
import Toast from '../../../shared/components/ui/Toast';

export default function ForgotPasswordPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { forgotPasswordStatus, forgotPasswordMessage, resetPasswordStatus, resetPasswordMessage, error } = useAppSelector((state) => state.auth);

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [toastMsg, setToastMsg] = useState(null);

  // Clear errors and states on load/unload
  useEffect(() => {
    dispatch(clearErrors());
    dispatch(resetRegisterState());
  }, [dispatch]);

  // Show error toasts from state
  useEffect(() => {
    if (error) {
      setToastMsg({ message: error, type: 'error' });
      dispatch(clearErrors());
    }
  }, [error, dispatch]);

  // Handle successful forgot password (transition to Phase 2)
  useEffect(() => {
    if (forgotPasswordStatus === 'success' && forgotPasswordMessage) {
      setToastMsg({ message: forgotPasswordMessage, type: 'success' });
      dispatch(clearErrors());
    }
  }, [forgotPasswordStatus, forgotPasswordMessage, dispatch]);

  // Handle successful password reset (redirect to login)
  useEffect(() => {
    if (resetPasswordStatus === 'success' && resetPasswordMessage) {
      setToastMsg({ message: resetPasswordMessage, type: 'success' });
      dispatch(clearErrors());
      const timer = setTimeout(() => {
        dispatch(resetRegisterState());
        navigate('/login');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [resetPasswordStatus, resetPasswordMessage, navigate, dispatch]);

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (!email) {
      setToastMsg({ message: 'Please enter your email', type: 'error' });
      return;
    }
    dispatch(forgotPassword(email.trim()));
  };

  const handleResetSubmit = (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setToastMsg({ message: 'Please enter a valid 6-digit OTP code', type: 'error' });
      return;
    }
    if (newPassword.length < 8) {
      setToastMsg({ message: 'New password must be at least 8 characters', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setToastMsg({ message: 'Passwords do not match', type: 'error' });
      return;
    }
    dispatch(resetPassword({
      email: email.trim(),
      code: otp,
      new_password: newPassword,
      confirm_password: confirmPassword
    }));
  };

  // Phase 2: Enter OTP and Reset Password
  if (forgotPasswordStatus === 'success') {
    return (
      <div className="animate-fade-in-up">
        {toastMsg && (
          <Toast message={toastMsg.message} type={toastMsg.type} onClose={() => setToastMsg(null)} />
        )}
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#06b6d4]/15 to-[#a855f7]/15 border border-white/10 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-base">🛡️</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white font-[family-name:var(--font-display)]">
              Set New Password
            </h3>
            <p className="text-white/40 text-xs mt-0.5">
              Code sent to <span className="text-white/80 font-medium">{email}</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleResetSubmit} className="space-y-4">
          <Input
            label="Reset Code (OTP)"
            name="otp"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            maxLength={6}
            required
            disabled={resetPasswordStatus === 'loading'}
            className="text-center tracking-[12px] font-mono text-2xl"
          />

          <Input
            label="New Password"
            name="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
            required
            disabled={resetPasswordStatus === 'loading'}
          />

          <Input
            label="Confirm New Password"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
            required
            disabled={resetPasswordStatus === 'loading'}
          />

          <Button
            type="submit"
            variant="neon"
            isLoading={resetPasswordStatus === 'loading'}
            className="w-full text-base font-black py-3.5 mt-2"
          >
            Reset Password
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            dispatch(resetRegisterState());
            setOtp('');
            setNewPassword('');
            setConfirmPassword('');
          }}
          disabled={resetPasswordStatus === 'loading'}
          className="text-xs text-white/40 hover:text-[#39ff14] transition-colors cursor-pointer font-semibold hover:underline bg-transparent border-none mt-6 block mx-auto disabled:opacity-50"
        >
          Change Email / Request New Code
        </button>
      </div>
    );
  }

  // Phase 1: Enter Email Form
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

      <form onSubmit={handleEmailSubmit} className="space-y-6">
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
          disabled={forgotPasswordStatus === 'loading'}
        />
        
        <Button
          type="submit"
          variant="neon"
          isLoading={forgotPasswordStatus === 'loading'}
          className="w-full text-base font-black py-3.5"
        >
          Send Reset OTP
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
