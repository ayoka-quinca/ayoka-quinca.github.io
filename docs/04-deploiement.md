# 4. Stratégie de déploiement : de la démo à l'outil du quotidien

**Objectif** : en **6 semaines**, AYOKA QUINCA abandonne les cahiers, avec un stock de départ juste et une équipe à l'aise.

**Principe** : le risque d'un tel projet n'est pas technique, il est **humain** (l'équipe n'adopte pas l'outil) et **lié aux données** (un stock de départ faux, et l'équipe perd confiance dès la première semaine). Le plan consacre donc plus de temps à la saisie initiale et à l'accompagnement qu'à l'installation.

```
Semaine  1          2          3          4          5          6
         ├─ Phase 0 ┤
         │ Matériel, serveur
         └──────────├── Phase 1 ──────────┤
                    │ Catalogue + comptage par zone
                    │          ├ Phase 2 ┤ Formation
                    │                     ├──── Phase 3 ────┤
                    │                     │ Pilote : appli + cahier en parallèle
                    │                                       ├ Phase 4 ┤
                    │                                       │ Bascule, cahiers rangés
```

---

## Phase 0 : préparer le matériel et le serveur (semaine 1)

### 0.1 Matériel recommandé

Ordres de grandeur à confirmer auprès des fournisseurs de Cotonou.

