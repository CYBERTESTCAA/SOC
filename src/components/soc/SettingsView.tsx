import { useState, useEffect } from 'react';
import { useSOC, ConnectorStatus } from '@/context/SOCContext';
import { Button } from '@/components/ui/button';
import { 
  Settings, Shield, Users, Bell, Database, Key, 
  RefreshCw, CheckCircle, XCircle, AlertTriangle,
  Clock, Activity, Eye, Edit, Trash2, Plus, Save,
  Globe, Lock, Mail, Smartphone, Server, Wifi, WifiOff,
  Loader2, Unplug, Plug, Send, MessageSquare, Laptop, FileText, UserX
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import TeamsAlerts, { isTeamsWebhookConfigured } from '@/services/teamsWebhook';

const alertRules = [
  { id: 'RULE-001', name: 'Incident Critique Defender', condition: 'severity == "critical" && source == "defender"', enabled: true, cooldown: '30 min' },
  { id: 'RULE-002', name: 'Brute-force Détecté', condition: 'failed_attempts >= 5 && time_window <= 5min', enabled: true, cooldown: '15 min' },
  { id: 'RULE-003', name: 'Connexion Pays Rare', condition: 'country NOT IN user_history && risk_level >= "medium"', enabled: true, cooldown: '1 heure' },
  { id: 'RULE-004', name: 'Device VIP Non Conforme', condition: 'is_vip == true && compliance_state == "nonCompliant"', enabled: true, cooldown: '2 heures' },
  { id: 'RULE-005', name: 'BitLocker Désactivé', condition: 'bitlocker_status == false', enabled: false, cooldown: '4 heures' },
  { id: 'RULE-006', name: 'Règle Transfert Externe', condition: 'forwarding_rule.is_external == true', enabled: true, cooldown: '1 heure' },
];

const riskyCountries = ['Russia', 'China', 'North Korea', 'Iran', 'Belarus'];
const vipGroups = ['C-Level', 'Finance', 'IT Admins', 'HR'];

const REQUIRED_PERMISSIONS = [
  { scope: 'SecurityEvents.Read.All', description: 'Lire les événements de sécurité' },
  { scope: 'SecurityIncident.Read.All', description: 'Lire les incidents' },
  { scope: 'SecurityIncident.ReadWrite.All', description: 'Modifier les incidents' },
  { scope: 'AuditLog.Read.All', description: 'Lire les logs d\'audit' },
  { scope: 'Directory.Read.All', description: 'Lire le répertoire' },
  { scope: 'DeviceManagementManagedDevices.Read.All', description: 'Lire les appareils Intune' },
  { scope: 'User.Read.All', description: 'Lire les utilisateurs' },
  { scope: 'IdentityRiskyUser.Read.All', description: 'Lire les utilisateurs à risque' },
  { scope: 'Mail.Read', description: 'Lire les emails (pour règles)' },
];

export function SettingsView() {
  const { toast } = useToast();
  const { 
    config, 
    isConfigured, 
    isConnecting, 
    connectionError,
    connect, 
    disconnect,
    connectors,
    refreshAll,
    refreshIncidents,
    refreshSignIns,
    refreshDevices,
    refreshUsers,
  } = useSOC();

  const [tenantId, setTenantId] = useState(config?.tenantId || '');
  const [clientId, setClientId] = useState(config?.clientId || '');
  const [clientSecret, setClientSecret] = useState(config?.clientSecret || '');
  const [showSecret, setShowSecret] = useState(false);
  const [teamsConfigured, setTeamsConfigured] = useState(false);

  useEffect(() => {
    isTeamsWebhookConfigured().then(setTeamsConfigured);
  }, []);

  const handleConnect = async () => {
    if (!tenantId || !clientId || !clientSecret) {
      toast({
        title: 'Erreur',
        description: 'Veuillez remplir tous les champs',
        variant: 'destructive',
      });
      return;
    }

    const success = await connect(tenantId, clientId, clientSecret);
    if (success) {
      toast({
        title: 'Connecté',
        description: 'Connexion à Microsoft Graph réussie',
      });
    } else {
      toast({
        title: 'Erreur de connexion',
        description: connectionError || 'Impossible de se connecter',
        variant: 'destructive',
      });
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setTenantId('');
    setClientId('');
    setClientSecret('');
    toast({
      title: 'Déconnecté',
      description: 'Configuration supprimée',
    });
  };

  const handleSync = async (connector: string) => {
    switch (connector) {
      case 'defender':
        await refreshIncidents();
        break;
      case 'entra':
        await refreshSignIns();
        break;
      case 'intune':
        await refreshDevices();
        break;
      case 'exchange':
        await refreshUsers();
        break;
    }
    toast({
      title: 'Synchronisation',
      description: `${connector} synchronisé`,
    });
  };

  const getConnectorStatusIcon = (status: ConnectorStatus) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-4 h-4 text-low" />;
      case 'loading': return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'error': return <XCircle className="w-4 h-4 text-critical" />;
      case 'disconnected': return <WifiOff className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getConnectorStatusColor = (status: ConnectorStatus) => {
    switch (status) {
      case 'connected': return 'bg-low/20 border-low/30';
      case 'loading': return 'bg-primary/20 border-primary/30';
      case 'error': return 'bg-critical/20 border-critical/30';
      case 'disconnected': return 'bg-muted border-border';
    }
  };

  const connectorsList = [
    { id: 'defender', name: 'Microsoft Defender XDR', permissions: ['SecurityEvents.Read.All', 'SecurityIncident.Read.All'] },
    { id: 'entra', name: 'Microsoft Entra ID', permissions: ['AuditLog.Read.All', 'Directory.Read.All', 'IdentityRiskyUser.Read.All'] },
    { id: 'intune', name: 'Microsoft Intune', permissions: ['DeviceManagementManagedDevices.Read.All'] },
    { id: 'exchange', name: 'Exchange Online', permissions: ['User.Read.All', 'Mail.Read'] },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Paramètres SOC</h1>
          <p className="text-muted-foreground text-sm">
            Configuration des connecteurs Microsoft Graph API
          </p>
        </div>
        {isConfigured && (
          <Button size="sm" onClick={() => refreshAll()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Tout synchroniser
          </Button>
        )}
      </div>

      <Tabs defaultValue="connectors" className="space-y-4">
        <TabsList className="bg-muted/30">
          <TabsTrigger value="connectors">
            <Database className="w-4 h-4 mr-2" />
            Connecteurs
          </TabsTrigger>
          <TabsTrigger value="teams">
            <MessageSquare className="w-4 h-4 mr-2" />
            Teams
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <Bell className="w-4 h-4 mr-2" />
            Règles d'Alerting
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="w-4 h-4 mr-2" />
            Sécurité
          </TabsTrigger>
        </TabsList>

        {/* Connectors Tab */}
        <TabsContent value="connectors" className="space-y-4">
          {/* Connection Form */}
          <div className="card-soc p-6 border-2 border-primary/30">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              Configuration Azure App Registration
            </h3>
            
            {connectionError && (
              <div className="mb-4 p-3 rounded-lg bg-critical/10 border border-critical/30 text-critical text-sm">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                {connectionError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <label htmlFor="tenantId" className="text-sm font-medium">Tenant ID</label>
                <input
                  id="tenantId"
                  type="text"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  disabled={isConfigured}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="clientId" className="text-sm font-medium">Client ID (Application ID)</label>
                <input
                  id="clientId"
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  disabled={isConfigured}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="clientSecret" className="text-sm font-medium">Client Secret</label>
                <div className="flex gap-2">
                  <input
                    id="clientSecret"
                    type={showSecret ? 'text' : 'password'}
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Votre client secret"
                    disabled={isConfigured}
                    className="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {!isConfigured ? (
                <Button onClick={handleConnect} disabled={isConnecting}>
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connexion...
                    </>
                  ) : (
                    <>
                      <Plug className="w-4 h-4 mr-2" />
                      Connecter
                    </>
                  )}
                </Button>
              ) : (
                <Button variant="destructive" onClick={handleDisconnect}>
                  <Unplug className="w-4 h-4 mr-2" />
                  Déconnecter
                </Button>
              )}
            </div>

            {isConfigured && (
              <div className="mt-4 p-3 rounded-lg bg-low/10 border border-low/30 text-low text-sm">
                <CheckCircle className="w-4 h-4 inline mr-2" />
                Connecté à Microsoft Graph API
              </div>
            )}
          </div>

          {/* Connectors Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {connectorsList.map((connector) => {
              const status = connectors[connector.id as keyof typeof connectors];
              return (
                <div
                  key={connector.id}
                  className={cn(
                    'card-soc p-4 border-2 transition-colors',
                    getConnectorStatusColor(status.status)
                  )}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {getConnectorStatusIcon(status.status)}
                      <div>
                        <h3 className="font-semibold">{connector.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {connector.id}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleSync(connector.id)}
                      disabled={!isConfigured || status.status === 'loading'}
                    >
                      {status.status === 'loading' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Sync
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Dernière sync</span>
                      <span className="font-mono text-xs">
                        {status.lastSync 
                          ? formatDistanceToNow(status.lastSync, { addSuffix: true, locale: fr })
                          : 'Jamais'
                        }
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Statut</span>
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        status.status === 'connected' && 'bg-low/20 text-low',
                        status.status === 'loading' && 'bg-primary/20 text-primary',
                        status.status === 'error' && 'bg-critical/20 text-critical',
                        status.status === 'disconnected' && 'bg-muted text-muted-foreground'
                      )}>
                        {status.status === 'connected' && 'Connecté'}
                        {status.status === 'loading' && 'Synchronisation...'}
                        {status.status === 'error' && 'Erreur'}
                        {status.status === 'disconnected' && 'Déconnecté'}
                      </span>
                    </div>
                    
                    {status.error && (
                      <div className="p-2 rounded bg-critical/10 border border-critical/20 text-xs text-critical">
                        {status.error}
                      </div>
                    )}

                    <div className="pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-2">Permissions requises:</p>
                      <div className="flex flex-wrap gap-1">
                        {connector.permissions.map((perm) => (
                          <span
                            key={perm}
                            className="px-2 py-0.5 rounded bg-muted text-xs font-mono"
                          >
                            {perm}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Required Permissions */}
          <div className="card-soc p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Permissions Graph API Requises
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Assurez-vous que votre App Registration dispose des permissions suivantes (Application permissions) :
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {REQUIRED_PERMISSIONS.map((perm) => (
                <div key={perm.scope} className="flex items-center gap-2 p-2 rounded bg-muted/30">
                  <CheckCircle className="w-4 h-4 text-low" />
                  <div>
                    <p className="text-sm font-mono">{perm.scope}</p>
                    <p className="text-xs text-muted-foreground">{perm.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Teams Integration Tab */}
        <TabsContent value="teams" className="space-y-4">
          <div className="card-soc p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Intégration Microsoft Teams
            </h3>
            
            <div className="mb-6">
              <div className={cn(
                "p-4 rounded-lg border",
                teamsConfigured 
                  ? "bg-low/10 border-low/30" 
                  : "bg-critical/10 border-critical/30"
              )}>
                <div className="flex items-center gap-2">
                  {teamsConfigured ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-low" />
                      <span className="font-medium text-low">Webhook Teams configuré</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-critical" />
                      <span className="font-medium text-critical">Webhook Teams non configuré</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {teamsConfigured 
                    ? "Les alertes seront envoyées vers votre canal Teams configuré."
                    : "Ajoutez TEAMS_WEBHOOK_URL dans le fichier .env du serveur pour activer les alertes Teams."
                  }
                </p>
              </div>
            </div>

            <h4 className="font-medium mb-4">Tester les alertes Teams</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Cliquez sur un bouton pour envoyer une alerte de test vers votre canal Teams.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Test Alert Button */}
              <button
                onClick={async () => {
                  const result = await TeamsAlerts.test();
                  toast({
                    title: result.success ? '✅ Test envoyé' : '❌ Erreur',
                    description: result.success ? 'Vérifiez votre canal Teams' : result.error,
                    variant: result.success ? 'default' : 'destructive',
                  });
                }}
                disabled={!teamsConfigured}
                className="p-4 rounded-lg border border-info/30 bg-info/10 hover:bg-info/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Send className="w-5 h-5 text-info" />
                  <span className="font-medium">🧪 Test de connexion</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Envoie un message de test pour vérifier la configuration
                </p>
              </button>

              {/* Incident Alert */}
              <button
                onClick={async () => {
                  const result = await TeamsAlerts.incident(
                    'Tentative de brute-force détectée',
                    'critical',
                    {
                      'Source IP': '192.168.1.100',
                      'Cible': 'admin@contoso.com',
                      'Tentatives': '15',
                    }
                  );
                  toast({
                    title: result.success ? '🚨 Alerte incident envoyée' : '❌ Erreur',
                    description: result.success ? 'Vérifiez votre canal Teams' : result.error,
                    variant: result.success ? 'default' : 'destructive',
                  });
                }}
                disabled={!teamsConfigured}
                className="p-4 rounded-lg border border-critical/30 bg-critical/10 hover:bg-critical/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="w-5 h-5 text-critical" />
                  <span className="font-medium">🚨 Incident de sécurité</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Simule une alerte d'incident critique
                </p>
              </button>

              {/* Forwarding Rule Alert */}
              <button
                onClick={async () => {
                  const result = await TeamsAlerts.forwardingRule(
                    'marie.dupont@contoso.com',
                    'backup@gmail.com',
                    'Auto-forward externe'
                  );
                  toast({
                    title: result.success ? '📧 Alerte transfert envoyée' : '❌ Erreur',
                    description: result.success ? 'Vérifiez votre canal Teams' : result.error,
                    variant: result.success ? 'default' : 'destructive',
                  });
                }}
                disabled={!teamsConfigured}
                className="p-4 rounded-lg border border-high/30 bg-high/10 hover:bg-high/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Mail className="w-5 h-5 text-orange-500" />
                  <span className="font-medium">📧 Règle de transfert</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Simule une règle de transfert suspecte
                </p>
              </button>

              {/* Risky User Alert */}
              <button
                onClick={async () => {
                  const result = await TeamsAlerts.riskyUser(
                    'Jean Martin',
                    'jean.martin@contoso.com',
                    'high',
                    'Connexion depuis un pays inhabituel (Russie) avec tentatives de MFA échouées'
                  );
                  toast({
                    title: result.success ? '👤 Alerte utilisateur envoyée' : '❌ Erreur',
                    description: result.success ? 'Vérifiez votre canal Teams' : result.error,
                    variant: result.success ? 'default' : 'destructive',
                  });
                }}
                disabled={!teamsConfigured}
                className="p-4 rounded-lg border border-medium/30 bg-medium/10 hover:bg-medium/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="flex items-center gap-3 mb-2">
                  <UserX className="w-5 h-5 text-yellow-500" />
                  <span className="font-medium">👤 Utilisateur à risque</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Simule une alerte utilisateur à risque élevé
                </p>
              </button>

              {/* Report Generated Alert */}
              <button
                onClick={async () => {
                  const result = await TeamsAlerts.reportGenerated(
                    'Rapport Hebdomadaire Sécurité',
                    'Sécurité',
                    'Analyse complète des incidents, connexions suspectes et conformité des appareils.'
                  );
                  toast({
                    title: result.success ? '📊 Alerte rapport envoyée' : '❌ Erreur',
                    description: result.success ? 'Vérifiez votre canal Teams' : result.error,
                    variant: result.success ? 'default' : 'destructive',
                  });
                }}
                disabled={!teamsConfigured}
                className="p-4 rounded-lg border border-info/30 bg-info/10 hover:bg-info/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <span className="font-medium">📊 Rapport généré</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Simule la génération d'un nouveau rapport
                </p>
              </button>
            </div>
          </div>
        </TabsContent>

        {/* Alert Rules Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <div className="card-soc p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                Règles d'Alerting
              </h3>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle Règle
              </Button>
            </div>

            <div className="space-y-3">
              {alertRules.map((rule) => (
                <div
                  key={rule.id}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-lg border transition-colors',
                    rule.enabled 
                      ? 'bg-muted/30 border-border/50' 
                      : 'bg-muted/10 border-border/30 opacity-60'
                  )}
                >
                  <button
                    className={cn(
                      'w-12 h-6 rounded-full relative transition-colors',
                      rule.enabled ? 'bg-primary' : 'bg-muted'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                        rule.enabled ? 'left-7' : 'left-1'
                      )}
                    />
                  </button>
                  <div className="flex-1">
                    <p className="font-medium">{rule.name}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {rule.condition}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-muted-foreground">Cooldown:</span>
                    <span className="ml-1 font-medium">{rule.cooldown}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-soc p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                Pays à Risque
              </h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {riskyCountries.map((country) => (
                  <span
                    key={country}
                    className="px-3 py-1 rounded-full bg-critical/20 text-critical text-sm flex items-center gap-2"
                  >
                    {country}
                    <button className="hover:bg-critical/30 rounded-full p-0.5">
                      <XCircle className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter pays
              </Button>
            </div>

            <div className="card-soc p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Groupes VIP
              </h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {vipGroups.map((group) => (
                  <span
                    key={group}
                    className="px-3 py-1 rounded-full bg-high/20 text-high text-sm flex items-center gap-2"
                  >
                    {group}
                    <button className="hover:bg-high/30 rounded-full p-0.5">
                      <XCircle className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter groupe
              </Button>
            </div>
          </div>

          <div className="card-soc p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              Canaux de Notification
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="w-5 h-5 text-primary" />
                  <span className="font-medium">Email</span>
                  <span className="ml-auto px-2 py-0.5 rounded bg-low/20 text-low text-xs">Actif</span>
                </div>
                <p className="text-sm text-muted-foreground">soc-alerts@contoso.com</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <Smartphone className="w-5 h-5 text-primary" />
                  <span className="font-medium">Teams</span>
                  <span className="ml-auto px-2 py-0.5 rounded bg-low/20 text-low text-xs">Actif</span>
                </div>
                <p className="text-sm text-muted-foreground">Webhook configuré</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <Server className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">ITSM</span>
                  <span className="ml-auto px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs">Inactif</span>
                </div>
                <p className="text-sm text-muted-foreground">Non configuré</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-soc p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                Authentification
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">MFA Obligatoire</p>
                    <p className="text-sm text-muted-foreground">Tous les utilisateurs</p>
                  </div>
                  <div className="w-12 h-6 rounded-full bg-primary relative">
                    <span className="absolute top-1 left-7 w-4 h-4 rounded-full bg-white" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Session Timeout</p>
                    <p className="text-sm text-muted-foreground">Déconnexion après inactivité</p>
                  </div>
                  <select className="bg-muted/50 border border-border rounded px-3 py-1 text-sm">
                    <option>30 minutes</option>
                    <option>1 heure</option>
                    <option>2 heures</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">IP Whitelist</p>
                    <p className="text-sm text-muted-foreground">Restreindre les accès</p>
                  </div>
                  <div className="w-12 h-6 rounded-full bg-muted relative">
                    <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white" />
                  </div>
                </div>
              </div>
            </div>

            <div className="card-soc p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                Rétention des Données
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Incidents</span>
                  <select className="bg-muted/50 border border-border rounded px-3 py-1 text-sm">
                    <option>90 jours</option>
                    <option>180 jours</option>
                    <option>1 an</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Sign-in Logs</span>
                  <select className="bg-muted/50 border border-border rounded px-3 py-1 text-sm">
                    <option>30 jours</option>
                    <option>90 jours</option>
                    <option>180 jours</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Audit Logs Portail</span>
                  <select className="bg-muted/50 border border-border rounded px-3 py-1 text-sm">
                    <option>90 jours</option>
                    <option>180 jours</option>
                    <option>1 an</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
