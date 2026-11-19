# @depano/admin — Back-office DEPANO

Next.js 16 (App Router) + Tailwind 4 + shadcn/ui + TanStack Query. French UI, réservé aux rôles `admin` et `support`.

## Lancer

```bash
pnpm install
pnpm --filter @depano/schemas build      # le client API partagé (dist CJS)
pnpm --filter @depano/admin dev          # http://localhost:3001
```

Variables (voir `.env.example`) :

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | URL de l'API (sans `/v1`) |
| `API_URL` | — | Surcharge **runtime** côté serveur (prioritaire, utile en conteneur) |

Scripts : `dev`, `build`, `start` (port 3001), `typecheck`, `lint`.

Connexion en dev : `+33600000001` (admin) ou `+33600000002` (support), le code OTP renvoyé par l'API (`devCode`) est affiché sous le champ.

## Authentification

Les jetons ne sont jamais exposés au JavaScript du navigateur :

- `POST /api/auth/otp/request` relaie la demande d'OTP.
- `POST /api/auth/otp/verify` vérifie l'OTP, **refuse les comptes sans rôle admin/support** (et révoque la session créée), puis pose `depano_admin_at` (accès) et `depano_admin_rt` (refresh) en cookies `httpOnly`, `SameSite=Lax`, `Secure` en production.
- `/api/proxy/*` relaie vers `${API}/v1/*` avec `Authorization: Bearer`, fait la rotation du refresh token sur 401 et rejoue la requête. Liste blanche : `admin/*`, `me`, `files/*`, `domains`, `auth/sessions`.
- `POST /api/auth/logout` révoque le refresh token et efface les cookies.
- `src/proxy.ts` (ex-middleware) redirige vers `/login` sans cookie de session.

Côté client, `src/lib/api.ts` réutilise `createApiClient` de `@depano/schemas` avec un `fetch` qui réécrit `/v1/...` vers `/api/proxy/...`.

## Rôles

| Section | Admin | Support |
| --- | --- | --- |
| Tableau de bord, Artisans (validation KYC), Catalogue, Zones & commissions, Exports DAC7 | oui | non |
| Interventions (enquête), Litiges (arbitrage, remboursement), Utilisateurs | oui | oui |

Le menu est filtré et l'accès direct par URL est bloqué côté UI ; l'API reste seule garante des permissions.

## Pages

- `/login` : téléphone puis OTP 6 chiffres (collage / autocomplétion SMS).
- `/` : KPI du plan (section 11) avec cible MVP et indicateur atteint / sous l'objectif, totaux, graphiques quotidiens (interventions, GMV) + tableau, sélecteur de période. Les taux sont attendus en ratio 0–1.
- `/artisans`, `/artisans/[id]` : onglets par statut (« À valider » en premier), recherche ; fiche avec checklist KYC, entreprise, documents (aperçu image / lien PDF, valider / refuser avec motif), décisions valider / refuser / suspendre / réintégrer, prestations, zone et horaires, interventions récentes.
- `/interventions`, `/interventions/[id]` : filtres statut / type / référence ; vue d'enquête (timeline `booking_events` avec acteur, horodatage à la seconde et GPS, carte Leaflet/OSM, chat, photos, devis, paiements, dispatch par vague, litige).
- `/litiges` : tri par échéance, compte à rebours 72 h (retard en rouge), dialogue de résolution.
- `/catalogue`, `/zones`, `/utilisateurs`, `/exports`.

## Design

Tokens du plan (section 2) dans `src/app/globals.css` au format shadcn (clair et sombre) : primaire `#8A6A4A`, surface `#F1E4D3`, urgent `#C8102E`, succès `#1E7F4F`, alerte `#B26B00`, info `#1F5FBF`, couleurs métier. Police Inter. Le statut n'est jamais porté par la seule couleur (icône + libellé).

## Démo en ligne (sans API)

`NEXT_PUBLIC_DEMO=1` remplace l'API par les réponses enregistrées dans `src/lib/demo/fixtures.json`, rejouées dans le navigateur (pas de connexion, actions conservées jusqu'au rechargement).

```bash
pnpm demo:record   # API locale lancée avec le seed : enregistre les réponses du compte admin
pnpm demo:deploy   # build et déploiement Vercel (projet depano-admin-demo)
```
