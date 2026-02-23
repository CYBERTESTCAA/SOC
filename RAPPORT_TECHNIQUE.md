# Rapport Technique — Guardian View
## Portail SOC Microsoft 365

---

## 1. Présentation générale de l'application

**Guardian View** est un portail de **Security Operations Center (SOC)** dédié à la surveillance et à l'analyse de la sécurité d'un environnement Microsoft 365. L'application permet aux équipes de sécurité informatique de centraliser, visualiser et analyser en temps réel toutes les données de sécurité provenant des différentes solutions Microsoft : Defender XDR, Entra ID (anciennement Azure Active Directory), Intune et Exchange Online.

L'objectif principal est d'offrir une **interface unique et unifiée** pour les analystes SOC, remplaçant la navigation entre plusieurs portails Microsoft (Microsoft Defender Portal, Entra Admin Center, Intune Admin Center, Exchange Admin Center).

---

## 2. Hébergement, dépôt et déploiement

### 2.1 Dépôt GitHub d'entreprise

Le code source de Guardian View est hébergé sur un **dépôt GitHub privé appartenant au compte GitHub de l'entreprise**. Ce dépôt est accessible uniquement aux membres de l'organisation GitHub de l'entreprise, garantissant la confidentialité du code et des configurations.

L'utilisation de GitHub comme plateforme de gestion de version permet :
- Un **historique complet** des modifications (commits, branches, pull requests)
- La **collaboration** entre développeurs via les pull requests et les code reviews
- L'intégration native avec GitHub Actions pour le CI/CD

### 2.2 Déploiement sur VM Debian 13

L'application est déployée **en local dans l'infrastructure de l'entreprise** sur une **machine virtuelle sous Debian 13 (Trixie)**. Ce choix d'hébergement en local (on-premise) présente plusieurs avantages dans un contexte SOC :

- **Sécurité** : les données de sécurité ne transitent pas par des clouds publics tiers
- **Latence** : accès rapide aux ressources internes
- **Contrôle** : maîtrise complète de l'environnement d'exécution
- **Conformité** : les données restent dans le périmètre de l'entreprise

Sur la VM, deux processus sont en cours d'exécution en continu :
- Le **serveur frontend** (Vite / Nginx servant le build statique) sur le port 8080
- Le **serveur proxy Node.js/Express** sur le port 3001

### 2.3 Pipeline CI/CD avec GitHub Actions — Self-Hosted Runner

L'application bénéficie d'un pipeline de **déploiement continu automatisé**. Voici le fonctionnement :

```
Développeur
    │
    │  git push → branche main
    ▼
GitHub (dépôt entreprise)
    │
    │  Déclenchement du workflow GitHub Actions
    ▼
Self-Hosted Runner (installé sur la VM Debian 13)
    │
    ├── git pull  →  récupère le nouveau code
    ├── npm install  →  installe les dépendances
    ├── npm run build  →  compile le frontend (Vite)
    ├── cd server && npm install  →  dépendances backend
    └── redémarrage des services  →  mise à jour en production
    ▼
SOC mis à jour et opérationnel
```

Le **self-hosted runner** est un agent GitHub Actions installé directement sur la VM Debian 13. Contrairement aux runners GitHub hébergés dans le cloud, ce runner tourne sur l'infrastructure interne de l'entreprise, ce qui lui permet :
- D'accéder directement au système de fichiers de la VM
- De redémarrer les services applicatifs (via `systemd` ou `pm2`)
- De ne pas exposer les fichiers de configuration sensibles (`.env`) à GitHub
- D'effectuer le déploiement sans ouvrir de port entrant sur la VM

**Avantage clé** : le fichier `.env` (contenant les secrets Azure) n'est **jamais versionné sur GitHub**. Il est uniquement présent sur la VM et géré localement par l'équipe infra.

---

## 3. Architecture technique

### 3.1 Vue d'ensemble

L'application repose sur une **architecture deux-tiers** :

```
[Navigateur - Frontend React]  ←→  [Serveur Proxy Node.js]  ←→  [Microsoft Graph API]
        Port 8080                          Port 3001                  Internet
          (VM Debian 13)                (VM Debian 13)
```

Cette architecture est nécessaire car les appels directs depuis le navigateur vers l'API Microsoft Graph sont bloqués par les politiques **CORS** (Cross-Origin Resource Sharing). Le serveur proxy agit comme intermédiaire et gère également la **mise en cache des tokens d'accès**.

### 3.2 Stack technologique

**Frontend :**

| Technologie | Version | Rôle |
|---|---|---|
| React | 18.3 | Framework UI principal |
| TypeScript | 5.8 | Typage statique |
| Vite | 5.4 | Bundler / outil de développement |
| TailwindCSS | 3.4 | Framework CSS utilitaire |
| shadcn/ui + Radix UI | — | Composants UI accessibles |
| React Router DOM | 6.x | Routage SPA |
| TanStack React Query | 5.x | Gestion des données serveur |
| Recharts | 2.x | Graphiques et visualisations |
| MSAL Browser / React | 3.x | Authentification Azure AD |
| date-fns | 3.x | Manipulation des dates |
| Lucide React | — | Icônes |
| Zod | 3.x | Validation de schémas |

