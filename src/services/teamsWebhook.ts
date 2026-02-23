/**
 * Microsoft Teams Webhook Integration
 * Envoie des alertes vers un canal Teams via Incoming Webhook
 * Templates modernes avec Adaptive Cards
 */

export type AlertType = 
  | 'incident'
  | 'forwarding_rule'
  | 'risky_user'
  | 'non_compliant_device'
  | 'report_generated';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface TeamsAlert {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  details?: Record<string, string>;
  timestamp?: Date;
}

// Couleurs pour les cartes Teams selon la sévérité
const severityColors: Record<AlertSeverity, string> = {
  critical: 'dc2626', // Rouge
  high: 'ea580c',     // Orange
  medium: 'ca8a04',   // Jaune
  low: '16a34a',      // Vert
  info: '3b82f6',     // Bleu
};

// Labels de sévérité en français
const severityLabels: Record<AlertSeverity, string> = {
  critical: '🔴 CRITIQUE',
  high: '🟠 ÉLEVÉ',
  medium: '🟡 MOYEN',
  low: '🟢 FAIBLE',
  info: '🔵 INFO',
};

/**
 * Template pour les incidents de sécurité
 */
function createIncidentCard(alert: TeamsAlert) {
  const timestamp = alert.timestamp || new Date();
  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": severityColors[alert.severity],
    "summary": `🚨 Incident: ${alert.title}`,
    "sections": [
      {
        "activityTitle": "🚨 **INCIDENT DE SÉCURITÉ**",
        "activitySubtitle": `Guardian View SOC • ${timestamp.toLocaleString('fr-FR')}`,
        "activityImage": "https://img.icons8.com/fluency/48/error.png",
        "facts": [
          { "name": "📋 Titre", "value": `**${alert.title}**` },
          { "name": "⚠️ Sévérité", "value": severityLabels[alert.severity] },
          { "name": "📝 Description", "value": alert.message },
          ...(alert.details ? Object.entries(alert.details).map(([name, value]) => ({ 
            name: `📌 ${name}`, 
            value: value 
          })) : []),
          { "name": "🕐 Détecté le", "value": timestamp.toLocaleString('fr-FR') },
        ],
        "markdown": true,
      },
    ],
    "potentialAction": [
      {
        "@type": "OpenUri",
        "name": "🔍 Voir dans Guardian View",
        "targets": [{ "os": "default", "uri": `${window.location.origin}?view=incidents` }],
      },
      {
        "@type": "OpenUri",
        "name": "📊 Ouvrir le Dashboard",
        "targets": [{ "os": "default", "uri": window.location.origin }],
      },
    ],
  };
}

/**
 * Template pour les règles de transfert suspectes
 */
function createForwardingRuleCard(alert: TeamsAlert) {
  const timestamp = alert.timestamp || new Date();
  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": severityColors[alert.severity],
    "summary": `📧 Règle de transfert: ${alert.title}`,
    "sections": [
      {
        "activityTitle": "📧 **RÈGLE DE TRANSFERT DÉTECTÉE**",
        "activitySubtitle": `Guardian View SOC • ${timestamp.toLocaleString('fr-FR')}`,
        "activityImage": "https://img.icons8.com/fluency/48/forward-arrow.png",
        "facts": [
          { "name": "👤 Utilisateur", "value": `**${alert.details?.['Utilisateur'] || 'N/A'}**` },
          { "name": "📨 Destination", "value": `\`${alert.details?.['Destination'] || 'N/A'}\`` },
          { "name": "⚠️ Risque", "value": severityLabels[alert.severity] },
          { "name": "📝 Détails", "value": alert.message },
          { "name": "🕐 Créée le", "value": timestamp.toLocaleString('fr-FR') },
        ],
        "markdown": true,
      },
      {
        "text": "⚠️ **Action recommandée**: Vérifier si cette règle est légitime. Les règles de transfert vers des domaines externes peuvent être utilisées pour l'exfiltration de données.",
        "markdown": true,
      },
    ],
    "potentialAction": [
      {
        "@type": "OpenUri",
        "name": "🔍 Voir dans Exchange",
        "targets": [{ "os": "default", "uri": `${window.location.origin}?view=exchange` }],
      },
    ],
  };
}

/**
 * Template pour les utilisateurs à risque
 */
