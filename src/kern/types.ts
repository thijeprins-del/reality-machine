// Het contract tussen kern en facties. De kern kent alleen deze types, nooit muizen- of ottercode.
// Nieuw veld nodig? Kleine aparte PR op dit bestand, de ander kijkt mee. Zie DESIGN.md, "Samenwerking facties".
import type { SpelStaat } from './spel';

export type FactieId = 'muizen' | 'otters';

// Grondstoffen zijn voor beide facties dezelfde, zodat loot en dimensies niet per factie dubbel hoeven.
// Asymmetrie zit in wat je ermee doet, niet in de namen.
export type Grondstof = 'schroot' | 'hout' | 'kristal';
export type Voorraad = Record<Grondstof, number>;

// De reality machine. Betekent voor beide facties hetzelfde: de stream meet energie en heelheid.
export interface Machine {
  energie: number;
  maxEnergie: number;
  heelheid: number;
  maxHeelheid: number;
}

// Een soort eenheid (de data). Een eenheid op het veld verwijst ernaar met `soort`.
export interface EenheidSoort {
  soort: string;
  naam: string;
  hp: number;
  schade: number;
  bereik: number; // in tegels
  snelheid: number; // tegels per seconde
  kosten: Partial<Voorraad>;
}

export interface GebouwSoort {
  soort: string;
  naam: string;
  hp: number;
  kosten: Partial<Voorraad>;
  opbrengst?: Partial<Voorraad>; // per minuut
}

// Een vondst kun je inbouwen (direct effect) of ontleden (bouwplan of grondstoffen). Tech komt alleen hiervandaan.
export interface VondstSoort {
  soort: string;
  naam: string;
  waarde: number;
  inbouwen?: string; // soort eenheid/gebouw/effect dat vrijkomt
  ontleden?: Partial<Voorraad>;
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
  eenheden: EenheidSoort[];
  gebouwen: GebouwSoort[];
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
}

export interface Vondst {
  soort: string;
  x: number;
  y: number;
}