**Backend (serveur proxy) :**

| Technologie | Version | Rôle |
|---|---|---|
| Node.js | — | Runtime JavaScript serveur |
| Express | 4.x | Framework HTTP |
| node-fetch | 3.x | Requêtes HTTP vers Graph API |
| cors | 2.x | Gestion des en-têtes CORS |

**Outils de développement :**

| Outil | Rôle |
|---|---|
| Vitest | Framework de tests unitaires |
| ESLint | Analyse statique du code (linting) |
| PostCSS / Autoprefixer | Traitement CSS multi-navigateur |
| @vitejs/plugin-react-swc | Compilation rapide React via SWC |
| GitHub Actions | Pipeline CI/CD automatisé |

---

## 4. Fonctionnalités détaillées

### 4.1 Authentification et contrôle d'accès (MSAL + Azure AD)

L'authentification est gérée via la bibliothèque **MSAL (Microsoft Authentication Library)** qui permet une connexion SSO (Single Sign-On) avec les comptes Microsoft 365 de l'entreprise. Le flux est le suivant :

1. L'utilisateur clique sur "Se connecter" → une popup Microsoft s'ouvre
2. MSAL acquiert un token d'accès avec les scopes `User.Read` et `GroupMember.Read.All`
3. L'application interroge Graph API pour récupérer les **groupes Azure AD** de l'utilisateur
4. Le rôle est déterminé selon l'appartenance aux groupes configurés :
   - `GR_ADMIN_ACCES_SOC` → rôle **admin** (accès complet)
   - `GR_ACCES_SOC` → rôle **user** (accès lecture seule)
   - Aucun groupe → accès **refusé**

Si l'utilisateur n'appartient à aucun groupe autorisé, un message explicite lui indique quels groupes sont requis et lui demande de contacter un administrateur.

Les tokens sont stockés en **sessionStorage** (pas localStorage) pour des raisons de sécurité, évitant la persistence des tokens entre sessions.

### 4.2 Configuration du connecteur Microsoft Graph (Service Account)

Dans l'onglet **Paramètres → Connecteurs**, l'analyste SOC configure une **Azure App Registration** (compte de service) avec :
- **Tenant ID** : identifiant de l'organisation Azure
- **Client ID** : identifiant de l'application enregistrée
- **Client Secret** : secret d'application

Cette configuration utilise le flux **OAuth 2.0 Client Credentials** (machine-to-machine, sans utilisateur interactif) pour appeler l'API Graph avec des permissions d'application. Le serveur proxy gère un **cache de token** côté serveur pour éviter de regénérer un token à chaque requête (les tokens durent 1 heure).

### 4.3 Dashboard principal

Le dashboard est la vue d'accueil et présente :

- **Métriques clés** : incidents actifs, connexions à risque, appareils non conformes, utilisateurs à risque
- **Microsoft Secure Score** : score de sécurité global de l'organisation (0-100)
- **Graphique de connexions** : courbe horaire sur 24h (connexions réussies vs échouées)
- **Distribution par sévérité** : camembert des incidents par niveau de criticité
- **Top 10 pays de connexion** : origines géographiques des connexions
- **Santé des connecteurs** : statut en temps réel de chaque source de données

### 4.4 Gestion des incidents (Microsoft Defender XDR)

- Liste des 50 derniers incidents triés par date décroissante
- Filtrage multi-critères (sévérité, statut, assignataire, plage temporelle)
- Panneau de détail avec alertes associées, preuves, commentaires, timeline
- Modification d'incidents (statut, assignataire, classification) via PATCH Graph API
- Ajout de commentaires directement depuis l'interface
- Badges **MITRE ATT&CK** sur les techniques d'attaque détectées

### 4.5 Analyse des connexions (Entra ID / Identity Protection)

- Récupération avec **pagination automatique** jusqu'à 10 000 connexions
- Périodes configurables : 12h, 1j, 3j, 7j, 30j, 90j
- Affichage : utilisateur, IP, pays, application, statut MFA, niveau de risque

**Moteur de détection d'anomalies** intégré :
- Connexions depuis des **pays à risque élevé** (Russie, Chine, Corée du Nord, Iran…)
- Connexions à des **heures inhabituelles** (0h-5h du matin)
- **Brute-force** (≥ 5 échecs/heure)
- **Voyage impossible** (connexion depuis deux pays distants en trop peu de temps)
- Connexions depuis **plusieurs pays** le même jour

Un **score de risque utilisateur** (0-100) est calculé automatiquement.

### 4.6 Conformité des appareils (Microsoft Intune)

- Récupération de tous les appareils avec pagination complète
- Filtrage par OS (Windows, macOS, iOS, Android), état de conformité, chiffrement
- **Action de synchronisation** : force un sync Intune sur un appareil depuis l'interface
- Métriques : total, conformes, non conformes, non chiffrés, OS obsolètes

### 4.7 Sécurité Exchange Online

- **Scan de toutes les boîtes mail** par batches de 10 utilisateurs (respect des rate limits)
- **Détection de règles suspectes** :
  - Transfert vers un domaine externe
  - Suppression automatique d'emails
  - Déplacement vers un dossier caché
