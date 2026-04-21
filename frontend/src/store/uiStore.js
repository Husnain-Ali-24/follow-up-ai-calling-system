import { create } from 'zustand';

export const useUIStore = create((set) => ({
  isSidebarOpen: true,
  theme: 'dark',
  
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  setTheme: (theme) => set({ theme }),
}));
