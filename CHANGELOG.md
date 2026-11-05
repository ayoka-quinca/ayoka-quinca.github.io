# Historique des versions

## 2.1.0 (novembre 2026)

**Corrections**
- Plan du magasin net : le texte se chevauchait à cause d'un espacement de lettres hérité. Aplats opaques, noms en haut des zones à étagères, liste des zones en grandes cartes, plan à faire glisser sur téléphone.
- Paramètres : la grille débordait sur téléphone. Ils sont maintenant présentés comme les réglages d'un iPhone (liste de rubriques, une rubrique par écran ; liste + détail sur ordinateur).
- Inventaire : les zones s'affichaient sans style. Un comptage en cours est repris au lieu d'être dupliqué.

**Améliorations**
- Fournisseurs : rattacher ou retirer les produits qu'ils livrent ; raccourci « Enregistrer une livraison ».
- Inventaire : « Corriger » part du chiffre attendu, ajout d'un produit trouvé dans la zone, explications quand un inventaire validé n'est plus modifiable.
- Fiche produit : dates d'ajout, de dernière réception et de dernière vente.
- Messages d'erreur clairs partout (formulaires produit, fournisseur, réception, équipe, étagère) et filet de sécurité si un écran plante.
- Écran de chargement animé avec le logo.
- Mode clair uniquement.

## 2.0.0 (novembre 2026)

**Design**
- Nouveau design system « Comptoir » V2 : polices Plus Jakarta Sans et Instrument Serif embarquées, beaucoup plus d'espace, un seul accent orange, mode sombre revu.
- Nouveau logo (le « A » en ferme de toit, traversé d'une poutre orange) et nouvelles icônes d'application.
- Avatars par défaut (silhouette teintée).
- Nouvel écran de bienvenue, nouvel écran « Qui travaille ? », écran de démarrage.
- Accueil simplifié : Vendre, chiffre du jour, 3 raccourcis, « À surveiller », et « Pour bien démarrer » pour une boutique vide.
- Barre d'onglets flottante sur téléphone, menu groupé sur ordinateur.
- Stock : contrôle segmenté et filtres Zone / Catégorie dans une feuille, pictogramme par catégorie.

**Nouveautés**
- Journal d'activité : qui a fait quoi, quand, et ce qui a changé (avant → après).
- Détection d'anomalies, niveau 1 : actions sensibles marquées « À vérifier ».
- Factures proforma (A4, IFU / RCCM, TVA en option, montant en lettres, WhatsApp, transformation en vente).
- Paramètres : N° RCCM, nom du signataire, option TVA 18 %.

**Technique**
- Schéma local en version 2 (tables `quotes`, index du journal), migration automatique.
- Le serveur synchronise aussi les proformas.

## 1.0.0 (novembre 2026)
Première version complète : vente, stock par mouvements, plan du magasin, crédits, achats, inventaire, rapports, rôles, synchronisation hors ligne.
