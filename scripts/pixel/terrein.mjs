// Tekenscript voor de tegelsets van het terrein: per dimensie één plaatje met alle tegelvormen, water en schuim.
// Draai: node scripts/pixel/terrein.mjs. Schrijft assets/wereld/tegels-<naam>.png en src/kern/tegels.ts.
//
// Een vorm is de hoogte van de vier hoeken (achter, rechts, voor, links) ten opzichte van de laagste: 0, 1 of 2.
// Verschil 1 is een helling, verschil 2 een klip. De kern kiest de vorm; het absolute niveau is alleen een verschuiving,
// dus de hoogtes van het spel kunnen veranderen zonder dat hier iets hoeft.
import { Doek, hex, ruis } from './pixel.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const wortel = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
mkdirSync(join(wortel, 'assets', 'wereld'), { recursive: true });

const CEL_B = 34, CEL_H = 34; // ruimte voor een tegel plus twee niveaus omhoog
const CX = 17, CY = 25; // midden van een vlakke tegel op de laagste hoogte
const NIVEAU = 8; // sprite-pixels per hoogteniveau (HOOGTE_PX / PIXEL)
const KOLOMMEN = 27, VARIANTEN = 3;
const WATER_VARIANTEN = 3, WATER_BEELDEN = 4, SCHUIM_BEELDEN = 2;
const CEL_WATER = 81 * VARIANTEN, CEL_SCHUIM = CEL_WATER + WATER_VARIANTEN * WATER_BEELDEN;
const CELLEN = CEL_SCHUIM + 4 * SCHUIM_BEELDEN;

// Per dimensie de kleurtrappen, van donker naar licht. Grond: de vlakke grond zit op trede 3.
const SETS = {
  roestduin: {
    zaad: 11,
    grond: ['#3a1a0c', '#4e2410', '#622d13', '#773718', '#8c431c', '#a55326', '#c16933'],
    rots: ['#120c09', '#1e150f', '#2d2015', '#3f2d1f', '#55402d', '#70563f', '#8f7355'],
    rand: '#a68c68', // de lichte bovenrand van een klip
    water: ['#1a120a', '#241a0f', '#2e2214', '#3f2f1c', '#5a452b'],
    schuim: '#b09a72',
  },
};

const cel = (d, i) => ({ d, x: (i % KOLOMMEN) * CEL_B, y: Math.floor(i / KOLOMMEN) * CEL_H });

// De driehoeken van een tegel, met dezelfde knik als het spel (terrein.ts): langs de hoeken die het minst verschillen.
function driehoeken(a, r, v, l) {
  const A = { x: CX, y: CY - 8 - a * NIVEAU, z: a, u: 0, w: 0 };
  const R = { x: CX + 16, y: CY - r * NIVEAU, z: r, u: 1, w: 0 };
  const V = { x: CX, y: CY + 8 - v * NIVEAU, z: v, u: 1, w: 1 };
  const L = { x: CX - 16, y: CY - l * NIVEAU, z: l, u: 0, w: 1 };
  if (Math.abs(a - v) > Math.abs(r - l)) return { A, R, V, L, tri: [[A, R, L, r - a, l - a], [V, L, R, v - l, v - r]] };
  return { A, R, V, L, tri: [[A, R, V, r - a, v - r], [A, V, L, v - l, l - a]] };
}

// Hoe groot een driehoek op het scherm is. Negatief of nul: hij kijkt van je af, dus je ziet hem niet.
const zichtbaar = ([p, q, s]) => (q.x - p.x) * (s.y - p.y) - (q.y - p.y) * (s.x - p.x);

// Elke pixel van een driehoek die naar je toe kijkt. Iets ruimer dan precies, zodat er geen naden tussen de tegels vallen.
function perPixel(t, doe) {
  const [p, q, s] = t;
  const opp = zichtbaar(t);
  if (opp < 1) return;
  const x0 = Math.floor(Math.min(p.x, q.x, s.x)) - 1, x1 = Math.ceil(Math.max(p.x, q.x, s.x)) + 1;
  const y0 = Math.floor(Math.min(p.y, q.y, s.y)) - 1, y1 = Math.ceil(Math.max(p.y, q.y, s.y)) + 1;
  const rand = (a, b, x, y) => ((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)) / (Math.hypot(b.x - a.x, b.y - a.y) || 1);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const mx = x + 0.5, my = y + 0.5;
      if (rand(p, q, mx, my) < -0.5 || rand(q, s, mx, my) < -0.5 || rand(s, p, mx, my) < -0.5) continue;
      const b0 = ((q.x - mx) * (s.y - my) - (q.y - my) * (s.x - mx)) / opp;
      const b1 = ((s.x - mx) * (p.y - my) - (s.y - my) * (p.x - mx)) / opp;
      const b2 = 1 - b0 - b1;
      doe(x, y, { z: b0 * p.z + b1 * q.z + b2 * s.z, u: b0 * p.u + b1 * q.u + b2 * s.u, w: b0 * p.w + b1 * q.w + b2 * s.w });
    }
}