- **Suppression de règle** depuis l'interface (admin uniquement)
- Vue profil 360° d'un utilisateur (connexions, appareils, incidents, règles mail)

### 4.8 Investigation transversale

Outil d'investigation cross-workload permettant de corréler des données de plusieurs sources pour un utilisateur ou une entité donnée (IP, appareil). Corrélation incidents + connexions + appareils + règles mail dans une vue unifiée.

### 4.9 Rapports et planification

- **Types** : résumé sécurité, identité et accès, conformité endpoints, rapport complet
- **Formats** : PDF, CSV, HTML
- **Planification** : fréquence (quotidienne, hebdomadaire, mensuelle), heure, destinataires
- Résumé hebdomadaire synthétique intégré

### 4.10 Intégration Microsoft Teams

Envoi d'alertes en temps réel dans un canal Teams via **Incoming Webhook** :
- Templates par type d'alerte (incident, règle forwarding, utilisateur à risque, appareil non conforme)
- Couleur par sévérité, boutons d'action rapide vers Guardian View
- Envoi via le proxy backend (contourne les restrictions CORS)

---

## 5. Structure du code source

```
guardian-view/
├── .github/
│   └── workflows/              # Workflows GitHub Actions (CI/CD)
│
├── server/                     # Backend proxy Node.js/Express
│   ├── index.js                # Serveur Express (endpoints /api/*)
│   └── package.json
│
└── src/                        # Frontend React/TypeScript
    ├── main.tsx                # Point d'entrée, montage MSAL
    ├── App.tsx                 # Routage principal + garde d'authentification
    │
    ├── config/
    │   └── msalConfig.ts       # Config MSAL, scopes, groupes AD
    │
    ├── context/                # État global (React Context)
    │   ├── AuthContext.tsx     # Auth MSAL + rôles
    │   ├── SOCContext.tsx      # Données SOC + connecteurs
    │   └── GlobalFilterContext.tsx  # Filtres transversaux
    │
    ├── services/               # Couche d'accès aux données
    │   ├── graphApi.ts         # Toutes les fonctions Graph API
    │   ├── anomalyDetection.ts # Moteur de détection comportementale
    │   ├── reportService.ts    # Génération et planification rapports
    │   ├── teamsWebhook.ts     # Intégration Teams
    │   └── config.ts           # Gestion config Azure (localStorage)
    │
    ├── components/
    │   ├── auth/               # Page de connexion
    │   ├── ui/                 # 49 composants shadcn/ui réutilisables
    │   └── soc/                # 29 composants métier SOC
    │       ├── DashboardView.tsx
    │       ├── IncidentsView.tsx / IncidentDetailDrawer.tsx
    │       ├── SignInsView.tsx
    │       ├── DevicesView.tsx
    │       ├── ExchangeView.tsx
    │       ├── InvestigationView.tsx
    │       ├── ReportsView.tsx
    │       ├── SettingsView.tsx
    │       ├── ProfileView.tsx
    │       └── Header.tsx / Sidebar.tsx / GlobalFilterBar.tsx
    │
    ├── hooks/
    │   └── useKeyboardShortcuts.ts  # Raccourcis clavier (Ctrl+D, Ctrl+I…)
    │
    ├── pages/
    │   ├── Index.tsx           # Layout principal + routage des vues
    │   └── NotFound.tsx        # Page 404
    │
    ├── types/                  # Types TypeScript partagés
    ├── utils/                  # Fonctions utilitaires (pays…)
    └── test/                   # Tests unitaires Vitest
```

---

## 6. Flux de données

```
1. Connexion utilisateur
   MSAL → Azure AD → token délégué → vérification groupes → rôle attribué

2. Configuration connecteur
   SettingsView → SOCContext.connect() → POST /api/test-connection
   → Proxy → OAuth2 Client Credentials → Microsoft Graph /organization
   → Succès : config sauvegardée en localStorage

3. Récupération de données (ex : incidents)
   SOCContext.refreshIncidents()
   → graphApi.getSecurityIncidents(config)
   → POST /api/graph { endpoint: '/security/incidents' }
   → Proxy : getAccessToken() [cache 1h] → GET graph.microsoft.com
   → JSON retourné → state React mis à jour → re-render composants

4. Alerte Teams
   Événement détecté → teamsWebhook.sendAlert()
   → POST /api/teams-webhook { webhookUrl, card }
   → Proxy → POST canal Teams

5. Déploiement (push GitHub)
   git push → GitHub Actions déclenché → Self-Hosted Runner sur VM Debian 13
   → git pull + npm install + npm run build → services redémarrés
```

---

## 7. Bonnes pratiques de développement appliquées

### 7.1 TypeScript strict — Typage fort end-to-end

Tout le code est écrit en **TypeScript** avec des interfaces explicites pour chaque entité de l'API Graph (`GraphIncident`, `GraphSignIn`, `GraphManagedDevice`…). Les types union littéraux garantissent que seules les valeurs valides sont acceptées à la compilation.

### 7.2 Séparation des responsabilités (Single Responsibility Principle)

Le code est organisé en couches distinctes :
- **Services** : uniquement l'accès aux données (appels API)
- **Contextes** : uniquement l'état global partagé
- **Composants** : uniquement l'affichage
- **Hooks** : logique réutilisable sans affichage
- **Utilitaires** : fonctions pures sans état

