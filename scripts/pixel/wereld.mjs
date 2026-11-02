// Tekenscript voor de wereld-sprites (van beide facties): grondstoffen die je in een dimensie vindt.
// Draai: node scripts/pixel/wereld.mjs. Schrijft PNG's naar assets/wereld/ en de ankers naar src/kern/wereld-sprites.ts.
// Zelfde stijl als de muizen: grauw en vuil, neon is het enige felle.
import { Doek, ruis } from './pixel.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const wortel = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const uit = join(wortel, 'assets', 'wereld');
mkdirSync(uit, { recursive: true });

const T = {
  staal: ['#0c0d0e', '#141618', '#1c1f21', '#25292b', '#303436', '#3d4143', '#4c5051', '#5e6261', '#787a76'],
  roest: ['#170d08', '#24130b', '#341b0f', '#462413', '#5a2f18', '#6f3c1f', '#874d29'],
  bruin: ['#100c0a', '#18120f', '#211915', '#2b211b', '#362a22', '#43352a', '#524134', '#634f40'],
  hout: ['#120d09', '#1d150e', '#2a1f15', '#382a1c', '#473624', '#57432d', '#6a5338'],
  beton: ['#111111', '#1a1a19', '#232321', '#2d2d2a', '#383834', '#45443f', '#53524b', '#64625a'],
  kristal: ['#0a0612', '#160c24', '#24123a', '#341a52', '#48246c', '#5e3088', '#7a44a8', '#9c64c8'],
};
const K = { lijn: '#060505', olie: '#030303' };
const N = { magenta: '#ff2fb0', cyaan: '#4ef2ff' };

const F = 2;
const isoPunt = (ax, ay) => (k, r, z = 0) => [Math.round(ax + 2 * k * F - 2 * r * F), Math.round(ay + k * F + r * F - z * F)];

const ankers = {};
function bewaar(naam, d, ankerX, ankerY) {
  d.png(join(uit, `${naam}.png`));
  const gloed = d.gloedPng(join(uit, `${naam}-gloed.png`));
  ankers[naam] = { w: d.w, h: d.h, ankerX, ankerY, tegels: 1, gloed };
}

// Eén tegel = 4 x 4 eenheden in g(k, r, z). Anker = achterhoek van de tegel.
const AX = 20, AY = 34;

// SCHROOT: een berg losse brokken staal en roest, met een buis en een tandwiel.
function tekenSchroot(naam, seed) {
  const d = new Doek(40, 56);
  const r = ruis(seed);
  const g = isoPunt(AX, AY);
  // berg: brokken van achter naar voor, hoger in het midden
  const brokken = [];
  for (let i = 0; i < 22; i++) {
    const k = 0.4 + r() * 2.6, rr = 0.4 + r() * 2.6;
    const midden = 1.6 - Math.hypot(k - 1.8, rr - 1.8);
    brokken.push([k, rr, Math.max(0, midden * 2.2 + r() * 1.2)]);
  }
  brokken.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[2] - b[2]);
  for (const [k, rr, z] of brokken) {
    const p = g(k, rr, z);
    const ramp = r() < 0.35 ? T.roest : T.staal;
    d.blokS(p[0], p[1], 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 3), 2 + Math.floor(r() * 4), ramp, { r });
  }
  const b = g(0.6, 2.2, 3);
  d.buis(b[0], b[1], 5, 'kol', 1, T.staal, { loop: true });
  const t = g(2.4, 1.2, 4);
  d.bol(t[0], t[1], 3, T.roest, { mat: true });
  d.zet(t[0], t[1], T.roest[0]);
  d.omlijn(K.lijn);
  d.vuil(0.08, K.olie, 0.4, r);
  bewaar(naam, d, AX, AY);
}

