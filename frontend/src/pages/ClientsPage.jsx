import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import clientService from '../services/clientService';
import { Plus, Search, MoreHorizontal, User, Phone, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { STATUS_VARIANTS } from '../lib/constants';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      try {
        const result = await clientService.getClients({ search });
        setClients(result.data);
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, [search]);

  const columns = [
    {
      header: 'Client',
      accessorKey: 'full_name',
      cell: ({ row }) => (
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-background-secondary flex items-center justify-center text-accent-primary">
            <User size={14} />
          </div>
          <div>
            <div className="font-medium text-text-primary">{row.original.full_name}</div>
            <div className="text-xs text-text-muted">{row.original.email || 'No email'}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Phone',
      accessorKey: 'phone_number',
      cell: ({ getValue }) => (
        <div className="flex items-center space-x-2 text-xs font-mono">
          <Phone size={12} className="text-text-muted" />
          <span>{getValue()}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => {
        const status = getValue();
        return (
          <span className={cn(
            "text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider",
            status === 'completed' ? 'bg-status-success-bg text-status-success' :
            status === 'failed' ? 'bg-status-error-bg text-status-error' :
            status === 'pending' ? 'bg-status-info-bg text-status-info' :
            'bg-status-warning-bg text-status-warning'
          )}>
            {status.replace('_', ' ')}
          </span>
        );
      },
    },
    {
      header: 'Scheduled Call',
      accessorKey: 'scheduled_call_time',
      cell: ({ getValue }) => (
        <div className="flex items-center space-x-2 text-xs">
          <CalendarIcon size={12} className="text-text-muted" />
          <span>{new Date(getValue()).toLocaleDateString()}</span>
        </div>
      ),
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <button 
          onClick={() => navigate(`/clients/${row.original.client_id}`)}
          className="p-2 hover:bg-background-active rounded-md transition-colors text-text-muted hover:text-text-primary"
        >
          <MoreHorizontal size={18} />
        </button>
      ),
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Clients" 
        subtitle="Manage your contacts and track their outbound call status."
        actions={
          <button className="btn-primary flex items-center space-x-2">
            <Plus size={18} />
            <span>Add Client</span>
          </button>
        }
      />

      <div className="flex items-center space-x-4 mb-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input 
            type="text" 
            placeholder="Search clients..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-background-card border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-accent-primary transition-all"
          />
        </div>
      </div>

      <DataTable 
        columns={columns} 
        data={clients} 
        loading={loading} 
      />
    </div>
  );
}