### 7.3 Patron Provider (React Context API)

Trois contextes React hiérarchiques gèrent l'état global (`AuthContext`, `SOCContext`, `GlobalFilterContext`). Chaque contexte expose uniquement ce dont les composants ont besoin via des hooks custom, avec une erreur explicite si utilisé hors du Provider.

### 7.4 Protection des routes et contrôle d'accès (RBAC)

Le composant `ProtectedApp` constitue une **garde d'authentification centralisée** : aucune vue métier n'est accessible sans être authentifié ET appartenir à un groupe Azure AD autorisé.

### 7.5 Variables d'environnement — Secrets jamais versionnés

Toutes les valeurs sensibles (Client ID Azure, Tenant ID, URL webhook Teams) sont externalisées dans le fichier `.env` référencé dans `.gitignore`. Le fichier `.env` n'est **jamais commis sur GitHub**, il est uniquement présent sur la VM de production.

### 7.6 Proxy backend — Isolation du Client Secret

Le Client Secret n'est jamais exposé dans le code frontend. Il transite uniquement via des requêtes HTTPS vers le serveur proxy local, qui gère les tokens côté serveur.

### 7.7 Gestion de la pagination API

L'API Graph renvoie les résultats paginés via `@odata.nextLink`. Le code implémente des **boucles de pagination automatique** avec des limites de sécurité pour éviter les boucles infinies (max 10 000 enregistrements).

### 7.8 Optimisation des performances — `useMemo`

Les calculs coûteux (agrégations pour les graphiques, statistiques sur des milliers de logs) sont mémoïsés avec `useMemo` pour éviter des recalculs inutiles à chaque re-render React.

### 7.9 Rate limiting — Traitement par batches

Pour les scans Exchange (potentiellement des centaines de boîtes mail), les requêtes sont envoyées par **batches de 10 en parallèle** (`Promise.all`) pour respecter les quotas de l'API Graph.

### 7.10 Accessibilité — Composants Radix UI

Les composants UI sont basés sur **Radix UI** (via shadcn/ui), garantissant l'accessibilité ARIA nativement : navigation clavier, rôles ARIA, focus management, annonces pour lecteurs d'écran.

### 7.11 Raccourcis clavier — UX analytique

Un hook custom `useKeyboardShortcuts` implémente des raccourcis clavier globaux pensés pour une utilisation intensive par les analystes SOC (`Ctrl+D`, `Ctrl+I`, `Ctrl+C`, `Ctrl+R`…). Le hook ignore les raccourcis quand le focus est dans un champ de saisie.

### 7.12 Cache de tokens côté serveur

Le proxy Express implémente un cache mémoire pour les tokens OAuth2 afin d'éviter une requête vers `login.microsoftonline.com` à chaque appel API, améliorant les performances et réduisant les appels réseau.

### 7.13 CI/CD automatisé — Self-Hosted Runner

Le recours à un **self-hosted runner GitHub Actions** sur la VM de production permet d'automatiser entièrement le déploiement à chaque push sur la branche principale, tout en gardant les secrets de production hors de GitHub. Les mises à jour du SOC sont ainsi **sans interruption manuelle** et **traçables** via l'historique des workflows GitHub Actions.

### 7.14 Architecture SPA sans rechargement

L'utilisation de React Router DOM et d'un routage par état garantit une navigation fluide sans rechargement de page, préservant l'état des données chargées entre les vues.

---

## 8. Permissions Microsoft Graph API requises

| Permission | Type | Usage |
|---|---|---|
| `SecurityIncident.Read.All` | Application | Lire les incidents Defender |
| `SecurityEvents.Read.All` | Application | Lire les événements de sécurité |
| `AuditLog.Read.All` | Application | Lire les logs de connexion Entra ID |
| `Directory.Read.All` | Application | Lire les utilisateurs et groupes |
| `IdentityRiskyUser.Read.All` | Application | Lire les utilisateurs à risque |
| `DeviceManagementManagedDevices.Read.All` | Application | Lire les appareils Intune |
| `DeviceManagementManagedDevices.ReadWrite.All` | Application | Synchroniser les appareils |
| `User.Read.All` | Application | Lire les profils utilisateurs |
| `Mail.Read` | Application | Lire les règles de messagerie |
| `SecurityAlert.Read.All` | Application | Lire les alertes de sécurité |
| `Policy.Read.All` | Application | Lire les politiques |

---

## 10. Sécurité de l'application — Analyse complète

> Cette section détaille toutes les mesures de sécurité mises en place dans Guardian View, couvrant les failles web classiques (OWASP Top 10), la sécurité des tokens, la sécurité des communications et les bonnes pratiques DevSecOps.

---

### 10.1 Architecture de sécurité globale — Defense in Depth

L'application est conçue selon le principe **defense in depth** : plusieurs couches de sécurité indépendantes sont empilées. La compromission d'une couche ne compromet pas l'ensemble du système.

