import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AzureConfig, getStoredConfig, saveConfig, clearConfig, isConfigValid } from '@/services/config';
import { 
  testConnection, clearTokenCache,
  getSecurityIncidents, GraphIncident,
  getSignInLogs, GraphSignIn, SignInPeriod,
  getManagedDevices, getAllManagedDevices, GraphManagedDevice,
  getUsers, getAllUsers, GraphUser,
  getRiskyUsers, GraphRiskyUser,
  scanAllMailboxRules, UserMailboxRule,
  deleteMailboxRule,
} from '@/services/graphApi';

// Types for connector status
export type ConnectorStatus = 'connected' | 'disconnected' | 'error' | 'loading';

export interface ConnectorState {
  defender: { status: ConnectorStatus; lastSync: Date | null; error?: string };
  entra: { status: ConnectorStatus; lastSync: Date | null; error?: string };
  intune: { status: ConnectorStatus; lastSync: Date | null; error?: string };
  exchange: { status: ConnectorStatus; lastSync: Date | null; error?: string };
}

// Data state interface
export interface SOCData {
  incidents: GraphIncident[];
  signInLogs: GraphSignIn[];
  devices: GraphManagedDevice[];
  users: GraphUser[];
  riskyUsers: GraphRiskyUser[];
  mailboxRules: UserMailboxRule[];
}

// Context interface
interface SOCContextType {
  // Configuration
  config: AzureConfig | null;
  isConfigured: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  
  // Actions
  connect: (tenantId: string, clientId: string, clientSecret: string) => Promise<boolean>;
  disconnect: () => void;
  
  // Connector status
  connectors: ConnectorState;
  
  // Data
  data: SOCData;
  isLoading: boolean;
  
  // Refresh functions
  refreshAll: () => Promise<void>;
  refreshIncidents: () => Promise<void>;
  refreshSignIns: (period?: SignInPeriod) => Promise<void>;
  refreshDevices: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  refreshExchange: () => Promise<void>;
  
  // Actions
  deleteMailboxRuleAction: (userId: string, ruleId: string) => Promise<void>;
}

const defaultConnectors: ConnectorState = {
  defender: { status: 'disconnected', lastSync: null },
  entra: { status: 'disconnected', lastSync: null },
  intune: { status: 'disconnected', lastSync: null },
  exchange: { status: 'disconnected', lastSync: null },
};

const defaultData: SOCData = {
  incidents: [],
  signInLogs: [],
  devices: [],
  users: [],
  riskyUsers: [],
  mailboxRules: [],
};

const SOCContext = createContext<SOCContextType | undefined>(undefined);

