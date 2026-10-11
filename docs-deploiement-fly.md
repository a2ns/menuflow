# Déploiement MenuFlow sur Fly.io

## Prérequis (5 min)

1. Créer un compte sur https://fly.io (carte bancaire demandée, non débitée sur le plan gratuit)
2. Installer le CLI : https://fly.io/docs/flyctl/ (macOS : `brew install flyctl`, Windows : `powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"`, Linux : `curl -L https://fly.io/install.sh | sh`)

## Étapes (à exécuter à la racine du repo)

```bash
# 1. Se connecter
fly auth login

# 2. Lancer l'app (détecte le Dockerfile, propose un nom)
#    Répondre : Non à "Would you like to set up a Postgresql database?" (inutile, SQLite)
#    Choisir la region paris (cdg) si proposée
fly launch --no-deploy

# 3. Créer le disque persistant (1 Go gratuit, jusqu'à 3 Go)
fly volumes create menuflow_data --size 1 --region cdg

# 4. Vérifier que fly.toml contient bien la section [mounts] :
#    [mounts]
#      source = "menuflow_data"
#      destination = "/data"
#    (déjà présent dans le fly.toml du repo)

# 5. Déployer
fly deploy

# 6. Vérifier
fly status
fly logs
```

## URL de l'app

`https://<nom-choisi>.fly.dev` (affiché par `fly status`)

## Points importants

- **La base SQLite vit sur le volume `/data`** (`DATA_DIR=/data` dans `fly.toml`). Elle survit aux redéploiements et redémarrages : tes plans, ton frigo et tes réglages sont conservés.
- **`seedIfEmpty()`** reste en filet de sécurité : si le volume est vide (premier lancement), les 367 recettes sont chargées automatiquement.
- **Mise en sommeil** : le plan gratuit arrête la machine après inactivité (~2-5 s de réveil au premier clic).
- **Déploiements suivants** : `fly deploy` uniquement.
- **Mise à jour depuis GitHub** : `git pull && fly deploy` (pas d'auto-déploiement GitHub natif).

## En cas de problème

```bash
fly logs            # voir les logs en direct
fly ssh console      # se connecter à la machine
fly volumes list     # vérifier le volume
```

## Restaurer une sauvegarde Render

Sur l'app Render (avant de basculer) : télécharger `GET /api/data/export` (menuflow-export.json).
Sur Fly : `POST /api/data/import` avec le fichier. Les recettes, frigo, réglages et plans sont restaurés.
