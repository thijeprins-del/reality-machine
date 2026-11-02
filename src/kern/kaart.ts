// De kaart van een dimensie: de machine en de opslag in het midden, velden met grondstoffen eromheen.
import { KAART_BREED, KAART_DIEP, START_VRIJ, VELDEN } from '../data/dimensies';
import { volgende } from './toeval';
import type { Grondstof } from './types';

export interface Afzetting {
  id: number;
  goed: Grondstof;
  x: number; // tegel
  y: number;
  rest: number; // wat er nog te halen valt; 0 = op
  variant: number; // welk plaatje
}

export interface Blok {
  x: number;
  y: number;
  breed: number;
  diep: number;
}

export interface Kaart {
  breed: number;
  diep: number;
  afzettingen: Afzetting[];
  machine: Blok;
  opslag: Blok;
}

export function maakKaart(staat: { toeval: number }): Kaart {
  const breed = KAART_BREED;
  const diep = KAART_DIEP;
  const mx = Math.floor(breed / 2) - 2;
  const my = Math.floor(diep / 2) - 2;
  const machine: Blok = { x: mx, y: my, breed: 4, diep: 4 };
  const opslag: Blok = { x: mx + 5, y: my + 1, breed: 2, diep: 2 };
  const midden = { x: mx + 2, y: my + 2 };

  const bezet = new Uint8Array(breed * diep);
  const vrij = (x: number, y: number) =>
    x >= 1 && y >= 1 && x < breed - 1 && y < diep - 1 && !bezet[y * diep + x] &&
    Math.max(Math.abs(x - midden.x), Math.abs(y - midden.y)) > START_VRIJ;

  const afzettingen: Afzetting[] = [];
  const r = () => volgende(staat);
  for (const goed of Object.keys(VELDEN) as Grondstof[]) {
    const v = VELDEN[goed];
    for (let n = 0; n < v.aantal; n++) {
      // zoek een vrije plek voor het hart van het veld, op de goede afstand
      let hart: { x: number; y: number } | null = null;
      for (let poging = 0; poging < 60 && !hart; poging++) {
        const hoek = r() * Math.PI * 2;
        const af = v.afstand[0] + r() * (v.afstand[1] - v.afstand[0]);
        const x = Math.round(midden.x + Math.cos(hoek) * af);
        const y = Math.round(midden.y + Math.sin(hoek) * af);
        if (vrij(x, y)) hart = { x, y };
      }
      if (!hart) continue;
      // groei het veld tegel voor tegel vanuit het hart
      const doel = v.tegels[0] + Math.floor(r() * (v.tegels[1] - v.tegels[0] + 1));
      const veld = [hart];
      bezet[hart.y * diep + hart.x] = 1;
      for (let poging = 0; poging < doel * 8 && veld.length < doel; poging++) {
        const van = veld[Math.floor(r() * veld.length)];
        const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(r() * 4)];
        const x = van.x + dx, y = van.y + dy;
        if (!vrij(x, y)) continue;
        bezet[y * diep + x] = 1;
        veld.push({ x, y });
      }
      for (const t of veld)
        afzettingen.push({ id: afzettingen.length, goed, x: t.x, y: t.y, rest: v.perTegel, variant: Math.floor(r() * 2) });
    }
  }
  return { breed, diep, afzettingen, machine, opslag };
}

export function afzettingOp(k: Kaart, x: number, y: number): Afzetting | undefined {
  return k.afzettingen.find((a) => a.x === x && a.y === y && a.rest > 0);
}

export function binnenBlok(b: Blok, x: number, y: number): boolean {
  return x >= b.x && y >= b.y && x < b.x + b.breed && y < b.y + b.diep;
}
