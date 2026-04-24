import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  PhoneCall, 
  FilePieChart, 
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { cn } from '../../lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users, label: 'Clients', path: '/clients' },
  { icon: PhoneCall, label: 'Call Logs', path: '/calls' },
  { icon: FilePieChart, label: 'Reports', path: '/reports' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export default function Sidebar() {
  const logout = useAuthStore(state => state.logout);
  const { isSidebarOpen, toggleSidebar } = useUIStore();

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-full bg-background-secondary border-r border-border transition-all duration-300 z-50 flex flex-col",
        isSidebarOpen ? "w-64" : "w-20"
      )}
    >
      <div className="p-4 flex items-center justify-between">
        <div className={cn("font-bold text-accent-primary truncate", !isSidebarOpen && "hidden")}>
          AI CALLER
        </div>
        <button 
          onClick={toggleSidebar}
          className="p-1 hover:bg-background-hover rounded-md transition-colors"
        >
          {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1 mt-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              fontWeight: isActive ? 500 : 400,
              color: isActive ? 'var(--sidebar-text-active)' : 'var(--text-secondary)',
              background: isActive ? 'var(--sidebar-item-active)' : 'transparent',
              textDecoration: 'none',
              transition: 'all var(--transition-fast)',
              justifyContent: isSidebarOpen ? 'flex-start' : 'center',
            })}
            onMouseEnter={(e) => {
              if (e.currentTarget.style.background === 'transparent' || e.currentTarget.style.background === '') {
                e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
               // A bit tricky with inline styles to reset without full state, simplified approach:
               e.currentTarget.style.background = e.currentTarget.getAttribute('aria-current') === 'page' ? 'var(--sidebar-item-active)' : 'transparent';
               e.currentTarget.style.color = e.currentTarget.getAttribute('aria-current') === 'page' ? 'var(--sidebar-text-active)' : 'var(--text-secondary)';
            }}
          >
            <item.icon
              size={22}
              style={{ color: 'inherit' }}
            />
            {isSidebarOpen && <span className="font-medium">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-border">
        <button
          onClick={logout}
          className={cn(
            "flex items-center w-full px-3 py-3 rounded-md text-text-secondary hover:bg-status-error-bg hover:text-status-error transition-all duration-200",
            !isSidebarOpen && "justify-center"
          )}
        >
          <LogOut size={22} />
          {isSidebarOpen && <span className="ml-3 font-medium">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
