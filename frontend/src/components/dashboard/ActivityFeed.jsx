import { DUMMY_RECENT_ACTIVITY } from '../../data/dummy/dashboard.dummy';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../../lib/utils';
import { STATUS_VARIANTS } from '../../lib/constants';

export default function ActivityFeed() {
  return (
    <div className="bg-background-card border border-border rounded-xl p-6 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-text-primary mb-6">Recent Activity</h3>
      
      <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {DUMMY_RECENT_ACTIVITY.map((activity) => (
          <div key={activity.call_id} className="relative pl-6 pb-6 border-l border-border last:pb-0">
            <div className={cn(
              "absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full",
              STATUS_VARIANTS[activity.status] === 'status-success' ? 'bg-status-success' : 
              STATUS_VARIANTS[activity.status] === 'status-error' ? 'bg-status-error' :
              STATUS_VARIANTS[activity.status] === 'status-warning' ? 'bg-status-warning' : 'bg-status-info'
            )}>
              <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-current"></div>
            </div>
            
            <div className="flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary">{activity.client_name}</span>
                <span className="text-xs text-text-muted">
                  {formatDistanceToNow(new Date(activity.ended_at))} ago
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                {activity.status.replace('_', ' ')} • {activity.duration_seconds}s
              </p>
              {activity.sentiment && (
                <div className="mt-2">
                   <span className={cn(
                     "text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider",
                     activity.sentiment === 'positive' ? 'bg-status-success-bg text-status-success' :
                     activity.sentiment === 'negative' ? 'bg-status-error-bg text-status-error' :
                     'bg-status-warning-bg text-status-warning'
                   )}>
                     {activity.sentiment}
                   </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <button className="w-full mt-6 text-sm text-accent-primary hover:text-accent-primary-hover font-medium transition-colors">
        View All Activity
      </button>
    </div>
  );
}
