export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'informational' | 'unknown';

export type IncidentStatus = 'new' | 'inProgress' | 'pending' | 'resolved' | 'closed' | 'falsePositive';

export type IncidentSource = 'defender' | 'entra' | 'intune' | 'exchange';

export type UserRole = 'admin' | 'analyst' | 'readonly' | 'helpdesk';

export type ConnectorStatus = 'connected' | 'error' | 'warning' | 'disconnected';

export type AnomalyType = 'bruteforce' | 'impossibleTravel' | 'rareCountry' | 'newDevice' | 'legacyAuth' | 'mfaFailed';

// MITRE ATT&CK Tactics
export type MitreTactic = 
  | 'Initial Access'
  | 'Execution'
  | 'Persistence'
  | 'Privilege Escalation'
  | 'Defense Evasion'
  | 'Credential Access'
  | 'Discovery'
  | 'Lateral Movement'
  | 'Collection'
  | 'Exfiltration'
  | 'Impact';

export interface MitreInfo {
  tactic: MitreTactic;
  technique: string;
  techniqueId: string;
}

export interface IncidentAlert {
  id: string;
  title: string;
  severity: Severity;
  timestamp: Date;
  source: IncidentSource;
  status: 'active' | 'resolved';
}

export interface IncidentComment {
  id: string;
  author: string;
  content: string;
  timestamp: Date;
}

export interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: 'alert' | 'action' | 'status' | 'comment' | 'detection';
  title: string;
  description?: string;
  actor?: string;
  severity?: Severity;
}

export interface Entity360 {
  type: 'user' | 'device' | 'ip' | 'mailbox';
  id: string;
  name: string;
  riskScore: number;
  relatedIncidents: number;
  relatedAlerts: number;
  lastActivity: Date;
  details: Record<string, string | number | boolean>;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  status: IncidentStatus;
  source: IncidentSource;
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: string;
  affectedEntities: {
    users?: string[];
    devices?: string[];
    mailboxes?: string[];
    ips?: string[];
  };
  // Extended fields
  mitre?: MitreInfo;
  alerts?: IncidentAlert[];
  timeline?: TimelineEvent[];
  comments?: IncidentComment[];
  riskScore?: number;
  impactedUsersCount?: number;
  impactedDevicesCount?: number;
  confidence?: 'high' | 'medium' | 'low';
  relatedIncidents?: string[];
  tags?: string[];
  slaDeadline?: Date;
  recommendations?: string[];
}

export interface SignInLog {
  id: string;
  userPrincipalName: string;
  ipAddress: string;
  location: string;
  country: string;
  status: 'success' | 'failure';
  riskLevel: Severity;
  timestamp: Date;
  appDisplayName: string;
  deviceInfo: string;
  // Extended fields
  mfaRequired?: boolean;
  mfaResult?: 'success' | 'failed' | 'notRequired';
  conditionalAccessStatus?: 'success' | 'failed' | 'notApplied';
  clientAppUsed?: string;
  isInteractive?: boolean;
  correlationId?: string;
}

export interface SignInAnomaly {
  id: string;
  type: AnomalyType;
  severity: Severity;
  timestamp: Date;
  userPrincipalName: string;
  description: string;
  details: {
    sourceLocation?: string;
    destLocation?: string;
    travelTime?: string;
    failedAttempts?: number;
    timeWindow?: string;
    country?: string;
    previousCountries?: string[];
    deviceInfo?: string;
  };
  relatedLogs: string[];
  status: 'new' | 'investigating' | 'resolved' | 'falsePositive';
}

export interface DeviceCompliance {
  id: string;
  deviceName: string;
  userPrincipalName: string;
  osVersion: string;
  complianceState: 'compliant' | 'nonCompliant' | 'pending';
  lastCheckIn: Date;
  encryptionStatus: boolean;
  issues?: string[];
  // Extended fields
  bitlockerStatus?: boolean;
  antivirusStatus?: 'enabled' | 'disabled' | 'unknown';
  firewallStatus?: 'enabled' | 'disabled' | 'unknown';
  osOutdated?: boolean;
  isVIP?: boolean;
  model?: string;
  manufacturer?: string;
}

export interface SOCMetrics {
  totalIncidents: number;
  activeIncidents: number;
  criticalIncidents: number;
  resolvedToday: number;
  avgResolutionTime: string;
  signInAttempts24h: number;
  failedSignIns24h: number;
  riskySignIns24h: number;
  totalDevices: number;
  compliantDevices: number;
  nonCompliantDevices: number;
  // Extended metrics
  anomaliesDetected24h?: number;
  mfaChallenged24h?: number;
  mfaFailed24h?: number;
  newCountrySignIns24h?: number;
  bruteforceAttempts24h?: number;
}

export interface WeeklySummary {
  weekStart: Date;
  weekEnd: Date;
  totalIncidents: number;
  incidentsBySeverity: Record<Severity, number>;
  topEvents: string[];
  trends: string[];
  recommendations: string[];
}

export interface ConnectorInfo {
  id: IncidentSource;
  name: string;
  status: ConnectorStatus;
  lastSync: Date;
  errorMessage?: string;
  permissions: string[];
  dataLag?: number; // minutes
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  actor: string;
  action: 'view' | 'update' | 'assign' | 'comment' | 'export' | 'login' | 'setting_change';
  resource: string;
  resourceId?: string;
  details?: string;
  ipAddress: string;
}

export interface SOCUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  avatar?: string;
  lastLogin: Date;
  permissions: {
    canManageIncidents: boolean;
    canExport: boolean;
    canManageSettings: boolean;
    modules: IncidentSource[];
  };
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'security_summary' | 'identity_access' | 'endpoint_compliance' | 'email_security' | 'custom';
  modules: IncidentSource[];
  format: 'pdf' | 'csv' | 'html';
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    time: string;
  };
  recipients: string[];
  lastGenerated?: Date;
  isActive: boolean;
}

export interface DataFreshness {
  source: IncidentSource;
  lastUpdate: Date;
  recordCount: number;
  status: 'fresh' | 'stale' | 'error';
  lagMinutes: number;
}