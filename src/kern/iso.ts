import { Container, Graphics } from 'pixi.js';
import { HOOGTE_PX } from '../data/dimensies';

export const TEGEL_B = 64;
export const TEGEL_H = 32;

// Rooster (kolom, rij) naar schermpositie van het midden van de tegel, op hoogte z (in niveaus).
export function naarScherm(kol: number, rij: number, z = 0): { x: number; y: number } {
  return { x: (kol - rij) * (TEGEL_B / 2), y: (kol + rij) * (TEGEL_H / 2) - z * HOOGTE_PX };
}

// Een eenvoudig eiland van iso-tegels: gras met een rand aarde eronder.
export function tekenVeld(breed: number, diep: number): Container {
  const veld = new Container();
  const g = new Graphics();
  for (let rij = 0; rij < diep; rij++) {
    for (let kol = 0; kol < breed; kol++) {
      const { x, y } = naarScherm(kol, rij);
      const kleur = (kol + rij) % 2 === 0 ? 0x4f8a3c : 0x5a9845;
      g.poly([x, y - TEGEL_H / 2, x + TEGEL_B / 2, y, x, y + TEGEL_H / 2, x - TEGEL_B / 2, y])
        .fill(kleur)
        .stroke({ width: 1, color: 0x3b6b2c });
    }
  }
  // Zijkanten van het eiland (aarde) langs de twee voorste randen.
  const dikte = 18;
  for (let i = 0; i < breed; i++) {
    const { x, y } = naarScherm(i, diep - 1);
    g.poly([x - TEGEL_B / 2, y, x, y + TEGEL_H / 2, x, y + TEGEL_H / 2 + dikte, x - TEGEL_B / 2, y + dikte]).fill(0x6b4a2e);
  }
  for (let i = 0; i < diep; i++) {
    const { x, y } = naarScherm(breed - 1, i);
    g.poly([x, y + TEGEL_H / 2, x + TEGEL_B / 2, y, x + TEGEL_B / 2, y + dikte, x, y + TEGEL_H / 2 + dikte]).fill(0x57391f);
  }
  veld.addChild(g);
  return veld;
}
