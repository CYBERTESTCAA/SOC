# Guardian View SOC - Guide de Configuration

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 18+
- Un tenant Azure avec les services Microsoft 365
- Une App Registration Azure AD

---

## 1. Configuration Azure AD (App Registration)

### Créer l'App Registration

1. Allez sur [Azure Portal](https://portal.azure.com)
2. Naviguez vers **Azure Active Directory** → **App registrations**
3. Cliquez sur **New registration**
4. Configurez :
   - **Name**: `Guardian View SOC`
   - **Supported account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: Laissez vide (pas nécessaire pour client_credentials)
5. Cliquez sur **Register**

### Récupérer les Credentials

Après création, notez :
- **Application (client) ID** → C'est votre `clientId`
- **Directory (tenant) ID** → C'est votre `tenantId`

### Créer un Client Secret

1. Dans votre App Registration, allez dans **Certificates & secrets**
2. Cliquez sur **New client secret**
3. Description: `Guardian View Secret`
4. Expiration: Choisissez selon votre politique de sécurité
5. Cliquez sur **Add**
6. **⚠️ IMPORTANT**: Copiez immédiatement la **Value** → C'est votre `clientSecret`

### Configurer les Permissions API

1. Allez dans **API permissions**
2. Cliquez sur **Add a permission** → **Microsoft Graph** → **Application permissions**
3. Ajoutez les permissions suivantes :

| Permission | Description |
|------------|-------------|
| `SecurityEvents.Read.All` | Lire les événements de sécurité |
| `SecurityIncident.Read.All` | Lire les incidents |
| `SecurityIncident.ReadWrite.All` | Modifier les incidents (optionnel) |
| `AuditLog.Read.All` | Lire les logs d'audit (sign-ins) |
| `Directory.Read.All` | Lire le répertoire |
| `DeviceManagementManagedDevices.Read.All` | Lire les appareils Intune |
| `User.Read.All` | Lire les utilisateurs |
| `IdentityRiskyUser.Read.All` | Lire les utilisateurs à risque |
| `Mail.Read` | Lire les règles de messagerie (optionnel) |
| `Reports.Read.All` | Lire les rapports d'utilisation |

4. Cliquez sur **Grant admin consent for [votre tenant]**

---

## 2. Installation du Projet

### Installer les dépendances Frontend

```bash
cd guardian-view-main
npm install
```

### Installer les dépendances Backend (Proxy Server)

```bash
cd server
npm install
```

---

## 3. Lancer l'Application

### Démarrer le Backend Proxy (Terminal 1)

```bash
cd server
npm run dev
```

Le serveur démarre sur `http://localhost:3001`

### Démarrer le Frontend (Terminal 2)

```bash
npm run dev
```

L'application démarre sur `http://localhost:5173` (ou autre port Vite)

---

## 4. Configuration dans l'Application

1. Ouvrez l'application dans votre navigateur
2. Connectez-vous avec les credentials par défaut :
   - **Username**: `admin`
   - **Password**: `adminpasswordc@@49!`
3. Allez dans **Paramètres**
4. Entrez vos credentials Azure :
   - **Tenant ID**
   - **Client ID**
   - **Client Secret**
5. Cliquez sur **Connecter**

---

## 5. Génération Automatique de Rapports

### Rapports Manuels

1. Allez dans **Rapports**
2. Sélectionnez la période (24h, 7j, 30j)
3. Cliquez sur **Générer Maintenant**
4. Une fois généré, cliquez sur **Télécharger** (HTML ou CSV)

### Rapports Planifiés

Les rapports planifiés sont stockés localement. Pour une vraie automatisation en production, vous devez :

1. **Option A - Tâche Cron/Scheduled Task**
   - Créer un script Node.js qui appelle le backend
   - Planifier avec cron (Linux) ou Task Scheduler (Windows)

2. **Option B - Azure Functions**
   - Déployer une Azure Function Timer Trigger
   - Appeler les APIs Graph et envoyer par email

3. **Option C - Power Automate**
   - Créer un flow planifié
   - Utiliser les connecteurs Microsoft 365

### Exemple de Script pour Rapport Automatique

```javascript
// scheduled-report.js
import fetch from 'node-fetch';

const config = {
  tenantId: 'YOUR_TENANT_ID',
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
};

async function generateReport() {
  // Appeler votre backend proxy
  const response = await fetch('http://localhost:3001/api/graph', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...config,
      endpoint: '/security/incidents?$top=50',
    }),
  });
  
  const incidents = await response.json();
  console.log(`${incidents.value?.length || 0} incidents trouvés`);
  
  // Générer et envoyer le rapport...
}

generateReport();
```

---

## 6. Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Frontend       │────▶│  Backend Proxy  │────▶│  Microsoft      │
│  (React/Vite)   │     │  (Express)      │     │  Graph API      │
│  :5173          │     │  :3001          │     │                 │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

Le backend proxy est nécessaire car :
- Les appels `client_credentials` ne peuvent pas être faits depuis le navigateur (CORS)
- Le `client_secret` ne doit JAMAIS être exposé côté client
- Le proxy gère le cache des tokens

---

## 7. Sécurité en Production

⚠️ **Pour un déploiement en production :**

1. **Ne stockez JAMAIS** le `clientSecret` dans le frontend
2. Utilisez des **variables d'environnement** pour le backend :
   ```bash
   export AZURE_TENANT_ID=xxx
   export AZURE_CLIENT_ID=xxx
   export AZURE_CLIENT_SECRET=xxx
   ```

3. Activez **HTTPS** sur le backend proxy

4. Mettez en place une **authentification** sur le proxy (ex: API Key, OAuth)

5. Déployez le backend sur :
   - Azure App Service
   - Azure Container Apps
   - AWS Lambda / API Gateway
   - Votre propre serveur sécurisé

---

## 8. Troubleshooting

### Erreur "CORS"
→ Assurez-vous que le backend proxy est démarré sur le port 3001

### Erreur "401 Unauthorized"
→ Vérifiez que les permissions API ont reçu le "Admin Consent"

### Erreur "403 Forbidden"
→ Certaines permissions nécessitent une licence premium (ex: Identity Protection)

### Pas de données
→ Vérifiez que votre tenant a des données (incidents, sign-ins, devices)

---

## 9. Roadmap des Améliorations

### MVP ✅
- [x] Connexion Graph API via proxy
- [x] Incidents Defender
- [x] Sign-ins Entra ID
- [x] Devices Intune
- [x] Génération de rapports

### V1 (À venir)
- [ ] Entity 360 (User, Device, IP)
- [ ] Corrélation multi-sources
- [ ] Règles d'alerting personnalisées
- [ ] Envoi de rapports par email

### V2 (Avancé)
- [ ] Case management
- [ ] Playbooks automatisés
- [ ] Intégration ITSM
- [ ] Scoring de risque avancé
