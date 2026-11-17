# Reality Machine — werkafspraken voor AI-assistenten

Game Off 2026-spel (thema SHIFT). Team: Thije (eigenaar) en Lieuwe. Nederlands in docs, commits en antwoorden.
Code-namen mogen Engels of Nederlands, maar per map consequent.

## Het spel in het kort (details in DESIGN.md)
- Jouw stukje land zweeft door dimensies. Een dimensie duurt een vaste tijd (begin: 4 minuten), daarna komt de stream.
- Tussendoor: verkennen, loot zoeken, grondstoffen oogsten, bouwen op je eigen eiland, en de tegenstander lastigvallen.
- Om de stream te halen moet je reality machine genoeg energie en heelheid hebben. Haal je hem niet, dan verlies je.
- Tech: elke economie heeft een kleine techboom. In het laboratorium maak je research packs uit grondstoffen en
  daarmee koop je in het bouwmenu gebouwen en recepten van een hoger tier vrij (Lieuwe, 15 nov; was: "alleen uit loot,
  geen techboom"). Loot kan daar later bovenop komen.
- Eén soort: de pack rats (hamsterende ratten, cyberpunk/dieselpunk). De tegenstander is het land zelf.
- Elke wereld heeft een wereldtype (`worldtypes/*.json`: tegelset, kleuren, economie) en een economie
  (`economies/*.json`: grondstoffen, recepten, gebouwen, startkapitaal). Schaven doe je in die bestanden.
- Elk soort dimensie (Stone age, Bugs, Giants, ...) is een archetype: `worldtypes/archetypes/<id>.json` met naam, familie, kaartmaat,
  grondstoffen (unique, sharedChance, optioneel aliases), loot en de vijand (`enemy`: raiders, sprites, attack). Nieuw bestand ook in `worldtypes/archetypes/index.ts`.

## Mappen en eigenaars (vermijdt conflicten)
| map | eigenaar | inhoud |
|---|---|---|
| `src/kern/` | samen | spellus, tijd, dimensies, stream, iso-tekenen, loot-systeem, invoer |
| `src/ratten/` | af te spreken (was `src/muizen/`, Thije) | de pack rats: werk, industrie, stroomnet, bouwmenu, paneel |
| `economies/`, `worldtypes/` | Lieuwe | de economieën en wereldtypes als JSON; een nieuw bestand ook in `index.ts` |
| `tools/` | Lieuwe | `economy.html`: sandbox om een economie te bouwen en te wegen (leest en schrijft `economies/*.json`) |
| `src/data/` | samen | getallen die niet bij een economie horen: `ratten.ts`, `dimensies.ts`, `run.ts`, `wrath.ts` |
| `assets/muizen/`, `assets/wereld/`, `assets/land/` | samen | sprites (PNG of SVG); `assets/muizen/` houdt zijn naam, de sprites zijn van de ratten |

- De ratten praten met de kern via `src/kern/types.ts` (`Soort` met eenheden en `trucje`) en `src/kern/economie.ts`.
  Een gebouw, recept of grondstof erbij: het economiebestand, geen code. Nieuw gedrag voor gebouwen: `src/ratten/industrie.ts`.
  Nieuw veld in de kern nodig? Kleine aparte PR op `src/kern/`, eerst mergen.
- Werk je in de map van de ander: alleen als die erom vraagt, en zeg het in de PR-titel.

## Git-werkwijze (twee mensen, twee AI's)
1. `git fetch origin dev && git checkout -B <naam>/<onderwerp> origin/dev` (bv. `lieuwe/otter-dam`, `thije/stream-timer`).
2. Kleine PR's: één onderwerp, liefst onder een dag werk. Grote dingen in stukken.
3. Vóór de PR: `git fetch origin dev && git rebase origin/dev`, `VERSIE` ophogen (zie "Versie"), dan `npm test`.
4. PR naar `dev` met titel in spelerstaal, met de versie vooraan ("v101l: Otters kunnen dammen bouwen"). Die titel wordt de changelogregel.
5. Groen? Zelf squash-mergen mag voor je eigen map. Raakt het `src/kern/`: de ander even laten kijken (of na 12 uur zonder
   reactie zelf mergen en het melden).
6. Nooit naar `dev` of `main` pushen, nooit force-pushen op andermans branch.
7. `dev` → `main` alleen op Thijes woord: PR van dev naar main, of `git push origin origin/dev:main`.

## Versie (elke PR naar dev)
- Elke PR naar `dev` krijgt een nieuwe versie: één gedeelde teller plus een letter voor wie hem levert, `t` = Thije, `l` = Lieuwe.
  Voorbeeld: dev staat op `v100t`, de volgende PR wordt `v101l`, daarna `v102t`.
- De versie staat in het bestand `VERSIE` in de wortel (één regel, bv. `v101l`). Ophogen = dev-nummer + 1, met je eigen letter.
- Zet hem ook vooraan in de PR-titel en het commitbericht: `v101l: Otters kunnen dammen bouwen`.
- Botsing (de ander mergede eerst met hetzelfde nummer): na `git rebase origin/dev` conflicteert `VERSIE`; neem dev + 1.
- De controle op de PR faalt als `VERSIE` niet precies dev + 1 is of de letter mist. PR's van dev naar main hogen niet op.
- Het spel toont de versie rechtsonder op het startscherm en tijdens het spel (`versieTekst()` in `src/kern/omgeving.ts`),
  met daarachter DEV, het buildnummer van de workflow en de korte commit. De changelog komt uit de PR-titels.

## Taken
- `TAKEN.md` heeft per persoon een lijst `- [ ]` met nummers (`M3` ratten, `E2` economie, `K5` kern). Bij afronding
  `- [x] … (#PR)`. Een taak die je oppakt: eerst je naam erachter zetten in je PR, zo pakken twee AI's niet hetzelfde op.

## Commando's
- `npm run dev` devserver. `npm run snel` typecheck + build (±10 s; unit-tests komen erbij zodra er regels zijn). `npm test` = snel + rooktest (±30 s), vóór elke PR.
- Testhaak: `window.SPEL` met `staat`, `stap(sec)` (regels zonder tekenen), `zaai(seed)`, `stream()` (forceer sprong),
  `stuur(ids | 'alle', kol, rij)` (opdracht zoals rechtsklik), `terrein()` en `laadTerrein(json)` (hoogtekaart als JSON, ook via F2 EXPORTEER). `?world=zoutzee` kiest het wereldtype van de eerste wereld, `?kaart=256x64` kiest de kaartmaat. In het spel: F1 raster en hoogte per tegel, F2 terreinbewerker (de klok staat dan stil).
  Toeval voor spelregels via seed (`?seed=123`); toeval alleen voor beeld mag `Math.random`.

## Beeld en stijl
- Isometrisch, sprites op één pixelmaat, geen ronde hoeken in de interface.
- Sprites: PixelLab (API, sleutel in `PIXELLAB_API_KEY`, nooit in de repo) is toegestaan (Thije, 12 nov: gameplay boven kunstprijzen). Tekenscripts in `scripts/pixel` blijven mogen.
  Meld AI-sprites op de itch-pagina. Geen AI-geluid zonder Thijes woord. Meld de kosten (generaties) vóór je er meer dan 15 uitgeeft.
- Bewoners van de werelden zijn otters in de stijl van `land/pro-otters-alle-types.png` (Thije, 17 nov): `assets/land/<type>/<type>-otter-0..3.png`.
  Geen nieuwe bewonerssprites in een andere stijl; zie `scripts/land/README.md` en DESIGN.md "De bewoners van het land".
- Nieuwe sprite = nieuw bestand in `assets/...`, niet in code tekenen. Geen emoji in beeld.
- Performance: alleen tekenen wat rond de camera zichtbaar is; streef naar ≤ 16 ms per beeld.

## Voorkeuren
- Minimaal testen: `npm test` plus soms één screenshot. Geen uitgebreide testscripts (kost tokens).
- Scope klein. Nieuwe ideeën op de later-lijst in `TAKEN.md`, niet meteen bouwen.
- Antwoord kort: wat er veranderd is, welke aannames, link naar de PR en na merge de DEV-link.
- Grote regelwijziging: ook `DESIGN.md` bijwerken. Merkt de speler het: ook `HELP.md`.
## Uitrol
- `.github/workflows/pages.yml`: controle op elke PR, uitrol van `main` (RELEASE) en `dev` (DEV) samen. Zie README.md.
