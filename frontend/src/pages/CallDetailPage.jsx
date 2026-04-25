import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import PageHeader from '../components/shared/PageHeader';
import callService from '../services/callService';
import TranscriptViewer from '../components/calls/TranscriptViewer';
import CallTimeline from '../components/calls/CallTimeline';
import { ArrowLeft, Download, Share2 } from 'lucide-react';
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

  const handleDownloadTranscript = () => {
    if (!call?.transcript) {
      toast.error('No transcript is available for this call.');
      return;
    }

    const transcriptBlob = new Blob([call.transcript], { type: 'text/plain;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(transcriptBlob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `transcript-${call.call_id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
    toast.success('Transcript downloaded.');
  };

  const copyTextFallback = (value) => {
    const textArea = document.createElement('textarea');
    textArea.value = value;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    let copied = false;

    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }

    document.body.removeChild(textArea);
    return copied;
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Call URL copied to clipboard.');
        return;
      }
    } catch {
      // Fall back to execCommand below for local/dev browsers.
    }

    if (copyTextFallback(shareUrl)) {
      toast.success('Call URL copied to clipboard.');
      return;
    }

    try {
      window.prompt('Copy this call URL:', shareUrl);
      toast.success('Copy the URL from the dialog.');
    } catch {
      toast.error('URL copy failed on this browser.');
    }
  };

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
            <button onClick={handleDownloadTranscript} className="btn-secondary flex items-center space-x-2 text-sm">
              <Download size={16} />
              <span>Transcript</span>
            </button>
            <button onClick={handleShare} className="btn-secondary flex items-center space-x-2 text-sm text-accent-primary">
              <Share2 size={16} />
              <span>Copy Link</span>
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Transcript Section */}
          <div className="bg-background-card border border-border rounded-xl overflow-hidden flex flex-col h-[600px]">
            <div className="p-6 border-b border-border flex items-center justify-between bg-background-secondary/30">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Call Transcript</h3>
              <div className="text-xs text-text-muted">
                {call.transcript ? `${call.transcript.split('\n').filter(Boolean).length} lines` : 'No transcript'}
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
              {typeof call.summary === 'string' ? call.summary : "No summary available for this call."}
            </p>
            
            <div className="mt-6 pt-6 border-t border-border">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Detected Sentiment</h4>
              <div className={cn(
                "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                String(call.sentiment).toLowerCase() === 'positive' ? 'bg-status-success-bg text-status-success' :
                String(call.sentiment).toLowerCase() === 'negative' ? 'bg-status-error-bg text-status-error' :
                'bg-status-warning-bg text-status-warning'
              )}>
                {call.sentiment || 'Neutral'}
              </div>
            </div>
          </div>

          {/* Key Answers */}
          <div className="bg-background-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">Structured Data</h3>
            <div className="space-y-4">
              {(() => {
                try {
                  const data = typeof call.structured_answers === 'string' 
                    ? JSON.parse(call.structured_answers) 
                    : call.structured_answers;
                  
                  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
                    return <p className="text-sm text-text-muted italic">No structured data extracted.</p>;
                  }

                  return Object.entries(data).map(([key, value]) => {
                    const name = (typeof value === 'object' && value?.name) ? value.name : key.replace(/_/g, ' ');
                    const displayValue = (typeof value === 'object' && value?.result !== undefined) 
                      ? String(value.result) 
                      : typeof value === 'object' ? JSON.stringify(value) : String(value);

                    return (
                      <div key={key} className="p-3 bg-background-secondary rounded-lg border border-border/50">
                        <p className="text-[10px] uppercase text-text-muted font-bold tracking-tight mb-1">{name}</p>
                        <p className="text-sm text-text-primary whitespace-pre-wrap">{displayValue}</p>
                      </div>
                    );
                  });
                } catch (e) {
                  console.error("Failed to parse structured data:", e);
                  return <p className="text-sm text-text-muted italic">Data format error.</p>;
                }
              })()}
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
