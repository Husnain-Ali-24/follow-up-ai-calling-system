import { useState, useEffect, useMemo } from 'react';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import clientService from '../services/clientService';
import { 
  Plus, 
  Search, 
  User, 
  Phone, 
  Calendar as CalendarIcon, 
  Upload, 
  PhoneForwarded, 
  Trash2, 
  Tag as TagIcon,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/utils';
import ClientFormModal from '../components/clients/ClientFormModal';
import ClientImportModal from '../components/clients/ClientImportModal';
import ClientDrawer from '../components/clients/ClientDrawer';
import { useNotifications } from '../hooks/useNotifications';
import { toast } from 'sonner';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rowSelection, setRowSelection] = useState({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  // Drawer state — which client's detail panel is open
  const [drawerClient, setDrawerClient] = useState(null);

  const fetchClients = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await clientService.getClients({ search });
      setClients(result.data);
      // Keep open drawer in sync with fresh data
      setDrawerClient(prev =>
        prev ? (result.data.find(c => c.id === prev.id) ?? prev) : null
      );
    } catch (error) {
      toast.error('Failed to load clients');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useNotifications((message) => {
    if (message.type === 'status_update') {
      fetchClients(true); // Pass true for a silent update
    }
  });

  useEffect(() => {
    const timer = setTimeout(fetchClients, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const selectedRows = useMemo(() => {
    return Object.keys(rowSelection).map(id => clients.find(c => c.id === id)).filter(Boolean);
  }, [rowSelection, clients]);

  const columns = [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          className="rounded border-border bg-bg-input text-accent-primary focus:ring-accent-primary w-4 h-4 cursor-pointer"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="rounded border-border bg-bg-input text-accent-primary focus:ring-accent-primary w-4 h-4 cursor-pointer"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
    },
    {
      header: 'Client',
      accessorKey: 'full_name',
      cell: ({ row }) => (
        <div className="flex items-center space-x-3">
          <div style={{
            width: 34, height: 34, borderRadius: 'var(--radius-sm)', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 14, fontWeight: 700,
          }}>
            {row.original.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-text-primary">{row.original.full_name}</div>
            <div className="text-[11px] text-text-muted leading-none mt-0.5">{row.original.email || 'No email'}</div>
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
            "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
            status === 'completed' ? 'bg-status-success-bg text-status-success border border-status-success/20' :
            status === 'failed' ? 'bg-status-error-bg text-status-error border border-status-error/20' :
            status === 'pending' ? 'bg-status-info-bg text-status-info border border-status-info/20' :
            'bg-status-warning-bg text-status-warning border border-status-warning/20'
          )}>
            {status.replace('_', ' ')}
          </span>
        );
      },
    },
    {
      header: 'Created At',
      accessorKey: 'created_at',
      cell: ({ getValue }) => (
        <div className="flex items-center space-x-2 text-[11px] text-text-secondary">
          <CalendarIcon size={12} className="text-text-muted" />
          <span>{new Date(getValue()).toLocaleDateString()}</span>
        </div>
      ),
    },
    {
      header: '',
      id: 'open',
      cell: () => (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
        </div>
      ),
    },
  ];

  const handleBulkCall = () => {
    toast.success(`Initiating calls for ${selectedRows.length} clients...`);
    // Placeholder for actual call functionality
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedRows.length} clients?`)) {
      try {
        await Promise.all(selectedRows.map(c => clientService.deleteClient(c.id)));
        toast.success('Clients deleted successfully');
        setRowSelection({});
        fetchClients();
      } catch (error) {
        toast.error('Failed to delete some clients');
      }
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Clients" 
        subtitle="Manage your contacts and track their outbound call status."
        actions={
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setIsImportOpen(true)}
              className="btn-secondary flex items-center space-x-2"
            >
              <Upload size={18} />
              <span>Import CSV</span>
            </button>
            <button 
              onClick={() => {
                setSelectedClient(null);
                setIsFormOpen(true);
              }}
              className="btn-primary flex items-center space-x-2 shadow-accent"
            >
              <Plus size={18} />
              <span>Add Client</span>
            </button>
          </div>
        }
      />

      <div className="flex items-center justify-between mb-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input 
            type="text" 
            placeholder="Search name, phone, or email..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 bg-bg-card border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-accent-primary transition-all shadow-sm"
          />
        </div>

        {selectedRows.length > 0 && (
          <div className="flex items-center space-x-2 bg-bg-secondary p-1 rounded-lg border border-border animate-in slide-in-from-right-4 duration-300">
            <div className="px-3 text-xs font-semibold text-accent-primary uppercase tracking-wider">
              {selectedRows.length} Selected
            </div>
            <div className="w-px h-4 bg-border mx-1" />
            <button 
              onClick={handleBulkCall}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-status-success hover:bg-status-success-bg rounded-md transition-colors"
            >
              <PhoneForwarded size={14} />
              <span>Trigger Call</span>
            </button>
            <button 
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-elevated rounded-md transition-colors"
            >
              <TagIcon size={14} />
              <span>Add Tag</span>
            </button>
            <button 
              onClick={handleBulkDelete}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-status-error hover:bg-status-error-bg rounded-md transition-colors"
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>

      <DataTable 
        columns={columns} 
        data={clients} 
        loading={loading}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        getRowId={(row) => row.id}
        onRowClick={(row) => setDrawerClient(row.original)}
      />

      <ClientFormModal 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        onSuccess={fetchClients}
        client={selectedClient}
      />

      <ClientImportModal 
        open={isImportOpen} 
        onOpenChange={setIsImportOpen} 
        onSuccess={fetchClients}
      />

      {/* Slide-in detail drawer */}
      {drawerClient && (
        <ClientDrawer
          client={drawerClient}
          onClose={() => setDrawerClient(null)}
          onEdit={(c) => {
            setSelectedClient(c);
            setIsFormOpen(true);
          }}
          onDelete={() => {
            setDrawerClient(null);
            fetchClients();
          }}
          onRefresh={fetchClients}
        />
      )}
    </div>
  );
}

