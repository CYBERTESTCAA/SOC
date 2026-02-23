import { Incident } from '@/types/soc';
import { SeverityBadge } from './SeverityBadge';
import { SourceBadge } from './SourceBadge';
import { getStatusLabel } from '@/data/mockData';
import { Clock, User, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface IncidentCardProps {
  incident: Incident;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function IncidentCard({ incident, onClick, className, style }: IncidentCardProps) {
  const statusColors: Record<string, string> = {
    new: 'bg-primary/20 text-primary',
    inProgress: 'bg-high/20 text-high',
    resolved: 'bg-low/20 text-low',
    closed: 'bg-muted text-muted-foreground',
  };

  return (
    <div
      onClick={onClick}
      style={style}
      className={cn(
        'card-soc p-4 cursor-pointer transition-all duration-200',
        'hover:bg-muted/50 hover:border-primary/30',
        'group animate-fade-in',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs text-muted-foreground">
              {incident.id}
            </span>
            <SeverityBadge severity={incident.severity} />
            <SourceBadge source={incident.source} />
          </div>
          
          <h3 className="font-semibold text-foreground mb-1 line-clamp-1 group-hover:text-primary transition-colors">
            {incident.title}
          </h3>
          
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {incident.description}
          </p>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span
              className={cn(
                'px-2 py-0.5 rounded-full',
                statusColors[incident.status]
              )}
            >
              {getStatusLabel(incident.status)}
            </span>
            
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(incident.createdAt, { addSuffix: true, locale: fr })}
            </span>
            
            {incident.assignedTo && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {incident.assignedTo.split('@')[0]}
              </span>
            )}
          </div>
        </div>
        
        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
      </div>
    </div>
  );
}
