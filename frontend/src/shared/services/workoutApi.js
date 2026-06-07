import api from './api';

export const workoutApi = {
  // ── User-Facing ────────────────────────────────────────────────────────────
  getCourses: () => api.get('/courses'),
  getCourseBySlug: (slug) => api.get(`/courses/${slug}`),
  enroll: (courseId, onboardingData) => api.post('/courses/enroll', {
    course_id: courseId,
    onboarding_data: onboardingData,
  }),
  getEnrolledCourse: () => api.get('/courses/my'),
  getTodayWorkout: () => api.get('/workouts/today'),
  getWorkoutDetails: (id) => api.get(`/workouts/${id}`),
  logExercise: (data) => api.post('/workouts/exercises/log', data),
  completeWorkoutDay: (dayId) => api.post(`/workouts/${dayId}/complete`),
  cancelEnrollment: () => api.delete('/courses/my'),
  getMyTasks: () => api.get('/users/me/tasks'),
  updateTaskStatus: (taskId, status) => api.patch(`/users/tasks/${taskId}`, { status }),

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
};
