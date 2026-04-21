import { Check, Phone, PhoneForwarded, MessageSquare, AlertCircle, PhoneIncoming } from 'lucide-react';
import { cn } from '../../lib/utils';

const iconMap = {
  dial: PhoneOutgoing,
  pickup: PhoneIncoming,
  ai_turn: MessageSquare,
  user_turn: MessageSquare,
  end: Check,
  failed: AlertCircle,
  reschedule: PhoneForwarded,
};

const colorMap = {
  dial: 'text-text-muted',
  pickup: 'text-status-info',
  ai_turn: 'text-accent-primary',
  user_turn: 'text-text-primary',
  end: 'text-status-success',
  failed: 'text-status-error',
  reschedule: 'text-status-warning',
};

function PhoneOutgoing(props) { return <Phone {...props} className={cn("rotate-[135deg]", props.className)} />; }

export default function CallTimeline({ events }) {
  if (!events || events.length === 0) return <div className="text-text-muted italic text-sm">No events logged</div>;

  return (
    <div className="space-y-6">
      {events.map((event, i) => {
        const Icon = iconMap[event.type] || Activity;
        return (
          <div key={event.id || i} className="flex space-x-4 relative">
            {i !== events.length - 1 && (
              <div className="absolute left-[11px] top-6 bottom-[-30px] w-px bg-border"></div>
            )}
            
            <div className={cn(
              "w-6 h-6 rounded-full border-2 border-background flex items-center justify-center z-10",
              event.type === 'end' ? 'bg-status-success' : 'bg-background-secondary',
              colorMap[event.type]
            )}>
              <Icon size={12} fill={event.type === 'end' ? 'white' : 'transparent'} />
            </div>

            <div className="flex-1 pb-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-text-primary">{event.type.replace('_', ' ')}</p>
                <span className="text-[10px] font-mono text-text-muted">
                  {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">{event.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
