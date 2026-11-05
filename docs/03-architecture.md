# 3. Architecture technique

## 3.1 Vue d'ensemble

```
  Téléphone vendeur        Téléphone caisse         PC responsable
  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
  │ PWA          │         │ PWA          │         │ PWA          │
  │ IndexedDB    │         │ IndexedDB    │         │ IndexedDB    │
  │ file d'envoi │         │ file d'envoi │         │ file d'envoi │
  └──────┬───────┘         └──────┬───────┘         └──────┬───────┘
         │  HTTPS, quand le réseau est là (toutes les 30 s)  │
         └────────────────────────┼─────────────────────────┘
                                  ▼
                   ┌──────────────────────────────┐
                   │ VPS : Caddy (HTTPS)          │
                   │   └─ Node 22 server/index.mjs│
                   │        ├─ sert la PWA         │
                   │        ├─ /sync/push, /pull   │
                   │        └─ SQLite + sauvegardes│
                   └──────────────┬───────────────┘
                                  ▼
                     Copie nocturne vers Google Drive
```

## 3.2 Arborescence

```
app/                      Application (PWA)
  src/db.ts               Modèle de données, schéma IndexedDB, write() + file d'envoi
  src/domain/ops.ts       Opérations métier transactionnelles (vente, retour, achat, transfert, inventaire)
  src/domain/sync.ts      Synchronisation push/pull
  src/domain/auth.ts      Rôles, permissions, PIN, journal
  src/domain/seed.ts      Zones du plan, catégories du CDC, données de démonstration
  src/domain/backup.ts    Sauvegarde/restauration JSON, import CSV du catalogue
  src/domain/format.ts    Francs CFA, dates, recherche sans accents, liens WhatsApp
  src/ui/                 Composants du design system (kit.tsx, StoreMap.tsx, Ticket.tsx…)
  src/pages/              Un fichier par écran
  src/styles.css          Tokens et composants CSS
server/index.mjs          Serveur de synchronisation (aucune dépendance)
deploy/                   docker-compose, Caddyfile, script de copie hors site
tests/e2e.cjs             Parcours complet automatisé (Playwright)
docs/                     Cette documentation
```

## 3.3 Modèle de données

