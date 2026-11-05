# 0. Les modules du projet

Le projet est découpé en **modules indépendants**. Chacun a son dossier, son rôle, sa documentation et ses tests. On peut en modifier un sans toucher aux autres.

```
ayoka-quinca/
├── app/        Module 1 : application de gestion (équipe)     → https://ayoka-quinca.github.io/gestion/
├── server/     Module 2 : serveur de synchronisation           → à installer sur un VPS (doc 04)
├── site/       Module 3 : site vitrine + assistant (clients)   → https://ayoka-quinca.github.io/
├── deploy/     Docker, HTTPS, sauvegardes hors site du serveur
├── scripts/    build-pages.sh : assemble site + application pour GitHub Pages
├── tests/      e2e.cjs (application), sync.cjs (synchronisation), site.cjs (site vitrine)
└── docs/       Cette documentation
```

| Module | Pour qui | Technologie | Données | Doc |
|---|---|---|---|---|
| **1. Application de gestion** | Responsable, caisse, vendeur | React + TypeScript (PWA hors ligne) | Sur chaque appareil, synchronisées par le module 2 | 01 à 03, 05 à 07 |
| **2. Serveur de synchronisation** | Les appareils de l'équipe | Node.js 22 + SQLite, aucune dépendance | Base `ayoka.db` + sauvegardes | 03, 04 |
| **3. Site vitrine** | Clients, grand public | HTML + CSS + JavaScript, sans construction | `site/data/config.json`, `site/data/catalogue.json` | 09 |
| **3b. Assistant (dans le site)** | Clients | JavaScript à règles, sans IA ni serveur | Les mêmes fichiers que le site | 09 (§ 9.5) |

## Comment ils communiquent

- **Site → boutique** : uniquement par **WhatsApp**. Le site ne collecte aucune donnée et n'a pas de serveur. La commande part sous forme de message prêt à envoyer.
- **Application ↔ serveur** : synchronisation automatique dès qu'il y a du réseau (doc 03).
- **Site ↔ application** : aucun lien automatique pour l'instant. Le catalogue du site est un fichier séparé, pour ne pas exposer le stock, les prix d'achat ou les clients. L'export du catalogue de l'application vers le site est prévu (doc 05, V3).

## Publication

Un seul envoi sur `main` publie tout (doc 08) :
1. GitHub vérifie le code de l'application ;
2. `scripts/build-pages.sh` place le site à la racine et l'application dans `/gestion/` ;
3. GitHub Pages met le tout en ligne.

## Versions

Chaque module évolue à son rythme. Le `CHANGELOG.md` les note séparément : « Application 2.1 », « Site 1.0 »…
