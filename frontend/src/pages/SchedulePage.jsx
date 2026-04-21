import PageHeader from '../components/shared/PageHeader';
import { Calendar as CalendarIcon, Clock, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { DUMMY_CLIENTS } from '../data/dummy/clients.dummy';
import { cn } from '../lib/utils';

export default function SchedulePage() {
  const upcomingCalls = DUMMY_CLIENTS.filter(c => c.status === 'pending' || c.status === 'rescheduled');

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader 
        title="Call Schedule" 
        subtitle="Manage upcoming AI follow-up calls and view daily availability."
        actions={
          <div className="flex bg-background-card border border-border rounded-lg overflow-hidden">
             <button className="px-4 py-2 text-sm font-medium border-r border-border bg-background-active text-text-primary">Day</button>
             <button className="px-4 py-2 text-sm font-medium border-r border-border hover:bg-background-hover text-text-secondary">Week</button>
             <button className="px-4 py-2 text-sm font-medium hover:bg-background-hover text-text-secondary">Month</button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-background-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center space-x-4">
                 <h2 className="text-xl font-bold">April 20, 2026</h2>
                 <div className="flex items-center space-x-1">
                   <button className="p-1 hover:bg-background-hover rounded-md border border-border"><ChevronLeft size={18} /></button>
                   <button className="p-1 hover:bg-background-hover rounded-md border border-border"><ChevronRight size={18} /></button>
                 </div>
               </div>
               <button className="btn-secondary text-sm">Today</button>
            </div>

            <div className="space-y-1 relative">
              {/* Hour Lines */}
              {[9, 10, 11, 12, 13, 14, 15, 16, 17].map(hour => (
                <div key={hour} className="flex group min-h-[80px]">
                  <div className="w-16 text-right pr-4 text-xs font-mono text-text-muted pt-1">
                    {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                  </div>
                  <div className="flex-1 border-t border-border group-last:border-b relative">
                    {/* Mock events placed absolutely */}
                    {hour === 10 && (
                      <div className="absolute top-2 left-4 right-4 bg-accent-glow border-l-4 border-accent-primary p-3 rounded-r-lg z-10">
                        <p className="text-xs font-bold text-accent-primary uppercase tracking-wider mb-1">AI Follow-up • High Priority</p>
                        <p className="text-sm font-semibold text-text-primary">Ahmed Khan</p>
                        <div className="flex items-center text-[11px] text-text-secondary mt-1">
                           <Clock size={12} className="mr-1" /> 10:00 AM - 10:15 AM
                        </div>
                      </div>
                    )}
                    {hour === 11 && (
                      <div className="absolute top-10 left-4 right-4 bg-background-active border-l-4 border-status-warning p-3 rounded-r-lg z-10 opacity-80">
                        <p className="text-xs font-bold text-status-warning uppercase tracking-wider mb-1">Rescheduled Call</p>
                        <p className="text-sm font-semibold text-text-primary">Sarah Johnson</p>
                        <div className="flex items-center text-[11px] text-text-secondary mt-1">
                           <Clock size={12} className="mr-1" /> 11:30 AM - 11:45 AM
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Current Time Line Mock */}
              <div className="absolute top-[200px] left-16 right-0 border-t-2 border-status-error z-20 flex items-center">
                 <div className="w-2 h-2 rounded-full bg-status-error -ml-1"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-background-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-6">Upcoming Today</h3>
            <div className="space-y-4">
              {upcomingCalls.slice(0, 4).map((call, i) => (
                <div key={i} className="p-4 bg-background-secondary rounded-lg border border-border/50 hover:border-accent-primary/30 transition-colors cursor-pointer group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-accent-primary font-bold">{new Date(call.scheduled_call_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    <span className={cn(
                      "w-2 h-2 rounded-full",
                      call.status === 'rescheduled' ? 'bg-status-warning' : 'bg-status-info'
                    )}></span>
                  </div>
                  <p className="font-semibold text-sm group-hover:text-accent-primary transition-colors">{call.full_name}</p>
                  <p className="text-[11px] text-text-muted mt-1 truncate">{call.follow_up_context}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-background-card border border-border rounded-xl p-6">
             <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">Availability</h3>
             <div className="space-y-4">
                <div className="flex items-center justify-between bg-background-secondary p-3 rounded-lg border border-border/50">
                   <div className="flex items-center space-x-2">
                     <Clock size={14} className="text-text-muted" />
                     <span className="text-xs">Next Available</span>
                   </div>
                   <span className="text-xs font-bold text-status-success">12:15 PM</span>
                </div>
                <div className="flex items-center justify-between bg-background-secondary p-3 rounded-lg border border-border/50">
                   <div className="flex items-center space-x-2">
                     <CalendarIcon size={14} className="text-text-muted" />
                     <span className="text-xs">Total for Apr 20</span>
                   </div>
                   <span className="text-xs font-bold text-text-primary">12 Calls</span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
