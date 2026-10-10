# MenuFlow 🥘

Application web (PWA) de planification de menus hebdomadaires, inspirée de Jow : menus midi/soir, cibles calories/macros, import de recettes depuis Marmiton/750g et liste de courses automatique.

## Lancer

```bash
npm install
npm start
```

L'application démarre sur `http://localhost:3000` (port modifiable via `PORT`).

## Fonctionnalités

- **Semaine** : génération d'un menu 7 jours × midi/soir approchant tes cibles (score 60 % calories, 40 % macros), remplacement manuel de chaque repas
- **Cibles quotidiennes** : calories + répartition protéines / glucides / lipides
- **Nombre de personnes** : réglable séparément pour le midi et le soir ; toutes les quantités sont recalculées proportionnellement, avec somme et fusion des unités (g/kg, ml/L) dans la liste de courses
- **Recettes** : import par URL Marmiton/750g (JSON-LD schema.org) ou saisie manuelle avec macros
- **Courses** : liste agrégée de la semaine, déduction du frigo (« J'ai déjà… »), boutons Copier / Partager
- **PWA** : installable sur mobile
- **Sauvegarde** : export/import JSON de toutes les données (onglet Cibles)

## Déploiement Render

Le fichier `render.yaml` est inclus : New → Web Service → connecter ce repo → Create Web Service.
Sur le plan gratuit : l'app s'endort après 15 min d'inactivité, et le disque est effacé à chaque redéploiement — utilise l'export/import JSON pour tes données.

## Structure

- `server.js` — API Express
- `db.js` — SQLite (better-sqlite3)
- `importer.js` — scraping JSON-LD avec tolérance aux JSON malformés
- `planner.js` — moteur de planification
- `ingredients.js` — parseur de quantités et normalisation des noms
- `public/` — interface mobile-first
