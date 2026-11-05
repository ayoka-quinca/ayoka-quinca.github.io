# 5. Maintenance et feuille de route des améliorations

## 5.1 Les quatre types de maintenance

| Type | Exemple | Délai cible | Qui |
|---|---|---|---|
| **Corrective bloquante** | Impossible de vendre, synchronisation arrêtée | Contournement en moins de 4 h ouvrées, correction en moins de 24 h | Prestataire |
| **Corrective mineure** | Libellé faux, mauvais tri | Prochaine mise à jour (≤ 2 semaines) | Prestataire |
| **Préventive** | Mises à jour de sécurité, sauvegardes, renouvellement du certificat | Mensuelle | Prestataire (en grande partie automatisé) |
| **Évolutive** | Nouvelle fonctionnalité | Selon la feuille de route | Responsable + prestataire |

**Contournement en cas de panne** : l'application continue de fonctionner hors ligne sur chaque appareil, même si le serveur est arrêté. Une panne serveur ne bloque donc **jamais** les ventes : elle retarde seulement la synchronisation.

## 5.2 Routines

**Automatique (sans intervention)**
- Sauvegarde de la base serveur chaque jour, 30 jours conservés (`/data/backups`).
- Copie nocturne vers Google Drive (`deploy/backup-offsite.sh`).
- Renouvellement du certificat HTTPS (Caddy).
- Mise à jour de l'application sur les appareils au lancement suivant un déploiement.
- Alerte UptimeRobot si `/health` ne répond plus.

**Chaque soir (boutique, 10 min)** : point de caisse dans « Ventes du jour ».

**Chaque semaine (boutique)** : inventaire d'une zone, en tournant sur les 6 zones. Chaque zone est ainsi recomptée environ toutes les 6 semaines, ce qui évite le grand inventaire annuel qui paralyse le magasin.

**Chaque mois (prestataire, 1 h)**
- [ ] `apt upgrade` sur le VPS, puis `docker compose pull && docker compose up -d --build`.
- [ ] Vérifier qu'une sauvegarde de moins de 24 h existe sur Google Drive.
- [ ] Vérifier que le compteur « en attente » de chaque appareil revient à 0 (Paramètres › Synchronisation).
- [ ] Lire le journal du serveur (`docker compose logs app --since 720h | grep -i error`).
- [ ] Échange de 15 min avec la responsable : ce qui gêne, ce qui manque.

**Chaque trimestre** : **test de restauration** de la base sur une machine de test. Une sauvegarde qu'on n'a jamais restaurée n'est pas une sauvegarde.

## 5.3 Règle des sauvegardes 3-2-1

- **3 copies** : la base serveur, la copie quotidienne, la copie Google Drive. Chaque téléphone garde en plus sa propre copie locale.
- **2 supports** : le disque du VPS et le cloud Google.
- **1 hors site** : Google Drive, sur le compte de la boutique et non sur celui du prestataire.

En complément, la responsable fait **une sauvegarde manuelle par mois** (Paramètres › Sauvegarde) et l'envoie sur son propre WhatsApp.

## 5.4 Mettre à jour l'application sans casse

1. **Versionner** : chaque livraison reçoit un numéro (`1.1.0`) et une note en français simple (« Nouveau : … / Corrigé : … »), envoyée sur le groupe WhatsApp.
2. **Vérifier** avant de livrer : `npm run typecheck` puis `npm run test:e2e`, puis `tests/sync.cjs` si la synchronisation est touchée.
3. **Schéma de données** : ne jamais modifier une version Dexie existante. On ajoute `this.version(2).stores({...}).upgrade(...)`. Les champs ajoutés doivent être **optionnels**, pour que les appareils encore en ancienne version continuent de synchroniser.
4. **Déployer le soir**, après le point de caisse. Les appareils se mettent à jour à leur prochaine ouverture.
5. **Retour arrière** : `git checkout <version précédente>` puis rebuild. Les données ne sont pas touchées.

## 5.5 Indicateurs de bonne santé

| Indicateur | Où le voir | Signal d'alerte |
|---|---|---|
| Opérations en attente d'envoi | Paramètres › Synchronisation, sur chaque appareil | > 0 pendant plus de 24 h avec Internet |
| Écarts d'inventaire | Rapports › Corrections de stock | En hausse d'un mois à l'autre |
| Remises de négociation | Rapports (bandeau bleu) | > 5 % du chiffre d'affaires |
| Crédits accordés / récupérés | Rapports | Récupéré < 50 % de l'accordé sur 3 mois |
| Produits qui dorment | Rapports | Liste qui s'allonge = trésorerie immobilisée |

## 5.6 Limites connues (version 2.0)

