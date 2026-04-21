import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useUIStore } from '../../store/uiStore';
import { cn } from '../../lib/utils';

export default function DashboardShell() {
  const isSidebarOpen = useUIStore(state => state.isSidebarOpen);

  return (
    <div className="min-h-screen bg-background-primary text-text-primary flex">
      <Sidebar />
      <main 
        className={cn(
          "flex-1 flex flex-col transition-all duration-300",
          isSidebarOpen ? "ml-64" : "ml-20"
        )}
      >
        <Topbar />
        <div className="p-6 md:p-8 animate-in fade-in duration-500">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
