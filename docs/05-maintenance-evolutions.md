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

## 5.6 Limites connues de la version 1.0

Ces points sont connus et assumés. Ils sont classés dans la feuille de route ci-dessous.

1. La **clé de boutique** est partagée par tous les appareils et les droits sont contrôlés dans l'application. → V1.5 : comptes vérifiés par le serveur.
2. La **suppression d'une catégorie vide** n'est pas propagée aux autres appareils (les autres données utilisent l'archivage). → V1.1.
3. L'**inventaire** corrige l'écart par rapport au stock du moment où le comptage a commencé. Il faut donc éviter de vendre dans la zone pendant qu'on la compte. → V1.1 : verrou de zone pendant le comptage.
4. Les **données de démonstration** ne sont pas synchronisées (c'est voulu). Il faut faire « Effacer les exemples et commencer » avant la mise en service.
5. L'**impression** passe par la fenêtre d'impression du navigateur. → V1.1 : impression directe ESC/POS (Web Bluetooth / Web Serial).
6. La **forme du plan** (murs, position des étagères) se modifie dans le code (`seed.ts`). Les étagères ajoutées depuis l'application apparaissent dans les listes, mais pas sur le dessin. → V1.5 : éditeur de plan.
7. **Pas de lecteur de code-barres** : beaucoup d'articles de quincaillerie n'en ont pas. → V1.5 : étiquettes QR imprimées pour les étagères et les produits.

## 5.7 Feuille de route

Les priorités suivent trois critères : le gain pour la boutique, le risque réduit et l'effort. Elles sont à revalider avec la responsable au bilan des 30 jours.

### V1.1 : consolider (mois 2)
- Impression directe sur l'imprimante thermique, sans fenêtre de dialogue.
- Verrou de zone pendant l'inventaire et suppression synchronisée des catégories.
- **Bon de commande fournisseur** généré depuis la liste « À commander », envoyé par WhatsApp.
- **Clôture de caisse** enregistrée (montant compté, écart, signature de la caissière).
- Raccourci « Revendre la même chose » depuis l'historique d'un client (maçons et chantiers récurrents).

### V1.5 : sécuriser et accélérer (mois 3 à 4)
- Authentification par utilisateur côté serveur (jetons individuels révocables) et droits vérifiés par le serveur.
- **Étiquettes QR** d'étagères et de produits : on scanne avec l'appareil photo pour trouver, compter ou vendre.
- Éditeur de plan (déplacer et dessiner les étagères au doigt).
- **Rappels de crédit automatiques** proposés chaque lundi (liste des clients à relancer, message prêt).
- **Devis / proforma** convertible en vente (très demandé par les clients professionnels et les chantiers).
- Rapport mensuel PDF envoyé automatiquement à la responsable.

### V2 : vers une solution pour d'autres quincailleries (CDC §2.2 « Évolutivité »)
- **Multi-boutique** : un serveur, plusieurs boutiques isolées (identifiant de boutique sur chaque enregistrement, PostgreSQL), inscription en libre-service.
- Paramétrage complet sans code : zones et plan, unités, taxes, modèle de facture.
- Paiement Mobile Money **intégré** (API MTN MoMo / Moov, ou agrégateurs comme FedaPay ou KKiaPay) pour encaisser et rapprocher automatiquement.
- Facturation normalisée si la réglementation l'exige (e-MECeF de la DGI au Bénin) : à étudier avec un comptable avant de commercialiser.
- Langues : interface en fon et en yoruba (libellés et messages vocaux) pour les employés moins à l'aise avec l'écrit.
- Modèle économique possible : abonnement mensuel modeste par boutique, avec installation et formation payées à part.

## 5.8 Contrat de maintenance conseillé

| Élément | Proposition |
|---|---|
| Canal | Groupe WhatsApp dédié + appel si blocage |
| Horaires | Lundi-samedi 8 h-19 h (horaires de la boutique) |
| Inclus | Corrections, mises à jour de sécurité, sauvegardes, 1 h de petites évolutions par mois, appel mensuel |
| Non inclus | Nouvelles fonctionnalités de la feuille de route (devis séparé), matériel |
| Documentation | Ce dossier `docs/`, tenu à jour à chaque version |
| Réversibilité | Code source et données appartiennent à AYOKA QUINCA. Export complet possible à tout moment (sauvegarde JSON, exports CSV) |
