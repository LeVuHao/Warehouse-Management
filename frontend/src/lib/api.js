import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

// Create Axios client pointing to Express Backend
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Access Token to every request
api.interceptors.request.use(
  (config) => {
    // Access state via store get method to avoid React Hook context issues
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle Token Refreshing when Access Token expires (403 Forbidden/401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If the request fails with 403 (or 401) and hasn't been retried yet
    if ((error.response?.status === 403 || error.response?.status === 401) && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = useAuthStore.getState().refreshToken;
      
      if (refreshToken) {
        try {
          console.log('Access token expired. Attempting to refresh token...');
          
          // Request new access token using refresh token
          const res = await axios.post(`${api.defaults.baseURL}/auth/refresh-token`, {
            token: refreshToken,
          });
          
          const { accessToken } = res.data;
          
          // Update the Access Token in Zustand store
          useAuthStore.getState().setAccessToken(accessToken);
          
          // Retry the original request with the new access token
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          console.error('Refresh token expired or invalid. Logging out...', refreshError);
          // If refresh token fails, logout user
          useAuthStore.getState().logout();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
