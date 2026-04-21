import { useState } from 'react';
import PageHeader from '../components/shared/PageHeader';
import { Download, FileText, BarChart3, Filter, Calendar, RefreshCw } from 'lucide-react';
import CallVolumeChart from '../components/dashboard/CallVolumeChart';
import DataTable from '../components/shared/DataTable';
import { DUMMY_CALLS } from '../data/dummy/calls.dummy';
import { cn } from '../lib/utils';

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);

  const reportColumns = [
    {
      header: 'Report Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div className="flex items-center space-x-3 text-text-primary">
          <FileText size={18} className="text-text-muted" />
          <span className="font-medium">{row.original.name}</span>
        </div>
      )
    },
    {
      header: 'Type',
      accessorKey: 'type',
      cell: ({ getValue }) => (
        <span className="text-[10px] px-2 py-0.5 bg-background-active rounded text-text-secondary uppercase font-bold tracking-tight">
          {getValue()}
        </span>
      )
    },
    {
      header: 'Created At',
      accessorKey: 'date'
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => (
        <div className="flex items-center text-status-success">
          <div className="w-1.5 h-1.5 rounded-full bg-current mr-2"></div>
          <span className="text-xs font-medium">{getValue()}</span>
        </div>
      )
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: () => (
        <button className="p-2 hover:bg-background-active rounded-md transition-colors text-accent-primary">
          <Download size={18} />
        </button>
      )
    }
  ];

  const dummyReports = [
    { name: 'Weekly Call Performance - Apr 20', type: 'PDF', date: '2026-04-20 18:30', status: 'Ready' },
    { name: 'Monthly Lead Conversion Report', type: 'XLSX', date: '2026-04-01 09:00', status: 'Ready' },
    { name: 'Sentiment Analysis Summary', type: 'CSV', date: '2026-04-15 14:20', status: 'Ready' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader 
        title="Analytics & Reports" 
        subtitle="Generate detailed performance insights and export data for your CRM."
        actions={
          <>
            <button className="btn-secondary flex items-center space-x-2 text-sm">
              <RefreshCw size={16} />
              <span>Refresh</span>
            </button>
            <button className="btn-primary flex items-center space-x-2 text-sm">
              <PlusIcon size={16} />
              <span>New Report</span>
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-background-card border border-border p-6 rounded-xl flex items-center space-x-4">
           <div className="w-12 h-12 rounded-xl bg-status-success-bg text-status-success flex items-center justify-center">
             <BarChart3 size={24} />
           </div>
           <div>
             <p className="text-3xl font-bold font-mono">82%</p>
             <p className="text-xs text-text-muted uppercase tracking-widest font-bold">Conversion Rate</p>
           </div>
        </div>
        <div className="bg-background-card border border-border p-6 rounded-xl flex items-center space-x-4">
           <div className="w-12 h-12 rounded-xl bg-accent-glow text-accent-primary flex items-center justify-center">
             <Filter size={24} />
           </div>
           <div>
             <p className="text-3xl font-bold font-mono">1,248</p>
             <p className="text-xs text-text-muted uppercase tracking-widest font-bold">Total Leads Sampled</p>
           </div>
        </div>
        <div className="bg-background-card border border-border p-6 rounded-xl flex items-center space-x-4">
           <div className="w-12 h-12 rounded-xl bg-status-info-bg text-status-info flex items-center justify-center">
             <Calendar size={24} />
           </div>
           <div>
             <p className="text-3xl font-bold font-mono">4.5m</p>
             <p className="text-xs text-text-muted uppercase tracking-widest font-bold">Avg. Conversation</p>
           </div>
        </div>
      </div>

      <div className="bg-background-card border border-border rounded-xl p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-semibold">Performance Comparison</h3>
            <p className="text-sm text-text-secondary mt-1">Comparing call outcomes across the last two weeks.</p>
          </div>
          <div className="flex items-center bg-background-secondary border border-border p-1 rounded-lg">
             <button className="px-3 py-1.5 text-xs font-bold rounded-md bg-background-primary border border-border text-text-primary shadow-sm">Daily</button>
             <button className="px-3 py-1.5 text-xs font-bold rounded-md text-text-muted hover:text-text-primary transition-colors">Weekly</button>
          </div>
        </div>
        <div className="h-[350px]">
          <CallVolumeChart />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Generated Reports</h3>
        <DataTable columns={reportColumns} data={dummyReports} loading={loading} />
      </div>
    </div>
  );
}

function PlusIcon(props) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>; }