```
┌─────────────────────────────────────────────────────────────────┐
│                        NAVIGATEUR                               │
│  • Content Security Policy (CSP)  • X-Frame-Options: DENY       │
│  • sessionStorage (non localStorage)  • MSAL (tokens Microsoft) │
│  • Sanitisation entrées  • Referrer-Policy                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │  X-Requested-By: GuardianView (CSRF)
                           │  Content-Type: application/json
┌──────────────────────────▼──────────────────────────────────────┐
│                PROXY NODE.JS/EXPRESS                            │
│  • CORS whitelist  • Helmet.js (12 headers)                     │
│  • Rate limiting 100/15min (10/15min pour auth)                 │
│  • Validation CSRF header  • Validation GUID regex              │
│  • Protection SSRF  • AbortController timeouts                  │
│  • TEAMS_WEBHOOK_URL jamais exposée au client                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │  HTTPS TLS 1.2+  Bearer Token OAuth2
┌──────────────────────────▼──────────────────────────────────────┐
│          MICROSOFT GRAPH API / AZURE AD                         │
│  • OAuth 2.0 Client Credentials  • Permissions minimales        │
│  • Tokens à durée limitée (3600s)  • Audit log Microsoft 365    │
└─────────────────────────────────────────────────────────────────┘
```

---

### 10.2 Authentification et gestion des identités

#### 10.2.1 MSAL — Authorization Code Flow + PKCE

L'authentification des utilisateurs est gérée par **Microsoft Authentication Library (MSAL)** avec le flux **Authorization Code + PKCE** (Proof Key for Code Exchange) :

- **PKCE** : génère un `code_verifier` aléatoire et envoie un `code_challenge` (SHA-256 du verifier). Même en interceptant le code d'autorisation, un attaquant ne peut pas l'échanger sans le verifier.
- Les tokens sont gérés par MSAL en mémoire/sessionStorage Microsoft — non accessibles directement par l'application.
- Le **redirect URI** est verrouillé dans l'App Registration Azure AD.

#### 10.2.2 Client Credentials Flow (Service Account)

Le proxy utilise le flux **Client Credentials** (machine-to-machine sans utilisateur) :
- Le `client_secret` n'est **jamais** retourné dans les réponses du proxy.
- Le token OAuth2 est caché en mémoire côté serveur (cache Node.js).

#### 10.2.3 RBAC via groupes Azure AD

| Groupe AD | Rôle | Droits |
|---|---|---|
| `GR_ACCES_SOC` | `user` | Lecture des données SOC |
| `GR_ADMIN_ACCES_SOC` | `admin` | Lecture + configuration + actions |
| Aucun | `none` | Accès refusé (page blocage) |

La vérification se fait via `/me/memberOf` après chaque authentification. Sans appartenance aux groupes, l'application affiche une page d'accès refusé et aucune donnée n'est chargée.

---

### 10.3 Protection contre le Cross-Site Scripting (XSS)

Le **XSS** est une attaque où du code JavaScript malveillant est injecté dans la page pour voler des tokens, des données ou effectuer des actions au nom de la victime.

#### Content Security Policy (CSP)

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src  'self' 'unsafe-inline' 'unsafe-eval';
  style-src   'self' 'unsafe-inline';
  connect-src 'self' http://localhost:3001
              https://login.microsoftonline.com
              https://graph.microsoft.com;
  frame-src   'none';
  object-src  'none';
  base-uri    'self';
  form-action 'self';
