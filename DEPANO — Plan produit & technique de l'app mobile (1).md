# DEPANO — Plan produit & technique de l'app mobile

Oct 19, 2026 · @Tahirou

## 1. Vision et principes produit

DEPANO est une marketplace mobile qui met un particulier en relation avec un artisan vérifié (plomberie, électricité, énergétique) en moins de 60 secondes, pour une urgence ou un rendez-vous planifié. Lancement recommandé : Marseille, 3 métiers, puis extension ville par ville.

La promesse tient en trois mots : **rapide, transparent, garanti**. Prix affiché avant engagement, artisan vérifié (SIRET + assurance), paiement bloqué jusqu'au code de fin d'intervention.

**Recommandation structurante : une seule app, deux espaces.** Un compte unique peut être client et artisan (le Figma prévoit déjà « Devenez artisan »). Le rôle actif se change depuis le profil, comme Airbnb hôte/voyageur. Cela divise par deux le coût de build et de publication store, tout en gardant deux tab bars distinctes.

| Persona | Contexte | Besoin n°1 | Frustration actuelle |
| --- | --- | --- | --- |
| Client en urgence (fuite, panne courant) | Stressé, une main occupée, souvent dehors ou dans le noir | Quelqu'un chez moi vite, à un prix connu | Arnaques au dépannage, prix opaques |
| Client planificateur (entretien chaudière) | Calme, compare | Créneau qui l'arrange, artisan bien noté | Devoir appeler 5 artisans |
| Artisan indépendant | Sur chantier, mains sales, 5 à 8 interventions/jour | Remplir son agenda sans prospecter, être payé sans relance | Impayés, déplacements inutiles, paperasse |
| Admin / support DEPANO | Back-office web | Valider les artisans, arbitrer les litiges | — |

**Principes produit**

- Urgence d'abord : le bouton urgence est atteignable en 1 tap depuis l'accueil, sans compte obligatoire avant l'étape de paiement.
- Prix avant engagement : aucun écran de validation sans total TTC visible.
- Confiance mesurable : chaque statut (artisan en route, arrivé, terminé) est daté et visible des deux côtés.
- L'artisan travaille d'une main : actions principales en bas d'écran, gros boutons, saisie vocale du compte rendu.

## 2. UI/UX mobile 2026 et design system

Le Figma pose une bonne base (palette beige chaleureuse, cartes arrondies, tab bar 5 onglets). Il faut maintenant la systématiser en tokens et corriger quelques choix qui ne passeraient pas un audit d'accessibilité.

**Bonnes pratiques à appliquer partout**

- **Zone du pouce** : CTA principal en bas d'écran (bouton collant au-dessus de la tab bar ou bottom sheet), jamais en haut. Cibles tactiles de 48×48 px minimum.
- **Bottom sheets plutôt que pages** pour les choix courts : motif, créneau, moyen de paiement, annulation. L'utilisateur garde le contexte.
- **Formulaires en étapes** avec barre de progression (« Étape 2 sur 4 »), une question par écran, retour sans perte de saisie, brouillon sauvegardé automatiquement.
- **États systématiques** pour chaque écran : chargement (skeletons, pas de spinner plein écran), vide (illustration + CTA), erreur (message humain + réessayer), hors ligne (bannière, actions mises en file).
- **Optimistic UI** : un message envoyé ou un statut changé s'affiche tout de suite, avec rollback si le serveur refuse.
- **Temps réel visible** : suivi de l'artisan sur carte avec ETA, Live Activity iOS et notification persistante Android pendant une urgence.
- **Retour haptique** sur les validations clés (paiement, code de fin, urgence envoyée).
- **Accessibilité WCAG 2.2 AA**, exigée pour les services de commerce électronique par l'European Accessibility Act depuis juin 2025 (les micro-entreprises en sont exemptées, mais autant être conforme dès le départ) : contraste 4,5:1, Dynamic Type jusqu'à 200 %, VoiceOver/TalkBack, jamais d'information portée par la couleur seule. Le texte beige clair du logo artisan ne passe pas.
- **Mode sombre** dès le départ, grâce aux tokens sémantiques.
- **Motion sobre** : transitions de 200 à 300 ms, respect du réglage « réduire les animations ».
- **Saisie assistée** : autocomplétion d'adresse, photo et vocal pour décrire une panne, Apple Pay / Google Pay en un geste, passkeys pour la connexion.
- **Microcopy rassurante** : « Vous ne payez qu'à la fin, quand vous donnez le code », « Annulation gratuite jusqu'à 2 h avant ».

