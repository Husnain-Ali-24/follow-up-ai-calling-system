import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../components/shared/PageHeader';
import clientService from '../services/clientService';
import { ArrowLeft, Edit, Trash2, Calendar, Mail, Phone, MapPin, Clock, List } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import ClientFormModal from '../components/clients/ClientFormModal';

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const fetchClient = async () => {
    try {
      const data = await clientService.getClientById(id);
      setClient(data);
    } catch (error) {
      toast.error('Failed to load client details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClient();
  }, [id]);

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      try {
        await clientService.deleteClient(id);
        toast.success('Client deleted');
        navigate('/clients');
      } catch (error) {
        toast.error('Failed to delete client');
      }
    }
  };

  if (loading) return <div className="animate-pulse space-y-8">
    <div className="h-10 bg-background-secondary rounded-lg w-1/3"></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="col-span-2 h-64 bg-background-secondary rounded-xl"></div>
      <div className="h-64 bg-background-secondary rounded-xl"></div>
    </div>
  </div>;

  if (!client) return (
    <div className="text-center py-20 bg-bg-card border border-border rounded-xl">
      <h2 className="text-2xl font-bold text-text-primary">Client not found</h2>
      <button onClick={() => navigate('/clients')} className="mt-4 btn-secondary">
        Back to Clients
      </button>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center text-text-muted hover:text-text-primary mb-2 transition-colors group"
      >
        <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" />
        Back
      </button>

      <PageHeader 
        title={client.full_name}
        subtitle="Manage client details and view their conversion journey."
        actions={
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setIsEditOpen(true)}
              className="btn-secondary flex items-center space-x-2 text-sm"
            >
              <Edit size={16} />
              <span>Edit</span>
            </button>
            <button 
              onClick={handleDelete}
              className="btn-secondary border-status-error/30 text-status-error hover:bg-status-error-bg flex items-center space-x-2 text-sm"
            >
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <div className="bg-bg-card border border-border rounded-xl p-8 shadow-sm">
            <h3 className="text-lg font-semibold mb-6 flex items-center">
              <span className="w-1.5 h-6 bg-accent-primary rounded-full mr-3" />
              Call Context
            </h3>
            <div className="bg-bg-secondary rounded-lg p-6 border border-border/50 italic text-text-secondary leading-relaxed">
              "{client.follow_up_context}"
            </div>
            
            {client.notes && (
              <div className="mt-8">
                <h4 className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Admin Notes</h4>
                <p className="text-text-secondary whitespace-pre-wrap">{client.notes}</p>
              </div>
            )}
          </div>

          {client.custom_fields && Object.keys(client.custom_fields).length > 0 && (
            <div className="bg-bg-card border border-border rounded-xl p-8 shadow-sm">
              <h3 className="text-lg font-semibold mb-6 flex items-center">
                <span className="w-1.5 h-6 bg-accent-secondary rounded-full mr-3" />
                Custom Data
              </h3>
              <div className="grid grid-cols-2 gap-6">
                {Object.entries(client.custom_fields).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{key.replace(/_/g, ' ')}</p>
                    <p className="text-sm text-text-primary font-medium">{value || '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-bg-card border border-border rounded-xl p-8 shadow-sm">
            <h3 className="text-lg font-semibold mb-6 flex items-center">
              <span className="w-1.5 h-6 bg-status-info rounded-full mr-3" />
              Upcoming Scheduled Call
            </h3>
            <div className="flex items-start space-x-4">
              <div className="bg-accent-glow p-3 rounded-xl text-accent-primary">
                <Calendar size={24} />
              </div>
              <div>
                <p className="text-lg font-bold text-text-primary">
                  {client.scheduled_call_time ? new Date(client.scheduled_call_time).toLocaleString(undefined, { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'No call scheduled'}
                </p>
                <div className="flex items-center text-text-muted mt-1 text-sm">
                  <MapPin size={14} className="mr-1" />
                  {client.timezone}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-bg-card border border-border rounded-xl p-8 shadow-sm">
            <h3 className="text-lg font-semibold mb-6">Contact Info</h3>
            <div className="space-y-6">
              <div className="flex items-center space-x-3 group">
                <div className="w-10 h-10 rounded-lg bg-bg-secondary flex items-center justify-center text-text-muted group-hover:bg-accent-glow group-hover:text-accent-primary transition-colors border border-border">
                  <Phone size={18} />
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">Phone</p>
                  <p className="text-text-primary font-mono text-sm">{client.phone_number}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 group">
                <div className="w-10 h-10 rounded-lg bg-bg-secondary flex items-center justify-center text-text-muted group-hover:bg-accent-glow group-hover:text-accent-primary transition-colors border border-border">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">Email</p>
                  <p className="text-text-primary text-sm">{client.email || '—'}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 group">
                <div className="w-10 h-10 rounded-lg bg-bg-secondary flex items-center justify-center text-text-muted group-hover:bg-accent-glow group-hover:text-accent-primary transition-colors border border-border">
                  <Clock size={18} />
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">Imported</p>
                  <p className="text-text-primary text-sm">{new Date(client.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-bg-card border border-border rounded-xl p-6 shadow-sm overflow-hidden relative">
             <div className={cn(
               "absolute top-0 right-0 w-1 h-full",
               client.status === 'completed' ? 'bg-status-success' : 'bg-accent-primary'
             )} />
             <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Current Status</h4>
             <div className={cn(
               "inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
               client.status === 'completed' ? 'bg-status-success-bg text-status-success border border-status-success/20' : 
               'bg-accent-subtle text-accent-primary border border-accent-primary/20'
             )}>
               {client.status.replace(/_/g, ' ')}
             </div>
          </div>
        </div>
      </div>

      <ClientFormModal 
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSuccess={fetchClient}
        client={client}
      />
    </div>
  );
}
