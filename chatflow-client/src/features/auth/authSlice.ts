import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import requests from "../../api/requests";
import type { IUser } from "../../models/IUser";
import type { FieldValues } from "react-hook-form";
import { signalRService } from "../../api/signalRService";

// STATE
interface AuthState {
  user: IUser | null;
  token: string | null;
  isAuthenticated: boolean;
  status: "idle" | "loading" | "ready";
  loginLoading: boolean;
  registerLoading: boolean;
}

// INITIAL STATE
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  status: "loading",
  loginLoading: false,
  registerLoading: false,
};

export const loginUser = createAsyncThunk<IUser, FieldValues>(
  "auth/loginUser",
  async (data, { rejectWithValue }) => {
    try {
      const user = await requests.Auth.login(data);
      return user;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Giriş Başarısız oldu");
    }
  },
);

export const registerUser = createAsyncThunk<void, FieldValues>(
  "auth/registerUser",
  async (data, { rejectWithValue }) => {
    try {
      await requests.Auth.register(data);
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Kayıt Başarısız oldu");
    }
  },
);

export const logoutUser = createAsyncThunk("auth/logoutUser", async () => {
  await signalRService.disconnect();
  await requests.Auth.logout();
});

export const getMe = createAsyncThunk(
  "auth/getMe",
  async (_, { rejectWithValue }) => {
    try {
      const user = await requests.Auth.getMe();
      return user;
    } catch {
      return rejectWithValue(null);
    }
  },
);

// SLICE
export const authSlice = createSlice({
  name: "auth",
  initialState,

  reducers: {
    updateAvatar(state, action: { payload: string }) {
      if (state.user) {
        state.user.avatar = action.payload;
      }
    },
    updateProfile(
      state,
      action: PayloadAction<{
        fullName: string;
        userName: string;
        email?: string;
        bio?: string;
      }>,
    ) {
      if (state.user) {
        state.user.fullName = action.payload.fullName;
        state.user.userName = action.payload.userName;
        state.user.email = action.payload.email;
        state.user.bio = action.payload.bio;
      }
    },
  },

  extraReducers: (builder) => {
    builder.addCase(loginUser.pending, (state) => {
      state.loginLoading = true;
    });
    builder.addCase(loginUser.fulfilled, (state, action) => {
      state.loginLoading = false;
      state.user = action.payload;
      state.token = action.payload.token ?? null;
      state.isAuthenticated = true;
      state.status = "ready";
    });
    builder.addCase(loginUser.rejected, (state) => {
      state.loginLoading = false;
    });

    builder.addCase(registerUser.pending, (state) => {
      state.registerLoading = true;
    });
    builder.addCase(registerUser.fulfilled, (state) => {
      state.registerLoading = false;
    });
    builder.addCase(registerUser.rejected, (state) => {
      state.registerLoading = false;
    });

    builder.addCase(logoutUser.fulfilled, (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.status = "ready";
    });

    builder.addCase(getMe.fulfilled, (state, action) => {
      state.user = action.payload;
      state.token = action.payload.token ?? null;
      state.isAuthenticated = true;
      state.status = "ready";
    });
    builder.addCase(getMe.rejected, (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.status = "ready";
    });
  },
});

export const { updateAvatar, updateProfile } = authSlice.actions;
export default authSlice.reducer;
