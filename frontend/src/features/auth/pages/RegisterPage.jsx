import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { registerUser, verifyOTP, resendOTP, clearErrors, resetRegisterState } from '../authSlice';
import Input from '../../../shared/components/ui/Input';
import Button from '../../../shared/components/ui/Button';
import Toast from '../../../shared/components/ui/Toast';

export default function RegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { registerStatus, registerMessage, otpStatus, otpMessage, resendOTPStatus, resendOTPMessage, error } = useAppSelector((state) => state.auth);

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm_password: '' });
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(60);
  const [toastMsg, setToastMsg] = useState(null);

  // Clear states on mount & unmount
  useEffect(() => {
    dispatch(clearErrors());
    dispatch(resetRegisterState());
    setCooldown(60);
  }, [dispatch]);

  // Handle errors from state
  useEffect(() => {
    if (error) {
      setToastMsg({ message: error, type: 'error' });
      dispatch(clearErrors());
    }
  }, [error, dispatch]);

  // Handle successful registration -> OTP Code Toast
  useEffect(() => {
    if (registerStatus === 'success' && registerMessage) {
      setToastMsg({ message: registerMessage, type: 'success' });
    }
  }, [registerStatus, registerMessage]);

  // Handle successful verification code
  useEffect(() => {
    if (otpStatus === 'success' && otpMessage) {
      setToastMsg({ message: otpMessage, type: 'success' });
    }
  }, [otpStatus, otpMessage]);

  // Handle successful OTP resend
  useEffect(() => {
    if (resendOTPStatus === 'success' && resendOTPMessage) {
      setToastMsg({ message: resendOTPMessage, type: 'success' });
      dispatch(clearErrors());
    }
  }, [resendOTPStatus, resendOTPMessage, dispatch]);

  // Cooldown countdown timer for resend OTP
  useEffect(() => {
    let timer;
    if (registerStatus === 'success' && cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [registerStatus, cooldown]);

  const formatCooldown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleResendOTP = () => {
    if (cooldown === 0 && resendOTPStatus !== 'loading') {
      dispatch(resendOTP(form.email));
      setCooldown(60);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.confirm_password) {
      setToastMsg({ message: 'All fields are required', type: 'error' });
      return;
    }
    if (form.password !== form.confirm_password) {
      setToastMsg({ message: 'Passwords do not match', type: 'error' });
      return;
    }
    if (form.password.length < 8) {
      setToastMsg({ message: 'Password must be at least 8 characters', type: 'error' });
      return;
    }

    dispatch(registerUser(form));
  };

  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setToastMsg({ message: 'Please enter a valid 6-digit OTP code', type: 'error' });
      return;
    }
    // Backend expects field name 'code', not 'otp'
    dispatch(verifyOTP({ email: form.email, code: otp }));
  };

  // Phase 3: OTP Success -> Approval Pending
  if (otpStatus === 'success') {
    return (
      <div className="text-center py-6 animate-scale-in">
        {toastMsg && (
          <Toast message={toastMsg.message} type={toastMsg.type} onClose={() => setToastMsg(null)} />
        )}
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#39ff14]/10 border border-[#39ff14]/30 flex items-center justify-center relative shadow-[0_0_20px_rgba(57,255,20,0.1)]">
          <span className="text-3xl text-[#39ff14] font-bold">✓</span>
        </div>
        <h2 className="text-2xl font-black text-white mb-2 font-[family-name:var(--font-display)] tracking-tight">
          Verification Complete
        </h2>
        <p className="text-white/50 text-sm leading-relaxed mb-6 max-w-xs mx-auto">
          Your email has been verified successfully. Your registration is now pending review and approval by the trainer.
        </p>
        <Link to="/login">
          <Button variant="neon" className="w-full">
            Back to Login
          </Button>
        </Link>
      </div>
    );
  }

  // Phase 2: Enter OTP Form
  if (registerStatus === 'success') {
    return (
      <div className="animate-fade-in-up">
        {toastMsg && (
          <Toast message={toastMsg.message} type={toastMsg.type} onClose={() => setToastMsg(null)} />
        )}
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#06b6d4]/15 to-[#a855f7]/15 border border-white/10 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-base">🔒</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-white font-[family-name:var(--font-display)]">
              Verify Email
            </h3>
            <p className="text-white/40 text-xs mt-0.5">
              Code sent to <span className="text-white/80 font-medium">{form.email}</span>
            </p>
          </div>
        </div>

        {/* OTP Input form */}
        <form onSubmit={handleOTPSubmit} className="space-y-6">
          <Input
            label="Verification Code (OTP)"
            name="otp"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            maxLength={6}
            required
            disabled={otpStatus === 'loading'}
            className="text-center tracking-[12px] font-mono text-2xl"
          />
          <Button
            type="submit"
            variant="neon"
            isLoading={otpStatus === 'loading'}
            className="w-full text-base font-black py-3.5"
          >
            Verify Code
          </Button>

          <div className="text-center text-sm pt-2">
            {cooldown > 0 ? (
              <span className="text-white/40 font-medium select-none">
                Resend code in <strong className="text-white/70 font-mono">{formatCooldown(cooldown)}</strong>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={resendOTPStatus === 'loading'}
                className="text-[#39ff14] hover:text-[#2bcc0f] transition-all cursor-pointer font-bold hover:underline bg-transparent border-none text-sm disabled:opacity-50"
              >
                {resendOTPStatus === 'loading' ? 'Resending...' : 'Resend OTP'}
              </button>
            )}
          </div>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => {
              dispatch(resetRegisterState());
              setCooldown(60);
            }}
            className="text-xs text-white/40 hover:text-[#39ff14] transition-colors cursor-pointer font-semibold hover:underline bg-transparent border-none"
          >
            Back to Registration
          </button>
        </div>
      </div>
    );
  }

  // Phase 1: Registration Form
  return (
    <div className="animate-fade-in-up">
      {toastMsg && (
        <Toast message={toastMsg.message} type={toastMsg.type} onClose={() => setToastMsg(null)} />
      )}
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#06b6d4]/15 to-[#a855f7]/15 border border-white/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-[#06b6d4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-white font-[family-name:var(--font-display)]">
            Request Access
          </h3>
          <p className="text-white/40 text-xs mt-0.5">
            Create an account to join JINNX FIT
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleRegisterSubmit} className="space-y-4">
        <Input
          label="Full Name"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Your full name"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
          required
          disabled={registerStatus === 'loading'}
        />
        <Input
          label="Email Address"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          placeholder="your@email.com"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
          required
          disabled={registerStatus === 'loading'}
        />
        <Input
          label="Password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          placeholder="••••••••"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          }
          required
          disabled={registerStatus === 'loading'}
        />
        <Input
          label="Confirm Password"
          name="confirm_password"
          type="password"
          value={form.confirm_password}
          onChange={handleChange}
          placeholder="••••••••"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          }
          required
          disabled={registerStatus === 'loading'}
        />

        <Button
          type="submit"
          variant="neon"
          isLoading={registerStatus === 'loading'}
          className="w-full text-base font-black py-3.5 mt-2"
        >
          Submit Registration
        </Button>
      </form>

      <p className="text-center text-white/40 text-sm mt-6">
        Already have access?{' '}
        <Link to="/login" className="text-[#39ff14] hover:text-[#2bcc0f] transition-colors font-bold ml-1 hover:underline">
          Sign In
        </Link>
      </p>
    </div>
  );
}
