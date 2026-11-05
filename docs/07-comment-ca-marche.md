# 7. Comment ça marche : les règles de l'application expliquées simplement

Ce guide explique ce que fait l'application et pourquoi certaines choses sont volontairement bloquées.

## 7.1 Un produit

Une fiche produit contient :

| Information | Exemple | À quoi ça sert |
|---|---|---|
| Nom | Fer à béton 10 mm | Ce que le client demande. Une fiche par variante (8 mm, 10 mm…) |
| Catégorie | Fer à béton | Ranger, filtrer, choisir le pictogramme |
| Dimensions | 12 m | Information affichée sur la fiche et la proforma |
| Unité de vente | barre | Ce qu'on compte : sac, barre, m², feuille, pièce… |
| Prix de vente / prix d'achat | 3 900 F / 3 500 F | Le prix d'achat sert au bénéfice. Seule la responsable le voit |
| Prix de gros | dès 50 barres → 3 800 F | Appliqué tout seul selon la quantité |
| **Où il est rangé** | Arrière-cour | La zone ou l'étagère où l'on va le chercher en premier |
| Seuil d'alerte | 40 | En dessous, le produit passe en « Stock bas » |
| Fournisseurs | Fer & Acier du Golfe | Qui appeler pour recommander |
| Quantité en stock aujourd'hui | 260 | **Seulement à la création** : c'est le stock de départ |

**Les dates** : l'application enregistre toute seule la date d'ajout du produit, la date de chaque réception fournisseur et celle de chaque vente. La fiche affiche la date d'ajout, la dernière réception et la dernière vente. Il n'y a donc aucune date à taper.

**Pourquoi on ne peut pas taper le stock après la création ?** Parce que le stock est **calculé** : stock de départ + réceptions − ventes + retours ± corrections. C'est ce qui permet de savoir à tout moment pourquoi le chiffre a bougé et qui l'a fait bouger. Pour changer un chiffre faux, il y a trois chemins tracés au journal :
- **Corriger** sur la fiche du produit (responsable), avec une explication obligatoire ;
- **Inventaire** de la zone ;
- **Réception** de marchandise pour une livraison.

## 7.2 Les emplacements

- Le magasin compte **6 zones de stockage + la caisse**, d'après le plan : Hall d'entrée, Magasin principal, Entrepôt ciment, Zone carrelage, Entrepôt matériaux, Arrière-cour.
- Une zone peut contenir des **étagères** (Étagère A, Présentoir 1, Carton raccords 32…). On en ajoute depuis le **Plan du magasin** › une zone › « Ajouter une étagère ici ».
- Un produit a **un emplacement principal**. Mais son stock peut être réparti : 150 sacs à l'entrepôt ciment et 10 dans le hall, par exemple. Le bouton **Déplacer** sur la fiche transfère une quantité d'un endroit à l'autre ; la fiche montre la répartition et le plan s'allume aux bons endroits.
- À la vente, l'application retire d'abord le stock de l'emplacement principal, puis des autres.

## 7.3 L'inventaire

1. Inventaire › touchez une zone. L'application liste les produits rangés dans cette zone ou qui y ont du stock, avec **le chiffre que le système attend**.
2. Pour chaque produit :
   - le chiffre est bon → **C'est juste** ;
   - il est faux → **Corriger**, puis réglez la quantité vue avec − / + ou en la tapant.
3. Un produit trouvé là alors qu'il n'est pas dans la liste → **« J'ai trouvé un produit qui n'est pas dans la liste »**.
4. On peut s'arrêter et revenir plus tard : tout est enregistré au fur et à mesure. Retoucher la même zone **reprend** le comptage en cours.
5. **Terminer et corriger le stock** (responsable seulement) : les écarts deviennent des corrections de stock, visibles au journal.

**Pourquoi un inventaire validé ne se modifie plus ?** Parce que le stock a déjà été corrigé avec ses chiffres. Le modifier après coup ferait un double comptage. Pour rectifier, on lance un nouvel inventaire de la zone ou on corrige le produit depuis sa fiche. C'est volontaire, et l'écran l'explique.

**Pourquoi le vendeur ne peut pas valider ?** Il peut compter, mais la validation change le stock et donc la valeur de la boutique : elle est réservée à la responsable.

## 7.4 Les fournisseurs

- **Fournisseurs** › « + Fournisseur » : nom, téléphone, adresse. Après l'enregistrement, sa fiche s'ouvre : touchez **Ajouter** pour cocher les produits qu'il vous livre. On peut aussi les retirer.
- Le lien se fait aussi dans l'autre sens : sur une fiche produit (Modifier › Fournisseurs).
- À chaque **réception de marchandise**, le fournisseur est automatiquement rattaché aux produits livrés, et le prix d'achat est mis à jour si vous le souhaitez.
- Quand un produit passe en « Stock bas », sa fiche propose de **commander par WhatsApp** au fournisseur.

## 7.5 Les ventes, crédits et proformas

- **Vente** : produit → quantité → Encaisser → mode de paiement. Le stock baisse, la caisse du jour augmente.
- **À crédit** : le client est obligatoire ; une avance est possible. Le reste s'ajoute à ce qu'il doit.
- **Proforma** : un devis. Il ne touche **ni au stock ni à la caisse**. « Le client achète » le transforme en vente au même prix.
- **Retour** : depuis la vente, on indique ce qui revient. Le stock remonte ; la dette baisse ou l'application dit combien rendre.

## 7.6 Ce que l'application empêche, et pourquoi

| Situation | Ce qui se passe | Pourquoi |
|---|---|---|
| Enregistrer un produit sans prix de vente | Message « Indiquez le prix de vente » | Sans prix, impossible de vendre |
| Prix de vente sous le prix d'achat | Message, enregistrement refusé | Presque toujours une faute de frappe |
| Deux produits ou deux fournisseurs au même nom | Message | Éviter les doublons |
| Vente à crédit sans client | Le bouton demande de choisir le client | Il faut savoir qui doit |
| Vendre plus que le stock affiché | **Autorisé**, avec un avertissement | Le magasin a raison sur le logiciel ; l'écart sera corrigé à l'inventaire |
| Modifier un inventaire validé | Bloqué, avec explication | Éviter un double comptage |
| Caisse ou vendeur qui veut voir les bénéfices | Page réservée | Confidentialité des marges |
| Retirer le dernier compte responsable | Message | Il faut toujours quelqu'un pour administrer |

Tout ce qui est fait (ventes, prix modifiés, corrections, connexions) est inscrit au **Journal d'activité** avec l'auteur et l'heure. Les actions sensibles y sont marquées « À vérifier ».
