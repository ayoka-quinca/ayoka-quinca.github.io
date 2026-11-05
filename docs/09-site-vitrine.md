# 9. Module 3 : le site vitrine et son assistant

**Adresse** : https://ayoka-quinca.github.io
**Dossier** : `site/`
**Pour qui** : les clients (particuliers, maçons, plombiers, entreprises) qui veulent savoir ce que la boutique vend, où elle se trouve, et commander sans se déplacer.

## 9.1 Ce que le site permet

| Section | Contenu |
|---|---|
| Accueil | « Tout pour bâtir, *à deux pas* de chez vous. » Raccourcis vers les grandes familles de produits, bouton WhatsApp |
| Nos produits | Catalogue avec recherche (« fer 10 », « coude »), familles, « Les plus demandés ». Chaque produit s'ajoute à la commande, avec la quantité |
| Comment commander | Les 3 étapes : choisir, envoyer sur WhatsApp, récupérer |
| La boutique | Présentation, les six espaces du magasin (plan), conseil, prix de gros, devis |
| Nous trouver | Adresse et itinéraire Google Maps, horaires, téléphone, e-mail, WhatsApp, questions fréquentes |
| Ma commande | Liste modifiable, nom, quartier, retrait ou livraison, précision → **message WhatsApp prêt à envoyer** |
| Assistant | Répond tout de suite aux questions courantes et rédige le message WhatsApp si besoin |
| Espace équipe | Lien discret en bas de page vers l'application de gestion (`/gestion/`) |

## 9.2 Le parcours de commande

1. Le client ajoute des produits (bouton **Ajouter**, puis − / + ou en tapant la quantité).
2. **Ma commande** › il indique son nom (obligatoire), son quartier, retrait ou livraison.
3. **Envoyer sur WhatsApp** : WhatsApp s'ouvre avec ce message, il n'a plus qu'à appuyer sur Envoyer :

```
Bonjour AYOKA QUINCA 👋
Je souhaite commander :
• 20 sac · Ciment CPJ 35 (50 kg)
• 50 barre · Fer à béton 10 mm (12 m)

Nom : Koffi
Quartier / chantier : Ekpè
Je passe récupérer au magasin

Merci de me confirmer la disponibilité et le prix.
```

La commande est gardée dans le navigateur du client : s'il ferme la page, il la retrouve. Le nom et le quartier sont aussi retenus pour la fois suivante. **Rien n'est envoyé ailleurs que sur WhatsApp.**

**Pourquoi WhatsApp plutôt qu'un paiement en ligne ?** Les prix se négocient selon la quantité, et les clients ont l'habitude d'écrire à la boutique. WhatsApp ne demande ni serveur, ni compte client, ni frais. La boutique répond avec son téléphone, comme aujourd'hui.

## 9.3 Modifier le contenu, sans développeur

Tout se trouve dans deux fichiers. On peut les modifier directement sur GitHub (ouvrir le fichier › crayon ✏️ › **Commit changes**). Le site est remis à jour en 1 à 2 minutes.

**`site/data/config.json`** contient les informations de la boutique :

| Champ | Exemple | Remarque |
|---|---|---|
| `telephone` | `01 96 42 52 81` | Affiché tel quel |
| `whatsapp` | `2290196425281` | Indicatif 229 + numéro, **sans espace ni +** |
| `horaires` | Lundi – Samedi · 8 h 00 – 19 h 00 | ⚠️ **À confirmer avec la boutique** (valeur provisoire) |
| `paiements` | Espèces, MTN MoMo, Moov Money | Utilisé par l'assistant |
| `livraison` | Phrase sur la livraison | Utilisée par la FAQ et l'assistant |
| `afficherPrix` | `false` | `false` = « Prix sur demande » ; `true` = prix indicatifs du catalogue |
| `googleMaps` | Lien | Mettre le lien exact de la boutique (Google Maps › Partager › Copier le lien) |

**`site/data/catalogue.json`** contient les familles (`categories`) et les produits (`produits`). Pour ajouter un produit, copier une ligne et l'adapter :

```json
{ "id": "ciment-cpj-35", "nom": "Ciment CPJ 35", "categorie": "ciment", "unite": "sac", "dimension": "50 kg", "prix": 4700, "populaire": true }
```

- `id` : unique, en minuscules, sans espace ni accent.
- `categorie` : l'`id` d'une famille (`ciment`, `fer`, `toles`, `bois`, `carrelage`, `plomberie`, `electricite`, `serrurerie`, `outils`).
- `populaire: true` : le produit apparaît dans « Les plus demandés ».
- `prix` : **indicatif**, affiché seulement si `afficherPrix` vaut `true`.

