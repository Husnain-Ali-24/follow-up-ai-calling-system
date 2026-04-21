import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../components/shared/PageHeader';
import callService from '../services/callService';
import TranscriptViewer from '../components/calls/TranscriptViewer';
import AudioPlayer from '../components/calls/AudioPlayer';
import CallTimeline from '../components/calls/CallTimeline';
import { ArrowLeft, Clock, Calendar, Phone, Activity, Download, Share2 } from 'lucide-react';
import { cn } from '../lib/utils';

export default function CallDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [call, setCall] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCallData = async () => {
      try {
        const [callData, eventData] = await Promise.all([
          callService.getCallById(id),
          callService.getCallEvents(id)
        ]);
        setCall(callData);
        setEvents(eventData);
      } finally {
        setLoading(false);
      }
    };
    fetchCallData();
  }, [id]);

  if (loading) return <div className="text-text-muted">Loading call details...</div>;
  if (!call) return <div className="text-center py-20">Call not found</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center text-text-muted hover:text-text-primary mb-2 transition-colors group"
      >
        <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" />
        Back
      </button>

      <PageHeader 
        title={`Call with ${call.client_name}`}
        subtitle={`ID: ${call.call_id} • ${new Date(call.started_at).toLocaleString()}`}
        actions={
          <>
            <button className="btn-secondary flex items-center space-x-2 text-sm">
              <Download size={16} />
              <span>Transcript</span>
            </button>
            <button className="btn-secondary flex items-center space-x-2 text-sm text-accent-primary">
              <Share2 size={16} />
              <span>Share</span>
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Audio Player Section */}
          <div className="bg-background-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4 flex items-center">
              <Activity size={16} className="mr-2" />
              Recording
            </h3>
            <AudioPlayer url={call.recording_url} duration={call.duration_seconds} />
          </div>

          {/* Transcript Section */}
          <div className="bg-background-card border border-border rounded-xl overflow-hidden flex flex-col h-[600px]">
            <div className="p-6 border-b border-border flex items-center justify-between bg-background-secondary/30">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Call Transcript</h3>
              <div className="flex space-y-0 space-x-2">
                 <span className="text-xs bg-status-success-bg text-status-success px-2 py-0.5 rounded-full font-medium">98% Accuracy</span>
              </div>
            </div>
            <TranscriptViewer transcript={call.transcript} />
          </div>
        </div>

        <div className="space-y-8">
          {/* Summary & Sentiment */}
          <div className="bg-background-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">AI Summary</h3>
            <p className="text-text-primary leading-relaxed">
              {call.summary || "No summary available for this call."}
            </p>
            
            <div className="mt-6 pt-6 border-t border-border">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Detected Sentiment</h4>
              <div className={cn(
                "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                call.sentiment === 'positive' ? 'bg-status-success-bg text-status-success' :
                call.sentiment === 'negative' ? 'bg-status-error-bg text-status-error' :
                'bg-status-warning-bg text-status-warning'
              )}>
                {call.sentiment || 'neutral'}
              </div>
            </div>
          </div>

          {/* Key Answers */}
          <div className="bg-background-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">Structured Data</h3>
            <div className="space-y-4">
              {call.structured_answers && Object.entries(call.structured_answers).map(([key, value]) => (
                <div key={key} className="p-3 bg-background-secondary rounded-lg border border-border/50">
                  <p className="text-[10px] uppercase text-text-muted font-bold tracking-tight mb-1">{key.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-text-primary">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Call Timeline */}
          <div className="bg-background-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-6">Technical Timeline</h3>
            <CallTimeline events={events} />
          </div>
        </div>
      </div>
    </div>
  );
}
