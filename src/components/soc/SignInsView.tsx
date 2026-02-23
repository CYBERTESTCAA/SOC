import { useState, useMemo } from 'react';
import { useSOC } from '@/context/SOCContext';
import { GraphSignIn, SignInPeriod } from '@/services/graphApi';
import { MetricCard } from './MetricCard';
import { Button } from '@/components/ui/button';
import { getCountryName, getCountryFlag } from '@/utils/countries';
import { detectAnomalies, calculateUserRiskScores, Anomaly, UserRiskScore } from '@/services/anomalyDetection';
import { 
  Users, XCircle, AlertTriangle, CheckCircle, Globe,
  RefreshCw, Search, Key, Eye, WifiOff, Loader2, ShieldAlert, TrendingUp, Clock, MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Compute top IPs from logs
const computeTopIPs = (logs: GraphSignIn[]) => {
  const ipCounts: Record<string, { count: number; failures: number; country: string }> = {};
  logs.forEach(log => {
    if (!ipCounts[log.ipAddress]) {
      ipCounts[log.ipAddress] = { count: 0, failures: 0, country: log.location?.countryOrRegion || 'Unknown' };
    }
    ipCounts[log.ipAddress].count++;
    if (log.status.errorCode !== 0) ipCounts[log.ipAddress].failures++;
  });
  return Object.entries(ipCounts)
    .map(([ip, data]) => ({ ip, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
};

// Compute top targeted accounts
const computeTopTargets = (logs: GraphSignIn[]) => {
  const userCounts: Record<string, { total: number; failures: number }> = {};
  logs.forEach(log => {
    if (!userCounts[log.userPrincipalName]) {
      userCounts[log.userPrincipalName] = { total: 0, failures: 0 };
    }
    userCounts[log.userPrincipalName].total++;
    if (log.status.errorCode !== 0) userCounts[log.userPrincipalName].failures++;
  });
  return Object.entries(userCounts)
    .map(([user, data]) => ({ user, ...data }))
    .filter(u => u.failures > 0)
    .sort((a, b) => b.failures - a.failures)
    .slice(0, 10);
};

const PERIOD_OPTIONS: { value: SignInPeriod; label: string }[] = [
  { value: '12h', label: '12 heures' },
  { value: '1d', label: '1 jour' },
  { value: '3d', label: '3 jours' },
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
];

export function SignInsView() {
  const { isConfigured, isLoading, data, refreshSignIns, connectors } = useSOC();
  const [selectedLog, setSelectedLog] = useState<GraphSignIn | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failure'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<SignInPeriod>('12h');

  const isRefreshing = connectors.entra.status === 'loading';

  const handlePeriodChange = (period: SignInPeriod) => {
    setSelectedPeriod(period);
    refreshSignIns(period);
  };

  const topIPs = useMemo(() => computeTopIPs(data.signInLogs), [data.signInLogs]);
  const topTargets = useMemo(() => computeTopTargets(data.signInLogs), [data.signInLogs]);
  
  // Détection d'anomalies
  const anomalies = useMemo(() => detectAnomalies(data.signInLogs), [data.signInLogs]);
  
  // Scores de risque utilisateurs
  const userRiskScores = useMemo(() => 
    calculateUserRiskScores(data.signInLogs, [], data.riskyUsers),
    [data.signInLogs, data.riskyUsers]
  );
  
  // Filtrer pour n'afficher que les utilisateurs à risque moyen ou plus
  const riskyUserScores = useMemo(() => 
    userRiskScores.filter(u => u.score >= 20),
    [userRiskScores]
  );

  // Calculate metrics
  const totalSignIns = data.signInLogs.length;
  const successfulSignIns = data.signInLogs.filter(l => l.status.errorCode === 0).length;
  const failedSignIns = data.signInLogs.filter(l => l.status.errorCode !== 0).length;
  const riskySignIns = data.signInLogs.filter(l => 
    l.riskLevelDuringSignIn && l.riskLevelDuringSignIn !== 'none' && l.riskLevelDuringSignIn !== 'hidden'
  ).length;

  const filteredLogs = data.signInLogs.filter(log => {
    const isSuccess = log.status.errorCode === 0;
    if (statusFilter === 'success' && !isSuccess) return false;
    if (statusFilter === 'failure' && isSuccess) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!log.userPrincipalName.toLowerCase().includes(query) &&
          !log.ipAddress.includes(query) &&
          !log.appDisplayName.toLowerCase().includes(query)) {
        return false;
      }
    }
    return true;
  });

  if (!isConfigured) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="card-soc p-8 text-center">
          <WifiOff className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Configuration Requise</h2>
          <p className="text-muted-foreground mb-6">
            Configurez votre App Registration dans les Paramètres pour voir les connexions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Connexions Entra ID</h1>
          <p className="text-muted-foreground text-sm">
            Logs de connexion et analyse des comportements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refreshSignIns(selectedPeriod)} 
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Actualiser
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground mr-2">Période :</span>
        {PERIOD_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={selectedPeriod === option.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePeriodChange(option.value)}
            disabled={isRefreshing}
            className="min-w-[80px]"
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total"
          value={totalSignIns}
          icon={Users}
          variant="default"
        />
        <MetricCard
          title="Réussies"
          value={successfulSignIns}
          icon={CheckCircle}
          variant="success"
        />
        <MetricCard
          title="Échecs"
          value={failedSignIns}
          icon={XCircle}
          variant={failedSignIns > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Risquées"
          value={riskySignIns}
          icon={AlertTriangle}
          variant={riskySignIns > 0 ? 'critical' : 'default'}
        />
      </div>

      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList className="bg-muted/30">
          <TabsTrigger value="logs">Logs de Connexion</TabsTrigger>
          <TabsTrigger value="anomalies">
            Anomalies
            {anomalies.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-critical/20 text-critical text-xs">
                {anomalies.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="risk-scores">
            Scores de Risque
            {riskyUserScores.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-high/20 text-high text-xs">
                {riskyUserScores.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics">Analyse</TabsTrigger>
        </TabsList>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          {/* Filters */}
          <div className="card-soc p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher par utilisateur, IP, app..."
                    className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div className="flex gap-1">
                {(['all', 'success', 'failure'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      'px-3 py-2 rounded text-xs font-medium transition-colors',
                      statusFilter === status
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {status === 'all' ? 'Tous' : status === 'success' ? 'Réussies' : 'Échecs'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Logs List */}
          <div className="card-soc p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Connexions ({filteredLogs.length})</h2>
            </div>
            
            {isLoading && data.signInLogs.length === 0 ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Chargement...</p>
              </div>
            ) : filteredLogs.length > 0 ? (
              <div className="space-y-2">
                {filteredLogs.slice(0, 50).map((log) => (
                  <div key={log.id}>
                    <div
                      onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        log.status.errorCode === 0 ? 'bg-low' : 'bg-critical'
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{log.userPrincipalName}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.ipAddress} • {log.location?.city || 'Unknown'}, {getCountryFlag(log.location?.countryOrRegion)} {getCountryName(log.location?.countryOrRegion)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium">{log.appDisplayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.createdDateTime), { addSuffix: true, locale: fr })}
                        </p>
                      </div>
                      {log.riskLevelDuringSignIn && log.riskLevelDuringSignIn !== 'none' && log.riskLevelDuringSignIn !== 'hidden' && (
                        <span className="px-2 py-0.5 rounded bg-critical/20 text-critical text-xs shrink-0">
                          {log.riskLevelDuringSignIn}
                        </span>
                      )}
                    </div>
                    
                    {selectedLog?.id === log.id && (
                      <div className="mt-2 p-4 rounded-lg bg-muted/30 border border-border/50 animate-fade-in">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Eye className="w-4 h-4 text-primary" />
                          Détails de la connexion
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground block">Application</span>
                            <span className="font-medium">{log.appDisplayName}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Client</span>
                            <span className="font-medium">{log.clientAppUsed || 'Browser'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Conditional Access</span>
                            <span className={cn(
                              'font-medium',
                              log.conditionalAccessStatus === 'success' && 'text-low',
                              log.conditionalAccessStatus === 'failure' && 'text-critical'
                            )}>
                              {log.conditionalAccessStatus || 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Type</span>
                            <span className="font-medium">
                              {log.isInteractive ? 'Interactive' : 'Non-interactive'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Device</span>
                            <span className="font-medium">
                              {log.deviceDetail?.displayName || log.deviceDetail?.operatingSystem || 'Unknown'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Localisation</span>
                            <span className="font-medium">
                              {getCountryFlag(log.location?.countryOrRegion)} {log.location?.city || 'Unknown'}, {getCountryName(log.location?.countryOrRegion)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Statut</span>
                            <span className={cn(
                              'font-medium',
                              log.status.errorCode === 0 ? 'text-low' : 'text-critical'
                            )}>
                              {log.status.errorCode === 0 ? 'Succès' : `Erreur ${log.status.errorCode}`}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Timestamp</span>
                            <span className="font-mono text-xs">
                              {format(new Date(log.createdDateTime), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                            </span>
                          </div>
                        </div>
                        {log.status.failureReason && (
                          <div className="mt-3 p-2 rounded bg-critical/10 border border-critical/20 text-sm text-critical">
                            Raison: {log.status.failureReason}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Aucune connexion trouvée
              </p>
            )}
          </div>
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies" className="space-y-4">
          <div className="card-soc p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-critical" />
                Anomalies Détectées
              </h3>
              <span className="text-xs text-muted-foreground">
                {anomalies.length} anomalie(s) détectée(s)
              </span>
            </div>

            {anomalies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50 text-low" />
                <p>Aucune anomalie détectée</p>
                <p className="text-sm">Toutes les connexions semblent normales</p>
              </div>
            ) : (
              <div className="space-y-3">
                {anomalies.slice(0, 50).map((anomaly) => (
                  <div
                    key={anomaly.id}
                    className={cn(
                      'p-4 rounded-lg border transition-colors',
                      anomaly.severity === 'critical' && 'bg-critical/5 border-critical/30',
                      anomaly.severity === 'high' && 'bg-high/5 border-high/30',
                      anomaly.severity === 'medium' && 'bg-medium/5 border-medium/30',
                      anomaly.severity === 'low' && 'bg-muted/30 border-border/50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {anomaly.type === 'unusual_hour' && <Clock className="w-4 h-4 text-medium" />}
                          {anomaly.type === 'risky_country' && <MapPin className="w-4 h-4 text-high" />}
                          {anomaly.type === 'failed_attempts' && <XCircle className="w-4 h-4 text-critical" />}
                          {anomaly.type === 'multiple_countries' && <Globe className="w-4 h-4 text-high" />}
                          <span className="font-medium">{anomaly.title}</span>
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            anomaly.severity === 'critical' && 'bg-critical/20 text-critical',
                            anomaly.severity === 'high' && 'bg-high/20 text-high',
                            anomaly.severity === 'medium' && 'bg-medium/20 text-medium',
                            anomaly.severity === 'low' && 'bg-low/20 text-low'
                          )}>
                            {anomaly.severity}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {anomaly.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>👤 {anomaly.userPrincipalName}</span>
                          <span>🕐 {formatDistanceToNow(anomaly.timestamp, { addSuffix: true, locale: fr })}</span>
                          {anomaly.details.ip && <span>🌐 {anomaly.details.ip}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Risk Scores Tab */}
        <TabsContent value="risk-scores" className="space-y-4">
          <div className="card-soc p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-high" />
                Scores de Risque Utilisateurs
              </h3>
              <span className="text-xs text-muted-foreground">
                Basé sur connexions, comportements et règles
              </span>
            </div>

            {riskyUserScores.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50 text-low" />
                <p>Aucun utilisateur à risque</p>
                <p className="text-sm">Tous les scores sont inférieurs au seuil d'alerte</p>
              </div>
            ) : (
              <div className="space-y-3">
                {riskyUserScores.map((user) => (
                  <div
                    key={user.userPrincipalName}
                    className={cn(
                      'p-4 rounded-lg border transition-colors',
                      user.level === 'critical' && 'bg-critical/5 border-critical/30',
                      user.level === 'high' && 'bg-high/5 border-high/30',
                      user.level === 'medium' && 'bg-medium/5 border-medium/30',
                      user.level === 'low' && 'bg-muted/30 border-border/50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <Users className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{user.displayName}</p>
                            <p className="text-xs text-muted-foreground">{user.userPrincipalName}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {user.factors.map((factor, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-muted text-xs"
                              title={factor.description}
                            >
                              {factor.name} (+{factor.points})
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className={cn(
                          'w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold',
                          user.level === 'critical' && 'bg-critical/20 text-critical',
                          user.level === 'high' && 'bg-high/20 text-high',
                          user.level === 'medium' && 'bg-medium/20 text-medium',
                          user.level === 'low' && 'bg-low/20 text-low'
                        )}>
                          {user.score}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{user.level}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top IPs */}
            <div className="card-soc p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                Top 10 IPs les Plus Actives
              </h3>
              {topIPs.length > 0 ? (
                <div className="space-y-2">
                  {topIPs.map((item, idx) => (
                    <div
                      key={item.ip}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                    >
                      <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-mono text-sm">{item.ip}</p>
                        <p className="text-xs text-muted-foreground">
                          {getCountryFlag(item.country)} {getCountryName(item.country)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{item.count}</p>
                        {item.failures > 0 && (
                          <p className="text-xs text-critical">{item.failures} échecs</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">Pas de données</p>
              )}
            </div>

            {/* Top Targeted Accounts */}
            <div className="card-soc p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-critical" />
                Comptes les Plus Ciblés (échecs)
              </h3>
              {topTargets.length > 0 ? (
                <div className="space-y-2">
                  {topTargets.map((item, idx) => (
                    <div
                      key={item.user}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                    >
                      <span className="w-6 h-6 rounded-full bg-critical/20 text-critical flex items-center justify-center text-xs font-medium">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium truncate">{item.user}</p>
                        <p className="text-xs text-muted-foreground">{item.total} connexions totales</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-critical">{item.failures}</p>
                        <p className="text-xs text-muted-foreground">échecs</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">Aucun compte ciblé</p>
              )}
            </div>
          </div>

          {/* Risky Users */}
          {data.riskyUsers.length > 0 && (
            <div className="card-soc p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-critical" />
                Utilisateurs à Risque (Identity Protection)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.riskyUsers.map((user) => (
                  <div
                    key={user.id}
                    className="p-3 rounded-lg bg-critical/10 border border-critical/20"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        user.riskLevel === 'high' && 'bg-critical/20 text-critical',
                        user.riskLevel === 'medium' && 'bg-high/20 text-high',
                        user.riskLevel === 'low' && 'bg-medium/20 text-medium'
                      )}>
                        {user.riskLevel}
                      </span>
                      <span className="text-xs text-muted-foreground">{user.riskState}</span>
                    </div>
                    <p className="font-medium text-sm">{user.userDisplayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.userPrincipalName}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
