/**
 * Service de détection d'anomalies pour les connexions et comportements utilisateurs
 */

import { GraphSignIn } from './graphApi';
import { getCountryName } from '@/utils/countries';

// Pays à risque élevé (basé sur les menaces cyber courantes)
export const HIGH_RISK_COUNTRIES = [
  'RU', 'CN', 'KP', 'IR', 'BY', 'VE', 'CU', 'SY', 'MM', 'SD',
  'NG', 'PK', 'UA', 'RO', 'BG', 'VN', 'ID', 'BR', 'IN'
];

// Pays à risque moyen
export const MEDIUM_RISK_COUNTRIES = [
  'TR', 'TH', 'PH', 'MY', 'BD', 'EG', 'MA', 'DZ', 'TN', 'KE',
  'ZA', 'AR', 'MX', 'CO', 'PE', 'CL'
];

// Heures de bureau standard (en heure locale)
export const BUSINESS_HOURS = {
  start: 7,  // 7h00
  end: 20,   // 20h00
};

// Seuils de détection
export const THRESHOLDS = {
  maxFailedAttemptsPerHour: 5,
  maxDifferentCountriesPerDay: 3,
  impossibleTravelSpeedKmH: 800, // Vitesse impossible (avion = ~900km/h max)
  suspiciousLoginHoursStart: 0,  // Minuit
  suspiciousLoginHoursEnd: 5,    // 5h du matin
};

export interface Anomaly {
  id: string;
  type: 'unusual_hour' | 'risky_country' | 'failed_attempts' | 'impossible_travel' | 'new_device' | 'new_location' | 'multiple_countries';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  userPrincipalName: string;
  timestamp: Date;
  details: Record<string, any>;
}

export interface UserRiskScore {
  userPrincipalName: string;
  displayName: string;
  score: number; // 0-100
  level: 'critical' | 'high' | 'medium' | 'low';
  factors: RiskFactor[];
  lastUpdated: Date;
}

export interface RiskFactor {
  name: string;
  points: number;
  description: string;
}

/**
 * Détecte les anomalies dans les logs de connexion
 */
export function detectAnomalies(signInLogs: GraphSignIn[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  
  // Grouper les logs par utilisateur
  const logsByUser = new Map<string, GraphSignIn[]>();
  signInLogs.forEach(log => {
    const existing = logsByUser.get(log.userPrincipalName) || [];
    existing.push(log);
    logsByUser.set(log.userPrincipalName, existing);
  });

  signInLogs.forEach(log => {
    const userLogs = logsByUser.get(log.userPrincipalName) || [];
    
    // 1. Connexion depuis un pays à risque élevé
    if (log.location?.countryOrRegion) {
      const countryCode = log.location.countryOrRegion.toUpperCase();
      if (HIGH_RISK_COUNTRIES.includes(countryCode)) {
        anomalies.push({
          id: `risk-country-${log.id}`,
          type: 'risky_country',
          severity: 'high',
          title: 'Connexion depuis un pays à risque',
          description: `Connexion depuis ${getCountryName(countryCode)} (pays à haut risque cyber)`,
          userPrincipalName: log.userPrincipalName,
          timestamp: new Date(log.createdDateTime),
          details: {
            country: countryCode,
            countryName: getCountryName(countryCode),
            ip: log.ipAddress,
            city: log.location.city,
            app: log.appDisplayName,
          },
        });
      } else if (MEDIUM_RISK_COUNTRIES.includes(countryCode)) {
        anomalies.push({
          id: `risk-country-med-${log.id}`,
          type: 'risky_country',
          severity: 'medium',
          title: 'Connexion depuis un pays surveillé',
          description: `Connexion depuis ${getCountryName(countryCode)} (pays sous surveillance)`,
          userPrincipalName: log.userPrincipalName,
          timestamp: new Date(log.createdDateTime),
          details: {
            country: countryCode,
            countryName: getCountryName(countryCode),
            ip: log.ipAddress,
            city: log.location.city,
            app: log.appDisplayName,
          },
        });
      }
    }

    // 2. Connexion à des heures inhabituelles (minuit - 5h)
    const loginHour = new Date(log.createdDateTime).getHours();
    if (loginHour >= THRESHOLDS.suspiciousLoginHoursStart && 
        loginHour < THRESHOLDS.suspiciousLoginHoursEnd) {
      anomalies.push({
        id: `unusual-hour-${log.id}`,
        type: 'unusual_hour',
        severity: 'medium',
        title: 'Connexion à une heure inhabituelle',
        description: `Connexion à ${loginHour}h (entre minuit et 5h du matin)`,
        userPrincipalName: log.userPrincipalName,
        timestamp: new Date(log.createdDateTime),
        details: {
          hour: loginHour,
          ip: log.ipAddress,
          country: log.location?.countryOrRegion,
          app: log.appDisplayName,
        },
      });
    }

    // 3. Échecs multiples de connexion
    const recentFailures = userLogs.filter(l => {
      const timeDiff = new Date(log.createdDateTime).getTime() - new Date(l.createdDateTime).getTime();
      return l.status.errorCode !== 0 && timeDiff >= 0 && timeDiff < 3600000; // 1 heure
    });
    
    if (recentFailures.length >= THRESHOLDS.maxFailedAttemptsPerHour) {
      // Éviter les doublons
      const existingAnomaly = anomalies.find(a => 
        a.type === 'failed_attempts' && 
        a.userPrincipalName === log.userPrincipalName &&
        Math.abs(a.timestamp.getTime() - new Date(log.createdDateTime).getTime()) < 3600000
      );
      
      if (!existingAnomaly) {
        anomalies.push({
          id: `failed-attempts-${log.userPrincipalName}-${log.createdDateTime}`,
          type: 'failed_attempts',
          severity: recentFailures.length >= 10 ? 'critical' : 'high',
          title: 'Tentatives de connexion échouées multiples',
          description: `${recentFailures.length} échecs de connexion en moins d'une heure`,
          userPrincipalName: log.userPrincipalName,
          timestamp: new Date(log.createdDateTime),
          details: {
            failureCount: recentFailures.length,
            ips: [...new Set(recentFailures.map(l => l.ipAddress))],
            errorCodes: [...new Set(recentFailures.map(l => l.status.errorCode))],
          },
        });
      }
    }
  });

  // 4. Connexions depuis plusieurs pays le même jour
  logsByUser.forEach((logs, userPrincipalName) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayLogs = logs.filter(l => new Date(l.createdDateTime) >= today);
    const countries = new Set(todayLogs.map(l => l.location?.countryOrRegion).filter(Boolean));
    
    if (countries.size >= THRESHOLDS.maxDifferentCountriesPerDay) {
      anomalies.push({
        id: `multiple-countries-${userPrincipalName}-${today.toISOString()}`,
        type: 'multiple_countries',
        severity: 'high',
        title: 'Connexions depuis plusieurs pays',
        description: `Connexions depuis ${countries.size} pays différents aujourd'hui`,
        userPrincipalName,
        timestamp: new Date(),
        details: {
          countries: Array.from(countries),
          countryNames: Array.from(countries).map(c => getCountryName(c as string)),
        },
      });
    }
  });

  // Dédupliquer et trier par sévérité puis date
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const uniqueAnomalies = Array.from(new Map(anomalies.map(a => [a.id, a])).values());
  
  return uniqueAnomalies.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.timestamp.getTime() - a.timestamp.getTime();
  });
}

