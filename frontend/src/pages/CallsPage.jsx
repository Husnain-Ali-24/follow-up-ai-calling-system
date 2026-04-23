import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import callService from '../services/callService';
import { Search, MessageSquare, Download } from 'lucide-react';
import { cn } from '../lib/utils';

import { useNotifications } from '../hooks/useNotifications';

export default function CallsPage() {
  const [calls, setCalls] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const navigate = useNavigate();

  const fetchCalls = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await callService.getCalls({
        search,
        page: pagination.pageIndex + 1,
        per_page: pagination.pageSize,
      });
      setCalls(result.data);
      setTotal(result.total);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useNotifications((message) => {
    if (message.type === 'status_update') {
      fetchCalls(true);
    }
  });

  useEffect(() => {
    fetchCalls();
  }, [search, pagination.pageIndex, pagination.pageSize]);

  useEffect(() => {
    setPagination((current) => (
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }
    ));
  }, [search]);

  const handleExportCsv = () => {
    if (!calls.length) {
      toast.error('No call rows available to export.');
      return;
    }

    const headers = [
      'call_id',
      'client_name',
      'client_phone',
      'status',
      'sentiment',
      'duration_seconds',
      'started_at',
      'ended_at',
      'attempt_number',
      'vapi_call_id',
    ];

    const escapeCell = (value) => {
      const str = String(value ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = calls.map((call) => headers.map((header) => escapeCell(call[header])).join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'call-logs.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
    toast.success('Call logs exported as CSV.');
  };

  const columns = [
    {
      header: 'Client',
      accessorKey: 'client_name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-text-primary">{row.original.client_name}</div>
          <div className="text-xs text-text-muted font-mono">{row.original.client_phone}</div>
        </div>
      ),
    },
    {
      header: 'Outcome',
      accessorKey: 'status',
      cell: ({ getValue }) => {
        const status = getValue();
        return (
          <span className={cn(
            "text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider",
            status === 'completed' ? 'bg-status-success-bg text-status-success' :
            status === 'rescheduled' ? 'bg-status-warning-bg text-status-warning' :
            'bg-status-error-bg text-status-error'
          )}>
            {status.replace('_', ' ')}
          </span>
        );
      },
    },
    {
      header: 'Sentiment',
      accessorKey: 'sentiment',
      cell: ({ getValue }) => {
        const sentiment = getValue();
        if (!sentiment) return <span className="text-text-muted">—</span>;
        return (
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider border",
            sentiment === 'positive' ? 'border-status-success/20 text-status-success' :
            sentiment === 'negative' ? 'border-status-error/20 text-status-error' :
            'border-status-warning/20 text-status-warning'
          )}>
            {sentiment}
          </span>
        );
      },
    },
    {
      header: 'Duration',
      accessorKey: 'duration_seconds',
      cell: ({ getValue }) => (
        <span className="text-xs font-mono">{getValue()}s</span>
      ),
    },
    {
      header: 'Time',
      accessorKey: 'started_at',
      cell: ({ getValue }) => (
        <span className="text-xs text-text-muted">
          {new Date(getValue()).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
        </span>
      ),
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center space-x-1">
          <button 
            onClick={() => navigate(`/calls/${row.original.call_id}`)}
            className="p-2 hover:bg-background-active rounded-md transition-colors text-text-muted hover:text-text-primary"
            title="View Details"
          >
            <MessageSquare size={16} />
          </button>
        </div>
      ),
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Call Logs" 
        subtitle="Review individual AI call transcripts, summaries, and sentiment analysis."
        actions={
          <button onClick={handleExportCsv} className="btn-secondary flex items-center space-x-2 text-sm">
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        }
      />

      <div className="flex items-center space-x-4 mb-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input 
            type="text" 
            placeholder="Search calls (name or phone)..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-background-card border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-accent-primary transition-all"
          />
        </div>
      </div>

      <DataTable 
        columns={columns} 
        data={calls} 
        loading={loading} 
        manualPagination
        pagination={{
          pageIndex: pagination.pageIndex,
          pageSize: pagination.pageSize,
          pageCount: Math.ceil(total / pagination.pageSize),
        }}
        onPaginationChange={(updater) => {
          setPagination((current) => {
            const next = typeof updater === 'function' ? updater(current) : updater;
            return next;
          });
        }}
      />
    </div>
  );
}
