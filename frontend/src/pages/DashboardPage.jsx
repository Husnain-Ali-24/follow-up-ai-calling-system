import { useState, useEffect } from 'react';
import PageHeader from '../components/shared/PageHeader';
import StatsGrid from '../components/dashboard/StatsGrid';
import CallVolumeChart from '../components/dashboard/CallVolumeChart';
import ActivityFeed from '../components/dashboard/ActivityFeed';
import dashboardService from '../services/dashboardService';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await dashboardService.getStats();
        setStats(data);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Dashboard Overview" 
        subtitle="Real-time monitoring of your AI outbound calling performance."
      />

      <StatsGrid stats={stats} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-background-card border border-border rounded-xl p-6 h-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-text-primary">Call Volume (7 Days)</h3>
              <select className="bg-background-secondary border border-border rounded-md px-3 py-1 text-sm focus:outline-none">
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
              </select>
            </div>
            <div className="h-[300px]">
              <CallVolumeChart />
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
