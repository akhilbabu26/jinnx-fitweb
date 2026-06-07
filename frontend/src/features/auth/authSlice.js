import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from '../../shared/services/authApi';

// Thunks
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await authApi.login(credentials);
      const { access_token, user } = response.data.data;
      localStorage.setItem('access_token', access_token);
      return { accessToken: access_token, user };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (details, { rejectWithValue }) => {
    try {
      const response = await authApi.register(details);
      return response.data.message || 'Verification code sent to email';
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Registration failed');
    }
  }
);

export const verifyOTP = createAsyncThunk(
  'auth/verifyOTP',
  async (details, { rejectWithValue }) => {
    try {
      const response = await authApi.verifyOTP(details);
      return response.data.message || 'OTP verified successfully';
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'OTP verification failed');
    }
  }
);

export const checkAuth = createAsyncThunk(
  'auth/checkAuth',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) throw new Error('No local token found');
      
      const response = await authApi.refresh();
      const { access_token, user } = response.data.data;
      localStorage.setItem('access_token', access_token);
      return { accessToken: access_token, user };
    } catch (error) {
      localStorage.removeItem('access_token');
      return rejectWithValue(error.response?.data?.message || 'Session expired');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { dispatch }) => {
    try {
      await authApi.logout();
    } catch (error) {
      // Ignore API fail on log out
    } finally {
      localStorage.removeItem('access_token');
    }
  }
);

const initialState = {
  accessToken: null,
  user: null,
  isLoading: false,
  error: null,
  isInitializing: true,
  registerStatus: 'idle', // idle | loading | success | failed
  registerMessage: '',
  otpStatus: 'idle', // idle | loading | success | failed
  otpMessage: '',
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action) {
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
    },
    logout(state) {
      state.accessToken = null;
      state.user = null;
      state.registerStatus = 'idle';
      state.otpStatus = 'idle';
    },
    clearErrors(state) {
      state.error = null;
      state.registerMessage = '';
      state.otpMessage = '';
    },
    resetRegisterState(state) {
      state.registerStatus = 'idle';
      state.otpStatus = 'idle';
    }
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.accessToken = action.payload.accessToken;
        state.user = action.payload.user;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Register
      .addCase(registerUser.pending, (state) => {
        state.registerStatus = 'loading';
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.registerStatus = 'success';
        state.registerMessage = action.payload;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.registerStatus = 'failed';
        state.error = action.payload;
      })
      // Verify OTP
      .addCase(verifyOTP.pending, (state) => {
        state.otpStatus = 'loading';
        state.error = null;
      })
      .addCase(verifyOTP.fulfilled, (state, action) => {
        state.otpStatus = 'success';
        state.otpMessage = action.payload;
      })
      .addCase(verifyOTP.rejected, (state, action) => {
        state.otpStatus = 'failed';
        state.error = action.payload;
      })
      // Check Auth
      .addCase(checkAuth.pending, (state) => {
        state.isInitializing = true;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.isInitializing = false;
        state.accessToken = action.payload.accessToken;
        state.user = action.payload.user;
      })
      .addCase(checkAuth.rejected, (state) => {
        state.isInitializing = false;
        state.accessToken = null;
        state.user = null;
      })
      // Logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.accessToken = null;
        state.user = null;
        state.registerStatus = 'idle';
        state.otpStatus = 'idle';
      });
  },
});

export const { setCredentials, logout, clearErrors, resetRegisterState } = authSlice.actions;
export default authSlice.reducer;
