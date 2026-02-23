import { useState, useEffect } from 'react';
import { SeverityBadge } from './SeverityBadge';
import { IncidentDetailDrawer } from './IncidentDetailDrawer';
import { useSOC } from '@/context/SOCContext';
import { GraphIncident, getIncidentDetails } from '@/services/graphApi';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, RefreshCw, Loader2, AlertTriangle, WifiOff,
  User, ChevronRight, Bell, Timer, UserCheck, UserX, Clock,
  CheckSquare, X, Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format, differenceInHours } from 'date-fns';
import { fr } from 'date-fns/locale';

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'informational' | 'unknown' | 'all';
type Status = 'active' | 'resolved' | 'redirected' | 'unknown' | 'all';
type QueueView = 'all' | 'my' | 'unassigned' | 'sla-breach';

export function IncidentsView() {
  const { isConfigured, isLoading, data, refreshIncidents, config } = useSOC();
  const [severityFilter, setSeverityFilter] = useState<Severity>('all');
  const [statusFilter, setStatusFilter] = useState<Status>('all');
  const [selectedIncident, setSelectedIncident] = useState<GraphIncident | null>(null);
  const [incidentDetails, setIncidentDetails] = useState<GraphIncident | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [queueView, setQueueView] = useState<QueueView>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Open drawer when incident selected
  const handleSelectIncident = (incident: GraphIncident) => {
    setSelectedIncident(incident);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => setSelectedIncident(null), 300);
  };

  // Toggle selection for bulk actions
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredIncidents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIncidents.map(i => i.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Calculate SLA info for an incident
  const getSlaInfo = (incident: GraphIncident) => {
    const createdAt = new Date(incident.createdDateTime);
    const hoursOld = differenceInHours(new Date(), createdAt);
    const slaThresholds: Record<string, number> = { critical: 1, high: 4, medium: 24, low: 72 };
    const threshold = slaThresholds[incident.severity] || 24;
    return { hoursOld, threshold, isBreached: hoursOld > threshold };
  };

  // Fetch full incident details when selected
  useEffect(() => {
    if (selectedIncident && config) {
      setLoadingDetails(true);
      getIncidentDetails(config, selectedIncident.id)
        .then(details => {
          setIncidentDetails(details);
        })
        .catch(err => {
          console.error('Failed to fetch incident details:', err);
          setIncidentDetails(selectedIncident);
        })
        .finally(() => setLoadingDetails(false));
    } else {
      setIncidentDetails(null);
    }
  }, [selectedIncident, config]);

  const filteredIncidents = data.incidents.filter((incident) => {
    if (severityFilter !== 'all' && incident.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && incident.status !== statusFilter) return false;
    if (searchQuery && !incident.displayName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const severities: Severity[] = ['all', 'critical', 'high', 'medium', 'low'];
  const statuses: Status[] = ['all', 'active', 'resolved'];

  const severityLabels: Record<string, string> = {
    all: 'Toutes',
    critical: 'Critique',
    high: 'Élevée',
    medium: 'Moyenne',
    low: 'Faible',
    informational: 'Info',
    unknown: 'Inconnu',
  };

  const statusLabels: Record<string, string> = {
    all: 'Tous',
    active: 'Actif',
    resolved: 'Résolu',
    redirected: 'Redirigé',
    unknown: 'Inconnu',
  };

  if (!isConfigured) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="card-soc p-8 text-center">
          <WifiOff className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Configuration Requise</h2>
          <p className="text-muted-foreground mb-6">
            Configurez votre App Registration dans les Paramètres pour voir les incidents.
          </p>
        </div>
      </div>
    );
  }

  const getClassificationLabel = (classification?: string) => {
    const labels: Record<string, string> = {
      truePositive: 'Vrai positif',
      falsePositive: 'Faux positif',
      benignPositive: 'Positif bénin',
      unknown: 'Non classifié',
    };
    return labels[classification || ''] || classification || 'Non classifié';
  };

  const getDeterminationLabel = (determination?: string) => {
    const labels: Record<string, string> = {
      malware: 'Malware',
      phishing: 'Phishing',
      compromisedUser: 'Utilisateur compromis',
      unwantedSoftware: 'Logiciel indésirable',
      securityTesting: 'Test de sécurité',
      lineOfBusinessApplication: 'Application métier',
      confirmedUserActivity: 'Activité utilisateur confirmée',
      multiStagedAttack: 'Attaque multi-étapes',
      other: 'Autre',
      unknown: 'Inconnu',
    };
    return labels[determination || ''] || determination || 'Non déterminé';
  };

  const getAlertSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'high': return 'text-high bg-high/20';
      case 'medium': return 'text-medium bg-medium/20';
      case 'low': return 'text-low bg-low/20';
      case 'informational': return 'text-muted-foreground bg-muted';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  // Extract entities from all alert evidence
  const extractEntities = (incident: GraphIncident) => {
    const users: { upn: string; account?: string; domain?: string }[] = [];
    const ips: { address: string; country?: string }[] = [];
    const devices: { name: string; id?: string }[] = [];
    const emails: { sender?: string; recipient?: string; subject?: string }[] = [];
    const urls: string[] = [];
    const files: { name: string; path?: string; hash?: string }[] = [];

    const seenUsers = new Set<string>();
    const seenIps = new Set<string>();
    const seenDevices = new Set<string>();

    incident.alerts?.forEach(alert => {
      alert.evidence?.forEach(ev => {
        if (ev.userAccount?.userPrincipalName && !seenUsers.has(ev.userAccount.userPrincipalName)) {
          seenUsers.add(ev.userAccount.userPrincipalName);
          users.push({ upn: ev.userAccount.userPrincipalName, account: ev.userAccount.accountName, domain: ev.userAccount.domainName });
        }
        if (ev.ipAddress && !seenIps.has(ev.ipAddress)) {
          seenIps.add(ev.ipAddress);
          ips.push({ address: ev.ipAddress, country: ev.countryLetterCode });
        }
        if (ev.deviceDnsName && !seenDevices.has(ev.deviceDnsName)) {
          seenDevices.add(ev.deviceDnsName);
          devices.push({ name: ev.deviceDnsName, id: ev.mdeDeviceId || ev.azureAdDeviceId });
        }
        if (ev.senderEmailAddress || ev.recipientEmailAddress) {
          emails.push({ sender: ev.senderEmailAddress, recipient: ev.recipientEmailAddress, subject: ev.emailSubject });
        }
        if (ev.url && !urls.includes(ev.url)) urls.push(ev.url);
        if (ev.fileName) files.push({ name: ev.fileName, path: ev.filePath, hash: ev.fileHash?.value });
      });
    });
    return { users, ips, devices, emails, urls, files };
  };

  // Queue-filtered incidents
  const queueFilteredIncidents = filteredIncidents.filter((incident) => {
    if (queueView === 'my') return incident.assignedTo?.includes('@'); // Simplified check
    if (queueView === 'unassigned') return !incident.assignedTo;
    if (queueView === 'sla-breach') return getSlaInfo(incident).isBreached;
    return true;
  });

  // Count for queue badges
  const queueCounts = {
    all: filteredIncidents.length,
    unassigned: filteredIncidents.filter(i => !i.assignedTo).length,
    slaBreach: filteredIncidents.filter(i => getSlaInfo(i).isBreached).length,
  };

  return (
    <>
      {/* Incident Detail Drawer */}
      <IncidentDetailDrawer
        incident={selectedIncident}
        incidentDetails={incidentDetails}
        isLoading={loadingDetails}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onRefresh={refreshIncidents}
      />
      
      <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Incidents</h1>
          <p className="text-muted-foreground text-sm">
            Incidents de sécurité Microsoft Defender XDR
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refreshIncidents()} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Actualiser
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="card-soc p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un incident..."
            className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          {/* Severity Filter */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Sévérité
            </label>
            <div className="flex gap-1">
              {severities.map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={cn(
                    'px-3 py-1 rounded text-xs font-medium transition-colors',
                    severityFilter === sev
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  )}
                >
                  {severityLabels[sev]}
                </button>
              ))}
            </div>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Statut
            </label>
            <div className="flex gap-1">
              {statuses.map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    'px-3 py-1 rounded text-xs font-medium transition-colors',
                    statusFilter === status
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  )}
                >
                  {statusLabels[status]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Queue View Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setQueueView('all')}
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t transition-colors',
            queueView === 'all' ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Tous
          <span className="px-1.5 py-0.5 rounded bg-muted text-xs">{queueCounts.all}</span>
        </button>
        <button
          onClick={() => setQueueView('my')}
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t transition-colors',
            queueView === 'my' ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <UserCheck className="w-4 h-4" />
          Mes incidents
        </button>
        <button
          onClick={() => setQueueView('unassigned')}
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t transition-colors',
            queueView === 'unassigned' ? 'bg-medium/10 text-medium border-b-2 border-medium' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <UserX className="w-4 h-4" />
          Non assignés
          {queueCounts.unassigned > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-medium/20 text-medium text-xs">{queueCounts.unassigned}</span>
          )}
        </button>
        <button
          onClick={() => setQueueView('sla-breach')}
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t transition-colors',
            queueView === 'sla-breach' ? 'bg-critical/10 text-critical border-b-2 border-critical' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Timer className="w-4 h-4" />
          SLA dépassé
          {queueCounts.slaBreach > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-critical/20 text-critical text-xs animate-pulse">{queueCounts.slaBreach}</span>
          )}
        </button>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/30 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8" onClick={() => {/* TODO: Assign */}}>
              <User className="w-3 h-3 mr-1" />
              Assigner
            </Button>
            <Button size="sm" variant="outline" className="h-8 border-low text-low hover:bg-low/10" onClick={() => {/* TODO: Resolve */}}>
              <Clock className="w-3 h-3 mr-1" />
              Résoudre
            </Button>
            <Button size="sm" variant="outline" className="h-8 border-critical text-critical hover:bg-critical/10" onClick={() => {/* TODO: Close as FP */}}>
              <X className="w-3 h-3 mr-1" />
              Faux Positif
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={clearSelection}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      {/* Results Count with Select All */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={selectedIds.size === queueFilteredIncidents.length && queueFilteredIncidents.length > 0}
            onCheckedChange={selectAll}
            aria-label="Sélectionner tout"
          />
          <span className="text-muted-foreground">
            {queueFilteredIncidents.length} incident{queueFilteredIncidents.length !== 1 ? 's' : ''} trouvé{queueFilteredIncidents.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Incidents List */}
      <div className="space-y-3">
        {isLoading && data.incidents.length === 0 ? (
          <div className="card-soc p-12 text-center">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Chargement des incidents...</p>
          </div>
        ) : queueFilteredIncidents.length > 0 ? (
          queueFilteredIncidents.map((incident) => {
            const slaInfo = getSlaInfo(incident);
            // Extract affected users from alerts evidence
            const affectedUsers = new Set<string>();
            const serviceSources = new Set<string>();
            incident.alerts?.forEach(alert => {
              if (alert.serviceSource) serviceSources.add(alert.serviceSource);
              alert.evidence?.forEach(ev => {
                if (ev.userAccount?.userPrincipalName) {
                  affectedUsers.add(ev.userAccount.userPrincipalName);
                }
              });
            });
            
            return (
            <div
              key={incident.id}
              className={cn(
                "card-soc p-4 cursor-pointer hover:bg-muted/50 transition-colors group",
                selectedIds.has(incident.id) && "bg-primary/5 border-primary/30"
              )}
            >
              <div className="flex items-start gap-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedIds.has(incident.id)}
                    onCheckedChange={() => toggleSelection(incident.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Sélectionner ${incident.displayName}`}
                  />
                  <div onClick={() => handleSelectIncident(incident)}>
                    <SeverityBadge severity={incident.severity as any} />
                  </div>
                </div>
                <div className="flex-1 min-w-0" onClick={() => handleSelectIncident(incident)}>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      #{incident.id.slice(-6)}
                    </span>
                    <h3 className="font-semibold truncate">{incident.displayName}</h3>
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs shrink-0',
                      incident.status === 'active' && 'bg-critical/20 text-critical',
                      incident.status === 'resolved' && 'bg-low/20 text-low'
                    )}>
                      {statusLabels[incident.status] || incident.status}
                    </span>
                    {incident.classification && (
                      <span className="px-2 py-0.5 rounded text-xs bg-primary/20 text-primary shrink-0">
                        {getClassificationLabel(incident.classification)}
                      </span>
                    )}
                    {/* SLA Indicator */}
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs shrink-0 flex items-center gap-1',
                      slaInfo.isBreached ? 'bg-critical/20 text-critical' : 'bg-low/20 text-low'
                    )}>
                      <Timer className="w-3 h-3" />
                      {slaInfo.isBreached ? `+${slaInfo.hoursOld - slaInfo.threshold}h` : `${slaInfo.threshold - slaInfo.hoursOld}h`}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                    {incident.description || 'Pas de description disponible'}
                  </p>
                  
                  {/* Detailed info row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-2 text-xs">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">Créé</span>
                      <span className="font-medium">{format(new Date(incident.createdDateTime), 'dd/MM/yyyy HH:mm', { locale: fr })}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">Dernière MAJ</span>
                      <span className="font-medium">{format(new Date(incident.lastUpdateDateTime), 'dd/MM/yyyy HH:mm', { locale: fr })}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">Alertes</span>
                      <span className="font-medium text-high">{incident.alerts?.length || 0}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">Utilisateurs</span>
                      <span className="font-medium">{affectedUsers.size > 0 ? affectedUsers.size : '-'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">Sources</span>
                      <span className="font-medium truncate">{serviceSources.size > 0 ? Array.from(serviceSources).join(', ') : '-'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">Assigné à</span>
                      <span className="font-medium truncate">{incident.assignedTo || '-'}</span>
                    </div>
                  </div>
                  
                  {/* Affected users preview */}
                  {affectedUsers.size > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <User className="w-3 h-3 text-muted-foreground" />
                      {Array.from(affectedUsers).slice(0, 3).map((user, idx) => (
                        <span key={idx} className="text-xs px-2 py-0.5 bg-muted rounded truncate max-w-[200px]">
                          {user}
                        </span>
                      ))}
                      {affectedUsers.size > 3 && (
                        <span className="text-xs text-muted-foreground">+{affectedUsers.size - 3} autres</span>
                      )}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
              </div>
            </div>
          );
          })
        ) : (
          <div className="card-soc p-12 text-center">
            <p className="text-muted-foreground">
              {data.incidents.length === 0 
                ? 'Aucun incident trouvé dans votre tenant' 
                : 'Aucun incident ne correspond aux filtres sélectionnés'}
            </p>
          </div>
        )}
        </div>
    </div>
    </>
  );
}
