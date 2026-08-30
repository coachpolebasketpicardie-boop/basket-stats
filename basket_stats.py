"""Petites fonctions de statistiques de basket.

Utilisées pour illustrer un projet Python simple et testé.
"""


def points(deux_points: int, trois_points: int, lancers_francs: int) -> int:
    """Nombre total de points marqués par un joueur.

    :param deux_points: paniers à 2 points réussis
    :param trois_points: paniers à 3 points réussis
    :param lancers_francs: lancers francs réussis (1 point)
    """
    return 2 * deux_points + 3 * trois_points + lancers_francs


def free_throw_pct(reussis: int, tentes: int) -> float:
    """Pourcentage de réussite aux lancers francs, arrondi à 1 décimale.

    Renvoie 0.0 si aucun lancer n'a été tenté.
    """
    if tentes == 0:
        return 0.0
    return round(100 * reussis / tentes, 1)


def moyenne_points(points_par_match: list[int]) -> float:
    """Moyenne de points sur une liste de matchs, arrondie à 1 décimale."""
    if not points_par_match:
        return 0.0
    return round(sum(points_par_match) / len(points_par_match), 1)
