import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  trainers: [],
  selectedTrainer: null,
  isLoading: false,
  error: null,
};

const trainerSlice = createSlice({
  name: 'trainers',
  initialState,
  reducers: {
    setTrainers(state, action) {
      state.trainers = action.payload;
    },
    setSelectedTrainer(state, action) {
      state.selectedTrainer = action.payload;
    },
  },
});

export const { setTrainers, setSelectedTrainer } = trainerSlice.actions;
export default trainerSlice.reducer;
