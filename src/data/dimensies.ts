// Getallen voor dimensies, de kaart en de stream. Zie DESIGN.md.
import type { Grondstof } from '../kern/types';

export const DIMENSIE_DUUR_SEC = 4 * 60;

// De kaart van een dimensie: groot, maar net genoeg ruimte om te bouwen.
export const KAART_BREED = 44;
export const KAART_DIEP = 44;
export const START_VRIJ = 6; // zoveel tegels rond de machine blijven leeg (bouwgrond)

// Velden met grondstoffen: hoeveel velden, hoeveel tegels per veld, hoeveel per tegel, hoe ver van de machine.
export const VELDEN: Record<Grondstof, { aantal: number; tegels: [number, number]; perTegel: number; afstand: [number, number] }> = {
  schroot: { aantal: 5, tegels: [6, 11], perTegel: 30, afstand: [7, 15] },
  hout: { aantal: 4, tegels: [5, 9], perTegel: 25, afstand: [8, 17] },
  kristal: { aantal: 2, tegels: [3, 6], perTegel: 15, afstand: [13, 19] },
};
