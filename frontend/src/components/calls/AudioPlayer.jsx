import { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';

export default function AudioPlayer({ url, duration }) {
  const [isPlaying, setIsPlaying] = useState(false);
  
  return (
    <div className="bg-background-secondary border border-border rounded-xl p-4">
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <button className="p-2 text-text-muted hover:text-text-primary transition-colors">
            <SkipBack size={20} />
          </button>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-12 h-12 bg-accent-primary text-text-inverse rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-accent"
          >
            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
          </button>
          <button className="p-2 text-text-muted hover:text-text-primary transition-colors">
            <SkipForward size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-text-muted mb-1">
            <span>0:00</span>
            <span>{Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}</span>
          </div>
          <div className="h-1.5 bg-background-hover rounded-full overflow-hidden relative group cursor-pointer">
            <div className="absolute top-0 left-0 h-full bg-accent-primary w-1/3 group-hover:bg-accent-primary-hover transition-colors"></div>
            <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-3 h-3 bg-text-primary rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-text-muted">
          <Volume2 size={18} />
          <div className="w-16 h-1 bg-background-hover rounded-full">
            <div className="h-full bg-text-muted w-2/3 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
