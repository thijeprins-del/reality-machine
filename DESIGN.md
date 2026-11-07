# Ontwerp (met getallen)

Nog een skelet. Werk dit bij bij elke grote regelwijziging.

## Kern
- Een dimensie duurt **5 minuten** (`src/data/dimensies.ts`, Thije 3 nov), daarna komt de stream
  (sprong naar de volgende dimensie).
- **De transportring** (2 nov): een slecht geverfde, matte gele stippellijn om de machine (straal 14 tegels: binnen de
  ring bouw je). Je land is een grove schijf die iets buiten de ring steekt, lomp in elke wereld geplakt (rotswand,
  schaduw, naad, klemmen). Alles binnen de ring springt mee; daarbuiten liggen de grondstoffen, en die blijven achter.
  Aanloop (laatste 12 s, alleen met volle stroom): bliksem van de machine naar de ring, schudden, de wereld wordt donker.
  De sprong (`SPRONG_SEC` = 3,5 s): uit de wereld gerukt, de oude grond valt weg, even in het niets (tijd en werk staan
  stil, het stroomnet loopt door), dan landen in de volgende wereld met eigen kleuren (roestduin, kristaltoendra, gifwoud,
  magmaveld, zoutzee, aarde). Het spel begint ook in het niets. Muizen buiten de ring worden nu nog mee naar binnen getrokken.
- **Stream gemist** (2 nov): heeft de machine op dat moment geen volle stroom, dan springt er niets (rode flits, vonken)
  en begint de dimensie opnieuw. Volgens het plan verlies je dan; voorlopig vergevingsgezind om mee te spelen.
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
- Kaart van standaard **64 x 64 tegels**: de schijf in het midden, ruim wereld eromheen. Getallen in `src/data/dimensies.ts`.
  Elke wereld kan een eigen maat hebben (`kaart` in `DIMENSIES`, minstens 48), ook niet-vierkant; om te proberen: `?kaart=256x64`
  of `?kaart=256x64,128x128` om de beurt. Een grotere wereld heeft meer velden, over de hele kaart verspreid.
- In het midden de reality machine (4x4 tegels) en de opslag (2x2), binnen de gele ring (bouwgrond, geen grondstoffen).
- Velden met ruwe grondstoffen eromheen: schroot (7 velden, 30 per tegel), hout (6, 25), kristal (3, 15, verder weg).
- Werkers (eenheden met `werk`) graven een lading, sjouwen die naar de opslag en gaan terug, tot het veld op is;
  dan zoeken ze binnen 8 tegels verder. Rechte lijnen, alleen om de machine heen. Geen botsingen tussen werkers.
- Start: menu met factiekeuze. Een factie zonder data staat er wel, maar is niet te kiezen.

## Terrein (Lieuwe, 5 nov)
- Elke wereld krijgt heuvels uit Perlin-ruis (`src/kern/terrein.ts`), met per dimensie eigen getallen (`heuvels` in
  `src/data/dimensies.ts`). Een wereld hangt alleen af van de seed en het dimensienummer, niet van wat je speelde.
- **Elke tegel heeft zijn eigen vier hoekhoogtes**, in hele niveaus van -1 tot +5 (één niveau is 16 schermpixels). Binnen
  een tegel schelen twee hoeken langs een rand hooguit 1: een tegel is vlak of een helling. Alle hoeken op -1: water.
- **Een klip is een rand, geen tegel.** Sluiten twee buren op hun gedeelde rand op elkaar aan, dan loopt de grond door.
  Verschillen ze, dan staat daar een loodrechte wand, zo hoog als het verschil: 1,1,1,3,2,1 wordt `_|-\_`. Zo is elke
  kaart te tekenen (het zijn blokken met een vlakke of schuine bovenkant) en hoeft er niets gladgestreken te worden.
- Plateaus: stukken van minstens `MIN_PLATEAU` tegels die `klipHoog` niveaus (per dimensie 2 of 3) boven het glooiende
  land liggen, een eind van de schijf af. Elk plateau krijgt een oprit van `klipHoog` tegels lang; lukt dat niet, dan
  verdwijnt het weer.
- Hoe hoger, hoe lichter (`hoogteTint`): elk niveau is een stap helderder, zodat je hoogte in één oogopslag ziet.
- Hoogtelijnen: een dunne lijn waar de grond een heel niveau passeert, zoals op een wandelkaart, en een donkerder lijn
  langs een rand waar het land erachter lager ligt (een wand die van je af kijkt zie je anders niet).
- De schijf ligt één blok hoog (`SCHIJF_HOOGTE`). Langs de hele rand zitten kleppen: bij de landing schuiven ze uit tot
  een helling van één tegel naar de grond, zodat eenheden eraf kunnen. Tot 5 tegels buiten de ring blijft de wereld vlak,
  zodat elke klep op hoogte 0 uitkomt.
