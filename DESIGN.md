# Ontwerp (met getallen)

Nog een skelet. Werk dit bij bij elke grote regelwijziging.

## Kern
- Een dimensie duurt **4 minuten** (`src/data/dimensies.ts`), daarna komt de stream (sprong naar de volgende dimensie).
- Om de stream te halen heeft de reality machine genoeg energie en heelheid nodig. Haal je hem niet: verloren.
- Tech alleen uit loot: vondsten inbouwen of ontleden tot bouwplan. Geen techboom.
- **Het spel draait om industrie:** een zo groot mogelijke fabriek met lange productieketens op je eiland.
  Gevechten zijn bijzaak en kort.
- Ketens: ruwe grondstof uit de dimensie → tussenproducten → eindproduct dat de machine voedt (`streamKosten`).
  Nieuwe gebouwen en recepten komen alleen uit loot, zo groeit de keten per dimensie.
- **Logistiek: lopende banden** (keuze Thije, 2 nov). Gebouwen nemen invoer van een band die erin loopt en zetten
  uitvoer op een band die eruit wijst. De indeling van je eiland is de puzzel.
  Klein houden: één goed per bandtegel, rechtdoor en bochten, geen splitsers, bruggen of sorteerders (later-lijst).
  Bandmechaniek zit in de kern; per factie verschilt alleen `BandSoort` (snelheid, kosten).
- Winnen: de tegenstander zo meppen dat zijn machine de volgende stream niet haalt, vooral door zijn keten te breken.

## Samenwerking facties
Zelfde spelregels, ander gereedschap. De kern weet niets van muizen of otters; een factie is data plus één trucje.

- **Vast (contract, `src/kern/types.ts`):** machine (energie, heelheid), ruwe grondstoffen (`schroot`, `hout`, `kristal`),
  vorm van recepten, banden, gebouwen, vondsten, loot-tabel en eenheden, en de haken van het trucje (`opTik`, `opStream`).
  Wijzigen: kleine aparte PR, de ander kijkt binnen 12 uur.
- **Vrij per factie:** de eigen ketens (tussenproducten, recepten, wat de machine eet), gebouwen, eenheden,
  alle getallen, de loot-tabel, het trucje. Asymmetrie zit vooral in de vorm van de ketens. Code in `src/<factie>/`,
  getallen in `src/data/<factie>.ts`.
- **Balans:** bovenaan elk databestand drie balansknoppen (bv. oogstopbrengst, receptduur, streamKosten).
  Van de ander alleen voorstellen, niet zelf aanpassen. Vanaf week 3: AI tegen AI op vaste seeds via `window.SPEL`;
  mikpunt ongeveer 50/50 winst, en in een rustige run halen beide de stream met speling.
- **Beslissingen:** elk schrijft alleen zijn eigen factiekopje hieronder. Raakt iets de ander: PR of issue.
  Eén keer per week een kwartier bellen, bij de weekgrens van de planning.

## Facties
### Muizen (Thije)
Cyberpunk/dieselpunk, tech-heavy. Getallen in `src/data/muizen.ts` (nog te maken).

Beeld: een grauwe, duistere industriewereld, niets vrolijks. De muizen zelf klein en heel pluizig (en vuil); hun
robots, wapens en fabrieken gigantisch, hoekig en semi-3D (overcompensatie). Staal, legergroen en bruin, roest, olie
en veel te veel kabels. Neon is het enige felle, en dat gloeit echt (gloedlaag). Sprites komen uit
`scripts/pixel/muizen.mjs`; bekijk ze samen met `?proto=muizen`.

### Otters (Lieuwe)
Getallen in `src/data/otters.ts` (nog te maken).

## Open
- Tegen de computer (aanname) of tweespeler op één scherm?
- Energie en heelheid: hoeveel nodig per stream?
