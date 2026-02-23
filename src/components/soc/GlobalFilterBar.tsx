import { useGlobalFilters, TimeRange, Workload } from '@/context/GlobalFilterContext';
import { Button } from '@/components/ui/button';
import { 
  Clock, Shield, Users, Smartphone, Mail, Filter, X, AlertTriangle,
  UserCheck, UserX, Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: '1h', label: '1h' },
  { value: '12h', label: '12h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7j' },
  { value: '30d', label: '30j' },
];

const workloadOptions: { value: Workload; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'defender', label: 'Defender', icon: <Shield className="w-3 h-3" />, color: 'text-blue-500' },
  { value: 'entra', label: 'Entra ID', icon: <Users className="w-3 h-3" />, color: 'text-purple-500' },
  { value: 'intune', label: 'Intune', icon: <Smartphone className="w-3 h-3" />, color: 'text-green-500' },
  { value: 'exchange', label: 'Exchange', icon: <Mail className="w-3 h-3" />, color: 'text-orange-500' },
];

const severityOptions = [
  { value: 'critical', label: 'Critique', color: 'bg-critical/20 text-critical border-critical/30' },
  { value: 'high', label: 'Élevée', color: 'bg-high/20 text-high border-high/30' },
  { value: 'medium', label: 'Moyenne', color: 'bg-medium/20 text-medium border-medium/30' },
  { value: 'low', label: 'Faible', color: 'bg-low/20 text-low border-low/30' },
];

export function GlobalFilterBar() {
  const {
    filters,
    setTimeRange,
    toggleWorkload,
    toggleSeverity,
    setAssignedToMe,
    setUnassignedOnly,
    setSlaBreachOnly,
    resetFilters,
  } = useGlobalFilters();

  const hasActiveFilters = 
    filters.severities.length > 0 || 
    filters.assignedToMe || 
    filters.unassignedOnly || 
    filters.slaBreachOnly ||
    filters.workloads.length < 4;

  return (
    <div className="bg-card/50 backdrop-blur-sm border-b border-border/50 sticky top-0 z-40">
      <div className="px-4 py-2 flex items-center gap-4 flex-wrap">
        {/* Time Range */}
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5">
            {timeRangeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTimeRange(option.value)}
                className={cn(
                  'px-2 py-1 text-xs font-medium rounded transition-colors',
                  filters.timeRange === option.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-px h-6 bg-border/50" />

        {/* Workloads */}
        <div className="flex items-center gap-1">
          {workloadOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => toggleWorkload(option.value)}
              className={cn(
                'flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border transition-colors',
                filters.workloads.includes(option.value)
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50'
              )}
            >
              {option.icon}
              <span className="hidden sm:inline">{option.label}</span>
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-border/50" />

        {/* Severity Filters */}
        <div className="flex items-center gap-1">
          <AlertTriangle className="w-4 h-4 text-muted-foreground" />
          {severityOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => toggleSeverity(option.value)}
              className={cn(
                'px-2 py-1 text-xs font-medium rounded border transition-colors',
                filters.severities.includes(option.value)
                  ? option.color
                  : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-border/50" />

        {/* Queue Filters */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAssignedToMe(!filters.assignedToMe)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border transition-colors',
              filters.assignedToMe
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50'
            )}
          >
            <UserCheck className="w-3 h-3" />
            <span className="hidden md:inline">Mes incidents</span>
          </button>
          <button
            onClick={() => setUnassignedOnly(!filters.unassignedOnly)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border transition-colors',
              filters.unassignedOnly
                ? 'bg-medium/10 border-medium/30 text-medium'
                : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50'
            )}
          >
            <UserX className="w-3 h-3" />
            <span className="hidden md:inline">Non assignés</span>
          </button>
          <button
            onClick={() => setSlaBreachOnly(!filters.slaBreachOnly)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border transition-colors',
              filters.slaBreachOnly
                ? 'bg-critical/10 border-critical/30 text-critical'
                : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50'
            )}
          >
            <Timer className="w-3 h-3" />
            <span className="hidden md:inline">SLA dépassé</span>
          </button>
        </div>

        {/* Reset */}
        {hasActiveFilters && (
          <>
            <div className="w-px h-6 bg-border/50" />
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3 mr-1" />
              Réinitialiser
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
