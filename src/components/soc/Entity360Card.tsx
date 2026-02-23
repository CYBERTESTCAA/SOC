import { Entity360 } from '@/types/soc';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { User, Laptop, Globe, Mail, AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import { RiskScoreGauge } from './RiskScoreGauge';

interface Entity360CardProps {
  entity: Entity360;
  compact?: boolean;
  onClick?: () => void;
}

const entityConfig: Record<string, { icon: any; color: string; label: string }> = {
  user: { icon: User, color: 'text-info', label: 'Utilisateur' },
  device: { icon: Laptop, color: 'text-low', label: 'Appareil' },
  ip: { icon: Globe, color: 'text-high', label: 'Adresse IP' },
  mailbox: { icon: Mail, color: 'text-medium', label: 'Boîte mail' },
};

export function Entity360Card({ entity, compact, onClick }: Entity360CardProps) {
  const config = entityConfig[entity.type];
  const Icon = config.icon;

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50',
          'hover:bg-muted/50 transition-colors',
          onClick && 'cursor-pointer'
        )}
      >
        <div className={cn('p-2 rounded-lg bg-muted/50', config.color)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{entity.name}</p>
          <p className="text-xs text-muted-foreground">{config.label}</p>
        </div>
        <RiskScoreGauge score={entity.riskScore} size="sm" />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'card-soc p-4 space-y-4',
        'hover:border-primary/30 transition-colors',
        onClick && 'cursor-pointer'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg bg-muted/50', config.color)}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">{config.label}</span>
            <p className="font-medium truncate max-w-48">{entity.name}</p>
          </div>
        </div>
        <RiskScoreGauge score={entity.riskScore} size="md" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded bg-muted/30">
          <p className="text-lg font-semibold">{entity.relatedIncidents}</p>
          <p className="text-xs text-muted-foreground">Incidents</p>
        </div>
        <div className="p-2 rounded bg-muted/30">
          <p className="text-lg font-semibold">{entity.relatedAlerts}</p>
          <p className="text-xs text-muted-foreground">Alertes</p>
        </div>
        <div className="p-2 rounded bg-muted/30">
          <p className="text-xs font-medium">
            {formatDistanceToNow(entity.lastActivity, { locale: fr })}
          </p>
          <p className="text-xs text-muted-foreground">Dernière activité</p>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1">
        {Object.entries(entity.details).slice(0, 4).map(([key, value]) => (
          <div key={key} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{key}</span>
            <span className="font-medium">{String(value)}</span>
          </div>
        ))}
      </div>

      {/* Action */}
      {onClick && (
        <button className="w-full flex items-center justify-center gap-2 text-sm text-primary hover:underline">
          Voir détails
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}