function createRiskyUserCard(alert: TeamsAlert) {
  const timestamp = alert.timestamp || new Date();
  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": severityColors[alert.severity],
    "summary": `⚠️ Utilisateur à risque: ${alert.title}`,
    "sections": [
      {
        "activityTitle": "⚠️ **UTILISATEUR À RISQUE DÉTECTÉ**",
        "activitySubtitle": `Guardian View SOC • ${timestamp.toLocaleString('fr-FR')}`,
        "activityImage": "https://img.icons8.com/fluency/48/user-shield.png",
        "facts": [
          { "name": "👤 Utilisateur", "value": `**${alert.title}**` },
          { "name": "🎯 Niveau de risque", "value": severityLabels[alert.severity] },
          { "name": "📝 Raison", "value": alert.message },
          ...(alert.details ? Object.entries(alert.details).map(([name, value]) => ({ 
            name: `📌 ${name}`, 
            value: value 
          })) : []),
          { "name": "🕐 Détecté le", "value": timestamp.toLocaleString('fr-FR') },
        ],
        "markdown": true,
      },
      {
        "text": "🔒 **Actions possibles**: Réinitialiser le mot de passe, révoquer les sessions, activer MFA, ou bloquer temporairement le compte.",
        "markdown": true,
      },
    ],
    "potentialAction": [
      {
        "@type": "OpenUri",
        "name": "👤 Voir les connexions",
        "targets": [{ "os": "default", "uri": `${window.location.origin}?view=signins` }],
      },
      {
        "@type": "OpenUri",
        "name": "🔍 Investiguer",
        "targets": [{ "os": "default", "uri": `${window.location.origin}?view=investigation` }],
      },
    ],
  };
}

/**
 * Template pour les appareils non conformes
 */
function createNonCompliantDeviceCard(alert: TeamsAlert) {
  const timestamp = alert.timestamp || new Date();
  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": severityColors[alert.severity],
    "summary": `💻 Appareil non conforme: ${alert.title}`,
    "sections": [
      {
        "activityTitle": "💻 **APPAREIL NON CONFORME**",
        "activitySubtitle": `Guardian View SOC • ${timestamp.toLocaleString('fr-FR')}`,
        "activityImage": "https://img.icons8.com/fluency/48/laptop-error.png",
        "facts": [
          { "name": "🖥️ Appareil", "value": `**${alert.title}**` },
          { "name": "👤 Utilisateur", "value": alert.details?.['Utilisateur'] || 'N/A' },
          { "name": "❌ Problème", "value": alert.message },
          { "name": "⚠️ Sévérité", "value": severityLabels[alert.severity] },
          ...(alert.details ? Object.entries(alert.details)
            .filter(([name]) => name !== 'Utilisateur')
            .map(([name, value]) => ({ 
              name: `📌 ${name}`, 
              value: value 
            })) : []),
          { "name": "🕐 Détecté le", "value": timestamp.toLocaleString('fr-FR') },
        ],
        "markdown": true,
      },
      {
        "text": "🔧 **Actions recommandées**: Contacter l'utilisateur, vérifier les mises à jour Windows, antivirus, et politiques de conformité Intune.",
        "markdown": true,
      },
    ],
    "potentialAction": [
      {
        "@type": "OpenUri",
        "name": "📱 Voir les appareils",
        "targets": [{ "os": "default", "uri": `${window.location.origin}?view=devices` }],
      },
    ],
  };
}

/**
 * Template pour les rapports générés
 */
function createReportCard(alert: TeamsAlert) {
  const timestamp = alert.timestamp || new Date();
  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": severityColors.info,
    "summary": `📊 Rapport: ${alert.title}`,
    "sections": [
      {
        "activityTitle": "📊 **NOUVEAU RAPPORT DISPONIBLE**",
        "activitySubtitle": `Guardian View SOC • ${timestamp.toLocaleString('fr-FR')}`,
        "activityImage": "https://img.icons8.com/fluency/48/report-card.png",
        "facts": [
          { "name": "📄 Rapport", "value": `**${alert.title}**` },
          { "name": "📁 Type", "value": alert.details?.['Type'] || 'Sécurité' },
          { "name": "📝 Description", "value": alert.message },
          { "name": "🕐 Généré le", "value": timestamp.toLocaleString('fr-FR') },
        ],
        "markdown": true,
      },
    ],
    "potentialAction": [
      {
        "@type": "OpenUri",
        "name": "📊 Voir les rapports",
        "targets": [{ "os": "default", "uri": `${window.location.origin}?view=reports` }],
      },
      {
        "@type": "OpenUri",
        "name": "📥 Télécharger",
        "targets": [{ "os": "default", "uri": `${window.location.origin}?view=reports` }],
      },
    ],
  };
}

