import { useState, useMemo } from 'react';
import { MetricCard } from './MetricCard';
import { SeverityBadge } from './SeverityBadge';
import { 
  Mail, Send, Inbox, AlertTriangle, ExternalLink, 
  ArrowUpRight, Filter, RefreshCw, Search, User,
  Shield, Clock, TrendingUp, TrendingDown, Loader2, WifiOff, Trash2,
  ChevronRight, Users, Settings, ChevronLeft, Link2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSOC } from '@/context/SOCContext';
import { useToast } from '@/hooks/use-toast';
import { detectRulePatterns } from '@/services/anomalyDetection';

export function ExchangeView() {
  const { toast } = useToast();
  const { isConfigured, isLoading, data, connectors, refreshExchange, deleteMailboxRuleAction } = useSOC();
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');

  // Compute stats from real data
  const stats = useMemo(() => {
    const forwardingRules = data.mailboxRules.filter(r => r.isForwarding);
    const externalForwardingRules = data.mailboxRules.filter(r => r.isExternalForwarding);
    const suspiciousRules = data.mailboxRules.filter(r => r.isSuspicious);
    
    return {
      totalRules: data.mailboxRules.length,
      forwardingCount: forwardingRules.length,
      externalForwardingCount: externalForwardingRules.length,
      suspiciousCount: suspiciousRules.length,
      usersScanned: new Set(data.mailboxRules.map(r => r.userId)).size,
    };
  }, [data.mailboxRules]);

  // Get forwarding rules
  const forwardingRules = useMemo(() => {
    return data.mailboxRules.filter(r => r.isForwarding);
  }, [data.mailboxRules]);

  // Get suspicious rules (non-forwarding)
  const suspiciousRules = useMemo(() => {
    return data.mailboxRules.filter(r => r.isSuspicious && !r.isForwarding);
  }, [data.mailboxRules]);

  // Detect patterns across multiple users (same forwarding destination, etc.)
  const rulePatterns = useMemo(() => {
    return detectRulePatterns(data.mailboxRules);
  }, [data.mailboxRules]);

  // Group all users with their rules
  const allUsersWithRules = useMemo(() => {
    const userMap = new Map<string, {
      userId: string;
      email: string;
      displayName: string;
      rules: typeof data.mailboxRules;
      suspiciousCount: number;
      forwardingCount: number;
    }>();

    // Add users from mailbox rules
    data.mailboxRules.forEach(rule => {
      const existing = userMap.get(rule.userId);
      if (existing) {
        existing.rules.push(rule);
        if (rule.isSuspicious) existing.suspiciousCount++;
        if (rule.isForwarding) existing.forwardingCount++;
      } else {
        userMap.set(rule.userId, {
          userId: rule.userId,
          email: rule.userPrincipalName,
          displayName: rule.userDisplayName,
          rules: [rule],
          suspiciousCount: rule.isSuspicious ? 1 : 0,
          forwardingCount: rule.isForwarding ? 1 : 0,
        });
      }
    });

    // Add users from data.users who may not have rules
    data.users.forEach(user => {
      if (!userMap.has(user.id)) {
        userMap.set(user.id, {
          userId: user.id,
          email: user.userPrincipalName || user.mail || '',
          displayName: user.displayName || '',
          rules: [],
          suspiciousCount: 0,
          forwardingCount: 0,
        });
      }
    });

    return Array.from(userMap.values())
      .filter(u => u.email)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [data.mailboxRules, data.users]);

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return allUsersWithRules;
    const search = userSearch.toLowerCase();
    return allUsersWithRules.filter(u => 
      u.displayName.toLowerCase().includes(search) || 
      u.email.toLowerCase().includes(search)
    );
  }, [allUsersWithRules, userSearch]);

  // Get selected user details
  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    return allUsersWithRules.find(u => u.userId === selectedUserId) || null;
  }, [selectedUserId, allUsersWithRules]);

  // Get Exchange Admin Center URL for a user's inbox rules
  const getExchangeAdminUrl = (userEmail: string) => {
    // Direct link to Exchange Admin Center mailboxes with search filter
    return `https://admin.exchange.microsoft.com/#/mailboxes?searchText=${encodeURIComponent(userEmail)}`;
  };

  // Get Outlook Web App rules URL (for user's own rules management)
  const getOutlookRulesUrl = (userEmail: string) => {
    // This opens the classic ECP where admins can manage user rules
    const domain = userEmail.split('@')[1];
    return `https://outlook.office365.com/ecp/${domain}/?exsvurl=1&p=Organize/InboxRules.slab&realm=${domain}&wa=wsignin1.0`;
  };

  // Get risky users based on mailbox rules and other data
  const riskyUsers = useMemo(() => {
    const userRiskMap = new Map<string, {
      email: string;
      displayName: string;
      riskScore: number;
      reasons: string[];
      ruleCount: number;
    }>();

    // Add risk from mailbox rules
    data.mailboxRules.forEach(rule => {
      if (!rule.isSuspicious) return;
      
      const existing = userRiskMap.get(rule.userPrincipalName);
      if (existing) {
        existing.riskScore = Math.min(100, existing.riskScore + 15);
        rule.suspiciousReasons.forEach(r => {
          if (!existing.reasons.includes(r)) existing.reasons.push(r);
        });
        existing.ruleCount++;
      } else {
        userRiskMap.set(rule.userPrincipalName, {
          email: rule.userPrincipalName,
          displayName: rule.userDisplayName,
          riskScore: rule.isExternalForwarding ? 60 : 40,
          reasons: [...rule.suspiciousReasons],
          ruleCount: 1,
        });
      }
    });

    // Add risk from risky users (Entra)
    data.riskyUsers.forEach(ru => {
      const existing = userRiskMap.get(ru.userPrincipalName);
      if (existing) {
        existing.riskScore = Math.min(100, existing.riskScore + 25);
        existing.reasons.push('Utilisateur à risque Entra ID');
      } else {
        userRiskMap.set(ru.userPrincipalName, {
          email: ru.userPrincipalName,
          displayName: ru.userDisplayName,
          riskScore: 50,
          reasons: ['Utilisateur à risque Entra ID'],
          ruleCount: 0,
        });
      }
    });

    return Array.from(userRiskMap.values())
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10);
  }, [data.mailboxRules, data.riskyUsers]);

  const handleDeleteRule = async (userId: string, ruleId: string) => {
    setDeletingRuleId(ruleId);
    try {
      await deleteMailboxRuleAction(userId, ruleId);
      toast({
        title: 'Règle supprimée',
        description: 'La règle de messagerie a été supprimée avec succès',
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de supprimer la règle',
        variant: 'destructive',
      });
    } finally {
      setDeletingRuleId(null);
    }
  };

  const getSeverityFromRule = (rule: typeof data.mailboxRules[0]): 'critical' | 'high' | 'medium' | 'low' => {
    if (rule.suspiciousReasons.includes('Suppression automatique')) return 'critical';
    if (rule.isExternalForwarding) return 'high';
    if (rule.isSuspicious) return 'medium';
    return 'low';
  };

  // Generate a human-readable description of what a rule does
  const getRuleDescription = (rule: typeof data.mailboxRules[0]): string[] => {
    const descriptions: string[] = [];
    
    // Actions
    if (rule.actions?.forwardTo && rule.actions.forwardTo.length > 0) {
      const addrs = rule.actions.forwardTo.map(f => f.emailAddress.address).join(', ');
      descriptions.push(`📤 Transfère une copie vers: ${addrs}`);
    }
    if (rule.actions?.forwardAsAttachmentTo && rule.actions.forwardAsAttachmentTo.length > 0) {
      const addrs = rule.actions.forwardAsAttachmentTo.map(f => f.emailAddress.address).join(', ');
      descriptions.push(`📎 Transfère en pièce jointe vers: ${addrs}`);
    }
    if (rule.actions?.redirectTo && rule.actions.redirectTo.length > 0) {
      const addrs = rule.actions.redirectTo.map(f => f.emailAddress.address).join(', ');
      descriptions.push(`↪️ Redirige (sans copie locale) vers: ${addrs}`);
    }
    if (rule.actions?.delete) {
      descriptions.push(`🗑️ Supprime automatiquement le message`);
    }
    if (rule.actions?.moveToFolder) {
      const folderName = (rule as any).moveToFolderName || 'un dossier';
      descriptions.push(`📁 Déplace vers le dossier: ${folderName}`);
    }
    
    // Conditions
    if (rule.conditions?.fromAddresses && rule.conditions.fromAddresses.length > 0) {
      const addrs = rule.conditions.fromAddresses.map(f => f.emailAddress.address).join(', ');
      descriptions.push(`📨 S'applique aux mails de: ${addrs}`);
    }
    if (rule.conditions?.subjectContains && rule.conditions.subjectContains.length > 0) {
      descriptions.push(`🔍 Filtre sur sujet contenant: "${rule.conditions.subjectContains.join('", "')}"`);
    }
    
    if (descriptions.length === 0) {
      descriptions.push(`ℹ️ Règle active sans action visible détectée`);
    }
    
    return descriptions;
  };

  // Show configuration required message
  if (!isConfigured) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="card-soc p-8 text-center">
          <WifiOff className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Configuration Requise</h2>
          <p className="text-muted-foreground mb-6">
            Configurez votre App Registration dans les Paramètres pour analyser les règles Exchange.
          </p>
        </div>
      </div>
    );
  }

  const exchangeConnector = connectors.exchange;
  const isScanning = exchangeConnector.status === 'loading';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exchange Online</h1>
          <p className="text-muted-foreground text-sm">
            Règles de messagerie, transferts et sécurité des boîtes aux lettres
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refreshExchange()}
            disabled={isScanning}
          >
            {isScanning ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {isScanning ? 'Analyse en cours...' : 'Scanner les règles'}
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="Règles Analysées"
          value={stats.totalRules}
          subtitle={`${data.users.length} utilisateurs`}
          icon={Mail}
          variant="default"
        />
        <MetricCard
          title="Transferts"
          value={stats.forwardingCount}
          subtitle={`${stats.externalForwardingCount} vers externe`}
          icon={ArrowUpRight}
          variant={stats.externalForwardingCount > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Règles Suspectes"
          value={stats.suspiciousCount}
          subtitle="Nécessitent attention"
          icon={AlertTriangle}
          variant={stats.suspiciousCount > 0 ? 'critical' : 'success'}
        />
        <MetricCard
          title="Utilisateurs à Risque"
          value={riskyUsers.length}
          subtitle="Corrélation multi-sources"
          icon={User}
          variant={riskyUsers.length > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="forwarding" className="space-y-4">
        <TabsList className="bg-muted/30">
          <TabsTrigger value="forwarding">
            Règles de Transfert
            {stats.externalForwardingCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-high/20 text-high text-xs">
                {stats.externalForwardingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="suspicious">
            Règles Suspectes
            {suspiciousRules.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-critical/20 text-critical text-xs">
                {suspiciousRules.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="patterns">
            <Link2 className="w-4 h-4 mr-1" />
            Patterns
            {rulePatterns.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-critical/20 text-critical text-xs">
                {rulePatterns.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="risky">Utilisateurs à Risque</TabsTrigger>
          <TabsTrigger value="allusers">
            <Users className="w-4 h-4 mr-1" />
            Tous les Utilisateurs
            <span className="ml-2 px-1.5 py-0.5 rounded bg-primary/20 text-primary text-xs">
              {allUsersWithRules.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Forwarding Rules Tab */}
        <TabsContent value="forwarding" className="space-y-4">
          <div className="card-soc p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-high" />
                Règles de Transfert Détectées
              </h3>
              <span className="text-xs text-muted-foreground">
                {stats.externalForwardingCount} transferts externes
              </span>
            </div>

            {forwardingRules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucune règle de transfert détectée</p>
                <p className="text-sm">Cliquez sur "Scanner les règles" pour analyser les boîtes mail</p>
              </div>
            ) : (
              <div className="space-y-3">
                {forwardingRules.map((rule) => (
                  <div
                    key={`${rule.userId}-${rule.id}`}
                    className={cn(
                      'p-4 rounded-lg border transition-colors',
                      rule.isExternalForwarding 
                        ? 'bg-high/5 border-high/30' 
                        : 'bg-muted/30 border-border/50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{rule.userPrincipalName}</span>
                          <SeverityBadge severity={getSeverityFromRule(rule)} />
                          {rule.isExternalForwarding && (
                            <span className="px-2 py-0.5 rounded bg-high/20 text-high text-xs flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" />
                              Externe
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Règle: "{rule.displayName}"
                        </p>
                        {/* Rule description - what this rule does */}
                        <div className="space-y-1 mt-2 p-2 rounded bg-muted/30">
                          {getRuleDescription(rule).map((desc, idx) => (
                            <p key={idx} className="text-sm text-muted-foreground">
                              {desc}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border/50 flex gap-2">
                      <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={deletingRuleId === rule.id}
                        onClick={() => handleDeleteRule(rule.userId, rule.id)}
                      >
                        {deletingRuleId === rule.id ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-1" />
                        )}
                        Supprimer la règle
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Suspicious Rules Tab */}
        <TabsContent value="suspicious" className="space-y-4">
          <div className="card-soc p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-critical" />
                Règles Inbox Suspectes
              </h3>
            </div>

            {suspiciousRules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucune règle suspecte détectée</p>
              </div>
            ) : (
              <div className="space-y-3">
                {suspiciousRules.map((rule) => (
                  <div
                    key={`${rule.userId}-${rule.id}`}
                    className="p-4 rounded-lg bg-critical/5 border border-critical/30"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{rule.userPrincipalName}</span>
                          <SeverityBadge severity={getSeverityFromRule(rule)} />
                        </div>
                        <p className="text-sm font-medium mb-1">
                          "{rule.displayName}"
                        </p>
                        
                        {/* Rule description - what this rule does */}
                        <div className="space-y-1 mt-2 mb-2 p-2 rounded bg-muted/30">
                          {getRuleDescription(rule).map((desc, idx) => (
                            <p key={idx} className="text-sm text-muted-foreground">
                              {desc}
                            </p>
                          ))}
                        </div>
                        
                        <div className="flex flex-wrap gap-1 mt-2">
                          {rule.suspiciousReasons.map((reason, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded bg-critical/20 text-critical text-xs">
                              {reason}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border/50 flex gap-2">
                      <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={deletingRuleId === rule.id}
                        onClick={() => handleDeleteRule(rule.userId, rule.id)}
                      >
                        {deletingRuleId === rule.id ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-1" />
                        )}
                        Supprimer la règle
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Patterns Tab */}
        <TabsContent value="patterns" className="space-y-4">
          <div className="card-soc p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Link2 className="w-4 h-4 text-critical" />
                Patterns Détectés Multi-Utilisateurs
              </h3>
              <span className="text-xs text-muted-foreground">
                Règles similaires sur plusieurs comptes
              </span>
            </div>

            {rulePatterns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucun pattern suspect détecté</p>
                <p className="text-sm">Les règles sont indépendantes entre utilisateurs</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rulePatterns.map((pattern, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'p-4 rounded-lg border transition-colors',
                      pattern.severity === 'critical' && 'bg-critical/5 border-critical/30',
                      pattern.severity === 'high' && 'bg-high/5 border-high/30',
                      pattern.severity === 'medium' && 'bg-medium/5 border-medium/30'
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Link2 className="w-4 h-4 text-critical" />
                          <span className="font-medium">{pattern.pattern}</span>
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            pattern.severity === 'critical' && 'bg-critical/20 text-critical',
                            pattern.severity === 'high' && 'bg-high/20 text-high',
                            pattern.severity === 'medium' && 'bg-medium/20 text-medium'
                          )}>
                            {pattern.severity}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {pattern.users.length} utilisateur(s) avec la même règle
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {pattern.users.map((user, userIdx) => (
                            <span
                              key={userIdx}
                              className="px-2 py-0.5 rounded bg-muted text-xs"
                            >
                              {user}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Risky Users Tab */}
        <TabsContent value="risky" className="space-y-4">
          <div className="card-soc p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-critical" />
                Utilisateurs Email à Risque
              </h3>
              <span className="text-xs text-muted-foreground">
                Basé sur corrélation multi-sources
              </span>
            </div>

            {riskyUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucun utilisateur à risque détecté</p>
              </div>
            ) : (
              <div className="space-y-3">
                {riskyUsers.map((user) => (
                  <div
                    key={user.email}
                    className="p-4 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{user.displayName}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {user.reasons.map((reason, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-high/20 text-high text-xs"
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className={cn(
                          'w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold',
                          user.riskScore >= 80 ? 'bg-critical/20 text-critical' :
                          user.riskScore >= 60 ? 'bg-high/20 text-high' :
                          'bg-medium/20 text-medium'
                        )}>
                          {user.riskScore}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Score</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* All Users Tab */}
        <TabsContent value="allusers" className="space-y-4">
          <div className="card-soc p-4">
            {selectedUser ? (
              // User detail view
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedUserId(null)}
                    className="gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Retour à la liste
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(getExchangeAdminUrl(selectedUser.email), '_blank')}
                      className="gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      Boîte aux lettres
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => window.open(getOutlookRulesUrl(selectedUser.email), '_blank')}
                      className="gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      Règles Inbox (ECP)
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-8 h-8 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold">{selectedUser.displayName}</h3>
                      <p className="text-muted-foreground">{selectedUser.email}</p>
                      <div className="flex gap-3 mt-2">
                        <span className="text-sm">
                          <strong>{selectedUser.rules.length}</strong> règle(s)
                        </span>
                        {selectedUser.forwardingCount > 0 && (
                          <span className="text-sm text-high">
                            <strong>{selectedUser.forwardingCount}</strong> transfert(s)
                          </span>
                        )}
                        {selectedUser.suspiciousCount > 0 && (
                          <span className="text-sm text-critical">
                            <strong>{selectedUser.suspiciousCount}</strong> suspecte(s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Règles de Messagerie ({selectedUser.rules.length})
                  </h4>

                  {selectedUser.rules.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg">
                      <Shield className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>Aucune règle détectée pour cet utilisateur</p>
                    </div>
                  ) : (
                    selectedUser.rules.map((rule) => (
                      <div
                        key={rule.id}
                        className={cn(
                          'p-4 rounded-lg border transition-colors',
                          rule.isSuspicious 
                            ? 'bg-critical/5 border-critical/30' 
                            : rule.isForwarding
                            ? 'bg-high/5 border-high/30'
                            : 'bg-muted/30 border-border/50'
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium">{rule.displayName}</span>
                              <SeverityBadge severity={getSeverityFromRule(rule)} />
                              {rule.isForwarding && (
                                <span className="px-2 py-0.5 rounded bg-high/20 text-high text-xs flex items-center gap-1">
                                  <ArrowUpRight className="w-3 h-3" />
                                  Transfert
                                </span>
                              )}
                              {rule.isExternalForwarding && (
                                <span className="px-2 py-0.5 rounded bg-critical/20 text-critical text-xs flex items-center gap-1">
                                  <ExternalLink className="w-3 h-3" />
                                  Externe
                                </span>
                              )}
                            </div>

                            {/* Rule description - what this rule does */}
                            <div className="space-y-1 mt-2 mb-2 p-2 rounded bg-muted/30">
                              {getRuleDescription(rule).map((desc, idx) => (
                                <p key={idx} className="text-sm text-muted-foreground">
                                  {desc}
                                </p>
                              ))}
                            </div>

                            {rule.suspiciousReasons.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {rule.suspiciousReasons.map((reason, idx) => (
                                  <span key={idx} className="px-2 py-0.5 rounded bg-critical/20 text-critical text-xs">
                                    {reason}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-border/50 flex gap-2">
                          <Button 
                            variant="destructive" 
                            size="sm"
                            disabled={deletingRuleId === rule.id}
                            onClick={() => handleDeleteRule(rule.userId, rule.id)}
                          >
                            {deletingRuleId === rule.id ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4 mr-1" />
                            )}
                            Supprimer
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(getOutlookRulesUrl(selectedUser.email), '_blank')}
                          >
                            <Settings className="w-4 h-4 mr-1" />
                            Gérer dans ECP
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              // User list view
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Tous les Utilisateurs
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {filteredUsers.length} utilisateur(s)
                  </span>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Rechercher un utilisateur..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg bg-muted/30 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.userId}
                      onClick={() => setSelectedUserId(user.userId)}
                      className="p-3 rounded-lg bg-muted/20 border border-border/50 hover:bg-muted/40 cursor-pointer transition-colors flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{user.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {user.rules.length > 0 && (
                          <span className="px-2 py-0.5 rounded bg-muted text-xs">
                            {user.rules.length} règle(s)
                          </span>
                        )}
                        {user.suspiciousCount > 0 && (
                          <span className="px-2 py-0.5 rounded bg-critical/20 text-critical text-xs">
                            {user.suspiciousCount} suspecte(s)
                          </span>
                        )}
                        {user.forwardingCount > 0 && (
                          <span className="px-2 py-0.5 rounded bg-high/20 text-high text-xs">
                            {user.forwardingCount} transfert(s)
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}

                  {filteredUsers.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>Aucun utilisateur trouvé</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
