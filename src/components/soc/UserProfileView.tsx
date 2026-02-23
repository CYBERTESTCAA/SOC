import { useState, useEffect } from 'react';
import { useSOC } from '@/context/SOCContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User, Shield, Smartphone, Key, Users, Laptop, Globe, Clock, Mail,
  ChevronLeft, Loader2, CheckCircle, XCircle, AlertTriangle, Building,
  Calendar, Lock, Fingerprint, Phone, CreditCard, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  getUserDetails, getUserAuthenticationMethods, getUserGroups, getUserLicenses,
  getUserDevices, getUserSignIns, getUserSignInActivity,
  UserDetails, UserAuthMethod, GroupMembership, AssignedLicense, GraphManagedDevice, GraphSignIn
} from '@/services/graphApi';

interface UserProfileViewProps {
  userId: string;
  userPrincipalName: string;
  onBack: () => void;
}

export function UserProfileView({ userId, userPrincipalName, onBack }: UserProfileViewProps) {
  const { config } = useSOC();
  const [loading, setLoading] = useState(true);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [authMethods, setAuthMethods] = useState<UserAuthMethod[]>([]);
  const [groups, setGroups] = useState<GroupMembership[]>([]);
  const [licenses, setLicenses] = useState<AssignedLicense[]>([]);
  const [devices, setDevices] = useState<GraphManagedDevice[]>([]);
  const [signIns, setSignIns] = useState<GraphSignIn[]>([]);
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;

    setLoading(true);
    
    Promise.all([
      getUserDetails(config, userId),
      getUserAuthenticationMethods(config, userId),
      getUserGroups(config, userId),
      getUserLicenses(config, userId),
      getUserDevices(config, userId),
      getUserSignIns(config, userPrincipalName, 20),
      getUserSignInActivity(config, userId),
    ])
      .then(([details, methods, grps, lics, devs, signs, activity]) => {
        setUserDetails(details);
        setAuthMethods(methods);
        setGroups(grps);
        setLicenses(lics);
        setDevices(devs);
        setSignIns(signs);
        setLastSignIn(activity?.lastSignInDateTime || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [config, userId, userPrincipalName]);

  const getAuthMethodIcon = (type: string) => {
    switch (type) {
      case 'phoneAuthenticationMethod': return <Phone className="w-4 h-4" />;
      case 'emailAuthenticationMethod': return <Mail className="w-4 h-4" />;
      case 'fido2AuthenticationMethod': return <Key className="w-4 h-4" />;
      case 'microsoftAuthenticatorAuthenticationMethod': return <Smartphone className="w-4 h-4" />;
      case 'passwordAuthenticationMethod': return <Lock className="w-4 h-4" />;
      case 'windowsHelloForBusinessAuthenticationMethod': return <Fingerprint className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  const getAuthMethodName = (type: string) => {
    switch (type) {
      case 'phoneAuthenticationMethod': return 'Téléphone';
      case 'emailAuthenticationMethod': return 'Email';
      case 'fido2AuthenticationMethod': return 'Clé FIDO2';
      case 'microsoftAuthenticatorAuthenticationMethod': return 'Microsoft Authenticator';
      case 'passwordAuthenticationMethod': return 'Mot de passe';
      case 'windowsHelloForBusinessAuthenticationMethod': return 'Windows Hello';
      default: return type.replace('AuthenticationMethod', '');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <div className="card-soc p-12 text-center">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Chargement du profil utilisateur...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="outline" onClick={onBack}>
        <ChevronLeft className="w-4 h-4 mr-2" />
        Retour
      </Button>

      {/* User Header Card */}
      <div className="card-soc p-6">
        <div className="flex items-start gap-6">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <User className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{userDetails?.displayName || userPrincipalName}</h1>
              {userDetails?.accountEnabled ? (
                <span className="px-2 py-0.5 rounded text-xs bg-low/20 text-low flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Actif
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-xs bg-critical/20 text-critical flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Désactivé
                </span>
              )}
            </div>
            <p className="text-muted-foreground">{userDetails?.userPrincipalName}</p>
            {userDetails?.jobTitle && (
              <p className="text-sm text-muted-foreground mt-1">
                {userDetails.jobTitle} {userDetails.department && `• ${userDetails.department}`}
              </p>
            )}
          </div>
          <div className="text-right text-sm">
            <p className="text-muted-foreground">Dernière connexion</p>
            <p className="font-medium">
              {lastSignIn 
                ? formatDistanceToNow(new Date(lastSignIn), { addSuffix: true, locale: fr })
                : 'Inconnue'}
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Key className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Méthodes MFA</p>
              <p className="font-bold">{authMethods.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-medium/20">
              <Users className="w-4 h-4 text-medium" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Groupes</p>
              <p className="font-bold">{groups.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-high/20">
              <CreditCard className="w-4 h-4 text-high" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Licences</p>
              <p className="font-bold">{licenses.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-low/20">
              <Laptop className="w-4 h-4 text-low" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Appareils</p>
              <p className="font-bold">{devices.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Globe className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Connexions récentes</p>
              <p className="font-bold">{signIns.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="mfa" className="space-y-4">
        <TabsList className="bg-muted/30">
          <TabsTrigger value="mfa">
            <Key className="w-4 h-4 mr-2" />
            MFA
          </TabsTrigger>
          <TabsTrigger value="groups">
            <Users className="w-4 h-4 mr-2" />
            Groupes
          </TabsTrigger>
          <TabsTrigger value="licenses">
            <CreditCard className="w-4 h-4 mr-2" />
            Licences
          </TabsTrigger>
          <TabsTrigger value="devices">
            <Laptop className="w-4 h-4 mr-2" />
            Appareils
          </TabsTrigger>
          <TabsTrigger value="signins">
            <Globe className="w-4 h-4 mr-2" />
            Connexions
          </TabsTrigger>
        </TabsList>

        {/* MFA Tab */}
        <TabsContent value="mfa" className="space-y-4">
          <div className="card-soc p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Key className="w-4 h-4 text-primary" />
              Méthodes d'authentification
            </h3>
            {authMethods.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-high opacity-50" />
                <p>Aucune méthode MFA configurée</p>
                <p className="text-sm">Cet utilisateur n'a pas de protection MFA</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {authMethods.map((method) => (
                  <div
                    key={method.id}
                    className="p-4 rounded-lg bg-muted/30 border border-border/50 flex items-center gap-4"
                  >
                    <div className="p-3 rounded-lg bg-primary/20 text-primary">
                      {getAuthMethodIcon(method.methodType)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{getAuthMethodName(method.methodType)}</p>
                      {method.phoneNumber && <p className="text-sm text-muted-foreground">{method.phoneNumber}</p>}
                      {method.emailAddress && <p className="text-sm text-muted-foreground">{method.emailAddress}</p>}
                      {method.displayName && <p className="text-sm text-muted-foreground">{method.displayName}</p>}
                    </div>
                    <CheckCircle className="w-5 h-5 text-low" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Groups Tab */}
        <TabsContent value="groups" className="space-y-4">
          <div className="card-soc p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-medium" />
              Appartenance aux groupes ({groups.length})
            </h3>
            {groups.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Aucun groupe</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="p-3 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <p className="font-medium text-sm truncate">{group.displayName}</p>
                    {group.groupTypes && group.groupTypes.length > 0 && (
                      <p className="text-xs text-muted-foreground">{group.groupTypes.join(', ')}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Licenses Tab */}
        <TabsContent value="licenses" className="space-y-4">
          <div className="card-soc p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-high" />
              Licences assignées ({licenses.length})
            </h3>
            {licenses.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Aucune licence</p>
            ) : (
              <div className="space-y-3">
                {licenses.map((license) => (
                  <div
                    key={license.skuId}
                    className="p-4 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">{license.skuPartNumber || license.skuId}</p>
                      <CheckCircle className="w-4 h-4 text-low" />
                    </div>
                    {license.servicePlans && license.servicePlans.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {license.servicePlans.slice(0, 5).map((plan, idx) => (
                          <span
                            key={idx}
                            className={cn(
                              'text-xs px-2 py-0.5 rounded',
                              plan.provisioningStatus === 'Success' ? 'bg-low/20 text-low' : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {plan.servicePlanName}
                          </span>
                        ))}
                        {license.servicePlans.length > 5 && (
                          <span className="text-xs text-muted-foreground">
                            +{license.servicePlans.length - 5} autres
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-4">
          <div className="card-soc p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Laptop className="w-4 h-4 text-low" />
              Appareils gérés ({devices.length})
            </h3>
            {devices.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Aucun appareil</p>
            ) : (
              <div className="space-y-3">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className="p-4 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{device.deviceName}</p>
                        <p className="text-sm text-muted-foreground">
                          {device.operatingSystem} {device.osVersion}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Dernière synchro: {formatDistanceToNow(new Date(device.lastSyncDateTime), { addSuffix: true, locale: fr })}
                        </p>
                      </div>
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs',
                        device.complianceState === 'compliant' ? 'bg-low/20 text-low' : 'bg-critical/20 text-critical'
                      )}>
                        {device.complianceState === 'compliant' ? 'Conforme' : 'Non conforme'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Sign-ins Tab */}
        <TabsContent value="signins" className="space-y-4">
          <div className="card-soc p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              Connexions récentes ({signIns.length})
            </h3>
            {signIns.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Aucune connexion récente</p>
            ) : (
              <div className="space-y-2">
                {signIns.map((signIn) => (
                  <div
                    key={signIn.id}
                    className="p-3 rounded-lg bg-muted/30 border border-border/50 flex items-center gap-4"
                  >
                    <div className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      signIn.status.errorCode === 0 ? 'bg-low' : 'bg-critical'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{signIn.appDisplayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {signIn.ipAddress} • {signIn.location?.city || 'Unknown'}, {signIn.location?.countryOrRegion || ''}
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="text-muted-foreground">
                        {format(new Date(signIn.createdDateTime), 'dd/MM HH:mm', { locale: fr })}
                      </p>
                      {signIn.status.errorCode !== 0 && (
                        <p className="text-critical truncate max-w-[150px]">{signIn.status.failureReason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
