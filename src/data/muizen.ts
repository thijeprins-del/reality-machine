// Getallen van de muizen (Thije). Zie DESIGN.md, "Muizen".
import type { Factie } from '../kern/types';
import { energieTrucje, type EnergieGetallen } from '../muizen/energie';
import { industrieTrucje, type IndustrieGetallen } from '../muizen/industrie';

// --- Balansknoppen ---
const AANTAL_MUIZEN = 300; // je krijgt er nooit meer bij
const DRAAGT = 2; // grondstof per keer sjouwen
const GRAAF_SEC = 2.5; // zo lang graaft een muis voor één lading
const BOOR_SEC = 1.5; // zo lang doet een boor over één brok bij volle stroom (een muis: 2,5 s per 2, plus lopen)

// Stroomnet van de muizen (src/muizen/energie.ts). Bronnen verbranden grondstof uit de opslag.
export const MUIZEN_ENERGIE: EnergieGetallen = {
  // mk = waarmee je begint (0 = nog niet gebouwd). bouw[i] = kosten om naar MK i+1 te gaan.
  bronnen: [
    { id: 'dynamo', naam: 'DYNAMO', brandstof: 'schroot', kleur: '#ff9a1f', stroom: [3, 5, 7], verbruik: [0.1, 0.18, 0.3], warmte: [1.5, 3, 5.5],
      mk: 1, bouw: [{}, { schroot: 40 }, { schroot: 90, kristal: 10 }] },
    { id: 'ketel', naam: 'KETEL', brandstof: 'hout', kleur: '#ff5a2a', stroom: [2, 3, 4], verbruik: [0.08, 0.13, 0.2], warmte: [1, 2, 3.2],
      mk: 0, bouw: [{ schroot: 25, hout: 10 }, { schroot: 50, hout: 20 }, { schroot: 90, kristal: 10 }] },
    { id: 'reactor', naam: 'REACTOR', brandstof: 'kristal', kleur: '#4ef2ff', stroom: [5, 8, 11], verbruik: [0.04, 0.07, 0.11], warmte: [3, 5.5, 9],
      mk: 0, bouw: [{ schroot: 60, kristal: 20 }, { schroot: 100, kristal: 30 }, { schroot: 160, kristal: 50 }] },
  ],
  // per MK: stroom, brandstof en hitte maal dit
  mkMaal: { stroom: [1, 1.7, 2.5], verbruik: [1, 1.4, 1.9], warmte: [1, 1.25, 1.5] },
  vraag: { machine: 6, koeling: 2, lampen: 3 },
  koeling: 4.5,
  lampenSneller: 0.6,
  zekeringSec: 3,
  storingTot: 35,
};

// Industrie van de muizen (src/muizen/industrie.ts): boren gooien, banden leggen, opslag uitbreiden.
export const MUIZEN_INDUSTRIE: IndustrieGetallen = {
  boor: { kosten: { schroot: 30 }, kW: 2, sec: BOOR_SEC, buffer: 6, bereik: 1, vliegSec: 1.3 },
  band: { kosten: { schroot: 1 }, kW: 0.05, tegelsPerSec: 2 },
  stapel: { kosten: { schroot: 25, hout: 10 }, extra: 120 },
  opslagMax: 150, // per grondstof, zonder stapelplaatsen
  hoop: 15, // zoveel grondstof is één hoop in beeld
};

export const MUIZEN: Factie = {
  id: 'muizen',
  naam: 'Muizen',
  startMachine: { energie: 0, maxEnergie: 100, heelheid: 100, maxHeelheid: 100 },
  startVoorraad: { schroot: 40, hout: 20, kristal: 0 },
  streamKosten: {}, // nog te bepalen (K4, K6)
  gebouwen: [
    { soort: 'machine', naam: 'Reality machine', hp: 1000, kosten: {}, breed: 4, diep: 4 },
    { soort: 'opslag', naam: 'Opslag', hp: 200, kosten: {}, breed: 2, diep: 2 },
  ],
  recepten: [],
  band: { naam: 'Muizenband', tegelsPerSec: MUIZEN_INDUSTRIE.band.tegelsPerSec, kosten: MUIZEN_INDUSTRIE.band.kosten },
  startRecepten: [],
  eenheden: [
    {
      soort: 'muis',
      naam: 'Muis',
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
MUIZEN.trucje = {
  naam: 'Stroomnet',
  opTik: (s, sec) => {
    stroomnet.opTik?.(s, sec);
    industrie.opTik?.(s, sec);
  },
  opStream: (s) => industrie.opStream?.(s),
};
