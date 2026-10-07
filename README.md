# Elevatee 💪

App perso (PWA, sans dépendances) pour suivre mes programmes sportifs, un timer, l'eau et le sommeil.
Les données restent sur l'appareil (localStorage) ; export/import JSON dans les Réglages.

## Lancer
```
npx serve .      # ou : python3 -m http.server
```
Puis ouvrir l'URL sur le téléphone → « Ajouter à l'écran d'accueil ».
(Hébergement gratuit possible avec GitHub Pages : Settings → Pages → branche, dossier `/`.)

## Fichiers
- `data.js` : programmes de départ (Busy Girl, phase 1)
- `app.js` : toute l'application · `style.css` : design · `sw.js` : mode hors-ligne
