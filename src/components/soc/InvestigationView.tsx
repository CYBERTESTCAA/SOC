import { useState, useMemo } from 'react';
import { useSOC } from '@/context/SOCContext';
import { Button } from '@/components/ui/button';
import { SeverityBadge } from './SeverityBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  User,
  Laptop,
  Globe,
  Clock,
  AlertTriangle,
  Shield,
  Activity,
  ChevronRight,
  ExternalLink,
  Mail,
  MapPin,
  Calendar,
  Filter,
  RefreshCw,
  Loader2,
  WifiOff,
  Target,
  Network,
  Eye,
  FileText,
  TrendingUp,
  CheckCircle,
  XCircle,
  Download,
  Hash,
  Link,
  Crosshair,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { searchThreatIndicators, getAuditLogs, ThreatIndicator, AuditLog } from '@/services/graphApi';

type EntityType = 'user' | 'device' | 'ip' | 'all';

interface Entity {
  id: string;
  type: 'user' | 'device' | 'ip';
  name: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'none';
  lastSeen: Date;
  incidents: number;
  details: Record<string, string>;
}

export function InvestigationView() {
  const { isConfigured, isLoading, data, refreshAll, config } = useSOC();
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<EntityType>('all');
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [iocQuery, setIocQuery] = useState('');
  const [iocResults, setIocResults] = useState<ThreatIndicator[]>([]);
  const [iocLoading, setIocLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Threat hunting - search for IOCs
  const handleIocSearch = async () => {
    if (!config || !iocQuery.trim()) return;
    setIocLoading(true);
    try {
      const results = await searchThreatIndicators(config, iocQuery.trim());
      setIocResults(results);
    } catch (error) {
      console.error('IOC search failed:', error);
    } finally {
      setIocLoading(false);
    }
  };

  // Load audit logs
  const handleLoadAuditLogs = async () => {
    if (!config) return;
    setAuditLoading(true);
    try {
      const logs = await getAuditLogs(config, 100);
      setAuditLogs(logs);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setAuditLoading(false);
    }
  };

  // Export data to CSV
  const exportToCSV = (dataType: 'signins' | 'incidents' | 'devices' | 'users') => {
    let csvContent = '';
    let filename = '';

    switch (dataType) {
      case 'signins':
        csvContent = 'Date,User,IP,Location,App,Status,Risk\n';
        data.signInLogs.forEach(log => {
          csvContent += `"${log.createdDateTime}","${log.userPrincipalName}","${log.ipAddress}","${log.location?.city || ''}, ${log.location?.countryOrRegion || ''}","${log.appDisplayName}","${log.status.errorCode === 0 ? 'Success' : 'Failed'}","${log.riskLevelDuringSignIn || 'none'}"\n`;
        });
        filename = `connexions_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        break;
      case 'incidents':
        csvContent = 'ID,Title,Severity,Status,Created,Classification\n';
        data.incidents.forEach(inc => {
          csvContent += `"${inc.id}","${inc.displayName}","${inc.severity}","${inc.status}","${inc.createdDateTime}","${inc.classification || ''}"\n`;
        });
        filename = `incidents_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        break;
      case 'devices':
        csvContent = 'Name,User,OS,Compliance,LastSync\n';
        data.devices.forEach(dev => {
          csvContent += `"${dev.deviceName}","${dev.userPrincipalName}","${dev.operatingSystem} ${dev.osVersion}","${dev.complianceState}","${dev.lastSyncDateTime}"\n`;
        });
        filename = `appareils_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        break;
      case 'users':
        csvContent = 'DisplayName,Email,Department,AccountEnabled\n';
        data.users.forEach(user => {
          csvContent += `"${user.displayName}","${user.userPrincipalName}","${user.department || ''}","${user.accountEnabled}"\n`;
        });
        filename = `utilisateurs_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        break;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export to JSON
  const exportToJSON = (dataType: 'signins' | 'incidents' | 'devices' | 'users') => {
    let jsonData: any[];
    let filename = '';

    switch (dataType) {
      case 'signins':
        jsonData = data.signInLogs;
        filename = `connexions_${format(new Date(), 'yyyy-MM-dd')}.json`;
        break;
      case 'incidents':
        jsonData = data.incidents;
        filename = `incidents_${format(new Date(), 'yyyy-MM-dd')}.json`;
        break;
      case 'devices':
        jsonData = data.devices;
        filename = `appareils_${format(new Date(), 'yyyy-MM-dd')}.json`;
        break;
      case 'users':
        jsonData = data.users;
        filename = `utilisateurs_${format(new Date(), 'yyyy-MM-dd')}.json`;
        break;
    }

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Build entities from real data - using ALL users and devices from tenant
  const entities = useMemo(() => {
    const result: Entity[] = [];
    
    // Build sign-in stats per user for risk assessment
    const userSignInStats = new Map<string, { 
      riskLevel: string; 
      signInCount: number; 
      lastSignIn: Date | null;
      lastApp: string;
      lastLocation: string;
    }>();
    
    data.signInLogs.forEach(log => {
      const existing = userSignInStats.get(log.userPrincipalName);
      const riskLevel = log.riskLevelDuringSignIn === 'high' ? 'high' 
                      : log.riskLevelDuringSignIn === 'medium' ? 'medium'
                      : log.riskLevelDuringSignIn === 'low' ? 'low' : 'none';
      
      if (existing) {
        existing.signInCount++;
        if (riskLevel !== 'none' && existing.riskLevel === 'none') {
          existing.riskLevel = riskLevel;
        }
        const logDate = new Date(log.createdDateTime);
        if (!existing.lastSignIn || logDate > existing.lastSignIn) {
          existing.lastSignIn = logDate;
          existing.lastApp = log.appDisplayName;
          existing.lastLocation = log.location?.city || 'Unknown';
        }
      } else {
        userSignInStats.set(log.userPrincipalName, {
          riskLevel,
          signInCount: 1,
          lastSignIn: new Date(log.createdDateTime),
          lastApp: log.appDisplayName,
          lastLocation: log.location?.city || 'Unknown',
        });
      }
    });

    // Check risky users from Entra
    const riskyUserSet = new Set(data.riskyUsers.map(u => u.userPrincipalName));

    // ALL Users from tenant (data.users now contains ALL users)
    data.users.forEach(user => {
      const signInStats = userSignInStats.get(user.userPrincipalName);
      const isRisky = riskyUserSet.has(user.userPrincipalName);
      let riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'none' = 'none';
      
      if (isRisky) {
        riskLevel = 'high';
      } else if (signInStats?.riskLevel === 'high') {
        riskLevel = 'high';
      } else if (signInStats?.riskLevel === 'medium') {
        riskLevel = 'medium';
      } else if (signInStats?.riskLevel === 'low') {
        riskLevel = 'low';
      }

      result.push({
        id: user.id,
        type: 'user',
        name: user.userPrincipalName,
        riskLevel,
        lastSeen: signInStats?.lastSignIn || new Date(),
        incidents: signInStats?.signInCount || 0,
        details: {
          displayName: user.displayName,
          email: user.mail || user.userPrincipalName,
          department: user.department || 'N/A',
          jobTitle: user.jobTitle || 'N/A',
          status: user.accountEnabled ? 'Actif' : 'Désactivé',
          lastApp: signInStats?.lastApp || 'N/A',
          lastLocation: signInStats?.lastLocation || 'N/A',
        },
      });
    });

    // ALL Devices from Intune (data.devices now contains ALL devices)
    data.devices.forEach(device => {
      result.push({
        id: device.id,
        type: 'device',
        name: device.deviceName,
        riskLevel: device.complianceState === 'noncompliant' ? 'high' : 'none',
        lastSeen: new Date(device.lastSyncDateTime),
        incidents: device.complianceState === 'noncompliant' ? 1 : 0,
        details: {
          user: device.userPrincipalName,
          os: `${device.operatingSystem} ${device.osVersion}`,
          model: device.model || 'N/A',
          manufacturer: device.manufacturer || 'N/A',
          compliance: device.complianceState,
          encrypted: device.isEncrypted ? 'Oui' : 'Non',
          enrolledDate: device.enrolledDateTime ? format(new Date(device.enrolledDateTime), 'dd/MM/yyyy', { locale: fr }) : 'N/A',
        },
      });
    });

    // IPs from sign-in logs
    const ipMap = new Map<string, Entity>();
    data.signInLogs.forEach(log => {
      if (!log.ipAddress) return;
      const existing = ipMap.get(log.ipAddress);
      if (existing) {
        existing.incidents++;
      } else {
        ipMap.set(log.ipAddress, {
          id: log.ipAddress,
          type: 'ip',
          name: log.ipAddress,
          riskLevel: 'none',
          lastSeen: new Date(log.createdDateTime),
          incidents: 1,
          details: {
            location: `${log.location?.city || 'Unknown'}, ${log.location?.countryOrRegion || 'Unknown'}`,
            lastUser: log.userPrincipalName,
          },
        });
      }
    });
    result.push(...ipMap.values());

    return result;
  }, [data]);

  // Filter entities
  const filteredEntities = entities.filter(entity => {
    if (entityFilter !== 'all' && entity.type !== entityFilter) return false;
    if (searchQuery && !entity.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Sort by risk level and incidents
  const sortedEntities = filteredEntities.sort((a, b) => {
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
    if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    }
    return b.incidents - a.incidents;
  });

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'user': return User;
      case 'device': return Laptop;
      case 'ip': return Globe;
      default: return Target;
    }
  };

  const getEntityTypeLabel = (type: string) => {
    switch (type) {
      case 'user': return 'Utilisateur';
      case 'device': return 'Appareil';
      case 'ip': return 'Adresse IP';
      default: return type;
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'text-critical bg-critical/10 border-critical/30';
      case 'high': return 'text-high bg-high/10 border-high/30';
      case 'medium': return 'text-medium bg-medium/10 border-medium/30';
      case 'low': return 'text-low bg-low/10 border-low/30';
      default: return 'text-muted-foreground bg-muted/30 border-border';
    }
  };

  if (!isConfigured) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="card-soc p-8 text-center">
          <WifiOff className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Configuration Requise</h2>
          <p className="text-muted-foreground mb-6">
            Configurez votre App Registration dans les Paramètres pour utiliser l'investigation.
          </p>
        </div>
      </div>
    );
  }

  // Detail view for selected entity
  if (selectedEntity) {
    const EntityIcon = getEntityIcon(selectedEntity.type);
    const relatedSignIns = data.signInLogs.filter(log => 
      selectedEntity.type === 'user' ? log.userPrincipalName === selectedEntity.name :
      selectedEntity.type === 'ip' ? log.ipAddress === selectedEntity.name : false
    ).slice(0, 10);

    const relatedIncidents = data.incidents.filter(inc => 
      inc.description?.toLowerCase().includes(selectedEntity.name.toLowerCase())
    ).slice(0, 5);

    return (
      <div className="space-y-6 animate-fade-in">
        <Button variant="outline" onClick={() => setSelectedEntity(null)}>
          ← Retour à la liste
        </Button>

        {/* Entity Header */}
        <div className="card-soc p-6">
          <div className="flex items-start gap-4">
            <div className={cn('p-4 rounded-xl', getRiskColor(selectedEntity.riskLevel))}>
              <EntityIcon className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold">{selectedEntity.name}</h1>
                <span className={cn(
                  'px-3 py-1 rounded-full text-sm font-medium border',
                  getRiskColor(selectedEntity.riskLevel)
                )}>
                  {selectedEntity.riskLevel === 'none' ? 'Sain' : `Risque ${selectedEntity.riskLevel}`}
                </span>
              </div>
              <p className="text-muted-foreground">{getEntityTypeLabel(selectedEntity.type)}</p>
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Dernière activité: {formatDistanceToNow(selectedEntity.lastSeen, { addSuffix: true, locale: fr })}
                </span>
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {selectedEntity.incidents} événement(s)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Entity Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card-soc p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Détails
            </h3>
            <div className="space-y-2">
              {Object.entries(selectedEntity.details).map(([key, value]) => (
                <div key={key} className="flex justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="text-muted-foreground capitalize">{key}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card-soc p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Statistiques
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <p className="text-2xl font-bold text-primary">{relatedSignIns.length}</p>
                <p className="text-xs text-muted-foreground">Connexions</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <p className="text-2xl font-bold text-high">{relatedIncidents.length}</p>
                <p className="text-xs text-muted-foreground">Incidents</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <p className="text-2xl font-bold text-low">
                  {relatedSignIns.filter(s => s.status.errorCode === 0).length}
                </p>
                <p className="text-xs text-muted-foreground">Succès</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <p className="text-2xl font-bold text-critical">
                  {relatedSignIns.filter(s => s.status.errorCode !== 0).length}
                </p>
                <p className="text-xs text-muted-foreground">Échecs</p>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="card-soc p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Activité récente
          </h3>
          <div className="space-y-3">
            {relatedSignIns.length > 0 ? relatedSignIns.map((log, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <div className={cn(
                  'p-2 rounded-full',
                  log.status.errorCode === 0 ? 'bg-low/20' : 'bg-critical/20'
                )}>
                  {log.status.errorCode === 0 ? (
                    <CheckCircle className="w-4 h-4 text-low" />
                  ) : (
                    <XCircle className="w-4 h-4 text-critical" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium">
                    {log.status.errorCode === 0 ? 'Connexion réussie' : 'Échec de connexion'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {log.appDisplayName} • {log.ipAddress}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(log.createdDateTime), 'dd MMM yyyy HH:mm', { locale: fr })}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-muted-foreground text-center py-4">Aucune activité récente</p>
            )}
          </div>
        </div>

        {/* Related Incidents */}
        {relatedIncidents.length > 0 && (
          <div className="card-soc p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Incidents liés
            </h3>
            <div className="space-y-2">
              {relatedIncidents.map((inc) => (
                <div key={inc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <SeverityBadge severity={inc.severity as any} />
                  <div className="flex-1">
                    <p className="font-medium">{inc.displayName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(inc.createdDateTime), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Investigation</h1>
          <p className="text-muted-foreground text-sm">
            Explorez et analysez les entités de votre environnement
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refreshAll()} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Actualiser
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-soc p-4 text-center">
          <User className="w-6 h-6 mx-auto text-primary mb-2" />
          <p className="text-2xl font-bold">{entities.filter(e => e.type === 'user').length}</p>
          <p className="text-sm text-muted-foreground">Utilisateurs</p>
        </div>
        <div className="card-soc p-4 text-center">
          <Laptop className="w-6 h-6 mx-auto text-primary mb-2" />
          <p className="text-2xl font-bold">{entities.filter(e => e.type === 'device').length}</p>
          <p className="text-sm text-muted-foreground">Appareils</p>
        </div>
        <div className="card-soc p-4 text-center">
          <Globe className="w-6 h-6 mx-auto text-primary mb-2" />
          <p className="text-2xl font-bold">{entities.filter(e => e.type === 'ip').length}</p>
          <p className="text-sm text-muted-foreground">Adresses IP</p>
        </div>
        <div className="card-soc p-4 text-center">
          <AlertTriangle className="w-6 h-6 mx-auto text-high mb-2" />
          <p className="text-2xl font-bold text-high">
            {entities.filter(e => e.riskLevel !== 'none').length}
          </p>
          <p className="text-sm text-muted-foreground">À risque</p>
        </div>
      </div>

      {/* Tabs for Investigation Tools */}
      <Tabs defaultValue="entities" className="space-y-4">
        <TabsList className="bg-muted/30">
          <TabsTrigger value="entities">
            <Target className="w-4 h-4 mr-2" />
            Entités
          </TabsTrigger>
          <TabsTrigger value="hunting">
            <Crosshair className="w-4 h-4 mr-2" />
            Threat Hunting
          </TabsTrigger>
          <TabsTrigger value="export">
            <Download className="w-4 h-4 mr-2" />
            Export
          </TabsTrigger>
        </TabsList>

        {/* Entities Tab */}
        <TabsContent value="entities" className="space-y-4">

      {/* Search & Filters */}
      <div className="card-soc p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une entité (utilisateur, appareil, IP)..."
            className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div className="flex gap-2">
          {[
            { value: 'all', label: 'Tous', icon: Target },
            { value: 'user', label: 'Utilisateurs', icon: User },
            { value: 'device', label: 'Appareils', icon: Laptop },
            { value: 'ip', label: 'Adresses IP', icon: Globe },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setEntityFilter(filter.value as EntityType)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                entityFilter === filter.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              <filter.icon className="w-4 h-4" />
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="text-sm text-muted-foreground">
        {sortedEntities.length} entité(s) trouvée(s)
      </div>

      {/* Entities List */}
      <div className="space-y-3">
        {isLoading && entities.length === 0 ? (
          <div className="card-soc p-12 text-center">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Chargement des données...</p>
          </div>
        ) : sortedEntities.length > 0 ? (
          sortedEntities.map((entity) => {
            const EntityIcon = getEntityIcon(entity.type);
            return (
              <div
                key={`${entity.type}-${entity.id}`}
                onClick={() => setSelectedEntity(entity)}
                className="card-soc p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={cn('p-3 rounded-lg', getRiskColor(entity.riskLevel))}>
                    <EntityIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{entity.name}</h3>
                      <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                        {getEntityTypeLabel(entity.type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span>{entity.incidents} événement(s)</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(entity.lastSeen, { addSuffix: true, locale: fr })}</span>
                    </div>
                  </div>
                  {entity.riskLevel !== 'none' && (
                    <span className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium border',
                      getRiskColor(entity.riskLevel)
                    )}>
                      {entity.riskLevel}
                    </span>
                  )}
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            );
          })
        ) : (
          <div className="card-soc p-12 text-center">
            <p className="text-muted-foreground">Aucune entité trouvée</p>
          </div>
        )}
      </div>
        </TabsContent>

        {/* Threat Hunting Tab */}
        <TabsContent value="hunting" className="space-y-4">
          <div className="card-soc p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-primary" />
              Recherche d'IOCs (Indicateurs de Compromission)
            </h3>
            <div className="flex gap-4 mb-4">
              <div className="relative flex-1">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={iocQuery}
                  onChange={(e) => setIocQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleIocSearch()}
                  placeholder="Entrez une IP, domaine ou hash (MD5, SHA1, SHA256)..."
                  className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <Button onClick={handleIocSearch} disabled={iocLoading || !iocQuery.trim()}>
                {iocLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                Rechercher
              </Button>
            </div>
            <div className="text-sm text-muted-foreground mb-4">
              <p>Recherchez des indicateurs de compromission dans Microsoft Defender TI:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Adresses IP (ex: 192.168.1.1)</li>
                <li>Noms de domaine (ex: malicious.com)</li>
                <li>Hash de fichiers MD5/SHA1/SHA256</li>
              </ul>
            </div>
            {iocResults.length > 0 ? (
              <div className="space-y-3">
                {iocResults.map((ioc) => (
                  <div key={ioc.id} className="p-4 rounded-lg bg-critical/10 border border-critical/30">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-critical">{ioc.threatType || 'Menace détectée'}</p>
                        <p className="text-sm text-muted-foreground">{ioc.description}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {ioc.networkDestinationIPv4 && (
                            <span className="px-2 py-0.5 bg-muted rounded text-xs">IP: {ioc.networkDestinationIPv4}</span>
                          )}
                          {ioc.domainName && (
                            <span className="px-2 py-0.5 bg-muted rounded text-xs">Domaine: {ioc.domainName}</span>
                          )}
                          {ioc.fileHashValue && (
                            <span className="px-2 py-0.5 bg-muted rounded text-xs font-mono">{ioc.fileHashType}: {ioc.fileHashValue}</span>
                          )}
                        </div>
                      </div>
                      <span className={cn('px-2 py-0.5 rounded text-xs', 
                        ioc.action === 'block' ? 'bg-critical/20 text-critical' : 'bg-high/20 text-high'
                      )}>
                        {ioc.action}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : iocQuery && !iocLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-low opacity-50" />
                <p>Aucun indicateur trouvé pour cette recherche</p>
              </div>
            ) : null}
          </div>
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-4">
          <div className="card-soc p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" />
              Exporter les données
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Exportez les données de votre SOC pour analyse externe ou archivage.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sign-ins Export */}
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-3 mb-3">
                  <Globe className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">Connexions</p>
                    <p className="text-sm text-muted-foreground">{data.signInLogs.length} entrées</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => exportToCSV('signins')}>
                    <FileText className="w-4 h-4 mr-2" />CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportToJSON('signins')}>
                    <FileText className="w-4 h-4 mr-2" />JSON
                  </Button>
                </div>
              </div>

              {/* Incidents Export */}
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-3 mb-3">
                  <Shield className="w-5 h-5 text-high" />
                  <div>
                    <p className="font-medium">Incidents</p>
                    <p className="text-sm text-muted-foreground">{data.incidents.length} entrées</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => exportToCSV('incidents')}>
                    <FileText className="w-4 h-4 mr-2" />CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportToJSON('incidents')}>
                    <FileText className="w-4 h-4 mr-2" />JSON
                  </Button>
                </div>
              </div>

              {/* Devices Export */}
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-3 mb-3">
                  <Laptop className="w-5 h-5 text-low" />
                  <div>
                    <p className="font-medium">Appareils</p>
                    <p className="text-sm text-muted-foreground">{data.devices.length} entrées</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => exportToCSV('devices')}>
                    <FileText className="w-4 h-4 mr-2" />CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportToJSON('devices')}>
                    <FileText className="w-4 h-4 mr-2" />JSON
                  </Button>
                </div>
              </div>

              {/* Users Export */}
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-3 mb-3">
                  <User className="w-5 h-5 text-medium" />
                  <div>
                    <p className="font-medium">Utilisateurs</p>
                    <p className="text-sm text-muted-foreground">{data.users.length} entrées</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => exportToCSV('users')}>
                    <FileText className="w-4 h-4 mr-2" />CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportToJSON('users')}>
                    <FileText className="w-4 h-4 mr-2" />JSON
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
