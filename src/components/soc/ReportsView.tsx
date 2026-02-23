import { useState } from 'react';
import { 
  mockReportTemplates, mockWeeklySummary, mockMetrics,
  mockIncidents, mockAnomalies, mockDevices
} from '@/data/mockData';
import { ReportTemplate } from '@/types/soc';
import { Button } from '@/components/ui/button';
import { 
  FileText, Download, Calendar, Clock, Mail, 
  Plus, Settings, Play, Pause, CheckCircle, XCircle,
  Filter, RefreshCw, Send, Eye, Edit, Trash2,
  BarChart3, PieChart, TrendingUp, Shield, Users, Laptop,
  Loader2, WifiOff
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSOC } from '@/context/SOCContext';
import { 
  generateReportData, 
  exportToCSV, 
  exportToHTML, 
  downloadReport,
  ReportData,
  getScheduledReports,
  addScheduledReport,
  deleteScheduledReport,
  updateScheduledReport,
  ScheduledReport
} from '@/services/reportService';
import { useToast } from '@/hooks/use-toast';

const reportTypeIcons: Record<string, any> = {
  security_summary: Shield,
  identity_access: Users,
  endpoint_compliance: Laptop,
  email_security: Mail,
  custom: FileText,
};

const reportTypeLabels: Record<string, string> = {
  security_summary: 'Sécurité',
  identity_access: 'Identité & Accès',
  endpoint_compliance: 'Conformité Endpoints',
  email_security: 'Sécurité Email',
  custom: 'Personnalisé',
};