" />
```

La CSP bloque : scripts depuis CDN non whitelistés, exfiltration de données vers des serveurs non autorisés, injection de frames, et redirection de formulaires.

#### Autres protections XSS

- **React** : échappe automatiquement toutes les valeurs interpolées `{variable}`. `dangerouslySetInnerHTML` n'est pas utilisé dans Guardian View.
- **Helmet.js** : `X-XSS-Protection: 1; mode=block` (protection legacy IE/Edge).
- **`X-Content-Type-Options: nosniff`** : empêche le navigateur de réinterpréter un fichier selon son contenu (MIME sniffing).
- **Sanitisation des entrées** (`config.ts`) : les champs `tenantId`, `clientId`, `clientSecret` sont nettoyés des caractères de contrôle (`\x00`–`\x1F`, `\x7F`) avant stockage.

#### sessionStorage vs localStorage

En cas de XSS réussi, `sessionStorage` limite considérablement l'exposition :

| Critère | `localStorage` (ancien) | `sessionStorage` (actuel) |
|---|---|---|
| Durée de persistance | Indéfinie | Fermée à la fermeture de l'onglet |
| Partage entre onglets | ✅ Oui | ❌ Non (isolation par onglet) |
| Accessible après redémarrage navigateur | ✅ Oui | ❌ Non |
| Risque en cas de XSS | Critique | Limité à la session courante |

---

### 10.4 Protection contre le Cross-Site Request Forgery (CSRF)

Le **CSRF** force le navigateur d'une victime à effectuer une requête vers l'application sans son consentement, en exploitant son authentification existante.

#### Header custom obligatoire — `X-Requested-By: GuardianView`

Tous les appels du frontend vers le proxy incluent ce header custom :
```typescript
headers: { 'Content-Type': 'application/json', 'X-Requested-By': 'GuardianView' }
```

Le proxy vérifie sa présence sur toutes les requêtes mutantes (POST/PATCH/DELETE) :
```javascript
if (req.headers['x-requested-by'] !== 'GuardianView') {
  return res.status(403).json({ error: 'Requête non autorisée (header CSRF manquant)' });
}
```

**Mécanisme** : Les requêtes CSRF (formulaires HTML, fetch cross-origin simple) ne peuvent pas définir de headers custom sans déclencher un **preflight CORS** que la politique CORS strict rejette.

#### Content-Type forcé à `application/json`

Les requêtes CSRF classiques utilisent `application/x-www-form-urlencoded`. En imposant `application/json`, le proxy retourne `415 Unsupported Media Type` à toute requête CSRF de formulaire.

#### CORS strict (triple protection)

CORS + header custom + Content-Type forment trois barrières indépendantes contre le CSRF.

---

### 10.5 Protection contre les injections

#### 10.5.1 Injection SQL et NoSQL

**Non applicable** : Guardian View n'utilise aucune base de données. Toutes les données proviennent exclusivement de l'API Microsoft Graph. Aucune construction de requête SQL ou NoSQL n'est présente dans le code.

#### 10.5.2 Injection de commandes (Command Injection)

Le proxy Node.js n'exécute aucune commande système (`exec`, `spawn`, `child_process`). Risque nul.

#### 10.5.3 Protection SSRF via l'endpoint Graph API

Sans validation, un attaquant pourrait envoyer un `endpoint` arbitraire dans le corps de la requête pour rediriger le proxy vers des ressources internes :
```json
{ "endpoint": "/../../../internal-service" }
```

**Protection implémentée** :
```javascript
function isValidGraphEndpoint(endpoint) {
  if (!endpoint.startsWith('/')) return false;     // Obligatoirement relatif
  if (endpoint.includes('://')) return false;      // Pas de protocole
  if (endpoint.includes('..')) return false;       // Pas de path traversal
  if (/\x00/.test(endpoint)) return false;        // Pas de null bytes
  if (endpoint.length > 1000) return false;        // Longueur max
  return true;
}
```

L'URL finale est toujours : `https://graph.microsoft.com/v1.0{endpoint}` — l'attaquant ne peut pas sortir de ce domaine.

Pour le webhook Teams, l'URL **n'est plus envoyée par le client** — seule la carte JSON est transmise, et le serveur utilise `process.env.TEAMS_WEBHOOK_URL` en interne, éliminant toute possibilité d'SSRF via ce vecteur.

#### 10.5.4 Injection de Null Bytes

Les null bytes (`\x00`) peuvent tronquer des chaînes dans certains parseurs bas niveau, permettant de bypasser des validations. Ils sont éliminés à deux niveaux :
- **Frontend** (`config.ts`) : `value.replace(/[\x00-\x1F\x7F]/g, '')`
- **Serveur** (`index.js`) : `value.replace(/\x00/g, '')` + vérification dans `isValidGraphEndpoint()`

#### 10.5.5 Injection via les méthodes HTTP

```javascript
const ALLOWED_HTTP_METHODS = ['GET', 'POST', 'PATCH', 'DELETE'];
if (!ALLOWED_HTTP_METHODS.includes(method)) {
  return res.status(400).json({ error: 'Méthode HTTP non autorisée' });
}
```

`HEAD`, `OPTIONS`, `CONNECT`, `TRACE` sont refusés, éliminant les techniques d'abus de proxy par méthode exotique.

### 10.6 Sécurité des tokens et des secrets

#### URL Webhook Teams — élimination de l'exposition frontend

Avant correction, la variable `VITE_TEAMS_WEBHOOK_URL` était bundlée dans le JavaScript livré au navigateur. **Tout visiteur pouvant ouvrir les DevTools pouvait lire l'URL complète du webhook**, permettant d'envoyer des messages dans le canal Teams de l'entreprise.

**Correction** : renommage en `TEAMS_WEBHOOK_URL` (sans préfixe `VITE_`), lu exclusivement par le serveur Node.js. Le frontend ne reçoit plus jamais cette valeur.

```
AVANT : VITE_TEAMS_WEBHOOK_URL → bundlé dans main.js → visible dans Sources DevTools
APRÈS : TEAMS_WEBHOOK_URL      → lu par process.env côté serveur → jamais transmis au client
```

#### Client Secret Azure AD

| Aspect | Implémentation |
|---|---|
| **Stockage frontend** | `sessionStorage` — effacé à fermeture onglet |
| **Transit réseau** | HTTPS TLS 1.2+ en production |
| **Stockage serveur** | Variable d'environnement `.env` non commitée |
| **Retour dans les réponses** | Jamais — le proxy ne renvoie pas le secret |
| **Versioning Git** | `.gitignore` inclut `.env` — zéro secret dans l'historique |

#### Tokens OAuth2

| Type | Stockage | Durée de vie |
|---|---|---|
| Access Token utilisateur | Mémoire MSAL (sessionStorage interne) | 1 heure |
| Refresh Token | Géré automatiquement par MSAL | 90 jours avec rotation |
| Access Token service (proxy) | Cache mémoire Node.js | 3600s − 60s de marge |

Le cache token serveur ne persiste que le temps de vie du processus Node.js. Un redémarrage du serveur le vide automatiquement.

---

### 10.7 Headers de sécurité HTTP (Helmet.js)

