import api from './api';
import { DUMMY_STATS, DUMMY_CALL_VOLUME, DUMMY_RECENT_ACTIVITY } from '../data/dummy/dashboard.dummy';

const dashboardService = {
  getStats: async () => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return DUMMY_STATS;
  },
  
  getCallVolume: async (period = '7d') => {
    await new Promise(resolve => setTimeout(resolve, 400));
    return DUMMY_CALL_VOLUME;
  },
  
  getRecentActivity: async () => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return DUMMY_RECENT_ACTIVITY;
  }
};

export default dashboardService;
