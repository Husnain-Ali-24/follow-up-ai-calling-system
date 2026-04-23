import api from './api';

const clientService = {
  getClients: async (filters) => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page);
    if (filters?.per_page) params.append('per_page', filters.per_page);
    if (filters?.skip !== undefined) params.append('skip', filters.skip);
    if (filters?.limit) params.append('limit', filters.limit);
    
    const response = await api.get(`/clients/?${params.toString()}`);
    return {
      data: response.data.items,
      total: response.data.total,
      page: response.data.page,
      per_page: response.data.per_page,
      pages: response.data.pages,
    };
  },
  
  getClientById: async (id) => {
    const response = await api.get(`/clients/${id}`);
    return response.data;
  },
  
  createClient: async (payload) => {
    const response = await api.post('/clients/', payload);
    return response.data;
  },
  
  updateClient: async (id, payload) => {
    const response = await api.patch(`/clients/${id}`, payload);
    return response.data;
  },
  
  deleteClient: async (id) => {
    const response = await api.delete(`/clients/${id}`);
    return response.data;
  },

  importBulk: async (payload) => {
    const response = await api.post('/clients/bulk', payload);
    return response.data;
  }
};

export default clientService;
