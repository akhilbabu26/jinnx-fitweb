import api from './api';

export const sessionApi = {
  joinSession: (roomName) => api.post('/video/token', { room_name: roomName }),
  initializeSession: (userId) => api.post('/video/room/create', { user_id: userId }),
  endSession: (sessionId) => api.post(`/video/room/${sessionId}/end`),
  generatePDF: (userId) => api.get(`/admin/users/${userId}/workouts/pdf`), // remains mock/placeholder
};
