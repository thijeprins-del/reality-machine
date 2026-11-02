# Ontwerp (met getallen)

Nog een skelet. Werk dit bij bij elke grote regelwijziging.

## Kern
- Een dimensie duurt **4 minuten** (`src/data/dimensies.ts`; nu even 1 minuut om mee te spelen), daarna komt de stream
  (sprong naar de volgende dimensie).
- **De transportring** (2 nov): een slecht geverfde gele stippellijn om de machine (straal 7,5 tegels). Alles binnen de ring
  springt mee; daarbuiten liggen de grondstoffen, en die blijven achter. In de laatste 10 seconden laadt de ring op (gloed).
  Bij de sprong: witte flits, nieuwe kaart met nieuwe velden, en de wereld buiten de ring krijgt eigen kleuren
  (roestduin, kristaltoendra, gifwoud, magmaveld, zoutzee). Muizen buiten de ring worden nu nog mee naar binnen
  getrokken; wat ze droegen gaat de opslag in.
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

## Kaart en grondstoffen (basis, 2 nov)
- Kaart van **44 x 44 tegels**: groot, maar net genoeg ruimte om te bouwen. Getallen in `src/data/dimensies.ts`.
- In het midden de reality machine (4x4 tegels) en de opslag (2x2), binnen de gele ring (bouwgrond, geen grondstoffen).
- Velden met ruwe grondstoffen eromheen: schroot (5 velden, 30 per tegel), hout (4, 25), kristal (2, 15, verder weg).
- Werkers (eenheden met `werk`) graven een lading, sjouwen die naar de opslag en gaan terug, tot het veld op is;
  dan zoeken ze binnen 8 tegels verder. Rechte lijnen, alleen om de machine heen. Geen botsingen tussen werkers.
- Start: menu met factiekeuze. Een factie zonder data staat er wel, maar is niet te kiezen.

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
Cyberpunk/dieselpunk, tech-heavy. Getallen in `src/data/muizen.ts`.

Honderden muizen (start: **300**), en je krijgt er **nooit** nieuwe bij. Ze minen zelf: elke muis draagt 2 per keer
en graaft 2,5 s. Je selecteert ze in massa (slepen, dubbelklik).

Beeld: een grauwe, duistere industriewereld, niets vrolijks. De muizen zelf klein en heel pluizig (en vuil); hun
robots, wapens en fabrieken gigantisch, hoekig en semi-3D (overcompensatie). Staal, legergroen en bruin, roest, olie
en veel te veel kabels. Neon is het enige felle, en dat gloeit echt (gloedlaag).
Schaal is belangrijk: geen of weinig gebouwen, vooral machines, ruim groter dan de muizen (machines 2x2 tegels,
mech 3x3 en ruim tien keer zo hoog als een muis). Mechs menselijk van bouw, wapens over de top. Sprites komen uit
`scripts/pixel/muizen.mjs`; bekijk ze samen met `?proto=muizen`.

**Stroomnet (trucje van de muizen, 2 nov):** alleen de muizen beheren stroom; de otters krijgen iets anders.
Bronnen verbranden grondstof uit de opslag: dynamo (schroot, 3/5/7 kW), ketel (hout, 2/3/4), reactor (kristal, 5/8/11).
Verbruikers: machine (6 kW; laadt niet op, moet bij de stream volle stroom krijgen), koeling (2 kW, -4,5 hitte/s op alles), lampen (3 kW, muizen graven
tot 60% sneller). Tekort: alles naar rato trager, zekering slaat door na 3 s. Overschot wordt hitte; op 100 storing
tot onder 35. Bediening via een pixelart-paneel linksonder (`src/muizen/paneel.ts`), regels in `src/muizen/energie.ts`,
getallen in `MUIZEN_ENERGIE` (`src/data/muizen.ts`).

### Otters (Lieuwe)
Getallen in `src/data/otters.ts` (nog te maken).

## Open
- Tegen de computer (aanname) of tweespeler op één scherm?
- Energie en heelheid: hoeveel nodig per stream?
