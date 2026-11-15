# Taken

Pak je een taak op: zet eerst je naam erachter in je PR. Klaar: `- [x] … (#PR)`.

## Kern (samen)
- [x] K1 Repo, uitrol, hello world met iso-veld en één sprite
- [x] K2 Eiland van de speler op het iso-veld, camera (Thije)
- [ ] K3 Eén dimensie met streamtimer en sprong: transportring, sprong door het niets, 5 werelden (Thije)
- [ ] K4 Machine-energie en heelheid; verliezen bij gemiste stream
- [ ] K5 Lopende banden: leggen, goederen bewegen, gebouwen in/uit (zie DESIGN.md, Logistiek)
- [ ] K6 Recepten draaien in gebouwen; eind van de keten voedt de machine
- [ ] K7 Terrein stap 1: hoogtekaart met heuvels per dimensie; eenheden, grondstoffen en klikken volgen de hoogte (Lieuwe)
- [ ] K8 Terrein stap 2: water en klippen, onbegaanbaar, routes zoeken, grondstoffen altijd bereikbaar (Lieuwe)
- [ ] K9 Terrein stap 3: tekenscript voor tegelsets per dimensie, met eigen water en dimensie Aarde (Lieuwe, alle zes staan erin)
- [ ] K10 Kaartgroottes: 256x64, 128x128 enzovoort, ook niet-vierkant (Lieuwe; werkt, nog geen wereld gebruikt het)

## Pack rats (voorheen muizen; Thije)
- [x] M0 Speelbare basis: startmenu met factiekeuze, kaart met grondstoffen, opslag en machine, 300 muizen
  in massa selecteren en laten graven (Thije)
- [x] M0 Visuele proto: muizen, mech, fabriek, machines en kabels als sprites, scène op `?proto=muizen`
- [ ] M1 Spellus en machine-energie (met K3/K4). Stroomnet + paneel: thije/energiepaneel (Thije)
- [ ] M1b Economische lus: boor gooien, lompe band, fabricator (te bouwen, recepten), onderdelen, bouwmenu, palen met kabels, stapel per grondstof, muizen werken zelf, energie als keuze, Engels in beeld (Thije)
- [ ] M2 4 eenheden, loot-tabel, inbouwen/ontleden

## Economie (Lieuwe)
De otters zijn vervallen (O1, O2): er is één soort, de pack rats, en elke wereld heeft een eigen economie.
- [ ] E1 Eén soort: factiekeuze weg, `src/muizen` → `src/ratten`, grotere rattensprite (Lieuwe, branch `lieuwe/economy`)
- [ ] E2 Wereldtypes en economieën als JSON (`worldtypes/`, `economies/`), lader met controle (Lieuwe, zelfde branch)
- [ ] E3 Generieke gebouwen uit de economie: productie, winning, magazijn, splitter, merger, band, paal; opslag in volume (Lieuwe, zelfde branch)
- [ ] E4 Economie per wereld bij de sprong, startkapitaal per economie (Lieuwe, zelfde branch)
- [ ] E5 Zes economieën, één per wereldtype: elke wereld een eigen weg naar platen en balken (Lieuwe, zelfde branch)
- [ ] E6 Balans van de zes economieën; langere ketens per wereld

## Planning
- Week 1 (t/m 8 nov): repo, uitrol, iso-veld met eiland, één dimensie, streamtimer
- Week 2 (t/m 15 nov): speelbaar van begin tot eind
- Week 3 (t/m 22 nov): 3 tot 4 dimensies met elk een eigen regel (de SHIFT), balans
- Week 4 (t/m 29 nov): polish, geluid, tutorial, itch-pagina
- 30 nov–1 dec: buffer, alleen inleveren (deadline 1 dec 22:37)

## Later-lijst (niet bouwen tenzij alles af is)
- Bruggen en sorteerders voor banden
- Brandstof voor de stroombronnen per economie (nu stoken ze alleen hout, schroot en kristal)
- De grondstoffen die de generator rolt (`aanbod`: metaal, hout, water, steen) koppelen aan `onMap` in de economie
- Plaatjes: elk goed heeft een hoopje, een brokje en (als het op de kaart ligt) een veld in `assets/goederen/` (PixelLab,
  30 generaties). Nog te maken: de rat met een lading op de rug voor elk goed, en de nieuwe gebouwen;
- Voorrang en een filter per magazijn (de stapel per goed met prioriteit is vervallen)
- Boten of veerponten over water
- Online tweespeler, meer dan twee facties, opslaan midden in een run, verhaal