- Eenheden en grondstoffen staan op de grond; **eenheden worden altijd boven het terrein getekend**, zodat een muis
  achter een heuvel zichtbaar blijft. Klikken raakt de voorste grond op die plek.
- Lopende eenheden kunnen niet over water en niet langs een wand, hoe laag ook, in geen van beide richtingen; ze kunnen
  wel tot vlak tegen een wand komen. Routes via een richtingenkaart per doel (`src/kern/routes.ts`), gedeeld door de
  hele zwerm. Een klik op water of op land waar je niet kunt komen: zo dichtbij als het kan.
- Grondstoffen liggen alleen op land dat je kunt bereiken; eilanden blijven onbereikbaar. Begaanbaarheid hoort bij een
  manier van bewegen (`Doorgang`), zodat boten of veerponten later kunnen.
- Elke dimensie heeft een eigen tegelset en een plaatje met stukken wand uit `scripts/pixel/terrein.mjs`, met eigen
  water: bruin op Roestduin, gloeiend op Magmaveld, blauw op Aarde (de zesde dimensie).
- Terreinbewerker (F2, testgereedschap): BLOK tilt tegels los van hun buren (wand), HEUVEL neemt de buren mee (helling).

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

Een zwerm muizen (start: **60**), en je krijgt er **nooit** nieuwe bij. Ze minen zelf: elke muis draagt 2 per keer
en graaft 2,5 s. Je selecteert ze in massa (slepen, dubbelklik).
**Machines moeten beter zijn dan muizen** (Thije, 5 nov): muizen graven met de hand alleen de bovenste **15%** van
elke tegel; de rest kan alleen een drill. Een drill doet 1 brok per 0,5 s (2 per s, zoveel als een band draagt), een
muis haalt ongeveer 0,07 per s. Met de hand kom je op gang, daarna moet je boren en banden leggen.

Beeld: een grauwe, duistere industriewereld, niets vrolijks. De muizen zelf klein en heel pluizig (en vuil); hun
robots, wapens en fabrieken gigantisch, hoekig en semi-3D (overcompensatie). Staal, legergroen en bruin, roest, olie
en veel te veel kabels. Neon is het enige felle, en dat gloeit echt (gloedlaag).
Schaal is belangrijk: geen of weinig gebouwen, vooral machines, ruim groter dan de muizen (machines 2x2 tegels,
mech 3x3 en ruim tien keer zo hoog als een muis). Mechs menselijk van bouw, wapens over de top. Sprites komen uit
`scripts/pixel/muizen.mjs`; bekijk ze samen met `?proto=muizen`.

**Taal (5 nov):** alle tekst in het spel is Engels; code, docs en commits blijven Nederlands. Paneel en bouwmenu zijn
pixelart, maar de letters worden scherp getekend met een echt lettertype (`src/muizen/letters.ts`).

**Stroomnet (trucje van de muizen, herzien 3 nov):** alleen de muizen beheren stroom; de otters krijgen iets anders.
Energie gaat om keuzes, niet om alles overeind houden. Er is geen zekering en geen storing meer.
- **Looprad (WHEEL, 5 nov):** de eerste bron is een gigantisch hamsterrad. Geen brandstof: muizen rennen erin (3/6/10
  muizen voor laag/normaal/overladen, 2/4/7 kW). Te weinig renners = minder stroom. Muizen die rennen graven en bouwen niet.
- Bronnen verbranden grondstof uit de opslag (in beeld: WOOD BURNER, DYNAMO, REACTOR): houtbrander (hout, 2/4/7 kW per stand laag/normaal/overladen), dynamo
  (schroot, 3/5/9), reactor (kristal, 6/10/16). Je begint met het looprad. Houtbrander (4 platen + 4 balken) en dynamo (5 platen + 2 balken) moet je
  eerst bouwen; de reactor komt alleen uit loot. Per MK meer stroom (x1, 1,7, 2,5) en meer brandstof.
- **Overladen** mag altijd: veel stroom, maar de bron wordt heet. Daarna is hij tijdelijk zwakker (tot 50% bij volle
  hitte) tot hij is afgekoeld. Koeling laat sneller afkoelen.
- Verbruikers staan op volgorde van voorrang: machine (4 kW, precies wat het looprad op normaal geeft), industrie (fabricator, boren, banden), lampen (2 kW,
  muizen graven sneller), koeling (1 kW). Wat niet past krijgt niets; met **^** schuif je iets omhoog. Het paneel
  noemt de eerste die tekort komt. Je kiest dus wat je nu wilt: de machine voeden, of eerst je industrie laten draaien.
- Bediening via een pixelart-paneel linksonder (`src/muizen/paneel.ts`), regels in `src/muizen/energie.ts`,
  getallen in `MUIZEN_ENERGIE` (`src/data/muizen.ts`).

