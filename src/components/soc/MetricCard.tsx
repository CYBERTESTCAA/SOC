import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  variant?: 'default' | 'critical' | 'warning' | 'success';
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className,
}: MetricCardProps) {
  const variantStyles = {
    default: 'before:bg-gradient-to-r before:from-transparent before:via-primary before:to-transparent',
    critical: 'before:bg-gradient-to-r before:from-transparent before:via-critical before:to-transparent glow-critical',
    warning: 'before:bg-gradient-to-r before:from-transparent before:via-high before:to-transparent',
    success: 'before:bg-gradient-to-r before:from-transparent before:via-low before:to-transparent glow-success',
  };

  const iconColors = {
    default: 'text-primary',
    critical: 'text-critical',
    warning: 'text-high',
    success: 'text-low',
  };

  return (
    <div
      className={cn(
        'metric-card group transition-all duration-300 hover:scale-[1.02]',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <p
              className={cn(
                'text-xs font-medium',
                trend.positive ? 'text-low' : 'text-critical'
              )}
            >
              {trend.value}
            </p>
          )}
        </div>
        <div
          className={cn(
            'p-2.5 rounded-lg bg-muted/50 transition-colors group-hover:bg-muted',
            iconColors[variant]
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
