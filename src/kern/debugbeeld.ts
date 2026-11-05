// Debugbeeld (F1): de omtrek van elke tegel, in rood waar een wand staat (daar kan niemand langs), en op elke tegel de hoogte
// van zijn midden. Kleur van het getal: wit = land, oranje = land waar je niet kunt komen, blauw = water.
import type { Graphics } from 'pixi.js';
import { naarScherm } from './iso';
import type { Kaart } from './kaart';
import { hoeken, hoogteOp, TEGEL_WATER } from './terrein';

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
const KLEUREN = { land: 0xffffff, afgesloten: 0xffa02a, water: 0x5ec8ff };

// Zet de hoogte als tekst: hele getallen zonder komma, anders met een punt ("1.5").
const alsTekst = (z: number) => String(Math.round(z * 2) / 2);
const tekstBreedte = (t: string) => [...t].reduce((som, c) => som + (CIJFERS[c][0].length + 1) * S, -S);

export function tekenDebug(k: Kaart, doel: Graphics): void {
  const { breed, diep } = k;
  doel.clear();
  // De randen. Elke tegel tekent zijn twee achterranden; loopt de grond daar niet door, dan in rood, en ook de rand van de buur.
  const wit: number[] = [], rood: number[] = [];
  const lijn = (naar: number[], x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
    const p = naarScherm(x0, y0, z0), q = naarScherm(x1, y1, z1);
    naar.push(p.x, p.y, q.x, q.y);
  };
  for (let y = 0; y < diep; y++)
    for (let x = 0; x < breed; x++) {
      const c = hoeken(k, x, y);
      // achter-rechts: de buur (x, y - 1)
      const n1 = y > 0 ? hoeken(k, x, y - 1) : null;
      const dicht1 = n1 !== null && (n1.l !== c.a || n1.v !== c.r);
      lijn(dicht1 ? rood : wit, x - 0.5, y - 0.5, c.a, x + 0.5, y - 0.5, c.r);
      if (n1 && dicht1) lijn(rood, x - 0.5, y - 0.5, n1.l, x + 0.5, y - 0.5, n1.v);
      // achter-links: de buur (x - 1, y)
      const n2 = x > 0 ? hoeken(k, x - 1, y) : null;
      const dicht2 = n2 !== null && (n2.v !== c.l || n2.r !== c.a);
      lijn(dicht2 ? rood : wit, x - 0.5, y + 0.5, c.l, x - 0.5, y - 0.5, c.a);
      if (n2 && dicht2) lijn(rood, x - 0.5, y + 0.5, n2.v, x - 0.5, y - 0.5, n2.r);
      // de voorkant van de kaart
      if (y === diep - 1) lijn(wit, x - 0.5, y + 0.5, c.l, x + 0.5, y + 0.5, c.v);
      if (x === breed - 1) lijn(wit, x + 0.5, y + 0.5, c.v, x + 0.5, y - 0.5, c.r);
    }
  for (let i = 0; i < wit.length; i += 4) doel.moveTo(wit[i], wit[i + 1]).lineTo(wit[i + 2], wit[i + 3]);
  doel.stroke({ width: 1, color: 0xffffff, alpha: 0.28 });
  for (let i = 0; i < rood.length; i += 4) doel.moveTo(rood[i], rood[i + 1]).lineTo(rood[i + 2], rood[i + 3]);
  doel.stroke({ width: 2, color: 0xff4040, alpha: 0.9 });

  // eerst alle ondergronden, dan de cijfers per kleur: één vulling per kleur is veel sneller dan één per pixel
  const labels: { x: number; y: number; t: string; soort: keyof typeof KLEUREN }[] = [];
  for (let rij = 0; rij < diep; rij++)
    for (let kol = 0; kol < breed; kol++) {
      const o = rij * breed + kol, z = hoogteOp(k, kol, rij);
      const p = naarScherm(kol, rij, z);
      const soort = k.soort[o] === TEGEL_WATER ? 'water' : k.lopen.vrij[o] || binnenMachine(k, kol, rij) ? 'land' : 'afgesloten';
      labels.push({ x: Math.round(p.x / S) * S, y: Math.round(p.y / S) * S, t: alsTekst(z), soort });
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
