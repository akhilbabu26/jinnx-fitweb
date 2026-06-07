import api from './api';

export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (details) => api.post('/auth/register', details),
  verifyOTP: (details) => api.post('/auth/verify-otp', details),
  logout: () => api.post('/auth/logout'),
  refresh: () => api.post('/auth/refresh'),
};
