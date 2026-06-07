import api from './api';

export const sessionApi = {
  joinSession: () => api.get('/sessions/join'),
  initializeSession: (userId) => api.post('/admin/sessions', { user_id: userId }),
  endSession: (roomName) => api.post('/admin/sessions/end', { room_name: roomName }),
  generatePDF: (userId) => api.get(`/admin/users/${userId}/workouts/pdf`),
};