**Design system (tokens)**

| Token | Valeur proposée | Usage |
| --- | --- | --- |
| color.brand.primary | Brun sable #8A6A4A (dérivé du beige Figma, contrasté) | CTA, liens, tab active |
| color.brand.surface | Beige #F1E4D3 | Cartes artisans, fonds de section |
| color.urgent | Rouge #C8102E | Bouton et parcours urgence uniquement |
| color.success / warning / info | Vert #1E7F4F / Ambre #B26B00 / Bleu #1F5FBF | Statuts d'intervention |
| color.domain.\* | Plomberie bleu, Électricité jaune, Énergétique orange | Pastilles métier, légende planning |
| font.family | Inter ou SF Pro / Roboto natifs | Tout le texte |
| font.scale | 12 / 14 / 16 (corps) / 20 / 24 / 32 | Hiérarchie |
| radius | 8 / 12 / 20 / plein | Champs / cartes / sheets / chips |
| spacing | Grille de 4 px : 4, 8, 12, 16, 24, 32 | Marges, gouttières |
| elevation | 0 / 1 (cartes) / 3 (sheets) | Profondeur |

**Composants à construire une fois** : bouton (primary, secondary, ghost, danger, urgent), carte artisan, carte intervention, chip de statut, chip de domaine, sélecteur de créneau, stepper, bottom sheet, champ OTP 4 chiffres, bulle de chat, ligne de récap prix, note en étoiles, état vide, skeleton, toast, bannière hors ligne.

**Corrections au Figma** : unifier le nom (DEPANO), retirer les bordures noires épaisses des cartes au profit de l'élévation, donner au bouton urgence la couleur `urgent` plutôt que beige, remplacer « Mes RDV » client par un onglet « Activité » qui regroupe RDV en cours et historique.

## 3. Architecture de navigation

&#91;embedded content: navigation · 2 espaces × 5 onglets\]

Les deux espaces partagent la même structure d'onglets, ce qui réduit l'apprentissage pour un artisan qui est aussi client. Par rapport au Figma, la cloche quitte la tab bar pour l'en-tête (avec badge), ce qui libère un onglet Messages, plus utilisé au quotidien.

- **Barre de 5 onglets maximum**, libellés toujours visibles, badge chiffré sur Activité et Messages.
- **Intervention en cours épinglée** au-dessus de la tab bar, comme un lecteur audio : un tap ouvre le suivi, quel que soit l'onglet.
- **Navigation en piles par onglet** : chaque onglet garde son historique ; retour par geste de bord sur iOS, bouton retour prédictif sur Android.
- **Liens profonds** pour chaque écran (`depano://intervention/{id}`), ouverts depuis les notifications et les SMS.
- **Changement de rôle** depuis Profil, avec une transition de couleur claire pour éviter les confusions.

## 4. Parcours utilisateurs

Le parcours urgence est le cœur du produit : 4 écrans côté client avant le paiement, puis tout se joue entre l'artisan et le serveur. Objectif : moins de 90 secondes entre le tap « Urgence » et l'empreinte validée.

&#91;embedded content: parcours urgence · client, serveur, artisan\]

Le dispatch contacte les artisans un par un (ou par vagues de 3), classés par distance, note et taux d'acceptation. Si personne n'accepte après le dernier élargissement du rayon, l'empreinte est libérée et le client reçoit une alternative (premier créneau planifié disponible).

### Première ouverture (client)

1. Splash, puis 3 slides d'onboarding skippables.
2. Accueil directement accessible sans compte : on peut chercher et voir les prix.
3. Demande de localisation expliquée (« pour trouver les artisans proches ») au premier besoin, pas au lancement.
4. Compte créé au moment de réserver : téléphone, OTP, prénom et nom. Rien d'autre.
5. Notifications demandées juste après la première réservation (« pour suivre l'arrivée de l'artisan »).

