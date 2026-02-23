import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { AccountInfo, InteractionStatus } from '@azure/msal-browser';
import { loginRequest, accessGroups, UserRole, AuthenticatedUser } from '@/config/msalConfig';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthenticatedUser | null;
  userRole: UserRole;
  isAdmin: boolean;
  isUser: boolean;
  hasAccess: boolean;
  accessDeniedReason: string | null;
  login: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Graph API call to get user's group memberships
async function getUserGroups(accessToken: string): Promise<{ groups: string[]; error?: string }> {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/memberOf?$select=id,displayName', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch groups:', response.status, errorText);
      return { groups: [], error: `Erreur API Graph (${response.status}): ${errorText}` };
    }
    
    const data = await response.json();
    console.log('Raw memberOf response:', data);
    
    const groups = data.value
      .filter((item: any) => item['@odata.type'] === '#microsoft.graph.group')
      .map((group: any) => group.displayName);
    
    console.log('Filtered groups:', groups);
    return { groups };
  } catch (error: any) {
    console.error('Error fetching groups:', error);
    return { groups: [], error: `Erreur réseau: ${error.message}` };
  }
}

// Determine user role based on group membership
function determineRole(groups: string[]): UserRole {
  console.log('Checking groups for access:', groups);
  console.log('Looking for admin group:', accessGroups.SOC_ADMIN);
  console.log('Looking for user group:', accessGroups.SOC_USER);
  
  // Check for admin group first (has higher priority)
  const isAdmin = groups.some(g => {
    const match = g.toLowerCase().includes(accessGroups.SOC_ADMIN.toLowerCase());
    if (match) console.log(`Admin match found: "${g}" contains "${accessGroups.SOC_ADMIN}"`);
    return match;
  });
  if (isAdmin) return 'admin';
  
  // Check for user group
  const isUser = groups.some(g => {
    const match = g.toLowerCase().includes(accessGroups.SOC_USER.toLowerCase());
    if (match) console.log(`User match found: "${g}" contains "${accessGroups.SOC_USER}"`);
    return match;
  });
  if (isUser) return 'user';
  
  // No access
  console.log('No matching group found');
  return 'none';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { instance, accounts, inProgress } = useMsal();
  const isMsalAuthenticated = useIsAuthenticated();
  
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessDeniedReason, setAccessDeniedReason] = useState<string | null>(null);

  // Process account and fetch groups
  const processAccount = useCallback(async (account: AccountInfo) => {
    setIsLoading(true);
    setAccessDeniedReason(null);
    
    try {
      // Get access token for Graph API
      const tokenResponse = await instance.acquireTokenSilent({
        ...loginRequest,
        account,
      });
      
      // Fetch user's group memberships
      const { groups, error: groupError } = await getUserGroups(tokenResponse.accessToken);
      
      if (groupError) {
        console.error('Group fetch error:', groupError);
        setAccessDeniedReason(`Impossible de vérifier vos groupes: ${groupError}`);
        setUser(null);
        return;
      }
      
      const role = determineRole(groups);
      
      if (role === 'none') {
        setAccessDeniedReason(
          `Votre compte (${account.username}) n'est membre d'aucun groupe autorisé. ` +
          `Groupes trouvés: ${groups.length > 0 ? groups.join(', ') : 'aucun'}. ` +
          `Contactez votre administrateur pour être ajouté au groupe "${accessGroups.SOC_USER}" ou "${accessGroups.SOC_ADMIN}".`
        );
        setUser(null);
      } else {
        setUser({
          id: account.localAccountId,
          displayName: account.name || account.username,
          email: account.username,
          role,
          groups,
        });
      }
    } catch (error: any) {
      console.error('Error processing account:', error);
      // If silent token acquisition fails, try interactive
      if (error.name === 'InteractionRequiredAuthError') {
        try {
          await instance.acquireTokenPopup(loginRequest);
        } catch (popupError) {
          console.error('Popup auth failed:', popupError);
          setAccessDeniedReason('Erreur d\'authentification. Veuillez réessayer.');
        }
      } else {
        setAccessDeniedReason('Erreur lors de la vérification des permissions.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [instance]);

  // Handle authentication state changes
  useEffect(() => {
    if (inProgress === InteractionStatus.None) {
      if (accounts.length > 0) {
        processAccount(accounts[0]);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    }
  }, [accounts, inProgress, processAccount]);

  const login = async () => {
    try {
      setIsLoading(true);
      await instance.loginPopup(loginRequest);
    } catch (error) {
      console.error('Login failed:', error);
      setAccessDeniedReason('Échec de la connexion. Veuillez réessayer.');
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setAccessDeniedReason(null);
    instance.logoutPopup({
      postLogoutRedirectUri: window.location.origin,
    });
  };

  const userRole = user?.role || 'none';
  const isAdmin = userRole === 'admin';
  const isUser = userRole === 'user';
  const hasAccess = isAdmin || isUser;

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: isMsalAuthenticated && hasAccess,
        isLoading: isLoading || inProgress !== InteractionStatus.None,
        user,
        userRole,
        isAdmin,
        isUser,
        hasAccess,
        accessDeniedReason,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
