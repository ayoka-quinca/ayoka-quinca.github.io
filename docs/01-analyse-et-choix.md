# 1. Analyse du besoin et choix structurants

Ce document explique **pourquoi** l'application est construite ainsi. Chaque décision est reliée à un passage du cahier des charges (CDC) ou à une contrainte du terrain béninois.

## 1.1 Ce que dit le cahier des charges, en une page

| Thème | Exigence du CDC | Où c'est traité |
|---|---|---|
| Stock fiable en temps réel | §1.5, §5.1.8 | Stock calculé à partir des mouvements (§1.4 ci-dessous) |
| Retrouver un produit dans 5 espaces | §3.4, §5.1.3 | Plan interactif, couleur par zone, « Où le trouver » sur chaque fiche |
| Vente rapide, prix négociables | §4.3, §4.8, §5.1.7 | Écran Vendre : 2 gestes par article, prix négocié, prix de gros |
| Crédits clients | §4.7, §5.1.5 | Clients & crédits, rappels WhatsApp, avances, retours |
| Achats fournisseurs | §4.2, §5.1.6 | Réception de marchandise en 3 étapes |
| Inventaire par zone | §4.5, §5.1.9 | Comptage par zone avec bouton « C'est juste », écarts, validation |
| Rôles (responsable, caissière, employé) | §3.3, §3.6, §5.1.10 | 3 rôles, codes PIN, journal des connexions |
| Mobile hors connexion + synchronisation | §5.2.3, §5.2.4 | PWA hors ligne d'abord + serveur de synchronisation |
| Sauvegardes automatiques et manuelles | §5.2.6 | Sauvegarde quotidienne serveur (30 j) + export manuel + copie hors site |
| Utilisable « avec peu de connaissances en informatique » | §5.2.2 | Design system « Comptoir » (voir doc 02) |
| Évolutivité vers d'autres quincailleries | §2.2 | Données paramétrables (zones, catégories, entreprise) ; feuille de route V2 multi-boutique (doc 05) |

### Écarts relevés entre les documents

1. **Le plan compte 6 espaces de stockage + l'espace caisse**, le CDC en annonce 5. Le plan ajoute un *Entrepôt matériaux de construction* (3,0 × 2,1 m) et sépare l'*Espace caisse* (7 × 4 m) du hall. J'ai suivi **le plan**, plus récent et plus précis. L'espace caisse est marqué « non stockable ». Tout reste modifiable.
2. Le CDC parle d'un **« serveur central installé au sein de l'entreprise »** (§6.1). Je recommande plutôt un serveur **en ligne** (VPS). La justification est au §1.3, l'option locale reste possible.
3. Le CDC prévoit **deux applications** (mobile et Desktop). J'ai fait **une seule application qui s'adapte à l'écran** (§1.2). Les deux usages décrits sont respectés : menu du bas et gros boutons sur téléphone, menu latéral, tableaux et rapports sur ordinateur.
4. Le CDC ne cite pas le **Mobile Money**, qui est pourtant un moyen de paiement courant au Bénin (MTN MoMo, Moov Money). Je l'ai ajouté comme mode de paiement à part entière, avec un total séparé dans le point de caisse.

## 1.2 Une seule application (PWA) au lieu de deux

**Décision** : une *Progressive Web App* installable, la même sur le téléphone Android et sur le PC.

**Pourquoi**
- **Coût et maintenance divisés par deux** : un seul code à corriger, tester et mettre à jour. Pour une boutique de 3 personnes, maintenir une app Android et une app Windows serait disproportionné.
- **Pas de Play Store, pas de fichier .exe** : on ouvre un lien, on touche « Installer » et l'icône apparaît comme une application. Les mises à jour se font toutes seules au lancement suivant.
- **Fonctionne hors ligne** : tout est stocké dans le téléphone (IndexedDB) et l'application se charge sans réseau grâce au *service worker*.
- **Matériel modeste** : environ 150 ko compressés au premier chargement, puis plus rien, pas de grosse police à télécharger. C'est adapté aux Android d'entrée de gamme et aux forfaits data.

**Limite assumée** : l'impression passe par la boîte d'impression du navigateur (imprimante thermique Bluetooth ou USB reconnue par Android ou Windows). L'impression directe ESC/POS est prévue en évolution (doc 05).

## 1.3 « Hors ligne d'abord » et serveur en ligne

Les coupures d'électricité et d'Internet font partie du quotidien. **Une vente ne doit jamais attendre le réseau.**