### Rendez-vous planifié (client)

1. Depuis une fiche artisan ou un domaine : « Prendre rendez-vous ».
2. Type : entretien ou dépannage, puis motif et photo facultative.
3. Créneau : jours en scroll horizontal, créneaux en grille ; les créneaux passés ou pris sont masqués, pas grisés.
4. Adresse (pré-remplie), récapitulatif, conditions d'annulation, enregistrement de la carte.
5. Confirmation avec ajout au calendrier ; rappel push la veille et 1 h avant.
6. Le jour J, même suite que l'urgence à partir de « En route ».

### Inscription artisan

1. « Je suis artisan » ou « Devenez artisan » depuis un profil client.
2. SIRET : nom, adresse et activité sont pré-remplis automatiquement.
3. Métiers, prestations et tarifs (avec des prix indicatifs du marché proposés par défaut).
4. Zone d'intervention (rayon sur carte) et horaires types.
5. Documents : pièce d'identité, assurance, IBAN via le formulaire Stripe intégré.
6. Statut « en vérification », avec une checklist de progression et un délai annoncé (48 h ouvrées).
7. Validation : notification, profil visible, interrupteur « dispo urgences » débloqué.

### Journée type (artisan)

1. Ouvre l'app : résumé du jour, prochaine intervention, demandes en attente.
2. Tap sur l'intervention : « Y aller » ouvre l'itinéraire et passe le statut à « En route ».
3. Arrivée détectée par géolocalisation (ou bouton), puis diagnostic et devis en 3 taps.
4. Après validation du client : travaux, compte rendu (photos avant/après, matériel, note vocale transcrite).
5. Saisie du code, paiement capturé, carte suivante.

### Annulation et litige

1. Annulation client : gratuite jusqu'à 2 h avant un RDV ; ensuite frais de déplacement, sauf garantie annulation souscrite.
2. Annulation artisan : le client est reprogrammé en priorité ; l'artisan perd des points de fiabilité.
3. « Technicien jamais venu » ou « Déplacement seulement » (Figma) : ouvre un litige, la capture est gelée.
4. Le support voit la timeline des statuts, les positions GPS horodatées, le chat et les photos, puis tranche en moins de 72 h.

## 5. Inventaire des écrans

Le MVP compte environ 45 écrans : 8 communs, 20 client, 17 artisan. Les écrans en *italique* ne figurent pas dans le Figma et sont à concevoir.

### Communs

| Écran | Contenu | États à prévoir |
| --- | --- | --- |
| *Splash + onboarding* | 3 slides max (urgence, prix garanti, paiement sécurisé), skippable | Premier lancement uniquement |
| *Connexion / inscription* | Téléphone + OTP SMS, Apple, Google, passkey | Erreur OTP, compte existant |
| *Choix du rôle* | « J'ai besoin d'un artisan » / « Je suis artisan » | — |
| *Autorisations* | Localisation, notifications, chacune expliquée avant la popup système | Refus → mode dégradé |
| Messages (liste) | Conversations par intervention, badge non lu | Vide |
| Chat | Texte, photos, vocal, carte d'intervention épinglée en haut | Hors ligne, envoi échoué |
| Notifications | Fil groupé par jour, filtres | Vide |
| Paramètres | Compte, sécurité, notifications, légal, aide, changer de rôle, supprimer le compte | — |

### App client

