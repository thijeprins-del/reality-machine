// Getallen van de pack rats. Zie DESIGN.md.
import type { Soort } from '../kern/types';
import { energieTrucje, type EnergieGetallen } from '../ratten/energie';
import { industrieTrucje, type IndustrieGetallen } from '../ratten/industrie';
import { werkTrucje } from '../ratten/werk';

// --- Balansknoppen ---
const AANTAL_MUIZEN = 60; // je krijgt er nooit meer bij
const DRAAGT = 2; // grondstof per keer sjouwen
const GRAAF_SEC = 2.5; // zo lang graaft een muis voor één lading
const HAND_DEEL = 0.15; // muizen graven met de hand alleen de bovenste 15% van elke tegel; de rest kan alleen een drill

// Stroomnet van de muizen (src/ratten/energie.ts). Bronnen verbranden grondstof uit de opslag.
// Draait om keuzes: wat zet je aan, en overlaad je nu (meer stroom) ten koste van straks (een tijd zwakker)?
export const RATTEN_ENERGIE: EnergieGetallen = {
  // stroom/verbruik per stand: LAAG, NORMAAL, OVERLADEN. mk = waarmee je begint (0 = nog niet gebouwd);
  // bouw[i] = kosten om naar MK i+1 te gaan; loot = alleen uit loot te krijgen (nog niet in het spel).
  bronnen: [
    // looprad: de eerste bron. Muizen rennen erin; geen brandstof, wel muizen die niet graven of bouwen.
    { id: 'rad', naam: 'WHEEL', kort: 'WHEEL', renners: [3, 6, 10], kleur: '#ffd23f', stroom: [2, 4, 7], verbruik: [0, 0, 0],
      mk: 1, bouw: [{}, { plaat: 6, balk: 3 }, { plaat: 14, kristal: 10 }] },
    { id: 'houtbrander', naam: 'WOOD BURNER', kort: 'WOOD', brandstof: 'hout', kleur: '#ff5a2a', stroom: [3, 5, 8], verbruik: [0.06, 0.12, 0.25],
      mk: 0, bouw: [{ plaat: 4, balk: 4 }, { plaat: 8, balk: 4 }, { plaat: 14, kristal: 10 }] },
    { id: 'dynamo', naam: 'DYNAMO', kort: 'DYNAMO', brandstof: 'schroot', kleur: '#ff9a1f', stroom: [3, 5, 9], verbruik: [0.08, 0.15, 0.3],
      mk: 0, bouw: [{ plaat: 5, balk: 2 }, { plaat: 10, balk: 3 }, { plaat: 18, kristal: 15 }] },
    { id: 'reactor', naam: 'REACTOR', kort: 'REACTOR', brandstof: 'kristal', kleur: '#4ef2ff', stroom: [6, 10, 16], verbruik: [0.03, 0.06, 0.12],
      mk: 0, loot: true, bouw: [{}, {}, {}] },
  ],
  mkMaal: { stroom: [1, 1.7, 2.5], verbruik: [1, 1.4, 1.9] }, // per MK
  overladen: { hitte: 8, af: 3, afKoeling: 9, zwakTot: 0.5 }, // hitte/s erbij bij overladen, eraf normaal en met koeling; bij 100 hitte levert hij nog maar 50%
  vraag: { machine: 4, koeling: 1, lampen: 2 }, // machine = wat het looprad op NORMAL geeft (Thije, 5 nov)
  lampenSneller: 0.6,
};

// Industrie (src/ratten/industrie.ts en werk.ts). Welke gebouwen er zijn, wat ze kosten en wat ze maken staat in de
// economie van een wereld (economies/*.json); hier alleen wat voor elke economie geldt.
export const RATTEN_INDUSTRIE: IndustrieGetallen = {
  vliegSec: 1.3, // zo lang vliegt een winningsgebouw van de machine naar zijn veld
  hoop: 15, // zoveel is één hoop in beeld
  ploegBouw: 3, // zoveel ratten tegelijk op één bouwplek
  machineBereik: 7, // zo ver om de machine is er stroom zonder paal
  invoerKeer: 3, // een gebouw wil invoer hebben liggen voor zoveel keer zijn recept
  kruispunt: 4, // zoveel stuks houdt een splitter of merger vast
};

export const RATTEN: Soort = {
  naam: 'Pack Rats',
  startMachine: { energie: 0, maxEnergie: 100, heelheid: 100, maxHeelheid: 100 },
  eenheden: [
    {
      soort: 'muis',
      naam: 'Pack Rat',
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
const stroomnet = energieTrucje(RATTEN_ENERGIE, RATTEN.eenheden);
const industrie = industrieTrucje(RATTEN_INDUSTRIE);
const werk = werkTrucje(RATTEN.eenheden, HAND_DEEL);
RATTEN.trucje = {
  naam: 'Stroomnet',
  opTik: (s, sec) => {
    werk.opTik?.(s, sec); // muizen kiezen zelf werk
    stroomnet.opTik?.(s, sec);
    industrie.opTik?.(s, sec);
  },
  opStream: (s) => industrie.opStream?.(s),
};
