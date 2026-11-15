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
- Tech: elke economie heeft een kleine techboom. In de knutselwerkplaats maak je research packs uit grondstoffen en
  daarmee koop je in het bouwmenu gebouwen en recepten van een hoger tier vrij (Lieuwe, 15 nov; was: "alleen uit loot,
  geen techboom"). Loot kan daar later bovenop komen.
- **Het spel draait om industrie:** een zo groot mogelijke fabriek met lange productieketens op je eiland.
  Gevechten zijn bijzaak en kort.
- Ketens: ruwe grondstof uit de dimensie → tussenproducten → eindproduct dat de machine voedt (`streamKosten`).
  Nieuwe gebouwen en recepten komen alleen uit loot, zo groeit de keten per dimensie.
- **Logistiek: lopende banden** (keuze Thije, 2 nov). Gebouwen nemen invoer van een band die erin loopt en zetten
  uitvoer op een band die eruit wijst. De indeling van je eiland is de puzzel.
  Klein houden: één goed per bandtegel, rechtdoor en bochten; splitter en merger zijn gebouwen van één tegel.
  Geen bruggen of sorteerders (later-lijst). De band is zelf een gebouw uit de economie (snelheid, kosten).
- Winnen: de tegenstander zo meppen dat zijn machine de volgende stream niet haalt, vooral door zijn keten te breken.

## Kaart en grondstoffen (basis, 2 nov)
- Kaart van standaard **64 x 64 tegels**: de schijf in het midden, ruim wereld eromheen. Getallen in `src/data/dimensies.ts`.
  Elke wereld kan een eigen maat hebben (`kaart` in `DIMENSIES`, minstens 48), ook niet-vierkant; om te proberen: `?kaart=256x64`
  of `?kaart=256x64,128x128` om de beurt. Een grotere wereld heeft meer velden, over de hele kaart verspreid.
- In het midden de reality machine (4x4 tegels) en de opslag (2x2), binnen de gele ring (bouwgrond, geen grondstoffen).
- Velden met ruwe grondstoffen eromheen. Welke er liggen, hoeveel velden en hoeveel per tegel staat in de economie van
  de wereld (`economies/*.json`, `"onMap"` en `"fields"`).
- Werkers (eenheden met `werk`) graven een lading, sjouwen die naar de opslag en gaan terug, tot het veld op is;
  dan zoeken ze binnen 8 tegels verder. Rechte lijnen, alleen om de machine heen. Geen botsingen tussen werkers.
- Start: geen menu. Je speelt de pack rats en begint met de machine, het magazijn en het startkapitaal van de economie
  van de eerste wereld.

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

## Eén soort, een economie per wereld (Lieuwe, 15 nov)
Er is één soort: de **pack rats**, hamsterende ratten (voorheen de muizen; de otters zijn vervallen). Wat verschilt is de
wereld. Het spel leest twee mappen met JSON-bestanden, zodat je kunt schaven zonder code:

- **`worldtypes/<id>.json`**: een wereldtype: naam, tegelset (`tileset`, een van de sets in `src/kern/tegels.ts`),
  kleuren, heuvels en de economie (`economy`). De generator rolt een tegelset en kiest een wereldtype met die tegelset.
- **`economies/<id>.json`**: een economie, in het formaat van de sandbox (`tools/economy.html`):
  - `resources`: goederen met `id`, `name`, `color`, `volume`, optioneel `sprite`. Met `"onMap": true` ligt het goed als
    veld op de kaart (`fields`: aantal velden, tegels per veld, hoeveelheid per tegel, afstand tot de machine).
  - `recipes`: `inputs` → `outputs` in `time` seconden. Zonder invoer is het een winning.
  - `buildings`: wat je kunt bouwen. Het gedrag komt uit de soort: productie (met `recipes`), winning (`onDeposit`: staat
    bij een veld en draait het recept dat dat veld geeft), magazijn (`sink`), vernietiger (`trash`), `splitter`,
    `merger`, band (`belt`) en paal (`pole`). Verder kosten, bouwtijd (`work`), maat (`size` 1 of 2), stroom (`kW`),
    ploeg (`crew`), `insideRing` en `sprite`. Nieuw gedrag vraagt code; een nieuw gebouw niet.
  - `startingResources`: het startkapitaal. `settings.warehouseStorage`: het volume van het magazijn waarmee je begint.
- **Lezen en controleren**: `src/kern/economie.ts` en `src/kern/wereldtypes.ts`, bij het laden van het spel. Een fout
  (onbekend recept, onbekende tegelset) laat `npm test` falen met de melding. Een nieuw bestand moet ook in de lijst in
  `economies/index.ts` of `worldtypes/index.ts`.
- **Een goed is zijn id.** Naam, kleur en plaatje horen bij de economie. Twee economieën mogen hetzelfde id anders
  aankleden ("water" hier, "Murky water" daar): elk recept dat `water` vraagt neemt beide. Alleen `volume` moet gelijk zijn.
- **Aansluitpunten** (`poortenVan` in `src/ratten/industrie.ts`), zoals in de sandbox: eerst invoer links, uitvoer rechts; met R draai je ze een kwartslag (`draai` op het gebouw). In
  beeld is links de zuid- en de westkant van het gebouw, rechts de oost- en de noordkant. Elk goed van het recept krijgt om
  de beurt een tegel: een band levert alleen af op de ingang van zijn goed, en een band die op een uitgang begint draagt
  alleen dat product. Een winningsgebouw geeft af aan alle kanten (het staat tegen zijn veld). De punten staan altijd in
  beeld als pijlen in de kleur van het goed. Ratten sjouwen alleen wat geen band heeft.
- **Opslag**: één voorraad, gemeten in volume. Het magazijn van het begin plus elk gebouwd magazijn geeft ruimte voor
  alles. Ratten graven een grondstof met de hand tot haar deel van de opslag (ruimte gedeeld door het aantal goederen).
- **De sprong**: de voorraad blijft, gebouwen binnen de ring blijven staan en werken door (een gebouw onthoudt uit welke
  economie het komt), alles buiten de ring wordt ingepakt. Het bouwmenu toont de gebouwen van de nieuwe wereld. De eerste
  keer in een economie krijg je haar startkapitaal erbij, één keer per run.
- **Tiers en onderzoek** (15 nov). Gebouwen en recepten hebben een `tier` (standaard 1) en, boven tier 1, een prijs
  `unlock` in research packs. Tier 1 is vrij: mijnen en oogsters, branders, band, paal, magazijnen, de werkplaats en de
  basisfabrieken met hun eerste recepten. Daarboven koop je elk gebouw en elk recept apart vrij in het bouwmenu; iets
  van tier N kan pas als er iets van tier N-1 vrij is. Nu op slot: splitter en merger (12 packs) en de tweede routes
  (8 packs).
  De **knutselwerkplaats** (`"workshop": true`) is een productiegebouw zonder eigen recepten: de lader maakt er een
  voor elk goed met `"research": { "per": 4, "packs": 1 }` (4 stuks geven 1 pack; diepere goederen geven er meer). Je
  kiest wat je onderzoekt zoals je een recept kiest. Het **research pack** (`onderzoek`) bestaat in elke economie en
  heeft `"vaporizes": true`: het verdampt bij de sprong, uit de voorraad, van de banden en uit de gebouwen. Wat je
  hebt vrijgekocht blijft per economie de hele run; in een nieuwe economie begin je weer bij tier 1. De lader eist per
  economie een werkplaats, het goed `onderzoek` en minstens één goed met `research`.
- **Nog geen kunst?** Een gebouw of goed zonder eigen plaatje krijgt een bestaand plaatje in zijn kleur.
- **Stroom** (15 nov): het looprad hoort bij de machine; alle andere stroom komt van **generatoren**, en dat zijn gewone
  productiegebouwen met een recept dat stroom levert: `{ "inputs": { "biomassa": 1 }, "time": 5, "power": 5 }` geeft 5 kW
  zolang het recept draait. Twee brandstoffen bestaan overal, `koolstof` en `biomassa`; elke economie heeft eigen
  recepten om er een van te maken en één brander die haar stookt. Een nieuw soort generator is een regel in het bestand.
  De oude vaste bronnen (houtbrander, dynamo, reactor) en de MK-upgrades zijn vervallen: meer stroom = meer generatoren.
  Overladen bestaat alleen nog voor het looprad.
- **De zes economieën** (één per wereldtype). Overal bouw je met dezelfde twee materialen, `plaat` en `balk`, maar
  hoe je eraan komt verschilt, en niet elke wereld heeft elke grondstof:
  | wereld | economie | ligt er | plaat | balk | brandstof | bijzonder |
  |---|---|---|---|---|---|---|
  | roestduin | `schroot` Junkyard | schroot, oude banden | 2 schroot → 2 | 3 schroot → 1 | koolstof: 2 banden → 2 | geen hout |
  | aarde | `aarde` Homestead | hout, steen, ijzererts | 2 erts + 1 hout → 2 | 2 hout → 1 | biomassa: 1 hout → 2 | geen schroot; magazijn kost steen |
  | gifwoud | `gifwoud` Rotwood Grove | rothout, hars, sporen | 2 hout + 1 hars → 2 | 2 hout → 1 | biomassa: 1 hout → 2, of 2 sporen → 4 | geen metaal |
  | magmaveld | `magmaveld` Foundry | magma-erts, basalt | 2 erts → 2 (+ 1 slak) | 3 basalt → 1 | koolstof: 2 slak → 1, of 3 basalt → 1 | smederij vraagt geen stroom |
  | kristaltoendra | `kristaltoendra` Crystal Tundra | kristal, ijs, één wrak | 2 kristal → 1 | 4 ijs + 1 kristal → 1, of 3 wrak → 1 | koolstof: 2 kristal → 1 | geen hout |
  | zoutzee | `zoutzee` Salt Flats | zout, kelp, wat drijfhout | 3 zout + 1 kelp → 2 | 4 kelp → 1, of 2 drijfhout → 1 | biomassa: 1 kelp → 2 | bijna geen hout |
  Banden, palen, magazijnen, splitter en merger kosten overal plaat en balk, dus wat je meeneemt blijft bruikbaar.
  De viseconomie uit de sandbox was een voorbeeld en zit niet in het spel (wel nog in `tools/economy.html`).

## Pack rats (voorheen muizen)
De industriegetallen in dit hoofdstuk (kosten, recepten, boor, band, paal, stapel) staan sinds 15 nov in
`economies/schroot.json`; de opslag is één voorraad in volume in plaats van 50 per goed.
Cyberpunk/dieselpunk, tech-heavy. Getallen in `src/data/ratten.ts`.

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
pixelart, maar de letters worden scherp getekend met een echt lettertype (`src/ratten/letters.ts`).

**Stroomnet (herzien 3 nov):** de ratten beheren stroom.
Energie gaat om keuzes, niet om alles overeind houden. Er is geen zekering en geen storing meer.
- **Looprad (WHEEL, 5 nov):** de eerste bron is een gigantisch hamsterrad. Geen brandstof: muizen rennen erin (3/6/10
  muizen voor laag/normaal/overladen, 2/4/7 kW). Te weinig renners = minder stroom. Muizen die rennen graven en bouwen niet.
- Bronnen: het looprad (2/4/7 kW per stand laag/normaal/overladen; 3, 6 of 10 ratten) en de generatoren uit de economie
  (zie "Eén soort, een economie per wereld"). De houtbrander, dynamo, reactor en de MK-upgrades zijn vervallen (15 nov).
- **Overladen** mag altijd: veel stroom, maar de bron wordt heet. Daarna is hij tijdelijk zwakker (tot 50% bij volle
  hitte) tot hij is afgekoeld. Koeling laat sneller afkoelen.
- Verbruikers staan op volgorde van voorrang: machine (4 kW, precies wat het looprad op normaal geeft), industrie (fabricator, boren, banden), lampen (2 kW,
  muizen graven sneller), koeling (1 kW). Wat niet past krijgt niets; met **^** schuif je iets omhoog. Het paneel
  noemt de eerste die tekort komt. Je kiest dus wat je nu wilt: de machine voeden, of eerst je industrie laten draaien.
- Bediening via een pixelart-paneel linksonder (`src/ratten/paneel.ts`), regels in `src/ratten/energie.ts`,
  getallen in `RATTEN_ENERGIE` (`src/data/muizen.ts`).

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
- Slopen geeft de bouwkosten terug. Regels in `src/ratten/industrie.ts` en `src/ratten/werk.ts`, beeld en bouwbalk in
  `src/ratten/bouwen.ts`, getallen in `economies/schroot.json`.

## Open
- Tegen de computer (aanname) of tweespeler op één scherm?
- Energie en heelheid: hoeveel nodig per stream?
