# Stats Match Basket (PWA)

Application web installable (PWA), indépendante du carnet d'entraînement, pour saisir en direct
les statistiques d'un match (attaque / défense) et obtenir automatiquement les mêmes indicateurs
que la feuille Excel du coach : possessions, points, PPP, eFG%, FT Rate, % rebond offensif,
% perte de balle, fautes, points par type de tir, efficacité par tir.

Tout fonctionne hors-ligne, en local sur le téléphone (localStorage) : aucune donnée n'est envoyée
sur un serveur.

## Tester en local

```bash
cd stats-match-pwa
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000` sur le téléphone (même réseau Wi-Fi) ou dans un navigateur
desktop. Le mode hors-ligne et l'installation (icône sur l'écran d'accueil) nécessitent un accès
via `http://` ou `https://` — pas en ouvrant directement le fichier `index.html`.

## Installer sur le téléphone

- **Android (Chrome)** : ouvrir l'URL, menu ⋮ → "Installer l'application" / "Ajouter à l'écran d'accueil".
- **iPhone (Safari)** : ouvrir l'URL, bouton Partager → "Sur l'écran d'accueil".

## Héberger (pour y accéder en dehors du Wi-Fi local)

Le plus simple et gratuit : **GitHub Pages**. Il suffit de pousser ce dossier sur une branche
`gh-pages` (ou d'activer Pages sur `main` avec ce dossier comme racine) et l'app est accessible
via une URL `https://...github.io/...`, ce qui active aussi l'installation PWA correctement (HTTPS
requis pour la plupart des navigateurs).

## Utilisation

1. Onglet **Saisie** : renseigner l'adversaire et la date, puis taper sur les cases pour
   incrémenter chaque statistique (tirs, rebonds, pertes de balle, fautes, lancers francs...).
   Un tap sur le petit "−" en haut à droite d'une case décrémente. Le bouton en bas permet
   d'annuler la dernière saisie en cas d'erreur de manipulation.
2. Onglet **Rapport** : indicateurs calculés en direct, attaque vs défense.
3. Bouton "Terminer & enregistrer le match" : archive le match dans l'**Historique** et repart
   sur une saisie vierge.
4. Onglet **Historique** : liste des matchs enregistrés, consultation du rapport, suppression.

## Formules

Les calculs reproduisent exactement ceux de la feuille Excel d'origine (mêmes colonnes de saisie :
2pt M/R, 3pt M/R, RO, BP, F Out, F LF, LF M/R, AND1, Touche = sortie de balle "en touche"),
voir `app.js` (`computeSide`).
