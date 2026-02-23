// Microsoft Graph API Service - Using Backend Proxy
import { AzureConfig } from './config';

// Backend proxy URL - change this if your server runs on a different port
const PROXY_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Clear cached token (calls the backend to clear its cache)
export async function clearTokenCache(): Promise<void> {
  try {
    await fetch(`${PROXY_URL}/api/clear-cache`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-By': 'GuardianView' },
    });
  } catch (e) {
    console.warn('Failed to clear token cache:', e);
  }
}

// Generic Graph API call through proxy
async function graphRequest<T>(
  config: AzureConfig,
  endpoint: string,
  options: { method?: string; body?: unknown } = {},
  useBeta: boolean = false
): Promise<T> {
  const response = await fetch(`${PROXY_URL}/api/graph`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-By': 'GuardianView',
    },
    body: JSON.stringify({
      tenantId: config.tenantId,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      endpoint,
      method: options.method || 'GET',
      body: options.body,
      useBeta,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `Graph API error: ${response.status}`);
  }

  return response.json();
}

// ============================================
// SECURITY / DEFENDER APIs
// ============================================

export interface GraphIncident {
  id: string;
  displayName: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | 'informational' | 'unknown';
  status: 'active' | 'resolved' | 'redirected' | 'unknown';
  classification?: string;
  determination?: string;
  createdDateTime: string;
  lastUpdateDateTime: string;
  assignedTo?: string;
  incidentWebUrl: string;
  alerts?: GraphAlert[];
  comments?: GraphComment[];
}

export interface AlertEvidence {
  '@odata.type'?: string;
  createdDateTime?: string;
  verdict?: string;
  remediationStatus?: string;
  // User evidence
  userAccount?: {
    accountName?: string;
    domainName?: string;
    userPrincipalName?: string;
    userSid?: string;
  };
  // IP evidence
  ipAddress?: string;
  countryLetterCode?: string;
  // Device evidence
  deviceDnsName?: string;
  mdeDeviceId?: string;
  azureAdDeviceId?: string;
  // File evidence
  fileName?: string;
  filePath?: string;
  fileHash?: { algorithm?: string; value?: string };
  // Email/Mailbox evidence
  senderEmailAddress?: string;
  recipientEmailAddress?: string;
  emailSubject?: string;
  // URL evidence
  url?: string;
  // Process evidence
  processCommandLine?: string;
  processId?: number;
}

export interface GraphAlert {
  id: string;
  title: string;
  description?: string;
  severity: string;
  status: string;
  createdDateTime: string;
  alertWebUrl?: string;
  category?: string;
  serviceSource?: string;
  detectionSource?: string;
  evidence?: AlertEvidence[];
}

export interface GraphComment {
  comment: string;
  createdBy: { application?: string; user?: { displayName: string } };
  createdDateTime: string;
}

export async function getSecurityIncidents(config: AzureConfig): Promise<GraphIncident[]> {
  const response = await graphRequest<{ value: GraphIncident[] }>(
    config,
    '/security/incidents?$top=50&$orderby=createdDateTime desc',
    {},
    false
  );
  return response.value;
}

export async function getIncidentDetails(config: AzureConfig, incidentId: string): Promise<GraphIncident> {
  return graphRequest<GraphIncident>(
    config,
    `/security/incidents/${incidentId}?$expand=alerts($expand=evidence),comments`,
    {},
    false
  );
}

export async function updateIncident(
  config: AzureConfig, 
  incidentId: string, 
  updates: Partial<{ status: string; assignedTo: string; classification: string }>
): Promise<GraphIncident> {
  return graphRequest<GraphIncident>(
    config,
    `/security/incidents/${incidentId}`,
    { method: 'PATCH', body: JSON.stringify(updates) },
    false
  );
}

export async function addIncidentComment(
  config: AzureConfig,
  incidentId: string,
  comment: string
): Promise<void> {
  await graphRequest(
    config,
    `/security/incidents/${incidentId}/comments`,
    { method: 'POST', body: JSON.stringify({ comment }) },
    false
  );
}

// ============================================
// SIGN-IN LOGS (Entra ID)
// ============================================

