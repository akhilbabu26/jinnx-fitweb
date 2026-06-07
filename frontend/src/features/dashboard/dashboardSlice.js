import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  stats: null,
  recentActivity: [],
  isLoading: false,
  error: null,
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setStats(state, action) {
      state.stats = action.payload;
    },
    setRecentActivity(state, action) {
      state.recentActivity = action.payload;
    },
  },
});

export const { setStats, setRecentActivity } = dashboardSlice.actions;
export default dashboardSlice.reducer;
