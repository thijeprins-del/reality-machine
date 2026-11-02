// Getallen van de muizen (Thije). Zie DESIGN.md, "Muizen".
import type { Factie } from '../kern/types';
import { energieTrucje, type EnergieGetallen } from '../muizen/energie';

// --- Balansknoppen ---
const AANTAL_MUIZEN = 300; // je krijgt er nooit meer bij
const DRAAGT = 2; // grondstof per keer sjouwen
const GRAAF_SEC = 2.5; // zo lang graaft een muis voor één lading

// Stroomnet van de muizen (src/muizen/energie.ts). Bronnen verbranden grondstof uit de opslag.
export const MUIZEN_ENERGIE: EnergieGetallen = {
  bronnen: [
    { id: 'dynamo', naam: 'DYNAMO', brandstof: 'schroot', kleur: '#ff9a1f', stroom: [3, 5, 7], verbruik: [0.1, 0.18, 0.3], warmte: [1.5, 3, 5.5] },
    { id: 'ketel', naam: 'KETEL', brandstof: 'hout', kleur: '#ff5a2a', stroom: [2, 3, 4], verbruik: [0.08, 0.13, 0.2], warmte: [1, 2, 3.2] },
    { id: 'reactor', naam: 'REACTOR', brandstof: 'kristal', kleur: '#4ef2ff', stroom: [5, 8, 11], verbruik: [0.04, 0.07, 0.11], warmte: [3, 5.5, 9] },
  ],
  vraag: { machine: 6, koeling: 2, lampen: 3 },
  koeling: 4.5,
  lampenSneller: 0.6,
  zekeringSec: 3,
  storingTot: 35,
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
  band: { naam: 'Muizenband', tegelsPerSec: 2, kosten: { schroot: 1 } },
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
MUIZEN.trucje = energieTrucje(MUIZEN_ENERGIE, MUIZEN.eenheden);