export interface GraphSignIn {
  id: string;
  userPrincipalName: string;
  userDisplayName: string;
  ipAddress: string;
  location?: {
    city?: string;
    state?: string;
    countryOrRegion?: string;
  };
  status: {
    errorCode: number;
    failureReason?: string;
  };
  riskDetail?: string;
  riskLevelAggregated?: string;
  riskLevelDuringSignIn?: string;
  riskState?: string;
  createdDateTime: string;
  appDisplayName: string;
  clientAppUsed?: string;
  deviceDetail?: {
    deviceId?: string;
    displayName?: string;
    operatingSystem?: string;
    browser?: string;
  };
  conditionalAccessStatus?: string;
  isInteractive: boolean;
  mfaDetail?: {
    authMethod?: string;
    authDetail?: string;
  };
}

export type SignInPeriod = '12h' | '1d' | '3d' | '7d' | '30d' | '90d';

export function getPeriodFilter(period: SignInPeriod): string {
  const now = new Date();
  let pastDate: Date;
  
  switch (period) {
    case '12h':
      pastDate = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      break;
    case '1d':
      pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '3d':
      pastDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      break;
    case '7d':
      pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      pastDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      pastDate = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  }
  
  return pastDate.toISOString();
}

export async function getSignInLogs(config: AzureConfig, period: SignInPeriod = '12h'): Promise<GraphSignIn[]> {
  const dateFilter = getPeriodFilter(period);
  const allSignIns: GraphSignIn[] = [];
  let nextLink: string | null = `/auditLogs/signIns?$filter=createdDateTime ge ${dateFilter}&$top=999&$orderby=createdDateTime desc`;
  
  // Pagination loop to get ALL sign-ins for the period
  while (nextLink) {
    const response = await graphRequest<{ value: GraphSignIn[]; '@odata.nextLink'?: string }>(
      config,
      nextLink,
      {},
      false
    );
    
    allSignIns.push(...response.value);
    
    // Check for next page
    if (response['@odata.nextLink']) {
      // Extract just the endpoint path from the full URL
      // The nextLink looks like: https://graph.microsoft.com/v1.0/auditLogs/signIns?$skiptoken=...
      const fullUrl = response['@odata.nextLink'];
      // Remove the base URL to get just the path
      nextLink = fullUrl.replace('https://graph.microsoft.com/v1.0', '')
                        .replace('https://graph.microsoft.com/beta', '');
    } else {
      nextLink = null;
    }
    
    // Safety limit to avoid infinite loops (max 10000 sign-ins)
    if (allSignIns.length >= 10000) {
      console.warn('Sign-in logs limit reached (10000)');
      break;
    }
  }
  
  return allSignIns;
}

export async function getRiskySignIns(config: AzureConfig): Promise<GraphSignIn[]> {
  const response = await graphRequest<{ value: GraphSignIn[] }>(
    config,
    `/auditLogs/signIns?$filter=riskLevelDuringSignIn ne 'none' and riskLevelDuringSignIn ne 'hidden'&$top=50&$orderby=createdDateTime desc`,
    {},
    false
  );
  return response.value;
}

// ============================================
// RISKY USERS (Identity Protection)
// ============================================

export interface GraphRiskyUser {
  id: string;
  userPrincipalName: string;
  userDisplayName: string;
  riskLevel: string;
  riskState: string;
  riskDetail: string;
  riskLastUpdatedDateTime: string;
}

export async function getRiskyUsers(config: AzureConfig): Promise<GraphRiskyUser[]> {
  const response = await graphRequest<{ value: GraphRiskyUser[] }>(
    config,
    '/identityProtection/riskyUsers?$top=50',
    {},
    false
  );
  return response.value;
}

// ============================================
// INTUNE - MANAGED DEVICES
// ============================================

export interface GraphManagedDevice {
  id: string;
  deviceName: string;
  userPrincipalName: string;
  userDisplayName?: string;
  operatingSystem: string;
  osVersion: string;
  complianceState: 'compliant' | 'noncompliant' | 'conflict' | 'error' | 'unknown' | 'notApplicable';
  lastSyncDateTime: string;
  enrolledDateTime: string;
  isEncrypted: boolean;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  managementAgent: string;
  deviceRegistrationState: string;
  azureADRegistered?: boolean;
  azureADDeviceId?: string;
}

