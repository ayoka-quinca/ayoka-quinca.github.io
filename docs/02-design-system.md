# 2. Design system « Comptoir »

Un design system n'a de valeur que s'il sert **une personne précise dans une situation précise**. On commence donc par elle.

## 2.1 Pour qui ?

**Persona principal : Mme Sofiatou, 40-50 ans, responsable de la boutique**
- Smartphone Android, utilise WhatsApp, Mobile Money et Facebook au quotidien. N'a jamais utilisé de logiciel de gestion.
- Connaît son magasin par cœur, raisonne en « sacs », « barres » et « feuilles », et compte en francs CFA sans centimes.
- Négocie les prix, fait crédit aux clients fidèles et note tout dans des cahiers.
- Commence à avoir besoin de lunettes de lecture. Travaille parfois en plein soleil ou dans un entrepôt mal éclairé.

**Personas secondaires** : la **caissière** (rapidité, monnaie juste, pas d'erreur) et le **vendeur** (retrouver les produits, préparer, compter), qui sera peut-être un nouvel employé ne connaissant pas encore le magasin (§4.6 du CDC).

**Situation type** : un client est au comptoir, pressé, et demande « 20 sacs de ciment et 50 barres de 10 ». Il négocie. Il paie une partie en espèces et le reste « à la fin du mois ». La vente doit être faite en **moins de 30 secondes**.

## 2.2 Les 8 principes

| # | Principe | Concrètement dans l'application |
|---|---|---|
| 1 | **Gros et lisible** | Texte de base 17 px (au lieu de 14-16 px habituellement), montants en 24-35 px très gras, réglage A / A+ / A++ |
| 2 | **Toujours un mot à côté de l'icône** | Jamais d'icône seule pour une action. « Encaisser », « Déplacer », « Corriger » |
| 3 | **Le vocabulaire de la boutique, pas celui de l'informatique** | « Les clients me doivent », « Épuisé », « À commander », « Il paie maintenant », « Réception de marchandise », « C'est juste » |
| 4 | **Deux gestes par article** | Toucher le produit, puis toucher la quantité (raccourcis 5 / 10 / 20 / 50 adaptés à l'unité) → Ajouter |
| 5 | **Le pavé numérique plutôt que le clavier** | Quantités, prix négociés, montants reçus et codes PIN se tapent sur un pavé géant (touches de 58 px), comme sur une calculatrice |
| 6 | **On ne bloque pas, on prévient** | Vendre plus que le stock affiché est permis avec un avertissement. Le système s'adapte au magasin, pas l'inverse |
| 7 | **Annuler plutôt que confirmer** | Retirer un article ou vider le panier se fait tout de suite, avec un bouton « Annuler » pendant 5 s. Les confirmations sont réservées à ce qui est grave (annuler une vente, restaurer, tout effacer) |
| 8 | **La couleur a un sens, toujours le même** | Vert = argent reçu / valider. Ambre = attention. Rouge = manque, dette, suppression. Chaque zone du magasin a SA couleur, partout |

## 2.3 Les couleurs (tokens)

Fond **papier chaud** `#F7F4EE` plutôt que blanc pur : il éblouit moins au soleil et rappelle le cahier, ce qui rend l'outil familier. Les cartes restent blanches pour ressortir.

| Token | Clair | Sombre | Usage |
|---|---|---|---|
| `--paper` | #F7F4EE | #121513 | Fond de page |
| `--surface` | #FFFFFF | #1B1F1C | Cartes, listes |
| `--ink` | #1C1F1D | #EEF1EE | Texte principal (contraste 15:1) |
| `--ink-3` | #6F746F | #8E968F | Texte secondaire (≥ 4,5:1) |
| `--brand` | #0B6E4F | #2FA77C | Actions principales, argent encaissé |
| `--warn` | #B45309 | #F0A44B | Stock bas, monnaie à rendre |
| `--danger` | #B42318 | #F07167 | Épuisé, dettes, suppressions |
| `--accent` | #E8A317 | — | Focus clavier, journée en cours sur les graphiques |

**Couleurs des zones** (reprises sur le plan, les fiches, les tuiles de vente et les filtres) :

| Zone | Couleur | | Zone | Couleur |
|---|---|---|---|---|
| Hall d'entrée | ambre `#D9920F` | | Zone carrelage | violet `#7B4FB0` |
| Magasin principal | bleu `#2F6FB0` | | Entrepôt matériaux | brun `#8A5A2B` |
| Entrepôt ciment | gris ciment `#5B6472` | | Arrière-cour (fers) | rouille `#C2410C` |
| Espace caisse | vert `#0B6E4F` | | | |

Au bout de quelques jours, « le trait violet » veut dire « c'est au carrelage » : l'employé n'a plus besoin de lire.

Un mode sombre suit le réglage du téléphone, pour l'usage le soir et l'économie de batterie sur les écrans OLED.

## 2.4 Typographie et dimensions

- **Police système** (Roboto sur Android, Segoe UI sur Windows) : aucun téléchargement, rendu net, chiffres tabulaires pour que les montants restent alignés.
- Échelle : 17 px (texte) · 19,5 px (titre de section) · 20 à 25 px (titre de page) · 27 px (montant) · 37 px (total à payer), tout est multiplié par 1,12 en A+ et 1,24 en A++.
- **Cibles tactiles** : 48 px minimum, 56 px pour les actions principales, 64 px pour le bouton central « Vendre ».
- Espacements : grille de 4 px (8 / 12 / 16 / 20 / 24). Rayons : 10 / 14 / 20 px.
- Montants : `12 500 F` dans l'application, `12 500 FCFA` sur les factures, sans décimales.

## 2.5 Composants

| Composant | Rôle | Règles |
|---|---|---|
| **Tuile d'action** | Accueil : Nouvelle vente, Trouver un produit, Encaisser un crédit, Réception | 4 au maximum, la première en vert plein |
| **Tuile produit** | Écran Vendre | Nom en gras, dimension, prix / unité, « Reste N », liseré de la couleur de zone, pastille verte avec la quantité déjà dans le panier |
| **Feuille (sheet)** | Toute saisie secondaire | Monte du bas sur téléphone (zone du pouce), fenêtre centrée sur ordinateur. Fermeture : croix, tap à l'extérieur, touche Échap |
| **Pavé numérique** | Montants, quantités, PIN | Touches de 58 px. « 00 » pour les montants, effacement en bas à droite |
| **Stepper − / +** | Ajuster une quantité | Champ central modifiable au toucher |
| **Badge de stock** | Partout | Vert « 120 pièce » · Ambre « Stock bas · 3 » · Rouge « Épuisé » |
| **Étiquette de zone** | Partout | Carré de couleur + « Magasin principal · Étagère A » |
| **Toast** | Retour d'action | En bas, 2,6 s, ou 5 s avec bouton « Annuler » |
| **Bandeau** | Information persistante | Hors ligne, mode démonstration, écart d'inventaire |
| **Barre panier** | Vente sur téléphone | Flottante, sombre, total en grand et bouton « Encaisser » |

## 2.6 Navigation

- **Téléphone** : barre du bas à 5 entrées : Accueil · Stock · **Vendre** (bouton central surélevé) · Clients · Plus. Sur le téléphone d'un vendeur sans droit de caisse, « Clients » devient « Inventaire ».
- **Ordinateur** (≥ 960 px) : menu latéral complet, tableaux, panier toujours visible à droite de l'écran de vente.
- Retour en haut à gauche, titre de la page au centre de l'attention, action principale en haut à droite.

## 2.7 Parcours clés et nombre de gestes

| Parcours | Gestes | Détail |
|---|---|---|
| Vente simple au comptant, 1 article | 5 | Vendre → produit → Ajouter → Encaisser → Valider (+1 geste pour choisir la quantité) |
| Vente « 20 sacs + 50 barres » à crédit avec avance | 13 | dont 3 pour l'avance et 2 pour choisir le client |
| Savoir où est un produit | 2 + saisie | Accueil → Trouver un produit → fiche avec plan surligné |
| Enregistrer un remboursement de crédit | 4 | Clients → client → Il paie maintenant → « Tout » → Enregistrer |
| Compter une zone sans écart | 1 par produit | « C'est juste (64) » |

## 2.8 Accessibilité et confort

- Contraste AA partout, AAA pour les montants.
- Focus clavier visible (contour ambre de 3 px) pour l'usage au PC.
- `aria-label` sur tous les boutons d'icône, `role="dialog"` sur les feuilles, annonces `aria-live` pour les toasts.
- Recherche **tolérante** : sans accents, sans majuscules, mots dans n'importe quel ordre (« fer 10 » trouve « Fer à béton 10 mm »).
- Pas d'animation superflue : seulement l'apparition des feuilles (200 ms) et la secousse en cas de code faux.

## 2.9 Règles de rédaction

- Tutoiement : non. Vouvoiement simple et chaleureux : « Tapez votre code secret ».
- Phrases courtes, verbe d'action en premier : « Valider la vente », « Déplacer 5 sac ».
- Dire ce qui va se passer, surtout pour l'argent : « C'est plus que la dette : 2 000 F sera gardé en avoir. »
- Jamais de message d'erreur technique à l'écran.

## 2.10 Liste de contrôle pour tout nouvel écran

- [ ] L'action principale est-elle évidente, en vert, à portée de pouce ?
- [ ] Chaque icône a-t-elle son mot ?
- [ ] Les nombres se saisissent-ils au pavé numérique ?
- [ ] Le texte reste-t-il lisible en A++ sans casser la mise en page ?
- [ ] L'écran fonctionne-t-il sans Internet ?
- [ ] Une erreur de manipulation peut-elle être annulée ?
- [ ] La couleur de zone est-elle visible quand un produit est affiché ?
- [ ] Testé sur un téléphone 360 px de large et sur un PC 1366 px ?
