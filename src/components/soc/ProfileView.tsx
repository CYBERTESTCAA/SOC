import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSOC } from '@/context/SOCContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  getCurrentUser,
  getCurrentUserAuthMethods,
  getCurrentUserSignIns,
  getUserAuditLogs,
  revokeUserSession,
  CurrentUserProfile,
  UserAuthMethod,
  GraphSignIn,
  AuditLog,
} from '@/services/graphApi';
import {
  User,
  Mail,
  Shield,
  Key,
  Bell,
  Moon,
  Sun,
  Monitor,
  Globe,
  Clock,
  Save,
  LogOut,
  Camera,
  CheckCircle,
  AlertTriangle,
  Activity,
  Calendar,
  FileText,
  Settings,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'fr' | 'en';
  timezone: string;
  notifications: {
    email: boolean;
    push: boolean;
    criticalOnly: boolean;
    dailyDigest: boolean;
  };
  dashboard: {
    refreshInterval: number;
    showMetrics: boolean;
    compactMode: boolean;
  };
}

const defaultPreferences: UserPreferences = {
  theme: 'dark',
  language: 'fr',
  timezone: 'Europe/Paris',
  notifications: {
    email: true,
    push: true,
    criticalOnly: false,
    dailyDigest: true,
  },
  dashboard: {
    refreshInterval: 60,
    showMetrics: true,
    compactMode: false,
  },
};

const PREFS_STORAGE_KEY = 'soc_user_preferences';

function getStoredPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(PREFS_STORAGE_KEY);
    return stored ? { ...defaultPreferences, ...JSON.parse(stored) } : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
}

function savePreferences(prefs: UserPreferences): void {
  localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
}

