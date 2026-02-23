import { cn } from '@/lib/utils';
import { Severity } from '@/types/soc';

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

const severityConfig: Record<string, { label: string; className: string }> = {
  critical: {
    label: 'Critique',
    className: 'bg-critical/20 text-critical border-critical/30',
  },
  high: {
    label: 'Élevée',
    className: 'bg-high/20 text-high border-high/30',
  },
  medium: {
    label: 'Moyenne',
    className: 'bg-medium/20 text-medium border-medium/30',
  },
  low: {
    label: 'Faible',
    className: 'bg-low/20 text-low border-low/30',
  },
  info: {
    label: 'Info',
    className: 'bg-info/20 text-info border-info/30',
  },
  informational: {
    label: 'Info',
    className: 'bg-info/20 text-info border-info/30',
  },
  unknown: {
    label: 'Inconnu',
    className: 'bg-muted/20 text-muted-foreground border-muted/30',
  },
};

const defaultConfig = {
  label: 'Inconnu',
  className: 'bg-muted/20 text-muted-foreground border-muted/30',
};

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = severityConfig[severity?.toLowerCase()] || defaultConfig;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      <span className={`status-indicator ${severity || 'unknown'}`} />
      {config.label}
    </span>
  );
}