const trede = (ramp, i) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(i)))];

// Gewone grond: een helling krijgt licht van linksboven, in hele treden zodat de vorm van een heuvel leesbaar is.
// Vlakke tegels verschillen alleen in kleine korrels, dus zie je geen ruitjespatroon: de grond loopt door.
function tekenLand(c, set, a, r, v, l, zaad) {
  const n = ruis(zaad);
  for (const t of driehoeken(a, r, v, l).tri) landDriehoek(c, set, t, n);
}

function landDriehoek(c, set, t, n) {
  const plekken = Array.from({ length: 2 }, () => ({ u: n(), w: n(), s: 0.08 + n() * 0.12, d: n() < 0.5 ? -1 : 1 }));
  {
    const licht = (t[3] - t[4]) * 0.85 - (t[3] + t[4]) * 0.25;
    perPixel(t, (x, y, p) => {
      if (x < 0 || y < 0 || x >= CEL_B || y >= CEL_H) return;
      let i = 3 + licht + (n() - 0.5) * 0.7;
      for (const v2 of plekken) if (Math.hypot(p.u - v2.u, (p.w - v2.w) * 0.8) < v2.s) i += v2.d * 0.7;
      const k = n();
      if (k < 0.035) i -= 1.5;
      else if (k > 0.98) i += 1.5;
      c.d.zet(c.x + x, c.y + y, trede(set.grond, i));
    });
  }
}

// Een klip is een echte wand: de tegel is vlakke grond op zijn laagste hoogte (die legt het spel eronder), en waar hij
// tegen hogere hoeken aan ligt staat de wand loodrecht omhoog. 1,1,1,3,2,1 wordt dus _|-\_ en geen steile helling.
// Zo'n cel bevat alleen de wanden. Alleen de achterste twee randen staan in beeld; een wand aan de voorkant kijkt van je af.
function tekenKlip(c, set, a, r, v, l, zaad) {
  const n = ruis(zaad);
  const { A, R, V, L } = driehoeken(a, r, v, l);
  const hoogst = Math.max(a, r, v, l);
  const vloerY = (x, p, q) => { // waar de voet van de wand zit: de rand op hoogte 0
    const t2 = (x + 0.5 - p.x) / (q.x - p.x);
    return p.y + p.z * NIVEAU + ((q.y + q.z * NIVEAU) - (p.y + p.z * NIVEAU)) * t2;
  };
  const topY = (x, p, q) => p.y + (q.y - p.y) * ((x + 0.5 - p.x) / (q.x - p.x));
  // Eén lage hoek: de klip loopt schuin door de tegel. De drie hoge hoeken houden hun driehoek bovenop, alleen de lage hoek
  // zakt. Anders is de hele tegel laag, en wordt een schuine rand een zigzag van losse ruiten.
  const lage = [A, R, V, L].filter((p) => p.z === 0);
  if (lage.length === 1) {
    const laag = lage[0];
    const boven = laag === V ? [A, R, L, r - a, l - a] : laag === A ? [V, L, R, v - l, v - r] : laag === R ? [A, V, L, v - l, l - a] : [A, R, V, r - a, v - r];
    landDriehoek(c, set, boven, n);
    if (laag === V) wand(L, R, 3);
    else if (laag === A) richel(L, R);
    else {
      // de wand staat precies op zijn kant: je ziet alleen een naad tussen hoog en laag
      const x = laag === R ? CX : CX - 1;
      const y0 = Math.round(A.y), y1 = Math.round(V.y + V.z * NIVEAU);
      for (let y = y0; y <= y1; y++) c.d.zet(c.x + x, c.y + y, y === y0 ? set.rand : trede(set.rots, 1 + n()));
    }
    return;
  }
  // [van links naar rechts, helderheid]: de wand die naar linksonder kijkt vangt het licht, die naar rechtsonder niet
  for (const [p, q, basis] of [[L, A, 2.2], [A, R, 3.4]]) {
    if (Math.min(p.z, q.z) === 0) continue; // loopt tot de grond: dat is een buitenhoek, de wanden ernaast maken hem af
    wand(p, q, basis);
  }
  // Aan de voorkant kijkt de wand van je af en is hij verborgen: een richel van rots, zodat je ziet dat de grond daar ophoudt.
  for (const [p, q] of [[R, V], [V, L]]) if (p.z === hoogst && q.z === hoogst) richel(p, q);

  function wand(p, q, basis) {
    const scheuren = Array.from({ length: 33 }, () => n() < 0.2);
    for (let x = Math.min(p.x, q.x); x < Math.max(p.x, q.x); x++) {
      const y0 = Math.round(topY(x, p, q)), y1 = Math.round(vloerY(x, p, q));
      const scheur = scheuren[x - Math.min(p.x, q.x)];
      for (let y = y0; y <= y1; y++) {
        const boven = y1 - y;
        const laag = Math.floor((boven + Math.sin(x * 0.7 + zaad) * 0.8) / 3);
        let i = basis + (laag % 2 ? 0.7 : -0.5) + (n() - 0.5) * 0.7;
        if (scheur) i -= 1.4;
        if (boven < 2) i -= 1.6; // de voet
        c.d.zet(c.x + x, c.y + y, trede(set.rots, i));
      }
      c.d.zet(c.x + x, c.y + y0, n() < 0.8 ? set.rand : set.rots[5]); // lichte bovenrand
      // een randje schaduw en wat puin op de grond voor de wand
      for (let d = 1; d <= 3; d++) if (n() < 0.75 - d * 0.18) c.d.zet(c.x + x, c.y + y1 + d, [0, 0, 0, 90]);
      if (n() < 0.3) c.d.zet(c.x + x, c.y + y1 + 1 + Math.floor(n() * 4), trede(set.rots, 3 + n() * 2));
    }
  }

  function richel(p, q) {
    const stappen = Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y));
    for (let s = 0; s <= stappen; s++) {
      const x = Math.min(CEL_B - 1, Math.floor(p.x + ((q.x - p.x) * s) / stappen));
      const y = Math.min(CEL_H - 1, Math.floor(p.y + ((q.y - p.y) * s) / stappen));
      c.d.zet(c.x + x, c.y + y - 1, n() < 0.75 ? set.rots[4] : set.rots[3]);
      c.d.zet(c.x + x, c.y + y, set.rots[1]);
    }
  }
}

