import { TimelineEvent } from '@/types/soc';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, MessageSquare, Play, Bell, Zap, User } from 'lucide-react';

interface IncidentTimelineProps {
  events: TimelineEvent[];
}

const eventConfig: Record<string, { icon: any; color: string; bgColor: string }> = {
  detection: { icon: Zap, color: 'text-critical', bgColor: 'bg-critical/20' },
  alert: { icon: Bell, color: 'text-high', bgColor: 'bg-high/20' },
  status: { icon: Play, color: 'text-primary', bgColor: 'bg-primary/20' },
  action: { icon: AlertTriangle, color: 'text-medium', bgColor: 'bg-medium/20' },
  comment: { icon: MessageSquare, color: 'text-info', bgColor: 'bg-info/20' },
};

export function IncidentTimeline({ events }: IncidentTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Aucun événement dans la timeline</p>
      </div>
    );
  }

  const sortedEvents = [...events].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <div className="space-y-0">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Zap className="w-4 h-4 text-primary" />
        Timeline des événements
      </h3>
      
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

        <div className="space-y-4">
          {sortedEvents.map((event, index) => {
            const config = eventConfig[event.type] || eventConfig.action;
            const Icon = config.icon;

            return (
              <div key={event.id} className="relative flex gap-4 pl-0">
                {/* Icon */}
                <div className={cn(
                  'relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                  config.bgColor
                )}>
                  <Icon className={cn('w-4 h-4', config.color)} />
                </div>

                {/* Content */}
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{event.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(event.timestamp, 'dd/MM HH:mm:ss', { locale: fr })}
                    </span>
                  </div>
                  
                  {event.description && (
                    <p className="text-sm text-muted-foreground">{event.description}</p>
                  )}
                  
                  {event.actor && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      {event.actor.split('@')[0]}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}