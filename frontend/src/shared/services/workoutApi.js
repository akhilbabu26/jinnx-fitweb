import api from './api';

export const workoutApi = {
  // ── User-Facing ────────────────────────────────────────────────────────────
  getCourses: () => api.get('/workouts/courses'),
  enroll: (courseId, onboardingData) => api.post(`/workouts/course/${courseId}/enroll`, {
    onboarding_data: onboardingData,
  }),
  getEnrolledCourse: () => api.get('/workouts/course/enrolled'),
  getTodayWorkout: () => api.get('/workouts/today'),
  getWorkoutHistory: () => api.get('/workouts/history'),
  logExercise: (data) => Promise.resolve({ data: { success: true } }), // Mocked local-only
  completeWorkoutDay: (dayId) => api.post(`/workouts/day/${dayId}/complete`),
  cancelEnrollment: () => api.post('/workouts/course/cancel'),
  getMyTasks: () => api.get('/workouts/tasks'),
  updateTaskStatus: (taskId, status) => api.post(`/workouts/tasks/${taskId}/complete`),

  // ── Admin: Weeks Program CRUD ──────────────────────────────────────────────
  getWeeks: (courseId, level) => api.get(`/admin/courses/${courseId}/weeks?level=${level}`),
  createWeek: (data) => api.post('/admin/weeks', data),
  updateWeek: (id, data) => api.put(`/admin/weeks/${id}`, data),
  deleteWeek: (id) => api.delete(`/admin/weeks/${id}`),

  // ── Admin: Week Days CRUD ──────────────────────────────────────────────────
  getWeekDays: (weekId) => api.get(`/admin/weeks/${weekId}/days`),
  createWeekDay: (data) => api.post('/admin/days', data),
  updateWeekDay: (id, data) => api.put(`/admin/days/${id}`, data),
  deleteWeekDay: (id) => api.delete(`/admin/days/${id}`),

  // ── Admin: Exercises CRUD ──────────────────────────────────────────────────
  getExercises: (dayId) => api.get(`/admin/days/${dayId}/exercises`),
  createExercise: (data) => api.post('/admin/exercises', data),
  updateExercise: (id, data) => api.put(`/admin/exercises/${id}`, data),
  deleteExercise: (id) => api.delete(`/admin/exercises/${id}`),

  // ── Admin: User Approvals & Tasks ──────────────────────────────────────────
  getRejectedUsers: () => api.get('/admin/users/rejected'),
  reApproveUser: (userId) => api.patch(`/admin/users/${userId}/re-approve`),
  setUserLevel: (userId, level) => api.patch(`/admin/users/${userId}/level`, { level }),
  assignTask: (data) => api.post('/admin/tasks', data),
  getAdminTasks: () => api.get('/admin/tasks'),
  getUserTasks: (userId) => api.get(`/admin/users/${userId}/tasks`),
  deleteTask: (taskId) => api.delete(`/admin/tasks/${taskId}`),
  getAdminCourses: () => api.get('/admin/courses'),

  // ── Admin: User Custom Plans & Settings ────────────────────────────────────
  getUserPlan: (userId) => api.get(`/admin/users/${userId}/plan`),
  createUserWeek: (userId, data) => api.post(`/admin/users/${userId}/plan/week`, data),
  createUserDay: (data) => api.post('/admin/users/plan/day', data),
  createUserExercise: (data) => api.post('/admin/users/plan/exercise', data),
  updateUserExercise: (exerciseId, data) => api.put(`/admin/users/plan/exercise/${exerciseId}`, data),
  deleteUserExercise: (exerciseId) => api.delete(`/admin/users/plan/exercise/${exerciseId}`),
  addUserDayFeedback: (userId, dayId, feedbackText) => api.post(`/admin/users/${userId}/plan/day/${dayId}/feedback`, { feedback_text: feedbackText }),
  toggleUserVideoAccess: (userId, enabled) => api.put(`/admin/users/${userId}/video-access`, { enabled }),
  getTrialExpiringUsers: () => api.get('/admin/users/trial-expiring'),
  getUserEnrollment: (userId) => api.get(`/admin/users/${userId}/enrollment`),
};
