// Getallen van de muizen (Thije). Zie DESIGN.md, "Muizen".
import type { Factie } from '../kern/types';
import { energieTrucje, type EnergieGetallen } from '../muizen/energie';
import { industrieTrucje, type IndustrieGetallen } from '../muizen/industrie';
import { werkTrucje } from '../muizen/werk';

// --- Balansknoppen ---
const AANTAL_MUIZEN = 300; // je krijgt er nooit meer bij
const DRAAGT = 2; // grondstof per keer sjouwen
const GRAAF_SEC = 2.5; // zo lang graaft een muis voor één lading
const BOOR_SEC = 1.5; // zo lang doet een boor over één brok bij volle stroom (een muis: 2,5 s per 2, plus lopen)

// Stroomnet van de muizen (src/muizen/energie.ts). Bronnen verbranden grondstof uit de opslag.
// Draait om keuzes: wat zet je aan, en overlaad je nu (meer stroom) ten koste van straks (een tijd zwakker)?
export const MUIZEN_ENERGIE: EnergieGetallen = {
  // stroom/verbruik per stand: LAAG, NORMAAL, OVERLADEN. mk = waarmee je begint (0 = nog niet gebouwd);
  // bouw[i] = kosten om naar MK i+1 te gaan; loot = alleen uit loot te krijgen (nog niet in het spel).
  bronnen: [
    { id: 'houtbrander', naam: 'WOOD BURNER', kort: 'WOOD', brandstof: 'hout', kleur: '#ff5a2a', stroom: [2, 4, 7], verbruik: [0.06, 0.12, 0.25],
      mk: 1, bouw: [{}, { plaat: 6, balk: 3 }, { plaat: 14, kristal: 10 }] },
    { id: 'dynamo', naam: 'DYNAMO', kort: 'DYNAMO', brandstof: 'schroot', kleur: '#ff9a1f', stroom: [3, 5, 9], verbruik: [0.08, 0.15, 0.3],
      mk: 0, bouw: [{ plaat: 5, balk: 2 }, { plaat: 10, balk: 3 }, { plaat: 18, kristal: 15 }] },
    { id: 'reactor', naam: 'REACTOR', kort: 'REACTOR', brandstof: 'kristal', kleur: '#4ef2ff', stroom: [6, 10, 16], verbruik: [0.03, 0.06, 0.12],
      mk: 0, loot: true, bouw: [{}, {}, {}] },
  ],
  mkMaal: { stroom: [1, 1.7, 2.5], verbruik: [1, 1.4, 1.9] }, // per MK
  overladen: { hitte: 8, af: 3, afKoeling: 9, zwakTot: 0.5 }, // hitte/s erbij bij overladen, eraf normaal en met koeling; bij 100 hitte levert hij nog maar 50%
  vraag: { machine: 6, koeling: 1, lampen: 2 },
  lampenSneller: 0.6,
};

// Industrie van de muizen (src/muizen/industrie.ts en werk.ts): fabricators, boren, banden, palen, stapels.
// werk = muis-seconden bouwen op de plek. bouw = wat het neerzetten kost uit de opslag (grondstof en onderdelen).
// Onderdelen maak je in een fabricator: klik erop en kies een recept. Wat eruit komt gaat naar de opslag.
export const MUIZEN_INDUSTRIE: IndustrieGetallen = {
  boor: { kW: 2, sec: BOOR_SEC, buffer: 12, bereik: 1, vliegSec: 1.3, werk: 8 },
  band: { kW: 0.05, tegelsPerSec: 2, werk: 1.2 },
  paal: { link: 8, bereik: 5, werk: 3 }, // palen verbinden tot 8 tegels, geven stroom tot 5 tegels
  stapel: { extra: 150, werk: 6 },
  fabricator: { kW: 2, ploeg: 2, buffer: 6, werk: 10 }, // ploeg = muizen voor volle snelheid
  bouw: {
    fabricator: { schroot: 15, hout: 10 },
    boor: { plaat: 3, balk: 1 },
    band: { plaat: 1 }, // per tegel
    paal: { balk: 1 },
    stapel: { balk: 4 },
  },
  recepten: {
    plaat: { in: { schroot: 2 }, uit: 2, sec: 3 },
    balk: { in: { hout: 2 }, uit: 1, sec: 3 },
  },
  opslagMax: 50, // per goed in de opslag zelf; meer grondstof = een stapel per grondstof
  hoop: 15, // zoveel is één hoop in beeld
  ploegBouw: 3, // zoveel muizen tegelijk op één bouwplek
};

export const MUIZEN: Factie = {
  id: 'muizen',
  naam: 'Mice',
  startMachine: { energie: 0, maxEnergie: 100, heelheid: 100, maxHeelheid: 100 },
  startVoorraad: { schroot: 40, hout: 40, kristal: 0, plaat: 4, balk: 2 },
  streamKosten: {}, // nog te bepalen (K4, K6)
  gebouwen: [
    { soort: 'machine', naam: 'Reality machine', hp: 1000, kosten: {}, breed: 4, diep: 4 },
    { soort: 'opslag', naam: 'Stock', hp: 200, kosten: {}, breed: 2, diep: 2 },
  ],
  recepten: [],
  band: { naam: 'Mouse belt', tegelsPerSec: MUIZEN_INDUSTRIE.band.tegelsPerSec, kosten: MUIZEN_INDUSTRIE.bouw.band },
  startRecepten: [],
  eenheden: [
    {
      soort: 'muis',
      naam: 'Mouse',
      hp: 3,
      schade: 0,
      bereik: 0,
      snelheid: 1.6,
      kosten: {},
      werk: { draagt: DRAAGT, mijnSec: GRAAF_SEC },
    },
  ],
  startEenheden: { muis: AANTAL_MUIZEN },
  vondsten: [],
  loot: [],
  trucje: { naam: 'Stroomnet' }, // wordt hieronder het echte trucje
};
const stroomnet = energieTrucje(MUIZEN_ENERGIE, MUIZEN.eenheden);
const industrie = industrieTrucje(MUIZEN_INDUSTRIE);
const werk = werkTrucje(MUIZEN.eenheden);
MUIZEN.trucje = {
  naam: 'Stroomnet',
  opTik: (s, sec) => {
    werk.opTik?.(s, sec); // muizen kiezen zelf werk
    stroomnet.opTik?.(s, sec);
    industrie.opTik?.(s, sec);
  },
  opStream: (s) => industrie.opStream?.(s),
};
