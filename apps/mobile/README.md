# DEPANO mobile — playbook (`@depano/mobile`)

Une seule app, deux espaces (client / artisan). Expo SDK 58 · React Native 0.88 · Expo Router 58 (routes typées) · TypeScript strict.
Design system dans `packages/ui` (`@depano/ui`), contrat API dans `packages/schemas` (`@depano/schemas`), tous deux consommés **en source** par Metro (condition d'export `react-native`).

> Lire ce document en entier avant d'ajouter un écran. Les fondations (shell, données, auth, écrans communs) sont faites ; votre travail consiste à remplacer les `PlaceholderScreen` de votre espace.

---

## 1. Démarrer

```bash
pnpm install                       # à la racine (pnpm 11, installation isolée : supportée par Expo ≥ 54)
cp apps/mobile/.env.example apps/mobile/.env   # EXPO_PUBLIC_API_URL=http://localhost:3000
pnpm --filter @depano/mobile start # puis i (iOS), a (Android), w (web)
```

- **Expo Go** : tous les modules utilisés sont inclus dans Expo Go SDK 58 (push distant indisponible sur Android en Expo Go : l'app le tolère). Pour un vrai test push / Sign in with Apple : development build (`npx expo run:ios`).
- `localhost` est réécrit automatiquement : IP du serveur Metro sur appareil physique, `10.0.2.2` sur émulateur Android (`src/lib/env.ts`).
- Connexion en dev : l'écran Connexion propose les comptes de démo (client `+33600000010`, artisan `+33600000101`). L'API renvoie `devCode` hors production : le code est **rempli et validé automatiquement**.
- Les routes typées sont générées dans `.expo/types/router.d.ts` au premier `expo start` (lancer une fois avant `typecheck` pour un typage strict des `href`).

| Commande | Rôle |
| --- | --- |
| `pnpm --filter @depano/mobile typecheck` | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`) |
| `pnpm --filter @depano/mobile test` | Vitest : stores, liens profonds |
| `pnpm --filter @depano/ui typecheck` / `test` | Design system + test de contraste (222 paires) + logique de repli Liquid Glass |
| `pnpm --filter @depano/mobile export:ios` | Bundle iOS de production (preuve Metro + monorepo) |
| `npx expo export --platform ios\|android\|web` (dans `apps/mobile`) | Bundles des 3 plateformes (layouts `.web.tsx` compris) |
| `npx expo-doctor` (dans `apps/mobile`) | 20/20 attendu |

---

## 2. Arborescence

```
apps/mobile/
  app.json                 scheme « depano », bundle fr.depano.app, plugins, typedRoutes
  metro.config.js          config Expo par défaut (monorepo auto-détecté, ne rien ajouter)
  src/
    app/                   ROUTES UNIQUEMENT (Expo Router). Fichiers fins : ils importent features/*
      _layout.tsx          providers + Stack racine (modales auth, notifications, paramètres)
      +native-intent.tsx   réécrit depano://… vers l'espace actif
      index.tsx            aiguillage : onboarding → /accueil ou /pro/accueil
      onboarding.tsx       3 slides skippables (1er lancement)
      (auth)/              connexion → code → identite → role → autorisations (modale)
      autorisation/[kind]  explication avant popup système (askPermission)
      notifications.tsx    fil groupé par jour
      parametres/          compte, sécurité, notifications, légal, aide
      (client)/            ESPACE CLIENT (URL sans préfixe)
        (tabs)/            accueil, recherche, activite, messages, profil (pile par onglet)
        artisan/[id]       fiche artisan (hors onglets)
        urgence/…          parcours urgence (plein écran, sans tab bar)
        rdv/…              parcours rendez-vous (plein écran)
      pro/                 ESPACE ARTISAN (URL /pro/…, connexion obligatoire)
        (tabs)/            accueil, planning, interventions, messages, profil
        offre/[id]         demande d'urgence plein écran (fullScreenModal)
        onboarding/…       KYC
    components/            briques app (tab bar, cloche, QueryView, AuthGate, RoleSwitch, Placeholder…)
    features/<domaine>/    écrans et logique métier réutilisables (chat, notifications, profile, settings, auth)
    lib/                   api, query (client, keys, hooks, optimistic, mutations), realtime, push,
                           permissions, upload, session, deepLinks, env, online
    stores/                Zustand : auth (SecureStore), app, drafts, outbox (AsyncStorage)
```

**Pourquoi `pro/` et pas `(artisan)/`** : les groupes n'apparaissent pas dans l'URL ; `(client)/(tabs)/messages/[id]` et `(artisan)/(tabs)/messages/[id]` seraient la même URL `/messages/[id]`. Le segment réel `pro` lève l'ambiguïté (liens profonds, notifications).

**Convention** : un écran = `src/app/.../fichier.tsx` (5 à 15 lignes) qui rend un composant de `src/features/<domaine>/`. Requêtes propres au domaine dans `src/features/<domaine>/queries.ts`.

---

## 3. Carte des routes (inventaire section 5 ↔ fichiers)

Statut : ✅ implémenté (fondations) · 🧱 placeholder « À venir » à implémenter. Tous les chemins sont relatifs à `src/app/`.

### Communs (fait)

| Écran | Fichier | URL | Statut |
| --- | --- | --- | --- |
| Splash + onboarding | `onboarding.tsx` (splash natif : `expo-splash-screen`) | `/onboarding` | ✅ |
| Connexion / inscription | `(auth)/connexion.tsx`, `(auth)/code.tsx` | `/connexion`, `/code` | ✅ OTP 6 chiffres, Apple (iOS), Google (si configuré) |
| Prénom / nom | `(auth)/identite.tsx` | `/identite` | ✅ |
| Choix du rôle | `(auth)/role.tsx` | `/role` | ✅ |
| Autorisations | `(auth)/autorisations.tsx`, `autorisation/[kind].tsx` | `/autorisations`, `/autorisation/location` | ✅ |
| Messages (liste) | `(client)/(tabs)/messages/index.tsx`, `pro/(tabs)/messages/index.tsx` → `features/chat/ConversationsScreen` | `/messages`, `/pro/messages` | ✅ |
| Chat | `(client)/(tabs)/messages/[id].tsx`, `pro/(tabs)/messages/[id].tsx` → `features/chat/ChatScreen` | `/messages/{id}`, `/pro/messages/{id}` | ✅ texte, photo, vocal, optimistic, hors ligne |
| Notifications | `notifications.tsx` → `features/notifications/NotificationsScreen` | `/notifications` | ✅ |
| Paramètres | `parametres/index.tsx`, `compte`, `securite`, `notifications`, `legal`, `aide` | `/parametres/…` | ✅ |
| Profil (onglet) | `(client)/(tabs)/profil/index.tsx`, `pro/(tabs)/profil/index.tsx` → `features/profile/ProfileScreen` | `/profil`, `/pro/profil` | ✅ base (identité, raccourcis, changement de rôle) — à enrichir |

### Espace client — **agent client**

| Écran (section 5) | Fichier | URL |
| --- | --- | --- |
| Accueil | `(client)/(tabs)/accueil/index.tsx` | `/accueil` |
| Recherche / résultats | `(client)/(tabs)/recherche/index.tsx` | `/recherche` |
| Fiche artisan | `(client)/artisan/[id].tsx` | `/artisan/{id}` |
| Urgence 1 : domaine | `(client)/urgence/domaine.tsx` | `/urgence/domaine` |
| Urgence 2 : motif | `(client)/urgence/motif.tsx` | `/urgence/motif` |
| Urgence 3 : adresse | `(client)/urgence/adresse.tsx` | `/urgence/adresse` |
| Urgence 4 : prix et paiement | `(client)/urgence/paiement.tsx` | `/urgence/paiement` |
| Urgence 5 : recherche d'artisan | `(client)/urgence/[bookingId]/recherche.tsx` | `/urgence/{id}/recherche` |
| Urgence 6 : suivi en direct | `(client)/urgence/[bookingId]/suivi.tsx` | `/urgence/{id}/suivi` |
| RDV 1 : type | `(client)/rdv/type.tsx` | `/rdv/type?artisanId=` |
| RDV 2 : motif | `(client)/rdv/motif.tsx` | `/rdv/motif` |
| RDV 3 : créneau | `(client)/rdv/creneau.tsx` | `/rdv/creneau` |
| RDV 4 : récap et paiement | `(client)/rdv/recap.tsx` | `/rdv/recap` |
| Confirmation | `(client)/rdv/confirmation.tsx` | `/rdv/confirmation` |
| Activité | `(client)/(tabs)/activite/index.tsx` | `/activite` |
| Détail intervention | `(client)/(tabs)/activite/[id]/index.tsx` | `/activite/{id}` (cible de `depano://intervention/{id}`) |
| Validation de devis | `(client)/(tabs)/activite/[id]/devis.tsx` | `/activite/{id}/devis` |
| Fin d'intervention | `(client)/(tabs)/activite/[id]/fin.tsx` | `/activite/{id}/fin` |
| Notation | `(client)/(tabs)/activite/[id]/notation.tsx` | `/activite/{id}/notation` |
| Adresses / Paiement / Factures / Favoris / Parrainage / Aide | `(client)/(tabs)/profil/{adresses,paiement,factures,favoris,parrainage,aide}.tsx` | `/profil/…` |
| Compte | ✅ commun : `parametres/compte.tsx` | `/parametres/compte` |

**Espace client : implémenté** (`src/features/client/`). Repères :
- `queries.ts` (catalogue, carnet d'adresses, favoris optimistes, cartes, factures, autocomplétion `useAddressSearch`), `drafts.ts` (brouillons étendus : médias locaux téléversés au paiement, `prefillUrgentDraft` / `prefillScheduledDraft` pour relancer).
- `payment/` : `usePaymentSheet` (fake = validation simulée ; Stripe PaymentSheet en natif, chargé à la demande, clé `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`) et `useCheckout` (création → feuille de paiement → `confirmPayment`, réservation réutilisée au nouvel essai).
- `map/LiveMap` (`react-native-maps` en natif, schéma de distance sur web), `calendar/addToCalendar` (formulaire système `expo-calendar` en natif, fichier `.ics` sur web).
- `navigation.ts#useLeaveFlow` : quitter un parcours (urgence, RDV) vers les onglets sans créer un second navigateur d'onglets (ne pas utiliser `router.replace('/activite/…')` depuis une pile de parcours).
- Sur web, `Linking.openURL('tel:…')` fige les gestes : l'appel relais affiche le numéro (`ArtisanContact`).

### Espace artisan — **agent artisan**

| Écran (section 5) | Fichier | URL |
| --- | --- | --- |
| Onboarding pro (KYC) | `pro/onboarding/{index,siret,metiers,zone,documents,iban,verification}.tsx` | `/pro/onboarding/…` |
| Accueil | `pro/(tabs)/accueil/index.tsx` | `/pro/accueil` |
| Demande d'urgence | `pro/offre/[id].tsx` (ouverte auto sur `offer.created`) | `/pro/offre/{id}` (cible de `depano://offre/{id}`) |
| Planning (+ indispo) | `pro/(tabs)/planning/index.tsx`, `planning/indisponibilite.tsx` | `/pro/planning` |
| Interventions | `pro/(tabs)/interventions/index.tsx` | `/pro/interventions` |
| Détail intervention | `pro/(tabs)/interventions/[id]/index.tsx` | `/pro/interventions/{id}` |
| Devis sur place | `pro/(tabs)/interventions/[id]/devis.tsx` | `/pro/interventions/{id}/devis` |
| Compte rendu | `pro/(tabs)/interventions/[id]/compte-rendu.tsx` | `/pro/interventions/{id}/compte-rendu` |
| Saisie du code de fin | `pro/(tabs)/interventions/[id]/code.tsx` | `/pro/interventions/{id}/code` |
| Profil public | `pro/(tabs)/profil/apercu.tsx` | `/pro/profil/apercu` |
| Disponibilités / Tarifs / Revenus / Statistiques / Activité / Aide | `pro/(tabs)/profil/{disponibilites,tarifs,revenus,statistiques,activite,aide}.tsx` | `/pro/profil/…` |

**Espace artisan : implémenté** (`src/features/artisan/`). Repères :
- `queries.ts` (hooks `qk.artisan.*`), `mutations.ts` (clés `artisanMk.transition` / `artisanMk.report`, enregistrées dans `registerMutationDefaults` : statut et compte rendu rejouables hors ligne, photos téléversées au rejeu si besoin).
- `tracking.ts` : `EnRouteTracker` (monté dans `pro/_layout.tsx`) partage la position toutes les 10 s tant qu'une intervention est `en_route` (Socket.IO `location.update`, repli REST).
- `format.ts` : helpers purs testés (`format.test.ts`) ; `components/` : anneau 60 s, photos, note vocale (expo-audio, masquée sur web), carte de zone (`react-native-maps`, schéma SVG sur web), horaires types, prestations/tarifs, justificatifs (expo-document-picker).
- Export comptable : `shareCsv` (expo-file-system + expo-sharing ; téléchargement direct sur web).

Ajouter un écran : créer le fichier, puis (si besoin d'un titre fixe) l'option `<Stack.Screen options={{ title }} />` dans l'écran lui-même. Les piles d'onglets sont dans `.../(tabs)/<onglet>/_layout.tsx` (`TabStack`), les parcours plein écran utilisent `FlowStack`.

---

## 4. Navigation et shell

- **Tab bar** : système sur iOS/Android, JS sur web (voir §10). `(tabs)/_layout.tsx` → `components/SpaceNativeTabs.tsx` (`NativeTabs` d'`expo-router/native-tabs` : SF Symbols / Material Symbols, Liquid Glass automatique sur iOS 26) ; `(tabs)/_layout.web.tsx` → `components/AppTabBar.tsx`. 5 onglets, libellés toujours visibles, badges `me.badges` (Activité/Interventions = `activity`, Messages = `messages`) avec libellé accessible « N non lus ». Masquée sur le chat (`lib/tabBar.ts#isTabBarHiddenOn`) ; ajoutez-y vos écrans plein clavier. Nouvel onglet : l'ajouter dans **les deux** fichiers de layout.
- **Cloche** dans l'en-tête de chaque racine d'onglet (`HeaderBell`, badge `notifications`).
- **Intervention épinglée** (`usePinnedIntervention`) au-dessus de la tab bar dans tous les onglets : `useActiveBooking(as)` + `useBookingLive` (statut et ETA en direct). Affichage selon la plateforme : §10. Destination : `interventionHref(booking, as)` — urgence `searching` → recherche, `accepted/en_route` → suivi, sinon détail.
- **Changement de rôle** : `const switchRole = useSwitchRole(); switchRole('artisan')` → voile plein écran à la couleur de l'espace cible (`AccentTransition`), `me.setActiveRole`, `router.replace`. Sans profil artisan → `/pro/onboarding`.
- **Accent** : le thème suit `useAppStore().activeRole` (client = brun sable `#8A6A4A`, artisan = ardoise `#3B4A5A`). Pour un aperçu « vu client » dans l'espace artisan : `<AccentScope accent="client">`.
- **Liens profonds** : `DEEP_LINKS` (schemas) → `lib/deepLinks.ts#resolveDeepLink(link, role)` (utilisé par `+native-intent` et le tap sur notification). Ajoutez-y tout nouveau type de lien (+ test dans `deepLinks.test.ts`).
- **Hors ligne** : bannière en bas de l'écran (`AppProviders#OfflineLayout`), la navigation remonte d'autant, rien n'est masqué. Elle affiche le nombre d'actions en file.

---

## 5. Données

### Client API

```ts
import { api, errorMessage } from '@/lib/api';
const booking = await api.bookings.get(id);      // typé par @depano/schemas
```
- Jeton lu dans `useAuthStore` ; sur **401**, `refreshTokens()` (single-flight : 1 seul `/auth/refresh` même pour 10 requêtes) puis rejoue la requête. Refresh refusé → session vidée.
- `errorMessage(e)` donne toujours un message humain en français ; `isNetworkError(e)` pour l'état hors ligne.

### Requêtes (TanStack Query v5)

- Clés : **toujours** `qk` (`lib/query/keys.ts`). Invalidation par préfixe : `qk.bookings.all`, `qk.bookings.lists`, `qk.artisan.all`…
- Hooks partagés (`lib/query/hooks.ts`) : `useMe`, `useBadges`, `useDomains`, `useBookings(q)`, `useBooking(id)`, `useActiveBooking(as)`, `useConversations`, `useMessages(id)`, `useNotificationsFeed`, `useSessions`. Les requêtes nécessitant un compte sont `enabled: signedIn`.
- Cache **persisté** (AsyncStorage, 24 h) : lecture hors ligne automatique. Exclure une requête sensible : `meta: { persist: false }`.
- États d'écran : utilisez `QueryView` :

```tsx
<QueryView
  query={q}
  loading={<SkeletonList />}
  isEmpty={(d) => d.items.length === 0}
  empty={{ icon: ClipboardList, title: 'Aucune intervention', message: '…', action: { label: 'Demander une urgence', onPress } }}
>
  {(data) => <FlatList data={data.items} … />}
</QueryView>
```
Il gère chargement (skeleton), erreur (message + « Réessayer »), hors ligne sans cache, vide.

### Mutations, optimistic UI, file hors ligne

- Hors ligne, les mutations sont **mises en pause** (`networkMode: 'online'`) puis rejouées au retour du réseau ; la bannière affiche « N actions en attente ».
- **Helper optimistic** (`lib/query/optimistic.ts`) — exemple de référence dans `app/parametres/securite.tsx` :

```ts
const revoke = useMutation({
  mutationFn: (id: string) => api.auth.revokeSession(id),
  ...optimistic<SessionDto[], string>(qc, {
    queryKey: () => qk.sessions,
    update: (old, id) => old?.filter((s) => s.id !== id),
    invalidate: () => [qk.badges],          // optionnel
    onError: (e) => toast.error(errorMessage(e)),
  }),
});
```
  Mise à jour immédiate du cache → rollback si le serveur refuse → refetch de resynchronisation.
- **Mutation rejouable après redémarrage** (ex. envoi de message) : déclarer sa logique dans `registerMutationDefaults` (`lib/query/mutations.ts`) avec une clé `mk.*`, puis `useMutation({ mutationKey: mk.xxx })`. Les callbacks d'un composant démonté n'existent plus après un kill : seuls les defaults survivent. Utilisez-le pour les actions qu'un artisan déclenche sans réseau (changement de statut, compte rendu).
- Statuts d'intervention : l'app **demande** une transition (`api.bookings.transition(id, { to, lat, lng })`) ; afficher les boutons depuis `booking.allowedTransitions` (fourni par l'API), pas en recalculant la machine.

### Stores Zustand (`src/stores`)

| Store | Persistance | Contenu |
| --- | --- | --- |
| `useAuthStore` | expo-secure-store | `accessToken`, `refreshToken`, `userId` ; `returnTo` / `authReason` (non persistés) |
| `useAppStore` | AsyncStorage | `onboardingSeen`, `activeRole`, `scheme`, préférences notifications, jeton push |
| `useDraftsStore` / `useDraft` | AsyncStorage | brouillons des formulaires multi-étapes |
| `useOutboxStore` | AsyncStorage | messages de chat en attente / échoués |

**Brouillons** (une question par écran, retour sans perte) :
```ts
const [draft, patch, reset] = useDraft<UrgentDraft>(DRAFT_KEYS.urgent);
patch({ domain: 'plomberie' });          // à chaque saisie
reset();                                  // après création de la réservation
// RDV : useDraft<ScheduledDraft>(DRAFT_KEYS.scheduled(artisanId))
```

### Temps réel (Socket.IO, contrat `realtime.ts`)

- `RealtimeProvider` ouvre la socket à la connexion (jeton relu à chaque reconnexion, refresh si refusé) et la ferme à la déconnexion.
- Événements → cache (`lib/realtime/handlers.ts`) : `booking.updated` (patch statut + invalidations listes/badges/dashboard), `booking.location` (position + ETA dans le détail), `booking.dispatch`, `message.created` (insertion dans le fil + retrait de l'outbox), `notification.created` (préfixe du fil + badges), `offer.created` (invalidation + **ouverture plein écran** `/pro/offre/{id}` si espace artisan), `offer.revoked`.
- Hooks : `useRealtime()` → `{ socket, connected }` ; `useRealtimeEvent('typing', handler)` ; `useBookingLive(bookingId)` → détail + `booking.subscribe` à la room, repli en polling 15 s si déconnecté. Pour l'artisan en route : `socket.emit('location.update', …)` ou `api.bookings.updateLocation`.

### Auth gate (visiteur → compte au bon moment)

```ts
const requireAuth = useRequireAuth();
const onPay = () => {
  if (!requireAuth('Créez votre compte pour payer — cela prend 30 secondes.')) return;
  pay();
};
```
Ouvre la modale de connexion, puis `finishAuthFlow()` ramène **exactement** à l'écran d'origine (brouillon intact). Écran entièrement réservé : `<AuthGate title message>{…}</AuthGate>`.

### Permissions, push, fichiers

- `await askPermission('location', 'Pour trouver les artisans proches')` : écran d'explication → popup système → `true/false`. Jamais au lancement.
- `getUserPosition({ ask: true, reason })` → `{ lat, lng, approximate }` ; refus = centre de Marseille + `approximate: true` (mode dégradé : proposer la saisie d'adresse).
- Notifications : demander après la 1re réservation (`askPermission('notifications', 'Pour suivre l'arrivée de l'artisan')`) ; le jeton Expo est enregistré via `me.registerPushToken`. Le tap ouvre `data.link`.
- Fichiers : `const file = await pickImage('camera' | 'library')` puis `await uploadFile(file, 'problem_photo')` → `{ fileId, url }` (URL pré-signée + PUT + `files.complete`). Passez `fileId` aux endpoints (`problemFileIds`, `beforeFileIds`…).

---

## 6. Design system (`@depano/ui`)

Tout passe par `useTheme()` : `t.colors.*` (sémantique, clair/sombre, accent), `t.spacing` (4/8/12/16/24/32/48), `t.radius` (8 champs, 12 cartes, 20 sheets, `full` chips), `t.text(variant)`, `t.elevation(0|1|3)`. **Aucune couleur en dur dans les écrans.** Rouge `tone.urgent` : bouton et parcours urgence uniquement ; actions destructives = `tone.danger`.

| Composant | Usage |
| --- | --- |
| `Text` | `variant` display/title1/title2/body/bodyStrong/callout/label/caption/overline ; `tone` primary/secondary/brand/success/danger… Titres annoncés « en-tête ». |
| `Button` | `variant` primary/secondary/ghost/danger/urgent, `size` sm/md/lg, `loading`, `icon`, `haptic="success"` |
| `IconButton` | 48×48, `accessibilityLabel` obligatoire, `badge` |
| `Card` | surface (élévation 1), brand (beige), outline, flat ; `onPress` |
| `ListItem` | ligne 48 px+ : icône/avatar, titre, sous-titre, valeur, badge, chevron, `destructive` |
| `Avatar`, `Badge`, `Divider`, `SectionHeader` | — |
| `TextField` | label toujours visible, `helper`, `error` (icône + texte), `left/right` |
| `OtpInput` | `length={6}` (SMS, autofill) ou `{4}` (code de fin), `onComplete` |
| `Switch` | ligne entière cliquable, rôle « switch » |
| `Chip`, `DomainChip`, `StatusChip` | filtres (coche quand sélectionné), métier, statut (couleur + icône + libellé, `perspective="artisan"`) |
| `SegmentedControl` | « En cours / Passées » |
| `ArtisanCard`, `InterventionCard` | cartes DTO prêtes (`ArtisanCardDto`, `BookingSummaryDto`) |
| `SlotPicker` | `days: SlotDay[]` ; passés/pris **masqués** ; état vide intégré |
| `ProgressHeader` (`Stepper`) | « Étape 2 sur 4 » + question de l'écran |
| `Timeline` | statuts datés d'une intervention |
| `PriceRow`, `PriceSummary` | toujours un **Total TTC** ; `showRange`, `note` |
| `StarRating` | affichage (`value`, `count`) ou saisie (`onChange`, cibles 56 px) |
| `BottomSheet`, `ConfirmSheet` | choix courts (motif, créneau, paiement, annulation) ; geste, voile, bouton Fermer |
| `EmptyState`, `ErrorState`, `Skeleton*` | états systématiques |
| `ToastProvider` / `useToast()` | `toast.success('…')`, `toast.error(errorMessage(e))`, action optionnelle |
| `OfflineBanner` | déjà monté globalement |
| `Screen` | safe area + clavier + scroll + `footer` collant (`inTabs` dans un onglet : obligatoire, gère l'inset de la tab bar native iOS ; `footerGlass={false}` pour un footer opaque) |
| `StickyFooter` | CTA dans la zone du pouce |
| `PinnedInterventionBar` | déjà monté (tab bar web, accessoire iOS 26, bas des piles d'onglets) ; `surface` solid/glass/none, `compact` |
| `Glass`, `GlassGroup`, `useLiquidGlass()` | Liquid Glass iOS 26 avec repli opaque (voir §10) |
| `AccentTransition`, `AccentScope` | transition de rôle / aperçu d'accent |
| `haptic(kind)`, `useReduceMotion`, `timing()` | retour haptique, réduction des animations, durées 200–300 ms |
| `formatEuros` (schemas), `formatDateTime`, `relativeDayLabel`, `formatDistance`… | formatages FR (Europe/Paris) |

Accessibilité intégrée : cibles ≥ 48 px, `accessibilityRole/Label/State` partout, Dynamic Type jusqu'à 200 % (`maxFontSizeMultiplier=2`, ne jamais fixer de hauteur de texte), Reduce Motion (`ReduceMotion.System`), contraste vérifié par `packages/ui/src/tokens/contrast.test.ts` — **ajoutez-y toute nouvelle paire texte/fond**. Icônes : `lucide-react-native` via `<Icon icon={Wrench} />` (décoratives, masquées aux lecteurs d'écran).

---

## 7. Règles UX (plan, section 2) — à appliquer à chaque écran

1. **Zone du pouce** : CTA principal en bas (`<Screen footer={<Button size="lg" fullWidth …/>}>`), jamais en haut. Cibles 48×48 min.
2. **Bottom sheets** pour les choix courts : motif, créneau, moyen de paiement, annulation, filtres.
3. **Une question par écran** avec `ProgressHeader step={2} total={4} title="Quel est le problème ?"`, retour sans perte (`useDraft`).
4. **États systématiques** : skeleton (pas de spinner plein écran), vide (icône + CTA), erreur (message humain + Réessayer), hors ligne (cache + actions en file).
5. **Optimistic UI** sur messages et statuts, rollback si refus.
6. **Temps réel visible** : `useBookingLive`, ETA, statut daté (`Timeline`).
7. **Haptique** sur les validations clés : paiement, code de fin, urgence envoyée (`haptic="success"`).
8. **Prix avant engagement** : aucun écran de validation sans `PriceSummary` (total TTC).
9. **Jamais la couleur seule** : statut = couleur + icône + libellé ; erreur = icône + texte.
10. **Artisan d'une main** : actions principales en bas, gros boutons, saisie vocale du compte rendu.

Microcopy (ton rassurant, vouvoiement, phrases courtes) :
- « Vous ne payez qu'à la fin, quand vous donnez le code. »
- « Annulation gratuite jusqu'à 2 h avant. »
- « Votre carte n'est débitée qu'à la fin. Rien n'est prélevé maintenant. »
- « 3 artisans contactés… Le premier qui accepte arrive. »
- « Karim arrive dans 12 min. »
- « Ce n'est pas de votre faute. Réessayez dans un instant. »
- « Vous êtes hors ligne. Votre message partira au retour du réseau. »
- Boutons à l'infinitif ou impératif clair : « Recevoir le code », « Valider le devis », « Y aller ».

---

## 8. Conventions

- Textes visibles **en français**, identifiants **en anglais**, commentaires rares et en français.
- Montants en **centimes** partout ; affichage `formatEuros(cents)`. Dates ISO ; affichage via les helpers `@depano/ui` (Europe/Paris).
- Valider les formulaires avec les schémas Zod de `@depano/schemas` (`zodResolver`) quand ils existent ; ne pas dupliquer les règles (`RULES`).
- Ne pas importer `@depano/schemas` côté UI pour autre chose que types/libellés/règles.
- Ne pas modifier `packages/schemas` : signaler un manque de contrat.
- Les `testID` (`tab-*`, `request-otp`, `otp-input`, `switch-role`…) servent aux tests E2E (Maestro / Playwright web).
- Avant de rendre la main : `typecheck`, `test`, `export:ios`.

## 9. Points ouverts côté contrat (à arbitrer avec l'API)

- Pas d'endpoint de préférences de notifications (stockées localement dans `useAppStore`).
- Sémantique de `me.setActiveRole('artisan')` sans profil artisan (création d'un brouillon ?) et d'un endpoint « devenir artisan ».
- `MessageDto` sans durée pour les vocaux ; ordre des pages de messages non spécifié (l'app trie par `createdAt`).
- Pas de désenregistrement du jeton push à la déconnexion.
- Format de l'erreur d'authentification Socket.IO (l'app détecte `unauthorized|jwt|token|401`).
- Passkeys : endpoints présents, UI désactivée (`features.passkeys`), module natif à choisir.

## 10. Liquid Glass (iOS 26) et tab bar native

### Où
| Élément | Fichier | iOS 26 | iOS ≤ 18 · Android | Web |
| --- | --- | --- | --- | --- |
| Tab bar (2 espaces) | `app/(client)/(tabs)/_layout.tsx`, `app/pro/(tabs)/_layout.tsx` → `components/SpaceNativeTabs.tsx` | `NativeTabs` système : Liquid Glass, `minimizeBehavior="onScrollDown"`, teinte = accent (`DynamicColorIOS`) | UITabBar opaque · Material 3 (couleurs du thème) | `_layout.web.tsx` : `AppTabBar` JS inchangée |
| Intervention épinglée | `SpaceNativeTabs` (accessoire), `components/TabStack.tsx` (bas de pile) | `NativeTabs.BottomAccessory` (verre système, version « inline » compacte quand la barre se réduit) | Capsule en bas de chaque pile d'onglet, juste au-dessus de la tab bar | dans `AppTabBar` |
| CTA du pouce | `StickyFooter` / `Screen footer` | « dock » de verre teinté | barre opaque + filet | barre opaque |
| Cartes | `LiveMap.native.tsx` (recherche, suivi urgence 6), `ZoneMap.tsx` (artisan) | bouton « Recentrer », capsule ETA (`overlayLabel`), capsule rayon | mêmes contrôles, surface opaque | schéma web inchangé |
| Demande d'urgence (artisan) | `OfferScreen` | zone compte à rebours en verre | carte opaque | carte opaque |

Non concernés, volontairement : **boutons rouges d'urgence** (toujours pleins), `BottomSheet` (choix et textes longs : surface pleine), contenu des écrans.

### Primitive `Glass` (`@depano/ui`)
- `<Glass legible radius interactive variant fallback elevation>` rend `GlassView` (expo-glass-effect) **seulement si** `Platform.OS === 'ios'`, `isLiquidGlassAvailable()`, `isGlassEffectAPIAvailable()` et « Réduire la transparence » désactivé (`AccessibilityInfo` + écouteur `reduceTransparencyChanged`, un seul pour toute l'app). Sinon : surface opaque du thème + élévation + filet. Tant que le réglage n'est pas lu : opaque.
- `useLiquidGlass()` → `{ enabled, available, reduceTransparency }` ; `GlassGroup` = `GlassContainer` (fusion des verres proches) ou `View`.
- Import sûr sur web et Android (le module renvoie `false` / une `View`). Logique pure testée : `packages/ui/src/glass/support.test.ts`.
- `colorScheme` du verre = thème de l'app ; l'app aligne aussi le style natif iOS (`Appearance.setColorScheme`, `AppProviders`) pour que tab bar, accessoire et `PlatformColor` suivent le thème choisi.

### Règles (accessibilité)
- Sur le verre : **libellés courts et icônes uniquement**, avec `legible` (vitre teintée par la surface). Texte important (prix, mentions, statut détaillé) sur surface pleine. L'accessoire natif utilise `PlatformColor('label' | 'secondaryLabel')` : lisible quel que soit le contenu dessous.
- Jamais la couleur seule : statut = icône + libellé ; badges annoncés « N non lus ».
- Ne jamais animer l'opacité d'un `Glass` ou de ses parents (recommandation Apple) : glissement seul, `ReduceMotion.System`.
- Reduce Transparency → surfaces opaques automatiquement ; Reduce Motion respecté (carte recentrée sans animation).

### Décisions
- **Pas de `role="search"`** sur Recherche : ce rôle remplace l'icône et le libellé par l'élément système (libellé localisé par iOS, potentiellement « Search »), déplace l'onglet à droite et attend une barre de recherche native ; l'écran a déjà son champ, ses filtres et la bascule liste/carte.
- **Intervention épinglée** : la hauteur de la tab bar native n'est pas mesurable. iOS 26 → accessoire natif (`NativeTabs.BottomAccessory`, disponible dans Expo Router 58). Ailleurs → pas de position absolue ni de constante magique : la barre occupe le bas de la pile de l'onglet (Android : le contenu finit déjà au-dessus de la tab bar ; iOS : le `SafeAreaProvider` propre à chaque onglet donne la hauteur de la tab bar dans `insets.bottom`). L'arbre reste stable : la pile n'est jamais remontée.
- **Insets** : sur iOS la tab bar native flotte au-dessus du contenu. `Screen inTabs` met `contentInsetAdjustmentBehavior="automatic"`, `StickyFooter aboveTabBar` applique `insets.bottom` (iOS uniquement), les `FlatList` d'onglets (Messages, Activité, Recherche) aussi. `FlatList` ne réduit pas la tab bar au défilement (limite documentée) ; `disableTransparentOnScrollEdge` évite une barre transparente sur iOS ≤ 18.
- `ThemeProvider` d'Expo Router aux couleurs du thème autour des tabs : pas de flash blanc au changement d'onglet sur iOS 26.
- `app.json` ne contient pas `UIDesignRequiresCompatibility` (ne jamais l'ajouter à `true` : cela désactive Liquid Glass).

### Voir le rendu (iPhone sous iOS 26)
Expo Go n'affiche pas l'accessoire ni le build Xcode 26 du projet : il faut un **development build** (`eas.json`, profil `development`, image `sdk-58` = macOS Tahoe + Xcode 27.1, ≥ Xcode 26 requis). `extra.eas.projectId` est vide : la première commande `build` propose de lier le projet (`eas init`).

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform ios   # enregistre l'iPhone (ad hoc) puis installe via QR code
npx expo start --dev-client
```
À vérifier sur l'appareil : verre de la tab bar et réduction au défilement, accessoire (régulier / inline), contraste sur fond clair et sombre, Réglages › Accessibilité › Affichage › Réduire la transparence (tout devient opaque), Taille du texte maximale.