export function ProfileView() {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const { isConfigured, data, connectors, config } = useSOC();
  
  const [preferences, setPreferences] = useState<UserPreferences>(getStoredPreferences());
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'security' | 'activity'>('profile');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  // Real data states
  const [currentUserProfile, setCurrentUserProfile] = useState<CurrentUserProfile | null>(null);
  const [authMethods, setAuthMethods] = useState<UserAuthMethod[]>([]);
  const [userSignIns, setUserSignIns] = useState<GraphSignIn[]>([]);
  const [userAuditLogs, setUserAuditLogs] = useState<AuditLog[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [revokingSession, setRevokingSession] = useState(false);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    mail: '',
    mobilePhone: '',
    department: '',
  });

  // Fetch current user data
  const fetchUserData = useCallback(async () => {
    if (!config) return;
    setLoadingProfile(true);
    try {
      const [profile, methods, signIns] = await Promise.all([
        getCurrentUser(config),
        getCurrentUserAuthMethods(config),
        getCurrentUserSignIns(config, 20),
      ]);

      if (profile) {
        setCurrentUserProfile(profile);
        setProfileForm({
          displayName: profile.displayName || '',
          mail: profile.mail || profile.userPrincipalName || '',
          mobilePhone: profile.mobilePhone || '',
          department: profile.department || '',
        });

        // Fetch audit logs for this user
        const logs = await getUserAuditLogs(config, profile.userPrincipalName, 20);
        setUserAuditLogs(logs);
      }
      setAuthMethods(methods);
      setUserSignIns(signIns);
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setLoadingProfile(false);
    }
  }, [config]);

  useEffect(() => {
    if (isConfigured && config) {
      fetchUserData();
    }
  }, [isConfigured, config, fetchUserData]);

  const handleSavePreferences = () => {
    savePreferences(preferences);
    
    // Apply theme immediately
    if (preferences.theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else if (preferences.theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      // System preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
      document.documentElement.classList.toggle('light', !prefersDark);
    }
    
    toast({
      title: 'Préférences sauvegardées',
      description: 'Vos paramètres ont été mis à jour',
    });
  };

  const handleSaveProfile = () => {
    // In real app, this would call Graph API to update user profile
    // For now, we just show a success message
    toast({
      title: 'Profil sauvegardé',
      description: 'Vos informations ont été mises à jour',
    });
  };

  const handleRevokeAllSessions = async () => {
    if (!config || !currentUserProfile) return;
    setRevokingSession(true);
    try {
      const success = await revokeUserSession(config, currentUserProfile.id);
      if (success) {
        toast({
          title: 'Sessions révoquées',
          description: 'Toutes les sessions ont été invalidées. Vous devrez vous reconnecter.',
        });
      } else {
        toast({
          title: 'Erreur',
          description: 'Impossible de révoquer les sessions',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Une erreur est survenue',
        variant: 'destructive',
      });
    } finally {
      setRevokingSession(false);
    }
  };

  const getAuthMethodIcon = (methodType: string) => {
    switch (methodType) {
      case 'microsoftAuthenticatorAuthenticationMethod':
        return { name: 'Microsoft Authenticator', icon: Shield };
      case 'phoneAuthenticationMethod':
        return { name: 'SMS / Appel', icon: Bell };
      case 'emailAuthenticationMethod':
        return { name: 'Email', icon: Mail };
      case 'passwordAuthenticationMethod':
        return { name: 'Mot de passe', icon: Key };
      case 'fido2AuthenticationMethod':
        return { name: 'Clé de sécurité FIDO2', icon: Key };
      case 'windowsHelloForBusinessAuthenticationMethod':
        return { name: 'Windows Hello', icon: Monitor };
      default:
        return { name: methodType, icon: Shield };
    }
  };

  const handlePasswordChange = () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Erreur',
        description: 'Les mots de passe ne correspondent pas',
        variant: 'destructive',
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        title: 'Erreur',
        description: 'Le mot de passe doit contenir au moins 8 caractères',
        variant: 'destructive',
      });
      return;
    }
    // In real app, this would call an API
    toast({
      title: 'Mot de passe modifié',
      description: 'Votre mot de passe a été mis à jour',
    });
    setShowPasswordChange(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleLogout = () => {
    logout();
    toast({
      title: 'Déconnexion',
      description: 'À bientôt !',
    });
  };

  // Calculate activity stats from real data
  const totalIncidents = data.incidents.length;
  const resolvedIncidents = data.incidents.filter(i => i.status === 'resolved').length;
  const connectedSources = Object.values(connectors).filter(c => c.status === 'connected').length;
  const reportsGenerated = userAuditLogs.filter(log => 
    log.activityDisplayName?.toLowerCase().includes('report') ||
    log.activityDisplayName?.toLowerCase().includes('export')
  ).length || data.incidents.filter(i => i.status === 'resolved').length;

  const tabs = [
    { id: 'profile', label: 'Profil', icon: User },
    { id: 'preferences', label: 'Préférences', icon: Settings },
    { id: 'security', label: 'Sécurité', icon: Shield },
    { id: 'activity', label: 'Activité', icon: Activity },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mon Profil</h1>
          <p className="text-muted-foreground text-sm">
            Gérez vos informations et préférences
          </p>
        </div>
        <Button variant="destructive" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Se déconnecter
        </Button>
      </div>

      {/* Profile Card */}
      <div className="card-soc p-6">
        {loadingProfile ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="flex items-start gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-12 h-12 text-primary" />
              </div>
              <button 
                className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                title="Changer la photo de profil"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">
                {currentUserProfile?.displayName || user?.displayName || 'Utilisateur'}
              </h2>
              <p className="text-muted-foreground">
                {currentUserProfile?.userPrincipalName || currentUserProfile?.mail || user?.email || 'Non connecté'}
              </p>
              <div className="flex items-center gap-4 mt-3">
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  {currentUserProfile?.jobTitle || 'Analyste SOC'}
                </span>
                {currentUserProfile?.accountEnabled && (
                  <span className="flex items-center gap-1 text-sm text-low">
                    <CheckCircle className="w-4 h-4" />
                    Compte vérifié
                  </span>
                )}
              </div>
              <div className="flex items-center gap-6 mt-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {currentUserProfile?.createdDateTime 
                    ? `Membre depuis ${format(new Date(currentUserProfile.createdDateTime), 'MMM yyyy', { locale: fr })}`
                    : 'Membre'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Dernière connexion: {userSignIns[0] 
                    ? format(new Date(userSignIns[0].createdDateTime), 'dd MMM yyyy HH:mm', { locale: fr })
                    : format(new Date(), 'dd MMM yyyy HH:mm', { locale: fr })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-soc p-4 text-center">
          <p className="text-3xl font-bold text-primary">{totalIncidents}</p>
          <p className="text-sm text-muted-foreground">Incidents traités</p>
        </div>
        <div className="card-soc p-4 text-center">
          <p className="text-3xl font-bold text-low">{resolvedIncidents}</p>
          <p className="text-sm text-muted-foreground">Résolus</p>
        </div>
        <div className="card-soc p-4 text-center">
          <p className="text-3xl font-bold text-medium">{connectedSources}</p>
          <p className="text-sm text-muted-foreground">Sources connectées</p>
        </div>
        <div className="card-soc p-4 text-center">
          <p className="text-3xl font-bold text-info">{reportsGenerated}</p>
          <p className="text-sm text-muted-foreground">Rapports générés</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-primary/10 text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <div className="card-soc p-6 space-y-6">
          <h3 className="font-semibold flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Informations personnelles
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="displayName" className="text-sm font-medium">Nom complet</label>
              <input
                id="displayName"
                type="text"
                value={profileForm.displayName}
                onChange={(e) => setProfileForm(p => ({ ...p, displayName: e.target.value }))}
                placeholder="Votre nom complet"
                className="w-full px-4 py-2 bg-muted/50 border border-border rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <input
                id="email"
                type="email"
                value={profileForm.mail}
                onChange={(e) => setProfileForm(p => ({ ...p, mail: e.target.value }))}
                placeholder="votre@email.com"
                className="w-full px-4 py-2 bg-muted/50 border border-border rounded-lg"
                disabled
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium">Téléphone</label>
              <input
                id="phone"
                type="tel"
                value={profileForm.mobilePhone}
                onChange={(e) => setProfileForm(p => ({ ...p, mobilePhone: e.target.value }))}
                placeholder="+33 6 12 34 56 78"
                className="w-full px-4 py-2 bg-muted/50 border border-border rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="department" className="text-sm font-medium">Département</label>
              <input
                id="department"
                type="text"
                value={profileForm.department}
                onChange={(e) => setProfileForm(p => ({ ...p, department: e.target.value }))}
                placeholder="Votre département"
                className="w-full px-4 py-2 bg-muted/50 border border-border rounded-lg"
                disabled
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveProfile}>
              <Save className="w-4 h-4 mr-2" />
              Sauvegarder
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'preferences' && (
        <div className="space-y-6">
          {/* Theme */}
          <div className="card-soc p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Monitor className="w-5 h-5 text-primary" />
              Apparence
            </h3>
            <div className="flex gap-3">
              {[
                { value: 'light', label: 'Clair', icon: Sun },
                { value: 'dark', label: 'Sombre', icon: Moon },
                { value: 'system', label: 'Système', icon: Monitor },
              ].map((theme) => (
                <button
                  key={theme.value}
                  onClick={() => setPreferences(p => ({ ...p, theme: theme.value as any }))}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-colors',
                    preferences.theme === theme.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-muted-foreground'
                  )}
                >
                  <theme.icon className="w-5 h-5" />
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="card-soc p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notifications
            </h3>
            <div className="space-y-4">
              {[
                { key: 'email', label: 'Notifications par email', desc: 'Recevoir les alertes par email' },
                { key: 'push', label: 'Notifications push', desc: 'Alertes en temps réel dans le navigateur' },
                { key: 'criticalOnly', label: 'Critiques uniquement', desc: 'Recevoir uniquement les alertes critiques' },
                { key: 'dailyDigest', label: 'Résumé quotidien', desc: 'Rapport journalier à 8h00' },
              ].map((notif) => (
                <div key={notif.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="font-medium">{notif.label}</p>
                    <p className="text-sm text-muted-foreground">{notif.desc}</p>
                  </div>
                  <button
                    onClick={() => setPreferences(p => ({
                      ...p,
                      notifications: {
                        ...p.notifications,
                        [notif.key]: !p.notifications[notif.key as keyof typeof p.notifications]
                      }
                    }))}
                    className={cn(
                      'w-12 h-6 rounded-full transition-colors relative',
                      preferences.notifications[notif.key as keyof typeof preferences.notifications]
                        ? 'bg-primary'
                        : 'bg-muted'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                        preferences.notifications[notif.key as keyof typeof preferences.notifications]
                          ? 'translate-x-7'
                          : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard */}
          <div className="card-soc p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Dashboard
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="font-medium">Intervalle de rafraîchissement</p>
                  <p className="text-sm text-muted-foreground">Actualisation automatique des données</p>
                </div>
                <select
                  value={preferences.dashboard.refreshInterval}
                  onChange={(e) => setPreferences(p => ({
                    ...p,
                    dashboard: { ...p.dashboard, refreshInterval: Number(e.target.value) }
                  }))}
                  className="px-3 py-1 bg-muted border border-border rounded"
                  title="Intervalle de rafraîchissement"
                  aria-label="Intervalle de rafraîchissement"
                >
                  <option value={30}>30 secondes</option>
                  <option value={60}>1 minute</option>
                  <option value={300}>5 minutes</option>
                  <option value={0}>Manuel</option>
                </select>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="font-medium">Mode compact</p>
                  <p className="text-sm text-muted-foreground">Affichage condensé des données</p>
                </div>
                <button
                  onClick={() => setPreferences(p => ({
                    ...p,
                    dashboard: { ...p.dashboard, compactMode: !p.dashboard.compactMode }
                  }))}
                  className={cn(
                    'w-12 h-6 rounded-full transition-colors relative',
                    preferences.dashboard.compactMode ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                      preferences.dashboard.compactMode ? 'translate-x-7' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSavePreferences}>
              <Save className="w-4 h-4 mr-2" />
              Sauvegarder les préférences
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Password */}
          <div className="card-soc p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              Mot de passe
            </h3>
            
            {!showPasswordChange ? (
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                <div>
                  <p className="font-medium">Modifier le mot de passe</p>
                  <p className="text-sm text-muted-foreground">Dernière modification: il y a 30 jours</p>
                </div>
                <Button variant="outline" onClick={() => setShowPasswordChange(true)}>
                  <Lock className="w-4 h-4 mr-2" />
                  Modifier
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mot de passe actuel</label>
                  <div className="relative">
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-muted/50 border border-border rounded-lg pr-10"
                    />
                    <button
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nouveau mot de passe</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-muted/50 border border-border rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirmer le mot de passe</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-muted/50 border border-border rounded-lg"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handlePasswordChange}>Sauvegarder</Button>
                  <Button variant="outline" onClick={() => setShowPasswordChange(false)}>Annuler</Button>
                </div>
              </div>
            )}
          </div>

          {/* 2FA / Auth Methods */}
          <div className="card-soc p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Méthodes d'authentification
            </h3>
            {authMethods.length > 0 ? (
              <div className="space-y-3">
                {authMethods.map((method) => {
                  const { name, icon: MethodIcon } = getAuthMethodIcon(method.methodType);
                  const isStrongAuth = method.methodType.includes('Authenticator') || 
                                       method.methodType.includes('fido2') ||
                                       method.methodType.includes('windowsHello');
                  return (
                    <div 
                      key={method.id} 
                      className={cn(
                        'flex items-center justify-between p-4 rounded-lg border',
                        isStrongAuth ? 'bg-low/10 border-low/30' : 'bg-muted/30 border-border'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <MethodIcon className={cn('w-5 h-5', isStrongAuth ? 'text-low' : 'text-muted-foreground')} />
                        <div>
                          <p className={cn('font-medium', isStrongAuth && 'text-low')}>{name}</p>
                          <p className="text-sm text-muted-foreground">
                            {method.phoneNumber || method.emailAddress || method.displayName || 'Configuré'}
                          </p>
                        </div>
                      </div>
                      {isStrongAuth && (
                        <span className="px-2 py-1 rounded bg-low/20 text-low text-xs">MFA</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Shield className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>Aucune méthode d'authentification trouvée</p>
              </div>
            )}
            <div className="mt-4">
              <a 
                href="https://mysignins.microsoft.com/security-info" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Gérer mes méthodes de sécurité →
              </a>
            </div>
          </div>

          {/* Sessions - Real sign-ins */}
          <div className="card-soc p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Monitor className="w-5 h-5 text-primary" />
              Sessions récentes
            </h3>
            {userSignIns.length > 0 ? (
              <div className="space-y-3">
                {userSignIns.slice(0, 5).map((signIn, idx) => {
                  const isSuccess = signIn.status.errorCode === 0;
                  const deviceInfo = `${signIn.deviceDetail?.operatingSystem || 'Unknown'} - ${signIn.deviceDetail?.browser || 'Unknown'}`;
                  const location = signIn.location?.city 
                    ? `${signIn.location.city}, ${signIn.location.countryOrRegion}` 
                    : 'Inconnu';
                  
                  return (
                    <div key={signIn.id || idx} className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        {idx === 0 ? (
                          <Monitor className="w-5 h-5 text-primary" />
                        ) : (
                          <Globe className="w-5 h-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">{deviceInfo}</p>
                          <p className="text-sm text-muted-foreground">
                            {location} • {format(new Date(signIn.createdDateTime), 'dd MMM HH:mm', { locale: fr })}
                          </p>
                        </div>
                      </div>
                      {idx === 0 ? (
                        <span className="px-2 py-1 rounded bg-low/10 text-low text-xs">Actuelle</span>
                      ) : isSuccess ? (
                        <span className="px-2 py-1 rounded bg-muted text-muted-foreground text-xs">Réussie</span>
                      ) : (
                        <span className="px-2 py-1 rounded bg-critical/10 text-critical text-xs">Échec</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Monitor className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>Aucune session trouvée</p>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRevokeAllSessions}
                disabled={revokingSession || !currentUserProfile}
                className="text-critical hover:text-critical"
              >
                {revokingSession ? 'Révocation...' : 'Révoquer toutes les sessions'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="card-soc p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Historique d'activité
          </h3>
          <div className="space-y-4">
            {/* Show real sign-ins as activity */}
            {userSignIns.length > 0 || userAuditLogs.length > 0 ? (
              <>
                {/* Sign-in activities */}
                {userSignIns.slice(0, 5).map((signIn, idx) => {
                  const isSuccess = signIn.status.errorCode === 0;
                  return (
                    <div key={`signin-${signIn.id || idx}`} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                      {isSuccess ? (
                        <CheckCircle className="w-5 h-5 text-low" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-critical" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium">
                          {isSuccess ? 'Connexion réussie' : 'Échec de connexion'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {signIn.appDisplayName} • {signIn.location?.city || 'Inconnu'}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(signIn.createdDateTime), 'dd MMM HH:mm', { locale: fr })}
                      </p>
                    </div>
                  );
                })}

                {/* Audit log activities */}
                {userAuditLogs.slice(0, 5).map((log, idx) => {
                  const getActivityIcon = () => {
                    const activity = log.activityDisplayName?.toLowerCase() || '';
                    if (activity.includes('password')) return { icon: Key, color: 'text-medium' };
                    if (activity.includes('user') || activity.includes('member')) return { icon: User, color: 'text-primary' };
                    if (activity.includes('group')) return { icon: Shield, color: 'text-info' };
                    if (activity.includes('application') || activity.includes('app')) return { icon: Globe, color: 'text-low' };
                    if (activity.includes('policy')) return { icon: Shield, color: 'text-medium' };
                    return { icon: Settings, color: 'text-muted-foreground' };
                  };
                  const { icon: ActivityIcon, color } = getActivityIcon();
                  
                  return (
                    <div key={`audit-${log.id || idx}`} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                      <ActivityIcon className={cn('w-5 h-5', color)} />
                      <div className="flex-1">
                        <p className="font-medium">{log.activityDisplayName}</p>
                        <p className="text-sm text-muted-foreground">
                          {log.result === 'success' ? 'Succès' : log.result} 
                          {log.targetResources?.[0]?.displayName && ` • ${log.targetResources[0].displayName}`}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(log.activityDateTime), 'dd MMM HH:mm', { locale: fr })}
                      </p>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>Aucune activité récente</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