> ⚠️ Les prix du catalogue actuel sont ceux des **données de démonstration**. Ils sont masqués (`afficherPrix: false`). Ne passez `afficherPrix` à `true` qu'après avoir mis les vrais prix.

## 9.4 Choix techniques

| Choix | Pourquoi |
|---|---|
| HTML, CSS et JavaScript simples, **sans étape de construction** | Le site s'ouvre vite même en 3G, et n'importe quel développeur web peut le reprendre. Les deux fichiers de données se modifient depuis GitHub |
| Même identité que l'application | Logo, polices, orange Ayoka : la boutique est reconnaissable partout |
| Pictogrammes intégrés (`icons.js`) | Aucune image à télécharger, rendu net sur tous les écrans |
| Polices Google Fonts | Plus Jakarta Sans et Instrument Serif, avec repli sur les polices du téléphone si le réseau est lent |
| Responsive | Pensé d'abord pour le téléphone : barre « Envoyer » en bas, panneau de commande qui monte du bas, assistant plein écran |
| Accessibilité | Navigation au clavier, lien « Aller aux produits », étiquettes sur les boutons d'icônes, fenêtres signalées comme dialogues, animations coupées si le téléphone le demande |
| Aucune donnée collectée | Pas de cookie de suivi, pas de formulaire envoyé à un serveur. Le navigateur garde seulement la commande en cours |

## 9.5 L'assistant (`site/chatbot.js`)

Un **assistant à règles** : il ne « réfléchit » pas, il reconnaît des mots-clés. Il ne coûte rien, fonctionne sans serveur et ne répond jamais n'importe quoi.

| Le client écrit… | L'assistant… |
|---|---|
| « Vous êtes ouverts dimanche ? » | donne les horaires (`config.json`) |
| « Où êtes-vous ? » | donne l'adresse et le lien d'itinéraire |
| « Je peux payer par MoMo ? » | liste les moyens de paiement |
| « Vous livrez ? » | donne la phrase livraison et un bouton WhatsApp |
| « Prix de gros », « devis », « proforma » | explique et propose d'envoyer la liste de matériaux |
| « Vous avez du fer de 10 ? » | cherche dans le catalogue et propose **Ajouter** |
| « 20 sacs de ciment » | trouve le ciment et propose **Ajouter 20** |
| « Plomberie » | présente la famille et ses produits |
| « Ma commande » | indique combien de produits elle contient, avec un bouton vers la commande |
| « Je veux parler à quelqu'un » | ouvre WhatsApp avec sa dernière question déjà écrite |
| Une question inconnue | « Je n'ai pas la réponse, mais la boutique, oui » → **Envoyer ma question** sur WhatsApp, avec la question déjà écrite |

**Règles importantes**
- L'assistant dit qu'il est automatique. Il n'invente ni prix ni disponibilité : le prix exact vient toujours de la boutique.
- Un nombre suivi d'une unité est une quantité (« 20 sacs »). Un nombre seul est une taille (« fer de 10 »).
- Pour ajouter une réponse : une ligne dans le tableau `INTENTS` de `chatbot.js` (mots-clés, réponse, boutons proposés).

**Évolution possible (V3+)** : brancher un vrai modèle d'IA pour comprendre des questions plus libres. Il faudrait alors un petit serveur, ou une fonction en ligne, pour protéger la clé d'accès, et un budget mensuel. Le fonctionnement actuel reste le filet de sécurité.

## 9.6 Tester

```bash
scripts/build-pages.sh /
```

```bash
cd public-site && python3 -m http.server 4400
```

Puis, dans un autre terminal :

```bash
node tests/site.cjs
```

Le test vérifie, sur téléphone et sur ordinateur :
- l'affichage du catalogue et l'absence de défilement horizontal ;
- la recherche, l'ajout et les quantités ;
- le message d'erreur si le nom manque, et le contenu exact du message WhatsApp (bon numéro, produits, nom) ;
- 4 types de questions à l'assistant ;
- l'accès à l'application de gestion sous `/gestion/`.

## 9.7 À faire avant de faire connaître le site

- [ ] Confirmer les **horaires** dans `config.json`.
- [ ] Mettre le **lien Google Maps exact** de la boutique.
- [ ] Vérifier la liste des produits (ajouter ou retirer), puis éventuellement les vrais prix.
- [ ] Envoyer une commande test depuis un téléphone et vérifier qu'elle arrive bien sur le WhatsApp de la boutique.
- [ ] Ajouter le lien dans la bio WhatsApp Business, sur Google Maps (fiche d'établissement) et sur les factures.
