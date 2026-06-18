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

export const resendOTP = createAsyncThunk(
  'auth/resendOTP',
  async (email, { rejectWithValue }) => {
    try {
      const response = await authApi.resendOTP(email);
      return response.data.message || 'Verification code resent successfully';
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to resend OTP');
    }
  }
);

export const forgotPassword = createAsyncThunk(
  'auth/forgotPassword',
  async (email, { rejectWithValue }) => {
    try {
      const response = await authApi.forgotPassword(email);
      return response.data.message || 'Verification code sent for password reset';
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to send recovery email');
    }
  }
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async (details, { rejectWithValue }) => {
    try {
      const response = await authApi.resetPassword(details);
      return response.data.message || 'Password reset successfully';
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reset password');
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
  resendOTPStatus: 'idle', // idle | loading | success | failed
  resendOTPMessage: '',
  forgotPasswordStatus: 'idle', // idle | loading | success | failed
  forgotPasswordMessage: '',
  resetPasswordStatus: 'idle', // idle | loading | success | failed
  resetPasswordMessage: '',
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
      state.resendOTPMessage = '';
      state.forgotPasswordMessage = '';
      state.resetPasswordMessage = '';
    },
    resetRegisterState(state) {
      state.registerStatus = 'idle';
      state.otpStatus = 'idle';
      state.resendOTPStatus = 'idle';
      state.resendOTPMessage = '';
      state.forgotPasswordStatus = 'idle';
      state.forgotPasswordMessage = '';
      state.resetPasswordStatus = 'idle';
      state.resetPasswordMessage = '';
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
      // Resend OTP
      .addCase(resendOTP.pending, (state) => {
        state.resendOTPStatus = 'loading';
        state.error = null;
      })
      .addCase(resendOTP.fulfilled, (state, action) => {
        state.resendOTPStatus = 'success';
        state.resendOTPMessage = action.payload;
      })
      .addCase(resendOTP.rejected, (state, action) => {
        state.resendOTPStatus = 'failed';
        state.error = action.payload;
      })
      // Forgot Password
      .addCase(forgotPassword.pending, (state) => {
        state.forgotPasswordStatus = 'loading';
        state.error = null;
      })
      .addCase(forgotPassword.fulfilled, (state, action) => {
        state.forgotPasswordStatus = 'success';
        state.forgotPasswordMessage = action.payload;
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.forgotPasswordStatus = 'failed';
        state.error = action.payload;
      })
      // Reset Password
      .addCase(resetPassword.pending, (state) => {
        state.resetPasswordStatus = 'loading';
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state, action) => {
        state.resetPasswordStatus = 'success';
        state.resetPasswordMessage = action.payload;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.resetPasswordStatus = 'failed';
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
