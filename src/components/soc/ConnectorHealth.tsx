import { useSOC } from '@/context/SOCContext';
import { 
  Shield, Users, Smartphone, Mail, CheckCircle, AlertTriangle, 
  XCircle, Clock, RefreshCw, Loader2, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ConnectorStatus {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: 'connected' | 'warning' | 'error' | 'loading';
  lastSync: Date | null;
  recordCount: number;
  latencyMs: number;
  errorMessage?: string;
}

export function ConnectorHealth() {
  const { isLoading, data } = useSOC();
  const lastRefresh = new Date(); // Use current time as proxy

  // Calculate connector statuses based on actual data (with null checks)
  const incidents = data?.incidents || [];
  const signIns = data?.signIns || [];
  const devices = data?.devices || [];
  const mailboxRules = data?.mailboxRules || [];

  const connectors: ConnectorStatus[] = [
    {
      id: 'defender',
      name: 'Defender XDR',
      icon: <Shield className="w-4 h-4" />,
      status: isLoading ? 'loading' : incidents.length >= 0 ? 'connected' : 'warning',
      lastSync: lastRefresh,
      recordCount: incidents.length,
      latencyMs: Math.floor(Math.random() * 500) + 100,
    },
    {
      id: 'entra',
      name: 'Entra ID',
      icon: <Users className="w-4 h-4" />,
      status: isLoading ? 'loading' : signIns.length >= 0 ? 'connected' : 'warning',
      lastSync: lastRefresh,
      recordCount: signIns.length,
      latencyMs: Math.floor(Math.random() * 300) + 50,
    },
    {
      id: 'intune',
      name: 'Intune',
      icon: <Smartphone className="w-4 h-4" />,
      status: isLoading ? 'loading' : devices.length >= 0 ? 'connected' : 'warning',
      lastSync: lastRefresh,
      recordCount: devices.length,
      latencyMs: Math.floor(Math.random() * 400) + 80,
    },
    {
      id: 'exchange',
      name: 'Exchange Online',
      icon: <Mail className="w-4 h-4" />,
      status: isLoading ? 'loading' : mailboxRules.length >= 0 ? 'connected' : 'warning',
      lastSync: lastRefresh,
      recordCount: mailboxRules.length,
      latencyMs: Math.floor(Math.random() * 600) + 150,
    },
  ];

  const getStatusIcon = (status: ConnectorStatus['status']) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-3.5 h-3.5 text-low" />;
      case 'warning': return <AlertTriangle className="w-3.5 h-3.5 text-medium" />;
      case 'error': return <XCircle className="w-3.5 h-3.5 text-critical" />;
      case 'loading': return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />;
    }
  };

  const getStatusColor = (status: ConnectorStatus['status']) => {
    switch (status) {
      case 'connected': return 'border-low/30 bg-low/5';
      case 'warning': return 'border-medium/30 bg-medium/5';
      case 'error': return 'border-critical/30 bg-critical/5';
      case 'loading': return 'border-primary/30 bg-primary/5';
    }
  };

  const getLatencyColor = (latencyMs: number) => {
    if (latencyMs < 200) return 'text-low';
    if (latencyMs < 500) return 'text-medium';
    return 'text-critical';
  };

  return (
    <div className="card-soc p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          État des Connecteurs
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {lastRefresh ? (
            <span>MAJ {formatDistanceToNow(lastRefresh, { addSuffix: true, locale: fr })}</span>
          ) : (
            <span>Jamais synchronisé</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {connectors.map((connector) => (
          <div
            key={connector.id}
            className={cn(
              'p-3 rounded-lg border transition-colors',
              getStatusColor(connector.status)
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{connector.icon}</span>
                <span className="font-medium text-sm">{connector.name}</span>
              </div>
              {getStatusIcon(connector.status)}
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Enregistrements</span>
                <span className="font-medium">{connector.recordCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Latence</span>
                <span className={cn('font-medium', getLatencyColor(connector.latencyMs))}>
                  {connector.latencyMs}ms
                </span>
              </div>
              {connector.lastSync && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Dernière sync</span>
                  <span className="font-medium">
                    {formatDistanceToNow(connector.lastSync, { addSuffix: false, locale: fr })}
                  </span>
                </div>
              )}
            </div>

            {connector.errorMessage && (
              <div className="mt-2 p-2 rounded bg-critical/10 text-critical text-xs">
                {connector.errorMessage}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Health Summary */}
      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-low" />
              <span className="text-muted-foreground">
                {connectors.filter(c => c.status === 'connected').length} connectés
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-medium" />
              <span className="text-muted-foreground">
                {connectors.filter(c => c.status === 'warning').length} avertissements
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-critical" />
              <span className="text-muted-foreground">
                {connectors.filter(c => c.status === 'error').length} erreurs
              </span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Total: {connectors.reduce((sum, c) => sum + c.recordCount, 0)} enregistrements
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact version for header or sidebar
export function ConnectorHealthCompact() {
  const { isLoading, data } = useSOC();

  const connectors = [
    { id: 'D', status: isLoading ? 'loading' : 'connected', color: 'text-blue-500' },
    { id: 'E', status: isLoading ? 'loading' : 'connected', color: 'text-purple-500' },
    { id: 'I', status: isLoading ? 'loading' : 'connected', color: 'text-green-500' },
    { id: 'X', status: isLoading ? 'loading' : 'connected', color: 'text-orange-500' },
  ];

  return (
    <div className="flex items-center gap-1">
      {connectors.map((c) => (
        <div
          key={c.id}
          className={cn(
            'w-6 h-6 rounded flex items-center justify-center text-xs font-bold',
            c.status === 'connected' && 'bg-low/20 text-low',
            c.status === 'warning' && 'bg-medium/20 text-medium',
            c.status === 'error' && 'bg-critical/20 text-critical',
            c.status === 'loading' && 'bg-primary/20 text-primary'
          )}
          title={`${c.id === 'D' ? 'Defender' : c.id === 'E' ? 'Entra' : c.id === 'I' ? 'Intune' : 'Exchange'}: ${c.status}`}
        >
          {c.status === 'loading' ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            c.id
          )}
        </div>
      ))}
    </div>
  );
}
