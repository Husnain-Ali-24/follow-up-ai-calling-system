import api from './api';
import { DUMMY_CALLS, DUMMY_CALL_EVENTS } from '../data/dummy/calls.dummy';

const callService = {
  getCalls: async (filters) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    let filtered = [...DUMMY_CALLS];
    
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(c => 
        c.client_name.toLowerCase().includes(q) || 
        c.client_phone.includes(q)
      );
    }
    
    if (filters?.status && filters.status !== 'all') {
      filtered = filtered.filter(c => c.status === filters.status);
    }
    
    if (filters?.sentiment && filters.sentiment !== 'all') {
      filtered = filtered.filter(c => c.sentiment === filters.sentiment);
    }
    
    return {
      data: filtered,
      total: filtered.length,
      page: filters?.page || 1,
      per_page: filters?.per_page || 10
    };
  },
  
  getCallById: async (id) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return DUMMY_CALLS.find(c => c.call_id === id);
  },
  
  getCallEvents: async (id) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return DUMMY_CALL_EVENTS;
  }
};

export default callService;