**Helmet.js** configure automatiquement les headers HTTP recommandés par l'OWASP et le navigateur. Chaque header cible une attaque spécifique :

| Header | Valeur configurée | Menace bloquée |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Downgrade HTTP → HTTPS (HSTS) |
| `X-Frame-Options` | `DENY` | Clickjacking via `<iframe>` |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing / Content-Type confusion |
| `X-XSS-Protection` | `1; mode=block` | XSS réfléchi (navigateurs legacy) |
| `Content-Security-Policy` | Whitelist stricte (§10.3) | Injection de scripts, exfiltration |
| `Cross-Origin-Opener-Policy` | `same-origin` | Cross-window attacks (Spectre) |
| `Cross-Origin-Resource-Policy` | `same-origin` | Cross-origin resource inclusion |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Accès aux APIs sensibles du navigateur |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Fuite d'URL dans les requêtes externes |
| `X-DNS-Prefetch-Control` | `off` | DNS prefetching non désiré |
| `X-Download-Options` | `noopen` | Exécution directe de téléchargements (IE) |
| `X-Powered-By` | *(supprimé)* | Fingerprinting du framework serveur |

---

### 10.8 Rate Limiting — Protection contre le Brute-Force et le DoS

Sans rate limiting, le proxy est vulnérable à :
- Le **brute-force des credentials** Azure AD (test automatisé de clientId/secret)
- L'**abus des quotas** Microsoft Graph (throttling API global)
- Le **DoS applicatif** par surcharge du processus Node.js (event loop bloqué)

#### Configuration mise en place

```javascript
// Limite générale — 100 requêtes / 15 min / IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,   // Headers RateLimit-* dans la réponse
});

// Limite stricte sur l'endpoint d'authentification — 10 tentatives / 15 min / IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

app.post('/api/test-connection', authLimiter, ...); // Double protection
```

Les headers `RateLimit-Remaining` et `RateLimit-Reset` sont inclus dans toutes les réponses — le client peut adapter son comportement et afficher un message d'attente.

---

### 10.9 Timeouts et protection contre les attaques de lenteur (Slowloris)

Les attaques **Slowloris** et de type **slow read** consistent à maintenir des connexions HTTP ouvertes le plus longtemps possible pour épuiser les ressources du serveur.

Sans timeout, le proxy peut être bloqué sur une requête qui ne répond jamais, rendant le service indisponible.

#### Timeouts configurés (AbortController natif Node.js 18+)

| Opération | Timeout | Message en cas de dépassement |
|---|---|---|
| Token OAuth2 (`login.microsoftonline.com`) | 15 s | `Timeout — serveur Microsoft Graph inaccessible` |
| Test de connexion Graph | 20 s | `Timeout — serveur Microsoft Graph inaccessible` |
| Requêtes Graph API | 30 s | `Timeout — requête Graph API trop longue` |
| Envoi webhook Teams | 15 s | `Timeout Teams webhook` |

```javascript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);
try {
  const response = await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timeout);  // Toujours nettoyé, même en cas d'erreur
}
```

---

### 10.10 Sécurité des communications

#### HTTPS et HSTS en production

