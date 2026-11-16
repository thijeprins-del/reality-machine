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
  sprites?: string[];
}
export const AANVAL: Partial<Record<Archetype, AanvalStijl>> = {
  // Een zwerm: veel kleine, snelle beestjes die samen knagen.
  insecten: { elke: 0.7, aantal: 2.5, hp: 0.35, snelheid: 1.6, schade: 0.5 },
  // Oudheid: legioenen in formatie, veel man tegelijk, taai maar langzaam.
  oudheid: { elke: 1.1, aantal: 1.6, hp: 1.6, snelheid: 0.9, schade: 0.8 },
  // Middeleeuwen: ridders en boogschutters, minder maar sterker, belegeringen met pauzes.
  middeleeuwen: { elke: 1.3, aantal: 0.9, hp: 2.2, snelheid: 1.0, schade: 1.4 },
  // Industrieel: stoommachines, traag en zwaar, een paar tegelijk die veel schade doen.
  industrieel: { elke: 1.2, aantal: 0.8, hp: 3, snelheid: 0.7, schade: 2 },
  // Een reus merkt je pas bij hoge Wrath; dan komt er één die alles plet.
  reuzen: { elke: 1.3, aantal: 1, hp: 12, snelheid: 0.4, schade: 8, stilTot: 55, vast: 1, sprites: ['reus'] },
};

// Winnen of verliezen
export interface Uitkomst {
  gewonnen: boolean;
  reden: string;
}