export function ReportsView() {
  const { toast } = useToast();
  const { isConfigured, config } = useSOC();
  const [selectedPeriod, setSelectedPeriod] = useState<'24h' | '7d' | '30d'>('7d');
  const [selectedModules, setSelectedModules] = useState<string[]>(['defender', 'entra', 'intune', 'exchange']);
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'html'>('html');
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>(getScheduledReports());

  const toggleModule = (module: string) => {
    setSelectedModules(prev => 
      prev.includes(module) 
        ? prev.filter(m => m !== module)
        : [...prev, module]
    );
  };

  const handleGenerateReport = async () => {
    if (!isConfigured || !config) {
      toast({
        title: 'Configuration requise',
        description: 'Configurez vos credentials Azure dans les Paramètres',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const data = await generateReportData(config, selectedPeriod);
      setReportData(data);
      toast({
        title: 'Rapport généré',
        description: `Données collectées pour la période ${selectedPeriod}`,
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de générer le rapport',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadReport = () => {
    if (!reportData) return;

    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm');
    
    if (selectedFormat === 'csv') {
      const content = exportToCSV(reportData);
      downloadReport(content, `security-report_${timestamp}.csv`, 'csv');
    } else {
      const content = exportToHTML(reportData);
      downloadReport(content, `security-report_${timestamp}.html`, 'html');
    }

    toast({
      title: 'Téléchargement',
      description: `Rapport exporté en ${selectedFormat.toUpperCase()}`,
    });
  };

  const handleScheduleReport = () => {
    const newReport = addScheduledReport({
      name: `Rapport ${selectedPeriod}`,
      type: 'full',
      frequency: 'weekly',
      dayOfWeek: 1,
      time: '08:00',
      recipients: [],
      format: selectedFormat,
      enabled: true,
    });
    setScheduledReports(getScheduledReports());
    toast({
      title: 'Rapport planifié',
      description: 'Le rapport a été ajouté au calendrier',
    });
  };

  const handleDeleteScheduled = (id: string) => {
    deleteScheduledReport(id);
    setScheduledReports(getScheduledReports());
    toast({
      title: 'Supprimé',
      description: 'Rapport planifié supprimé',
    });
  };

  const getFrequencyLabel = (schedule?: ReportTemplate['schedule']) => {
    if (!schedule) return 'Manuel';
    switch (schedule.frequency) {
      case 'daily': return 'Quotidien';
      case 'weekly': return `Hebdo (${['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][schedule.dayOfWeek || 0]})`;
      case 'monthly': return `Mensuel (J${schedule.dayOfMonth})`;
      default: return 'Manuel';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Centre de Rapports</h1>
          <p className="text-muted-foreground text-sm">
            Générez, planifiez et exportez vos rapports de sécurité
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            Calendrier
          </Button>
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Nouveau Rapport
          </Button>
        </div>
      </div>

      <Tabs defaultValue="generator" className="space-y-4">
        <TabsList className="bg-muted/30">
          <TabsTrigger value="generator">Générateur</TabsTrigger>
          <TabsTrigger value="templates">
            Templates
            <span className="ml-2 px-1.5 py-0.5 rounded bg-primary/20 text-primary text-xs">
              {mockReportTemplates.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="scheduled">Planifiés</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        {/* Report Generator Tab */}
        <TabsContent value="generator" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Generator Form */}
            <div className="lg:col-span-2 space-y-4">
              <div className="card-soc p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Configuration du Rapport
                </h3>

                {/* Period Selection */}
                <div className="space-y-2 mb-6">
                  <label className="text-sm font-medium">Période</label>
                  <div className="flex gap-2">
                    {[
                      { value: '24h', label: '24 heures' },
                      { value: '7d', label: '7 jours' },
                      { value: '30d', label: '30 jours' },
                      { value: 'custom', label: 'Personnalisé' },
                    ].map((period) => (
                      <button
                        key={period.value}
                        onClick={() => setSelectedPeriod(period.value as any)}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                          selectedPeriod === period.value
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {period.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Modules Selection */}
                <div className="space-y-2 mb-6">
                  <label className="text-sm font-medium">Modules à inclure</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'defender', label: 'Defender XDR', icon: Shield },
                      { id: 'entra', label: 'Entra ID', icon: Users },
                      { id: 'intune', label: 'Intune', icon: Laptop },
                      { id: 'exchange', label: 'Exchange', icon: Mail },
                    ].map((module) => {
                      const Icon = module.icon;
                      return (
                        <button
                          key={module.id}
                          onClick={() => toggleModule(module.id)}
                          className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                            selectedModules.includes(module.id)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          {module.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Format Selection */}
                <div className="space-y-2 mb-6">
                  <label className="text-sm font-medium">Format d'export</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'html', label: 'HTML', desc: 'Rapport formaté' },
                      { value: 'csv', label: 'CSV', desc: 'Données brutes' },
                    ].map((fmt) => (
                      <button
                        key={fmt.value}
                        onClick={() => setSelectedFormat(fmt.value as 'csv' | 'html')}
                        className={cn(
                          'flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors border',
                          selectedFormat === fmt.value
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50'
                        )}
                      >
                        <div className="font-semibold">{fmt.label}</div>
                        <div className="text-xs opacity-70">{fmt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {!isConfigured && (
                  <div className="mb-4 p-3 rounded-lg bg-medium/10 border border-medium/30 text-medium text-sm flex items-center gap-2">
                    <WifiOff className="w-4 h-4" />
                    Configurez vos credentials Azure dans les Paramètres pour générer des rapports avec de vraies données.
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-border">
                  <Button 
                    className="flex-1" 
                    onClick={handleGenerateReport}
                    disabled={isGenerating || !isConfigured}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Génération...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Générer Maintenant
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleDownloadReport}
                    disabled={!reportData}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger
                  </Button>
                  <Button variant="outline" onClick={handleScheduleReport} disabled={!isConfigured}>
                    <Calendar className="w-4 h-4 mr-2" />
                    Planifier
                  </Button>
                </div>
              </div>

              {/* Quick Reports */}
              <div className="card-soc p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Rapports Prédéfinis
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { name: 'Weekly Security Summary', desc: 'Synthèse management (5-10 lignes)', type: 'security_summary' },
                    { name: 'SOC Weekly Ops', desc: 'Incidents par sévérité, tendances', type: 'security_summary' },
                    { name: 'Identity & Access', desc: 'Échecs, anomalies, MFA', type: 'identity_access' },
                    { name: 'Endpoint Compliance', desc: 'Non conformes, OS, chiffrement', type: 'endpoint_compliance' },
                  ].map((report) => {
                    const Icon = reportTypeIcons[report.type];
                    return (
                      <button
                        key={report.name}
                        className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="p-2 rounded-lg bg-primary/20">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{report.name}</p>
                          <p className="text-xs text-muted-foreground">{report.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Preview Panel */}
            <div className="space-y-4">
              <div className="card-soc p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  {reportData ? 'Données du Rapport' : 'Aperçu (données exemple)'}
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="p-3 rounded bg-muted/30">
                    <p className="font-medium mb-1">📊 Métriques incluses</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• {reportData?.incidents.active ?? mockMetrics.activeIncidents} incidents actifs</li>
                      <li>• {reportData?.signIns.risky ?? mockMetrics.riskySignIns24h} connexions risquées</li>
                      <li>• {reportData?.devices.nonCompliant ?? mockMetrics.nonCompliantDevices} devices non conformes</li>
                    </ul>
                  </div>
                  <div className="p-3 rounded bg-muted/30">
                    <p className="font-medium mb-1">💡 Recommandations</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {(reportData?.recommendations ?? mockWeeklySummary.recommendations).slice(0, 3).map((rec, idx) => (
                        <li key={idx}>• {rec.slice(0, 60)}{rec.length > 60 ? '...' : ''}</li>
                      ))}
                    </ul>
                  </div>
                  {reportData && (
                    <div className="p-3 rounded bg-low/10 border border-low/30">
                      <p className="font-medium mb-1 text-low">✅ Rapport prêt</p>
                      <p className="text-xs text-muted-foreground">
                        Généré le {format(reportData.generatedAt, 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="card-soc p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Stats Rapides
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded bg-critical/10 text-center">
                    <p className="text-2xl font-bold text-critical">
                      {reportData?.incidents.bySeverity.critical ?? mockIncidents.filter(i => i.severity === 'critical').length}
                    </p>
                    <p className="text-xs text-muted-foreground">Critiques</p>
                  </div>
                  <div className="p-3 rounded bg-high/10 text-center">
                    <p className="text-2xl font-bold text-high">
                      {reportData?.incidents.bySeverity.high ?? mockIncidents.filter(i => i.severity === 'high').length}
                    </p>
                    <p className="text-xs text-muted-foreground">Élevés</p>
                  </div>
                  <div className="p-3 rounded bg-medium/10 text-center">
                    <p className="text-2xl font-bold text-medium">
                      {reportData?.signIns.failed ?? mockAnomalies.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Échecs Sign-in</p>
                  </div>
                  <div className="p-3 rounded bg-low/10 text-center">
                    <p className="text-2xl font-bold text-low">
                      {reportData?.devices.compliant ?? mockDevices.filter(d => d.complianceState === 'compliant').length}
                    </p>
                    <p className="text-xs text-muted-foreground">Conformes</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="card-soc p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Templates de Rapports</h3>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Créer Template
              </Button>
            </div>

            <div className="space-y-3">
              {mockReportTemplates.map((template) => {
                const Icon = reportTypeIcons[template.type];
                return (
                  <div
                    key={template.id}
                    className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="p-3 rounded-lg bg-primary/20">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{template.name}</p>
                        <span className={cn(
                          'px-2 py-0.5 rounded text-xs',
                          template.isActive ? 'bg-low/20 text-low' : 'bg-muted text-muted-foreground'
                        )}>
                          {template.isActive ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {getFrequencyLabel(template.schedule)}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {template.format.toUpperCase()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {template.recipients.length} destinataire(s)
                        </span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {template.lastGenerated && (
                        <p>Dernier: {formatDistanceToNow(template.lastGenerated, { addSuffix: true, locale: fr })}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon">
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Scheduled Tab */}
        <TabsContent value="scheduled" className="space-y-4">
          <div className="card-soc p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Rapports Planifiés</h3>
              <Button size="sm" onClick={handleScheduleReport} disabled={!isConfigured}>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau rapport planifié
              </Button>
            </div>

            {scheduledReports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucun rapport planifié</p>
                <p className="text-sm">Créez un rapport planifié pour recevoir des rapports automatiquement</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduledReports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className={cn(
                      'p-2 rounded-lg',
                      report.enabled ? 'bg-low/20' : 'bg-muted'
                    )}>
                      {report.enabled ? (
                        <CheckCircle className="w-4 h-4 text-low" />
                      ) : (
                        <Pause className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{report.name}</p>
                        <span className={cn(
                          'px-2 py-0.5 rounded text-xs',
                          report.enabled ? 'bg-low/20 text-low' : 'bg-muted text-muted-foreground'
                        )}>
                          {report.enabled ? 'Actif' : 'Suspendu'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {report.frequency === 'daily' ? 'Quotidien' : 
                           report.frequency === 'weekly' ? `Hebdo (${['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][report.dayOfWeek || 0]})` :
                           `Mensuel (J${report.dayOfMonth})`} à {report.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {report.format.toUpperCase()}
                        </span>
                        {report.nextRun && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Prochain: {format(new Date(report.nextRun), 'dd/MM HH:mm', { locale: fr })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        title={report.enabled ? 'Suspendre' : 'Activer'}
                        onClick={() => {
                          updateScheduledReport(report.id, { enabled: !report.enabled });
                          setScheduledReports(getScheduledReports());
                        }}
                      >
                        {report.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        title="Supprimer"
                        onClick={() => handleDeleteScheduled(report.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <div className="card-soc p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Historique des Rapports Générés</h3>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filtrer
              </Button>
            </div>

            <div className="space-y-2">
              {[
                { name: 'Weekly Security Summary', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), format: 'pdf', status: 'sent', recipients: 2 },
                { name: 'Identity & Access Weekly', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), format: 'pdf', status: 'sent', recipients: 1 },
                { name: 'Endpoint Compliance Weekly', date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), format: 'csv', status: 'downloaded', recipients: 0 },
                { name: 'Daily Incidents Report', date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), format: 'html', status: 'failed', recipients: 0 },
              ].map((report, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div className={cn(
                    'p-2 rounded-lg',
                    report.status === 'sent' && 'bg-low/20',
                    report.status === 'downloaded' && 'bg-primary/20',
                    report.status === 'failed' && 'bg-critical/20'
                  )}>
                    {report.status === 'sent' && <Send className="w-4 h-4 text-low" />}
                    {report.status === 'downloaded' && <Download className="w-4 h-4 text-primary" />}
                    {report.status === 'failed' && <XCircle className="w-4 h-4 text-critical" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{report.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(report.date, 'dd/MM/yyyy HH:mm', { locale: fr })} • {report.format.toUpperCase()}
                      {report.recipients > 0 && ` • ${report.recipients} destinataire(s)`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