Sur la VM Debian 13, l'accès à l'application est sécurisé par **TLS** (certificat auto-signé ou Let's Encrypt). Le header `Strict-Transport-Security` (HSTS) force le navigateur à utiliser HTTPS pour le domaine pendant **1 an** :

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Après la première visite en HTTPS, le navigateur refuse toute connexion HTTP et redirige automatiquement, même si l'utilisateur tape `http://` manuellement.

#### Referrer Policy

```
Referrer-Policy: strict-origin-when-cross-origin
```

Lors d'une navigation depuis le SOC vers un lien externe (ex: `incidentWebUrl` Microsoft Defender), seule l'origine (ex: `http://soc.entreprise.local`) est transmise dans le header `Referer` — jamais le chemin complet avec les paramètres.

---

### 10.11 Gestion des erreurs sécurisée — Pas de fuite d'informations

Une gestion des erreurs naïve peut révéler à un attaquant des informations critiques : stack traces, chemins de fichiers, versions de librairies, structure interne de l'API.

#### Mauvaise pratique (évitée)

```javascript
// ❌ Exposer la stack trace complète
res.status(500).json({ error: err.stack });
// → révèle : chemin /home/user/guardian-view/server/index.js:142:15
//            version Node.js, librairies, logique interne
```

#### Bonne pratique (implémentée)

```javascript
// ✅ Message générique au client
res.status(500).json({ error: error.message });

// ✅ Log complet uniquement côté serveur (invisible pour le client)
console.error('Graph API error:', error.name, error.message);
```

Pour les erreurs d'authentification, le message retourné est intentionnellement vague :
- ✅ `"Format Tenant ID ou Client ID invalide"` → ne révèle pas ce qui est incorrect
- ❌ ~~`"AADSTS70011: The provided value for 'scope' is not valid..."`~~ → révèle la configuration interne

Le header `X-Powered-By: Express` est supprimé par Helmet.js — un attaquant ne peut pas déterminer le framework serveur par fingerprinting passif.

---

### 10.12 Sécurité CI/CD et gestion des secrets de déploiement

#### Self-Hosted Runner et isolation des secrets

Le **self-hosted runner GitHub Actions** installé sur la VM Debian 13 résout un problème de sécurité important : les secrets de production (`.env`, certificats, clés SSH) restent sur la VM et ne transitent jamais par les serveurs GitHub.

**Flux sécurisé** :
```
Développeur → git push → GitHub (code uniquement, jamais les secrets)
                              ↓
                   GitHub Actions déclenche le workflow
                              ↓
                   Self-hosted Runner (sur VM Debian 13)
                   → git pull  (code uniquement)
                   → npm install && npm run build
                   → utilise les .env DÉJÀ PRÉSENTS sur la VM
                   → redémarre les services
```

#### Bonnes pratiques de sécurité CI/CD

- **`.env` dans `.gitignore`** : aucun secret n'est jamais versionné dans Git
- **GitHub Secrets** : si des variables doivent être transmises par GitHub Actions, elles passent par les secrets chiffrés GitHub (jamais en clair dans les workflows)
- **Principe du moindre privilège** : le runner est configuré avec un utilisateur système dédié, sans droits root
- **Audit trail** : chaque déploiement est tracé dans l'historique des workflows GitHub Actions avec date, commit hash et résultat

---

### 10.13 Tableau récapitulatif des mesures de sécurité

| Catégorie | Faille / Risque | Mesure implémentée | Fichier(s) |
|---|---|---|---|
| **XSS** | Injection de scripts | CSP stricte + React escape natif | `index.html` |
| **XSS** | MIME confusion | `X-Content-Type-Options: nosniff` | `server/index.js` (Helmet) |
| **XSS** | Persistance des secrets | `sessionStorage` à la place de `localStorage` | `config.ts` |
| **CSRF** | Requêtes cross-site | Header `X-Requested-By: GuardianView` | `server/index.js` + tous les services |
| **CSRF** | Formulaires malveillants | `Content-Type: application/json` obligatoire | `server/index.js` |
| **CSRF** | Origine non autorisée | CORS whitelist stricte | `server/index.js` |
| **Injection** | SQL / NoSQL | Pas de base de données (N/A) | — |
| **Injection** | Command Injection | Pas d'exec/spawn (N/A) | — |
| **Injection** | Null bytes | Sanitisation `\x00` | `config.ts`, `server/index.js` |
| **SSRF** | Redirect vers ressources internes | Validation endpoint + URL fixe `graph.microsoft.com` | `server/index.js` |
| **SSRF** | Webhook URL arbitraire | URL webhook côté serveur uniquement (`process.env`) | `server/index.js` |
| **Clickjacking** | Intégration dans `<iframe>` | `X-Frame-Options: DENY` + CSP `frame-src 'none'` | `index.html`, Helmet |
| **Token Theft** | Secret en bundle JS | `TEAMS_WEBHOOK_URL` sans préfixe `VITE_` | `.env` |
| **Token Theft** | Fuite via DevTools | sessionStorage (non partagé, effacé à fermeture) | `config.ts` |
| **Brute-Force** | Test de credentials en masse | Rate limiting 10 req/15min sur `/api/test-connection` | `server/index.js` |
| **DoS** | Surcharge serveur | Rate limiting 100 req/15min général | `server/index.js` |
| **DoS** | Requêtes lentes (Slowloris) | Timeouts AbortController 15–30s | `server/index.js` |
| **DoS** | Payload surdimensionné | Limite `express.json({ limit: '512kb' })` | `server/index.js` |
| **Fingerprinting** | Détection du framework | Suppression `X-Powered-By` (Helmet) | `server/index.js` |
| **Méthodes HTTP** | TRACE / CONNECT abuse | Whitelist `GET POST PATCH DELETE` uniquement | `server/index.js` |
| **Auth** | Accès sans appartenance AD | RBAC via groupes Azure AD + vérification `/me/memberOf` | `AuthContext.tsx` |
| **Auth** | Interception code OAuth | MSAL + PKCE (`code_verifier` / `code_challenge`) | `msalConfig.ts` |
| **Transport** | Downgrade HTTP | HSTS `max-age=31536000` | Helmet + config Nginx |
| **Fuite info** | Stack traces dans les erreurs | Messages génériques client, logs complets serveur | `server/index.js` |
| **Secrets Git** | Commit accidentel de `.env` | `.gitignore` + self-hosted runner (secrets hors GitHub) | `.gitignore` |

---

## 9. Résumé des points forts

- **Sécurité** : authentification SSO Azure AD, RBAC basé sur les groupes AD, secrets non exposés, tokens en sessionStorage, déploiement on-premise
- **Performance** : pagination automatique, mémoïsation, cache de tokens, traitement par batches
- **Maintenabilité** : TypeScript strict, séparation des couches, composants réutilisables, CI/CD automatisé
- **Expérience utilisateur** : interface réactive, raccourcis clavier, notifications temps réel Teams, feedback d'erreurs explicites
- **Couverture fonctionnelle** : 4 workloads Microsoft 365 dans une interface unique, détection d'anomalies comportementales intégrée
- **DevOps** : dépôt GitHub d'entreprise, self-hosted runner, déploiement automatique sur VM Debian 13
