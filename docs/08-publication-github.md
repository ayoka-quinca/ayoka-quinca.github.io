# 8. Comment l'application est mise en ligne sur GitHub

## L'image à retenir : la recette et le plat

- Le **dépôt GitHub** contient la **recette** : le code source (fichiers `.tsx`, `.ts`, `.css` dans `app/`). Un développeur sait la lire, un navigateur non.
- Ce que voit le client, c'est le **plat cuisiné** : des fichiers HTML, CSS et JavaScript prêts à être affichés (dossier `app/dist`).
- Passer de la recette au plat s'appelle **construire** (`npm run build`).

GitHub Pages ne fait que **servir le plat**. Quelqu'un doit donc d'abord **cuisiner**.

## Les deux réglages possibles dans Settings › Pages › Source

| Réglage | Ce que fait GitHub | Ici |
|---|---|---|
| **Deploy from a branch** | Sert les fichiers d'une branche **tels quels**, sans rien transformer | ❌ GitHub servirait la recette (le code source) : page vide ou README |
| **GitHub Actions** ✅ | Exécute un programme qui **cuisine** (construit) puis **sert** le résultat | ✅ C'est notre choix |

« Deploy from a branch » convient à un site déjà écrit en HTML, comme un portfolio simple. Notre application doit être construite avant : il faut donc « GitHub Actions ».

## Ce qui se passe à chaque modification

On ne travaille que sur la branche `main`. À chaque envoi sur `main`, GitHub lance automatiquement le fichier `.github/workflows/deploy-pages.yml` :

1. **Installer** les outils nécessaires (`npm ci`).
2. **Vérifier** le code (`npm run typecheck`). En cas d'erreur, rien n'est publié et le site en ligne reste tel quel.
3. **Construire** l'application avec la bonne adresse (`npm run build`).
4. **Publier** le résultat sur https://ayoka-quinca.github.io.

Durée : 1 à 2 minutes. On suit l'avancement dans l'onglet **Actions** du dépôt : ✅ vert = en ligne, ❌ rouge = rien n'a changé en ligne, cliquer dessus pour voir l'étape en échec.

## Ce qu'il faut retenir

- On ne touche jamais à `app/dist` à la main : il est fabriqué automatiquement.
- Le réglage « GitHub Actions » se fait **une seule fois**.
- Pour revenir à une version précédente : remettre l'ancien code sur `main`, et la publication suit.
- L'alternative manuelle (construire sur son ordinateur puis envoyer le résultat sur une branche `gh-pages`) marche aussi. Elle est déconseillée : on peut oublier une étape et mettre en ligne une version différente du code.
