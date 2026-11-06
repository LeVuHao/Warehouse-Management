import { create } from 'zustand';
import axios from 'axios';

export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true, // starts loading to check storage on load

  setAccessToken: (token) => {
    set({ accessToken: token });
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', token);
      document.cookie = `accessToken=${token}; path=/; max-age=900; SameSite=Lax`;
    }
  },

  updateUser: (user) => {
    set({ user });
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user));
    }
  },

  login: async (username, password) => {
    set({ isLoading: true });
    try {
      const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
      const response = await axios.post(`${baseURL}/auth/login`, { username, password });
      
      const { accessToken, refreshToken, user } = response.data;
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(user));
        // Cookie cho Next.js middleware (15 phút, khớp access token)
        document.cookie = `accessToken=${accessToken}; path=/; max-age=900; SameSite=Lax`;
      }

      set({
        user,
        accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });

      return { success: true };
    } catch (error) {
      set({ isLoading: false });
      return {
        success: false,
        message: error.response?.data?.message || 'Không thể kết nối đến máy chủ đăng nhập.',
      };
    }
  },

  logout: async () => {
    const refreshToken = get().refreshToken;
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

    if (refreshToken) {
      try {
        await axios.post(`${baseURL}/auth/logout`, { token: refreshToken });
      } catch (error) {
        console.warn('Logout API failed (token may already be revoked):', error);
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      document.cookie = 'accessToken=; path=/; max-age=0; SameSite=Lax';
    }

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  // Called on app load to sync local storage into Zustand state
  initialize: () => {
    if (typeof window === 'undefined') return;

    try {
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      const userStr = localStorage.getItem('user');

      if (accessToken && refreshToken && userStr) {
        set({
          user: JSON.parse(userStr),
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (e) {
      console.error('Failed to parse cached authentication state:', e);
      set({ isLoading: false });
    }
  },
}));
