import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../components/shared/PageHeader';
import clientService from '../services/clientService';
import { ArrowLeft, Edit, Trash2, Calendar, Mail, Phone, MapPin, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClient = async () => {
      try {
        const data = await clientService.getClientById(id);
        setClient(data);
      } finally {
        setLoading(false);
      }
    };
    fetchClient();
  }, [id]);

  if (loading) return <div className="animate-pulse space-y-8">
    <div className="h-10 bg-background-card rounded-lg w-1/3"></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="col-span-2 h-64 bg-background-card rounded-xl"></div>
      <div className="h-64 bg-background-card rounded-xl"></div>
    </div>
  </div>;

  if (!client) return (
    <div className="text-center py-20">
      <h2 className="text-2xl font-bold text-text-primary">Client not found</h2>
      <button onClick={() => navigate('/clients')} className="mt-4 text-accent-primary hover:underline">
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
          <>
            <button className="btn-secondary flex items-center space-x-2 text-sm">
              <Edit size={16} />
              <span>Edit</span>
            </button>
            <button className="btn-secondary border-status-error/30 text-status-error hover:bg-status-error-bg flex items-center space-x-2 text-sm">
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <div className="bg-background-card border border-border rounded-xl p-8">
            <h3 className="text-lg font-semibold mb-6">Call Context</h3>
            <div className="bg-background-secondary rounded-lg p-6 border border-border/50 italic text-text-secondary leading-relaxed">
              "{client.follow_up_context}"
            </div>
            
            {client.notes && (
              <div className="mt-8">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-3">Admin Notes</h4>
                <p className="text-text-secondary whitespace-pre-wrap">{client.notes}</p>
              </div>
            )}
          </div>

          <div className="bg-background-card border border-border rounded-xl p-8">
            <h3 className="text-lg font-semibold mb-6">Upcoming Scheduled Call</h3>
            <div className="flex items-start space-x-4">
              <div className="bg-accent-glow p-3 rounded-xl text-accent-primary">
                <Calendar size={24} />
              </div>
              <div>
                <p className="text-lg font-bold text-text-primary">
                  {new Date(client.scheduled_call_time).toLocaleString(undefined, { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
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
          <div className="bg-background-card border border-border rounded-xl p-8">
            <h3 className="text-lg font-semibold mb-6">Contact Information</h3>
            <div className="space-y-6">
              <div className="flex items-center space-x-3 group">
                <div className="w-10 h-10 rounded-lg bg-background-secondary flex items-center justify-center text-text-muted group-hover:bg-accent-glow group-hover:text-accent-primary transition-colors">
                  <Phone size={18} />
                </div>
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wider font-medium">Phone</p>
                  <p className="text-text-primary font-mono">{client.phone_number}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 group">
                <div className="w-10 h-10 rounded-lg bg-background-secondary flex items-center justify-center text-text-muted group-hover:bg-accent-glow group-hover:text-accent-primary transition-colors">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wider font-medium">Email</p>
                  <p className="text-text-primary">{client.email || '—'}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 group">
                <div className="w-10 h-10 rounded-lg bg-background-secondary flex items-center justify-center text-text-muted group-hover:bg-accent-glow group-hover:text-accent-primary transition-colors">
                  <Clock size={18} />
                </div>
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wider font-medium">Created</p>
                  <p className="text-text-primary">{new Date(client.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-accent-primary/10 border border-accent-primary/20 rounded-xl p-6">
             <h4 className="text-accent-primary font-bold mb-2">Lead Status</h4>
             <div className={cn(
               "inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest",
               client.status === 'completed' ? 'bg-status-success text-text-inverse' : 
               'bg-accent-primary text-text-inverse'
             )}>
               {client.status.replace('_', ' ')}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