/**
 * Calcule le score de risque pour chaque utilisateur
 */
export function calculateUserRiskScores(
  signInLogs: GraphSignIn[],
  mailboxRules: { userPrincipalName: string; isSuspicious: boolean; isExternalForwarding: boolean; suspiciousReasons: string[] }[] = [],
  riskyUsers: { userPrincipalName: string; riskLevel: string }[] = []
): UserRiskScore[] {
  const userScores = new Map<string, UserRiskScore>();

  // Grouper les logs par utilisateur
  const logsByUser = new Map<string, GraphSignIn[]>();
  signInLogs.forEach(log => {
    const existing = logsByUser.get(log.userPrincipalName) || [];
    existing.push(log);
    logsByUser.set(log.userPrincipalName, existing);
  });

  // Calculer le score pour chaque utilisateur
  logsByUser.forEach((logs, userPrincipalName) => {
    const factors: RiskFactor[] = [];
    let totalPoints = 0;

    // 1. Échecs de connexion (max 25 points)
    const failures = logs.filter(l => l.status.errorCode !== 0);
    if (failures.length > 0) {
      const points = Math.min(25, failures.length * 2);
      totalPoints += points;
      factors.push({
        name: 'Échecs de connexion',
        points,
        description: `${failures.length} tentative(s) échouée(s)`,
      });
    }

    // 2. Connexions depuis pays à risque (max 30 points)
    const riskyCountryLogs = logs.filter(l => {
      const country = l.location?.countryOrRegion?.toUpperCase();
      return country && HIGH_RISK_COUNTRIES.includes(country);
    });
    if (riskyCountryLogs.length > 0) {
      const points = Math.min(30, riskyCountryLogs.length * 10);
      totalPoints += points;
      factors.push({
        name: 'Pays à risque',
        points,
        description: `${riskyCountryLogs.length} connexion(s) depuis pays à risque`,
      });
    }

    // 3. Connexions à heures inhabituelles (max 15 points)
    const unusualHourLogs = logs.filter(l => {
      const hour = new Date(l.createdDateTime).getHours();
      return hour >= 0 && hour < 5;
    });
    if (unusualHourLogs.length > 0) {
      const points = Math.min(15, unusualHourLogs.length * 5);
      totalPoints += points;
      factors.push({
        name: 'Heures inhabituelles',
        points,
        description: `${unusualHourLogs.length} connexion(s) entre minuit et 5h`,
      });
    }

    // 4. Multiple pays (max 20 points)
    const countries = new Set(logs.map(l => l.location?.countryOrRegion).filter(Boolean));
    if (countries.size >= 3) {
      const points = Math.min(20, (countries.size - 2) * 5);
      totalPoints += points;
      factors.push({
        name: 'Mobilité suspecte',
        points,
        description: `Connexions depuis ${countries.size} pays différents`,
      });
    }

    // 5. Niveau de risque signalé (riskyUsers) - 15 points
    const riskyUser = riskyUsers.find(ru => ru.userPrincipalName === userPrincipalName);
    if (riskyUser) {
      const points = riskyUser.riskLevel === 'high' ? 25 : riskyUser.riskLevel === 'medium' ? 15 : 5;
      totalPoints += points;
      factors.push({
        name: 'Identity Protection',
        points,
        description: `Risque ${riskyUser.riskLevel} détecté par Entra ID`,
      });
    }

    // 6. Règles Exchange suspectes (max 25 points)
    const userRules = mailboxRules.filter(r => r.userPrincipalName === userPrincipalName);
    const suspiciousRules = userRules.filter(r => r.isSuspicious);
    const externalForwarding = userRules.filter(r => r.isExternalForwarding);
    
    if (externalForwarding.length > 0) {
      const points = Math.min(25, externalForwarding.length * 15);
      totalPoints += points;
      factors.push({
        name: 'Transfert externe',
        points,
        description: `${externalForwarding.length} règle(s) de transfert externe`,
      });
    } else if (suspiciousRules.length > 0) {
      const points = Math.min(15, suspiciousRules.length * 5);
      totalPoints += points;
      factors.push({
        name: 'Règles suspectes',
        points,
        description: `${suspiciousRules.length} règle(s) suspecte(s)`,
      });
    }

    // Déterminer le niveau
    let level: 'critical' | 'high' | 'medium' | 'low';
    if (totalPoints >= 70) level = 'critical';
    else if (totalPoints >= 45) level = 'high';
    else if (totalPoints >= 20) level = 'medium';
    else level = 'low';

    // Obtenir le displayName depuis les logs
    const displayName = logs[0]?.userDisplayName || userPrincipalName.split('@')[0];

    userScores.set(userPrincipalName, {
      userPrincipalName,
      displayName,
      score: Math.min(100, totalPoints),
      level,
      factors,
      lastUpdated: new Date(),
    });
  });

  // Trier par score décroissant
  return Array.from(userScores.values())
    .sort((a, b) => b.score - a.score);
}

