import { useState } from 'react';
import { useSOC } from '@/context/SOCContext';
import { GraphManagedDevice, syncDevice } from '@/services/graphApi';
import { MetricCard } from './MetricCard';
import { Button } from '@/components/ui/button';
import { 
  Laptop, CheckCircle, XCircle, Clock, Shield, Lock,
  AlertTriangle, Filter, RefreshCw, Search, Eye, 
  Smartphone, Monitor, HardDrive, Wifi, WifiOff, Loader2, RotateCw, Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { TeamsAlerts } from '@/services/teamsWebhook';

export function DevicesView() {
  const { isConfigured, isLoading, data, refreshDevices, config } = useSOC();
  const { toast } = useToast();
  const [syncingDeviceId, setSyncingDeviceId] = useState<string | null>(null);
  const [alertingDeviceId, setAlertingDeviceId] = useState<string | null>(null);
  const [complianceFilter, setComplianceFilter] = useState<'all' | 'compliant' | 'noncompliant'>('all');
  const [showOldCheckIn, setShowOldCheckIn] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<GraphManagedDevice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const compliantDevices = data.devices.filter(d => d.complianceState === 'compliant');
  const nonCompliantDevices = data.devices.filter(d => d.complianceState === 'noncompliant');
  const oldCheckInDevices = data.devices.filter(d => 
    new Date().getTime() - new Date(d.lastSyncDateTime).getTime() > 24 * 60 * 60 * 1000
  );
  const notEncryptedDevices = data.devices.filter(d => !d.isEncrypted);

  const filteredDevices = data.devices.filter(device => {
    if (complianceFilter !== 'all' && device.complianceState !== complianceFilter) return false;
    if (showOldCheckIn) {
      const hoursSinceCheckIn = (new Date().getTime() - new Date(device.lastSyncDateTime).getTime()) / (1000 * 60 * 60);
      if (hoursSinceCheckIn < 24) return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!device.deviceName.toLowerCase().includes(query) &&
          !device.userPrincipalName.toLowerCase().includes(query)) {
        return false;
      }
    }
    return true;
  });

  const totalDevices = data.devices.length;
  const complianceRate = totalDevices > 0 ? Math.round((compliantDevices.length / totalDevices) * 100) : 0;

  // Sync device action
  const handleSyncDevice = async (device: GraphManagedDevice) => {
    if (!config) return;
    setSyncingDeviceId(device.id);
    try {
      await syncDevice(config, device.id);
      toast({
        title: '✅ Synchronisation lancée',
        description: `L'appareil ${device.deviceName} va se synchroniser.`,
      });
    } catch (error: any) {
      toast({
        title: '❌ Erreur',
        description: error.message || 'Impossible de synchroniser l\'appareil',
        variant: 'destructive',
      });
    } finally {
      setSyncingDeviceId(null);
    }
  };

  // Send Teams alert for non-compliant device
  const handleSendNonComplianceAlert = async (device: GraphManagedDevice) => {
    setAlertingDeviceId(device.id);
    try {
      const issues: string[] = [];
      if (!device.isEncrypted) issues.push('Chiffrement désactivé');
      if (device.complianceState === 'noncompliant') issues.push('Non conforme aux politiques');
      const hoursSinceSync = (new Date().getTime() - new Date(device.lastSyncDateTime).getTime()) / (1000 * 60 * 60);
      if (hoursSinceSync > 24) issues.push(`Dernière sync: ${Math.round(hoursSinceSync)}h`);
      
      const result = await TeamsAlerts.nonCompliantDevice(
        device.deviceName,
        device.userPrincipalName,
        issues.join(', ') || 'Appareil non conforme',
        `${device.operatingSystem} ${device.osVersion}`
      );
      
      if (result.success) {
        toast({
          title: '📢 Alerte envoyée',
          description: `Notification Teams envoyée pour ${device.deviceName}`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        title: '❌ Erreur',
        description: error.message || 'Impossible d\'envoyer l\'alerte',
        variant: 'destructive',
      });
    } finally {
      setAlertingDeviceId(null);
    }
  };

  if (!isConfigured) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="card-soc p-8 text-center">
          <WifiOff className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Configuration Requise</h2>
          <p className="text-muted-foreground mb-6">
            Configurez votre App Registration dans les Paramètres pour voir les appareils.
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
          <h1 className="text-2xl font-bold">Appareils Intune</h1>
          <p className="text-muted-foreground text-sm">
            État de conformité et gestion du parc
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refreshDevices()} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Actualiser
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Appareils"
          value={totalDevices}
          icon={Laptop}
          variant="default"
        />
        <MetricCard
          title="Conformes"
          value={compliantDevices.length}
          subtitle={`${complianceRate}%`}
          icon={CheckCircle}
          variant="success"
        />
        <MetricCard
          title="Non Conformes"
          value={nonCompliantDevices.length}
          icon={XCircle}
          variant={nonCompliantDevices.length > 0 ? 'critical' : 'default'}
        />
        <MetricCard
          title="Non Chiffrés"
          value={notEncryptedDevices.length}
          icon={Lock}
          variant={notEncryptedDevices.length > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* Critical Alert */}
      {nonCompliantDevices.length > 0 && (
        <div className="card-soc p-4 border-2 border-critical/30 bg-critical/5">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-critical" />
            <h3 className="font-semibold text-critical">
              {nonCompliantDevices.length} Appareil(s) Non Conforme(s)
            </h3>
          </div>
          <div className="space-y-2">
            {nonCompliantDevices.slice(0, 5).map((device) => (
              <div
                key={device.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-background/50 border border-border/50"
              >
                <span className="font-medium">{device.deviceName}</span>
                <span className="text-sm text-muted-foreground">{device.userPrincipalName}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {device.operatingSystem} {device.osVersion}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="bg-muted/30">
          <TabsTrigger value="all">Tous les Appareils</TabsTrigger>
          <TabsTrigger value="noncompliant">
            Non Conformes
            <span className="ml-2 px-1.5 py-0.5 rounded bg-critical/20 text-critical text-xs">
              {nonCompliantDevices.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
        </TabsList>

        {/* All Devices Tab */}
        <TabsContent value="all" className="space-y-4">
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
                    placeholder="Rechercher par nom, utilisateur..."
                    className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div className="flex gap-1">
                {(['all', 'compliant', 'noncompliant'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setComplianceFilter(status)}
                    className={cn(
                      'px-3 py-2 rounded text-xs font-medium transition-colors',
                      complianceFilter === status
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {status === 'all' ? 'Tous' : status === 'compliant' ? 'Conformes' : 'Non conformes'}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowOldCheckIn(!showOldCheckIn)}
                className={cn(
                  'px-3 py-2 rounded text-xs font-medium transition-colors flex items-center gap-1',
                  showOldCheckIn
                    ? 'bg-medium text-white'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                <Clock className="w-3 h-3" />
                Non vus &gt;24h
              </button>
            </div>
          </div>

          {/* Device List */}
          <div className="card-soc p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Appareils ({filteredDevices.length})</h2>
            </div>
            
            {isLoading && data.devices.length === 0 ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Chargement...</p>
              </div>
            ) : filteredDevices.length > 0 ? (
              <div className="space-y-2">
                {filteredDevices.slice(0, 50).map((device) => (
                  <div key={device.id}>
                    <div
                      onClick={() => setSelectedDevice(selectedDevice?.id === device.id ? null : device)}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        device.complianceState === 'compliant' ? 'bg-low' : 'bg-critical'
                      )} />
                      <Laptop className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{device.deviceName}</p>
                        <p className="text-xs text-muted-foreground truncate">{device.userPrincipalName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs">{device.operatingSystem}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(device.lastSyncDateTime), { addSuffix: true, locale: fr })}
                        </p>
                      </div>
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs shrink-0',
                        device.complianceState === 'compliant' && 'bg-low/20 text-low',
                        device.complianceState === 'noncompliant' && 'bg-critical/20 text-critical',
                        device.complianceState !== 'compliant' && device.complianceState !== 'noncompliant' && 'bg-muted text-muted-foreground'
                      )}>
                        {device.complianceState}
                      </span>
                    </div>
                    
                    {selectedDevice?.id === device.id && (
                      <div className="mt-2 p-4 rounded-lg bg-muted/30 border border-border/50 animate-fade-in">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Eye className="w-4 h-4 text-primary" />
                          Détails de l'appareil
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground block">Modèle</span>
                            <span className="font-medium">{device.model || 'Non renseigné'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Fabricant</span>
                            <span className="font-medium">{device.manufacturer || 'Non renseigné'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">OS</span>
                            <span className="font-medium">{device.operatingSystem} {device.osVersion}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Dernier Check-in</span>
                            <span className="font-medium">
                              {formatDistanceToNow(new Date(device.lastSyncDateTime), { addSuffix: true, locale: fr })}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Numéro de série</span>
                            <span className="font-medium font-mono text-xs">{device.serialNumber || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Chiffrement</span>
                            <span className={cn('font-medium', device.isEncrypted ? 'text-low' : 'text-critical')}>
                              {device.isEncrypted ? 'Activé' : 'Désactivé'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Enregistré le</span>
                            <span className="font-medium">
                              {formatDistanceToNow(new Date(device.enrolledDateTime), { addSuffix: true, locale: fr })}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Conformité</span>
                            <span className={cn(
                              'font-medium',
                              device.complianceState === 'compliant' ? 'text-low' : 'text-critical'
                            )}>
                              {device.complianceState}
                            </span>
                          </div>
                        </div>
                        
                        {/* Action buttons */}
                        <div className="mt-4 pt-4 border-t border-border/50 flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled={syncingDeviceId === device.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSyncDevice(device);
                            }}
                            title="Synchroniser l'appareil"
                          >
                            {syncingDeviceId === device.id ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <RotateCw className="w-4 h-4 mr-1" />
                            )}
                            Synchroniser
                          </Button>
                          
                          {device.complianceState === 'noncompliant' && (
                            <Button 
                              variant="default" 
                              size="sm"
                              disabled={alertingDeviceId === device.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendNonComplianceAlert(device);
                              }}
                              title="Envoyer une alerte Teams"
                            >
                              {alertingDeviceId === device.id ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <Bell className="w-4 h-4 mr-1" />
                              )}
                              Alerter Teams
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Aucun appareil trouvé
              </p>
            )}
          </div>
        </TabsContent>

        {/* Non Compliant Tab */}
        <TabsContent value="noncompliant" className="space-y-4">
          <div className="card-soc p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-critical" />
              Appareils Non Conformes ({nonCompliantDevices.length})
            </h3>
            {nonCompliantDevices.length > 0 ? (
              <div className="space-y-2">
                {nonCompliantDevices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-critical/5 border border-critical/20"
                  >
                    <Laptop className="w-4 h-4 text-critical shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{device.deviceName}</p>
                      <p className="text-xs text-muted-foreground">{device.userPrincipalName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs">{device.operatingSystem} {device.osVersion}</p>
                      <p className="text-xs text-muted-foreground">
                        Sync: {formatDistanceToNow(new Date(device.lastSyncDateTime), { addSuffix: true, locale: fr })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Tous les appareils sont conformes 🎉
              </p>
            )}
          </div>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Compliance */}
            <div className="card-soc p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                État de Conformité
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-low/10">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-low" />
                    <span>Conformes</span>
                  </div>
                  <span className="font-bold text-low">{compliantDevices.length}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-critical/10">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-critical" />
                    <span>Non Conformes</span>
                  </div>
                  <span className="font-bold text-critical">{nonCompliantDevices.length}</span>
                </div>
              </div>
            </div>

            {/* Encryption */}
            <div className="card-soc p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                Chiffrement
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-low/10">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-low" />
                    <span>Chiffrés</span>
                  </div>
                  <span className="font-bold text-low">
                    {data.devices.filter(d => d.isEncrypted).length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-critical/10">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-critical" />
                    <span>Non Chiffrés</span>
                  </div>
                  <span className="font-bold text-critical">{notEncryptedDevices.length}</span>
                </div>
              </div>
            </div>

            {/* OS Distribution */}
            <div className="card-soc p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-primary" />
                Systèmes d'exploitation
              </h3>
              <div className="space-y-2">
                {Object.entries(
                  data.devices.reduce((acc, d) => {
                    acc[d.operatingSystem] = (acc[d.operatingSystem] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).sort((a, b) => b[1] - a[1]).map(([os, count]) => (
                  <div key={os} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <span className="text-sm">{os}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Last Check-in */}
            <div className="card-soc p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Dernier Check-in
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-low/10">
                  <span>&lt; 24 heures</span>
                  <span className="font-bold text-low">
                    {data.devices.filter(d => 
                      (new Date().getTime() - new Date(d.lastSyncDateTime).getTime()) < 24 * 60 * 60 * 1000
                    ).length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-medium/10">
                  <span>24h - 7 jours</span>
                  <span className="font-bold text-medium">
                    {data.devices.filter(d => {
                      const diff = new Date().getTime() - new Date(d.lastSyncDateTime).getTime();
                      return diff >= 24 * 60 * 60 * 1000 && diff < 7 * 24 * 60 * 60 * 1000;
                    }).length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-critical/10">
                  <span>&gt; 7 jours</span>
                  <span className="font-bold text-critical">
                    {data.devices.filter(d => 
                      (new Date().getTime() - new Date(d.lastSyncDateTime).getTime()) >= 7 * 24 * 60 * 60 * 1000
                    ).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
