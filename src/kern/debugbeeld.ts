// Debugbeeld (F1): rasterlijnen die de hoeken volgen en op elke tegel de hoogte van zijn midden; bij een klip laag-hoog ("1-3").
// Kleur van het getal: wit = land, oranje = land waar je niet kunt komen, rood = klip, blauw = water.
import type { Graphics } from 'pixi.js';
import { naarScherm } from './iso';
import type { Kaart } from './kaart';
import { hoeken, hoogteOp, TEGEL_KLIP, TEGEL_WATER } from './terrein';

const S = 2; // één pixel van het lettertype, in schermpixels
const CIJFERS: Record<string, string[]> = {
  '0': ['###', '# #', '# #', '# #', '###'],
  '1': [' # ', '## ', ' # ', ' # ', '###'],
  '2': ['###', '  #', '###', '#  ', '###'],
  '3': ['###', '  #', '###', '  #', '###'],
  '4': ['# #', '# #', '###', '  #', '  #'],
  '5': ['###', '#  ', '###', '  #', '###'],
  '6': ['###', '#  ', '###', '# #', '###'],
  '7': ['###', '  #', '  #', '  #', '  #'],
  '8': ['###', '# #', '###', '# #', '###'],
  '9': ['###', '# #', '###', '  #', '###'],
  '-': ['   ', '   ', '###', '   ', '   '],
  '.': [' ', ' ', ' ', ' ', '#'],
};
const KLEUREN = { land: 0xffffff, afgesloten: 0xffa02a, klip: 0xff4040, water: 0x5ec8ff };

// Zet de hoogte als tekst: hele getallen zonder komma, anders met een punt ("1.5").
const alsTekst = (z: number) => String(Math.round(z * 2) / 2);
const tekstBreedte = (t: string) => [...t].reduce((som, c) => som + (CIJFERS[c][0].length + 1) * S, -S);

export function tekenDebug(k: Kaart, doel: Graphics): void {
  const { breed, diep } = k;
  doel.clear();
  // de rasterlijnen: alle lijnen in beide richtingen, over de hoeken heen, dus ze volgen hellingen en klippen
  const s = breed + 1;
  const hoek = (i: number, j: number) => naarScherm(i - 0.5, j - 0.5, k.hoogte[j * s + i]);
  for (let j = 0; j <= diep; j++) {
    const p = hoek(0, j);
    doel.moveTo(p.x, p.y);
    for (let i = 1; i <= breed; i++) {
      const q = hoek(i, j);
      doel.lineTo(q.x, q.y);
    }
  }
  for (let i = 0; i <= breed; i++) {
    const p = hoek(i, 0);
    doel.moveTo(p.x, p.y);
    for (let j = 1; j <= diep; j++) {
      const q = hoek(i, j);
      doel.lineTo(q.x, q.y);
    }
  }
  doel.stroke({ width: 1, color: 0xffffff, alpha: 0.28 });

  // eerst alle ondergronden, dan de cijfers per kleur: één vulling per kleur is veel sneller dan één per pixel
  const labels: { x: number; y: number; t: string; soort: keyof typeof KLEUREN }[] = [];
  for (let rij = 0; rij < diep; rij++)
    for (let kol = 0; kol < breed; kol++) {
      const o = rij * breed + kol, c = hoeken(k, kol, rij);
      const klip = k.soort[o] === TEGEL_KLIP;
      const laag = Math.min(c.a, c.r, c.v, c.l), hoog = Math.max(c.a, c.r, c.v, c.l);
      const z = klip ? laag : hoogteOp(k, kol, rij); // de voet van een klip is vlak, op zijn laagste hoogte
      const p = naarScherm(kol, rij, z);
      const soort = k.soort[o] === TEGEL_KLIP ? 'klip' : k.soort[o] === TEGEL_WATER ? 'water' : k.lopen.vrij[o] || binnenMachine(k, kol, rij) ? 'land' : 'afgesloten';
      labels.push({ x: Math.round(p.x / S) * S, y: Math.round(p.y / S) * S, t: klip ? `${laag}-${hoog}` : alsTekst(z), soort });
    }
  for (const l of labels) doel.rect(l.x - tekstBreedte(l.t) / 2 - S, l.y - 3 * S - S, tekstBreedte(l.t) + 2 * S, 5 * S + 2 * S);
  doel.fill({ color: 0x000000, alpha: 0.6 });
  for (const soort of Object.keys(KLEUREN) as (keyof typeof KLEUREN)[]) {
    for (const l of labels) {
      if (l.soort !== soort) continue;
      let x = l.x - tekstBreedte(l.t) / 2;
      for (const c of l.t) {
        const beeld = CIJFERS[c];
        beeld.forEach((regel, ry) => {
          for (let rx = 0; rx < regel.length; rx++) if (regel[rx] === '#') doel.rect(x + rx * S, l.y - 3 * S + ry * S, S, S);
        });
        x += (beeld[0].length + 1) * S;
      }
    }
    doel.fill(KLEUREN[soort]);
  }
}

// De tegels rond de machine zijn afgezet voor het routeren, maar het is gewoon jouw land.
function binnenMachine(k: Kaart, x: number, y: number): boolean {
  const m = k.machine;
  return x >= m.x - 1 && y >= m.y - 1 && x <= m.x + m.breed && y <= m.y + m.diep;
}