| Matériel | Rôle | Conseil | Budget indicatif |
|---|---|---|---|
| 1 PC (existant ou portable d'occasion) | Caisse + administration | Windows 10/11 ou Linux, navigateur Chrome ou Edge, 4 Go de RAM | 0 à 200 000 F |
| 1 à 2 smartphones Android | Vendeur, inventaire, responsable | Android 9 ou plus, 3 Go de RAM, bon écran | 60 000 à 90 000 F pièce |
| Imprimante ticket thermique 80 mm | Reçus | USB pour le PC ou Bluetooth pour un téléphone. Tester la compatibilité Android avant l'achat | 35 000 à 60 000 F |
| Onduleur 650 VA | PC + box pendant les coupures | Indispensable pour la caisse | 35 000 à 50 000 F |
| Box ou clé 4G (MTN ou Moov) | Synchronisation | Un petit forfait suffit : l'application consomme quelques Mo par jour | forfait mensuel |
| Rouleaux thermiques 80 mm | — | Stock de 10 rouleaux | — |

### 0.2 Mettre le serveur en ligne (variante A recommandée : VPS)

**Prérequis** : un VPS Linux (Ubuntu 24.04, 1 vCPU, 2 Go, environ 4 à 6 €/mois soit 2 600 à 4 000 F, chez Hetzner, OVHcloud ou Contabo) et un nom de domaine (≈ 8 000 F/an pour un `.com`, davantage pour un `.bj`).

1. **DNS** : créer un enregistrement `A` `gestion.ayokaquinca.com` qui pointe vers l'adresse IP du VPS.
2. **Installer Docker** sur le VPS :
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
3. **Récupérer le code** :
   ```bash
   git clone <url-du-depot> /opt/ayoka-quinca
   ```
4. **Configurer** :
   ```bash
   cd /opt/ayoka-quinca/deploy && cp .env.example .env
   ```
   Renseigner `DOMAIN`, puis générer la clé avec `openssl rand -hex 16` et la copier dans `SHOP_TOKEN`.
5. **Lancer** :
   ```bash
   docker compose -f /opt/ayoka-quinca/deploy/docker-compose.yml up -d --build
   ```
6. **Vérifier** : `https://gestion.ayokaquinca.com/health` doit répondre `{"ok":true,…}`.
7. **Pare-feu** : n'ouvrir que les ports 22, 80 et 443 (`ufw allow 22,80,443/tcp && ufw enable`).
8. **Copie hors site** : configurer `rclone` vers le Google Drive de la boutique, puis ajouter la ligne cron indiquée dans `deploy/backup-offsite.sh`.
9. **Surveillance** : créer une alerte gratuite UptimeRobot sur `/health`, avec notification par e-mail ou Telegram au prestataire.

> La construction de l'image Docker n'a pas pu être testée dans l'environnement de développement (pas de démon Docker). Le serveur lui-même a été testé : il sert l'application et synchronise deux appareils. Faire un premier `docker compose up` de recette avant la phase 1.

**Variante B, serveur dans le magasin** : sur un mini-PC branché à l'onduleur, installer Node.js 22, construire l'application (`npm ci && npm run build` dans `app/`) puis lancer `SHOP_TOKEN=… node server/index.mjs`, sous systemd. Les téléphones s'y connectent par le Wi-Fi local. Le HTTPS est indispensable pour le mode hors ligne : il faut un certificat local (Caddy `tls internal`) installé sur chaque appareil. C'est plus fragile, à réserver au cas où Internet serait vraiment inutilisable.

**Variante C, sans serveur, pour démarrer tout de suite** : on met seulement l'application en ligne, gratuitement, chez un hébergeur de sites (Vercel, Netlify ou Cloudflare Pages) : il suffit d'y déposer le dossier `app/dist`. Chacun l'ouvre et l'installe depuis un lien, mais **chaque appareil garde ses propres données** : un téléphone et le PC ne se voient pas. C'est utile pour démarrer avec **un seul appareil** (par exemple le PC de la caisse) avant que le serveur soit prêt, avec une sauvegarde manuelle chaque semaine. Le jour où le serveur (variante A) arrive, on le renseigne dans Paramètres › Synchronisation et toutes les données partent vers lui.

### 0.3 Installer l'application sur chaque appareil

1. Ouvrir l'adresse dans **Chrome** (Android) ou **Edge/Chrome** (PC).
2. Menu ⋮ → **« Installer l'application »** ou « Ajouter à l'écran d'accueil ».
3. **Premier appareil (PC de la responsable)** : « Commencer avec ma boutique », saisir son prénom et son code, puis Paramètres › Synchronisation : saisir l'adresse et la clé.
4. **Autres appareils** : « Cet appareil rejoint une boutique déjà installée » avec la même adresse et la même clé.
5. Paramètres › Équipe : créer la caissière et le vendeur, chacun avec son code.
6. Paramètres › Entreprise : vérifier l'en-tête des factures (ajouter le numéro **IFU** si la boutique en a un).
7. Faire un **ticket de test** sur l'imprimante (marges, largeur 80 mm).

**Critère de sortie de la phase 0** : 3 appareils connectés, une vente test faite sur le téléphone qui apparaît sur le PC, un ticket imprimé.

---

## Phase 1 : le catalogue et le stock de départ (semaines 2 et 3)

C'est **la phase la plus importante**. Un stock faux le premier jour détruit la confiance.

1. **Vérifier les zones** sur le Plan du magasin. Ajouter les étagères, rayons ou cartons réels (« Étagère A », « Carton raccords 32 »…).
2. **Liste des produits** : à partir des cahiers d'achat et des factures fournisseurs, remplir le **modèle Excel** (Paramètres › Importer › Télécharger le modèle) : nom, catégorie, dimensions, unité, prix d'achat, prix de vente, emplacement, seuil d'alerte. *Conseil* : une ligne par variante (fer de 8, fer de 10…), car c'est ce que le client demande.
3. **Comptage zone par zone**, magasin fermé, une zone par demi-journée. On écrit la quantité dans la colonne `stock`. Ordre conseillé : ciment et arrière-cour (peu de références, grosses valeurs) → carrelage → matériaux → hall → magasin principal (le plus long).
4. **Importer** le fichier (Paramètres › Importer un fichier CSV). Corriger les lignes signalées.
5. **Contrôle** : choisir 20 produits au hasard et comparer l'application et la réalité. Si plus de 2 écarts, recompter la zone concernée.
6. **Clients à crédit existants** : créer chaque client débiteur, puis sur sa fiche toucher **« Reprendre une dette du cahier »** et saisir le montant inscrit. Le solde de départ est juste, sans fausse vente ni mouvement d'argent dans la caisse.

**Critère de sortie** : 100 % des références saisies, contrôle aléatoire réussi, soldes des crédits égaux à ceux du cahier.

---

## Phase 2 : former l'équipe (semaine 3)

Former **par rôle**, sur **les vrais produits**, en **petites séances** de 45 min maximum, sur l'appareil que chacun utilisera.

| Séance | Pour qui | Contenu | Exercice réussi si… |
|---|---|---|---|
| 1 | Tous | Ouvrir l'application, son code, Verrouiller, chercher un produit, lire le plan et les couleurs | chacun retrouve 5 produits tirés au sort |
| 2 | Caisse + responsable | Vente comptant, quantité, prix négocié, monnaie, Mobile Money, ticket, WhatsApp | 5 ventes sans aide, en moins de 30 s chacune |
| 3 | Caisse + responsable | Vente à crédit, avance, encaisser un remboursement, retour d'article, point de caisse du soir | le point de caisse tombe juste |
| 4 | Vendeur | Déplacer un produit, compter une zone (« C'est juste ») | une étagère comptée sans erreur |
| 5 | Responsable | Réception fournisseur, nouveau produit, corriger le stock, valider un inventaire, rapports, sauvegarde | une livraison réelle saisie seule |

Remettre à chacun la **fiche mémo** de son rôle (doc 06), imprimée et plastifiée près de la caisse.

Pendant la formation, utiliser le **mode démonstration** sur un appareil à part (« Essayer avec des exemples ») pour s'entraîner sans risque.

---

## Phase 3 : pilote en double saisie (semaines 4 et 5)

Pendant **deux semaines**, on utilise l'application **et** le cahier.

- **Chaque soir (10 min)** : comparer le point de caisse de l'application (Ventes du jour) avec l'argent du tiroir et le cahier. Noter les écarts et leur cause (oubli, erreur de saisie, mauvaise manipulation).
- **Chaque vendredi** : inventaire d'**une** zone. Les écarts doivent diminuer d'une semaine à l'autre.
- **Point hebdomadaire de 30 min** avec le prestataire : problèmes rencontrés, réglages (seuils d'alerte, droits, raccourcis de quantité), questions.
- Le prestataire reste joignable sur un **groupe WhatsApp « Ayoka Quinca – Appli »**.

**Critères de passage (go / no-go)**

| Indicateur | Seuil pour basculer |
|---|---|
| Point de caisse juste | 5 soirs de suite sans écart inexpliqué |
| Ventes saisies dans l'application | 100 % des ventes du cahier retrouvées |
| Écart d'inventaire hebdomadaire | moins de 2 % des références de la zone comptée |
| Autonomie | aucune question bloquante depuis 3 jours |
| Sauvegarde | une restauration de test réussie sur un appareil de démonstration |

---

## Phase 4 : bascule (semaine 6)

1. Le lundi, **on range les cahiers** (sans les jeter : on les garde 1 an).
2. Inventaire complet d'un samedi pour repartir de chiffres justes.
3. La responsable consulte l'Accueil chaque matin (ventes de la veille, liste « À commander », crédits).
4. **Premier bilan à 30 jours** : rapport du mois, produits qui dorment, meilleurs clients, crédits récupérés. C'est aussi le moment de faire la liste des évolutions souhaitées (doc 05).

---

## Récapitulatif des responsabilités

| Qui | Fait quoi |
|---|---|
| Prestataire / développeur | Serveur, installation des appareils, import, formation, suivi du pilote, maintenance |
| Mme MOURITALA (responsable) | Valide les prix et le catalogue, crée les comptes, valide les inventaires, décide de la bascule |
| Caissière | Saisit toutes les ventes et les paiements, fait le point de caisse du soir |
| Vendeur | Participe au comptage, signale les produits mal rangés ou introuvables |

## Risques et parades

| Risque | Probabilité | Parade |
|---|---|---|
| L'équipe revient au cahier | Moyenne | Double saisie limitée à 2 semaines, point du soir, gestes réduits au minimum |
| Stock de départ faux | Élevée sans méthode | Comptage par zone magasin fermé, contrôle aléatoire, inventaires hebdomadaires pendant le pilote |
| Coupure Internet prolongée | Élevée | Mode hors ligne complet ; tout part au retour du réseau |
| Coupure de courant | Élevée | Onduleur pour le PC ; les téléphones continuent sur batterie |
| Téléphone perdu ou cassé | Moyenne | Données sur le serveur ; on réinstalle en « rejoindre la boutique » en 2 minutes |
| Imprimante incompatible | Moyenne | Tester avant d'acheter ; à défaut, reçu par WhatsApp |
| Oubli du code PIN | Élevée | La responsable le réinitialise dans Paramètres › Équipe |