// HOUT: een dode, kale boom met afgebroken takken; een paar gekapte stammetjes ernaast.
function tekenHout(naam, seed) {
  const d = new Doek(40, 56);
  const r = ruis(seed);
  const g = isoPunt(AX, AY);
  const voet = g(2, 2, 0);
  // stammetjes op de grond
  const s1 = g(0.6, 2.8, 0.5);
  d.buis(s1[0], s1[1], 4, 'kol', 1, T.hout, { ringen: 3 });
  // stam: taps, een beetje scheef
  const top = [voet[0] + Math.round(r() * 4 - 2), voet[1] - 30];
  d.staaf(voet[0], voet[1], top[0], top[1], 2.5, T.hout, { r, ruis: 0.15 });
  // takken
  for (let i = 0; i < 4; i++) {
    const t = 0.35 + r() * 0.55;
    const x = voet[0] + (top[0] - voet[0]) * t, y = voet[1] + (top[1] - voet[1]) * t;
    const kant = i % 2 ? 1 : -1;
    const ex = x + kant * (5 + r() * 6), ey = y - 3 - r() * 6;
    d.staaf(x, y, ex, ey, 1, T.hout, { r });
    d.lijn(Math.round(ex), Math.round(ey), Math.round(ex + kant * 2), Math.round(ey - 3), T.hout[2]);
  }
  // wortels
  for (const [dx, dy] of [[-5, 2], [5, 2], [0, 3]]) d.lijn(voet[0], voet[1], voet[0] + dx, voet[1] + dy, T.hout[2]);
  d.omlijn(K.lijn);
  d.vuil(0.06, K.olie, 0.35, r);
  bewaar(naam, d, AX, AY);
}

// KRISTAL: scherven paars kristal uit een stuk beton, met een koude gloed van binnenuit.
function tekenKristal(naam, seed) {
  const d = new Doek(40, 56);
  const r = ruis(seed);
  const g = isoPunt(AX, AY);
  const b = g(0.8, 0.8, 0);
  d.blokS(b[0], b[1], 5, 5, 3, T.beton, { r });
  const pieken = [];
  for (let i = 0; i < 6; i++) {
    const k = 1 + r() * 2, rr = 1 + r() * 2;
    pieken.push([k, rr, 8 + r() * 16, (r() - 0.5) * 8]);
  }
  pieken.sort((a, c) => a[0] + a[1] - (c[0] + c[1]));
  for (const [k, rr, h, scheef] of pieken) {
    const p = g(k, rr, 1);
    const tx = p[0] + scheef, ty = p[1] - h;
    // twee vlakken: donker links, licht rechts
    d.veelhoek([[p[0] - 3, p[1]], [p[0], p[1] + 1], [tx, ty]], T.kristal[3]);
    d.veelhoek([[p[0], p[1] + 1], [p[0] + 3, p[1]], [tx, ty]], T.kristal[6]);
    d.lijn(p[0], p[1], Math.round(tx), Math.round(ty), T.kristal[7]);
  }
  d.omlijn(K.lijn);
  // neon: de kern van de grootste pieken gloeit
  for (const [k, rr, h, scheef] of pieken.slice(-3)) {
    const p = g(k, rr, 1);
    d.licht(Math.round(p[0] + scheef * 0.4), Math.round(p[1] - h * 0.4), N.magenta);
    d.licht(Math.round(p[0] + scheef * 0.5), Math.round(p[1] - h * 0.5), N.magenta);
  }
  bewaar(naam, d, AX, AY);
}

tekenSchroot('schroot-1', 101);
tekenSchroot('schroot-2', 102);
tekenHout('hout-1', 201);
tekenHout('hout-2', 202);
tekenKristal('kristal-1', 301);
tekenKristal('kristal-2', 302);

const regels = Object.entries(ankers).map(
  ([n, a]) =>
    `  '${n}': { w: ${a.w}, h: ${a.h}, ankerX: ${a.ankerX}, ankerY: ${a.ankerY}, tegels: ${a.tegels}, gloed: ${a.gloed} },`,
);
writeFileSync(
  join(wortel, 'src', 'kern', 'wereld-sprites.ts'),
  `// Gegenereerd door scripts/pixel/wereld.mjs. Niet met de hand aanpassen.\n` +
    `// anker = pixel in de sprite die op de achterhoek van de tegel valt.\n` +
    `export const WERELD_SPRITES = {\n${regels.join('\n')}\n} as const;\n\n` +
    `export type WereldSprite = keyof typeof WERELD_SPRITES;\n`,
);
console.log('getekend:', Object.keys(ankers).join(', '));
