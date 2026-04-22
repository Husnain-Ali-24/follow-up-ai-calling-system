import api from './api';

const settingsService = {
  getSettings: async () => {
    const response = await api.get('/settings/');
    return response.data;
  },
  
  updateSettings: async (payload) => {
    const response = await api.put('/settings/', payload);
    return response.data;
  }
};

export default settingsService;
