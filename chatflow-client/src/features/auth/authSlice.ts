import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import requests from "../../api/requests";
import type { IUser } from "../../models/IUser";
import type { FieldValues } from "react-hook-form";
import { signalRService } from "../../api/signalRService";
import { getApiError } from "../../utils/apiError";
import { cache } from "../../utils/cache";

interface AuthState {
  user: IUser | null;
  isAuthenticated: boolean;
  status: "idle" | "loading" | "ready";
  loginLoading: boolean;
  registerLoading: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  status: "loading",
  loginLoading: false,
  registerLoading: false,
};


export const loginUser = createAsyncThunk<
  IUser,
  FieldValues,
  { rejectValue: string }
>("auth/loginUser", async (data, { rejectWithValue }) => {
  try {
    return await requests.Auth.login(data);
  } catch (error) {
    return rejectWithValue(getApiError(error, "Giriş başarısız oldu."));
  }
});

export const registerUser = createAsyncThunk<
  string,
  FieldValues,
  { rejectValue: string }
>("auth/registerUser", async (data, { rejectWithValue }) => {
  try {
    const result = await requests.Auth.register(data);
    return result?.message ?? "Kayıt başarılı!";
  } catch (error) {
    return rejectWithValue(getApiError(error, "Kayıt başarısız oldu."));
  }
});

export const logoutUser = createAsyncThunk("auth/logoutUser", async () => {
  await signalRService.disconnect();
  cache.clear();
  try {
    await requests.Auth.logout();
  } catch {
    return;
  }
});

export const getMe = createAsyncThunk<IUser, void, { rejectValue: null }>(
  "auth/getMe",
  async (_, { rejectWithValue }) => {
    try {
      return await requests.Auth.getMe();
    } catch {
      return rejectWithValue(null);
    }
  },
);

export const authSlice = createSlice({
  name: "auth",
  initialState,

  reducers: {
    updateAvatar(state, action: PayloadAction<string>) {
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
