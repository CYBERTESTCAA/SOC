import { cn } from '@/lib/utils';
import { IncidentSource } from '@/types/soc';
import { Shield, Users, Laptop, Mail } from 'lucide-react';

interface SourceBadgeProps {
  source: IncidentSource;
  className?: string;
}

const sourceConfig: Record<IncidentSource, { label: string; icon: React.ElementType; className: string }> = {
  defender: {
    label: 'Defender',
    icon: Shield,
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  entra: {
    label: 'Entra ID',
    icon: Users,
    className: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  intune: {
    label: 'Intune',
    icon: Laptop,
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  exchange: {
    label: 'Exchange',
    icon: Mail,
    className: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  },
};

export function SourceBadge({ source, className }: SourceBadgeProps) {
  const config = sourceConfig[source];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border',
        config.className,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
