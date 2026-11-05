# 2. Design system « Comptoir », version 2

La version 1 était lisible mais trop dense : trop de bordures, trop d'informations par écran, des polices système sans caractère. La version 2 garde la même base d'accessibilité et change de niveau de finition.

**Inspirations** : les principes d'Apple (*Human Interface Guidelines* : clarté, profondeur, le contenu d'abord) et les sites primés sur Awwwards (typographie expressive, blancs généreux, un seul accent). Elle reste pensée pour les mêmes personnes : une responsable d'une quarantaine d'années, une caissière, un vendeur, sur un Android d'entrée de gamme, souvent en plein jour.

## 2.1 Les 6 règles

| # | Règle | Ce que ça change à l'écran |
|---|---|---|
| 1 | **Un écran = une intention** | L'accueil ne montre plus que 4 blocs : le bouton Vendre, le chiffre du jour, 3 raccourcis, « À surveiller ». Le détail est un geste plus loin |
| 2 | **De l'air partout** | Marges de 20 à 24 px, cartes de 20 px, lignes de liste de 68 px, pas de bordure épaisse : ce sont l'ombre douce et l'espace qui séparent |
| 3 | **Deux polices, deux rôles** | *Plus Jakarta Sans* pour tout ce qu'on lit et touche. *Instrument Serif* (italique orange) seulement pour les grands titres d'accueil : une touche éditoriale, jamais pour lire un chiffre |
| 4 | **Un seul accent** | L'**orange Ayoka** (le chantier, l'outil) signale l'action principale : Vendre, Encaisser, Ajouter. Le **noir graphite** porte les autres actions. Vert, ambre et rouge ne parlent que d'état |
| 5 | **On reconnaît avant de lire** | Chaque produit a un pictogramme de sa catégorie (sac, fer, carreau, prise, cadenas…) teinté de la couleur de sa zone |
| 6 | **Toujours accessible** | Texte de base 17 px (réglable A / A+ / A++), cibles ≥ 48 px, contraste AA minimum, AAA sur les montants. **Mode clair uniquement** (choix de la boutique, V2.1) |

## 2.2 Identité

**Logo** : un « A » dessiné comme une ferme de toit (deux chevrons), traversé par une poutre orange, sur un carré graphite aux angles adoucis, comme une icône d'application. On y lit à la fois la lettre, le bâtiment et l'outil. Fichier : `app/public/icon.svg`, composant `LogoMark` dans `app/src/ui/Brand.tsx`.

**Signature** : « AYOKA QUINCA » en capitales espacées, avec la ligne « Quincaillerie · Sèmè-Podji ».

**Avatars** : une silhouette par défaut, teintée de la couleur de la personne. Il n'y a ni photo à gérer ni initiale à deviner.

## 2.3 Couleurs (tokens)

| Token | Valeur | Rôle |
|---|---|---|
| `--bg` | #F5F4F2 | Fond de page, gris neutre très légèrement chaud |
| `--surface` | #FFFFFF | Cartes, listes, feuilles |
| `--surface-2` | #EFEEEB | Champs, capsules, boutons secondaires |
| `--ink` | #141414 | Texte et boutons principaux |
| `--ink-3` | #8A8782 | Texte secondaire |
| `--accent` | #F0601B | Orange Ayoka : action principale |
| `--accent-ink` | #B8410A | Orange lisible en texte (≥ 4,5:1) |
| `--ok` / `--warn` / `--danger` | #12804C / #A96300 / #CF2A20 | États : payé / attention / manque, dette |

Les **couleurs des zones** du magasin ne changent pas (ambre pour le hall, bleu pour le magasin principal, gris ciment, violet carrelage, brun matériaux, rouille arrière-cour). Elles teintent désormais les pictogrammes produits.

## 2.4 Typographie

