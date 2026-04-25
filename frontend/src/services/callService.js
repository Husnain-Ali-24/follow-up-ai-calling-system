import api from './api';

const callService = {
  getCalls: async (filters) => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.page) params.append('page', filters.page);
    if (filters?.per_page) params.append('per_page', filters.per_page);

    const response = await api.get(`/calls/?${params.toString()}`);
    const filtered = response.data.items;

    return {
      data: filtered,
      total: response.data.total,
      page: response.data.page,
      per_page: response.data.per_page,
      pages: response.data.pages,
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
