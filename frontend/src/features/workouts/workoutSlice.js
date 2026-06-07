import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  workouts: [],
  activeWorkout: null,
  isLoading: false,
  error: null,
};

const workoutSlice = createSlice({
  name: 'workouts',
  initialState,
  reducers: {
    setWorkouts(state, action) {
      state.workouts = action.payload;
    },
    setActiveWorkout(state, action) {
      state.activeWorkout = action.payload;
    },
  },
});

export const { setWorkouts, setActiveWorkout } = workoutSlice.actions;
export default workoutSlice.reducer;