- Chaque appareil travaille sur **sa copie locale**. Toute opération est enregistrée immédiatement et mise dans une **file d'envoi**.
- Dès qu'il y a du réseau, la file part vers le serveur (toutes les 30 s et au retour de la connexion), puis l'appareil récupère ce que les autres ont saisi.
- Un bandeau dit clairement : « Pas d'Internet — tout continue de marcher, les données partiront plus tard. »

**Pourquoi un serveur en ligne (VPS) plutôt qu'un serveur dans le magasin**

| Critère | Serveur dans le magasin | Serveur en ligne (recommandé) |
|---|---|---|
| Coupure de courant | Le serveur s'arrête (onduleur obligatoire) | Aucun effet |
| Vol, incendie, inondation | Données perdues avec la machine | Données à l'abri, sauvegardes hors site |
| Consultation à distance par la responsable | Compliquée (ouverture de ports, IP fixe) | Native, depuis n'importe où |
| Maintenance | Déplacement sur place | À distance |
| Coût | Mini-PC + onduleur ≈ 250 000 F au départ | ≈ 4 000 à 6 000 F/mois |
| Dépendance à Internet | Aucune en interne | Faible, grâce au mode hors ligne |

L'option locale reste possible : le même serveur tourne sur un mini-PC ou un Raspberry Pi du magasin (voir doc 04, variante B).

## 1.4 Le stock n'est jamais « tapé », il est calculé

**Décision** : on n'enregistre jamais « il reste 45 sacs ». On enregistre des **mouvements** : +100 (achat), −5 (vente), +1 (retour), −2 (casse), +3 (écart d'inventaire). Le stock est leur somme, **par produit et par emplacement**.

**Pourquoi**
- **Traçabilité totale** (§5.2.5) : on sait qui a fait quoi, quand, et pourquoi le stock a bougé.
- **Synchronisation sans conflit** : si le téléphone du vendeur et le PC de la caisse vendent chacun hors ligne, leurs mouvements s'additionnent. Avec un stock « tapé », l'un écraserait l'autre.
- **Inventaire honnête** : un écart produit un mouvement « Correction inventaire » visible dans l'historique et dans les rapports (indicateur de casse, de vol ou de vente oubliée).
- **Vendre même si le système dit zéro** : le magasin a raison sur le logiciel. On prévient, on n'empêche pas. Le stock négatif sera corrigé au prochain inventaire.

## 1.5 Connexion par code PIN à 4 chiffres

Un mot de passe sur un téléphone partagé, au comptoir, avec les mains occupées, n'est pas réaliste. Chaque personne touche **son prénom** puis tape **son code à 4 chiffres** sur un grand pavé. Le bouton « Verrouiller » rend l'appareil à la personne suivante. Les connexions et déconnexions sont journalisées (§5.1.10). Les codes sont stockés sous forme d'empreinte (SHA-256 salé), jamais en clair.

## 1.6 WhatsApp comme canal de sortie

Au Bénin, WhatsApp sert de messagerie, d'annuaire et de « courrier » à la fois. L'application s'en sert sans API payante, avec des liens `wa.me` préremplis :
- envoyer le **reçu** au client ;
- envoyer un **rappel de crédit poli** (le ton est déjà rédigé, la responsable n'a qu'à appuyer sur Envoyer) ;
- **commander** à un fournisseur depuis la fiche produit ;
- partager le **fichier de sauvegarde**.

## 1.7 Pile technique

| Couche | Choix | Raison |
|---|---|---|
| Interface | React 19 + TypeScript, Vite | Écosystème le plus répandu, donc facile de trouver un développeur pour la maintenance au Bénin ou à distance |
| Données locales | IndexedDB via Dexie 4 | Base robuste dans le navigateur, requêtes réactives, plusieurs milliers de produits sans ralentir |
| Hors ligne | Service worker (vite-plugin-pwa / Workbox) | Application disponible sans réseau, mise à jour automatique |
| Icônes | lucide-react | Icônes nettes, toujours accompagnées d'un mot |
| Serveur | Node.js 22, `node:sqlite`, **zéro dépendance** | Rien à mettre à jour côté serveur hormis Node lui-même, ce qui réduit la surface d'attaque et la maintenance |
| Base serveur | SQLite (WAL) | Largement suffisant pour une boutique ; un seul fichier facile à sauvegarder ; migration vers PostgreSQL possible pour la V2 multi-boutique |
| Hébergement | Docker + Caddy (HTTPS automatique) sur un VPS | Déploiement en une commande, certificat gratuit renouvelé automatiquement |

## 1.8 Sources d'inspiration

Conformément à la demande, les maquettes existantes (ayoca-quinca.vercel.app et ayoca-quinca-mobile.vercel.app) **n'ont pas été consultées ni reprises**. La conception part uniquement du cahier des charges et du plan du magasin.
