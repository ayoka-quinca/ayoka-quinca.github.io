# AYOKA QUINCA : gestion de stock et de vente

Application pour la quincaillerie **AYOKA QUINCA** (Sèmè-Podji, Bénin) : ventes au comptant, à crédit ou par Mobile Money, stock en temps réel par zone du magasin, plan interactif, crédits clients, achats fournisseurs, inventaires et rapports.

**Une seule application** pour le téléphone et l'ordinateur, qui **fonctionne sans Internet** et se synchronise dès que le réseau revient.

## Démarrer en 1 minute (démonstration)

```bash
cd app && npm install && npm run dev
```

Ouvrir http://localhost:5173 → « Découvrir avec des exemples ».
Codes de démonstration : **Sofiatou 1234** (responsable) · **Caissière 2222** · **Vendeur 3333**.

## Avec synchronisation entre appareils

```bash
cd app && npm run build
```

```bash
SHOP_TOKEN=$(openssl rand -hex 16) node server/index.mjs
```

Le serveur sert l'application et la synchronisation sur http://localhost:8080. Il faut Node.js 22.13 ou plus récent, et aucune dépendance. Pour la production (Docker + HTTPS), voir [docs/04-deploiement.md](docs/04-deploiement.md).

## Documentation

| # | Document | Contenu |
|---|---|---|
| 1 | [Analyse et choix](docs/01-analyse-et-choix.md) | Lecture du cahier des charges, écarts relevés, décisions justifiées |
| 2 | [Design system « Comptoir » V2](docs/02-design-system.md) | Règles, identité, couleurs, typographie, composants |
| 3 | [Architecture](docs/03-architecture.md) | Modèle de données, synchronisation hors ligne, sécurité, droits, tests |
| 4 | [Déploiement](docs/04-deploiement.md) | Plan en 6 semaines : matériel, serveur, saisie du stock, formation, pilote, bascule |
| 5 | [Maintenance et évolutions](docs/05-maintenance-evolutions.md) | Routines, sauvegardes, mises à jour, limites connues, feuille de route V2.1 → V5 |
| 6 | [Fiches mémo](docs/06-fiches-memo.md) | Une page par rôle, à imprimer |
| 7 | [Comment ça marche](docs/07-comment-ca-marche.md) | Produits, emplacements, inventaire, fournisseurs : les règles expliquées |
| 8 | [Mise en ligne sur GitHub](docs/08-publication-github.md) | Pourquoi « GitHub Actions », ce qui se passe à chaque modification |

Historique des versions : [CHANGELOG.md](CHANGELOG.md).

## Vérifications

```bash
cd app && npm run typecheck
```

```bash
cd app && npm run build && npm run preview
```

Puis, dans un autre terminal (Playwright requis) :

```bash
node tests/e2e.cjs
```
