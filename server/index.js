// Backend Proxy Server for Microsoft Graph API
// This server handles authentication and proxies requests to avoid CORS issues

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config as loadEnv } from 'dotenv';

// Load root .env so non-VITE_ variables are available server-side
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
loadEnv({ path: join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// SÉCURITÉ — CORS strict sur origines connues
// ============================================
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origine (ex: curl, Postman interne)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Origine refusée : ${origin}`);
      callback(new Error('Origine non autorisée par la politique CORS'));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: false,
}));

// ============================================
// SÉCURITÉ — Headers HTTP via Helmet
// ============================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      connectSrc: ["'self'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
}));

// ============================================
// SÉCURITÉ — Rate limiting
// ============================================

// Limite générale : 100 requêtes / 15 min par IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Veuillez réessayer dans 15 minutes.' },
});

// Limite stricte pour les endpoints sensibles (auth) : 10 / 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives d\'authentification. Veuillez réessayer dans 15 minutes.' },
});

app.use(generalLimiter);
app.use(express.json({ limit: '512kb' }));

// ============================================
// VALIDATION — Helpers
// ============================================

const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_HTTP_METHODS = ['GET', 'POST', 'PATCH', 'DELETE'];
const NULL_BYTE_REGEX = /\x00/g;

function isValidGuid(value) {
  return typeof value === 'string' && GUID_REGEX.test(value);
}

// SÉCURITÉ — Supprime les null bytes pouvant perturber le parsing
function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  return value.replace(NULL_BYTE_REGEX, '').trim();
}

// Protection SSRF : l'endpoint doit rester dans le domaine graph.microsoft.com
function isValidGraphEndpoint(endpoint) {
  if (typeof endpoint !== 'string') return false;
  if (!endpoint.startsWith('/')) return false;
  if (endpoint.includes('://') || endpoint.includes('..')) return false;
  if (NULL_BYTE_REGEX.test(endpoint)) return false;
  if (endpoint.length > 1000) return false;
  return true;
}

// ============================================
// TOKEN CACHE
// ============================================
let tokenCache = {
  accessToken: null,
  expiresAt: 0,
  config: null,
};

async function getAccessToken(tenantId, clientId, clientSecret) {
  const configKey = `${tenantId}:${clientId}`;
  if (tokenCache.accessToken && tokenCache.config === configKey && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || 'Failed to get access token');
    }

    const data = await response.json();

    tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
      config: configKey,
    };

    return data.access_token;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================
// SÉCURITÉ — Middlewares globaux
// ============================================

// CSRF : oblige le frontend à envoyer un header custom
// Les requêtes cross-site (CSRF) ne peuvent pas ajouter de headers custom sans preflight CORS
app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE') {
    const xRequestedBy = req.headers['x-requested-by'];
    if (!xRequestedBy || xRequestedBy !== 'GuardianView') {
      console.warn(`[CSRF] Header X-Requested-By manquant depuis ${req.ip}`);
      return res.status(403).json({ error: 'Requête non autorisée (header CSRF manquant)' });
    }
  }
  next();
});

// Validation Content-Type sur les endpoints JSON
app.use((req, res, next) => {
  if ((req.method === 'POST' || req.method === 'PATCH') && req.body !== undefined) {
    const ct = req.headers['content-type'] || '';
    if (!ct.includes('application/json')) {
      return res.status(415).json({ error: 'Content-Type doit être application/json' });
    }
  }
  next();
});

// ============================================
// ENDPOINTS
// ============================================

// Test connection — rate limiter strict
app.post('/api/test-connection', authLimiter, async (req, res) => {
  try {
    const { tenantId, clientId, clientSecret } = req.body;

    if (!isValidGuid(tenantId) || !isValidGuid(clientId)) {
      return res.status(400).json({ success: false, error: 'Format Tenant ID ou Client ID invalide' });
    }
    if (typeof clientSecret !== 'string' || clientSecret.length < 1 || clientSecret.length > 512) {
      return res.status(400).json({ success: false, error: 'Client Secret invalide' });
    }

    const token = await getAccessToken(tenantId, clientId, clientSecret);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const testResponse = await fetch('https://graph.microsoft.com/v1.0/organization', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal,
      });

      if (!testResponse.ok) {
        const error = await testResponse.json();
        return res.json({ success: false, error: error.error?.message || 'API test failed' });
      }

      const orgData = await testResponse.json();
      res.json({ success: true, organization: orgData.value?.[0]?.displayName || 'Connected' });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    res.json({ success: false, error: error.name === 'AbortError' ? 'Timeout — serveur Microsoft Graph inaccessible' : error.message });
  }
});

// Generic Graph API proxy
app.post('/api/graph', async (req, res) => {
  try {
    const { tenantId, clientId, clientSecret, endpoint, method = 'GET', body, useBeta = false } = req.body;

    if (!isValidGuid(tenantId) || !isValidGuid(clientId)) {
      return res.status(400).json({ error: 'Format Tenant ID ou Client ID invalide' });
    }
    if (typeof clientSecret !== 'string' || clientSecret.length < 1 || clientSecret.length > 512) {
      return res.status(400).json({ error: 'Client Secret invalide' });
    }
    if (!isValidGraphEndpoint(endpoint)) {
      return res.status(400).json({ error: 'Endpoint Graph API invalide' });
    }
    if (!ALLOWED_HTTP_METHODS.includes(method)) {
      return res.status(400).json({ error: 'Méthode HTTP non autorisée' });
    }

    const token = await getAccessToken(tenantId, clientId, clientSecret);
    const baseUrl = useBeta ? 'https://graph.microsoft.com/beta' : 'https://graph.microsoft.com/v1.0';

    const fetchOptions = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, { ...fetchOptions, signal: controller.signal });

      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        const data = await response.json();
        if (!response.ok) {
          return res.status(response.status).json({ error: data.error?.message || 'Graph API error' });
        }
        res.json(data);
      } else if (contentType?.includes('text/csv') || contentType?.includes('application/octet-stream')) {
        const text = await response.text();
        res.type('text/csv').send(text);
      } else {
        const text = await response.text();
        res.send(text);
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error('Graph API error:', error.name === 'AbortError' ? 'Timeout' : error.message);
    res.status(500).json({ error: error.name === 'AbortError' ? 'Timeout — requête Graph API trop longue' : error.message });
  }
});

// Clear token cache (logout/disconnect)
app.post('/api/clear-cache', (req, res) => {
  tokenCache = { accessToken: null, expiresAt: 0, config: null };
  res.json({ success: true });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Teams Webhook Proxy — l'URL est lue depuis l'env serveur, jamais exposée au client
app.post('/api/teams-webhook', async (req, res) => {
  try {
    const webhookUrl = process.env.TEAMS_WEBHOOK_URL;

    if (!webhookUrl) {
      return res.status(503).json({ success: false, error: 'Webhook Teams non configuré sur le serveur (TEAMS_WEBHOOK_URL manquant)' });
    }

    const { card } = req.body;

    if (!card || typeof card !== 'object') {
      return res.status(400).json({ success: false, error: 'Payload de carte Teams invalide' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(card),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Teams webhook error:', response.status, errorText);
        return res.status(response.status).json({
          success: false,
          error: `Teams webhook error: ${response.status}`,
        });
      }

      console.log('✅ Teams webhook sent successfully');
      res.json({ success: true });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error('Teams webhook proxy error:', error.name === 'AbortError' ? 'Timeout' : error.message);
    res.status(500).json({ success: false, error: error.name === 'AbortError' ? 'Timeout Teams webhook' : error.message });
  }
});

// Statut du webhook Teams (pour le frontend)
app.get('/api/teams-webhook/status', (req, res) => {
  res.json({ configured: !!process.env.TEAMS_WEBHOOK_URL });
});

app.listen(PORT, () => {
  console.log(`🚀 Graph API Proxy Server running on http://localhost:${PORT}`);
  console.log(`   - CORS autorisé pour : ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`   - Teams webhook configuré : ${!!process.env.TEAMS_WEBHOOK_URL}`);
  console.log(`   - Test connection: POST /api/test-connection`);
  console.log(`   - Graph proxy: POST /api/graph`);
  console.log(`   - Teams webhook: POST /api/teams-webhook`);
});
