import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        set({ theme: next });
        applyTheme(next);
      },
      setTheme: (t) => {
        set({ theme: t });
        applyTheme(t);
      },
    }),
    { name: 'theme-preference' }
  )
);

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(theme);
}

// Call this once on app startup to sync persisted theme
export function initTheme() {
  const stored = localStorage.getItem('theme-preference');
  try {
    const parsed = JSON.parse(stored || '{}');
    const theme = parsed?.state?.theme === 'light' ? 'light' : 'dark';
    applyTheme(theme);
  } catch {
    applyTheme('dark');
  }
}
