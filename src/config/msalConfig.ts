import { Configuration, LogLevel } from '@azure/msal-browser';

// MSAL configuration for Azure AD authentication
// You need to update these values with your Azure AD App Registration details
export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || '', // Your App Registration Client ID
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || 'common'}`,
    redirectUri: 'http://localhost:8080',
    postLogoutRedirectUri: 'http://localhost:8080',
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Warning:
            console.warn(message);
            return;
          default:
            return;
        }
      },
    },
  },
};

// Scopes for login - we need User.Read to get basic profile and GroupMember.Read.All to check group membership
export const loginRequest = {
  scopes: ['User.Read', 'GroupMember.Read.All'],
};

// Scopes for Microsoft Graph API calls
export const graphScopes = {
  user: ['User.Read'],
  groups: ['GroupMember.Read.All'],
  // These are for the SOC features - delegated permissions
  securityIncidents: ['SecurityIncident.Read.All'],
  signInLogs: ['AuditLog.Read.All', 'Directory.Read.All'],
  devices: ['DeviceManagementManagedDevices.Read.All'],
};

// Group IDs for access control
// UPDATE THESE WITH YOUR ACTUAL GROUP IDS FROM AZURE AD
export const accessGroups = {
  // Group for regular SOC users (view only)
  SOC_USER: import.meta.env.VITE_GROUP_SOC_USER || 'GR_ACCES_SOC',
  // Group for SOC administrators (full access)
  SOC_ADMIN: import.meta.env.VITE_GROUP_SOC_ADMIN || 'GR_ADMIN_ACCES_SOC',
};

// Role types
export type UserRole = 'admin' | 'user' | 'none';

export interface AuthenticatedUser {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  groups: string[];
}
