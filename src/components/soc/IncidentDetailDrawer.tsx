import { useState } from 'react';
import { GraphIncident, updateIncidentStatus, updateIncidentClassification, AlertEvidence } from '@/services/graphApi';
import { useSOC } from '@/context/SOCContext';
import { SeverityBadge } from './SeverityBadge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription 
} from '@/components/ui/sheet';
import { 
  ExternalLink, Loader2, AlertTriangle, User, Clock, Shield, Tag, 
  MessageSquare, FileText, Bell, Target, Calendar, CheckCircle, XCircle, 
  Globe, Monitor, Mail, Link, FileCode, Timer, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format, differenceInHours } from 'date-fns';
import { fr } from 'date-fns/locale';

interface IncidentDetailDrawerProps {
  incident: GraphIncident | null;
  incidentDetails: GraphIncident | null;
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function IncidentDetailDrawer({
  incident,
  incidentDetails,
  isLoading,
  isOpen,
  onClose,
  onRefresh,
}: IncidentDetailDrawerProps) {
  const { config } = useSOC();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const data = incidentDetails || incident;

  const handleResolveIncident = async () => {
    if (!config || !data) return;
    setActionLoading('resolve');
    try {
      await updateIncidentStatus(config, data.id, 'resolved');
      onRefresh();
    } catch (error) {
      console.error('Failed to resolve incident:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleClassifyIncident = async (classification: string, determination?: string) => {
    if (!config || !data) return;
    setActionLoading('classify');
    try {
      await updateIncidentClassification(config, data.id, classification, determination);
      onRefresh();
    } catch (error) {
      console.error('Failed to classify incident:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const statusLabels: Record<string, string> = {
    active: 'Actif',
    resolved: 'Résolu',
    redirected: 'Redirigé',
    inProgress: 'En cours',
    unknown: 'Inconnu',
  };

  const getClassificationLabel = (classification: string) => {
    const labels: Record<string, string> = {
      truePositive: 'Vrai Positif',
      falsePositive: 'Faux Positif',
      benignPositive: 'Bénin',
      informationalExpectedActivity: 'Activité attendue',
    };
    return labels[classification] || classification;
  };

  const getDeterminationLabel = (determination: string) => {
    const labels: Record<string, string> = {
      malware: 'Malware',
      phishing: 'Phishing',
      securityTesting: 'Test sécurité',
      unwantedSoftware: 'Logiciel indésirable',
      multiStagedAttack: 'Attaque multi-étapes',
      lineOfBusinessApplication: 'App métier',
      confirmedUserActivity: 'Activité utilisateur',
      other: 'Autre',
    };
    return labels[determination] || determination;
  };

  // Extract entities from all alert evidence
  const extractEntities = (inc: GraphIncident) => {
    const users: { upn: string; account?: string; domain?: string }[] = [];
    const ips: { address: string; country?: string }[] = [];
    const devices: { name: string; id?: string }[] = [];
    const emails: { sender?: string; recipient?: string; subject?: string }[] = [];
    const urls: string[] = [];
    const files: { name: string; path?: string; hash?: string }[] = [];

    const seenUsers = new Set<string>();
    const seenIps = new Set<string>();
    const seenDevices = new Set<string>();

    inc.alerts?.forEach(alert => {
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

  // Calculate SLA aging
  const getSlaInfo = (inc: GraphIncident) => {
    const createdAt = new Date(inc.createdDateTime);
    const hoursOld = differenceInHours(new Date(), createdAt);
    const slaThresholds = {
      critical: 1,
      high: 4,
      medium: 24,
      low: 72,
    };
    const threshold = slaThresholds[inc.severity as keyof typeof slaThresholds] || 24;
    const isBreached = hoursOld > threshold;
    const remainingHours = threshold - hoursOld;
    return { hoursOld, threshold, isBreached, remainingHours };
  };

  if (!data) return null;

  const entities = extractEntities(data);
  const entityCount = entities.users.length + entities.ips.length + entities.devices.length + entities.emails.length;
  const slaInfo = getSlaInfo(data);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 flex flex-col">
        <SheetHeader className="p-4 border-b bg-card/50">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <SeverityBadge severity={data.severity as any} />
                <span className={cn(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  data.status === 'active' && 'bg-critical/20 text-critical',
                  data.status === 'resolved' && 'bg-low/20 text-low',
                  data.status === 'redirected' && 'bg-medium/20 text-medium'
                )}>
                  {statusLabels[data.status] || data.status}
                </span>
                {data.classification && (
                  <span className="px-2 py-0.5 rounded text-xs bg-primary/20 text-primary">
                    {getClassificationLabel(data.classification)}
                  </span>
                )}
                {/* SLA indicator */}
                <span className={cn(
                  'px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1',
                  slaInfo.isBreached ? 'bg-critical/20 text-critical' : 'bg-low/20 text-low'
                )}>
                  <Timer className="w-3 h-3" />
                  {slaInfo.isBreached 
                    ? `SLA dépassé (${slaInfo.hoursOld}h)` 
                    : `${slaInfo.remainingHours}h restantes`}
                </span>
              </div>
              <SheetTitle className="text-left line-clamp-2">{data.displayName}</SheetTitle>
              <SheetDescription className="text-left">
                ID: {data.id} • Créé {formatDistanceToNow(new Date(data.createdDateTime), { addSuffix: true, locale: fr })}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="p-4 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Quick Actions */}
              <div className="flex items-center gap-2 flex-wrap p-3 bg-muted/30 rounded-lg border">
                {data.status === 'active' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleResolveIncident}
                    disabled={actionLoading === 'resolve'}
                    className="border-low text-low hover:bg-low/10"
                  >
                    {actionLoading === 'resolve' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Résoudre
                  </Button>
                )}
                {!data.classification && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleClassifyIncident('truePositive', 'malware')}
                      disabled={actionLoading === 'classify'}
                      className="border-critical text-critical hover:bg-critical/10"
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Vrai Positif
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleClassifyIncident('falsePositive')}
                      disabled={actionLoading === 'classify'}
                      className="border-medium text-medium hover:bg-medium/10"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Faux Positif
                    </Button>
                  </>
                )}
                <a
                  href={data.incidentWebUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
                >
                  <ExternalLink className="w-4 h-4" />
                  Defender
                </a>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Bell className="w-4 h-4" />
                    <span className="text-xs">Alertes</span>
                  </div>
                  <span className="text-xl font-bold">{data.alerts?.length || 0}</span>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Target className="w-4 h-4" />
                    <span className="text-xs">Entités</span>
                  </div>
                  <span className="text-xl font-bold">{entityCount}</span>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs">Âge</span>
                  </div>
                  <span className="text-xl font-bold">{slaInfo.hoursOld}h</span>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <User className="w-4 h-4" />
                    <span className="text-xs">Assigné</span>
                  </div>
                  <span className="text-sm font-medium truncate">{data.assignedTo || 'Non assigné'}</span>
                </div>
              </div>

              {/* Tabs Content */}
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="overview" className="text-xs">Vue d'ensemble</TabsTrigger>
                  <TabsTrigger value="alerts" className="text-xs">Alertes ({data.alerts?.length || 0})</TabsTrigger>
                  <TabsTrigger value="entities" className="text-xs">Entités ({entityCount})</TabsTrigger>
                  <TabsTrigger value="activity" className="text-xs">Activité</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 mt-4">
                  <div className="p-3 bg-muted/30 rounded-lg border">
                    <h4 className="text-sm font-medium mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground">
                      {data.description || 'Pas de description disponible'}
                    </p>
                  </div>

                  {/* Timeline */}
                  <div className="p-3 bg-muted/30 rounded-lg border">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Timeline
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                        <div>
                          <p className="text-sm font-medium">Création</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(data.createdDateTime), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground mt-1.5" />
                        <div>
                          <p className="text-sm font-medium">Dernière mise à jour</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(data.lastUpdateDateTime), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Affected Users Preview */}
                  {entities.users.length > 0 && (
                    <div className="p-3 bg-muted/30 rounded-lg border">
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Utilisateurs affectés
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {entities.users.slice(0, 5).map((user, idx) => (
                          <span key={idx} className="px-2 py-1 bg-background rounded text-xs font-mono">
                            {user.upn}
                          </span>
                        ))}
                        {entities.users.length > 5 && (
                          <span className="px-2 py-1 text-xs text-muted-foreground">
                            +{entities.users.length - 5} autres
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="alerts" className="space-y-3 mt-4">
                  {data.alerts?.map((alert, idx) => (
                    <div key={idx} className="p-3 bg-muted/30 rounded-lg border">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="text-sm font-medium line-clamp-2">{alert.title}</h4>
                        <span className={cn(
                          'px-2 py-0.5 rounded text-xs shrink-0',
                          alert.severity === 'high' && 'bg-high/20 text-high',
                          alert.severity === 'medium' && 'bg-medium/20 text-medium',
                          alert.severity === 'low' && 'bg-low/20 text-low'
                        )}>
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{alert.description}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(alert.createdDateTime), 'dd/MM HH:mm', { locale: fr })}
                        </span>
                        {alert.serviceSource && (
                          <span className="px-1.5 py-0.5 bg-muted rounded">{alert.serviceSource}</span>
                        )}
                        {alert.category && (
                          <span className="px-1.5 py-0.5 bg-muted rounded">{alert.category}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="entities" className="space-y-3 mt-4">
                  {entities.users.length > 0 && (
                    <div className="p-3 bg-muted/30 rounded-lg border">
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <User className="w-4 h-4 text-primary" />
                        Utilisateurs ({entities.users.length})
                      </h4>
                      <div className="space-y-2">
                        {entities.users.map((user, idx) => (
                          <div key={idx} className="p-2 bg-background rounded text-sm font-mono">
                            {user.upn}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {entities.ips.length > 0 && (
                    <div className="p-3 bg-muted/30 rounded-lg border">
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-high" />
                        Adresses IP ({entities.ips.length})
                      </h4>
                      <div className="space-y-2">
                        {entities.ips.map((ip, idx) => (
                          <div key={idx} className="p-2 bg-background rounded flex items-center justify-between">
                            <span className="text-sm font-mono">{ip.address}</span>
                            {ip.country && <span className="text-xs text-muted-foreground">{ip.country}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {entities.devices.length > 0 && (
                    <div className="p-3 bg-muted/30 rounded-lg border">
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-medium" />
                        Appareils ({entities.devices.length})
                      </h4>
                      <div className="space-y-2">
                        {entities.devices.map((device, idx) => (
                          <div key={idx} className="p-2 bg-background rounded text-sm font-mono">
                            {device.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="activity" className="space-y-3 mt-4">
                  {data.comments && data.comments.length > 0 ? (
                    data.comments.map((comment, idx) => (
                      <div key={idx} className="p-3 bg-muted/30 rounded-lg border">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {comment.createdBy?.user?.displayName || 'Système'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(comment.createdDateTime), 'dd/MM/yyyy HH:mm', { locale: fr })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{comment.comment}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Aucune activité enregistrée</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
