// Getallen van de muizen (Thije). Zie DESIGN.md, "Muizen".
import type { Factie } from '../kern/types';

// --- Balansknoppen ---
const AANTAL_MUIZEN = 300; // je krijgt er nooit meer bij
const DRAAGT = 2; // grondstof per keer sjouwen
const GRAAF_SEC = 2.5; // zo lang graaft een muis voor één lading

export const MUIZEN: Factie = {
  id: 'muizen',
  naam: 'Muizen',
  startMachine: { energie: 20, maxEnergie: 100, heelheid: 100, maxHeelheid: 100 },
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
  trucje: { naam: 'Nog geen' },
};
