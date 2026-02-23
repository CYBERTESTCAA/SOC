// Report Generation Service
import { AzureConfig } from './config';
import { 
  getSecurityIncidents, 
  getSignInLogs, 
  getManagedDevices, 
  getRiskyUsers,
  getUsers,
  GraphIncident,
  GraphSignIn,
  GraphManagedDevice,
  GraphRiskyUser,
} from './graphApi';

export interface ReportData {
  generatedAt: Date;
  period: '24h' | '7d' | '30d';
  incidents: {
    total: number;
    bySeverity: Record<string, number>;
    active: number;
    resolved: number;
    topIncidents: GraphIncident[];
  };
  signIns: {
    total: number;
    successful: number;
    failed: number;
    risky: number;
    byCountry: Record<string, number>;
    topFailedUsers: Array<{ user: string; count: number }>;
  };
  devices: {
    total: number;
    compliant: number;
    nonCompliant: number;
    encryptionOff: number;
    outdatedOS: number;
  };
  riskyUsers: GraphRiskyUser[];
  recommendations: string[];
}

export interface ScheduledReport {
  id: string;
  name: string;
  type: 'security_summary' | 'identity_access' | 'endpoint_compliance' | 'full';
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:MM format
  recipients: string[];
  format: 'pdf' | 'csv' | 'html';
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

const SCHEDULED_REPORTS_KEY = 'soc_scheduled_reports';

// Get all scheduled reports from localStorage
export function getScheduledReports(): ScheduledReport[] {
  try {
    const stored = localStorage.getItem(SCHEDULED_REPORTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save scheduled reports to localStorage
export function saveScheduledReports(reports: ScheduledReport[]): void {
  localStorage.setItem(SCHEDULED_REPORTS_KEY, JSON.stringify(reports));
}

// Add a new scheduled report
export function addScheduledReport(report: Omit<ScheduledReport, 'id' | 'nextRun'>): ScheduledReport {
  const reports = getScheduledReports();
  const newReport: ScheduledReport = {
    ...report,
    id: `RPT-${Date.now()}`,
    nextRun: calculateNextRun(report.frequency, report.time, report.dayOfWeek, report.dayOfMonth),
  };
  reports.push(newReport);
  saveScheduledReports(reports);
  return newReport;
}

// Delete a scheduled report
export function deleteScheduledReport(id: string): void {
  const reports = getScheduledReports().filter(r => r.id !== id);
  saveScheduledReports(reports);
}

// Update a scheduled report
export function updateScheduledReport(id: string, updates: Partial<ScheduledReport>): void {
  const reports = getScheduledReports().map(r => 
    r.id === id ? { ...r, ...updates } : r
  );
  saveScheduledReports(reports);
}

// Calculate next run time
function calculateNextRun(
  frequency: 'daily' | 'weekly' | 'monthly',
  time: string,
  dayOfWeek?: number,
  dayOfMonth?: number
): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const next = new Date();
  
  next.setHours(hours, minutes, 0, 0);
  
  if (next <= now) {
    // If time has passed today, move to next occurrence
    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        const daysUntilNext = ((dayOfWeek || 0) - now.getDay() + 7) % 7 || 7;
        next.setDate(next.getDate() + daysUntilNext);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        next.setDate(dayOfMonth || 1);
        break;
    }
  } else if (frequency === 'weekly' && dayOfWeek !== undefined) {
    const daysUntil = (dayOfWeek - now.getDay() + 7) % 7;
    if (daysUntil > 0) next.setDate(next.getDate() + daysUntil);
  } else if (frequency === 'monthly' && dayOfMonth !== undefined) {
    if (now.getDate() > dayOfMonth) {
      next.setMonth(next.getMonth() + 1);
    }
    next.setDate(dayOfMonth);
  }
  
  return next;
}

// Generate report data from live API
export async function generateReportData(
  config: AzureConfig,
  period: '24h' | '7d' | '30d' = '7d'
): Promise<ReportData> {
  // Fetch all data in parallel
  const [incidents, signInLogs, devices, riskyUsers] = await Promise.all([
    getSecurityIncidents(config).catch(() => []),
    getSignInLogs(config, 200).catch(() => []),
    getManagedDevices(config).catch(() => []),
    getRiskyUsers(config).catch(() => []),
  ]);

  // Calculate period filter
  const periodMs = period === '24h' ? 24 * 60 * 60 * 1000 
                 : period === '7d' ? 7 * 24 * 60 * 60 * 1000 
                 : 30 * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - periodMs);

  // Filter incidents by period
  const filteredIncidents = incidents.filter(i => 
    new Date(i.createdDateTime) >= cutoffDate
  );

  // Count incidents by severity
  const bySeverity: Record<string, number> = {};
  filteredIncidents.forEach(i => {
    bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
  });

  // Filter sign-ins by period
  const filteredSignIns = signInLogs.filter(s => 
    new Date(s.createdDateTime) >= cutoffDate
  );

  // Count sign-ins by country
  const byCountry: Record<string, number> = {};
  filteredSignIns.forEach(s => {
    const country = s.location?.countryOrRegion || 'Unknown';
    byCountry[country] = (byCountry[country] || 0) + 1;
  });

  // Find top failed users
  const failedByUser: Record<string, number> = {};
  filteredSignIns
    .filter(s => s.status.errorCode !== 0)
    .forEach(s => {
      failedByUser[s.userPrincipalName] = (failedByUser[s.userPrincipalName] || 0) + 1;
    });
  
  const topFailedUsers = Object.entries(failedByUser)
    .map(([user, count]) => ({ user, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Device stats
  const compliantDevices = devices.filter(d => d.complianceState === 'compliant');
  const nonCompliantDevices = devices.filter(d => d.complianceState === 'noncompliant');
  const encryptionOff = devices.filter(d => !d.isEncrypted);

  // Generate recommendations based on data
  const recommendations: string[] = [];
  
  if (filteredIncidents.filter(i => i.severity === 'critical' || i.severity === 'high').length > 0) {
    recommendations.push('Traiter en priorité les incidents critiques et élevés en cours');
  }
  
  if (topFailedUsers.length > 0 && topFailedUsers[0].count > 10) {
    recommendations.push(`Investiguer les échecs de connexion répétés pour ${topFailedUsers[0].user}`);
  }
  
  if (nonCompliantDevices.length > devices.length * 0.1) {
    recommendations.push(`${nonCompliantDevices.length} appareils non conformes nécessitent attention`);
  }
  
  if (encryptionOff.length > 0) {
    recommendations.push(`Activer le chiffrement sur ${encryptionOff.length} appareil(s)`);
  }
  
  if (riskyUsers.length > 0) {
    recommendations.push(`${riskyUsers.length} utilisateur(s) à risque détecté(s) - vérifier leur statut`);
  }

  return {
    generatedAt: new Date(),
    period,
    incidents: {
      total: filteredIncidents.length,
      bySeverity,
      active: filteredIncidents.filter(i => i.status === 'active').length,
      resolved: filteredIncidents.filter(i => i.status === 'resolved').length,
      topIncidents: filteredIncidents
        .sort((a, b) => {
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, informational: 4, unknown: 5 };
          return (severityOrder[a.severity] || 5) - (severityOrder[b.severity] || 5);
        })
        .slice(0, 5),
    },
    signIns: {
      total: filteredSignIns.length,
      successful: filteredSignIns.filter(s => s.status.errorCode === 0).length,
      failed: filteredSignIns.filter(s => s.status.errorCode !== 0).length,
      risky: filteredSignIns.filter(s => 
        s.riskLevelDuringSignIn && s.riskLevelDuringSignIn !== 'none' && s.riskLevelDuringSignIn !== 'hidden'
      ).length,
      byCountry,
      topFailedUsers,
    },
    devices: {
      total: devices.length,
      compliant: compliantDevices.length,
      nonCompliant: nonCompliantDevices.length,
      encryptionOff: encryptionOff.length,
      outdatedOS: 0, // Would need additional logic to determine
    },
    riskyUsers,
    recommendations,
  };
}

// Export report to CSV format
export function exportToCSV(data: ReportData): string {
  const lines: string[] = [];
  
  // Header
  lines.push('Guardian View SOC - Security Report');
  lines.push(`Generated: ${data.generatedAt.toISOString()}`);
  lines.push(`Period: ${data.period}`);
  lines.push('');
  
  // Incidents section
  lines.push('=== INCIDENTS ===');
  lines.push(`Total,${data.incidents.total}`);
  lines.push(`Active,${data.incidents.active}`);
  lines.push(`Resolved,${data.incidents.resolved}`);
  Object.entries(data.incidents.bySeverity).forEach(([sev, count]) => {
    lines.push(`${sev},${count}`);
  });
  lines.push('');
  
  // Sign-ins section
  lines.push('=== SIGN-INS ===');
  lines.push(`Total,${data.signIns.total}`);
  lines.push(`Successful,${data.signIns.successful}`);
  lines.push(`Failed,${data.signIns.failed}`);
  lines.push(`Risky,${data.signIns.risky}`);
  lines.push('');
  lines.push('Top Failed Users:');
  data.signIns.topFailedUsers.forEach(u => {
    lines.push(`${u.user},${u.count}`);
  });
  lines.push('');
  
  // Devices section
  lines.push('=== DEVICES ===');
  lines.push(`Total,${data.devices.total}`);
  lines.push(`Compliant,${data.devices.compliant}`);
  lines.push(`Non-Compliant,${data.devices.nonCompliant}`);
  lines.push(`Encryption Off,${data.devices.encryptionOff}`);
  lines.push('');
  
  // Recommendations
  lines.push('=== RECOMMENDATIONS ===');
  data.recommendations.forEach((rec, i) => {
    lines.push(`${i + 1}. ${rec}`);
  });
  
  return lines.join('\n');
}

// Export report to HTML format
export function exportToHTML(data: ReportData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Security Report - ${data.generatedAt.toLocaleDateString()}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #0f0f23; color: #e0e0e0; }
    h1 { color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    h2 { color: #60a5fa; margin-top: 30px; }
    .metric { display: inline-block; background: #1e1e3f; padding: 15px 25px; margin: 5px; border-radius: 8px; text-align: center; }
    .metric .value { font-size: 2em; font-weight: bold; color: #3b82f6; }
    .metric .label { font-size: 0.9em; color: #9ca3af; }
    .critical { color: #ef4444; }
    .high { color: #f97316; }
    .medium { color: #eab308; }
    .low { color: #22c55e; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #374151; }
    th { background: #1e1e3f; }
    .recommendation { background: #1e3a5f; padding: 10px 15px; margin: 5px 0; border-radius: 6px; border-left: 4px solid #3b82f6; }
  </style>
</head>
<body>
  <h1>🛡️ Guardian View - Security Report</h1>
  <p><strong>Generated:</strong> ${data.generatedAt.toLocaleString()}</p>
  <p><strong>Period:</strong> ${data.period}</p>

  <h2>📊 Incidents</h2>
  <div class="metric"><div class="value">${data.incidents.total}</div><div class="label">Total</div></div>
  <div class="metric"><div class="value critical">${data.incidents.bySeverity.critical || 0}</div><div class="label">Critical</div></div>
  <div class="metric"><div class="value high">${data.incidents.bySeverity.high || 0}</div><div class="label">High</div></div>
  <div class="metric"><div class="value medium">${data.incidents.bySeverity.medium || 0}</div><div class="label">Medium</div></div>
  <div class="metric"><div class="value low">${data.incidents.bySeverity.low || 0}</div><div class="label">Low</div></div>

  <h2>🔐 Sign-In Activity</h2>
  <div class="metric"><div class="value">${data.signIns.total}</div><div class="label">Total</div></div>
  <div class="metric"><div class="value low">${data.signIns.successful}</div><div class="label">Successful</div></div>
  <div class="metric"><div class="value high">${data.signIns.failed}</div><div class="label">Failed</div></div>
  <div class="metric"><div class="value critical">${data.signIns.risky}</div><div class="label">Risky</div></div>

  ${data.signIns.topFailedUsers.length > 0 ? `
  <h3>Top Failed Sign-In Users</h3>
  <table>
    <tr><th>User</th><th>Failed Attempts</th></tr>
    ${data.signIns.topFailedUsers.map(u => `<tr><td>${u.user}</td><td>${u.count}</td></tr>`).join('')}
  </table>
  ` : ''}

  <h2>💻 Devices</h2>
  <div class="metric"><div class="value">${data.devices.total}</div><div class="label">Total</div></div>
  <div class="metric"><div class="value low">${data.devices.compliant}</div><div class="label">Compliant</div></div>
  <div class="metric"><div class="value high">${data.devices.nonCompliant}</div><div class="label">Non-Compliant</div></div>
  <div class="metric"><div class="value critical">${data.devices.encryptionOff}</div><div class="label">No Encryption</div></div>

  <h2>⚠️ Risky Users (${data.riskyUsers.length})</h2>
  ${data.riskyUsers.length > 0 ? `
  <table>
    <tr><th>User</th><th>Risk Level</th><th>Risk State</th></tr>
    ${data.riskyUsers.map(u => `<tr><td>${u.userPrincipalName}</td><td class="${u.riskLevel}">${u.riskLevel}</td><td>${u.riskState}</td></tr>`).join('')}
  </table>
  ` : '<p>No risky users detected.</p>'}

  <h2>💡 Recommendations</h2>
  ${data.recommendations.map(r => `<div class="recommendation">${r}</div>`).join('')}

  <hr style="margin-top: 40px; border-color: #374151;">
  <p style="text-align: center; color: #6b7280; font-size: 0.9em;">
    Generated by Guardian View SOC Portal
  </p>
</body>
</html>
  `.trim();
}

// Download helper
export function downloadReport(content: string, filename: string, type: 'csv' | 'html'): void {
  const mimeTypes = {
    csv: 'text/csv',
    html: 'text/html',
  };
  
  const blob = new Blob([content], { type: mimeTypes[type] });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