export async function getManagedDevices(config: AzureConfig): Promise<GraphManagedDevice[]> {
  const response = await graphRequest<{ value: GraphManagedDevice[] }>(
    config,
    '/deviceManagement/managedDevices?$top=200',
    {},
    false
  );
  return response.value;
}

// Get ALL managed devices with pagination
export async function getAllManagedDevices(config: AzureConfig): Promise<GraphManagedDevice[]> {
  const allDevices: GraphManagedDevice[] = [];
  let nextLink: string | null = '/deviceManagement/managedDevices?$top=999';
  
  while (nextLink) {
    const response = await graphRequest<{ value: GraphManagedDevice[]; '@odata.nextLink'?: string }>(
      config,
      nextLink,
      {},
      false
    );
    allDevices.push(...response.value);
    
    // Check for next page
    if (response['@odata.nextLink']) {
      const url = new URL(response['@odata.nextLink']);
      nextLink = url.pathname + url.search;
    } else {
      nextLink = null;
    }
    
    // Safety limit
    if (allDevices.length > 10000) break;
  }
  
  return allDevices;
}

export async function getNonCompliantDevices(config: AzureConfig): Promise<GraphManagedDevice[]> {
  const response = await graphRequest<{ value: GraphManagedDevice[] }>(
    config,
    "/deviceManagement/managedDevices?$filter=complianceState eq 'noncompliant'",
    {},
    false
  );
  return response.value;
}

export async function syncDevice(config: AzureConfig, deviceId: string): Promise<void> {
  await graphRequest(
    config,
    `/deviceManagement/managedDevices/${deviceId}/syncDevice`,
    { method: 'POST' },
    false
  );
}

// ============================================
// EXCHANGE / MAIL
// ============================================

export interface GraphMailboxRule {
  id: string;
  displayName: string;
  isEnabled: boolean;
  actions?: {
    forwardTo?: { emailAddress: { address: string } }[];
    forwardAsAttachmentTo?: { emailAddress: { address: string } }[];
    redirectTo?: { emailAddress: { address: string } }[];
    delete?: boolean;
    moveToFolder?: string;
  };
  conditions?: {
    fromAddresses?: { emailAddress: { address: string } }[];
    subjectContains?: string[];
  };
}

export async function getMailboxRules(config: AzureConfig, userId: string): Promise<GraphMailboxRule[]> {
  const response = await graphRequest<{ value: GraphMailboxRule[] }>(
    config,
    `/users/${userId}/mailFolders/inbox/messageRules`,
    {},
    false
  );
  return response.value;
}

// Get folder name from folder ID
export async function getMailFolderName(config: AzureConfig, userId: string, folderId: string): Promise<string> {
  try {
    const response = await graphRequest<{ displayName: string }>(
      config,
      `/users/${userId}/mailFolders/${folderId}?$select=displayName`,
      {},
      false
    );
    return response.displayName;
  } catch (e) {
    return 'Dossier inconnu';
  }
}

export async function deleteMailboxRule(config: AzureConfig, userId: string, ruleId: string): Promise<void> {
  await graphRequest(
    config,
    `/users/${userId}/mailFolders/inbox/messageRules/${ruleId}`,
    { method: 'DELETE' },
    false
  );
}

// Extended mailbox rule with user info
export interface UserMailboxRule extends GraphMailboxRule {
  userId: string;
  userPrincipalName: string;
  userDisplayName: string;
  isForwarding: boolean;
  isExternalForwarding: boolean;
  forwardingAddresses: string[];
  isSuspicious: boolean;
  suspiciousReasons: string[];
  moveToFolderName?: string;
}

