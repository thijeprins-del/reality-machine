# Reality Machine

Ons spel voor GitHub Game Off 2026 (thema SHIFT). Je stukje land springt met een reality machine van dimensie naar
dimensie. Muizen tegen otters. Strategie en economie, isometrisch.

- DEV (elke merge op `dev`): https://thijeprins.nl/reality-machine/dev/
- RELEASE (`main`, op Thijes woord): https://thijeprins.nl/reality-machine/
- Welke versie waar staat: https://thijeprins.nl/reality-machine/versies.txt

Team: Thije (muizen, kern) en Lieuwe (otters). Werkafspraken: [CLAUDE.md](CLAUDE.md). Ontwerp: [DESIGN.md](DESIGN.md).
Taken: [TAKEN.md](TAKEN.md).

## Zelf draaien
```
npm install
npm run dev     # devserver
npm test        # typecheck + build + rooktest (Chromium via Playwright)
```

## Uitrol (GitHub Pages)
- Elke PR naar `dev` of `main` krijgt de check `controle` (`npm run snel`). Rood = niet mergen.
- Een merge op `dev` start de workflow op `main`; die bouwt `main` en `dev` en zet ze samen op Pages.
- Doorzetten naar RELEASE (alleen op Thijes woord): PR van `dev` naar `main`, of `git push origin origin/dev:main`.
- Mislukt een uitrol: tab **Actions** → rode run. De vorige site blijft staan. Opnieuw: **Actions → Pages → Run workflow** op `main`.

Code geschreven met hulp van AI (Claude). Beelden en geluid maken we zelf.
