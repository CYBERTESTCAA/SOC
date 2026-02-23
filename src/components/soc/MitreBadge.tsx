import { MitreInfo } from '@/types/soc';
import { cn } from '@/lib/utils';
import { Target } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MitreBadgeProps {
  mitre: MitreInfo;
  className?: string;
}

const tacticColors: Record<string, string> = {
  'Initial Access': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Execution': 'bg-red-500/20 text-red-400 border-red-500/30',
  'Persistence': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'Privilege Escalation': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Defense Evasion': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'Credential Access': 'bg-lime-500/20 text-lime-400 border-lime-500/30',
  'Discovery': 'bg-green-500/20 text-green-400 border-green-500/30',
  'Lateral Movement': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  'Collection': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'Exfiltration': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Impact': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
};

export function MitreBadge({ mitre, className }: MitreBadgeProps) {
  const colorClass = tacticColors[mitre.tactic] || 'bg-muted text-muted-foreground border-border';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border cursor-help',
            colorClass,
            className
          )}
        >
          <Target className="w-3 h-3" />
          {mitre.techniqueId}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-semibold text-sm">MITRE ATT&CK</p>
          <p className="text-xs"><span className="text-muted-foreground">Tactic:</span> {mitre.tactic}</p>
          <p className="text-xs"><span className="text-muted-foreground">Technique:</span> {mitre.technique}</p>
          <p className="text-xs"><span className="text-muted-foreground">ID:</span> {mitre.techniqueId}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}