// Scan all users for mailbox rules (with forwarding detection)
export async function scanAllMailboxRules(config: AzureConfig, users: GraphUser[]): Promise<UserMailboxRule[]> {
  const allRules: UserMailboxRule[] = [];
  
  // Process users in batches to avoid rate limiting
  const batchSize = 10;
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (user) => {
      try {
        const rules = await getMailboxRules(config, user.id);
        return Promise.all(rules.map(async rule => {
          // Detect forwarding
          const forwardingAddresses: string[] = [];
          if (rule.actions?.forwardTo) {
            forwardingAddresses.push(...rule.actions.forwardTo.map(f => f.emailAddress.address));
          }
          if (rule.actions?.forwardAsAttachmentTo) {
            forwardingAddresses.push(...rule.actions.forwardAsAttachmentTo.map(f => f.emailAddress.address));
          }
          if (rule.actions?.redirectTo) {
            forwardingAddresses.push(...rule.actions.redirectTo.map(f => f.emailAddress.address));
          }
          
          const isForwarding = forwardingAddresses.length > 0;
          
          // Check if forwarding to external domain
          const userDomain = user.userPrincipalName.split('@')[1]?.toLowerCase();
          const isExternalForwarding = forwardingAddresses.some(addr => {
            const addrDomain = addr.split('@')[1]?.toLowerCase();
            return addrDomain && addrDomain !== userDomain;
          });
          
          // Detect suspicious rules
          const suspiciousReasons: string[] = [];
          
          // Check for rules that delete emails
          if (rule.actions?.delete) {
            suspiciousReasons.push('Suppression automatique');
          }
          
          // Check for rules that move to hidden folders
          if (rule.actions?.moveToFolder) {
            const folder = rule.actions.moveToFolder.toLowerCase();
            if (folder.includes('rss') || folder.includes('junk') || folder.includes('deleted')) {
              suspiciousReasons.push('Déplacement vers dossier caché');
            }
          }
          
          // Check for suspicious subject conditions
          if (rule.conditions?.subjectContains) {
            const suspiciousKeywords = ['password', 'credentials', 'security', 'urgent', 'invoice', 'payment', 'wire', 'transfer'];
            const hasKeyword = rule.conditions.subjectContains.some(s => 
              suspiciousKeywords.some(k => s.toLowerCase().includes(k))
            );
            if (hasKeyword) {
              suspiciousReasons.push('Filtre sur mots-clés sensibles');
            }
          }
          
          // External forwarding is always flagged
          if (isExternalForwarding) {
            suspiciousReasons.push('Transfert externe');
          }
          
          // Get folder name if needed
          let moveToFolderName: string | undefined;
          if (rule.actions?.moveToFolder) {
            try {
              moveToFolderName = await getMailFolderName(config, user.id, rule.actions.moveToFolder);
            } catch {
              moveToFolderName = 'Dossier inconnu';
            }
          }
          
          return {
            ...rule,
            userId: user.id,
            userPrincipalName: user.userPrincipalName,
            userDisplayName: user.displayName,
            isForwarding,
            isExternalForwarding,
            forwardingAddresses,
            isSuspicious: suspiciousReasons.length > 0,
            suspiciousReasons,
            moveToFolderName,
          };
        }));
      } catch (e) {
        // User might not have mailbox access - skip silently
        return [];
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(rules => allRules.push(...rules));
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < users.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return allRules;
}

// Get message trace / recent emails summary (requires Exchange admin permissions)
export interface MailTrafficSummary {
  totalSent: number;
  totalReceived: number;
  externalSent: number;
  externalReceived: number;
  topSenders: { email: string; count: number }[];
  topReceivers: { email: string; count: number }[];
}

// ============================================
// USERS
// ============================================

export interface GraphUser {
  id: string;
  userPrincipalName: string;
  displayName: string;
  mail?: string;
  jobTitle?: string;
  department?: string;
  accountEnabled: boolean;
}

export async function getUsers(config: AzureConfig, top: number = 100): Promise<GraphUser[]> {
  const response = await graphRequest<{ value: GraphUser[] }>(
    config,
    `/users?$top=${top}&$select=id,userPrincipalName,displayName,mail,jobTitle,department,accountEnabled`,
    {},
    false
  );
  return response.value;
}

// Get ALL users with pagination
export async function getAllUsers(config: AzureConfig): Promise<GraphUser[]> {
  const allUsers: GraphUser[] = [];
  let nextLink: string | null = '/users?$top=999&$select=id,userPrincipalName,displayName,mail,jobTitle,department,accountEnabled';
  
  while (nextLink) {
    const response = await graphRequest<{ value: GraphUser[]; '@odata.nextLink'?: string }>(
      config,
      nextLink,
      {},
      false
    );
    allUsers.push(...response.value);
    
    // Check for next page
    if (response['@odata.nextLink']) {
      // Extract only the path part from the nextLink
      const url = new URL(response['@odata.nextLink']);
      nextLink = url.pathname + url.search;
    } else {
      nextLink = null;
    }
    
    // Safety limit to avoid infinite loops
    if (allUsers.length > 10000) break;
  }
  
  return allUsers;
}

export async function getUsersWithMailboxRules(config: AzureConfig): Promise<Array<GraphUser & { rules: GraphMailboxRule[] }>> {
  const users = await getUsers(config, 50);
  const usersWithRules: Array<GraphUser & { rules: GraphMailboxRule[] }> = [];
  
  for (const user of users) {
    try {
      const rules = await getMailboxRules(config, user.id);
      if (rules.length > 0) {
        usersWithRules.push({ ...user, rules });
      }
    } catch (e) {
      // Skip users without mailbox access
    }
  }
  
  return usersWithRules;
}

// ============================================
// REPORTS
// ============================================

export interface EmailActivityReport {
  reportRefreshDate: string;
  userPrincipalName: string;
  displayName: string;
  sendCount: number;
  receiveCount: number;
  readCount: number;
  reportPeriod: string;
}

export async function getEmailActivityReport(config: AzureConfig, period: string = 'D7'): Promise<EmailActivityReport[]> {
  // This endpoint returns CSV, proxy handles it
  const response = await fetch(`${PROXY_URL}/api/graph`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-By': 'GuardianView' },
    body: JSON.stringify({
      tenantId: config.tenantId,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      endpoint: `/reports/getEmailActivityUserDetail(period='${period}')`,
      method: 'GET',
      useBeta: false,
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to get email activity report');
  }
  
  const csvText = await response.text();
  return parseCSVReport(csvText);
}

function parseCSVReport(csv: string): EmailActivityReport[] {
  const lines = csv.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',');
  const results: EmailActivityReport[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const obj: any = {};
    headers.forEach((header, idx) => {
      obj[header.trim().replace(/"/g, '')] = values[idx]?.replace(/"/g, '') || '';
    });
    results.push({
      reportRefreshDate: obj['Report Refresh Date'] || '',
      userPrincipalName: obj['User Principal Name'] || '',
      displayName: obj['Display Name'] || '',
      sendCount: parseInt(obj['Send Count'] || '0'),
      receiveCount: parseInt(obj['Receive Count'] || '0'),
      readCount: parseInt(obj['Read Count'] || '0'),
      reportPeriod: obj['Report Period'] || '',
    });
  }
  
  return results;
}

// ============================================
// CONNECTION TEST
// ============================================

export async function testConnection(config: AzureConfig): Promise<{ success: boolean; error?: string; organization?: string }> {
  try {
    const response = await fetch(`${PROXY_URL}/api/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-By': 'GuardianView' },
      body: JSON.stringify({
        tenantId: config.tenantId,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      }),
    });

    const result = await response.json();
    return result;
  } catch (error: any) {
    return { success: false, error: error.message || 'Connection failed - is the proxy server running?' };
  }
}

// ============================================
// SECURE SCORE
// ============================================

export interface SecureScore {
  id: string;
  azureTenantId: string;
  createdDateTime: string;
  currentScore: number;
  maxScore: number;
  enabledServices: string[];
  controlScores: ControlScore[];
}

export interface ControlScore {
  controlName: string;
  controlCategory: string;
  description: string;
  score: number;
  maxScore: number;
  scoreInPercentage: number;
}

export async function getSecureScore(config: AzureConfig): Promise<SecureScore | null> {
  try {
    const response = await graphRequest<{ value: SecureScore[] }>(
      config,
      '/security/secureScores?$top=1&$orderby=createdDateTime desc',
      {},
      false
    );
    return response.value[0] || null;
  } catch (error) {
    console.error('Failed to get secure score:', error);
    return null;
  }
}

// ============================================
// USER DETAILS (360° Profile)
// ============================================

export interface UserDetails {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  mobilePhone?: string;
  businessPhones?: string[];
  createdDateTime?: string;
  accountEnabled: boolean;
  lastSignInDateTime?: string;
  assignedLicenses?: AssignedLicense[];
  memberOf?: GroupMembership[];
}

export interface AssignedLicense {
  skuId: string;
  skuPartNumber?: string;
  servicePlans?: { servicePlanName: string; provisioningStatus: string }[];
}

export interface GroupMembership {
  id: string;
  displayName: string;
  groupTypes?: string[];
}

export interface UserAuthMethod {
  id: string;
  methodType: string;
  displayName?: string;
  phoneNumber?: string;
  emailAddress?: string;
  createdDateTime?: string;
}

export async function getUserDetails(config: AzureConfig, userId: string): Promise<UserDetails | null> {
  try {
    const user = await graphRequest<UserDetails>(
      config,
      `/users/${userId}?$select=id,displayName,userPrincipalName,mail,jobTitle,department,officeLocation,mobilePhone,businessPhones,createdDateTime,accountEnabled`,
      {},
      false
    );
    return user;
  } catch (error) {
    console.error('Failed to get user details:', error);
    return null;
  }
}

export async function getUserSignInActivity(config: AzureConfig, userId: string): Promise<{ lastSignInDateTime?: string; lastNonInteractiveSignInDateTime?: string } | null> {
  try {
    const result = await graphRequest<{ signInActivity?: { lastSignInDateTime?: string; lastNonInteractiveSignInDateTime?: string } }>(
      config,
      `/users/${userId}?$select=signInActivity`,
      {},
      true // Beta API required for signInActivity
    );
    return result.signInActivity || null;
  } catch (error) {
    console.error('Failed to get user sign-in activity:', error);
    return null;
  }
}

export async function getUserAuthenticationMethods(config: AzureConfig, userId: string): Promise<UserAuthMethod[]> {
  try {
    const response = await graphRequest<{ value: any[] }>(
      config,
      `/users/${userId}/authentication/methods`,
      {},
      false
    );
    return response.value.map(m => ({
      id: m.id,
      methodType: m['@odata.type']?.replace('#microsoft.graph.', '') || 'unknown',
      displayName: m.displayName,
      phoneNumber: m.phoneNumber,
      emailAddress: m.emailAddress,
      createdDateTime: m.createdDateTime,
    }));
  } catch (error) {
    console.error('Failed to get user auth methods:', error);
    return [];
  }
}

export async function getUserGroups(config: AzureConfig, userId: string): Promise<GroupMembership[]> {
  try {
    const response = await graphRequest<{ value: GroupMembership[] }>(
      config,
      `/users/${userId}/memberOf?$select=id,displayName,groupTypes&$top=50`,
      {},
      false
    );
    return response.value.filter(m => (m as any)['@odata.type'] === '#microsoft.graph.group');
  } catch (error) {
    console.error('Failed to get user groups:', error);
    return [];
  }
}

export async function getUserLicenses(config: AzureConfig, userId: string): Promise<AssignedLicense[]> {
  try {
    const response = await graphRequest<{ value: AssignedLicense[] }>(
      config,
      `/users/${userId}/licenseDetails`,
      {},
      false
    );
    return response.value;
  } catch (error) {
    console.error('Failed to get user licenses:', error);
    return [];
  }
}

export async function getUserDevices(config: AzureConfig, userId: string): Promise<GraphManagedDevice[]> {
  try {
    const response = await graphRequest<{ value: GraphManagedDevice[] }>(
      config,
      `/users/${userId}/managedDevices?$top=50`,
      {},
      false
    );
    return response.value;
  } catch (error) {
    console.error('Failed to get user devices:', error);
    return [];
  }
}

export async function getUserSignIns(config: AzureConfig, userPrincipalName: string, top: number = 50): Promise<GraphSignIn[]> {
  try {
    const response = await graphRequest<{ value: GraphSignIn[] }>(
      config,
      `/auditLogs/signIns?$filter=userPrincipalName eq '${userPrincipalName}'&$top=${top}&$orderby=createdDateTime desc`,
      {},
      false
    );
    return response.value;
  } catch (error) {
    console.error('Failed to get user sign-ins:', error);
    return [];
  }
}

// ============================================
// CONDITIONAL ACCESS POLICIES
// ============================================

export interface ConditionalAccessPolicy {
  id: string;
  displayName: string;
  state: 'enabled' | 'disabled' | 'enabledForReportingButNotEnforced';
  createdDateTime: string;
  modifiedDateTime: string;
  conditions: {
    users?: { includeUsers?: string[]; excludeUsers?: string[]; includeGroups?: string[]; excludeGroups?: string[] };
    applications?: { includeApplications?: string[]; excludeApplications?: string[] };
    locations?: { includeLocations?: string[]; excludeLocations?: string[] };
    platforms?: { includePlatforms?: string[]; excludePlatforms?: string[] };
    signInRiskLevels?: string[];
    userRiskLevels?: string[];
  };
  grantControls?: {
    operator: string;
    builtInControls: string[];
  };
  sessionControls?: {
    signInFrequency?: { value: number; type: string };
    persistentBrowser?: { mode: string };
  };
}

export async function getConditionalAccessPolicies(config: AzureConfig): Promise<ConditionalAccessPolicy[]> {
  try {
    const response = await graphRequest<{ value: ConditionalAccessPolicy[] }>(
      config,
      '/identity/conditionalAccess/policies',
      {},
      false
    );
    return response.value;
  } catch (error) {
    console.error('Failed to get conditional access policies:', error);
    return [];
  }
}

// ============================================
// INCIDENT ACTIONS (Quick Actions)
// ============================================

export async function updateIncidentStatus(
  config: AzureConfig,
  incidentId: string,
  status: 'active' | 'resolved' | 'redirected'
): Promise<boolean> {
  try {
    await graphRequest(
      config,
      `/security/incidents/${incidentId}`,
      { method: 'PATCH', body: { status } },
      false
    );
    return true;
  } catch (error) {
    console.error('Failed to update incident status:', error);
    return false;
  }
}

export async function updateIncidentClassification(
  config: AzureConfig,
  incidentId: string,
  classification: string,
  determination?: string
): Promise<boolean> {
  try {
    const body: any = { classification };
    if (determination) body.determination = determination;
    
    await graphRequest(
      config,
      `/security/incidents/${incidentId}`,
      { method: 'PATCH', body },
      false
    );
    return true;
  } catch (error) {
    console.error('Failed to update incident classification:', error);
    return false;
  }
}

export async function assignIncident(
  config: AzureConfig,
  incidentId: string,
  assignedTo: string
): Promise<boolean> {
  try {
    await graphRequest(
      config,
      `/security/incidents/${incidentId}`,
      { method: 'PATCH', body: { assignedTo } },
      false
    );
    return true;
  } catch (error) {
    console.error('Failed to assign incident:', error);
    return false;
  }
}


// ============================================
// THREAT HUNTING / IOC SEARCH
// ============================================

export interface ThreatIndicator {
  id: string;
  action: string;
  description?: string;
  expirationDateTime?: string;
  targetProduct: string;
  threatType?: string;
  tlpLevel?: string;
  networkDestinationIPv4?: string;
  networkDestinationIPv6?: string;
  fileHashValue?: string;
  fileHashType?: string;
  domainName?: string;
  url?: string;
}

export async function searchThreatIndicators(config: AzureConfig, query: string): Promise<ThreatIndicator[]> {
  try {
    // Search by IP, domain, or hash
    let filter = '';
    if (query.includes('.') && !query.includes('/')) {
      // Likely an IP or domain
      if (/^\d+\.\d+\.\d+\.\d+$/.test(query)) {
        filter = `networkDestinationIPv4 eq '${query}'`;
      } else {
        filter = `domainName eq '${query}'`;
      }
    } else if (query.length === 32 || query.length === 40 || query.length === 64) {
      // Likely a hash (MD5, SHA1, SHA256)
      filter = `fileHashValue eq '${query}'`;
    }

    if (!filter) {
      return [];
    }

    const response = await graphRequest<{ value: ThreatIndicator[] }>(
      config,
      `/security/tiIndicators?$filter=${filter}&$top=50`,
      {},
      true // Beta API
    );
    return response.value;
  } catch (error) {
    console.error('Failed to search threat indicators:', error);
    return [];
  }
}

// ============================================
// AUDIT LOGS (for Investigation)
// ============================================

export interface AuditLog {
  id: string;
  activityDateTime: string;
  activityDisplayName: string;
  category: string;
  result: string;
  resultReason?: string;
  initiatedBy: {
    user?: { displayName: string; userPrincipalName: string };
    app?: { displayName: string };
  };
  targetResources?: {
    displayName: string;
    type: string;
    modifiedProperties?: { displayName: string; oldValue: string; newValue: string }[];
  }[];
}

export async function getAuditLogs(config: AzureConfig, top: number = 100): Promise<AuditLog[]> {
  try {
    const response = await graphRequest<{ value: AuditLog[] }>(
      config,
      `/auditLogs/directoryAudits?$top=${top}&$orderby=activityDateTime desc`,
      {},
      false
    );
    return response.value;
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    return [];
  }
}

export async function searchAuditLogs(config: AzureConfig, query: string): Promise<AuditLog[]> {
  try {
    const response = await graphRequest<{ value: AuditLog[] }>(
      config,
      `/auditLogs/directoryAudits?$filter=contains(activityDisplayName,'${query}')&$top=50&$orderby=activityDateTime desc`,
      {},
      false
    );
    return response.value;
  } catch (error) {
    console.error('Failed to search audit logs:', error);
    return [];
  }
}

// ============================================
// CURRENT USER PROFILE (/me)
// ============================================

export interface CurrentUserProfile {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  mobilePhone?: string;
  businessPhones?: string[];
  preferredLanguage?: string;
  createdDateTime?: string;
  accountEnabled: boolean;
}

export async function getCurrentUser(config: AzureConfig): Promise<CurrentUserProfile | null> {
  try {
    const user = await graphRequest<CurrentUserProfile>(
      config,
      '/me?$select=id,displayName,userPrincipalName,mail,givenName,surname,jobTitle,department,officeLocation,mobilePhone,businessPhones,preferredLanguage,createdDateTime,accountEnabled',
      {},
      false
    );
    return user;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}

export async function getCurrentUserAuthMethods(config: AzureConfig): Promise<UserAuthMethod[]> {
  try {
    const response = await graphRequest<{ value: any[] }>(
      config,
      '/me/authentication/methods',
      {},
      false
    );
    return response.value.map(m => ({
      id: m.id,
      methodType: m['@odata.type']?.replace('#microsoft.graph.', '') || 'unknown',
      displayName: m.displayName,
      phoneNumber: m.phoneNumber,
      emailAddress: m.emailAddress,
      createdDateTime: m.createdDateTime,
    }));
  } catch (error) {
    console.error('Failed to get current user auth methods:', error);
    return [];
  }
}

export async function getCurrentUserSignIns(config: AzureConfig, top: number = 20): Promise<GraphSignIn[]> {
  try {
    // First get current user to get their UPN
    const me = await getCurrentUser(config);
    if (!me) return [];
    
    const response = await graphRequest<{ value: GraphSignIn[] }>(
      config,
      `/auditLogs/signIns?$filter=userPrincipalName eq '${me.userPrincipalName}'&$top=${top}&$orderby=createdDateTime desc`,
      {},
      false
    );
    return response.value;
  } catch (error) {
    console.error('Failed to get current user sign-ins:', error);
    return [];
  }
}

export async function getCurrentUserGroups(config: AzureConfig): Promise<GroupMembership[]> {
  try {
    const response = await graphRequest<{ value: GroupMembership[] }>(
      config,
      '/me/memberOf?$select=id,displayName,groupTypes&$top=50',
      {},
      false
    );
    return response.value.filter(m => (m as any)['@odata.type'] === '#microsoft.graph.group');
  } catch (error) {
    console.error('Failed to get current user groups:', error);
    return [];
  }
}

export async function getUserAuditLogs(config: AzureConfig, userPrincipalName: string, top: number = 50): Promise<AuditLog[]> {
  try {
    const response = await graphRequest<{ value: AuditLog[] }>(
      config,
      `/auditLogs/directoryAudits?$filter=initiatedBy/user/userPrincipalName eq '${userPrincipalName}'&$top=${top}&$orderby=activityDateTime desc`,
      {},
      false
    );
    return response.value;
  } catch (error) {
    console.error('Failed to get user audit logs:', error);
    return [];
  }
}

export async function revokeUserSession(config: AzureConfig, userId: string): Promise<boolean> {
  try {
    await graphRequest(
      config,
      `/users/${userId}/revokeSignInSessions`,
      { method: 'POST' },
      false
    );
    return true;
  } catch (error) {
    console.error('Failed to revoke user session:', error);
    return false;
  }
}
