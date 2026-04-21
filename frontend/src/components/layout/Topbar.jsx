import { useAuthStore } from '../../store/authStore';
import { Bell, User, Search } from 'lucide-react';
import ThemeToggle from '../shared/ThemeToggle';

export default function Topbar() {
  const user = useAuthStore(state => state.user);
  const displayName = user?.full_name || user?.name || 'Admin';
  const displayInitial = displayName.charAt(0).toUpperCase();

  return (
    <header className="h-16 border-b border-border bg-background-primary/80 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
      <div className="flex items-center flex-1">
        <div className="relative w-96 hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input 
            type="text" 
            placeholder="Search everything..." 
            className="w-full bg-background-secondary border border-border rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-accent-primary transition-all"
          />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <ThemeToggle />
        <button className="p-2 text-text-secondary hover:bg-background-hover rounded-full transition-colors relative">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-status-error rounded-full"></span>
        </button>
        
        <div className="flex items-center space-x-3 border-l border-border pl-4 ml-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-text-primary">{displayName}</p>
            <p className="text-xs text-text-muted">{user?.email || 'admin@example.com'}</p>
          </div>
          <div className="w-9 h-9 bg-accent-primary rounded-full flex items-center justify-center text-text-inverse font-bold">
            {displayInitial}
          </div>
        </div>
      </div>
    </header>
  );
}
