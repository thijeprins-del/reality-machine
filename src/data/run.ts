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

// Escalation per shift: the land gets meaner the deeper you go. Index = dimension number - 1 (the finale is the last entry).
// druk multiplies the number of raiders per raid and shortens the interval by its square root; eerste is the quiet time
// after landing before the first raid. Wrath at landing also keeps a part of the Wrath you left behind (WRATH_ERFENIS).
export const ESCALATIE: { druk: number; eerste: number }[] = [
  { druk: 0.55, eerste: 60 }, // 1: learning the controls
  { druk: 0.7, eerste: 45 },
  { druk: 0.85, eerste: 40 },
  { druk: 1.0, eerste: 30 }, // 4: the numbers of the Wrath stages as written
  { druk: 1.1, eerste: 28 },
  { druk: 1.2, eerste: 25 },
  { druk: 1.3, eerste: 22 },
  { druk: 1.4, eerste: 20 },
  { druk: 1.6, eerste: 15 }, // the finale
];
export const escalatie = (nummer: number) => ESCALATIE[Math.max(0, Math.min(ESCALATIE.length - 1, nummer - 1))];
export const WRATH_ERFENIS = 0.3; // so much of the previous world's Wrath is still in the land when you land (never below the roll)

// Run length: seconds per dimension (index = dimension number - 1, last entry = the finale). A full run is about 40 minutes.
// Early worlds are shorter (little to build yet, a gentler start); the deep ones keep the full five minutes.
export const DIMENSIE_DUUR: number[] = [210, 240, 240, 270, 270, 300, 300, 300, 300];
export const dimensieDuur = (nummer: number): number => DIMENSIE_DUUR[Math.max(0, Math.min(DIMENSIE_DUUR.length - 1, nummer - 1))];