| Écran | Contenu | États à prévoir |
| --- | --- | --- |
| Accueil | Bouton urgence, recherche, domaines, artisans dispo près de moi, intervention en cours épinglée | Aucun artisan dans la zone |
| Recherche / résultats | Liste + carte, filtres en bottom sheet (domaine, dispo aujourd'hui, note, prix) | Aucun résultat |
| Fiche artisan | Photo, note, avis, tarifs par prestation, réalisations, zone, badges (SIRET vérifié, assuré), prochaines dispos | Indisponible |
| Urgence 1 : domaine | 3 grandes tuiles | — |
| Urgence 2 : motif | Motifs prédéfinis + texte + photo/vocal | — |
| Urgence 3 : adresse | Adresse pré-remplie, étage, digicode, accès | Hors zone |
| Urgence 4 : prix et paiement | Fourchette annoncée, frais d'urgence, garantie, total, Apple Pay | Paiement refusé |
| *Urgence 5 : recherche d'artisan* | Animation, compteur, « 3 artisans contactés » | Aucun preneur après X min |
| *Urgence 6 : suivi en direct* | Carte, ETA, photo et nom de l'artisan, appel/chat | Retard, annulation artisan |
| RDV 1 : type | Entretien / dépannage | — |
| RDV 2 : motif | Liste + détail | — |
| RDV 3 : créneau | Jours en scroll horizontal, créneaux en grille | Aucun créneau |
| RDV 4 : récap et paiement | Récap, empreinte bancaire, conditions d'annulation | — |
| *Confirmation* | Animation, ajout au calendrier, prochaines étapes | — |
| Activité | Onglets « En cours » / « Passées » | Vide |
| Détail intervention | Timeline des statuts, artisan, prix, code de fin, devis à valider, actions | Chaque statut |
| *Validation de devis* | Lignes, total, accepter/refuser | Expiré |
| Fin d'intervention | Code 4 chiffres, « Que s'est-il passé ? » | — |
| *Notation* | Étoiles, tags, commentaire, photo | Déjà noté |
| Compte, adresses, paiement, factures, favoris, parrainage, aide | Repris du Figma | — |

### App artisan

| Écran | Contenu | États à prévoir |
| --- | --- | --- |
| *Onboarding pro (KYC)* | SIRET, pièce d'identité, assurance décennale/RC pro, IBAN, métiers, zone | En attente de validation, refusé |
| Accueil | Interrupteur « Disponible pour urgences », prochaine intervention, demandes en attente, résumé du jour | Compte non validé |
| *Demande d'urgence* | Plein écran : motif, distance, prix, compte à rebours 60 s, accepter/refuser | Prise par un autre |
| Planning | Mois + jour, légende par type, ajout d'indispo perso | Vide |
| Interventions | Liste du jour par statut, navigation semaine | Vide |
| Détail intervention | Client, adresse (ouvrir dans Maps), appel/chat, bouton d'action selon statut | Chaque statut |
| *Devis sur place* | Lignes main-d'œuvre et pièces, envoi au client | Refusé |
| Compte rendu | Réalisable oui/non, matériel, photos avant/après, note, retour nécessaire | Brouillon |
| Saisie du code de fin | Clavier OTP 4 chiffres | Code faux (3 essais) |
| Profil public | Aperçu « vu client », illustrations, tarifs, avis | — |
| Disponibilités | Horaires types par jour, congés, rayon d'intervention | — |
| Tarifs | Prix par prestation, frais de déplacement | — |
| *Revenus* | Solde, virements, commission, export comptable | Aucun gain |
| *Statistiques* | CA par mois, taux d'acceptation, note moyenne | — |
| Activité | Réservations, annulations, avis, messages | — |

## 6. Gestion des utilisateurs

Un utilisateur = une identité (`users`), à laquelle on attache des profils de rôle (`client_profiles`, `artisan_profiles`). Les permissions sont vérifiées par l'API à chaque requête (garde par rôle + contrôle de propriété), jamais dans l'app ; la Row Level Security de Postgres sert de seconde barrière.

| Rôle | Peut | Ne peut pas |
| --- | --- | --- |
| Visiteur (non connecté) | Parcourir les artisans, voir les prix, commencer une urgence | Payer, discuter |
| Client | Réserver, payer, discuter, noter, gérer ses adresses et moyens de paiement | Voir les coordonnées d'un artisan hors intervention |
| Artisan en attente | Compléter son KYC, prévisualiser son profil | Apparaître dans la recherche, recevoir des demandes |
| Artisan validé | Recevoir et accepter des demandes, gérer planning, tarifs, devis, comptes rendus | Voir l'adresse exacte du client avant acceptation |
| Artisan suspendu | Consulter son historique et ses revenus | Recevoir de nouvelles demandes |
| Support | Lire les interventions et chats signalés, rembourser, arbitrer | Modifier un avis |
| Admin | Valider les artisans, gérer catalogue, commissions et zones | — |

**Authentification**

- Identifiant principal : **numéro de mobile + OTP SMS**, indispensable pour que l'artisan puisse joindre le client. Email facultatif pour les factures.
- Raccourcis : Sign in with Apple (obligatoire sur iOS dès qu'un login social existe) et Google. Passkeys proposés après la première connexion.
- Mot de passe : non nécessaire. Cela supprime les écrans « changer le mot de passe » du Figma, remplacés par « Appareils connectés » et « Passkeys ».
- Sessions : JWT court (1 h) + refresh token, révocables depuis « Appareils connectés ».
- Compte invité : l'urgence peut démarrer sans compte ; le téléphone est vérifié à l'étape paiement.

**Vérification des artisans (KYC)**

1. SIRET contrôlé automatiquement via l'API Recherche d'entreprises (état actif, code APE cohérent avec le métier).
2. Pièce d'identité et IBAN vérifiés par le prestataire de paiement (Stripe Connect), qui porte l'obligation KYC.
3. Attestation d'assurance décennale et RC pro téléversée, avec date d'expiration et relance automatique 30 jours avant.
4. Qualifications optionnelles affichées en badge (RGE, Qualigaz, Qualifelec).
5. Validation manuelle par un admin, puis statut « vérifié » visible sur le profil.

**Cycle de vie du compte** : création → actif → (suspendu) → supprimé. La suppression est accessible en 2 taps (exigence Apple et Google). Les données personnelles sont anonymisées, mais les factures sont conservées 10 ans (obligation comptable).

## 7. États d'une intervention et règles métier

Une réservation et une intervention sont le même objet (`bookings`), piloté par une machine à états unique côté serveur. L'app ne fait que demander une transition ; le serveur vérifie qui la demande et dans quel état on est.

&#91;embedded content: cycle de vie d'une intervention · 9 états + 4 sorties\]

Pour un RDV planifié, « Acceptée » est atteint dès la réservation du créneau (l'artisan a publié ses disponibilités). Chaque transition écrit une ligne dans `booking_events` avec l'auteur, l'heure et la position GPS : c'est la preuve en cas de litige.

**Règles métier à trancher avant le développement**

| Règle | Proposition |
| --- | --- |
| Prix affiché au client | Prix de base de l'artisan + frais d'urgence fixes ; un devis supérieur de plus de 20 % exige une nouvelle validation |
| Fenêtre d'acceptation urgence | 60 s par artisan, 3 vagues maximum, rayon 5 puis 10 puis 20 km |
| Annulation client | Gratuite jusqu'à 2 h avant ; ensuite frais de déplacement, sauf garantie annulation (10 €) |
| Annulation artisan | Reprogrammation prioritaire du client ; 3 annulations en 30 jours entraînent une suspension des urgences |
| Retard artisan | Au-delà de 30 min sur l'ETA, le client peut annuler sans frais |
| Code de fin | 4 chiffres, 3 essais ; pas de code après 24 h : capture automatique sauf contestation |
| Notation | Ouverte 14 jours après clôture, un avis par intervention, réponse publique de l'artisan possible |
| Commission | Prélevée à la capture, jamais sur les frais de déplacement seuls |

## 8. Modèle de base de données

PostgreSQL avec l'extension PostGIS suffit pour tout le MVP : 28 tables réparties en 5 domaines, toutes reliées à `bookings`. Chaque table porte `id` (UUID), `created_at` et `updated_at` en UTC.

&#91;embedded content: modèle de données · 5 domaines autour de bookings\]

**Choix de conception**

- **Montants en centimes** (`integer`), jamais en `float` ; devise stockée à côté pour l'avenir.
- **Géographie** : colonnes `geography(Point)` sur `addresses` et `artisan_profiles` (zone + rayon), index GIST. La requête de dispatch « artisans validés, disponibles, du bon métier, à moins de X km » tient en une fonction SQL.
- **Pas de double réservation** : contrainte d'exclusion sur `(artisan_id, tstzrange(scheduled_at, ends_at))` pour les statuts actifs.
- **Machine à états en base** : une fonction `transition_booking(id, to_status)` vérifie l'état courant, le rôle de l'appelant et écrit `booking_events` dans la même transaction.
- **Instantané des prix** : `bookings` copie le prix et la commission au moment de la réservation ; une modification de tarif par l'artisan ne change pas les réservations existantes.
- **Contrôle d'accès** : appliqué dans la couche service de l'API (un client ne lit que ses réservations ; un artisan ne voit l'adresse qu'à partir de `accepted`), doublé de politiques Row Level Security Postgres sur les tables sensibles.
- **Code de fin** : stocké haché dans `bookings.completion_code_hash`, avec un compteur d'essais.
- **Suppression** : `deleted_at` + anonymisation des `users` ; `invoices` et `payments` conservés 10 ans.
- **Index clés** : `bookings(artisan_id, scheduled_at)`, `bookings(client_id, status)`, `messages(conversation_id, created_at)`, `notifications(user_id, read_at)`.
- **Migrations versionnées** dans le dépôt (Drizzle Kit), appliquées automatiquement au déploiement, seed de données de démo reprenant les exemples du Figma.

## 9. Stack technique recommandée

Le backend est construit de A à Z : **une API TypeScript (NestJS) devant PostgreSQL + PostGIS et Redis, avec des workers pour les tâches de fond, le tout hébergé en France**. Une seule langue du mobile au back-office, aucune dépendance à un backend-as-a-service, et l'équipe garde la main sur chaque règle métier.

Quelques briques restent externes, car on ne peut pas légalement ou techniquement les refaire. Détenir l'argent des clients avant de le reverser exige un agrément d'établissement de paiement, d'où Stripe Connect. Les SMS passent par un opérateur, les notifications par APNs (Apple) et FCM (Google), les cartes par un fournisseur de tuiles. Chacune est isolée derrière une interface dans le code (`PaymentProvider`, `SmsProvider`…), donc remplaçable sans toucher au métier.

&#91;embedded content: architecture · app, backend maison, services externes\]

L'app ne parle qu'à l'API : REST versionnée (`/v1`) pour les actions, WebSocket pour le temps réel. Tout ce qui est différé (minuteries de dispatch de 60 s, rappels, génération de factures, envoi de push et SMS avec nouvelles tentatives) passe par une file Redis traitée par les workers, ce qui garde l'API rapide.

| Couche | Choix | Pourquoi | Alternative |
| --- | --- | --- | --- |
| App mobile | Expo + React Native, TypeScript, Expo Router, en development build | Une base iOS/Android, mises à jour OTA (EAS Update), modules natifs possibles | React Native CLI sans Expo, Flutter |
| Interface | Design system maison sur tokens, Reanimated, Gesture Handler, bottom sheets | Animations fluides, gestes natifs | Tamagui |
| Données côté app | TanStack Query + Zustand, client API généré depuis l'OpenAPI | Cache, hors ligne, optimistic UI, typage de bout en bout | tRPC |
| Formulaires | React Hook Form + Zod | Schémas partagés entre app, back-office et API | — |
| API | NestJS sur Fastify, REST `/v1`, documentation OpenAPI générée | Modules, injection de dépendances, guards par rôle | Fastify seul, Go, Laravel |
| Base de données | PostgreSQL + PostGIS, Drizzle ORM | SQL explicite, migrations typées, requêtes géographiques en SQL | Prisma |
| Files et cache | Redis + BullMQ | Minuteries de dispatch, tâches planifiées, retries, rate limiting | RabbitMQ |
| Temps réel | WebSocket (Socket.IO) avec adaptateur Redis | Chat, statuts et position de l'artisan, sur plusieurs instances | Server-Sent Events |
| Authentification | Maison : OTP SMS haché (5 min, 3 essais), JWT d'accès 15 min, refresh token rotatif stocké en base, Apple et Google vérifiés côté serveur, passkeys (SimpleWebAuthn) | Contrôle total, aucun mot de passe à gérer | — |
| Fichiers | Stockage objet compatible S3, upload direct par URL pré-signée, miniatures par un worker | L'API ne transporte jamais les fichiers | — |
| Hébergement | Scaleway ou OVHcloud : API et workers en conteneurs Docker, Postgres et Redis managés, sauvegardes quotidiennes | Données en France, coûts prévisibles | AWS région Paris |
| Infrastructure | Terraform, GitHub Actions, environnements dev, staging, prod | Reproductible, déploiement à chaque merge | — |
| Back-office | Next.js + shadcn/ui sur la même API (rôles admin et support) | Une seule source de vérité | — |
| Qualité | Vitest, tests d'intégration API sur Postgres jetable (Testcontainers), Maestro pour le mobile, EAS Build | Chaque PR testée, builds store automatisés | Detox |
| Observabilité | OpenTelemetry vers Grafana (logs, métriques, traces), Sentry, PostHog | Diagnostiquer vite, mesurer le funnel urgence | Datadog |

**Organisation du code** : un monorepo (pnpm + Turborepo) avec `apps/mobile`, `apps/api` (modules auth, users, artisans, bookings, dispatch, payments, chat, notifications, admin), `apps/worker`, `apps/admin`, `packages/ui` (design system), `packages/schemas` (Zod + client API généré), `packages/db` (schéma Drizzle, migrations, seed) et `infra/` (Docker, Terraform).

**Ordre de construction du backend** : 1) schéma et migrations, 2) auth OTP et rôles, 3) catalogue artisans et recherche géographique, 4) réservations et machine à états, 5) Stripe et webhooks, 6) WebSocket et chat, 7) dispatch urgence dans les workers, 8) factures et back-office.

