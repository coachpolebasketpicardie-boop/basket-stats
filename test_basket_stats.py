from basket_stats import points, free_throw_pct, moyenne_points


def test_points():
    assert points(5, 2, 3) == 19


def test_points_match_vierge():
    assert points(0, 0, 0) == 0


def test_free_throw_pct():
    assert free_throw_pct(8, 10) == 80.0


def test_free_throw_pct_arrondi():
    assert free_throw_pct(2, 3) == 66.7


def test_moyenne_points():
    assert moyenne_points([12, 18, 15]) == 15.0


def test_moyenne_points_liste_vide():
    assert moyenne_points([]) == 0.0
