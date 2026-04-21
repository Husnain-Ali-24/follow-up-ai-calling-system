import { cn } from '../../lib/utils';

export default function TranscriptViewer({ transcript }) {
  if (!transcript) return (
    <div className="flex-1 flex items-center justify-center text-text-muted italic">
      No transcript available
    </div>
  );

  const lines = transcript.split('\n').filter(line => line.trim());

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
      {lines.map((line, i) => {
        const isAI = line.startsWith('AI:');
        const content = line.replace(/^(AI|James|Sarah|Carlos|User):/, '').trim();
        const speaker = line.split(':')[0];

        return (
          <div key={i} className={cn(
            "flex flex-col",
            isAI ? "items-start" : "items-end"
          )}>
            <div className={cn(
              "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
              isAI 
                ? "bg-background-secondary border border-border text-text-primary rounded-tl-none" 
                : "bg-accent-primary text-text-inverse rounded-tr-none shadow-accent"
            )}>
              <div className={cn(
                "text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70",
                !isAI && "text-right"
              )}>
                {speaker}
              </div>
              {content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