## 10. Paiement, conformité et sécurité

Le modèle de paiement recommandé est **l'empreinte bancaire avec capture différée**. Le client autorise un montant à la réservation, rien n'est débité, puis la capture a lieu à la saisie du code de fin. L'argent part chez l'artisan, moins la commission DEPANO. C'est ce qui rend crédible la promesse du code de validation du Figma.

**Flux de paiement (Stripe Connect, comptes Express)**

1. Réservation : création d'un PaymentIntent en `capture_method=manual` pour le prix annoncé + frais d'urgence + garantie. Authentification forte (3-D Secure, DSP2) gérée par Stripe.
2. Devis sur place supérieur au montant autorisé : le client valide le nouveau devis dans l'app, puis une autorisation complémentaire est créée.
3. Code de fin validé : capture, transfert vers l'artisan avec `application_fee` (commission), facture générée.
4. Litige ouvert : la capture est suspendue, le support arbitre (capture partielle, frais de déplacement seuls, ou annulation).
5. Une autorisation de carte expire au bout de 7 jours environ. Pour un RDV plus lointain, on enregistre la carte (SetupIntent) et on autorise 24 h avant.
6. Espèces (présent dans le Figma) : à éviter au MVP, car elles cassent la garantie et la commission. Si on les garde, il faut débiter la commission sur la carte de l'artisan.