export function SOCProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AzureConfig | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<ConnectorState>(defaultConnectors);
  const [data, setData] = useState<SOCData>(defaultData);
  const [isLoading, setIsLoading] = useState(false);

  // Load stored config on mount
  useEffect(() => {
    const stored = getStoredConfig();
    if (stored && isConfigValid(stored)) {
      setConfig(stored);
    }
  }, []);

  // Auto-refresh data when config is valid
  useEffect(() => {
    if (isConfigValid(config)) {
      refreshAll();
    }
  }, [config?.isConfigured]);

  const updateConnector = (
    connector: keyof ConnectorState, 
    status: ConnectorStatus, 
    error?: string
  ) => {
    setConnectors(prev => ({
      ...prev,
      [connector]: { 
        status, 
        lastSync: status === 'connected' ? new Date() : prev[connector].lastSync,
        error 
      },
    }));
  };

  const connect = async (tenantId: string, clientId: string, clientSecret: string): Promise<boolean> => {
    setIsConnecting(true);
    setConnectionError(null);
    await clearTokenCache();

    const newConfig: AzureConfig = {
      tenantId,
      clientId,
      clientSecret,
      isConfigured: true,
    };

    try {
      const result = await testConnection(newConfig);
      if (result.success) {
        const saved = saveConfig(newConfig);
        setConfig(saved);
        setIsConnecting(false);
        return true;
      } else {
        setConnectionError(result.error || 'Connection failed');
        setIsConnecting(false);
        return false;
      }
    } catch (error: any) {
      setConnectionError(error.message || 'Connection failed');
      setIsConnecting(false);
      return false;
    }
  };

  const disconnect = async () => {
    clearConfig();
    await clearTokenCache();
    setConfig(null);
    setConnectors(defaultConnectors);
    setData(defaultData);
    setConnectionError(null);
  };

  const refreshIncidents = useCallback(async () => {
    if (!isConfigValid(config)) return;
    
    updateConnector('defender', 'loading');
    try {
      const incidents = await getSecurityIncidents(config);
      setData(prev => ({ ...prev, incidents }));
      updateConnector('defender', 'connected');
    } catch (error: any) {
      updateConnector('defender', 'error', error.message);
    }
  }, [config]);

  const refreshSignIns = useCallback(async (period: SignInPeriod = '12h') => {
    if (!isConfigValid(config)) return;
    
    updateConnector('entra', 'loading');
    try {
      const [signInLogs, riskyUsers] = await Promise.all([
        getSignInLogs(config, period),
        getRiskyUsers(config).catch(() => []),
      ]);
      setData(prev => ({ ...prev, signInLogs, riskyUsers }));
      updateConnector('entra', 'connected');
    } catch (error: any) {
      updateConnector('entra', 'error', error.message);
    }
  }, [config]);

  const refreshDevices = useCallback(async () => {
    if (!isConfigValid(config)) return;
    
    updateConnector('intune', 'loading');
    try {
      // Fetch ALL devices with pagination
      const devices = await getAllManagedDevices(config);
      setData(prev => ({ ...prev, devices }));
      updateConnector('intune', 'connected');
    } catch (error: any) {
      updateConnector('intune', 'error', error.message);
    }
  }, [config]);

  const refreshUsers = useCallback(async () => {
    if (!isConfigValid(config)) return;
    
    try {
      // Fetch ALL users with pagination
      const users = await getAllUsers(config);
      setData(prev => ({ ...prev, users }));
    } catch (error: any) {
      console.error('Failed to fetch users:', error.message);
    }
  }, [config]);

  const refreshExchange = useCallback(async () => {
    if (!isConfigValid(config)) return;
    
    updateConnector('exchange', 'loading');
    try {
      // First get all users if not already loaded
      let users = data.users;
      if (users.length === 0) {
        users = await getAllUsers(config);
        setData(prev => ({ ...prev, users }));
      }
      
      // Scan mailbox rules for all users (limit to first 100 for performance)
      const usersToScan = users.slice(0, 100);
      const mailboxRules = await scanAllMailboxRules(config, usersToScan);
      setData(prev => ({ ...prev, mailboxRules }));
      updateConnector('exchange', 'connected');
    } catch (error: any) {
      updateConnector('exchange', 'error', error.message);
    }
  }, [config, data.users]);

  const deleteMailboxRuleAction = useCallback(async (userId: string, ruleId: string) => {
    if (!isConfigValid(config)) return;
    
    try {
      await deleteMailboxRule(config, userId, ruleId);
      // Remove from local state
      setData(prev => ({
        ...prev,
        mailboxRules: prev.mailboxRules.filter(r => !(r.userId === userId && r.id === ruleId))
      }));
    } catch (error: any) {
      console.error('Failed to delete mailbox rule:', error.message);
      throw error;
    }
  }, [config]);

  const refreshAll = useCallback(async () => {
    if (!isConfigValid(config)) return;
    
    setIsLoading(true);
    await Promise.all([
      refreshIncidents(),
      refreshSignIns(),
      refreshDevices(),
      refreshUsers(),
    ]);
    // Exchange scan is separate due to being slower
    await refreshExchange();
    setIsLoading(false);
  }, [refreshIncidents, refreshSignIns, refreshDevices, refreshUsers, refreshExchange, config]);

  const value: SOCContextType = {
    config,
    isConfigured: isConfigValid(config),
    isConnecting,
    connectionError,
    connect,
    disconnect,
    connectors,
    data,
    isLoading,
    refreshAll,
    refreshIncidents,
    refreshSignIns,
    refreshDevices,
    refreshUsers,
    refreshExchange,
    deleteMailboxRuleAction,
  };

  return (
    <SOCContext.Provider value={value}>
      {children}
    </SOCContext.Provider>
  );
}

export function useSOC() {
  const context = useContext(SOCContext);
  if (context === undefined) {
    throw new Error('useSOC must be used within a SOCProvider');
  }
  return context;
}
