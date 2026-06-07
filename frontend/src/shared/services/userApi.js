import api from './api';

export const userApi = {
  // User endpoints
  getProfile: () => api.get('/users/me'),
  updateProfile: (data) => api.put('/users/me', data),
  changePassword: (data) => api.patch('/users/me/password', data),

  // Admin endpoints
  getApprovedUsers: () => api.get('/admin/users'),
  getPendingUsers: () => api.get('/admin/users/pending'),
  approveUser: (id) => api.patch(`/admin/users/${id}/approve`),
  rejectUser: (id) => api.patch(`/admin/users/${id}/reject`),
};
