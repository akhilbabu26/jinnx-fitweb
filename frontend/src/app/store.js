import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import userReducer from '../features/users/userSlice';
import workoutReducer from '../features/workouts/workoutSlice';
import trainerReducer from '../features/trainers/trainerSlice';
import dashboardReducer from '../features/dashboard/dashboardSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    workouts: workoutReducer,
    trainers: trainerReducer,
    dashboard: dashboardReducer,
  },
});
