import { create } from 'zustand';
import authService from '../services/authService';

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('auth_token') || null,
  isAuthenticated: !!localStorage.getItem('auth_token'),
  isLoading: true,
  
  login: async (email, password) => {
    const data = await authService.login(email, password);
    set({ 
      user: data.user, 
      token: data.token, 
      isAuthenticated: true 
    });
    return data;
  },
  
  logout: () => {
    authService.logout();
    set({ user: null, token: null, isAuthenticated: false });
  },
  
  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        set({ user, isAuthenticated: true, token: localStorage.getItem('auth_token') });
      } else {
        set({ user: null, token: null, isAuthenticated: false });
      }
    } catch (error) {
      set({ user: null, token: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  }
}));
