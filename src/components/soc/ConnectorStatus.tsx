import { mockConnectors, mockDataFreshness, getSourceLabel } from '@/data/mockData';
import { ConnectorInfo, DataFreshness } from '@/types/soc';
import { 
  CheckCircle, AlertTriangle, XCircle, WifiOff, 
  RefreshCw, Clock, Database
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ConnectorStatusProps {
  compact?: boolean;
}

export function ConnectorStatus({ compact = false }: ConnectorStatusProps) {
  const getStatusIcon = (status: ConnectorInfo['status']) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-3.5 h-3.5 text-low" />;
      case 'warning': return <AlertTriangle className="w-3.5 h-3.5 text-medium" />;
      case 'error': return <XCircle className="w-3.5 h-3.5 text-critical" />;
      case 'disconnected': return <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: ConnectorInfo['status']) => {
    switch (status) {
      case 'connected': return 'bg-low/20 border-low/30';
      case 'warning': return 'bg-medium/20 border-medium/30';
      case 'error': return 'bg-critical/20 border-critical/30';
      case 'disconnected': return 'bg-muted border-border';
    }
  };

  const getFreshnessColor = (status: DataFreshness['status']) => {
    switch (status) {
      case 'fresh': return 'text-low';
      case 'stale': return 'text-medium';
      case 'error': return 'text-critical';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {mockConnectors.map((connector) => (
          <div
            key={connector.id}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded border',
              getStatusColor(connector.status)
            )}
            title={`${connector.name}: ${connector.status === 'connected' ? 'Connecté' : connector.status === 'warning' ? 'Attention' : connector.status === 'error' ? 'Erreur' : 'Déconnecté'} - Lag: ${connector.dataLag}min`}
          >
            {getStatusIcon(connector.status)}
            <span className="text-xs font-medium">{connector.id.charAt(0).toUpperCase()}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="card-soc p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          État des Connecteurs
        </h3>
        <button className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        {mockConnectors.map((connector) => {
          const freshness = mockDataFreshness.find(f => f.source === connector.id);
          
          return (
            <div
              key={connector.id}
              className={cn(
                'flex items-center gap-3 p-2.5 rounded-lg border transition-colors',
                getStatusColor(connector.status)
              )}
            >
              {getStatusIcon(connector.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{getSourceLabel(connector.id)}</span>
                  {connector.status === 'connected' && (
                    <span className="px-1.5 py-0.5 rounded bg-low/20 text-low text-[10px] font-medium">
                      OK
                    </span>
                  )}
                  {connector.status === 'warning' && (
                    <span className="px-1.5 py-0.5 rounded bg-medium/20 text-medium text-[10px] font-medium">
                      WARN
                    </span>
                  )}
                  {connector.status === 'error' && (
                    <span className="px-1.5 py-0.5 rounded bg-critical/20 text-critical text-[10px] font-medium">
                      ERR
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(connector.lastSync, { addSuffix: true, locale: fr })}
                  </span>
                  {connector.dataLag !== undefined && (
                    <span className={cn(
                      'font-mono',
                      connector.dataLag > 10 ? 'text-medium' : 'text-muted-foreground'
                    )}>
                      Lag: {connector.dataLag}min
                    </span>
                  )}
                </div>
              </div>
              {freshness && (
                <div className="text-right">
                  <span className={cn('text-xs font-medium', getFreshnessColor(freshness.status))}>
                    {freshness.recordCount.toLocaleString()}
                  </span>
                  <p className="text-[10px] text-muted-foreground">records</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {mockConnectors.some(c => c.errorMessage) && (
        <div className="mt-3 p-2 rounded bg-critical/10 border border-critical/20">
          <p className="text-xs text-critical font-medium mb-1">Erreurs détectées:</p>
          {mockConnectors.filter(c => c.errorMessage).map(c => (
            <p key={c.id} className="text-xs text-critical/80">
              • {getSourceLabel(c.id)}: {c.errorMessage}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
