// Een hele run: 8 shiften plus een finale. Alles hier is een balansknop. Zie DESIGN.md, "Run".
import type { Archetype } from '../kern/types';

export const RUN_SHIFTS = 8; // dimensie 1..8
export const FINALE = RUN_SHIFTS + 1; // dimensie 9: de laatste stream haal je of niet

// De drie kerndimensies staan vast aan het begin van elke run (Steentijd, Insecten, Reuzen); daarna rolt de generator.
export const KERN_DIMENSIES: Archetype[] = ['steentijd', 'insecten', 'reuzen'];
export const FINALE_TYPE: Archetype = 'tentakelbeest';
export const FINALE_WRATH = 80; // de finale begint op WRATHFUL

// Hoe een type aanvalt. Standaard (geen stijl): gewone overvallers uit het Wrath-stadium.
export interface AanvalStijl {
  elke: number; // maal het interval van het stadium (kleiner = vaker)
  aantal: number; // maal het aantal van het stadium
  hp: number; // maal OVERVAL_HP
  snelheid: number; // maal OVERVAL_SNELHEID
  schade: number; // maal OVERVAL_SCHADE
  stilTot?: number; // geen overvallen onder dit Wrath
  vast?: number; // altijd zoveel overvallers per overval, ongeacht het stadium
}
// De aanvalsstijl per type staat bij de vijand in worldtypes/archetypes/<type>.json ("enemy.attack").

// Winnen of verliezen
export interface Uitkomst {
  gewonnen: boolean;
  reden: string;
}
