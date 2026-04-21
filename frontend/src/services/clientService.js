import api from './api';
import { DUMMY_CLIENTS } from '../data/dummy/clients.dummy';

const clientService = {
  getClients: async (filters) => {
    // Use dummy data for now
    await new Promise(resolve => setTimeout(resolve, 500));
    let filtered = [...DUMMY_CLIENTS];
    
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(c => 
        c.full_name.toLowerCase().includes(q) || 
        c.phone_number.includes(q)
      );
    }
    
    if (filters?.status && filters.status !== 'all') {
      filtered = filtered.filter(c => c.status === filters.status);
    }
    
    return {
      data: filtered,
      total: filtered.length,
      page: filters?.page || 1,
      per_page: filters?.per_page || 10
    };
  },
  
  getClientById: async (id) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return DUMMY_CLIENTS.find(c => c.client_id === id);
  },
  
  createClient: async (payload) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    const newClient = {
      ...payload,
      client_id: `c-${Math.floor(Math.random() * 1000)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return newClient;
  },
  
  updateClient: async (id, payload) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    return { ...payload, client_id: id, updated_at: new Date().toISOString() };
  },
  
  deleteClient: async (id) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return true;
  }
};

export default clientService;