**Monétisation** : commission de 12 à 20 % par intervention, frais d'urgence partagés, garantie annulation à 10 €, mise en avant payante des profils (abonnement artisan « Pro »).

**Obligations légales à intégrer au produit**

| Sujet | Obligation | Impact produit |
| --- | --- | --- |
| Devis dépannage à domicile | Depuis l'arrêté du 24 janvier 2017, un devis détaillé est dû avant toute prestation, le seuil de 150 € TTC ayant été supprimé ([INC](https://www.inc-conso.fr/content/prestations-de-depannage-de-reparation-et-dentretien-une-meilleure-information-sur-les-prix)) ; il est obligatoire dès le premier euro ([economie.gouv.fr](https://www.economie.gouv.fr/particuliers/depannage-reparation-entretien-domicile)) | Écran « devis » côté artisan, validé par le client dans l'app avant le statut « en cours » ; mention de conservation des pièces remplacées |
| Droit de rétractation | Exclu pour les réparations urgentes au domicile expressément demandées par le consommateur ([INC](https://www.inc-conso.fr/content/prestations-de-depannage-de-reparation-et-dentretien-une-meilleure-information-sur-les-prix)) | Case à cocher explicite dans le parcours urgence ; pour les RDV planifiés, informer du délai de 14 jours |
| Facturation électronique | Réception obligatoire pour toutes les entreprises au 1er septembre 2026, émission pour TPE, PME et micro-entreprises au 1er septembre 2027 ([AG2R La Mondiale](https://www.ag2rlamondiale.fr/groupe/magazines/expertises/reglementation/facturation-electronique-etes-vous-pret)) | Factures de commission DEPANO → artisan au format Factur-X via une plateforme agréée ; e-reporting des ventes aux particuliers |
| Plateformes en ligne | Déclaration annuelle des revenus des vendeurs (DAC7) et information sur le classement des offres | Export DAC7 dans le back-office ; page « Comment sont classés les artisans » |
| Médiation | Médiateur de la consommation obligatoire | Lien dans Assistance et dans les CGV |
| RGPD | Base légale, minimisation, droits d'accès et suppression | Écran de consentement, export de données, purge automatique des chats et photos après 3 ans |
| Accessibilité | European Accessibility Act | Voir section 2 |

**Sécurité**

- Masquage des coordonnées : l'adresse exacte n'est visible qu'après acceptation, le numéro passe par un relais d'appel (Twilio Proxy ou équivalent) pour éviter le contournement de la plateforme.
- Code de fin : 4 chiffres, généré côté serveur, haché en base, 3 essais puis blocage et alerte support.
- Autorisation testée sur chaque route de l'API, rate limiting (OTP, connexion, création de demande), secrets dans un coffre (jamais dans le dépôt), webhooks Stripe signés et idempotents, TLS partout et sauvegardes Postgres chiffrées.
- Photos stockées en bucket privé avec URL signées à durée courte.
- Détection de fraude : vitesse de création de comptes, cartes refusées en série, artisan qui annule souvent.

Ce plan n'est pas un avis juridique ; les CGU, CGV et le statut d'intermédiaire de paiement sont à valider avec un avocat.

## 11. Roadmap et indicateurs

Le MVP vise une bêta fermée à Marseille au bout de 6 mois : construire soi-même l'authentification, le temps réel, le stockage et l'infrastructure ajoute environ 2 mois par rapport à un backend géré. Chaque phase ne démarre que si le jalon précédent est atteint.

&#91;embedded content: roadmap · 3 phases, 3 jalons\]

Le vrai risque d'une marketplace est l'offre : sans assez d'artisans disponibles, l'urgence échoue et le client ne revient pas. Le recrutement des 50 premiers artisans se fait donc en parallèle du développement, à la main.

| Indicateur | Ce qu'il mesure | Cible MVP |
| --- | --- | --- |
| Taux de prise en charge urgence | Urgences acceptées / urgences envoyées | > 85 % |
| Délai d'acceptation médian | Du paiement à « Acceptée » | < 3 min |
| Conversion du tunnel urgence | Tap « Urgence » → empreinte validée | > 40 % |
| Taux d'interventions clôturées par code | Codes saisis / interventions terminées | > 95 % |
| Taux de litige | Litiges / interventions | < 3 % |
| Note moyenne | Avis clients | ≥ 4,5 / 5 |
| Récurrence client | Clients ayant une 2e intervention sous 6 mois | > 25 % |
| Activité artisan | Interventions par artisan actif et par semaine | ≥ 5 |

**Prochaines étapes concrètes**

- [ ] Trancher les règles métier de la section 7 (prix, annulation, fenêtres d'urgence)
- [ ] Refaire le Figma sur le design system de la section 2 et ajouter les écrans manquants (en italique section 5)
- [ ] Prototype cliquable du parcours urgence, testé avec 5 clients et 5 artisans
- [ ] Valider CGU, CGV et modèle de devis avec un avocat
- [ ] Ouvrir les comptes Stripe Connect, hébergeur (Scaleway ou OVHcloud), Apple et Google développeur

## Sources

- [INC — Prestations de dépannage, de réparation et d'entretien : une meilleure information sur les prix](https://www.inc-conso.fr/content/prestations-de-depannage-de-reparation-et-dentretien-une-meilleure-information-sur-les-prix)
- [economie.gouv.fr — Dépannage à domicile](https://www.economie.gouv.fr/particuliers/depannage-reparation-entretien-domicile)
- [AG2R La Mondiale — Facturation électronique : êtes-vous prêt ?](https://www.ag2rlamondiale.fr/groupe/magazines/expertises/reglementation/facturation-electronique-etes-vous-pret)
- Maquette Figma DEPANO (40 écrans, analysée le 19 octobre 2026)