/**
 * Détecte si une règle a été créée en dehors des heures de bureau
 */
export function isRuleCreatedOutsideBusinessHours(createdDateTime: string): boolean {
  const date = new Date(createdDateTime);
  const hour = date.getHours();
  const day = date.getDay();
  
  // Weekend
  if (day === 0 || day === 6) return true;
  
  // Hors heures de bureau
  if (hour < BUSINESS_HOURS.start || hour >= BUSINESS_HOURS.end) return true;
  
  return false;
}

/**
 * Détecte les patterns de règles similaires entre plusieurs utilisateurs
 */
export function detectRulePatterns(
  rules: { 
    userPrincipalName: string; 
    displayName: string;
    forwardingAddresses: string[];
    actions?: { delete?: boolean; moveToFolder?: string };
  }[]
): { pattern: string; users: string[]; severity: 'critical' | 'high' | 'medium' }[] {
  const patterns: { pattern: string; users: string[]; severity: 'critical' | 'high' | 'medium' }[] = [];
  
  // Grouper par adresse de transfert
  const forwardingMap = new Map<string, string[]>();
  rules.forEach(rule => {
    rule.forwardingAddresses.forEach(addr => {
      const existing = forwardingMap.get(addr.toLowerCase()) || [];
      if (!existing.includes(rule.userPrincipalName)) {
        existing.push(rule.userPrincipalName);
      }
      forwardingMap.set(addr.toLowerCase(), existing);
    });
  });

  // Détecter les adresses utilisées par plusieurs utilisateurs
  forwardingMap.forEach((users, address) => {
    if (users.length >= 2) {
      patterns.push({
        pattern: `Transfert vers ${address}`,
        users,
        severity: users.length >= 5 ? 'critical' : users.length >= 3 ? 'high' : 'medium',
      });
    }
  });

  // Grouper par règles de suppression
  const deleteRules = rules.filter(r => r.actions?.delete);
  if (deleteRules.length >= 2) {
    const users = deleteRules.map(r => r.userPrincipalName);
    patterns.push({
      pattern: 'Règle de suppression automatique',
      users,
      severity: users.length >= 5 ? 'critical' : 'high',
    });
  }

  return patterns.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}