1. La **clé de boutique** est partagée par tous les appareils, et les droits sont contrôlés dans l'application. → V3 : comptes vérifiés par le serveur.
2. La **suppression d'une catégorie vide** n'est pas propagée aux autres appareils. → V2.1.
3. L'**inventaire** corrige l'écart par rapport au stock du moment où le comptage a commencé : il faut éviter de vendre dans la zone pendant le comptage. → V2.1 : verrou de zone.
4. Les **données de démonstration** ne sont pas synchronisées (c'est voulu).
5. L'**impression** passe par la fenêtre d'impression du navigateur. → V2.1 : impression directe sur l'imprimante ticket.
6. La **forme du plan** se modifie dans le code (`seed.ts`). → V3 : éditeur de plan.
7. Le **journal d'activité** enregistre tout ce qui est fait depuis la V2. Les actions faites avec la V1 n'y figurent pas.
8. La **proforma** n'est pas une facture normalisée DGI (voir V4).

## 5.7 Feuille de route

Les priorités suivent trois critères : le gain pour la boutique, le risque réduit et l'effort. Elles sont à revalider avec la responsable après chaque version.

### ✅ V2.0 : livrée
- Design system premium (doc 02), nouveau logo, avatars par défaut, nouvel accueil et nouvel écran de bienvenue.
- **Journal d'activité** : chaque création ou modification est enregistrée avec l'auteur, la date et les valeurs avant → après. On peut filtrer par personne et chercher.
- **Détection d'anomalies, niveau 1** : les actions sensibles sont marquées « À vérifier » et remontées sur l'accueil de la responsable : vente à perte, remise de plus de 15 %, baisse de prix de plus de 10 %, prix sous le prix d'achat, vente annulée, argent rendu, perte déclarée, stock corrigé à la main, inventaire avec manquants, accès modifié.
- **Factures proforma** : devis A4 avec IFU / RCCM, TVA 18 % en option, montant en toutes lettres (« Arrêtée la présente facture proforma à la somme de… »), validité de 7, 15 ou 30 jours, envoi WhatsApp, et transformation en vente en un geste.

### V2.1 : consolider (≈ 1 mois)
- Impression directe sur l'imprimante thermique.
- Verrou de zone pendant l'inventaire, suppression synchronisée des catégories.
- Bon de commande fournisseur généré depuis « Stock bas », envoyé par WhatsApp.
- Clôture de caisse enregistrée (montant compté, écart, nom de la caissière).
- Historique des modifications directement sur la fiche de chaque produit et de chaque client.

### V3 : détection d'anomalies, niveau 2, et sécurité (≈ 2 à 3 mois)
- **Anomalies par comparaison avec l'habitude** et non plus par seuils fixes : une caissière dont les remises sont 3 fois supérieures à la moyenne, un produit dont les pertes augmentent, des ventes enregistrées après la fermeture, des annulations répétées juste après encaissement, un écart de caisse qui revient le même jour de la semaine.
- **Corrections guidées** : pour chaque anomalie, l'application propose l'action (recompter tel produit, revoir telle vente, changer tel code), et la responsable marque l'alerte « vérifiée » avec un commentaire.
- Rapport hebdomadaire « Points d'attention » envoyé à la responsable.
- Comptes vérifiés par le serveur, jetons individuels révocables.
- Étiquettes QR pour les étagères et les produits, éditeur de plan.

### V4 : facture normalisée (e-MECeF)
- Au Bénin, la DGI impose la **facture normalisée** émise via le système e-MECeF (machine ou API). L'intégration consisterait à envoyer chaque vente au service e-MECeF, à recevoir le code de sécurité et le QR code, puis à les imprimer sur le ticket et la facture.
- Prérequis : IFU de la boutique, enregistrement auprès de la DGI, jeton d'accès e-MECeF, et une **validation par un comptable** du régime fiscal de la boutique (TVA ou TPS) avant de développer.
- La proforma actuelle est déjà prévue pour : même numérotation, mêmes champs IFU / RCCM, même mise en page. La facture définitive viendra s'ajouter à côté.

### V5 : vers d'autres quincailleries (CDC §2.2)
- Multi-boutique (PostgreSQL, isolation par boutique), inscription en libre-service, paramétrage sans code.
- Paiement Mobile Money intégré (API MTN MoMo / Moov, ou agrégateurs comme FedaPay et KKiaPay).
- Interface en fon et en yoruba.

## 5.8 Contrat de maintenance conseillé

| Élément | Proposition |
|---|---|
| Canal | Groupe WhatsApp dédié + appel si blocage |
| Horaires | Lundi-samedi 8 h-19 h (horaires de la boutique) |
| Inclus | Corrections, mises à jour de sécurité, sauvegardes, 1 h de petites évolutions par mois, appel mensuel |
| Non inclus | Nouvelles fonctionnalités de la feuille de route (devis séparé), matériel |
| Documentation | Ce dossier `docs/`, tenu à jour à chaque version |
| Réversibilité | Code source et données appartiennent à AYOKA QUINCA. Export complet possible à tout moment (sauvegarde JSON, exports CSV) |
