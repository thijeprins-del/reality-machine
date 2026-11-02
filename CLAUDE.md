# Reality Machine — werkafspraken voor AI-assistenten

Game Off 2026-spel (thema SHIFT). Team: Thije (eigenaar, muizen) en Lieuwe (otters). Nederlands in docs, commits en antwoorden.
Code-namen mogen Engels of Nederlands, maar per map consequent.

## Het spel in het kort (details in DESIGN.md)
- Jouw stukje land zweeft door dimensies. Een dimensie duurt een vaste tijd (begin: 4 minuten), daarna komt de stream.
- Tussendoor: verkennen, loot zoeken, grondstoffen oogsten, bouwen op je eigen eiland, en de tegenstander lastigvallen.
- Om de stream te halen moet je reality machine genoeg energie en heelheid hebben. Haal je hem niet, dan verlies je.
- Tech alleen uit loot: vondsten inbouwen of ontleden tot bouwplan. Geen techboom.
- Facties: muizen (cyberpunk/dieselpunk, tech) tegen otters (Lieuwe). Speler tegen computer; tweespeler is een "misschien".

## Mappen en eigenaars (vermijdt conflicten)
| map | eigenaar | inhoud |
|---|---|---|
| `src/kern/` | samen | spellus, tijd, dimensies, stream, iso-tekenen, loot-systeem, invoer |
| `src/muizen/` | Thije | eenheden, gebouwen, loot-tabellen, AI van de muizen |
| `src/otters/` | Lieuwe | idem voor de otters |
| `src/data/` | samen | getallen per factie in eigen bestand: `muizen.ts`, `otters.ts`, `dimensies.ts` |
| `assets/muizen/`, `assets/otters/`, `assets/wereld/` | per factie / samen | sprites (PNG of SVG) |

- Een factie praat met de kern alleen via de types in `src/kern/types.ts` (`Factie`, `Eenheid`, `Vondst`, `Gebouw`).
  Nieuw veld nodig? Kleine aparte PR op `src/kern/types.ts`, eerst mergen, dan je factiewerk.
- Werk je in de map van de ander: alleen als die erom vraagt, en zeg het in de PR-titel.

## Git-werkwijze (twee mensen, twee AI's)
1. `git fetch origin dev && git checkout -B <naam>/<onderwerp> origin/dev` (bv. `lieuwe/otter-dam`, `thije/stream-timer`).
2. Kleine PR's: één onderwerp, liefst onder een dag werk. Grote dingen in stukken.
3. Vóór de PR: `git fetch origin dev && git rebase origin/dev`, dan `npm test`.
4. PR naar `dev` met titel in spelerstaal ("Otters kunnen dammen bouwen"). Die titel wordt de changelogregel.
5. Groen? Zelf squash-mergen mag voor je eigen map. Raakt het `src/kern/`: de ander even laten kijken (of na 12 uur zonder
   reactie zelf mergen en het melden).
6. Nooit naar `dev` of `main` pushen, nooit force-pushen op andermans branch.
7. `dev` → `main` alleen op Thijes woord: PR van dev naar main, of `git push origin origin/dev:main`.

Versienummer en changelog: niet met de hand ophogen (dat botst bij twee mensen). De workflow zet het buildnummer
(`github.run_number`) en de korte commit in het spel; de changelog komt uit de PR-titels.

## Taken
- `TAKEN.md` heeft per persoon een lijst `- [ ]` met nummers (`M3` muizen, `O2` otters, `K5` kern). Bij afronding
  `- [x] … (#PR)`. Een taak die je oppakt: eerst je naam erachter zetten in je PR, zo pakken twee AI's niet hetzelfde op.

## Commando's
- `npm run dev` devserver. `npm run snel` typecheck + build (±10 s; unit-tests komen erbij zodra er regels zijn). `npm test` = snel + rooktest (±30 s), vóór elke PR.
- Testhaak: `window.SPEL` met `staat`, `stap(sec)` (regels zonder tekenen), `zaai(seed)`, `stream()` (forceer sprong).
  Toeval voor spelregels via seed (`?seed=123`); toeval alleen voor beeld mag `Math.random`.

## Beeld en stijl
- Isometrisch, sprites op één pixelmaat, geen ronde hoeken in de interface.
- Geen AI-gegenereerde beelden of geluid. Sprites tekenen met de hand of met tekenscripts in `scripts/pixel` (zoals Casus Romae).
- Nieuwe sprite = nieuw bestand in `assets/...`, niet in code tekenen. Geen emoji in beeld.
- Performance: alleen tekenen wat rond de camera zichtbaar is; streef naar ≤ 16 ms per beeld.

## Voorkeuren
- Minimaal testen: `npm test` plus soms één screenshot. Geen uitgebreide testscripts (kost tokens).
- Scope klein. Nieuwe ideeën op de later-lijst in `TAKEN.md`, niet meteen bouwen.
- Antwoord kort: wat er veranderd is, welke aannames, link naar de PR en na merge de DEV-link.
- Grote regelwijziging: ook `DESIGN.md` bijwerken. Merkt de speler het: ook `HELP.md`.
## Uitrol
- `.github/workflows/pages.yml`: controle op elke PR, uitrol van `main` (RELEASE) en `dev` (DEV) samen. Zie README.md.