// Water: een vlakke ruit, met strepen die over de beelden heen opkomen en wegebben.
function tekenWater(c, set, variant, beeld, zaad) {
  const n = ruis(zaad);
  const korrel = Array.from({ length: CEL_B * CEL_H }, () => n());
  const strepen = Array.from({ length: 4 }, () => ({ x: 6 + Math.floor(n() * 18), y: CY - 5 + Math.floor(n() * 11), l: 5 + Math.floor(n() * 6), f: Math.floor(n() * WATER_BEELDEN) }));
  const { tri } = driehoeken(0, 0, 0, 0);
  for (const t of tri)
    perPixel(t, (x, y) => {
      if (x < 0 || y < 0 || x >= CEL_B || y >= CEL_H) return;
      c.d.zet(c.x + x, c.y + y, trede(set.water, 1.5 + (korrel[y * CEL_B + x] - 0.5) * 0.6));
    });
  const opRuit = (x, y) => Math.abs(x + 0.5 - CX) / 16 + Math.abs(y + 0.5 - CY) / 8 < 0.95;
  for (const s of strepen) {
    const fase = (beeld + s.f) % WATER_BEELDEN;
    if (fase === 3) continue; // even weg
    const kleur = fase === 1 ? set.water[4] : set.water[3];
    const verschuif = fase; // de streep schuift mee met de golf
    for (let i = 0; i < s.l - (fase === 2 ? 2 : 0); i++) {
      const x = s.x + verschuif + i;
      if (opRuit(x, s.y)) c.d.zet(c.x + x, c.y + s.y, kleur);
    }
  }
}

