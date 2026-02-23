import { useState, useEffect, useMemo } from 'react';
import { MetricCard } from './MetricCard';
import { SeverityBadge } from './SeverityBadge';
import { ConnectorHealth } from './ConnectorHealth';
import { useSOC } from '@/context/SOCContext';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Shield,
  CheckCircle,
  Clock,
  Users,
  XCircle,
  Laptop,
  Activity,
  Settings,
  RefreshCw,
  Loader2,
  ExternalLink,
  WifiOff,
  TrendingUp,
  TrendingDown,
  Globe,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format, subDays, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { getSecureScore, SecureScore } from '@/services/graphApi';

interface DashboardViewProps {
  onViewChange?: (view: string) => void;
}

export function DashboardView({ onViewChange }: DashboardViewProps = {}) {
  const { isConfigured, isLoading, data, connectors, refreshAll, config } = useSOC();
  const [secureScore, setSecureScore] = useState<SecureScore | null>(null);
  const [loadingScore, setLoadingScore] = useState(false);

  // Fetch secure score
  useEffect(() => {
    if (config && isConfigured) {
      setLoadingScore(true);
      getSecureScore(config)
        .then(score => setSecureScore(score))
        .finally(() => setLoadingScore(false));
    }
  }, [config, isConfigured]);

  // Generate chart data from sign-ins (last 24h by hour)
  const signInChartData = useMemo(() => {
    const now = new Date();
    const hourlyData: { hour: string; success: number; failed: number }[] = [];
    
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourEnd = new Date(now.getTime() - (i - 1) * 60 * 60 * 1000);
      const hourLabel = format(hourStart, 'HH:mm');
      
      const hourSignIns = data.signInLogs.filter(log => {
        const logTime = new Date(log.createdDateTime);
        return logTime >= hourStart && logTime < hourEnd;
      });
      
      hourlyData.push({
        hour: hourLabel,
        success: hourSignIns.filter(l => l.status.errorCode === 0).length,
        failed: hourSignIns.filter(l => l.status.errorCode !== 0).length,
      });
    }
    
    return hourlyData;
  }, [data.signInLogs]);

  // Geographic data from sign-ins
  const geoData = useMemo(() => {
    const countryMap = new Map<string, { count: number; failed: number }>();
    
    data.signInLogs.forEach(log => {
      const country = log.location?.countryOrRegion || 'Unknown';
      const current = countryMap.get(country) || { count: 0, failed: 0 };
      current.count++;
      if (log.status.errorCode !== 0) current.failed++;
      countryMap.set(country, current);
    });
    
    return Array.from(countryMap.entries())
      .map(([country, data]) => ({ country, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [data.signInLogs]);

  // Incident severity distribution
  const severityData = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
    data.incidents.forEach(inc => {
      const sev = inc.severity as keyof typeof counts;
      if (counts[sev] !== undefined) counts[sev]++;
    });
    return [
      { name: 'Critique', value: counts.critical, color: '#ef4444' },
      { name: 'Élevée', value: counts.high, color: '#f97316' },
      { name: 'Moyenne', value: counts.medium, color: '#eab308' },
      { name: 'Faible', value: counts.low, color: '#22c55e' },
      { name: 'Info', value: counts.informational, color: '#6b7280' },
    ].filter(d => d.value > 0);
  }, [data.incidents]);

  // Calculate metrics from real data
  const activeIncidents = data.incidents.filter(i => i.status === 'active').length;
  const criticalCount = data.incidents.filter(i => i.severity === 'critical').length;
  const totalSignIns = data.signInLogs.length;
  const failedSignIns = data.signInLogs.filter(l => l.status.errorCode !== 0).length;
  const riskySignIns = data.signInLogs.filter(l => l.riskLevelDuringSignIn && l.riskLevelDuringSignIn !== 'none' && l.riskLevelDuringSignIn !== 'hidden').length;
  const totalDevices = data.devices.length;
  const compliantDevices = data.devices.filter(d => d.complianceState === 'compliant').length;
  const nonCompliantCount = data.devices.filter(d => d.complianceState === 'noncompliant').length;
  const complianceRate = totalDevices > 0 ? Math.round((compliantDevices / totalDevices) * 100) : 0;

  const criticalIncidents = data.incidents
    .filter((i) => i.severity === 'critical' || i.severity === 'high')
    .slice(0, 5);

  const recentSignIns = data.signInLogs.slice(0, 5);
  const nonCompliantDevices = data.devices.filter(d => d.complianceState === 'noncompliant').slice(0, 5);

  // Check if any connector is connected
  const anyConnected = Object.values(connectors).some(c => c.status === 'connected');

  if (!isConfigured) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="card-soc p-8 text-center">
          <WifiOff className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Configuration Requise</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Pour afficher les données de votre tenant Microsoft, configurez votre App Registration dans les Paramètres.
          </p>
          <Button onClick={() => onViewChange?.('settings')}>
            <Settings className="w-4 h-4 mr-2" />
            Aller aux Paramètres
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard SOC</h1>
          <p className="text-muted-foreground text-sm">Vue d'ensemble de la sécurité</p>
        </div>
        <Button onClick={() => refreshAll()} disabled={isLoading} variant="outline" size="sm">
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Actualiser
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="Incidents Actifs"
          value={activeIncidents}
          subtitle={`${criticalCount} critiques`}
          icon={AlertTriangle}
          variant={criticalCount > 0 ? 'critical' : 'default'}
        />
        <MetricCard
          title="Incidents Total"
          value={data.incidents.length}
          subtitle="Derniers 30 jours"
          icon={Shield}
          variant="default"
        />
        <MetricCard
          title="Connexions"
          value={totalSignIns}
          subtitle={`${failedSignIns} échecs • ${riskySignIns} risquées`}
          icon={Users}
          variant={riskySignIns > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Compliance"
          value={`${complianceRate}%`}
          subtitle={`${nonCompliantCount} non conformes`}
          icon={Laptop}
          variant={nonCompliantCount > 10 ? 'warning' : 'success'}
        />
      </div>

      {/* Secure Score + Connector Status */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Secure Score Card */}
        <div className="card-soc p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Secure Score</h3>
          </div>
          {loadingScore ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : secureScore ? (
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {Math.round((secureScore.currentScore / secureScore.maxScore) * 100)}%
              </div>
              <div className="text-sm text-muted-foreground">
                {secureScore.currentScore.toFixed(1)} / {secureScore.maxScore.toFixed(1)}
              </div>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(secureScore.currentScore / secureScore.maxScore) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Non disponible</p>
          )}
        </div>

        {/* Connector Health - Enhanced */}
        <div className="lg:col-span-3">
          <ConnectorHealth />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sign-in Activity Chart */}
        <div className="card-soc p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Activité des Connexions (24h)
            </h3>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={signInChartData}>
                <defs>
                  <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="failedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={3} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area type="monotone" dataKey="success" stroke="#22c55e" fill="url(#successGradient)" name="Réussies" />
                <Area type="monotone" dataKey="failed" stroke="#ef4444" fill="url(#failedGradient)" name="Échouées" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Geographic Distribution */}
        <div className="card-soc p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Connexions par Pays
            </h3>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={geoData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="country" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={80} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar dataKey="count" fill="#0ea5e9" name="Total" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Incident Severity + Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Severity Distribution */}
        <div className="card-soc p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Répartition Sévérité
            </h3>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {severityData.map((item) => (
              <div key={item.name} className="flex items-center gap-1 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Trends */}
        <div className="card-soc p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Tendances Rapides
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="text-2xl font-bold">{activeIncidents}</div>
              <div className="text-xs text-muted-foreground">Incidents actifs</div>
              <div className={cn('flex items-center gap-1 text-xs mt-1', criticalCount > 0 ? 'text-critical' : 'text-low')}>
                {criticalCount > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {criticalCount} critiques
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="text-2xl font-bold">{totalSignIns}</div>
              <div className="text-xs text-muted-foreground">Connexions</div>
              <div className={cn('flex items-center gap-1 text-xs mt-1', failedSignIns > 10 ? 'text-high' : 'text-low')}>
                {failedSignIns > 10 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {failedSignIns} échecs
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="text-2xl font-bold">{complianceRate}%</div>
              <div className="text-xs text-muted-foreground">Conformité</div>
              <div className={cn('flex items-center gap-1 text-xs mt-1', complianceRate >= 90 ? 'text-low' : 'text-high')}>
                {complianceRate >= 90 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {nonCompliantCount} non conformes
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="text-2xl font-bold">{data.riskyUsers.length}</div>
              <div className="text-xs text-muted-foreground">Utilisateurs à risque</div>
              <div className={cn('flex items-center gap-1 text-xs mt-1', data.riskyUsers.length > 0 ? 'text-critical' : 'text-low')}>
                {data.riskyUsers.length > 0 ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                {data.riskyUsers.length > 0 ? 'Action requise' : 'Tout va bien'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="xl:col-span-2 space-y-6">
          {/* Incidents */}
          <div className="card-soc p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Incidents Critiques & Élevés
              </h2>
              <span className="text-xs text-muted-foreground">
                {criticalIncidents.length} incidents
              </span>
            </div>
            
            {criticalIncidents.length > 0 ? (
              <div className="space-y-3">
                {criticalIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <SeverityBadge severity={incident.severity as any} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{incident.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{incident.description}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(incident.createdDateTime), { addSuffix: true, locale: fr })}
                    </div>
                    <a
                      href={incident.incidentWebUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ouvrir dans Defender"
                      className="p-2 rounded hover:bg-muted"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                {isLoading ? 'Chargement...' : 'Aucun incident critique'}
              </p>
            )}
          </div>

          {/* Sign-in Activity */}
          <div className="card-soc p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Connexions Récentes
              </h2>
            </div>
            
            {recentSignIns.length > 0 ? (
              <div className="space-y-2">
                {recentSignIns.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      log.status.errorCode === 0 ? 'bg-low' : 'bg-critical'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{log.userPrincipalName}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.ipAddress} • {log.location?.city || 'Unknown'}, {log.location?.countryOrRegion || ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium">{log.appDisplayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.createdDateTime), { addSuffix: true, locale: fr })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                {isLoading ? 'Chargement...' : 'Aucune connexion récente'}
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Non-compliant Devices */}
          <div className="card-soc p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <XCircle className="w-4 h-4 text-critical" />
                Appareils Non Conformes
              </h3>
              <span className="text-xs text-muted-foreground">
                {nonCompliantCount}
              </span>
            </div>
            
            {nonCompliantDevices.length > 0 ? (
              <div className="space-y-2">
                {nonCompliantDevices.map((device) => (
                  <div
                    key={device.id}
                    className="p-2 rounded-lg bg-critical/10 border border-critical/20"
                  >
                    <p className="font-medium text-sm">{device.deviceName}</p>
                    <p className="text-xs text-muted-foreground">{device.userPrincipalName}</p>
                    <p className="text-xs text-muted-foreground">
                      {device.operatingSystem} {device.osVersion}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4 text-sm">
                {isLoading ? 'Chargement...' : 'Tous les appareils sont conformes 🎉'}
              </p>
            )}
          </div>

          {/* Risky Users */}
          {data.riskyUsers.length > 0 && (
            <div className="card-soc p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-critical" />
                Utilisateurs à Risque
              </h3>
              <div className="space-y-2">
                {data.riskyUsers.slice(0, 5).map((user) => (
                  <div
                    key={user.id}
                    className="p-2 rounded-lg bg-critical/10 border border-critical/20"
                  >
                    <p className="font-medium text-sm">{user.userDisplayName}</p>
                    <p className="text-xs text-muted-foreground">{user.userPrincipalName}</p>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded',
                      user.riskLevel === 'high' && 'bg-critical/20 text-critical',
                      user.riskLevel === 'medium' && 'bg-high/20 text-high',
                      user.riskLevel === 'low' && 'bg-medium/20 text-medium'
                    )}>
                      {user.riskLevel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="card-soc p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Statistiques
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Incidents</span>
                <span className="font-mono">{data.incidents.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Connexions</span>
                <span className="font-mono">{data.signInLogs.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Appareils</span>
                <span className="font-mono">{data.devices.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Utilisateurs</span>
                <span className="font-mono">{data.users.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
