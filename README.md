# basket-stats

Petit projet Python d'entraînement : quelques fonctions de statistiques de basket, avec des tests.

## Fonctions

| Fonction | Rôle |
| --- | --- |
| `points(deux_points, trois_points, lancers_francs)` | Total de points d'un joueur |
| `free_throw_pct(reussis, tentes)` | Pourcentage de réussite aux lancers francs |
| `moyenne_points(points_par_match)` | Moyenne de points sur plusieurs matchs |

## Installer

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install pytest
```

## Lancer les tests

```bash
pytest
```