// Schuim langs één rand van een watertegel: waar water land raakt. Rafelig en iets de tegel in.
function tekenSchuim(c, set, rand, beeld, zaad) {
  const n = ruis(zaad);
  const hoeken = [[[CX, CY - 8], [CX + 16, CY]], [[CX + 16, CY], [CX, CY + 8]], [[CX, CY + 8], [CX - 16, CY]], [[CX - 16, CY], [CX, CY - 8]]];
  const [p, q] = hoeken[rand];
  const binnenX = CX - (p[0] + q[0]) / 2, binnenY = CY - (p[1] + q[1]) / 2;
  const lang = Math.hypot(binnenX, binnenY) || 1;
  const stappen = 16;
  const kleur = hex(set.schuim);
  const zacht = [kleur[0], kleur[1], kleur[2], 120];
  for (let s = 0; s <= stappen; s++) {
    const t = s / stappen;
    const golf = 0.5 + 0.5 * Math.sin(t * 9 + zaad + (beeld * Math.PI) / SCHUIM_BEELDEN * 2);
    const x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t;
    if (n() < 0.82) c.d.zet(c.x + Math.floor(x + (binnenX / lang) * 0.5), c.y + Math.floor(y + (binnenY / lang) * 0.5), kleur);
    if (golf > 0.45 && n() < 0.6) c.d.zet(c.x + Math.floor(x + (binnenX / lang) * (1 + golf * 1.6)), c.y + Math.floor(y + (binnenY / lang) * (1 + golf * 1.6)), zacht);
  }
}

function tekenSet(naam, set) {
  const d = new Doek(KOLOMMEN * CEL_B, Math.ceil(CELLEN / KOLOMMEN) * CEL_H);
  let vormen = 0;
  for (let variant = 0; variant < VARIANTEN; variant++)
    for (let code = 0; code < 81; code++) {
      const a = Math.floor(code / 27) % 3, r = Math.floor(code / 9) % 3, v = Math.floor(code / 3) % 3, l = code % 3;
      if (Math.min(a, r, v, l) !== 0) continue; // de laagste hoek is altijd 0
      if (!variant) vormen++;
      const c = cel(d, code + variant * 81);
      const zaad = set.zaad * 1000 + code * 7 + variant * 311;
      if (Math.max(a, r, v, l) >= 2) tekenKlip(c, set, a, r, v, l, zaad);
      else tekenLand(c, set, a, r, v, l, zaad);
    }
  for (let variant = 0; variant < WATER_VARIANTEN; variant++)
    for (let beeld = 0; beeld < WATER_BEELDEN; beeld++)
      tekenWater(cel(d, CEL_WATER + variant * WATER_BEELDEN + beeld), set, variant, beeld, set.zaad * 2000 + variant * 13);
  for (let rand = 0; rand < 4; rand++)
    for (let beeld = 0; beeld < SCHUIM_BEELDEN; beeld++)
      tekenSchuim(cel(d, CEL_SCHUIM + rand * SCHUIM_BEELDEN + beeld), set, rand, beeld, set.zaad * 3000 + rand * 17 + beeld);
  d.png(join(wortel, 'assets', 'wereld', `tegels-${naam}.png`));
  return vormen;
}

for (const [naam, set] of Object.entries(SETS)) console.log(`${naam}: ${tekenSet(naam, set)} vormen`);

writeFileSync(
  join(wortel, 'src', 'kern', 'tegels.ts'),
  `// Gegenereerd door scripts/pixel/terrein.mjs. Niet met de hand aanpassen.
// De indeling van een tegelset-plaatje (assets/wereld/tegels-<naam>.png), in sprite-pixels.
export const TEGELSETS = [${Object.keys(SETS).map((n) => `'${n}'`).join(', ')}] as const;
export type TegelSet = (typeof TEGELSETS)[number];
export const CEL_B = ${CEL_B}, CEL_H = ${CEL_H}, CEL_X = ${CX}, CEL_Y = ${CY}, KOLOMMEN = ${KOLOMMEN};
export const VARIANTEN = ${VARIANTEN}, WATER_VARIANTEN = ${WATER_VARIANTEN}, WATER_BEELDEN = ${WATER_BEELDEN}, SCHUIM_BEELDEN = ${SCHUIM_BEELDEN};

// Hoeken ten opzichte van de laagste (0, 1 of 2): achter, rechts, voor, links.
export const celLand = (a: number, r: number, v: number, l: number, variant: number) => a * 27 + r * 9 + v * 3 + l + variant * 81;
export const celWater = (variant: number, beeld: number) => ${CEL_WATER} + variant * WATER_BEELDEN + beeld;
// rand: 0 = achter-rechts, 1 = rechts-voor, 2 = voor-links, 3 = links-achter
export const celSchuim = (rand: number, beeld: number) => ${CEL_SCHUIM} + rand * SCHUIM_BEELDEN + beeld;
`,
);
