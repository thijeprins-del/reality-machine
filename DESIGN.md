# Ontwerp (met getallen)

Nog een skelet. Werk dit bij bij elke grote regelwijziging.

## Kern
- Een dimensie duurt **4 minuten** (`src/data/dimensies.ts`), daarna komt de stream (sprong naar de volgende dimensie).
- Om de stream te halen heeft de reality machine genoeg energie en heelheid nodig. Haal je hem niet: verloren.
- Tech alleen uit loot: vondsten inbouwen of ontleden tot bouwplan. Geen techboom.
- Winnen: de tegenstander zo meppen dat zijn machine de volgende stream niet haalt.

## Samenwerking facties
Zelfde spelregels, ander gereedschap. De kern weet niets van muizen of otters; een factie is data plus één trucje.

- **Vast (contract, `src/kern/types.ts`):** machine (energie, heelheid), grondstoffen (`schroot`, `hout`, `kristal`),
  vorm van eenheden, gebouwen, vondsten en loot-tabel, en de haken van het trucje (`opTik`, `opStream`).
  Wijzigen: kleine aparte PR, de ander kijkt binnen 12 uur.
- **Vrij per factie:** welke eenheden en gebouwen, alle getallen, de loot-tabel, het trucje. Code in `src/<factie>/`,
  getallen in `src/data/<factie>.ts`.
- **Balans:** bovenaan elk databestand drie balansknoppen (bv. opbrengst, eenheidskosten, machine-heelheid).
  Van de ander alleen voorstellen, niet zelf aanpassen. Vanaf week 3: AI tegen AI op vaste seeds via `window.SPEL`;
  mikpunt ongeveer 50/50 winst, en in een rustige run halen beide de stream met speling.
- **Beslissingen:** elk schrijft alleen zijn eigen factiekopje hieronder. Raakt iets de ander: PR of issue.
  Eén keer per week een kwartier bellen, bij de weekgrens van de planning.

## Facties
### Muizen (Thije)
Cyberpunk/dieselpunk, tech-heavy. Getallen in `src/data/muizen.ts` (nog te maken).

### Otters (Lieuwe)
Getallen in `src/data/otters.ts` (nog te maken).

## Open
- Tegen de computer (aanname) of tweespeler op één scherm?
- Energie en heelheid: hoeveel nodig per stream?