| Usage | Police | Taille / graisse |
|---|---|---|
| Grand titre d'accueil | Instrument Serif | 40 à 70 px, regular, mot clé en *italique orange* |
| Titre de page | Plus Jakarta Sans | 24 à 30 px, 750, interlettrage −0,025 em |
| Montant principal | Plus Jakarta Sans | 44 px, 750, chiffres tabulaires |
| Texte | Plus Jakarta Sans | 17 px, 450 |
| Sur-titre (« AUJOURD'HUI ») | Plus Jakarta Sans | 13 px, 700, capitales espacées |

Les polices sont **embarquées dans l'application** (paquets `@fontsource`) : elles s'affichent aussi hors ligne et ne dépendent d'aucun serveur externe.

## 2.5 Composants revus

| Composant | V1 | V2 |
|---|---|---|
| Barre de navigation (téléphone) | Barre pleine largeur collée en bas | **Capsule flottante translucide**. L'onglet actif est sur fond doux, « Vendre » est une pastille orange |
| Menu (ordinateur) | Liste unique de 11 entrées | Bouton orange « Nouvelle vente » puis 3 groupes : *Au quotidien*, *Magasin*, *Pilotage* |
| Filtres du stock | Rangée de 9 capsules qui défilait | **Contrôle segmenté** (Tous / Stock bas / Épuisés) + 2 boutons « Zone » et « Catégorie » qui ouvrent un choix |
| Capsules de catégories | Bordure, fond blanc | Sans bordure, fond doux, **fondu sur le bord** pour indiquer qu'on peut faire défiler |
| Tuile produit | Liseré coloré, beaucoup de texte | Pictogramme, nom, prix en grand, « 46 en stock » |
| Saisie de montant | Champ encadré | **Grand chiffre souligné**, comme sur un reçu |
| Feuilles | Bord bas, ombre forte | Coins de 28 px, flou d'arrière-plan, animation douce |
| Boutons | Rectangles à bordure | **Pilules** pleines : orange (action principale), graphite (validation), gris doux (secondaire) |

## 2.6 Écrans clés

- **Bienvenue** : « Fini les cahiers. *Votre boutique*, en un coup d'œil. » Quatre promesses simples (vendre en deux gestes, savoir où est chaque produit, suivre qui vous doit quoi, rien ne se perd). Sur ordinateur, un panneau sombre montre le vrai plan du magasin.
- **Qui travaille ?** : de grandes cartes avec avatar, puis le code sur un pavé numérique.
- **Accueil** : salutation, bouton Vendre, carte sombre « Aujourd'hui » avec les 7 derniers jours, 3 raccourcis, « À surveiller ». Pour une boutique vide, une liste « Pour bien démarrer » en 3 étapes.

## 2.7 Messages d'erreur

- Un bouton n'est plus grisé sans explication. Si on touche « Enregistrer » et qu'il manque quelque chose, un encadré rouge **liste ce qui manque et comment le corriger** (« Indiquez le prix de vente. », « Ce fournisseur existe déjà dans la liste. »).
- Les erreurs techniques sont traduites en phrases claires, avec la marche à suivre (« La mémoire du téléphone est pleine. Libérez de la place puis réessayez : rien n'a été enregistré. »).
- Si un écran plante, une carte explique que les données ne sont pas perdues et propose de revenir à l'accueil, au lieu d'une page blanche.

## 2.8 Chargement

Au lancement, le « A » du logo se dessine, la poutre orange se pose, puis « AYOKA QUINCA » et « La quincaillerie, sans cahier. » apparaissent (environ 2 secondes, une fois par session).

## 2.9 Mouvement

- Les pages glissent de 10 px en 0,4 s. Le contenu n'est **jamais invisible** pendant l'animation.
- Les feuilles montent en 0,32 s avec une courbe douce. Les boutons se compriment légèrement au toucher.
- Tout s'arrête si le téléphone demande moins d'animations (`prefers-reduced-motion`).

## 2.10 Vocabulaire

On garde les mots de la boutique : « Les clients me doivent », « Il paie maintenant », « Le client achète », « Bientôt fini », « Stock bas », « C'est juste », « Réception ». Jamais de jargon informatique.

## 2.11 Liste de contrôle pour tout nouvel écran

- [ ] Une seule action principale, en orange, à portée de pouce.
- [ ] Moins de 5 blocs visibles sans faire défiler.
- [ ] Chaque icône a son mot.
- [ ] Les nombres se saisissent au pavé numérique et s'affichent en grand.
- [ ] Lisible en A++.
- [ ] Si quelque chose manque, un message dit quoi et comment corriger (jamais un bouton grisé sans explication).
- [ ] Fonctionne sans Internet.
- [ ] Testé à 360 px et à 1366 px de large.
