// Configuration storage for Azure AD credentials
export interface AzureConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  isConfigured: boolean;
}

// SÉCURITÉ : sessionStorage au lieu de localStorage
//  - Effacé automatiquement à la fermeture de l'onglet (fenêtre d'exposition réduite)
//  - Non partagé entre les onglets (isolation)
//  - En cas de XSS, le secret n'est pas persisté indéfiniment
const CONFIG_KEY = 'soc_portal_azure_config';
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// SÉCURITÉ : validation du format GUID Azure AD
function isValidGuid(value: string): boolean {
  return typeof value === 'string' && GUID_PATTERN.test(value.trim());
}

// SÉCURITÉ : supprime les caractères de contrôle et null bytes
function sanitizeString(value: string): string {
  return value.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

export function getStoredConfig(): AzureConfig | null {
  try {
    const stored = sessionStorage.getItem(CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as AzureConfig;
      }
    }
  } catch (e) {
    console.error('Failed to parse stored config:', e);
    sessionStorage.removeItem(CONFIG_KEY);
  }
  return null;
}

export function saveConfig(config: Omit<AzureConfig, 'isConfigured'>): AzureConfig {
  const sanitized = {
    tenantId: sanitizeString(config.tenantId),
    clientId: sanitizeString(config.clientId),
    clientSecret: sanitizeString(config.clientSecret),
  };

  const fullConfig: AzureConfig = {
    ...sanitized,
    isConfigured: !!(sanitized.tenantId && sanitized.clientId && sanitized.clientSecret),
  };
  sessionStorage.setItem(CONFIG_KEY, JSON.stringify(fullConfig));
  return fullConfig;
}

export function clearConfig(): void {
  sessionStorage.removeItem(CONFIG_KEY);
}

export function isConfigValid(config: AzureConfig | null): config is AzureConfig {
  return !!(
    config &&
    isValidGuid(config.tenantId) &&
    isValidGuid(config.clientId) &&
    config.clientSecret &&
    config.clientSecret.length > 0 &&
    config.isConfigured
  );
}
