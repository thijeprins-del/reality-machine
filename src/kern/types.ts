// Het contract tussen kern en facties. De kern kent alleen deze types, nooit muizen- of ottercode.
// Nieuw veld nodig? Kleine aparte PR op dit bestand, de ander kijkt mee. Zie DESIGN.md, "Samenwerking facties".
import type { SpelStaat } from './spel';

export type FactieId = 'muizen' | 'otters';

// Goederen. Ruwe grondstoffen (uit dimensies) zijn voor beide facties dezelfde; tussenproducten en eindproducten
// mag elke factie zelf verzinnen (gewoon een string, bv. 'tandwiel' of 'dambalk'). Goederen reizen over lopende banden.
export type Grondstof = 'schroot' | 'hout' | 'kristal';
export type Goed = Grondstof | (string & {});
export type Voorraad = Partial<Record<Goed, number>>;

// Een stap in een productieketen: een gebouw zet `in` om in `uit` in `sec` seconden.
// Lange ketens = veel recepten achter elkaar. Het eind van de keten voedt de machine (`streamKosten`).
export interface Recept {
  id: string;
  gebouw: string; // soort gebouw dat dit recept draait
  in: Voorraad;
  uit: Voorraad;
  sec: number;
}

// Per factie: hoe snel en duur haar banden zijn. Asymmetrie mag hier (bv. snelle dure muizenbanden).
export interface BandSoort {
  naam: string;
  tegelsPerSec: number;
  kosten: Voorraad;
}

// Logistiek: lopende banden op de tegels van je eiland. De kern beweegt goederen; facties leveren alleen getallen.
// Klein gehouden: één goed per bandtegel, rechtdoor of een bocht, geen splitsers (later-lijst).
export type Richting = 'N' | 'O' | 'Z' | 'W';

export interface Band {
  x: number;
  y: number;
  naar: Richting; // waar de band heen loopt; een bocht ontstaat vanzelf als de vorige band er schuin op uitkomt
  goed?: Goed; // wat er nu op ligt
  voortgang: number; // 0..1 over deze tegel
}

// De reality machine. Betekent voor beide facties hetzelfde: de stream meet energie en heelheid.
export interface Machine {
  energie: number;
  maxEnergie: number;
  heelheid: number;
  maxHeelheid: number;
}

// Een soort eenheid (de data). Een eenheid op het veld verwijst ernaar met `soort`.
// Eenheden zijn bijzaak: het spel draait om industrie, gevechten zijn kort (vooral ketens van de ander saboteren).
export interface EenheidSoort {
  soort: string;
  naam: string;
  hp: number;
  schade: number;
  bereik: number; // in tegels
  snelheid: number; // tegels per seconde
  kosten: Voorraad;
}

export interface GebouwSoort {
  soort: string;
  naam: string;
  hp: number;
  kosten: Voorraad;
  breed: number; // tegels
  diep: number;
  opbrengst?: Voorraad; // per minuut, voor oogstgebouwen zonder invoer
}

// Een vondst kun je inbouwen (direct effect) of ontleden (bouwplan of grondstoffen). Tech komt alleen hiervandaan.
export interface VondstSoort {
  soort: string;
  naam: string;
  waarde: number;
  inbouwen?: string; // gebouw of recept dat vrijkomt: zo groeien de ketens, alleen via loot
  ontleden?: Voorraad;
}

// Kans per vondst, per dimensie-index (0 = alle dimensies).
export interface LootRegel {
  vondst: string;
  kans: number; // gewicht, niet per se 0..1
  dimensie?: number;
}

// Het eigen trucje van een factie: haken die de kern aanroept. Alleen hier mag een factie regels buigen.
export interface Trucje {
  naam: string;
  opTik?: (s: SpelStaat, sec: number) => void;
  opStream?: (s: SpelStaat) => void;
}

// Alles wat een factie aan de kern geeft. Getallen staan in src/data/<factie>.ts.
export interface Factie {
  id: FactieId;
  naam: string;
  startMachine: Machine;
  startVoorraad: Voorraad;
  streamKosten: Voorraad; // wat de machine per stream verbruikt: het eind van de lange keten
  gebouwen: GebouwSoort[];
  recepten: Recept[];
  band: BandSoort;
  startRecepten: string[]; // recept-id's die je vanaf het begin kent; de rest komt uit loot
  eenheden: EenheidSoort[];
  vondsten: VondstSoort[];
  loot: LootRegel[];
  trucje: Trucje;
}

// Dingen op het veld.
export interface Eenheid {
  factie: FactieId;
  soort: string;
  hp: number;
  x: number;
  y: number;
}

export interface Gebouw {
  factie: FactieId;
  soort: string;
  hp: number;
  x: number;
  y: number;
  recept?: string; // wat het nu maakt
  // Een band die het gebouw in loopt is invoer, een band die eruit wijst is uitvoer. Buffer per goed:
  binnen: Voorraad;
  buiten: Voorraad;
}

export interface Vondst {
  soort: string;
  x: number;
  y: number;
}