| Table | Contenu | Modifiable ? |
|---|---|---|
| `locations` | Zones (avec rectangle en mètres sur le plan) et étagères (parentId) | Oui |
| `categories` | Familles de produits | Oui |
| `products` | Fiche : nom, catégorie, dimensions, unité, prix d'achat/vente, **prix de gros**, seuil d'alerte, emplacement principal, fournisseurs, observations | Oui (retrait = archivage, jamais suppression) |
| `movements` | **+/− quantité**, produit, emplacement, type (achat, vente, retour, inventaire, transfert, perte, initial), auteur, date, référence | **Non, jamais** |
| `sales` | Lignes (prix appliqué, prix catalogue, prix d'achat au moment de la vente, emplacement), total, payé, mode, client | Seulement retours et annulation |
| `payments` | Paiements de crédit (+) et remboursements (−) | Non |
| `clients`, `suppliers` | Coordonnées | Oui |
| `purchases` | Réceptions fournisseurs | Non |
| `inventories` | Lignes attendu / compté, statut | Jusqu'à validation |
| `users`, `audit` | Comptes, rôles, empreintes PIN, journal | — |
| `stock` (local) | **Cache** produit × emplacement, reconstruit à partir des mouvements | Calculé |
| `outbox` (local) | File d'envoi vers le serveur | Technique |

**Calculs clés**
- Stock d'un produit = Σ `movements.qty` (cache `stock` mis à jour dans la même transaction).
- Solde d'un client = Σ (valeur nette des ventes après retours − payé à la vente) − Σ paiements.
- Bénéfice = Σ (prix appliqué − prix d'achat **au moment de la vente**) × quantité nette.

## 3.4 Synchronisation

1. `write()` horodate l'enregistrement (`updatedAt`, `deviceId`) et ajoute `{table, id}` à `outbox`, dans **la même transaction** que l'opération métier.
2. **Push** : par lots de 200, l'appareil envoie la version actuelle des enregistrements en attente. Le serveur garde la version la plus récente (`updatedAt`) et lui attribue un numéro d'ordre croissant `seq`.
3. **Pull** : l'appareil demande tout ce qui a `seq > curseur`, par pages de 500, applique les versions plus récentes et reconstruit le cache de stock si des mouvements sont arrivés.
4. Numéro de vente = `code appareil` + compteur local (ex. `JF-0042`) : jamais de doublon, même hors ligne.

**Pourquoi c'est sûr** : les tables où une erreur coûte de l'argent (mouvements, paiements, ventes, achats) sont **en ajout seul**. Le « le plus récent gagne » ne s'applique en pratique qu'aux fiches (produit, client…), où c'est le comportement attendu.

## 3.5 Sécurité

| Menace | Mesure |
|---|---|
| Interception réseau | HTTPS obligatoire (Caddy + Let's Encrypt, HSTS) |
| Accès au serveur par un inconnu | Clé de boutique de 32 caractères (comparaison à temps constant). Les clients ne voient jamais l'API |
| Employé curieux | Rôles : prix d'achat, bénéfices, corrections de stock, achats, rapports et paramètres réservés à la responsable |
| Téléphone laissé ouvert | Bouton « Verrouiller », session par personne, journal des connexions |
| Code PIN | Empreinte SHA-256 salée par utilisateur, jamais stockée en clair |
| Perte du téléphone | Les données sont sur le serveur. Désactiver le compte, changer la clé de boutique |
| Perte du serveur | Sauvegardes quotidiennes (30 jours) + copie nocturne hors site + export manuel |
| Données effacées par Android | `navigator.storage.persist()` demandé au démarrage |

**Limite connue de la V1** : la clé de boutique est la même pour tous les appareils, et les droits sont vérifiés dans l'application. Pour 3 personnes de confiance, c'est un compromis raisonnable. La V1.5 ajoute une authentification par utilisateur côté serveur (doc 05).

## 3.6 Matrice des droits

| Action | Responsable | Caisse | Vendeur / Magasin |
|---|:-:|:-:|:-:|
| Vendre, retours, ticket, WhatsApp | ✅ | ✅ | ✅ |
| Voir stock et plan | ✅ | ✅ | ✅ |
| Clients, encaisser un crédit | ✅ | ✅ | — |
| Déplacer un produit | ✅ | — | ✅ |
| Compter un inventaire | ✅ | — | ✅ |
| Valider un inventaire, corriger le stock | ✅ | — | — |
| Prix d'achat, bénéfice, rapports | ✅ | — | — |
| Achats, fournisseurs | ✅ | — | — |
| Produits, catégories, équipe, paramètres | ✅ | — | — |
| Annuler une vente | ✅ | — | — |

Les droits sont définis à un seul endroit (`app/src/domain/auth.ts`), ce qui permet de les ajuster en une ligne si la responsable le demande.

## 3.7 Performance (§5.2.7)

- Recherche en mémoire sur le catalogue : instantanée jusqu'à environ 10 000 produits.
- Stock lu dans un cache indexé, sans recalcul à chaque affichage.
- Écrans secondaires chargés à la demande (*code splitting*). Premier écran ≈ 150 ko compressés, puis tout fonctionne depuis le cache.
- Serveur : SQLite en mode WAL, index sur `seq`. Des dizaines de milliers d'opérations par jour sont possibles sur le plus petit VPS.

## 3.8 Tests

- `npm run typecheck` : vérification TypeScript stricte.
- `npm run test:e2e` (application lancée avec `npm run preview`) : parcours complet sur un Pixel 7 et un écran 1366 px (démo, connexion PIN, vente avec prix de gros et prix négocié, monnaie à rendre, vente à crédit, fiche client, stock, plan, inventaire, point de caisse, mode hors ligne, rapports, paramètres), avec captures d'écran.
- `tests/sync.cjs` (serveur vierge lancé) : un PC crée la boutique et un produit avec 50 en stock, un téléphone rejoint la boutique et en vend 5, le PC affiche bien 45.
