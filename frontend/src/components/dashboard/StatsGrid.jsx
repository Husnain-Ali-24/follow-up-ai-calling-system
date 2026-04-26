import { Phone, CheckCircle2, XCircle, Clock, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function StatsGrid({ stats, loading }) {
  const cards = [
    { 
      label: 'Total Calls', 
      value: stats?.calls_today || 0, 
      icon: Phone, 
      color: 'text-accent-primary',
      bg: 'bg-accent-glow'
    },
    { 
      label: 'Completed', 
      value: stats?.calls_successful || 0, 
      icon: CheckCircle2, 
      color: 'text-status-success',
      bg: 'bg-status-success-bg'
    },
    { 
      label: 'Failed', 
      value: stats?.calls_failed || 0, 
      icon: XCircle, 
      color: 'text-status-error',
      bg: 'bg-status-error-bg'
    },
    { 
      label: 'Rescheduled', 
      value: stats?.calls_rescheduled || 0, 
      icon: RotateCcw, 
      color: 'text-status-warning',
      bg: 'bg-status-warning-bg'
    },
    { 
      label: 'Avg Duration', 
      value: `${stats?.avg_duration_seconds || 0}s`, 
      icon: Clock, 
      color: 'text-status-info',
      bg: 'bg-status-info-bg'
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card, i) => (
        <div 
          key={card.label}
          className="bg-background-card border border-border p-5 rounded-xl flex flex-col justify-between hover:border-border-strong transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div className={cn("p-2 rounded-lg", card.bg, card.color)}>
              <card.icon size={20} />
            </div>
            {loading && <div className="h-4 w-12 bg-background-secondary animate-pulse rounded"></div>}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-text-muted font-medium">{card.label}</p>
            <p className="text-2xl font-bold text-text-primary mt-1 font-mono">
              {loading ? '---' : card.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
