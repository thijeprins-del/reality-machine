// Getallen voor dimensies, de kaart en de stream. Zie DESIGN.md.
import type { Grondstof } from '../kern/types';

export const DIMENSIE_DUUR_SEC = 60; // even 1 minuut om mee te spelen (Thije, 2 nov); het plan was 4 minuten

// De kaart van een dimensie: groot, maar net genoeg ruimte om te bouwen.
export const KAART_BREED = 44;
export const KAART_DIEP = 44;

// De transportring: een slecht geverfde gele stippellijn om de machine. Alles binnen de ring springt mee naar de
// volgende dimensie; de grondstoffen liggen erbuiten en blijven achter.
export const RING_STRAAL = 7.5; // tegels vanaf het midden van de machine

// Velden met grondstoffen: hoeveel velden, hoeveel tegels per veld, hoeveel per tegel, hoe ver van de machine.
export const VELDEN: Record<Grondstof, { aantal: number; tegels: [number, number]; perTegel: number; afstand: [number, number] }> = {
  schroot: { aantal: 5, tegels: [6, 11], perTegel: 30, afstand: [10, 16] },
  hout: { aantal: 4, tegels: [5, 9], perTegel: 25, afstand: [10, 18] },
  kristal: { aantal: 2, tegels: [3, 6], perTegel: 15, afstand: [14, 19] },
};

// Elke dimensie ziet er echt anders uit. Binnen de ring blijft je eigen grauwe grond; erbuiten de kleuren van de wereld.
export interface DimensieKleur {
  naam: string;
  grond: number[]; // tegelkleuren
  vlek: number; // kleur van vlekken op de grond
  vlekGloeit?: boolean; // vlekken in de gloedlaag (lava, gif)
  vlekKans: number; // deel van de tegels met een vlek
  rand: [number, number]; // zijkanten van het land
}
export const THUIS: DimensieKleur = {
  naam: 'THUIS',
  grond: [0x1d1e1c, 0x21221f, 0x1a1b19, 0x242521, 0x1f1d1a],
  vlek: 0x121210,
  vlekKans: 0.15,
  rand: [0x1f1813, 0x16110d],
};
export const DIMENSIES: DimensieKleur[] = [
  { naam: 'ROESTDUIN', grond: [0x5a2a12, 0x6b3316, 0x4f240f, 0x733a1a, 0x62301a], vlek: 0x2a1208, vlekKans: 0.15, rand: [0x3a1a0a, 0x2a1207] },
  { naam: 'KRISTALTOENDRA', grond: [0x8fa6c8, 0x9db3d3, 0x8299bd, 0xa8bddb, 0x7f95b8], vlek: 0x4ef2ff, vlekGloeit: true, vlekKans: 0.04, rand: [0x4c5c80, 0x3b4868] },
  { naam: 'GIFWOUD', grond: [0x1f3a14, 0x24431a, 0x1a3311, 0x2a4b1d, 0x203d16], vlek: 0x9dff2e, vlekGloeit: true, vlekKans: 0.06, rand: [0x142410, 0x0e1a0b] },
  { naam: 'MAGMAVELD', grond: [0x1a1514, 0x201917, 0x161211, 0x241c19, 0x1c1614], vlek: 0xff6a1a, vlekGloeit: true, vlekKans: 0.12, rand: [0x2a0d06, 0x1e0904] },
  { naam: 'ZOUTZEE', grond: [0xc98aa5, 0xd496b0, 0xbf7f9b, 0xdca2bb, 0xc48aa3], vlek: 0xfff0fa, vlekKans: 0.1, rand: [0x7a4060, 0x5c2f48] },
];
export const dimensieKleur = (dimensie: number): DimensieKleur => DIMENSIES[(dimensie - 1) % DIMENSIES.length];
