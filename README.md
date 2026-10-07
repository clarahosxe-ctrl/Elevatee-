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

## Pas (Santé iPhone)
Une web-app ne peut pas lire HealthKit directement. Deux options :

1. **Saisie manuelle** : bouton « Saisir / Modifier » sur la carte Pas.
2. **Raccourci iOS** qui lit les pas et les envoie à l'app :
   - Raccourci : *Rechercher des échantillons de santé* (Type : Pas, Début : aujourd'hui) → *Calculer les statistiques* (Somme) → *Obtenir le contenu de l'URL* en `PATCH` vers l'API d'un **gist secret** GitHub (fichier `steps.json` contenant `{"steps": <somme>, "date": "AAAA-MM-JJ"}`, en-tête `Authorization: Bearer <token gist>`).
   - Dans l'app : Réglages → « URL de synchro » = l'URL *raw* du fichier `steps.json` du gist. L'app relit ce fichier à chaque ouverture.
   - Ajoute une *Automatisation* (heure de la journée, plusieurs fois par jour) pour lancer le raccourci sans y penser.

(Si tu utilises l'app dans Safari plutôt qu'installée, le raccourci peut aussi simplement ouvrir `https://…/#/steps/<somme>`.)
