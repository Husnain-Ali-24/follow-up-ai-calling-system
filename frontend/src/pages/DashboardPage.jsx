import { useState, useEffect } from 'react';
import PageHeader from '../components/shared/PageHeader';
import StatsGrid from '../components/dashboard/StatsGrid';
import CallVolumeChart from '../components/dashboard/CallVolumeChart';
import ActivityFeed from '../components/dashboard/ActivityFeed';
import dashboardService from '../services/dashboardService';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [callVolume, setCallVolume] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const data = await dashboardService.getOverview();
        setStats(data.stats);
        setCallVolume(data.call_volume || []);
        setRecentActivity(data.recent_activity || []);
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
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
              <div className="bg-background-secondary border border-border rounded-md px-3 py-1 text-sm text-text-secondary">
                Last 7 Days
              </div>
            </div>
            <div className="h-[300px]">
              <CallVolumeChart data={callVolume} loading={loading} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <ActivityFeed activities={recentActivity} loading={loading} />
        </div>
      </div>
    </div>
  );
}
