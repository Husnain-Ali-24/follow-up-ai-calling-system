import api from './api';

const authService = {
  login: async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const data = response.data;
      localStorage.setItem('auth_token', data.access_token);

      return {
        token: data.access_token,
        user: data.user,
      };
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Invalid email or password');
    }
  },
  
  logout: () => {
    localStorage.removeItem('auth_token');
  },
  
  getCurrentUser: async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      return null;
    }

    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error) {
      localStorage.removeItem('auth_token');
      return null;
    }
  }
};

export default authService;
