import { WeeklySummary } from '@/types/soc';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FileText, TrendingUp, Lightbulb, AlertCircle } from 'lucide-react';

interface WeeklySummaryCardProps {
  summary: WeeklySummary;
}

export function WeeklySummaryCard({ summary }: WeeklySummaryCardProps) {
  return (
    <div className="card-soc p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Synthèse Hebdomadaire</h3>
            <p className="text-xs text-muted-foreground">
              {format(summary.weekStart, 'dd MMM', { locale: fr })} - {format(summary.weekEnd, 'dd MMM yyyy', { locale: fr })}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{summary.totalIncidents}</p>
          <p className="text-xs text-muted-foreground">incidents</p>
        </div>
      </div>

      {/* Severity Breakdown */}
      <div className="grid grid-cols-5 gap-2">
        {Object.entries(summary.incidentsBySeverity).map(([severity, count]) => (
          <div key={severity} className="text-center p-2 rounded-lg bg-muted/30">
            <span className={`status-indicator ${severity} inline-block mb-1`} />
            <p className="text-lg font-semibold">{count}</p>
            <p className="text-xs text-muted-foreground capitalize">{severity}</p>
          </div>
        ))}
      </div>

      {/* Top Events */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-4 h-4 text-high" />
          <h4 className="font-medium text-sm">Événements majeurs</h4>
        </div>
        <ul className="space-y-2">
          {summary.topEvents.map((event, idx) => (
            <li key={idx} className="text-sm text-muted-foreground flex gap-2">
              <span className="text-primary">•</span>
              {event}
            </li>
          ))}
        </ul>
      </div>

      {/* Trends */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-info" />
          <h4 className="font-medium text-sm">Tendances</h4>
        </div>
        <ul className="space-y-2">
          {summary.trends.map((trend, idx) => (
            <li key={idx} className="text-sm text-muted-foreground">
              {trend}
            </li>
          ))}
        </ul>
      </div>

      {/* Recommendations */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-4 h-4 text-medium" />
          <h4 className="font-medium text-sm">Recommandations</h4>
        </div>
        <ul className="space-y-2">
          {summary.recommendations.map((rec, idx) => (
            <li key={idx} className="text-sm text-muted-foreground flex gap-2">
              <span className="text-medium font-bold">{idx + 1}.</span>
              {rec}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