**Industrie (economische lus, 3 nov):** de muizen werken zelf, de speler zet neer en kiest.
- **Onderdelen en fabricators (5 nov):** bouwen kost onderdelen uit de opslag: platen (2 schroot geeft 2) en balken
  (2 hout geeft 1). Die maak je in een **fabricator**, die je zelf bouwt (15 schroot + 10 hout, binnen de ring, 2 kW,
  2 muizen voor volle snelheid). Klik erop en kies rechts in het bouwmenu een recept; hij blijft dat maken tot de opslag
  vol is. Wat eruit komt gaat op een band tegen zijn voet of muizen brengen het naar de opslag. Kosten: boor 3 platen +
  1 balk, band 1 plaat per tegel, paal 1 balk, stapel 4 balken, dynamo 5 platen + 2 balken. Je begint met 4 platen en
  2 balken. Het bouwmenu rechts laat per ding zien wat het kost (groen = genoeg, rood = te weinig).
- **Alles wordt gebracht (5 nov):** neerzetten kan altijd; muizen halen de bouwspullen uit de opslag (of een stapel) en
  brengen ze naar de bouwplek, pas dan bouwen ze (balkje: cyaan = gebracht, geel = gebouwd). Een fabricator krijgt zijn
  grondstof ook gebracht, door muizen of een band die erin loopt (tot 3 keer het recept). Wat hij maakt gaat via band of
  muizen naar de opslag. Brengen en bouwen gaat voor zelf graven: ook gravende muizen worden ervoor weggehaald.
  Wat nodig is pakken ze waar het het dichtst bij het doel ligt: opslag/stapel, op de grond bij een drill of
  fabricator (zijn buffer), of van een belt (Thije, 5 nov).
- **Stockpiles instellen (5 nov):** klik op een stockpile en kies rechts welk goed erin komt (ook platen en balken) en
  de prio (LOW, NORMAL, HIGH). Muizen brengen naar de hoogste prio; die vult zich ook eerst (dan het erf, dan de rest).
  Twee maten: STOCKPILE (2x2, 4 balken, +150) en SMALL PILE (1 tegel, 1 balk, +40). Eén goed per stockpile.
  Een band naast een stockpile die er niet in loopt, trekt er goed uit: zo zet je voorraad weer op een band.
- **Velden (5 nov):** weinig velden die veel geven (schroot 3 velden x 200 per tegel, hout 3 x 150, kristal 2 x 80), en
  een boor haalt tot 3 tegels om zich heen. Een boor neerzetten moet de moeite waard zijn (`VELDEN` in dimensies.ts).
- **Muizen werken zelf**, in deze volgorde: bouwplaatsen afbouwen, de fabricator bemannen, boren zonder band
  leeghalen, en anders zelf graven (de grondstof die het leegst is eerst, alleen als er nog plek is). Je kunt muizen
  zelf ergens heen sturen; dan laten ze hun klus los.
- **Palen en kabels**: je begint met een mini-paal bij de machine. Een paal voedt alles binnen 5 tegels en verbindt
  met een paal tot 8 tegels verder. Wat niet aan het net hangt, krijgt geen stroom. Kabels lopen zichtbaar van paal
  naar paal en naar de gebouwen.
- **Boor** (2x2, 2 kW): de machine gooit hem in een boog naast een veld. Hij graaft uit de tegels rond zijn voet en
  houdt er hooguit 12 vast. Met een band erop gaan de brokken vanzelf; zonder band halen muizen ze op.
- **Band** (0,05 kW per tegel, 2 tegels/s): slepen legt een pad met één bocht. Een band die doodloopt naast een nieuw
  stuk draait er vanzelf naartoe. Lompe muizenband: één brok per tegel.
- **Opslag**: hooguit 50 per goed (ook platen en balken). **Stapel** (2x2, binnen de ring) hoort bij één grondstof en geeft +150 daarvan.
  Muizen en banden brengen een grondstof naar zijn eigen stapel. Je ziet de voorraad als bergen (1 hoop = 15).
- **Stream**: alles buiten de ring blijft achter; je krijgt de bouwkosten terug. Binnen de ring blijft alles staan.
- Slopen geeft de bouwkosten terug. Regels in `src/muizen/industrie.ts` en `src/muizen/werk.ts`, beeld en bouwbalk in
  `src/muizen/bouwen.ts`, getallen in `MUIZEN_INDUSTRIE`. De band zit nu in de muizenmap; naar de kern (K5) zodra de
  otters ook banden willen.

### Otters (Lieuwe)
Getallen in `src/data/otters.ts` (nog te maken).

## Open
- Tegen de computer (aanname) of tweespeler op één scherm?
- Energie en heelheid: hoeveel nodig per stream?
