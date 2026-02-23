import { cn } from '@/lib/utils';

interface RiskScoreGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function RiskScoreGauge({ score, size = 'md', showLabel = true }: RiskScoreGaugeProps) {
  const getColor = (score: number) => {
    if (score >= 80) return { text: 'text-critical', bg: 'bg-critical', glow: 'shadow-critical/50' };
    if (score >= 60) return { text: 'text-high', bg: 'bg-high', glow: 'shadow-high/50' };
    if (score >= 40) return { text: 'text-medium', bg: 'bg-medium', glow: 'shadow-medium/50' };
    if (score >= 20) return { text: 'text-low', bg: 'bg-low', glow: 'shadow-low/50' };
    return { text: 'text-info', bg: 'bg-info', glow: 'shadow-info/50' };
  };

  const getLabel = (score: number) => {
    if (score >= 80) return 'Critique';
    if (score >= 60) return 'Élevé';
    if (score >= 40) return 'Moyen';
    if (score >= 20) return 'Faible';
    return 'Minimal';
  };

  const colors = getColor(score);
  const label = getLabel(score);

  const sizeConfig = {
    sm: {
      container: 'w-10 h-10',
      text: 'text-xs font-bold',
      ring: 'w-10 h-10',
      strokeWidth: 3,
    },
    md: {
      container: 'w-14 h-14',
      text: 'text-sm font-bold',
      ring: 'w-14 h-14',
      strokeWidth: 4,
    },
    lg: {
      container: 'w-20 h-20',
      text: 'text-xl font-bold',
      ring: 'w-20 h-20',
      strokeWidth: 5,
    },
  };

  const config = sizeConfig[size];
  const radius = size === 'lg' ? 35 : size === 'md' ? 25 : 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn('relative flex items-center justify-center', config.container)}>
        {/* Background circle */}
        <svg className={cn('absolute transform -rotate-90', config.ring)} viewBox={`0 0 ${(radius + 5) * 2} ${(radius + 5) * 2}`}>
          <circle
            cx={radius + 5}
            cy={radius + 5}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            className="text-muted/30"
          />
          <circle
            cx={radius + 5}
            cy={radius + 5}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn(colors.text, 'transition-all duration-500')}
          />
        </svg>
        
        {/* Score text */}
        <span className={cn(config.text, colors.text)}>{score}</span>
      </div>
      
      {showLabel && size !== 'sm' && (
        <span className={cn('text-xs', colors.text)}>{label}</span>
      )}
    </div>
  );
}