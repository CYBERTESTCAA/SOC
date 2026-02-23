import { useState } from 'react';
import { Incident, IncidentStatus } from '@/types/soc';
import { SeverityBadge } from './SeverityBadge';
import { SourceBadge } from './SourceBadge';
import { MitreBadge } from './MitreBadge';
import { IncidentTimeline } from './IncidentTimeline';
import { Entity360Card } from './Entity360Card';
import { RiskScoreGauge } from './RiskScoreGauge';
import { getStatusLabel } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, Clock, User, ExternalLink, Shield, 
  MessageSquare, Tag, AlertTriangle, CheckCircle2,
  XCircle, Pause, Play, RotateCcw, Send, Plus
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface IncidentDetailViewProps {
  incident: Incident;
  onBack: () => void;
}

export function IncidentDetailView({ incident, onBack }: IncidentDetailViewProps) {
  const [status, setStatus] = useState<IncidentStatus>(incident.status);
  const [assignee, setAssignee] = useState(incident.assignedTo || '');
  const [newComment, setNewComment] = useState('');
  const [newTag, setNewTag] = useState('');

  const statusOptions: { value: IncidentStatus; label: string; icon: any; color: string }[] = [
    { value: 'new', label: 'Nouveau', icon: AlertTriangle, color: 'text-primary' },
    { value: 'inProgress', label: 'En cours', icon: Play, color: 'text-high' },
    { value: 'pending', label: 'En attente', icon: Pause, color: 'text-medium' },
    { value: 'resolved', label: 'Résolu', icon: CheckCircle2, color: 'text-low' },
    { value: 'closed', label: 'Fermé', icon: XCircle, color: 'text-muted-foreground' },
    { value: 'falsePositive', label: 'Faux positif', icon: RotateCcw, color: 'text-info' },
  ];

  const quickActions = [
    { label: 'Isoler Device', icon: Shield, variant: 'destructive' as const },
    { label: 'Reset Password', icon: RotateCcw, variant: 'outline' as const },
    { label: 'Revoke Sessions', icon: XCircle, variant: 'outline' as const },
    { label: 'Ouvrir Defender', icon: ExternalLink, variant: 'outline' as const },
  ];

  // Create mock entities from affected entities
  const entities = [
    ...(incident.affectedEntities.users?.map((u, i) => ({
      type: 'user' as const,
      id: `user-${i}`,
      name: u,
      riskScore: incident.riskScore || 50,
      relatedIncidents: Math.floor(Math.random() * 5) + 1,
      relatedAlerts: Math.floor(Math.random() * 10) + 1,
      lastActivity: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
      details: { 'Email': u, 'Département': 'IT', 'MFA': 'Activé' },
    })) || []),
    ...(incident.affectedEntities.devices?.map((d, i) => ({
      type: 'device' as const,
      id: `device-${i}`,
      name: d,
      riskScore: Math.min((incident.riskScore || 50) - 10, 100),
      relatedIncidents: Math.floor(Math.random() * 3) + 1,
      relatedAlerts: Math.floor(Math.random() * 5) + 1,
      lastActivity: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
      details: { 'OS': 'Windows 11', 'Compliance': 'Conforme', 'BitLocker': 'Activé' },
    })) || []),
    ...(incident.affectedEntities.ips?.map((ip, i) => ({
      type: 'ip' as const,
      id: `ip-${i}`,
      name: ip,
      riskScore: Math.min((incident.riskScore || 50) + 10, 100),
      relatedIncidents: Math.floor(Math.random() * 8) + 1,
      relatedAlerts: Math.floor(Math.random() * 15) + 1,
      lastActivity: new Date(Date.now() - Math.random() * 60 * 60 * 1000),
      details: { 'Pays': 'Russie', 'ISP': 'Unknown', 'Réputation': 'Malicious' },
    })) || []),
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-sm text-muted-foreground">{incident.id}</span>
              <SeverityBadge severity={incident.severity} />
              <SourceBadge source={incident.source} />
              {incident.mitre && <MitreBadge mitre={incident.mitre} />}
            </div>
            <h1 className="text-2xl font-bold">{incident.title}</h1>
            <p className="text-muted-foreground mt-1">{incident.description}</p>
          </div>
        </div>
        
        {/* Risk Score */}
        {incident.riskScore && (
          <div className="flex-shrink-0">
            <RiskScoreGauge score={incident.riskScore} size="lg" />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="card-soc p-4">
        <div className="flex flex-wrap items-center gap-6">
          {/* Status */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Statut</label>
            <div className="flex gap-1">
              {statusOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setStatus(opt.value)}
                    className={cn(
                      'flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors',
                      status === opt.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assignee */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assigné à</label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="bg-muted/50 border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Non assigné</option>
              <option value="analyst@contoso.com">analyst@contoso.com</option>
              <option value="security@contoso.com">security@contoso.com</option>
              <option value="admin@contoso.com">admin@contoso.com</option>
            </select>
          </div>

          {/* SLA */}
          {incident.slaDeadline && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">SLA</label>
              <div className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium',
                incident.slaDeadline < new Date() ? 'bg-critical/20 text-critical' : 'bg-low/20 text-low'
              )}>
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(incident.slaDeadline, { addSuffix: true, locale: fr })}
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="space-y-1 flex-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tags</label>
            <div className="flex items-center gap-1 flex-wrap">
              {incident.tags?.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded bg-primary/20 text-primary text-xs">
                  {tag}
                </span>
              ))}
              <button className="p-1 rounded hover:bg-muted/50 text-muted-foreground">
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Button key={action.label} variant={action.variant} size="sm">
              <Icon className="w-4 h-4 mr-2" />
              {action.label}
            </Button>
          );
        })}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/30">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="entities">Entités ({entities.length})</TabsTrigger>
          <TabsTrigger value="alerts">Alertes ({incident.alerts?.length || 0})</TabsTrigger>
          <TabsTrigger value="comments">Commentaires ({incident.comments?.length || 0})</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Info Card */}
            <div className="card-soc p-4 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-primary" />
                Informations
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Créé le</span>
                  <p className="font-medium">{format(incident.createdAt, 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Mis à jour</span>
                  <p className="font-medium">{format(incident.updatedAt, 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Utilisateurs impactés</span>
                  <p className="font-medium">{incident.impactedUsersCount || incident.affectedEntities.users?.length || 0}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Appareils impactés</span>
                  <p className="font-medium">{incident.impactedDevicesCount || incident.affectedEntities.devices?.length || 0}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Confiance</span>
                  <p className={cn('font-medium capitalize', {
                    'text-low': incident.confidence === 'high',
                    'text-medium': incident.confidence === 'medium',
                    'text-high': incident.confidence === 'low',
                  })}>{incident.confidence || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Incidents liés</span>
                  <p className="font-medium">{incident.relatedIncidents?.length || 0}</p>
                </div>
              </div>
            </div>

            {/* Recommendations Card */}
            <div className="card-soc p-4 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Recommandations
              </h3>
              <ul className="space-y-2">
                {incident.recommendations?.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">
                      {idx + 1}
                    </span>
                    <span className="text-muted-foreground">{rec}</span>
                  </li>
                )) || <li className="text-muted-foreground text-sm">Aucune recommandation</li>}
              </ul>
            </div>
          </div>

          {/* Entity Preview */}
          <div className="card-soc p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Entités impactées
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {entities.slice(0, 3).map((entity) => (
                <Entity360Card key={entity.id} entity={entity} compact />
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <div className="card-soc p-4">
            <IncidentTimeline events={incident.timeline || []} />
          </div>
        </TabsContent>

        {/* Entities Tab */}
        <TabsContent value="entities">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entities.map((entity) => (
              <Entity360Card key={entity.id} entity={entity} />
            ))}
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <div className="card-soc p-4 space-y-3">
            {incident.alerts?.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border border-border/50"
              >
                <SeverityBadge severity={alert.severity} />
                <div className="flex-1">
                  <p className="font-medium text-sm">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(alert.timestamp, 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                  </p>
                </div>
                <span className={cn(
                  'px-2 py-0.5 rounded text-xs',
                  alert.status === 'active' ? 'bg-high/20 text-high' : 'bg-low/20 text-low'
                )}>
                  {alert.status === 'active' ? 'Actif' : 'Résolu'}
                </span>
              </div>
            )) || <p className="text-muted-foreground">Aucune alerte associée</p>}
          </div>
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments">
          <div className="card-soc p-4 space-y-4">
            {/* Existing Comments */}
            <div className="space-y-3">
              {incident.comments?.map((comment) => (
                <div key={comment.id} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{comment.author.split('@')[0]}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(comment.timestamp, { addSuffix: true, locale: fr })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground pl-8">{comment.content}</p>
                </div>
              )) || <p className="text-muted-foreground">Aucun commentaire</p>}
            </div>

            {/* New Comment */}
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Ajouter un commentaire..."
                className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                rows={2}
              />
              <Button size="sm" className="self-end">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
