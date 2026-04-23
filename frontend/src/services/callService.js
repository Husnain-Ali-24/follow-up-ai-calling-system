import api from './api';

const callService = {
  getCalls: async (filters) => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);

    const response = await api.get(`/calls/?${params.toString()}`);
    let filtered = response.data;

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
    const response = await api.get(`/calls/${id}`);
    return response.data;
  },
  
  getCallEvents: async (id) => {
    const response = await api.get(`/calls/${id}/events`);
    return response.data;
  }
};

export default callService;
