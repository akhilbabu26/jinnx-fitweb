import api from './api';

export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (details) => api.post('/auth/register', details),
  verifyOTP: (details) => api.post('/auth/verify-otp', details),
  resendOTP: (email) => api.post('/auth/resend-otp', { email }),
  logout: () => api.post('/auth/logout'),
  refresh: () => api.post('/auth/refresh'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (details) => api.post('/auth/reset-password', details),
};