/**
 * Sélectionne le bon template selon le type d'alerte
 */
function createCard(alert: TeamsAlert) {
  switch (alert.type) {
    case 'incident':
      return createIncidentCard(alert);
    case 'forwarding_rule':
      return createForwardingRuleCard(alert);
    case 'risky_user':
      return createRiskyUserCard(alert);
    case 'non_compliant_device':
      return createNonCompliantDeviceCard(alert);
    case 'report_generated':
      return createReportCard(alert);
    default:
      return createIncidentCard(alert);
  }
}

/**
 * Envoie une alerte vers le canal Teams configuré
 * Utilise le proxy backend pour éviter les erreurs CORS
 */
export async function sendTeamsAlert(alert: TeamsAlert): Promise<{ success: boolean; error?: string }> {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const card = createCard(alert);

  try {
    const response = await fetch(`${apiUrl}/api/teams-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-By': 'GuardianView',
      },
      body: JSON.stringify({ card }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      const error = result.error || `Erreur HTTP ${response.status}`;
      console.error('Erreur envoi Teams webhook:', error);
      return { success: false, error };
    }

    console.log('✅ Alerte Teams envoyée:', alert.title);
    return { success: true };
  } catch (error: any) {
    const errorMsg = `Erreur réseau: ${error.message}`;
    console.error('Erreur envoi Teams webhook:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Vérifie si le webhook Teams est configuré
 */
export async function isTeamsWebhookConfigured(): Promise<boolean> {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/teams-webhook/status`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.configured === true;
  } catch {
    return false;
  }
}

/**
 * Fonctions utilitaires pour envoyer des alertes spécifiques
 */
export const TeamsAlerts = {
  // Alerte pour un nouvel incident
  incident: (title: string, severity: AlertSeverity, details?: Record<string, string>) =>
    sendTeamsAlert({
      type: 'incident',
      severity,
      title,
      message: `Un nouvel incident de sécurité a été détecté et nécessite votre attention.`,
      details,
    }),

  // Alerte pour une règle de transfert suspecte
  forwardingRule: (userEmail: string, destinationEmail: string, ruleName?: string) =>
    sendTeamsAlert({
      type: 'forwarding_rule',
      severity: 'high',
      title: ruleName || 'Nouvelle règle de transfert',
      message: `Une règle de transfert automatique a été créée vers une adresse externe.`,
      details: {
        'Utilisateur': userEmail,
        'Destination': destinationEmail,
        ...(ruleName ? { 'Nom de la règle': ruleName } : {}),
      },
    }),

  // Alerte pour un utilisateur à risque
  riskyUser: (userName: string, userEmail: string, riskLevel: string, riskDetail: string) =>
    sendTeamsAlert({
      type: 'risky_user',
      severity: riskLevel === 'high' ? 'critical' : riskLevel === 'medium' ? 'high' : 'medium',
      title: userName,
      message: riskDetail,
      details: {
        'Email': userEmail,
        'Niveau de risque': riskLevel.toUpperCase(),
      },
    }),

  // Alerte pour un appareil non conforme
  nonCompliantDevice: (deviceName: string, userName: string, reason: string, os?: string) =>
    sendTeamsAlert({
      type: 'non_compliant_device',
      severity: 'medium',
      title: deviceName,
      message: reason,
      details: {
        'Utilisateur': userName,
        ...(os ? { 'Système': os } : {}),
      },
    }),

  // Alerte pour un rapport généré
  reportGenerated: (reportName: string, reportType: string, description?: string) =>
    sendTeamsAlert({
      type: 'report_generated',
      severity: 'info',
      title: reportName,
      message: description || `Le rapport ${reportType} a été généré avec succès.`,
      details: {
        'Type': reportType,
      },
    }),

  // Fonction de test
  test: () =>
    sendTeamsAlert({
      type: 'incident',
      severity: 'info',
      title: '🧪 Test de connexion Guardian View',
      message: 'Ceci est un message de test pour vérifier que la connexion Teams fonctionne correctement.',
      details: {
        'Status': '✅ Connexion réussie',
        'Application': 'Guardian View SOC',
      },
    }),
};

export default TeamsAlerts;
