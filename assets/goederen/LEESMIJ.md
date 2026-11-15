# Plaatjes van goederen

`hoop-<sprite>.png` (28 x 24, voet op rij 23): een hoopje van een goed. Het spel gebruikt het voor de hopen in de opslag
en als icoon in de balk linksonder en in PRODUCTION. `<sprite>` is het veld `sprite` van het goed in `economies/*.json`,
of anders zijn `id`.

`last-<sprite>.png` (18 x 18, voet op rij 16): één brokje, op een band en bij de voet van een gebouw.

`veld-<sprite>-<n>.png` (40 x 56, voet op rij 47, zoals `assets/wereld/schroot-1.png`): een veld op de kaart, per tegel
één. Uit PixelLab op 56 px en daarna verkleind tot een tegel. Is er geen `-2`, dan gebruikt het spel `-1` voor beide.

Gemaakt met PixelLab (15 nov 2026, drie vellen, 30 generaties samen, met de hopen uit `assets/muizen/` als
stijlvoorbeeld). Niet door `scripts/land/stijl.py` gehaald: goederen moeten aan hun kleur te herkennen blijven.
AI-sprites: melden op de itch-pagina.
